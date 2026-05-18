import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Antigravity.
 * Installs skill instructions into `.agents/rules/`.
 *
 * Antigravity IDE uses the `.agents/` directory for workspace-scoped
 * configuration, with rules (instructions) stored in `.agents/rules/`.
 */
export class AntigravityAdapter implements IdeAdapter {
  readonly name = 'antigravity';
  readonly configDir = '.agents';

  async detect(workspaceRoot: string): Promise<boolean> {
    // Antigravity uses `.agents/` as its workspace config directory.
    // Also check for `.gemini/` (global config sometimes present in workspace)
    // and `GEMINI.md` as additional detection signals.
    return (
      fs.existsSync(path.join(workspaceRoot, '.agents')) ||
      fs.existsSync(path.join(workspaceRoot, '.gemini')) ||
      fs.existsSync(path.join(workspaceRoot, 'GEMINI.md'))
    );
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

    const destDir = path.join(workspaceRoot, '.agents', 'rules');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.agents', 'rules', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
