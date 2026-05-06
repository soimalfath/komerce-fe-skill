import { CommandContext } from './types';
import { ListedSkill } from '../package/PackageManager';

/**
 * Pads a string to the given width with spaces.
 */
function padEnd(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

/**
 * Renders a table of listed skills to stdout.
 */
function renderTable(skills: ListedSkill[]): void {
  const COL_NAMESPACE = 16;
  const COL_INSTALLED = 10;
  const COL_LATEST = 10;
  const COL_STATUS = 10;

  const header =
    padEnd('Namespace', COL_NAMESPACE) +
    padEnd('Installed', COL_INSTALLED) +
    padEnd('Latest', COL_LATEST) +
    'Status';

  const separator = '─'.repeat(COL_NAMESPACE + COL_INSTALLED + COL_LATEST + COL_STATUS);

  console.log(header);
  console.log(separator);

  for (const skill of skills) {
    const row =
      padEnd(skill.namespace, COL_NAMESPACE) +
      padEnd(skill.installedVersion, COL_INSTALLED) +
      padEnd(skill.latestVersion, COL_LATEST) +
      skill.status;
    console.log(row);
  }
}

/**
 * List command handler.
 * Lists all installed skills with their versions and update status.
 *
 * @param options - Command options (category: filter by category prefix)
 * @param context - Command context with all dependencies
 */
export async function listCommand(
  options: { category?: string },
  context: CommandContext
): Promise<void> {
  let skills = await context.packageManager.listInstalled();

  // Filter by category if specified
  if (options.category !== undefined) {
    const prefix = options.category + '/';
    skills = skills.filter((skill) => skill.namespace.startsWith(prefix));
  }

  if (skills.length === 0) {
    console.log('No skills installed.');
    return;
  }

  renderTable(skills);
}
