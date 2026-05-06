import { CommandContext } from './types';

/**
 * Install command handler.
 * Installs one or more skills from the npm registry.
 *
 * @param namespaces - Array of skill namespaces to install (e.g., ["fe/vue-2", "be/express"])
 * @param options - Command options (ide: force specific IDE)
 * @param context - Command context with all dependencies
 */
export async function installCommand(
  namespaces: string[],
  options: { ide?: string },
  context: CommandContext
): Promise<void> {
  const results: Array<{ namespace: string; success: boolean; version?: string; error?: string }> = [];

  // Step 1: Install each skill
  for (const namespace of namespaces) {
    try {
      const result = await context.packageManager.install(namespace, { ide: options.ide });

      if (result.success) {
        console.log(`✓ Installed ${namespace}@${result.version}`);
        results.push({ namespace, success: true, version: result.version });
      } else {
        console.error(`✗ Failed to install ${namespace}: ${result.error}`);
        results.push({ namespace, success: false, error: result.error });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`✗ Failed to install ${namespace}: ${errorMessage}`);
      results.push({ namespace, success: false, error: errorMessage });
    }
  }

  // Step 2: Run IDE adapters for successfully installed skills
  const successfulInstalls = results.filter((r) => r.success);

  if (successfulInstalls.length > 0) {
    try {
      const adapters = await context.ideDetector.detectAll(context.workspaceRoot, options.ide);

      for (const adapter of adapters) {
        for (const result of successfulInstalls) {
          const skill = context.workspaceState.getSkill(result.namespace);
          if (skill) {
            try {
              await adapter.install(skill, context.workspaceRoot);
            } catch (err) {
              // Non-fatal: log warning but continue
              const errorMessage = err instanceof Error ? err.message : String(err);
              console.warn(
                `Warning: Failed to generate ${adapter.name} config for ${result.namespace}: ${errorMessage}`
              );
            }
          }
        }
      }
    } catch (err) {
      // Non-fatal: log warning but continue
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`Warning: Failed to detect IDEs: ${errorMessage}`);
    }
  }

  // Step 3: Print summary if multiple skills
  if (namespaces.length > 1) {
    const successCount = results.filter((r) => r.success).length;
    console.log(`\nInstalled ${successCount}/${namespaces.length} skills successfully.`);
  }
}
