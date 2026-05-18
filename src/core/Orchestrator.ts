import { RegistryClient } from '../registry/RegistryClient';
import { WorkspaceState } from '../workspace/WorkspaceState';
import { PackageManager, InstallResult } from '../package/PackageManager';
import { IdeDetector } from '../adapters/IdeDetector';
import { CommandContext } from '../commands/types';

/**
 * Core Orchestrator — wires all components together and provides
 * the CommandContext used by every CLI command handler.
 *
 * Responsibilities:
 * - Initialise and hold singleton instances of all services
 * - Coordinate the install flow: RegistryClient → PackageManager → IdeDetector → IDE Adapters → WorkspaceState
 * - Coordinate the remove flow: PackageManager → IDE Adapters → WorkspaceState
 * - Handle partial failures in multi-skill install
 */
export class Orchestrator {
  readonly registryClient: RegistryClient;
  readonly workspaceState: WorkspaceState;
  readonly packageManager: PackageManager;
  readonly ideDetector: IdeDetector;
  readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;

    this.registryClient = new RegistryClient();
    this.workspaceState = new WorkspaceState(workspaceRoot);
    this.packageManager = new PackageManager(
      this.registryClient,
      this.workspaceState,
      workspaceRoot
    );
    this.ideDetector = new IdeDetector();

    // Load workspace state from disk on startup
    this.workspaceState.load();
  }

  /**
   * Returns a CommandContext object suitable for passing to command handlers.
   */
  getContext(): CommandContext {
    return {
      registryClient: this.registryClient,
      workspaceState: this.workspaceState,
      packageManager: this.packageManager,
      ideDetector: this.ideDetector,
      workspaceRoot: this.workspaceRoot,
    };
  }

  /**
   * Full install flow for one or more namespaces.
   * Installs packages, then runs IDE adapters for all successful installs.
   * Handles partial failures — failed skills are reported but don't stop others.
   *
   * @param namespaces - Array of skill namespaces to install
   * @param options - Optional install options (ide: force specific IDE)
   * @returns Array of InstallResult for each namespace
   */
  async install(
    namespaces: string[],
    options: { ide?: string } = {}
  ): Promise<InstallResult[]> {
    const results: InstallResult[] = [];

    // 1. Install each skill package
    for (const namespace of namespaces) {
      const result = await this.packageManager.install(namespace, options);
      results.push(result);
    }

    // 2. Run IDE adapters for successfully installed skills
    const successful = results.filter((r) => r.success);
    if (successful.length > 0) {
      try {
        const adapters = await this.ideDetector.detectAll(
          this.workspaceRoot,
          options.ide
        );

        for (const adapter of adapters) {
          for (const result of successful) {
            const skill = this.workspaceState.getSkill(result.namespace);
            if (skill) {
              try {
                await adapter.install(skill, this.workspaceRoot);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(
                  `Warning: Failed to generate ${adapter.name} config for ${result.namespace}: ${msg}`
                );
              }
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Warning: IDE detection failed: ${msg}`);
      }
    }

    return results;
  }

  /**
   * Full remove flow for a single namespace.
   * Removes the package files and all IDE-generated config files.
   *
   * @param namespace - Skill namespace to remove
   */
  async remove(namespace: string): Promise<void> {
    // 1. Remove package files and update WorkspaceState
    await this.packageManager.remove(namespace);

    // 2. Remove IDE-generated config files
    try {
      const adapters = await this.ideDetector.detectAll(this.workspaceRoot);
      for (const adapter of adapters) {
        try {
          await adapter.remove(namespace, this.workspaceRoot);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `Warning: Failed to remove ${adapter.name} config for ${namespace}: ${msg}`
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Warning: IDE detection failed during remove: ${msg}`);
    }
  }
}
