/**
 * Core type definitions for the AI Skills Registry CLI tool.
 * All shared interfaces and types are defined here for consistency across modules.
 */

// ---------------------------------------------------------------------------
// IDE Target
// ---------------------------------------------------------------------------

/**
 * Supported IDE targets for skill installation.
 * 'all' means the skill supports every IDE.
 */
export type IdeTarget =
  | 'kiro'
  | 'cursor'
  | 'copilot'
  | 'jetbrains'
  | 'antigravity'
  | 'windsurf'
  | 'claude-code'
  | 'cline'
  | 'gemini-cli'
  | 'augment'
  | 'aider'
  | 'all';

// ---------------------------------------------------------------------------
// Skill Manifest
// ---------------------------------------------------------------------------

/**
 * Represents the contents of a `skill.json` manifest file.
 * This is the authoritative metadata for a skill package.
 */
export interface SkillManifest {
  // Required fields
  /** Skill namespace in format "<category>/<skill-name>", e.g. "fe/vue-2" */
  name: string;
  /** Semantic version string, e.g. "1.0.0" or "2.3.1-beta.1" */
  version: string;
  /** Short description of the skill */
  description: string;
  /** Author name or email */
  author: string;
  /** SPDX license identifier, e.g. "MIT" */
  license: string;
  /** Category prefix matching the namespace, e.g. "fe", "be", "testing" */
  category: string;
  /** List of IDE targets this skill supports */
  targets: IdeTarget[];
  /** Relative path to the main instruction file, e.g. "instructions.md" */
  entrypoint: string;

  // Optional fields
  /** Namespaces of other skills this skill depends on */
  dependencies?: string[];
  /** Keywords for search discoverability */
  keywords?: string[];
  /** URL to documentation or homepage */
  homepage?: string;
  /** URL to source repository */
  repository?: string;
}

// ---------------------------------------------------------------------------
// Installed Skill
// ---------------------------------------------------------------------------

/**
 * Record of a skill that has been installed in a workspace.
 * Stored in the workspace lock file.
 */
export interface InstalledSkill {
  /** Skill namespace, e.g. "fe/vue-2" */
  namespace: string;
  /** npm package name, e.g. "@komerce-skill/fe-vue-2" */
  packageName: string;
  /** Installed version string */
  version: string;
  /** ISO 8601 timestamp of when the skill was installed */
  installedAt: string;
  /** Relative path to the install directory, e.g. ".kiro/skills/fe/vue-2" */
  installDir: string;
  /** The parsed skill.json manifest */
  manifest: SkillManifest;
}

// ---------------------------------------------------------------------------
// Search Result
// ---------------------------------------------------------------------------

/**
 * A single result item returned from a registry search query.
 */
export interface SearchResult {
  /** Skill namespace, e.g. "fe/vue-2" */
  namespace: string;
  /** npm package name, e.g. "@komerce-skill/fe-vue-2" */
  packageName: string;
  /** Short description of the skill */
  description: string;
  /** Latest published version */
  version: string;
  /** Author name or email */
  author: string;
  /** Download count for the last month */
  downloads: number;
  /** Keywords associated with the skill */
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Describes a single validation failure on a manifest field.
 */
export interface ValidationError {
  /** The field path that failed validation, e.g. "version" */
  field: string;
  /** Human-readable explanation of why validation failed */
  message: string;
  /** The actual value that was provided (if available) */
  value?: unknown;
}

/**
 * The result of validating a skill manifest.
 */
export interface ValidationResult {
  /** Whether the manifest passed all validation checks */
  valid: boolean;
  /** List of validation errors (empty when valid is true) */
  errors: ValidationError[];
}

// ---------------------------------------------------------------------------
// IDE Adapter
// ---------------------------------------------------------------------------

/**
 * Interface that every IDE adapter must implement.
 * Adapters translate installed skills into IDE-specific configuration files.
 */
export interface IdeAdapter {
  /** Human-readable name of the IDE, e.g. "Kiro" */
  readonly name: string;
  /** Root config directory for this IDE, e.g. ".kiro", ".cursor" */
  readonly configDir: string;

  /**
   * Detect whether this IDE is active in the given workspace.
   * @param workspaceRoot - Absolute path to the workspace root directory
   * @returns true if the IDE's config directory exists in the workspace
   */
  detect(workspaceRoot: string): Promise<boolean>;

  /**
   * Generate IDE-specific configuration file(s) for the given skill.
   * @param skill - The installed skill record
   * @param workspaceRoot - Absolute path to the workspace root directory
   */
  install(skill: InstalledSkill, workspaceRoot: string): Promise<void>;

  /**
   * Remove IDE-specific configuration file(s) for the given skill namespace.
   * @param skillNamespace - The skill namespace, e.g. "fe/vue-2"
   * @param workspaceRoot - Absolute path to the workspace root directory
   */
  remove(skillNamespace: string, workspaceRoot: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

/**
 * Enumeration of all error codes used throughout the CLI.
 * Used to categorise errors for consistent handling and user messaging.
 */
export enum SkillErrorCode {
  // Registry errors
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  VERSION_NOT_FOUND = 'VERSION_NOT_FOUND',
  REGISTRY_UNAVAILABLE = 'REGISTRY_UNAVAILABLE',

  // Package errors
  CHECKSUM_MISMATCH = 'CHECKSUM_MISMATCH',
  INVALID_FILE_EXTENSION = 'INVALID_FILE_EXTENSION',
  INVALID_MANIFEST = 'INVALID_MANIFEST',
  MISSING_ENTRYPOINT = 'MISSING_ENTRYPOINT',

  // Auth errors
  NOT_AUTHENTICATED = 'NOT_AUTHENTICATED',
  PUBLISH_CONFLICT = 'PUBLISH_CONFLICT',

  // Workspace errors
  SKILL_NOT_INSTALLED = 'SKILL_NOT_INSTALLED',
  WORKSPACE_WRITE_ERROR = 'WORKSPACE_WRITE_ERROR',

  // IDE errors
  IDE_NOT_SUPPORTED = 'IDE_NOT_SUPPORTED',
  IDE_CONFIG_WRITE_ERROR = 'IDE_CONFIG_WRITE_ERROR',
}
