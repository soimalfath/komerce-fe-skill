import { IdeAdapter, SkillErrorCode } from '../types';
import { SkillError } from '../errors';
import { KiroAdapter } from './KiroAdapter';
import { CursorAdapter } from './CursorAdapter';
import { CopilotAdapter } from './CopilotAdapter';
import { JetBrainsAdapter } from './JetBrainsAdapter';
import { AntigravityAdapter } from './AntigravityAdapter';
import { WindsurfAdapter } from './WindsurfAdapter';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter';
import { ClineAdapter } from './ClineAdapter';
import { GeminiCliAdapter } from './GeminiCliAdapter';
import { AugmentAdapter } from './AugmentAdapter';
import { AiderAdapter } from './AiderAdapter';

/**
 * Detects which IDE adapters are applicable for a given workspace.
 */
export class IdeDetector {
  private readonly allAdapters: IdeAdapter[] = [
    new KiroAdapter(),
    new CursorAdapter(),
    new CopilotAdapter(),
    new JetBrainsAdapter(),
    new AntigravityAdapter(),
    new WindsurfAdapter(),
    new ClaudeCodeAdapter(),
    new ClineAdapter(),
    new GeminiCliAdapter(),
    new AugmentAdapter(),
    new AiderAdapter(),
  ];

  /**
   * Returns the list of IDE adapters to use for the given workspace.
   *
   * Strategy:
   * 1. If forceIde is set → only that adapter
   * 2. If skillTargets is set → use BOTH detected IDEs AND targeted IDEs (union)
   *    This ensures skills that explicitly target an IDE get installed even if
   *    the IDE config directory doesn't exist yet in the workspace.
   * 3. If neither → auto-detect from workspace, fallback to all
   *
   * @param workspaceRoot - Absolute path to the workspace root directory
   * @param forceIde - If provided, only return the adapter matching this IDE name
   * @param skillTargets - If provided, also include adapters matching these targets
   * @returns Array of applicable IDE adapters
   * @throws SkillError(IDE_NOT_SUPPORTED) if forceIde is provided but not found
   */
  async detectAll(
    workspaceRoot: string,
    forceIde?: string
  ): Promise<IdeAdapter[]> {
    // Force specific IDE
    if (forceIde !== undefined) {
      const normalized = forceIde.toLowerCase();
      const adapter = this.allAdapters.find((a) => a.name.toLowerCase() === normalized);

      if (!adapter) {
        throw new SkillError(
          SkillErrorCode.IDE_NOT_SUPPORTED,
          `IDE '${forceIde}' is not supported. Supported IDEs: ${this.allAdapters.map((a) => a.name).join(', ')}`
        );
      }

      return [adapter];
    }

    // Detect which IDEs are present in the workspace
    const detected: IdeAdapter[] = [];

    for (const adapter of this.allAdapters) {
      const exists = await adapter.detect(workspaceRoot);
      if (exists) {
        detected.push(adapter);
      }
    }

    // Strict behavior: if no IDE config directories are found in the workspace,
    // do not guess or fallback. Ask the user to explicitly specify.
    if (detected.length === 0) {
      throw new SkillError(
        SkillErrorCode.IDE_NOT_SUPPORTED,
        `No supported IDEs detected in the workspace.\n` +
        `If you are in a fresh project, use the --ide flag to force installation for your IDE.\n` +
        `Example: komerce-skill install <skill> --ide antigravity`
      );
    }

    return detected;
  }
}
