import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for GitHub Copilot.
 * Installs skill instructions into `.github/instructions/`.
 */
export class CopilotAdapter implements IdeAdapter {
  readonly name = 'copilot';
  readonly configDir = '.github';

  async detect(workspaceRoot: string): Promise<boolean> {
    return fs.existsSync(path.join(workspaceRoot, '.github'));
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
