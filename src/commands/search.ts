import { CommandContext } from './types';
import { SearchResult } from '../types';

/**
 * Pads a string to the given width with spaces.
 */
function padEnd(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

/**
 * Formats a number with comma separators (e.g., 1234 → "1,234").
 */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Renders a table of search results to stdout.
 */
function renderSearchTable(results: SearchResult[]): void {
  const COL_NAMESPACE = 16;
  const COL_DESCRIPTION = 30;
  const COL_DOWNLOADS = 10;

  const header =
    padEnd('Namespace', COL_NAMESPACE) +
    padEnd('Description', COL_DESCRIPTION) +
    'Downloads';

  const separator = '─'.repeat(COL_NAMESPACE + COL_DESCRIPTION + COL_DOWNLOADS);

  console.log(header);
  console.log(separator);

  for (const result of results) {
    // Truncate description if too long
    const description =
      result.description.length > COL_DESCRIPTION - 1
        ? result.description.substring(0, COL_DESCRIPTION - 4) + '...'
        : result.description;

    const row =
      padEnd(result.namespace, COL_NAMESPACE) +
      padEnd(description, COL_DESCRIPTION) +
      formatNumber(result.downloads);
    console.log(row);
  }
}

/**
 * Search command handler.
 * Searches for skills in the npm registry.
 *
 * @param query - Search query string
 * @param context - Command context with all dependencies
 */
export async function searchCommand(
  query: string,
  context: CommandContext
): Promise<void> {
  const results = await context.registryClient.searchPackages(query);

  if (results.length === 0) {
    console.log(`No skills found for query: ${query}`);
    return;
  }

  renderSearchTable(results);
}
