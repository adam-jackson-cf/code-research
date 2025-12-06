#!/usr/bin/env node
/**
 * Enaible CLI entry point.
 */

import { Command } from 'commander';
import { createPromptsCommand } from './commands/prompts.js';
import { createInstallCommand } from './commands/install.js';
import { createVersionCommand, createDoctorCommand } from './commands/root.js';

const program = new Command();

program
  .name('enaible')
  .description('Unified CLI for AI-Assisted Workflows.')
  .version('0.1.1');

// Add commands
program.addCommand(createPromptsCommand());
program.addCommand(createInstallCommand());
program.addCommand(createVersionCommand());
program.addCommand(createDoctorCommand());

program.parse(process.argv);
