#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { Orchestrator } from './core/Orchestrator';
import {
  installCommand,
  removeCommand,
  updateCommand,
  listCommand,
  searchCommand,
  infoCommand,
  reportCommand,
  loginCommand,
  publishCommand,
  initCommand,
} from './commands';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const workspaceRoot = process.cwd();
const orchestrator = new Orchestrator(workspaceRoot);
const context = orchestrator.getContext();

// ---------------------------------------------------------------------------
// CLI program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('komerce-skill')
  .description('AI Skills Registry — manage AI assistant skills across multiple IDEs')
  .version('1.0.0');

// ---------------------------------------------------------------------------
// install
// ---------------------------------------------------------------------------

program
  .command('install <namespaces...>')
  .description('Install one or more skills from the registry')
  .option('--ide <ide>', 'Force installation for a specific IDE (kiro, cursor, copilot, jetbrains, antigravity)')
  .action(async (namespaces: string[], options: { ide?: string }) => {
    await installCommand(namespaces, options, context);
  });

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

program
  .command('remove <namespace>')
  .alias('uninstall')
  .description('Remove an installed skill from the workspace')
  .action(async (namespace: string) => {
    await removeCommand(namespace, context);
  });

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

program
  .command('update [namespace]')
  .description('Update a skill to the latest version')
  .option('--all', 'Update all installed skills')
  .action(async (namespace: string | undefined, options: { all?: boolean }) => {
    await updateCommand(namespace, options, context);
  });

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

program
  .command('list')
  .description('List installed skills')
  .option('--category <category>', 'Filter by category (e.g. fe, be, testing)')
  .action(async (options: { category?: string }) => {
    await listCommand(options, context);
  });

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

program
  .command('search <query>')
  .description('Search for skills in the registry')
  .action(async (query: string) => {
    await searchCommand(query, context);
  });

// ---------------------------------------------------------------------------
// info
// ---------------------------------------------------------------------------

program
  .command('info <namespace>')
  .description('Show detailed information about a skill')
  .action(async (namespace: string) => {
    await infoCommand(namespace, context);
  });

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

program
  .command('report <namespace>')
  .description('Report a problematic skill')
  .action(async (namespace: string) => {
    await reportCommand(namespace, context);
  });

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

program
  .command('login')
  .description('Authenticate to the npm registry for publishing skills')
  .action(async () => {
    await loginCommand(context);
  });

// ---------------------------------------------------------------------------
// publish
// ---------------------------------------------------------------------------

program
  .command('publish [skillDir]')
  .description('Publish a skill to the npm registry')
  .action(async (skillDir: string | undefined) => {
    const resolvedDir = skillDir ? path.resolve(skillDir) : process.cwd();
    await publishCommand(resolvedDir, context);
  });

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

program
  .command('init')
  .description('Scaffold a new skill package interactively')
  .option('--template <namespace>', 'Use an existing skill as a template (e.g. fe/vue-2)')
  .action(async (options: { template?: string }) => {
    await initCommand(options, context);
  });

// ---------------------------------------------------------------------------
// Parse and run
// ---------------------------------------------------------------------------

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
