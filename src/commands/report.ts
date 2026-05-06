import { exec } from 'child_process';
import { CommandContext } from './types';

/**
 * Opens a URL in the default browser based on the current platform.
 */
function openUrl(url: string): void {
  const platform = process.platform;
  let command: string;

  if (platform === 'win32') {
    command = `start "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    // Linux and other Unix-like systems
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      // Non-fatal: user can still open the URL manually
    }
  });
}

/**
 * Report command handler.
 * Generates a GitHub issue URL for reporting a problematic skill.
 *
 * @param namespace - Skill namespace to report (e.g., "fe/vue-2")
 * @param _context - Command context (unused but required for interface consistency)
 */
export async function reportCommand(
  namespace: string,
  _context: CommandContext
): Promise<void> {
  // Step 1: Construct GitHub issue URL
  const url = `https://github.com/komerce/ai-skills-registry/issues/new?title=Report+skill:+${encodeURIComponent(namespace)}&labels=skill-report`;

  // Step 2 & 3: Print instructions and URL
  console.log(`To report skill '${namespace}', open this URL in your browser:`);
  console.log(url);

  // Step 4: Try to open the URL automatically
  try {
    openUrl(url);
  } catch {
    // Non-fatal: user can open the URL manually from the printed output
  }
}
