import * as https from 'https';
import * as http from 'http';
import { SkillError } from '../errors';
import { SkillErrorCode, SearchResult } from '../types';

/**
 * Metadata for a package retrieved from the npm registry.
 */
interface PackageInfo {
  name: string;
  version: string;       // latest version
  description: string;
  author: string;
  versions: string[];    // all available versions
  tarballUrl: string;    // tarball URL for latest version
  integrity: string;     // sha512 integrity hash for latest version
}

/**
 * Raw npm registry package metadata shape (partial).
 */
interface NpmPackageMetadata {
  name: string;
  description?: string;
  author?: string | { name?: string };
  'dist-tags': { latest: string };
  versions: Record<
    string,
    {
      dist: {
        tarball: string;
        integrity: string;
      };
    }
  >;
}

/**
 * Raw npm search result shape (partial).
 */
interface NpmSearchResponse {
  objects: Array<{
    package: {
      name: string;
      description?: string;
      version: string;
      author?: { name?: string; username?: string };
      keywords?: string[];
    };
  }>;
}

/**
 * Raw npm download count response shape.
 */
interface NpmDownloadResponse {
  downloads: number;
}

/**
 * Performs an HTTPS GET request and returns the response body as a string.
 * Follows redirects (up to 5 hops).
 */
function httpsGet(url: string, redirectsLeft = 5): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'komerce-skill-cli/1.0.0',
      },
    };

    const req = https.request(options, (res) => {
      // Handle redirects
      if (
        res.statusCode !== undefined &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        resolve(httpsGet(res.headers.location, redirectsLeft - 1));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf-8'),
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error('Request timed out'));
    });
    req.end();
  });
}

/**
 * Downloads binary data from a URL (follows redirects, supports http and https).
 */
function downloadBinary(url: string, redirectsLeft = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib: typeof https | typeof http = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'komerce-skill-cli/1.0.0',
      },
    };

    const req = lib.request(options, (res) => {
      if (
        res.statusCode !== undefined &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        resolve(downloadBinary(res.headers.location, redirectsLeft - 1));
        return;
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(60_000, () => {
      req.destroy(new Error('Download timed out'));
    });
    req.end();
  });
}

/**
 * Returns true if the error is a transient network error that should be retried.
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof SkillError) {
    // Do not retry on 404 (SKILL_NOT_FOUND / VERSION_NOT_FOUND)
    return err.code === SkillErrorCode.REGISTRY_UNAVAILABLE;
  }
  // Retry on generic network errors (ECONNREFUSED, ETIMEDOUT, etc.)
  return true;
}

/**
 * Sleeps for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an async operation with retry logic.
 * Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 * Does NOT retry on 404 errors.
 */
async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  const delays = [1000, 2000, 4000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      // Do not retry on non-retryable errors (e.g. 404)
      if (!isRetryableError(err)) {
        throw err;
      }

      // No more retries
      if (attempt === delays.length) {
        break;
      }

      await sleep(delays[attempt]);
    }
  }

  throw lastError;
}

/**
 * Extracts the author name from an npm author field (string or object).
 */
function extractAuthor(author: string | { name?: string } | undefined): string {
  if (!author) return '';
  if (typeof author === 'string') return author;
  return author.name ?? '';
}

/**
 * Client for interacting with the npm registry API.
 * Uses Node.js built-in `https` module — no extra HTTP libraries.
 */
export class RegistryClient {
  /**
   * Fetches package metadata from the npm registry.
   * @param packageName - The full npm package name, e.g. "@komerce-skill/fe-vue-2"
   */
  async getPackageInfo(packageName: string): Promise<PackageInfo> {
    return withRetry(async () => {
      const encodedName = encodeURIComponent(packageName);
      const url = `https://registry.npmjs.org/${encodedName}`;

      const { statusCode, body } = await httpsGet(url);

      if (statusCode === 404) {
        throw new SkillError(
          SkillErrorCode.SKILL_NOT_FOUND,
          `Package '${packageName}' not found in registry.`
        );
      }

      if (statusCode >= 500) {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Registry returned ${statusCode} for package '${packageName}'.`
        );
      }

      if (statusCode !== 200) {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Unexpected status ${statusCode} from registry for package '${packageName}'.`
        );
      }

      let metadata: NpmPackageMetadata;
      try {
        metadata = JSON.parse(body) as NpmPackageMetadata;
      } catch {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Failed to parse registry response for package '${packageName}'.`
        );
      }

      const latestVersion = metadata['dist-tags']?.latest;
      if (!latestVersion) {
        throw new SkillError(
          SkillErrorCode.SKILL_NOT_FOUND,
          `No latest version found for package '${packageName}'.`
        );
      }

      const latestVersionData = metadata.versions[latestVersion];
      if (!latestVersionData) {
        throw new SkillError(
          SkillErrorCode.VERSION_NOT_FOUND,
          `Version '${latestVersion}' not found in package '${packageName}'.`
        );
      }

      return {
        name: metadata.name,
        version: latestVersion,
        description: metadata.description ?? '',
        author: extractAuthor(metadata.author),
        versions: Object.keys(metadata.versions),
        tarballUrl: latestVersionData.dist.tarball,
        integrity: latestVersionData.dist.integrity,
      };
    });
  }

  /**
   * Searches for packages in the npm registry.
   * @param query - Search query string
   */
  async searchPackages(query: string): Promise<SearchResult[]> {
    return withRetry(async () => {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://registry.npmjs.org/-/v1/search?text=@komerce-skill+${encodedQuery}&size=20`;

      const { statusCode, body } = await httpsGet(url);

      if (statusCode >= 500) {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Registry search returned ${statusCode}.`
        );
      }

      if (statusCode !== 200) {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Unexpected status ${statusCode} from registry search.`
        );
      }

      let searchResponse: NpmSearchResponse;
      try {
        searchResponse = JSON.parse(body) as NpmSearchResponse;
      } catch {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          'Failed to parse registry search response.'
        );
      }

      // Map npm search results to SearchResult[]
      const results: SearchResult[] = [];
      for (const obj of searchResponse.objects) {
        const pkg = obj.package;
        const packageName = pkg.name;

        // Derive namespace from package name: "@komerce-skill/fe-vue-2" → "fe/vue-2"
        const namespace = this._packageNameToNamespace(packageName);

        // Fetch download count (best-effort, default 0 on error)
        const downloads = await this.getDownloadCount(packageName).catch(() => 0);

        results.push({
          namespace,
          packageName,
          description: pkg.description ?? '',
          version: pkg.version,
          author: pkg.author?.name ?? pkg.author?.username ?? '',
          downloads,
          keywords: pkg.keywords ?? [],
        });
      }

      return results;
    });
  }

  /**
   * Returns the download count for a package over the last month.
   * Returns 0 on any error (non-fatal).
   * @param packageName - The full npm package name
   */
  async getDownloadCount(packageName: string): Promise<number> {
    try {
      return await withRetry(async () => {
        const encodedName = encodeURIComponent(packageName);
        const url = `https://api.npmjs.org/downloads/point/last-month/${encodedName}`;

        const { statusCode, body } = await httpsGet(url);

        if (statusCode !== 200) {
          return 0;
        }

        let data: NpmDownloadResponse;
        try {
          data = JSON.parse(body) as NpmDownloadResponse;
        } catch {
          return 0;
        }

        return data.downloads ?? 0;
      });
    } catch {
      return 0;
    }
  }

  /**
   * Downloads the tarball for a specific package version.
   * @param packageName - The full npm package name
   * @param version - The version to download
   */
  async downloadTarball(packageName: string, version: string): Promise<Buffer> {
    return withRetry(async () => {
      const encodedName = encodeURIComponent(packageName);
      const url = `https://registry.npmjs.org/${encodedName}`;

      const { statusCode, body } = await httpsGet(url);

      if (statusCode === 404) {
        throw new SkillError(
          SkillErrorCode.SKILL_NOT_FOUND,
          `Package '${packageName}' not found in registry.`
        );
      }

      if (statusCode >= 500) {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Registry returned ${statusCode} for package '${packageName}'.`
        );
      }

      if (statusCode !== 200) {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Unexpected status ${statusCode} from registry for package '${packageName}'.`
        );
      }

      let metadata: NpmPackageMetadata;
      try {
        metadata = JSON.parse(body) as NpmPackageMetadata;
      } catch {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Failed to parse registry response for package '${packageName}'.`
        );
      }

      const versionData = metadata.versions[version];
      if (!versionData) {
        throw new SkillError(
          SkillErrorCode.VERSION_NOT_FOUND,
          `Version '${version}' not found for package '${packageName}'. Available versions: ${Object.keys(metadata.versions).join(', ')}`
        );
      }

      const tarballUrl = versionData.dist.tarball;
      return downloadBinary(tarballUrl);
    });
  }

  /**
   * Returns all available versions for a package.
   * @param packageName - The full npm package name
   */
  async getVersions(packageName: string): Promise<string[]> {
    return withRetry(async () => {
      const encodedName = encodeURIComponent(packageName);
      const url = `https://registry.npmjs.org/${encodedName}`;

      const { statusCode, body } = await httpsGet(url);

      if (statusCode === 404) {
        throw new SkillError(
          SkillErrorCode.SKILL_NOT_FOUND,
          `Package '${packageName}' not found in registry.`
        );
      }

      if (statusCode >= 500) {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Registry returned ${statusCode} for package '${packageName}'.`
        );
      }

      if (statusCode !== 200) {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Unexpected status ${statusCode} from registry for package '${packageName}'.`
        );
      }

      let metadata: NpmPackageMetadata;
      try {
        metadata = JSON.parse(body) as NpmPackageMetadata;
      } catch {
        throw new SkillError(
          SkillErrorCode.REGISTRY_UNAVAILABLE,
          `Failed to parse registry response for package '${packageName}'.`
        );
      }

      return Object.keys(metadata.versions);
    });
  }

  /**
   * Converts an npm package name to a skill namespace.
   * "@komerce-skill/fe-vue-2" → "fe/vue-2"
   */
  private _packageNameToNamespace(packageName: string): string {
    const withoutScope = packageName.replace('@komerce-skill/', '');
    const dashIndex = withoutScope.indexOf('-');
    if (dashIndex === -1) return withoutScope;
    const category = withoutScope.substring(0, dashIndex);
    const skillName = withoutScope.substring(dashIndex + 1);
    return `${category}/${skillName}`;
  }
}
