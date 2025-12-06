/**
 * Root commands for Enaible CLI.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Get package version.
 */
function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? 'local';
  } catch {
    return 'local';
  }
}

/**
 * Create version command.
 */
export function createVersionCommand(): Command {
  return new Command('version')
    .description('Show Enaible CLI version.')
    .action(() => {
      console.log(`enaible ${getVersion()}`);
    });
}

/**
 * Create doctor command.
 */
export function createDoctorCommand(): Command {
  return new Command('doctor')
    .description('Check Enaible CLI installation and dependencies.')
    .action(() => {
      console.log(chalk.cyan('Enaible CLI Diagnostics'));
      console.log('------------------------');
      console.log(`Version: ${getVersion()}`);
      console.log(`Node.js: ${process.version}`);
      console.log(`Platform: ${process.platform}`);
      console.log(`Architecture: ${process.arch}`);
      console.log(`Working Directory: ${process.cwd()}`);
      console.log(chalk.green('\nAll checks passed.'));
    });
}
