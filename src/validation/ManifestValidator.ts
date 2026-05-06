import * as fs from 'fs';
import * as path from 'path';
import { IdeTarget, ValidationError, ValidationResult } from '../types';

/**
 * Valid SemVer pattern.
 * Accepts: 1.0.0, 2.3.1-beta.1, 0.0.1-alpha.0+build.1
 * Rejects: v1, 1.0, latest, 1.0.0.0
 */
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const VALID_TARGETS: IdeTarget[] = ['kiro', 'cursor', 'copilot', 'jetbrains', 'antigravity', 'all'];

const REQUIRED_FIELDS: Array<keyof import('../types').SkillManifest> = [
  'name',
  'version',
  'description',
  'author',
  'license',
  'category',
  'targets',
  'entrypoint',
];

/**
 * Validates skill manifests (skill.json) against the required schema.
 */
export class ManifestValidator {
  /**
   * Validates a manifest object against all schema rules.
   * Collects all errors rather than failing on the first one.
   *
   * @param manifest - The raw (unknown) manifest object to validate
   * @returns ValidationResult with valid flag and full list of errors
   */
  validate(manifest: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
      errors.push({
        field: 'manifest',
        message: 'Manifest must be a non-null object',
        value: manifest,
      });
      return { valid: false, errors };
    }

    const m = manifest as Record<string, unknown>;

    // --- Check required fields are present and non-empty strings (except targets) ---
    for (const field of REQUIRED_FIELDS) {
      if (field === 'targets') continue; // handled separately
      const value = m[field];
      if (value === undefined || value === null) {
        errors.push({
          field,
          message: `Field '${field}' is required`,
          value,
        });
      } else if (typeof value !== 'string' || value.trim() === '') {
        errors.push({
          field,
          message: `Field '${field}' must be a non-empty string`,
          value,
        });
      }
    }

    // --- Validate 'targets' ---
    const targetsValue = m['targets'];
    if (targetsValue === undefined || targetsValue === null) {
      errors.push({
        field: 'targets',
        message: "Field 'targets' is required",
        value: targetsValue,
      });
    } else if (!Array.isArray(targetsValue)) {
      errors.push({
        field: 'targets',
        message: "Field 'targets' must be an array",
        value: targetsValue,
      });
    } else if (targetsValue.length === 0) {
      errors.push({
        field: 'targets',
        message: "Field 'targets' must contain at least one IDE target",
        value: targetsValue,
      });
    } else {
      const invalidTargets = targetsValue.filter(
        (t) => !VALID_TARGETS.includes(t as IdeTarget)
      );
      if (invalidTargets.length > 0) {
        errors.push({
          field: 'targets',
          message: `Invalid target(s): ${invalidTargets.join(', ')}. Allowed values: ${VALID_TARGETS.join(', ')}`,
          value: targetsValue,
        });
      }
    }

    // --- Validate 'version' SemVer format ---
    const versionValue = m['version'];
    if (typeof versionValue === 'string' && versionValue.trim() !== '') {
      if (!SEMVER_REGEX.test(versionValue)) {
        errors.push({
          field: 'version',
          message: `'${versionValue}' is not a valid SemVer string (e.g. "1.0.0", "2.3.1-beta.1")`,
          value: versionValue,
        });
      }
    }
    // If version is missing/empty, the required-field check above already added an error.

    // --- Validate category matches prefix of name ---
    const nameValue = m['name'];
    const categoryValue = m['category'];
    if (
      typeof nameValue === 'string' &&
      nameValue.trim() !== '' &&
      typeof categoryValue === 'string' &&
      categoryValue.trim() !== ''
    ) {
      const namePrefix = nameValue.split('/')[0];
      if (namePrefix !== categoryValue) {
        errors.push({
          field: 'category',
          message: `Field 'category' ("${categoryValue}") must match the category prefix of 'name' ("${namePrefix}")`,
          value: categoryValue,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Reads skill.json from the given directory, validates the manifest,
   * then checks that the entrypoint file exists.
   *
   * @param skillDir - Absolute or relative path to the skill directory
   * @returns ValidationResult with all errors found
   */
  async validateForPublish(skillDir: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Read skill.json
    const manifestPath = path.join(skillDir, 'skill.json');
    let manifest: unknown;

    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(raw);
    } catch (err) {
      const message =
        err instanceof SyntaxError
          ? `skill.json contains invalid JSON: ${err.message}`
          : `Could not read skill.json at '${manifestPath}': ${(err as Error).message}`;
      errors.push({ field: 'skill.json', message });
      return { valid: false, errors };
    }

    // Validate manifest schema
    const schemaResult = this.validate(manifest);
    if (!schemaResult.valid) {
      return schemaResult;
    }

    // Check entrypoint file exists
    const m = manifest as Record<string, unknown>;
    const entrypoint = m['entrypoint'] as string;
    const entrypointPath = path.join(skillDir, entrypoint);

    if (!fs.existsSync(entrypointPath)) {
      errors.push({
        field: 'entrypoint',
        message: `Entrypoint file '${entrypoint}' not found in skill directory '${skillDir}'`,
        value: entrypoint,
      });
    }

    return { valid: errors.length === 0, errors };
  }
}
