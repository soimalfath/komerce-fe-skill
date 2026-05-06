import { CommandContext } from './types';

/**
 * Update command handler.
 * Updates one or all installed skills to their latest versions.
 *
 * @param namespace - Skill namespace to update (e.g., "fe/vue-2"), or undefined if using --all
 * @param options - Command options (all: update all installed skills)
 * @param context - Command context with all dependencies
 */
export async function updateCommand(
  namespace: string | undefined,
  options: { all?: boolean },
  context: CommandContext
): Promise<void> {
  if (options.all) {
    // Update all installed skills
    const results = await context.packageManager.updateAll();

    if (results.length === 0) {
      console.log('All skills are already up-to-date.');
      return;
    }

    for (const result of results) {
      if (result.success) {
        console.log(`✓ Updated ${result.namespace}@${result.version}`);
      } else {
        console.error(`✗ Failed to update ${result.namespace}: ${result.error}`);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`\nUpdated ${successCount}/${results.length} skills successfully.`);
  } else if (namespace !== undefined) {
    // Update a single skill
    const result = await context.packageManager.update(namespace);

    if (result.success) {
      console.log(`✓ Updated ${namespace}@${result.version}`);
    } else {
      console.error(`✗ Failed to update ${namespace}: ${result.error}`);
      process.exit(1);
    }
  } else {
    // Neither namespace nor --all provided
    console.error('Error: Provide a namespace or use --all');
    process.exit(1);
  }
}
