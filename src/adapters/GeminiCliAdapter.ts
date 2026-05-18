import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Gemini CLI.
 * Installs skill instructions into `.gemini/instructions/`.
 *
 * Gemini CLI uses `GEMINI.md` in the project root for top-level context
 * and `.gemini/` directory for project-specific configuration.
 * Skills are installed as separate files in `.gemini/instructions/`
 * which can be referenced from the main `GEMINI.md`.
 */
export class GeminiCliAdapter implements IdeAdapter {
  readonly name = 'gemini-cli';
  readonly configDir = '.gemini';

  async detect(workspaceRoot: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(workspaceRoot, 'GEMINI.md')) ||
      fs.existsSync(path.join(workspaceRoot, '.gemini'))
    );
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsGeminiCli =
      skill.manifest.targets.includes('gemini-cli') || skill.manifest.targets.includes('all');

    if (!targetsGeminiCli) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'gemini-cli'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.gemini', 'instructions');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.gemini', 'instructions', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
