import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Kiro.
 * Installs skill instructions into `.kiro/steering/`.
 */
export class KiroAdapter implements IdeAdapter {
  readonly name = 'kiro';
  readonly configDir = '.kiro';

  async detect(workspaceRoot: string): Promise<boolean> {
    return fs.existsSync(path.join(workspaceRoot, '.kiro'));
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsKiro =
      skill.manifest.targets.includes('kiro') || skill.manifest.targets.includes('all');

    if (!targetsKiro) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'kiro'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.kiro', 'steering');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.kiro', 'steering', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
