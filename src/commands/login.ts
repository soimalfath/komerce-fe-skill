import { spawnSync } from 'child_process';
import { CommandContext } from './types';

/**
 * Login command handler.
 * Authenticates the user to the npm registry under the @komerce-skill scope.
 *
 * @param _context - Command context (unused but required for interface consistency)
 */
export async function loginCommand(_context: CommandContext): Promise<void> {
  console.log('Logging in to npm registry for @komerce-skill scope...');

  const result = spawnSync(
    'npm',
    ['login', '--scope=@komerce-skill', '--registry=https://registry.npmjs.org'],
    { stdio: 'inherit', shell: true }
  );

  if (result.status !== 0) {
    console.error('Error: Failed to log in to npm registry.');
    process.exit(1);
  }

  console.log('✓ Successfully logged in to npm registry.');
}
