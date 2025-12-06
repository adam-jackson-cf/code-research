/**
 * System installer command for Enaible CLI.
 */

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { loadWorkspace, WorkspaceContext } from '../runtime/context.js';
import { MANAGED_SENTINEL } from '../constants.js';
import { SYSTEM_CONTEXTS } from '../prompts/adapters.js';
import { PromptRenderer, writeRenderResult } from '../prompts/renderer.js';
import { SystemRenderContext } from '../prompts/types.js';

const SKIP_FILES = new Set([
  'install.sh',
  'install.ps1',
  'uninstall.sh',
  '.DS_Store',
]);

const SYSTEM_RULES: Record<string, [string, string]> = {
  'claude-code': ['rules/global.claude.rules.md', 'CLAUDE.md'],
  codex: ['rules/global.codex.rules.md', 'AGENTS.md'],
  copilot: ['rules/global.copilot.rules.md', 'AGENTS.md'],
  cursor: ['rules/global.cursor.rules.md', 'user-rules-setting.md'],
  gemini: ['rules/global.gemini.rules.md', 'GEMINI.md'],
  antigravity: ['rules/global.antigravity.rules.md', 'GEMINI.md'],
};

const ALWAYS_MANAGED_PREFIXES: Record<string, string[]> = {
  'claude-code': ['commands/', 'agents/', 'rules/'],
  codex: ['prompts/', 'rules/'],
  copilot: ['prompts/'],
  cursor: ['commands/', 'rules/'],
  gemini: ['commands/'],
  antigravity: ['workflows/', 'rules/'],
};

enum InstallMode {
  MERGE = 'merge',
  UPDATE = 'update',
  SYNC = 'sync',
  FRESH = 'fresh',
}

interface InstallSummary {
  actions: Array<[string, string]>;
  skipped: string[];
}

function createSummary(): InstallSummary {
  return { actions: [], skipped: [] };
}

function recordAction(summary: InstallSummary, action: string, filePath: string): void {
  summary.actions.push([action, filePath]);
}

function recordSkip(summary: InstallSummary, filePath: string): void {
  summary.skipped.push(filePath);
}

/**
 * Check if a file contains the managed sentinel.
 */
function hasManagedSentinel(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.includes(MANAGED_SENTINEL);
  } catch {
    return false;
  }
}

/**
 * Get system render context.
 */
function getSystemContext(system: string): SystemRenderContext {
  const ctx = SYSTEM_CONTEXTS[system];
  if (!ctx) {
    const available = Object.keys(SYSTEM_CONTEXTS).sort().join(', ');
    throw new Error(`Unknown system '${system}'. Available adapters: ${available}.`);
  }
  return ctx;
}

/**
 * Resolve destination directory.
 */
function resolveDestination(
  systemCtx: SystemRenderContext,
  target: string,
  scope: string
): string {
  if (scope.toLowerCase() === 'user') {
    return systemCtx.userScopeDir.replace(/^~/, os.homedir());
  }
  if (scope.toLowerCase() !== 'project') {
    throw new Error("Scope must be either 'project' or 'user'.");
  }
  return path.resolve(target, systemCtx.projectScopeDir);
}

/**
 * Iterate source files.
 */
function* iterSourceFiles(root: string): Generator<string> {
  function* walk(dir: string): Generator<string> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        yield* walk(fullPath);
      } else if (entry.isFile()) {
        if (!SKIP_FILES.has(entry.name)) {
          yield fullPath;
        }
      }
    }
  }
  yield* walk(root);
}

/**
 * Should skip file based on mode.
 */
function shouldSkipFile(
  sourceFile: string,
  destinationFile: string,
  relativePosix: string,
  system: string,
  mode: InstallMode,
  alwaysManagedPrefixes: string[]
): boolean {
  // Skip rules directory for copilot/cursor
  if (['copilot', 'cursor'].includes(system) && relativePosix.startsWith('rules/')) {
    return true;
  }

  const managed =
    hasManagedSentinel(sourceFile) ||
    alwaysManagedPrefixes.some((prefix) => relativePosix.startsWith(prefix));
  const destExists = fs.existsSync(destinationFile);
  let destManaged = destExists ? hasManagedSentinel(destinationFile) : managed;
  if (alwaysManagedPrefixes.some((prefix) => relativePosix.startsWith(prefix))) {
    destManaged = true;
  }

  if (mode === InstallMode.UPDATE && (!destExists || !destManaged)) {
    return true;
  }

  return (
    [InstallMode.MERGE, InstallMode.SYNC].includes(mode) && destExists && !destManaged
  );
}

/**
 * Copy file with directories.
 */
function copyFile(source: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
}

/**
 * Copy directory recursively.
 */
function copyDir(source: string, dest: string, ignore?: (name: string) => boolean): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    if (ignore && ignore(entry.name)) continue;
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, ignore);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Get next stash path.
 */
function nextStashPath(filePath: string, suffix: string): string {
  const baseName = path.basename(filePath);
  const dir = path.dirname(filePath);
  let candidate = path.join(dir, `${baseName}${suffix}`);
  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '')
    .slice(0, 14);
  candidate = path.join(dir, `${baseName}${suffix}-${timestamp}`);
  if (!fs.existsSync(candidate)) {
    return candidate;
  }

  let counter = 1;
  while (true) {
    candidate = path.join(dir, `${baseName}${suffix}-${timestamp}-${counter}`);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
    counter++;
  }
}

/**
 * Get enaible version.
 */
function getEnaibleVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? 'local';
  } catch {
    return 'local';
  }
}

/**
 * Create install command.
 */
export function createInstallCommand(): Command {
  const install = new Command('install')
    .description('Install rendered system assets into project or user configuration directories.')
    .argument('<system>', 'System adapter to install (claude-code|codex|copilot|cursor|gemini|antigravity).')
    .option('--install-cli', 'Install the Enaible CLI with npm before copying assets.', true)
    .option('--no-install-cli', 'Skip CLI installation.')
    .option('--cli-source <path>', 'Path to CLI source.', 'tools/enaible-ts')
    .option('-t, --target <path>', 'Destination root for installation.', '.')
    .option('-m, --mode <mode>', 'Installation mode (merge|update|sync|fresh).', 'merge')
    .option('-s, --scope <scope>', 'Installation scope (project|user).', 'project')
    .option('--dry-run', 'Preview actions without writing files.', false)
    .option('--backup', 'Create timestamped backup of target folder before install.', true)
    .option('--no-backup', 'Skip backup.')
    .option('--sync', 'Run npm install to provision dependencies.', true)
    .option('--no-sync', 'Skip dependency sync.')
    .option('--sync-shared', 'Copy shared/ workspace files to ~/.enaible/workspace/shared.', true)
    .option('--no-sync-shared', 'Skip shared workspace sync.')
    .action((system: string, options) => {
      const context = loadWorkspace();
      const summary = createSummary();

      const mode = options.mode.toLowerCase() as InstallMode;
      if (!Object.values(InstallMode).includes(mode)) {
        console.error(chalk.red(`Invalid mode: ${options.mode}`));
        process.exit(1);
      }

      // Setup installation context
      const systemCtx = getSystemContext(system);
      const sourceRoot = path.join(context.repoRoot, 'systems', system);
      if (!fs.existsSync(sourceRoot)) {
        console.error(chalk.red(`Source assets missing for system '${system}'.`));
        process.exit(1);
      }
      const destinationRoot = resolveDestination(systemCtx, options.target, options.scope);

      // Prepare installation environment
      if (options.syncShared) {
        syncSharedWorkspace(context.repoRoot, options.dryRun, summary);
      }

      if (options.backup && fs.existsSync(destinationRoot)) {
        backupDestinationFolder(destinationRoot, options.dryRun, summary);
      }

      if (mode === InstallMode.FRESH) {
        clearDestinationForFreshInstall(system, destinationRoot, options.dryRun, summary);
      }

      // Process source files
      const alwaysManagedPrefixes = ALWAYS_MANAGED_PREFIXES[system] ?? [];
      for (const sourceFile of iterSourceFiles(sourceRoot)) {
        const relative = path.relative(sourceRoot, sourceFile);
        const relativePosix = relative.split(path.sep).join('/');
        const destinationFile = path.join(destinationRoot, relative);

        if (
          shouldSkipFile(
            sourceFile,
            destinationFile,
            relativePosix,
            system,
            mode,
            alwaysManagedPrefixes
          )
        ) {
          recordSkip(summary, relative);
          continue;
        }

        if (options.dryRun) {
          recordAction(summary, 'write', destinationFile);
          continue;
        }

        copyFile(sourceFile, destinationFile);
        recordAction(summary, 'write', destinationFile);
      }

      // Complete installation
      renderManagedPrompts(context, system, destinationRoot, mode, options.dryRun, summary);
      postInstall(system, sourceRoot, destinationRoot, options.dryRun, summary);
      emitSummary(system, destinationRoot, mode, summary, options.dryRun);
    });

  return install;
}

/**
 * Sync shared workspace.
 */
function syncSharedWorkspace(
  repoRoot: string,
  dryRun: boolean,
  summary: InstallSummary
): void {
  const source = path.join(repoRoot, 'shared');
  const target = path.join(os.homedir(), '.enaible', 'workspace', 'shared');
  const allowedPaths = [
    'core',
    'analyzers',
    'config',
    'utils',
    'tools/ai_docs_changelog.py',
    'setup/install_dependencies.py',
    'setup/requirements.txt',
    'setup/monitoring',
    'setup/security',
  ];

  if (!fs.existsSync(source)) {
    throw new Error(`Shared folder missing at ${source}; cannot sync workspace.`);
  }

  const summaryPath = fs.existsSync(target) ? target : path.dirname(target);

  if (dryRun) {
    recordAction(summary, 'sync-shared', summaryPath);
    return;
  }

  // Reset existing workspace copy
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true });
  }
  fs.mkdirSync(target, { recursive: true });

  const ignore = (name: string): boolean => {
    return ['__pycache__', '.pytest_cache', '.DS_Store'].includes(name) ||
      name.endsWith('.pyc') ||
      name.endsWith('.pyo');
  };

  for (const relPath of allowedPaths) {
    const src = path.join(source, relPath);
    const dest = path.join(target, relPath);
    if (!fs.existsSync(src)) continue;

    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copyDir(src, dest, ignore);
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }

  recordAction(summary, 'sync-shared', target);
}

/**
 * Backup destination folder.
 */
function backupDestinationFolder(
  destinationRoot: string,
  dryRun: boolean,
  summary: InstallSummary
): void {
  const backupPath = nextStashPath(destinationRoot, '.bak');
  if (dryRun) {
    recordAction(summary, 'backup', backupPath);
    return;
  }

  const stat = fs.statSync(destinationRoot);
  if (stat.isDirectory()) {
    copyDir(destinationRoot, backupPath);
  } else {
    fs.copyFileSync(destinationRoot, backupPath);
  }
  recordAction(summary, 'backup', backupPath);
}

/**
 * Clear destination for fresh install.
 */
function clearDestinationForFreshInstall(
  system: string,
  destinationRoot: string,
  dryRun: boolean,
  summary: InstallSummary
): void {
  if (!fs.existsSync(destinationRoot)) return;

  // Codex preserves unmanaged files
  if (system === 'codex') return;

  if (dryRun) {
    recordAction(summary, 'remove', destinationRoot);
    return;
  }

  const tempPath = nextStashPath(destinationRoot, '.tmp');
  fs.renameSync(destinationRoot, tempPath);
  fs.rmSync(tempPath, { recursive: true });
  recordAction(summary, 'remove', destinationRoot);
}

/**
 * Render managed prompts.
 */
function renderManagedPrompts(
  context: WorkspaceContext,
  system: string,
  destinationRoot: string,
  mode: InstallMode,
  dryRun: boolean,
  summary: InstallSummary
): void {
  const renderer = new PromptRenderer(context);
  const definitions = renderer
    .listPrompts()
    .filter((def) => system in def.systems)
    .map((def) => def.promptId);

  if (!definitions.length) return;

  const overrides: Record<string, string> = { [system]: destinationRoot };
  const results = renderer.render(definitions, [system], overrides);

  if (!dryRun) {
    fs.mkdirSync(destinationRoot, { recursive: true });
  }

  for (const result of results) {
    let relative: string;
    try {
      relative = path.relative(destinationRoot, result.outputPath);
    } catch {
      relative = result.outputPath;
    }

    if (dryRun) {
      recordAction(summary, 'render', result.outputPath);
      continue;
    }

    const destExists = fs.existsSync(result.outputPath);
    const destManaged = destExists ? hasManagedSentinel(result.outputPath) : false;

    if (mode === InstallMode.UPDATE && (!destExists || !destManaged)) {
      recordSkip(summary, relative);
      continue;
    }

    if (
      [InstallMode.MERGE, InstallMode.SYNC].includes(mode) &&
      destExists &&
      !destManaged
    ) {
      recordSkip(summary, relative);
      continue;
    }

    writeRenderResult(result);
    recordAction(summary, 'render', result.outputPath);
  }
}

/**
 * Post-install actions.
 */
function postInstall(
  system: string,
  sourceRoot: string,
  destinationRoot: string,
  dryRun: boolean,
  summary: InstallSummary
): void {
  const rulesInfo = SYSTEM_RULES[system];
  if (!rulesInfo) return;

  const [sourceRulesRel, targetName] = rulesInfo;
  const sourceRules = path.join(sourceRoot, sourceRulesRel);
  if (!fs.existsSync(sourceRules)) return;

  // For claude-code, CLAUDE.md goes in project root (parent of .claude/)
  // For antigravity, GEMINI.md goes in ~/.gemini/ (parent of ~/.gemini/antigravity/)
  let targetPath: string;
  if (['claude-code', 'antigravity'].includes(system)) {
    targetPath = path.join(path.dirname(destinationRoot), targetName);
  } else {
    targetPath = path.join(destinationRoot, targetName);
  }

  if (dryRun) {
    recordAction(summary, 'merge', targetPath);
    return;
  }

  if (system === 'codex') {
    mergeCodexAgents(targetPath, sourceRules);
    recordAction(summary, 'merge', targetPath);
    return;
  }

  if (system === 'copilot') {
    mergeCopilotAgents(targetPath, sourceRules);
    recordAction(summary, 'merge', targetPath);
    return;
  }

  if (system === 'cursor') {
    createCursorUserRules(targetPath, sourceRules);
    recordAction(summary, 'write', targetPath);
    console.log(
      chalk.yellow(
        `\n>>> Cursor requires manual configuration:\n` +
          `    Copy the contents of ${targetPath}\n` +
          `    into Cursor > Settings > Rules > User Rules\n`
      )
    );
    return;
  }

  const header = `# AI-Assisted Workflows v${getEnaibleVersion()} - Auto-generated, do not edit`;
  const rulesBody = fs.readFileSync(sourceRules, 'utf-8').trim();

  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, 'utf-8');
    if (existing.includes('# AI-Assisted Workflows v')) {
      recordAction(summary, 'merged', targetPath);
      return;
    }
    const updated = `${existing.trimEnd()}\n\n---\n\n${header}\n\n${rulesBody}\n`;
    fs.writeFileSync(targetPath, updated, 'utf-8');
  } else {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, `${header}\n\n${rulesBody}\n`, 'utf-8');
  }
  recordAction(summary, 'merge', targetPath);
}

/**
 * Merge Codex agents.
 */
function mergeCodexAgents(targetPath: string, sourceRules: string): void {
  const startMarker = '<!-- CODEx_GLOBAL_RULES_START -->';
  const endMarker = '<!-- CODEx_GLOBAL_RULES_END -->';
  const header = `# AI-Assisted Workflows (Codex Global Rules) v${getEnaibleVersion()} - Auto-generated, do not edit`;
  const body = fs.readFileSync(sourceRules, 'utf-8').trim();
  const block = `${startMarker}\n${header}\n\n${body}\n${endMarker}\n`;

  const existing = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, 'utf-8')
    : '';

  let updated: string;
  if (existing.includes(startMarker) && existing.includes(endMarker)) {
    const start = existing.indexOf(startMarker);
    const end = existing.indexOf(endMarker) + endMarker.length;
    updated = existing.slice(0, start) + block + existing.slice(end);
  } else {
    updated = (existing.trim() ? existing.trimEnd() + '\n\n' : '') + block;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, updated.trimEnd() + '\n', 'utf-8');
}

/**
 * Merge Copilot agents.
 */
function mergeCopilotAgents(targetPath: string, sourceRules: string): void {
  const startMarker = '<!-- COPILOT_GLOBAL_RULES_START -->';
  const endMarker = '<!-- COPILOT_GLOBAL_RULES_END -->';
  const header = `# AI-Assisted Workflows (Copilot Global Rules) v${getEnaibleVersion()} - Auto-generated, do not edit`;
  const body = fs.readFileSync(sourceRules, 'utf-8').trim();
  const block = `${startMarker}\n${header}\n\n${body}\n${endMarker}\n`;

  const existing = fs.existsSync(targetPath)
    ? fs.readFileSync(targetPath, 'utf-8')
    : '';

  let updated: string;
  if (existing.includes(startMarker) && existing.includes(endMarker)) {
    const start = existing.indexOf(startMarker);
    const end = existing.indexOf(endMarker) + endMarker.length;
    updated = existing.slice(0, start) + block + existing.slice(end);
  } else {
    updated = (existing.trim() ? existing.trimEnd() + '\n\n' : '') + block;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, updated.trimEnd() + '\n', 'utf-8');
}

/**
 * Create Cursor user rules.
 */
function createCursorUserRules(targetPath: string, sourceRules: string): void {
  const header = `# Cursor User Rules v${getEnaibleVersion()} - Copy to Cursor > Settings > Rules > User`;
  const instruction = 'Copy the contents below into Cursor > Settings > Rules > User Rules.';
  const body = fs.readFileSync(sourceRules, 'utf-8').trim();

  const content = `${header}\n\n${instruction}\n\n---\n\n${body}\n`;

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf-8');
}

/**
 * Emit installation summary.
 */
function emitSummary(
  system: string,
  destinationRoot: string,
  mode: InstallMode,
  summary: InstallSummary,
  dryRun: boolean
): void {
  const actionLabel = dryRun ? 'Planned' : 'Completed';
  console.log(
    chalk.green(`${actionLabel} Enaible install for ${system} (${mode}) → ${destinationRoot}`)
  );

  if (summary.actions.length > 0) {
    for (const [action, relPath] of summary.actions) {
      console.log(`  ${action.padEnd(8)} ${relPath}`);
    }
  } else {
    console.log('  No changes required.');
  }

  if (summary.skipped.length > 0) {
    console.log('  Skipped (unmanaged or missing targets):');
    for (const relPath of summary.skipped) {
      console.log(`    - ${relPath}`);
    }
  }
}
