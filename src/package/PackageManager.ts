import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { SkillError } from '../errors';
import { RegistryClient } from '../registry/RegistryClient';
import { NamespaceMapper } from '../registry/NamespaceMapper';
import { WorkspaceState } from '../workspace/WorkspaceState';
import { InstalledSkill, SkillErrorCode, SkillManifest, ValidationResult } from '../types';

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface InstallResult {
  namespace: string;
  version: string;
  installDir: string;
  success: boolean;
  error?: string;
}

export interface ListedSkill {
  namespace: string;
  installedVersion: string;
  latestVersion: string;
  status: 'up-to-date' | 'outdated';
}

// ---------------------------------------------------------------------------
// Allowed file extensions inside a skill tarball
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set(['.md', '.json', '.txt']);

// ---------------------------------------------------------------------------
// Tar header parser helpers
// ---------------------------------------------------------------------------

/**
 * Lists all file paths contained in a (gunzipped) tar buffer.
 * Each tar block is 512 bytes; the filename occupies bytes 0–99.
 */
function listTarFiles(tarBuffer: Buffer): string[] {
  const files: string[] = [];
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.slice(offset, offset + 512);
    const filename = header.slice(0, 100).toString('utf-8').replace(/\0/g, '').trim();

    if (!filename) {
      offset += 512;
      continue;
    }

    // File size is stored as an octal string in bytes 124–135
    const sizeOctal = header.slice(124, 136).toString('utf-8').replace(/\0/g, '').trim();
    const size = parseInt(sizeOctal, 8) || 0;

    // Skip GNU long-link entries
    if (filename !== '././@LongLink') {
      files.push(filename);
    }

    // Advance past this header + data blocks (rounded up to 512-byte boundary)
    offset += 512 + Math.ceil(size / 512) * 512;
  }

  return files;
}

/**
 * Strips the first path component from a tar entry path.
 * npm tarballs wrap everything under a `package/` prefix.
 * e.g. "package/skill.json" → "skill.json"
 */
function stripFirstComponent(filePath: string): string {
  const slashIndex = filePath.indexOf('/');
  if (slashIndex === -1) return filePath;
  return filePath.substring(slashIndex + 1);
}

// ---------------------------------------------------------------------------
// PackageManager
// ---------------------------------------------------------------------------

export class PackageManager {
  private readonly namespaceMapper: NamespaceMapper;

  constructor(
    private readonly registryClient: RegistryClient,
    private readonly workspaceState: WorkspaceState,
    private readonly workspaceRoot: string
  ) {
    this.namespaceMapper = new NamespaceMapper();
  }

  // -------------------------------------------------------------------------
  // validatePackage
  // -------------------------------------------------------------------------

  /**
   * Validates a tarball buffer against an expected SHA-512 integrity hash and
   * checks that all files inside use only allowed extensions (.md, .json, .txt).
   *
   * @param tarball - Raw tarball buffer (gzipped tar)
   * @param expectedIntegrity - Expected integrity string in `sha512-<base64>` format
   */
  validatePackage(tarball: Buffer, expectedIntegrity: string): ValidationResult {
    // --- Checksum validation ---
    const hash = crypto.createHash('sha512').update(tarball).digest('base64');
    const actualIntegrity = `sha512-${hash}`;

    if (actualIntegrity !== expectedIntegrity) {
      return {
        valid: false,
        errors: [
          {
            field: 'integrity',
            message: `Checksum mismatch. Expected: ${expectedIntegrity}, Received: ${actualIntegrity}`,
          },
        ],
      };
    }

    // --- File extension validation ---
    let tarBuffer: Buffer;
    try {
      tarBuffer = zlib.gunzipSync(tarball);
    } catch {
      return {
        valid: false,
        errors: [
          {
            field: 'integrity',
            message: 'Failed to decompress tarball: invalid gzip data',
          },
        ],
      };
    }

    const files = listTarFiles(tarBuffer);
    const invalidFiles = files.filter((f) => {
      // Skip directory entries (end with /)
      if (f.endsWith('/')) return false;
      const ext = path.extname(f).toLowerCase();
      return !ALLOWED_EXTENSIONS.has(ext);
    });

    if (invalidFiles.length > 0) {
      return {
        valid: false,
        errors: [
          {
            field: 'files',
            message: `Invalid file extensions: ${invalidFiles.join(', ')}`,
            value: invalidFiles,
          },
        ],
      };
    }

    return { valid: true, errors: [] };
  }

  // -------------------------------------------------------------------------
  // extractTarball
  // -------------------------------------------------------------------------

  /**
   * Extracts a gzipped tarball to the given destination directory.
   * Strips the first path component (npm `package/` prefix).
   *
   * @param tarball - Raw tarball buffer (gzipped tar)
   * @param destDir - Absolute path to the destination directory
   */
  async extractTarball(tarball: Buffer, destDir: string): Promise<void> {
    const tarBuffer = zlib.gunzipSync(tarball);
    let offset = 0;

    while (offset + 512 <= tarBuffer.length) {
      const header = tarBuffer.slice(offset, offset + 512);
      const rawFilename = header.slice(0, 100).toString('utf-8').replace(/\0/g, '').trim();

      if (!rawFilename) {
        offset += 512;
        continue;
      }

      const sizeOctal = header.slice(124, 136).toString('utf-8').replace(/\0/g, '').trim();
      const size = parseInt(sizeOctal, 8) || 0;

      // Advance past header
      offset += 512;

      // Skip GNU long-link metadata entries
      if (rawFilename === '././@LongLink') {
        offset += Math.ceil(size / 512) * 512;
        continue;
      }

      // Strip the leading `package/` (or whatever the first component is)
      const strippedName = stripFirstComponent(rawFilename);

      // Skip if stripping left us with an empty path (i.e. the root `package/` entry)
      if (!strippedName) {
        offset += Math.ceil(size / 512) * 512;
        continue;
      }

      // Skip directory entries
      if (strippedName.endsWith('/') || size === 0 && rawFilename.endsWith('/')) {
        offset += Math.ceil(size / 512) * 512;
        continue;
      }

      // Extract file content
      const fileContent = tarBuffer.slice(offset, offset + size);
      const destPath = path.join(destDir, strippedName);

      // Ensure parent directory exists
      fs.mkdirSync(path.dirname(destPath), { recursive: true });

      // Write file
      fs.writeFileSync(destPath, fileContent);

      offset += Math.ceil(size / 512) * 512;
    }
  }

  // -------------------------------------------------------------------------
  // install
  // -------------------------------------------------------------------------

  /**
   * Installs a skill by namespace.
   *
   * Steps:
   * 1. Validate namespace format
   * 2. Convert namespace → package name
   * 3. Fetch package info from registry
   * 4. Print author + download count
   * 5. Download tarball
   * 6. Validate checksum + file extensions
   * 7. Extract to .kiro/skills/<category>/<skill-name>/
   * 8. Read skill.json, parse manifest
   * 9. Update WorkspaceState
   * 10. Return InstallResult
   */
  async install(namespace: string, _options?: { ide?: string }): Promise<InstallResult> {
    // 1. Validate namespace
    if (!this.namespaceMapper.isValidNamespace(namespace)) {
      return {
        namespace,
        version: '',
        installDir: '',
        success: false,
        error: `Invalid namespace format: '${namespace}'. Expected format: <category>/<skill-name>`,
      };
    }

    try {
      // 2. Convert namespace → package name
      const packageName = this.namespaceMapper.toPackageName(namespace);

      // 3. Fetch package info
      const packageInfo = await this.registryClient.getPackageInfo(packageName);
      const { version, author, integrity } = packageInfo;

      // 4. Fetch download count and print info
      const downloads = await this.registryClient.getDownloadCount(packageName);
      console.log(
        `Installing ${namespace}@${version} by ${author} (${downloads} downloads last month)...`
      );

      // 5. Download tarball
      const tarball = await this.registryClient.downloadTarball(packageName, version);

      // 6. Validate checksum + file extensions
      const validation = this.validatePackage(tarball, integrity);
      if (!validation.valid) {
        const firstError = validation.errors[0];
        if (firstError.field === 'integrity') {
          throw new SkillError(
            SkillErrorCode.CHECKSUM_MISMATCH,
            firstError.message
          );
        } else {
          throw new SkillError(
            SkillErrorCode.INVALID_FILE_EXTENSION,
            firstError.message
          );
        }
      }

      // 7. Determine install directory and extract
      const [category, skillName] = namespace.split('/');
      const relativeInstallDir = path.join('.kiro', 'skills', category, skillName);
      const absoluteInstallDir = path.join(this.workspaceRoot, relativeInstallDir);

      fs.mkdirSync(absoluteInstallDir, { recursive: true });
      await this.extractTarball(tarball, absoluteInstallDir);

      // 8. Read and parse skill.json
      const skillJsonPath = path.join(absoluteInstallDir, 'skill.json');
      let manifest: SkillManifest;
      try {
        const raw = fs.readFileSync(skillJsonPath, 'utf-8');
        manifest = JSON.parse(raw) as SkillManifest;
      } catch {
        throw new SkillError(
          SkillErrorCode.INVALID_MANIFEST,
          `Failed to read or parse skill.json from '${skillJsonPath}'`
        );
      }

      // 9. Update WorkspaceState
      const installedSkill: InstalledSkill = {
        namespace,
        packageName,
        version,
        installedAt: new Date().toISOString(),
        installDir: relativeInstallDir,
        manifest,
      };

      this.workspaceState.addSkill(installedSkill);
      this.workspaceState.save();

      // 10. Return result
      return {
        namespace,
        version,
        installDir: relativeInstallDir,
        success: true,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        namespace,
        version: '',
        installDir: '',
        success: false,
        error: message,
      };
    }
  }

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------

  /**
   * Removes an installed skill from the workspace.
   *
   * @param namespace - Skill namespace, e.g. "fe/vue-2"
   */
  async remove(namespace: string): Promise<void> {
    // Check skill is installed
    if (!this.workspaceState.hasSkill(namespace)) {
      throw new SkillError(
        SkillErrorCode.SKILL_NOT_INSTALLED,
        `Skill '${namespace}' is not installed in this workspace.`
      );
    }

    // Determine install directory
    const [category, skillName] = namespace.split('/');
    const absoluteInstallDir = path.join(
      this.workspaceRoot,
      '.kiro',
      'skills',
      category,
      skillName
    );

    // Delete directory recursively
    if (fs.existsSync(absoluteInstallDir)) {
      fs.rmSync(absoluteInstallDir, { recursive: true, force: true });
    }

    // Update WorkspaceState
    this.workspaceState.removeSkill(namespace);
    this.workspaceState.save();
  }

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------

  /**
   * Updates a skill to the latest version by re-installing it.
   *
   * @param namespace - Skill namespace, e.g. "fe/vue-2"
   */
  async update(namespace: string): Promise<InstallResult> {
    return this.install(namespace);
  }

  // -------------------------------------------------------------------------
  // updateAll
  // -------------------------------------------------------------------------

  /**
   * Updates all installed skills that have a newer version available.
   * Returns an array of InstallResult for skills that were actually updated.
   */
  async updateAll(): Promise<InstallResult[]> {
    const installedSkills = this.workspaceState.getInstalledSkills();
    const results: InstallResult[] = [];

    for (const skill of installedSkills) {
      try {
        const packageName = this.namespaceMapper.toPackageName(skill.namespace);
        const packageInfo = await this.registryClient.getPackageInfo(packageName);

        if (packageInfo.version !== skill.version) {
          const result = await this.install(skill.namespace);
          results.push(result);
        }
      } catch {
        // Skip skills where we can't fetch registry info
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // listInstalled
  // -------------------------------------------------------------------------

  /**
   * Lists all installed skills with their current and latest versions.
   */
  async listInstalled(): Promise<ListedSkill[]> {
    const installedSkills = this.workspaceState.getInstalledSkills();
    const listed: ListedSkill[] = [];

    for (const skill of installedSkills) {
      let latestVersion = skill.version;

      try {
        const packageName = this.namespaceMapper.toPackageName(skill.namespace);
        const packageInfo = await this.registryClient.getPackageInfo(packageName);
        latestVersion = packageInfo.version;
      } catch {
        // Fall back to installed version if registry is unavailable
        latestVersion = skill.version;
      }

      listed.push({
        namespace: skill.namespace,
        installedVersion: skill.version,
        latestVersion,
        status: latestVersion === skill.version ? 'up-to-date' : 'outdated',
      });
    }

    return listed;
  }
}
