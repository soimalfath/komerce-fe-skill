import * as fs from 'fs';
import * as path from 'path';
import { InstalledSkill } from '../types';

/**
 * Structure of the skills.lock.json file.
 */
interface LockFile {
  version: '1';
  skills: Record<string, InstalledSkill>;
}

/**
 * Manages the workspace skill state stored in `.kiro/skills/skills.lock.json`.
 *
 * The lock file tracks all installed skills and their metadata so the CLI
 * can determine what is installed, what needs updating, and what to remove.
 */
export class WorkspaceState {
  private readonly lockFilePath: string;
  private skills: Record<string, InstalledSkill> = {};

  /**
   * @param workspaceRoot - Absolute path to the workspace root directory
   */
  constructor(workspaceRoot: string) {
    this.lockFilePath = path.join(workspaceRoot, '.kiro', 'skills', 'skills.lock.json');
  }

  /**
   * Reads the lock file from disk and populates the in-memory state.
   * If the file does not exist, initialises an empty state (no error thrown).
   */
  load(): void {
    if (!fs.existsSync(this.lockFilePath)) {
      this.skills = {};
      return;
    }

    try {
      const raw = fs.readFileSync(this.lockFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as LockFile;
      this.skills = parsed.skills ?? {};
    } catch {
      // If the file is corrupt or unreadable, start with an empty state
      this.skills = {};
    }
  }

  /**
   * Writes the current in-memory state to the lock file.
   * Creates parent directories if they do not exist.
   */
  save(): void {
    const dir = path.dirname(this.lockFilePath);
    fs.mkdirSync(dir, { recursive: true });

    const lockFile: LockFile = {
      version: '1',
      skills: this.skills,
    };

    fs.writeFileSync(this.lockFilePath, JSON.stringify(lockFile, null, 2), 'utf-8');
  }

  /**
   * Returns an array of all installed skills.
   */
  getInstalledSkills(): InstalledSkill[] {
    return Object.values(this.skills);
  }

  /**
   * Returns the installed skill for the given namespace, or undefined if not found.
   * @param namespace - Skill namespace, e.g. "fe/vue-2"
   */
  getSkill(namespace: string): InstalledSkill | undefined {
    return this.skills[namespace];
  }

  /**
   * Adds or replaces a skill entry in the state.
   * @param skill - The installed skill record to store
   */
  addSkill(skill: InstalledSkill): void {
    this.skills[skill.namespace] = skill;
  }

  /**
   * Removes a skill entry from the state.
   * No error is thrown if the skill is not found.
   * @param namespace - Skill namespace to remove, e.g. "fe/vue-2"
   */
  removeSkill(namespace: string): void {
    delete this.skills[namespace];
  }

  /**
   * Updates the version and installedAt timestamp for an existing skill.
   * If the skill is not found, this is a no-op.
   * @param namespace - Skill namespace to update, e.g. "fe/vue-2"
   * @param newVersion - The new version string
   */
  updateSkill(namespace: string, newVersion: string): void {
    const existing = this.skills[namespace];
    if (!existing) return;

    this.skills[namespace] = {
      ...existing,
      version: newVersion,
      installedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns true if the given namespace is currently installed.
   * @param namespace - Skill namespace to check, e.g. "fe/vue-2"
   */
  hasSkill(namespace: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.skills, namespace);
  }
}
