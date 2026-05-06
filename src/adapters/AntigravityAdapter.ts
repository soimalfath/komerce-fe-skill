import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Antigravity.
 * Installs skill instructions into `.antigravity/skills/`.
 */
export class AntigravityAdapter implements IdeAdapter {
  readonly name = 'antigravity';
  readonly configDir = '.antigravity';

  async detect(workspaceRoot: string): Promise<boolean> {
    return fs.existsSync(path.join(workspaceRoot, '.antigravity'));
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsAntigravity =
      skill.manifest.targets.includes('antigravity') || skill.manifest.targets.includes('all');

    if (!targetsAntigravity) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'antigravity'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.antigravity', 'skills');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.antigravity', 'skills', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
