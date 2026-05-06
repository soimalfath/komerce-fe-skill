/**
 * Handles deterministic conversion between skill namespaces and npm package names.
 *
 * Namespace format:    <category>/<skill-name>   e.g. "fe/vue-2"
 * Package name format: @komerce-skill/<category>-<skill-name>  e.g. "@komerce-skill/fe-vue-2"
 */
export class NamespaceMapper {
  private static readonly SCOPE = '@komerce-skill';
  private static readonly NAMESPACE_REGEX = /^[a-z0-9-]+\/[a-z0-9-]+$/;

  /**
   * Converts a namespace to an npm package name.
   * @example "fe/vue-2" → "@komerce-skill/fe-vue-2"
   */
  toPackageName(namespace: string): string {
    const [category, skillName] = namespace.split('/');
    return `${NamespaceMapper.SCOPE}/${category}-${skillName}`;
  }

  /**
   * Converts an npm package name back to a namespace.
   * @example "@komerce-skill/fe-vue-2" → "fe/vue-2"
   */
  toNamespace(packageName: string): string {
    const withoutScope = packageName.replace(`${NamespaceMapper.SCOPE}/`, '');
    const dashIndex = withoutScope.indexOf('-');
    const category = withoutScope.substring(0, dashIndex);
    const skillName = withoutScope.substring(dashIndex + 1);
    return `${category}/${skillName}`;
  }

  /**
   * Validates that a namespace matches the required format: ^[a-z0-9-]+/[a-z0-9-]+$
   * @example "fe/vue-2" → true, "FE/Vue2" → false
   */
  isValidNamespace(namespace: string): boolean {
    return NamespaceMapper.NAMESPACE_REGEX.test(namespace);
  }
}
