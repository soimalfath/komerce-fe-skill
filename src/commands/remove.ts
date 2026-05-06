import { CommandContext } from './types';

/**
 * Remove command handler.
 * Removes an installed skill from the workspace and cleans up IDE configurations.
 *
 * @param namespace - Skill namespace to remove (e.g., "fe/vue-2")
 * @param context - Command context with all dependencies
 */
export async function removeCommand(
  namespace: string,
  context: CommandContext
): Promise<void> {
  try {
    // Step 1: Remove the skill package
    await context.packageManager.remove(namespace);

    // Step 2: Run IDE adapters to remove generated config files
    try {
      const adapters = await context.ideDetector.detectAll(context.workspaceRoot);

      for (const adapter of adapters) {
        try {
          await adapter.remove(namespace, context.workspaceRoot);
        } catch (err) {
          // Non-fatal: log warning but continue
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.warn(
            `Warning: Failed to remove ${adapter.name} config for ${namespace}: ${errorMessage}`
          );
        }
      }
    } catch (err) {
      // Non-fatal: log warning but continue
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`Warning: Failed to detect IDEs: ${errorMessage}`);
    }

    // Step 3: Print success message
    console.log(`✓ Removed ${namespace}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}
