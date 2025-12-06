/**
 * Prompt command group for Enaible CLI.
 */

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { glob } from 'glob';
import { loadWorkspace } from '../runtime/context.js';
import { PromptRenderer, writeRenderResult, getRenderResultDiff } from '../prompts/renderer.js';
import { CATALOG } from '../prompts/catalog.js';
import { lintFiles } from '../prompts/lint.js';

const GENERATED_SENTINEL = '<!-- generated: enaible -->';

/**
 * Resolve prompt IDs from input.
 */
function resolvePromptIds(prompts: string[]): string[] {
  if (!prompts.length || prompts.includes('all')) {
    return Object.keys(CATALOG);
  }

  const catalogIds = new Set(Object.keys(CATALOG));
  const unknown = prompts.filter((p) => !catalogIds.has(p));
  if (unknown.length > 0) {
    const available = Array.from(catalogIds).sort().join(', ');
    throw new Error(`Unknown prompt(s): ${unknown.join(', ')}. Available: ${available}`);
  }
  return prompts;
}

/**
 * Resolve systems from input.
 */
function resolveSystems(promptIds: string[], systems: string[]): string[] {
  if (!systems.length || systems.includes('all')) {
    const supported = new Set<string>();
    for (const promptId of promptIds) {
      const definition = CATALOG[promptId];
      for (const system of Object.keys(definition.systems)) {
        supported.add(system);
      }
    }
    return Array.from(supported).sort();
  }
  return systems;
}

/**
 * Build output overrides map.
 */
function buildOverrides(
  selectedSystems: string[],
  out: string | null
): Record<string, string | null> {
  const overrides: Record<string, string | null> = {};
  if (!out) {
    for (const system of selectedSystems) {
      overrides[system] = null;
    }
    return overrides;
  }

  if (selectedSystems.length === 1) {
    overrides[selectedSystems[0]] = out;
    return overrides;
  }

  for (const system of selectedSystems) {
    overrides[system] = path.join(out, system);
  }
  return overrides;
}

/**
 * Split comma-separated values.
 */
function splitCsv(value: string): string[] {
  if (!value || value.toLowerCase() === 'all') {
    return ['all'];
  }
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s);
}

/**
 * Create prompts command.
 */
export function createPromptsCommand(): Command {
  const prompts = new Command('prompts').description('Render and validate managed prompts.');

  // List command
  prompts
    .command('list')
    .description('List prompts known to the catalog.')
    .action(() => {
      const context = loadWorkspace();
      const renderer = new PromptRenderer(context);
      for (const definition of renderer.listPrompts()) {
        const systems = Object.keys(definition.systems).sort().join(', ');
        console.log(`${definition.promptId}: ${definition.title} [${systems}]`);
      }
    });

  // Render command
  prompts
    .command('render')
    .description('Render prompts for the selected systems.')
    .option('--prompt <prompts>', "Comma-separated prompt identifiers or 'all'.", 'all')
    .option('--system <systems>', "Comma-separated system identifiers or 'all'.", 'all')
    .option('-o, --out <path>', 'Optional override directory for rendered output.')
    .action((options) => {
      const context = loadWorkspace();
      const renderer = new PromptRenderer(context);

      const promptArgs = splitCsv(options.prompt);
      const systemArgs = splitCsv(options.system);

      const selectedPrompts = resolvePromptIds(promptArgs);
      const selectedSystems = resolveSystems(selectedPrompts, systemArgs);
      const overrides = buildOverrides(selectedSystems, options.out ?? null);

      const results = renderer.render(selectedPrompts, selectedSystems, overrides);

      for (const result of results) {
        writeRenderResult(result);
        console.log(
          `Rendered ${chalk.cyan(result.promptId)} for ${chalk.yellow(result.system)} → ${result.outputPath}`
        );
      }
    });

  // Diff command
  prompts
    .command('diff')
    .description('Show diffs between catalog output and current files.')
    .option('--prompt <prompts>', "Comma-separated prompt identifiers or 'all'.", 'all')
    .option('--system <systems>', "Comma-separated system identifiers or 'all'.", 'all')
    .action((options) => {
      const context = loadWorkspace();
      const renderer = new PromptRenderer(context);

      const promptArgs = splitCsv(options.prompt);
      const systemArgs = splitCsv(options.system);

      const selectedPrompts = resolvePromptIds(promptArgs);
      const selectedSystems = resolveSystems(selectedPrompts, systemArgs);

      const results = renderer.render(selectedPrompts, selectedSystems);

      let hasDiff = false;
      for (const result of results) {
        const diffOutput = getRenderResultDiff(result);
        if (diffOutput) {
          hasDiff = true;
          console.log(diffOutput);
        }
      }

      if (hasDiff) {
        process.exit(1);
      }
    });

  // Validate command
  prompts
    .command('validate')
    .description('Validate that rendered prompts match committed files.')
    .option('--prompt <prompts>', "Comma-separated prompt identifiers or 'all'.", 'all')
    .option('--system <systems>', "Comma-separated system identifiers or 'all'.", 'all')
    .action((options) => {
      const context = loadWorkspace();
      const renderer = new PromptRenderer(context);

      const promptArgs = splitCsv(options.prompt);
      const systemArgs = splitCsv(options.system);

      const selectedPrompts = resolvePromptIds(promptArgs);
      const selectedSystems = resolveSystems(selectedPrompts, systemArgs);

      const results = renderer.render(selectedPrompts, selectedSystems);

      let hasDiff = false;
      for (const result of results) {
        const diffOutput = getRenderResultDiff(result);
        if (diffOutput) {
          hasDiff = true;
          console.log(diffOutput);
        }
      }

      if (hasDiff) {
        console.log(chalk.red('Prompt drift detected. Run `enaible prompts render` to update.'));
        process.exit(1);
      }
    });

  // Lint command
  prompts
    .command('lint')
    .description('Lint prompt sources for @TOKEN usage and variable mapping rules.')
    .option('--prompt <prompts>', "Comma-separated prompt identifiers or 'all'.", 'all')
    .action(async (options) => {
      const context = loadWorkspace();

      const selectedPrompts = resolvePromptIds(splitCsv(options.prompt));

      // Collect unique source files for selected prompts
      const files = new Set<string>();
      for (const promptId of selectedPrompts) {
        const definition = CATALOG[promptId];
        const sourcePath = path.resolve(context.repoRoot, definition.sourcePath);
        files.add(sourcePath);
      }

      // Also lint unmanaged, hand-authored system prompts
      const systemDirs = [
        path.join(context.repoRoot, 'systems', 'claude-code', 'commands'),
        path.join(context.repoRoot, 'systems', 'codex', 'prompts'),
        path.join(context.repoRoot, 'systems', 'copilot', 'prompts'),
        path.join(context.repoRoot, 'systems', 'cursor', 'rules'),
      ];

      for (const dir of systemDirs) {
        if (!fs.existsSync(dir)) continue;
        const mdFiles = await glob('*.md', { cwd: dir });
        for (const mdFile of mdFiles) {
          if (mdFile.toLowerCase() === 'agents.md') continue;
          const fullPath = path.join(dir, mdFile);
          try {
            const head = fs.readFileSync(fullPath, 'utf-8').split('\n').slice(0, 3);
            if (head.some((line) => line.includes(GENERATED_SENTINEL))) {
              continue;
            }
            files.add(fullPath);
          } catch {
            continue;
          }
        }
      }

      const issues = lintFiles(Array.from(files));
      if (!issues.length) {
        console.log(chalk.green('prompts: lint passed'));
        return;
      }

      for (const issue of issues) {
        console.log(`${issue.path}:${issue.line}: ${issue.message}`);
      }
      process.exit(1);
    });

  return prompts;
}
