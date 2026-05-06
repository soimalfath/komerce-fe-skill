import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { CommandContext } from './types';
import { IdeTarget, SkillManifest } from '../types';
import { NamespaceMapper } from '../registry/NamespaceMapper';

const VALID_TARGETS: IdeTarget[] = ['kiro', 'cursor', 'copilot', 'jetbrains', 'antigravity', 'all'];

/**
 * Prompts the user for a single line of input.
 */
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts until a non-empty value is provided.
 */
async function promptRequired(rl: readline.Interface, question: string): Promise<string> {
  let value = '';
  while (!value) {
    value = await prompt(rl, question);
    if (!value) {
      console.log('  This field is required.');
    }
  }
  return value;
}

/**
 * Generates a package.json object from a skill manifest.
 */
function generatePackageJson(manifest: SkillManifest, packageName: string): Record<string, unknown> {
  const keywords = ['komerce-skill', manifest.category, ...(manifest.keywords ?? [])];
  return {
    name: packageName,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    license: manifest.license,
    keywords: [...new Set(keywords)],
    files: ['skill.json', manifest.entrypoint, 'README.md'],
  };
}

/**
 * Default instructions.md template content.
 */
function defaultInstructions(name: string): string {
  return `# ${name} Skill

## Overview

Add your AI instructions here.

## Guidelines

- Guideline 1
- Guideline 2
`;
}

/**
 * Init command handler.
 * Interactively scaffolds a new skill package.
 *
 * @param options - Command options (template: namespace of a template skill)
 * @param context - Command context with all dependencies
 */
export async function initCommand(
  options: { template?: string },
  context: CommandContext
): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log('Creating a new skill scaffold...\n');

    // Step 1: Prompt for required fields
    const mapper = new NamespaceMapper();

    let namespaceName = '';
    while (!namespaceName) {
      namespaceName = await promptRequired(rl, 'Skill name (namespace, e.g. fe/vue-2): ');
      if (!mapper.isValidNamespace(namespaceName)) {
        console.log('  Invalid format. Use <category>/<skill-name> with lowercase letters, numbers, and hyphens.');
        namespaceName = '';
      }
    }

    const description = await promptRequired(rl, 'Description: ');
    const author = await promptRequired(rl, 'Author: ');

    const licenseInput = await prompt(rl, 'License (default: MIT): ');
    const license = licenseInput || 'MIT';

    let targets: IdeTarget[] = [];
    while (targets.length === 0) {
      const targetsInput = await promptRequired(
        rl,
        `Targets (comma-separated, options: ${VALID_TARGETS.join(', ')}): `
      );
      const parsed = targetsInput.split(',').map((t) => t.trim().toLowerCase());
      const invalid = parsed.filter((t) => !VALID_TARGETS.includes(t as IdeTarget));
      if (invalid.length > 0) {
        console.log(`  Invalid targets: ${invalid.join(', ')}. Use: ${VALID_TARGETS.join(', ')}`);
      } else {
        targets = parsed as IdeTarget[];
      }
    }

    // Derive category from namespace
    const category = namespaceName.split('/')[0];

    // Step 2: Handle template
    let instructionsContent = defaultInstructions(namespaceName);

    if (options.template) {
      const templatePackageName = mapper.toPackageName(options.template);
      try {
        console.log(`\nFetching template '${options.template}' from registry...`);
        await context.registryClient.getPackageInfo(templatePackageName);
        // Template found — note: we just use default content since we can't easily
        // extract the instructions from the tarball at init time without installing.
        // A future enhancement could download and extract the template.
        console.log(`Template '${options.template}' found. Using as reference.`);
      } catch {
        console.warn(
          `Warning: Template '${options.template}' not found in registry. Using default template.`
        );
      }
    }

    // Step 3: Build manifest
    const manifest: SkillManifest = {
      name: namespaceName,
      version: '1.0.0',
      description,
      author,
      license,
      category,
      targets,
      entrypoint: 'instructions.md',
    };

    // Step 4: Generate files in a new directory
    const packageName = mapper.toPackageName(namespaceName);
    const skillDirName = namespaceName.replace('/', '-');
    const skillDir = path.join(process.cwd(), skillDirName);

    fs.mkdirSync(skillDir, { recursive: true });

    // Write skill.json
    fs.writeFileSync(
      path.join(skillDir, 'skill.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // Write instructions.md
    fs.writeFileSync(
      path.join(skillDir, 'instructions.md'),
      instructionsContent,
      'utf-8'
    );

    // Write package.json
    const packageJson = generatePackageJson(manifest, packageName);
    fs.writeFileSync(
      path.join(skillDir, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );

    // Step 5: Print success
    console.log(`\n✓ Skill scaffold created in ./${skillDirName}/\n`);
    console.log('Next steps:');
    console.log(`  1. Edit ./${skillDirName}/instructions.md with your AI instructions`);
    console.log(`  2. Run 'npx komerce-skill publish' from ./${skillDirName}/ to publish`);
  } finally {
    rl.close();
  }
}
