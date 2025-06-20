#!/usr/bin/env node

'use strict';

console.log('Testing commander with file processing...');
console.log('Node.js version:', process.version);

const { program } = require('commander');
const { processFiles } = require('../src/processor');
const path = require('path');

console.log('Dependencies loaded successfully');

// Set up the program
program
  .name('code-commenter')
  .description('A CLI tool that adds helpful comments to JavaScript code')
  .version('1.0.0')
  .argument('<files...>', 'Files to process')
  .option('-o, --output <path>', 'output directory (default: overwrite original files)')
  .option('-d, --debug', 'Enable debug output')
  .option('--no-todo', 'skip adding TODO comments for missing documentation')
  .option('--dry-run', 'perform a dry run without writing files')
  .action(async (files, options) => {
    if (!files || files.length === 0) {
      console.error('Error: No files specified');
      process.exit(1);
    }
    if (options.debug) process.env.DEBUG = '1';
    // Normalize file paths to absolute paths
    const normalizedFiles = files.map(f => path.resolve(process.cwd(), f));
    try {
      const result = await processFiles(normalizedFiles, { ...options, exitOnError: true });
      console.log('DEBUG: processFiles result:', JSON.stringify(result));
      if (options.dryRun) {
        console.log('(dry run)');
      }
      if (result.exitCode === 1) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error('Error in processFiles:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      });
      process.exit(1);
    }
  });

// Add error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Add error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

console.log('Program configured, parsing arguments...');

// Parse arguments
try {
  program.parse(process.argv);
  if (program.opts().debug) {
    console.log('Arguments parsed successfully');
  }
} catch (error) {
  console.error('Error parsing arguments:', {
    message: error.message,
    code: error.code,
    name: error.name,
    stack: error.stack
  });
  process.exit(1);
}

if (program.opts().debug) {
  console.log('Script completed successfully');
}
