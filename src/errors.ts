import { SkillErrorCode } from './types';

/**
 * Custom error class for all skill-related errors.
 * Wraps a SkillErrorCode for consistent error categorisation and handling.
 */
export class SkillError extends Error {
  readonly code: SkillErrorCode;

  constructor(code: SkillErrorCode, message: string) {
    super(message);
    this.name = 'SkillError';
    this.code = code;

    // Maintain proper prototype chain in TypeScript when extending Error
    Object.setPrototypeOf(this, SkillError.prototype);
  }
}
