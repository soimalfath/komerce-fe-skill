import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for GitHub Copilot.
 * Installs skill instructions into `.github/instructions/`.
 *
 * Detection checks for Copilot-specific indicators within the `.github/`
 * directory to avoid false positives from repos that only use GitHub Actions.
 */
export class CopilotAdapter implements IdeAdapter {
  readonly name = 'copilot';
  readonly configDir = '.github';

  async detect(workspaceRoot: string): Promise<boolean> {
    const githubDir = path.join(workspaceRoot, '.github');
    if (!fs.existsSync(githubDir)) {
      return false;
    }

    // Check for Copilot-specific indicators:
    // 1. .github/copilot-instructions.md (repository-wide instructions)
    // 2. .github/instructions/ directory (path-specific instructions)
    // 3. .github/copilot/ directory (Copilot config)
    return (
      fs.existsSync(path.join(githubDir, 'copilot-instructions.md')) ||
      fs.existsSync(path.join(githubDir, 'instructions')) ||
      fs.existsSync(path.join(githubDir, 'copilot'))
    );
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsCopilot =
      skill.manifest.targets.includes('copilot') || skill.manifest.targets.includes('all');

    if (!targetsCopilot) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'copilot'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.github', 'instructions');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.instructions.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.instructions.md`;
    const filePath = path.join(workspaceRoot, '.github', 'instructions', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
