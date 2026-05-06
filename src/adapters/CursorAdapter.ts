import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Cursor.
 * Installs skill instructions into `.cursor/rules/`.
 */
export class CursorAdapter implements IdeAdapter {
  readonly name = 'cursor';
  readonly configDir = '.cursor';

  async detect(workspaceRoot: string): Promise<boolean> {
    return fs.existsSync(path.join(workspaceRoot, '.cursor'));
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsCursor =
      skill.manifest.targets.includes('cursor') || skill.manifest.targets.includes('all');

    if (!targetsCursor) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'cursor'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.cursor', 'rules');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.mdc`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.mdc`;
    const filePath = path.join(workspaceRoot, '.cursor', 'rules', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
