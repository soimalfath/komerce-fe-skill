import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Augment Code.
 * Installs skill instructions into `.augment/rules/`.
 *
 * Augment Code uses `.augment/rules/` for workspace-scoped rules
 * and `.augment-guidelines` as a legacy single-file alternative.
 */
export class AugmentAdapter implements IdeAdapter {
  readonly name = 'augment';
  readonly configDir = '.augment';

  async detect(workspaceRoot: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(workspaceRoot, '.augment')) ||
      fs.existsSync(path.join(workspaceRoot, '.augment-guidelines'))
    );
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsAugment =
      skill.manifest.targets.includes('augment') || skill.manifest.targets.includes('all');

    if (!targetsAugment) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'augment'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.augment', 'rules');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.augment', 'rules', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
