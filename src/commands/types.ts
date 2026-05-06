import { RegistryClient } from '../registry/RegistryClient';
import { WorkspaceState } from '../workspace/WorkspaceState';
import { PackageManager } from '../package/PackageManager';
import { IdeDetector } from '../adapters/IdeDetector';

/**
 * Context object passed to all command handlers.
 * Contains all dependencies needed to execute commands.
 */
export interface CommandContext {
  registryClient: RegistryClient;
  workspaceState: WorkspaceState;
  packageManager: PackageManager;
  ideDetector: IdeDetector;
  workspaceRoot: string;
}
