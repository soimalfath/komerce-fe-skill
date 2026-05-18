import * as fs from 'fs';
import * as path from 'path';
import { IdeAdapter, InstalledSkill } from '../types';
import { namespaceToFilename } from './adapterUtils';

/**
 * IDE adapter for Claude Code (Anthropic CLI).
 * Installs skill instructions into `.claude/rules/`.
 *
 * Claude Code uses `CLAUDE.md` in the project root for top-level instructions
 * and `.claude/rules/` for modular rule files.
 */
export class ClaudeCodeAdapter implements IdeAdapter {
  readonly name = 'claude-code';
  readonly configDir = '.claude';

  async detect(workspaceRoot: string): Promise<boolean> {
    return (
      fs.existsSync(path.join(workspaceRoot, 'CLAUDE.md')) ||
      fs.existsSync(path.join(workspaceRoot, '.claude'))
    );
  }

  async install(skill: InstalledSkill, workspaceRoot: string): Promise<void> {
    const targetsClaudeCode =
      skill.manifest.targets.includes('claude-code') || skill.manifest.targets.includes('all');

    if (!targetsClaudeCode) {
      console.warn(
        `Warning: skill '${skill.namespace}' does not target 'claude-code'. Skipping.`
      );
      return;
    }

    const entrypointPath = path.join(workspaceRoot, skill.installDir, skill.manifest.entrypoint);
    const content = fs.readFileSync(entrypointPath, 'utf-8');

    const destDir = path.join(workspaceRoot, '.claude', 'rules');
    fs.mkdirSync(destDir, { recursive: true });

    const filename = `${namespaceToFilename(skill.namespace)}.md`;
    fs.writeFileSync(path.join(destDir, filename), content, 'utf-8');
  }

  async remove(skillNamespace: string, workspaceRoot: string): Promise<void> {
    const filename = `${namespaceToFilename(skillNamespace)}.md`;
    const filePath = path.join(workspaceRoot, '.claude', 'rules', filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
