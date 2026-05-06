/**
 * Shared utility functions for IDE adapters.
 */

/**
 * Converts a skill namespace to a safe filename.
 * e.g. "fe/vue-2" → "fe-vue-2"
 */
export function namespaceToFilename(namespace: string): string {
  return namespace.replace('/', '-');
}
