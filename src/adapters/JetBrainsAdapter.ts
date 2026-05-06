import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for JetBrains IDEs.
 * Installs skill instructions into `.idea/ai-rules/`.
 */
export class JetBrainsAdapter implements IdeAdapter {
  readonly name = 'jetbrains';
  readonly configDir = '.idea';

  async detect(workspaceRoot: string): Promise<boolean> {
    return fs.existsSync(path.join(workspaceRoot, '.idea'));
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsJetBrains =
      skill.manifest.targets.includes('jetbrains') || skill.manifest.targets.includes('all');

    if (!targetsJetBrains) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'jetbrains'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.idea', 'ai-rules');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.idea', 'ai-rules', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
