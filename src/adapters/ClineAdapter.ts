import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Cline (VS Code extension).
 * Installs skill instructions into `.clinerules/`.
 *
 * Cline uses `.clinerules/` directory for workspace-scoped rules.
 * Each rule is a separate Markdown file that Cline automatically
 * loads and merges into its system prompt.
 */
export class ClineAdapter implements IdeAdapter {
  readonly name = 'cline';
  readonly configDir = '.clinerules';

  async detect(workspaceRoot: string): Promise<boolean> {
    const clinerules = path.join(workspaceRoot, '.clinerules');
    // .clinerules can be either a file or a directory
    return fs.existsSync(clinerules);
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsCline =
      skill.manifest.targets.includes('cline') || skill.manifest.targets.includes('all');

    if (!targetsCline) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'cline'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    // Ensure .clinerules is a directory (not a flat file)
    const destDir = path.join(workspaceRoot, '.clinerules');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.clinerules', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
