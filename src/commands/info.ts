import * as fs from 'fs';
import * as path from 'path';
import { CommandContext } from './types';
import { NamespaceMapper } from '../registry/NamespaceMapper';

/**
 * Info command handler.
 * Displays detailed information about a skill from the registry.
 *
 * @param namespace - Skill namespace to get info for (e.g., "fe/vue-2")
 * @param context - Command context with all dependencies
 */
export async function infoCommand(
  namespace: string,
  context: CommandContext
): Promise<void> {
  // Step 1: Convert namespace to package name
  const mapper = new NamespaceMapper();
  const packageName = mapper.toPackageName(namespace);

  // Step 2: Fetch package info from registry
  const packageInfo = await context.registryClient.getPackageInfo(packageName);

  // Step 3: Fetch download count
  const downloads = await context.registryClient.getDownloadCount(packageName);

  // Step 4: Print detailed info
  console.log(`\nSkill: ${namespace}`);
  console.log(`Package: ${packageName}`);
  console.log(`Version: ${packageInfo.version}`);
  console.log(`Description: ${packageInfo.description}`);
  console.log(`Author: ${packageInfo.author}`);
  console.log(`Downloads (last month): ${downloads.toLocaleString('en-US')}`);

  if (packageInfo.versions && packageInfo.versions.length > 0) {
    console.log(`Available versions: ${packageInfo.versions.join(', ')}`);
  }

  // Step 5: Try to read and print the entrypoint file content if skill is installed locally
  const installedSkill = context.workspaceState.getSkill(namespace);
  if (installedSkill) {
    const manifest = installedSkill.manifest;

    if (manifest.targets && manifest.targets.length > 0) {
      console.log(`Targets: ${manifest.targets.join(', ')}`);
    }

    if (manifest.keywords && manifest.keywords.length > 0) {
      console.log(`Keywords: ${manifest.keywords.join(', ')}`);
    }

    // Try to read the entrypoint file
    const entrypointPath = path.join(
      context.workspaceRoot,
      installedSkill.installDir,
      manifest.entrypoint
    );

    try {
      if (fs.existsSync(entrypointPath)) {
        const content = fs.readFileSync(entrypointPath, 'utf-8');
        console.log(`\n--- Instructions (${manifest.entrypoint}) ---`);
        console.log(content);
        console.log('--- End of Instructions ---');
      }
    } catch {
      // Non-fatal: skip if we can't read the file
    }
  }
}
