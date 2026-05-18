import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Windsurf.
 * Installs skill instructions into `.windsurf/rules/`.
 *
 * Windsurf uses `.windsurf/rules/` for workspace-scoped rules,
 * with each rule as a separate Markdown file.
 */
export class WindsurfAdapter implements IdeAdapter {
  readonly name = 'windsurf';
  readonly configDir = '.windsurf';

  async detect(workspaceRoot: string): Promise<boolean> {
    return fs.existsSync(path.join(workspaceRoot, '.windsurf'));
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsWindsurf =
      skill.manifest.targets.includes('windsurf') || skill.manifest.targets.includes('all');

    if (!targetsWindsurf) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'windsurf'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.windsurf', 'rules');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.windsurf', 'rules', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
