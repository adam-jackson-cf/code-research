#!/usr/bin/env node
/**
 * CLI Interface for smoke-test-oracle
 *
 * Command-line tool for running smoke tests, querying data,
 * generating reports, and managing storage.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import fs from 'fs-extra';
import path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Import core modules
import { SmokeTest } from './api/test-builder.js';
import { TestOrchestrator } from './core/orchestrator.js';
import { StorageManager } from './storage/index.js';
import { QueryApi } from './api/query-api.js';
import { ReportGenerator } from './output/report-generator.js';
import { TestResultFormatter } from './output/formatter.js';
import { ChromeDevToolsWrapper } from './chrome/devtools-wrapper.js';
import type { TestResult, TestDefinition } from './core/types.js';

// Load environment variables
dotenvConfig();

/**
 * CLI Configuration
 */
interface CLIConfig {
  storageDir: string;
  mcpServerCommand: string;
  mcpServerArgs: string[];
  verbose: boolean;
  format: 'json' | 'html' | 'text';
}

/**
 * Load configuration from .env and config files
 */
async function loadConfig(options: any): Promise<CLIConfig> {
  const config: CLIConfig = {
    storageDir: process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'),
    mcpServerCommand: process.env.MCP_SERVER_COMMAND || 'npx',
    mcpServerArgs: process.env.MCP_SERVER_ARGS
      ? process.env.MCP_SERVER_ARGS.split(' ')
      : ['-y', '@modelcontextprotocol/server-chrome-devtools'],
    verbose: options.verbose || false,
    format: options.format || 'text',
  };

  // Try to load from config file if exists
  const configPath = path.join(process.cwd(), 'smoke-test.config.json');
  if (await fs.pathExists(configPath)) {
    try {
      const fileConfig = await fs.readJson(configPath);
      Object.assign(config, fileConfig);
    } catch (error) {
      if (config.verbose) {
        console.warn(chalk.yellow('Warning: Failed to load config file'));
      }
    }
  }

  return config;
}

/**
 * Format file size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Print test result summary
 */
function printTestResult(result: TestResult, verbose: boolean) {
  console.log('\n' + chalk.bold('Test Result Summary'));
  console.log(chalk.gray('─'.repeat(50)));

  const statusColor = result.status === 'passed' ? chalk.green : chalk.red;
  console.log(`Status: ${statusColor(result.status.toUpperCase())}`);
  console.log(`Duration: ${chalk.cyan(formatDuration(result.duration))}`);
  console.log(`Checkpoints: ${chalk.cyan(result.checkpoints.length)}`);

  if (result.error) {
    console.log('\n' + chalk.red.bold('Error:'));
    console.log(chalk.red(result.error.message));
    if (verbose && result.error.stack) {
      console.log(chalk.gray(result.error.stack));
    }
  }

  if (result.checkpoints.length > 0) {
    console.log('\n' + chalk.bold('Checkpoints:'));
    const table = new Table({
      head: [
        chalk.cyan('Name'),
        chalk.cyan('Status'),
        chalk.cyan('Duration'),
        chalk.cyan('Validations'),
      ],
      style: { head: [], border: [] },
    });

    for (const checkpoint of result.checkpoints) {
      const statusIcon =
        checkpoint.status === 'passed'
          ? chalk.green('✓')
          : checkpoint.status === 'failed'
          ? chalk.red('✗')
          : chalk.yellow('⊘');

      const validationCount = checkpoint.validations?.length || 0;
      const passedValidations =
        checkpoint.validations?.filter((v) => v.passed).length || 0;

      table.push([
        checkpoint.checkpointId,
        statusIcon + ' ' + checkpoint.status,
        formatDuration(checkpoint.duration),
        `${passedValidations}/${validationCount}`,
      ]);
    }

    console.log(table.toString());
  }
}

/**
 * Run command - Execute a test file
 */
async function runCommand(testFile: string, options: any) {
  const spinner = ora('Loading configuration').start();
  let config: CLIConfig | undefined;
  let client: Client | undefined;
  let transport: StdioClientTransport | undefined;

  try {
    config = await loadConfig(options);
    spinner.text = 'Loading test file';

    // Check if test file exists
    if (!(await fs.pathExists(testFile))) {
      spinner.fail(chalk.red(`Test file not found: ${testFile}`));
      process.exit(1);
    }

    // Load test file
    spinner.text = 'Importing test';
    const testModule = await import(path.resolve(testFile));
    const test: SmokeTest | TestDefinition = testModule.default || testModule.test;

    if (!test) {
      spinner.fail(chalk.red('No default export or test export found in test file'));
      process.exit(1);
    }

    // Initialize storage
    spinner.text = 'Initializing storage';
    const storage = new StorageManager({
      baseDir: config.storageDir,
    });
    await storage.initialize();

    // Initialize MCP client
    spinner.text = 'Connecting to Chrome DevTools MCP server';
    transport = new StdioClientTransport({
      command: config.mcpServerCommand,
      args: config.mcpServerArgs,
    });

    client = new Client(
      {
        name: 'smoke-test-oracle-cli',
        version: '0.1.0',
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);

    // Create Chrome wrapper
    const chrome = new ChromeDevToolsWrapper(client);

    // Run test
    spinner.text = 'Running test';
    const startTime = Date.now();

    let result: TestResult;

    if (test instanceof SmokeTest) {
      // For SmokeTest, use the run method
      result = await test.run({
        chrome,
        storage,
      });
    } else {
      // For TestDefinition, use orchestrator
      const orchestrator = new TestOrchestrator({
        chrome,
        storage,
      });

      try {
        result = await orchestrator.execute(test);
      } finally {
        await orchestrator.cleanup();
      }
    }

    const duration = Date.now() - startTime;
    spinner.succeed(
      chalk.green(`Test completed in ${formatDuration(duration)}`)
    );

    // Print results
    printTestResult(result, config.verbose);

    // Output formatted results
    if (options.output) {
      spinner.start('Generating output file');

      const output = TestResultFormatter.format(result, config.format, {
        verbose: config.verbose,
        color: false,
      });

      await fs.writeFile(options.output, output);
      spinner.succeed(chalk.green(`Output saved to ${options.output}`));
    }

    // Cleanup
    await client.close();

    // Exit with appropriate code
    process.exit(result.status === 'passed' ? 0 : 1);
  } catch (error) {
    spinner.fail(
      chalk.red(
        `Test failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    if (config?.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }

    // Cleanup on error
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    process.exit(1);
  }
}

/**
 * Query command - Query stored test data
 */
async function queryCommand(options: any) {
  const spinner = ora('Loading configuration').start();

  try {
    const config = await loadConfig(options);

    spinner.text = 'Initializing storage';
    const storage = new StorageManager({
      baseDir: config.storageDir,
    });
    await storage.initialize();

    const queryApi = new QueryApi({ storage });

    spinner.text = 'Querying data';

    let results;
    if (options.checkpoints) {
      results = await queryApi.checkpoints();
    } else if (options.screenshots) {
      results = await queryApi.screenshots();
    } else if (options.doms) {
      results = await queryApi.doms();
    } else if (options.console) {
      results = await queryApi.consoleLogs();
    } else if (options.testId) {
      results = await queryApi.byTestId(options.testId);
    } else if (options.tags) {
      const tags = options.tags.split(',');
      results = await queryApi.byTags(tags);
    } else {
      // Show stats by default
      const stats = await queryApi.getStats();
      spinner.succeed(chalk.green('Storage statistics'));

      const table = new Table({
        head: [chalk.cyan('Type'), chalk.cyan('Count'), chalk.cyan('Size')],
        style: { head: [], border: [] },
      });

      table.push(
        ['Checkpoints', stats.checkpoints, ''],
        ['Screenshots', stats.screenshots, ''],
        ['DOM Snapshots', stats.doms, ''],
        ['Console Logs', stats.consoleLogs, ''],
        ['', '', ''],
        [chalk.bold('Total'), '', chalk.bold(formatBytes(stats.totalSize))],
        ['Last Modified', new Date(stats.lastModified).toLocaleString(), '']
      );

      console.log('\n' + table.toString());
      return;
    }

    spinner.succeed(chalk.green(`Found ${results.total} results`));

    if (config.format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else {
      const table = new Table({
        head: [
          chalk.cyan('Timestamp'),
          chalk.cyan('Count'),
        ],
        style: { head: [], border: [] },
      });

      for (const ref of results.refs.slice(0, options.limit || 10)) {
        table.push([
          new Date(ref.timestamp).toLocaleString(),
          '1',
        ]);
      }

      console.log('\n' + table.toString());

      if (results.total > (options.limit || 10)) {
        console.log(
          chalk.gray(`\n... and ${results.total - (options.limit || 10)} more`)
        );
      }
    }
  } catch (error) {
    spinner.fail(
      chalk.red(
        `Query failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Report command - Generate report for a test
 */
async function reportCommand(testId: string, options: any) {
  const spinner = ora('Loading configuration').start();
  let config: CLIConfig | undefined;

  try {
    config = await loadConfig(options);

    spinner.text = 'Initializing storage';
    const storage = new StorageManager({
      baseDir: config.storageDir,
    });
    await storage.initialize();

    const queryApi = new QueryApi({ storage });

    spinner.text = 'Loading test data';
    const results = await queryApi.byTestId(testId);

    if (results.total === 0) {
      spinner.fail(chalk.red(`No data found for test ID: ${testId}`));
      process.exit(1);
    }

    spinner.text = 'Generating report';
    const reportGenerator = new ReportGenerator(storage as any);

    // Create a mock test result for report generation
    const testResult: TestResult = {
      testId,
      runId: testId,
      status: 'passed',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0,
      checkpoints: [],
      artifacts: results.refs,
    };

    const reportPath = await reportGenerator.generateTestReport(testResult, {
      outputDir: options.output || path.join(process.cwd(), 'reports'),
      format: config.format as any,
    });

    spinner.succeed(chalk.green(`Report generated: ${reportPath}`));
  } catch (error) {
    spinner.fail(
      chalk.red(
        `Report generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
    if (config?.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Clean command - Clean up old storage data
 */
async function cleanCommand(options: any) {
  const spinner = ora('Loading configuration').start();

  try {
    const config = await loadConfig(options);

    spinner.text = 'Initializing storage';
    const storage = new StorageManager({
      baseDir: config.storageDir,
    });
    await storage.initialize();

    const queryApi = new QueryApi({ storage });

    spinner.text = 'Cleaning up storage';

    const cleanupOptions: any = {};

    if (options.olderThan) {
      const days = parseInt(options.olderThan);
      cleanupOptions.olderThan = Date.now() - days * 24 * 60 * 60 * 1000;
    }

    if (options.keepLast) {
      cleanupOptions.keepLast = parseInt(options.keepLast);
    }

    if (options.types) {
      cleanupOptions.categories = options.types.split(',');
    }

    const result = await queryApi.cleanup(cleanupOptions);

    spinner.succeed(
      chalk.green(
        `Cleaned up ${result.deleted} items, freed ${formatBytes(result.freedSpace)}`
      )
    );
  } catch (error) {
    spinner.fail(
      chalk.red(
        `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    if (options.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Init command - Initialize configuration
 */
async function initCommand(options: any) {
  const spinner = ora('Initializing smoke-test-oracle').start();

  try {
    const storageDir = options.storage || path.join(process.cwd(), 'storage');
    const configPath = path.join(process.cwd(), 'smoke-test.config.json');

    // Create storage directory
    spinner.text = 'Creating storage directory';
    await fs.ensureDir(storageDir);

    // Create config file
    spinner.text = 'Creating configuration file';
    const mcpCommand = options.mcpCommand || 'npx';
    const mcpArgs = options.mcpArgs || ['-y', '@modelcontextprotocol/server-chrome-devtools'];

    const config = {
      storageDir,
      mcpServerCommand: mcpCommand,
      mcpServerArgs: mcpArgs,
      verbose: false,
      format: 'text',
    };

    await fs.writeJson(configPath, config, { spaces: 2 });

    // Create .env file if it doesn't exist
    const envPath = path.join(process.cwd(), '.env');
    if (!(await fs.pathExists(envPath))) {
      spinner.text = 'Creating .env file';
      const envContent = `# Smoke Test Oracle Configuration
STORAGE_DIR=${storageDir}
MCP_SERVER_COMMAND=${config.mcpServerCommand}
MCP_SERVER_ARGS=${config.mcpServerArgs.join(' ')}
`;
      await fs.writeFile(envPath, envContent);
    }

    // Create example test file
    if (options.example) {
      spinner.text = 'Creating example test file';
      const exampleTest = `import { TestBuilder } from 'smoke-test-oracle';

// Create a simple smoke test
const test = TestBuilder.create('Example Test')
  .description('A simple example test')
  .tags('example', 'smoke')
  .navigate('https://example.com')
  .wait(1000)
  .checkpoint('homepage', {
    description: 'Homepage loaded',
    capture: {
      screenshot: true,
      html: true,
      console: true,
    },
    validations: {
      dom: {
        exists: ['h1', 'p'],
        textContent: [
          { selector: 'h1', text: 'Example Domain', match: 'exact' },
        ],
      },
      console: {
        maxErrors: 0,
      },
    },
  });

export default test;
`;
      await fs.writeFile(
        path.join(process.cwd(), 'example.test.ts'),
        exampleTest
      );
    }

    spinner.succeed(chalk.green('Initialization complete!'));

    console.log('\n' + chalk.bold('Configuration created:'));
    console.log(`  Config: ${chalk.cyan(configPath)}`);
    console.log(`  Storage: ${chalk.cyan(storageDir)}`);
    if (options.example) {
      console.log(
        `  Example test: ${chalk.cyan(path.join(process.cwd(), 'example.test.ts'))}`
      );
    }

    console.log('\n' + chalk.bold('Next steps:'));
    console.log('  1. Update .env with your MCP server command if needed');
    console.log('  2. Create a test file (or use example.test.ts)');
    console.log('  3. Run: smoke-test run example.test.ts');
  } catch (error) {
    spinner.fail(
      chalk.red(
        `Initialization failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
    process.exit(1);
  }
}

/**
 * Main CLI program
 */
async function main() {
  const program = new Command();

  program
    .name('smoke-test')
    .description('Composable smoke testing tool using Chrome DevTools MCP')
    .version('0.1.0');

  // Global options
  program.option('-v, --verbose', 'Enable verbose output', false);
  program.option(
    '-f, --format <format>',
    'Output format (json, html, text)',
    'text'
  );

  // Run command
  program
    .command('run <test-file>')
    .description('Run a smoke test file')
    .option('-o, --output <file>', 'Output file for test results')
    .action(runCommand);

  // Query command
  program
    .command('query')
    .description('Query stored test data')
    .option('--checkpoints', 'Query checkpoints')
    .option('--screenshots', 'Query screenshots')
    .option('--doms', 'Query DOM snapshots')
    .option('--console', 'Query console logs')
    .option('--test-id <id>', 'Query by test ID')
    .option('--tags <tags>', 'Query by tags (comma-separated)')
    .option('-l, --limit <n>', 'Limit number of results', '10')
    .action(queryCommand);

  // Report command
  program
    .command('report <test-id>')
    .description('Generate report for a test')
    .option('-o, --output <dir>', 'Output directory for report')
    .option('--include-dom', 'Include DOM snapshots in report')
    .action(reportCommand);

  // Clean command
  program
    .command('clean')
    .description('Clean up old storage data')
    .option('--older-than <days>', 'Delete items older than N days')
    .option('--keep-last <n>', 'Keep last N items')
    .option(
      '--types <types>',
      'Types to clean (comma-separated: checkpoint,screenshot,dom,console)'
    )
    .action(cleanCommand);

  // Init command
  program
    .command('init')
    .description('Initialize configuration')
    .option('-s, --storage <dir>', 'Storage directory path')
    .option('-e, --example', 'Create example test file')
    .action(initCommand);

  await program.parseAsync(process.argv);
}

// Run CLI
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
