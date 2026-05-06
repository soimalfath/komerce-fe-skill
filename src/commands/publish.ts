import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { CommandContext } from './types';
import { ManifestValidator } from '../validation/ManifestValidator';
import { NamespaceMapper } from '../registry/NamespaceMapper';
import { SkillManifest } from '../types';

/**
 * Checks whether the current user is authenticated to the npm registry.
 * Returns the username if authenticated, or null if not.
 */
function getNpmUser(): string | null {
  const result = spawnSync(
    'npm',
    ['whoami', '--registry=https://registry.npmjs.org'],
    { encoding: 'utf-8', shell: true }
  );

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  return result.stdout.trim() || null;
}

/**
 * Generates a package.json object from a skill manifest.
 */
function generatePackageJson(manifest: SkillManifest, packageName: string): Record<string, unknown> {
  const keywords = ['komerce-skill', manifest.category, ...(manifest.keywords ?? [])];

  return {
    name: packageName,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    license: manifest.license,
    keywords: [...new Set(keywords)], // deduplicate
    files: ['skill.json', manifest.entrypoint, 'README.md'],
  };
}

/**
 * Publish command handler.
 * Validates and publishes a skill package to the npm registry.
 *
 * @param skillDir - Path to the skill directory (defaults to cwd)
 * @param _context - Command context (unused but required for interface consistency)
 */
export async function publishCommand(
  skillDir: string = process.cwd(),
  _context: CommandContext
): Promise<void> {
  // Step 1: Check authentication
  const npmUser = getNpmUser();
  if (!npmUser) {
    console.error('Error: You are not authenticated to npm registry.');
    console.error("Run 'npx komerce-skill login' to authenticate.");
    process.exit(1);
  }

  // Step 2: Validate manifest
  const validator = new ManifestValidator();
  const validation = await validator.validateForPublish(skillDir);

  if (!validation.valid) {
    console.error("Error: Manifest 'skill.json' is not valid. Publication cancelled.\n");
    console.error('Invalid fields:');
    for (const err of validation.errors) {
      console.error(`  - ${err.field}: ${err.message}`);
    }
    process.exit(1);
  }

  // Step 3: Read manifest and generate package.json
  const manifestPath = path.join(skillDir, 'skill.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as SkillManifest;

  const mapper = new NamespaceMapper();
  const packageName = mapper.toPackageName(manifest.name);

  const packageJson = generatePackageJson(manifest, packageName);
  const packageJsonPath = path.join(skillDir, 'package.json');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

  console.log(`Publishing ${packageName}@${manifest.version}...`);

  // Step 4: Run npm publish
  const result = spawnSync(
    'npm',
    ['publish', '--access', 'public'],
    { cwd: skillDir, stdio: 'inherit', shell: true }
  );

  if (result.status !== 0) {
    // Check stderr for version conflict
    const stderr = result.stderr?.toString() ?? '';
    if (stderr.includes('previously published') || stderr.includes('cannot publish over')) {
      console.error(
        `Error: Version ${manifest.version} of '${packageName}' already exists in the registry.`
      );
      console.error("Bump the version in skill.json and try again.");
    } else {
      console.error('Error: Publication failed. See output above for details.');
    }
    process.exit(1);
  }

  console.log(`✓ Published! View at: https://www.npmjs.com/package/${packageName}`);
}
