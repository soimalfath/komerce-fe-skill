import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Aider CLI.
 * Installs skill instructions into `.aider/instructions/`.
 *
 * Aider uses `.aider.conf.yml` for configuration and `CONVENTIONS.md`
 * for coding conventions. Skills are installed as separate Markdown
 * files in `.aider/instructions/` that can be referenced from the
 * config's `read:` list.
 */
export class AiderAdapter implements IdeAdapter {
  readonly name = 'aider';
  readonly configDir = '.aider';

  async detect(workspaceRoot: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(workspaceRoot, '.aider.conf.yml')) ||
      fs.existsSync(path.join(workspaceRoot, 'CONVENTIONS.md')) ||
      fs.existsSync(path.join(workspaceRoot, '.aider'))
    );
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsAider =
      skill.manifest.targets.includes('aider') || skill.manifest.targets.includes('all');

    if (!targetsAider) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'aider'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.aider', 'instructions');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.aider', 'instructions', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
