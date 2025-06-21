#!/usr/bin/env node

"use strict";

console.log("Testing commander with file processing...");
console.log("Node.js version:", process.version);

const { program } = require("commander");
const { processFiles } = require("../src/processor");
const path = require("path");
const fs = require("fs");
const { version } = require("../package.json");

console.log("Dependencies loaded successfully");

// Set up the program
program
  .name("code-commenter")
  .description("A CLI tool that adds helpful comments to JavaScript code")
  .version(version)
  .argument("<files...>", "Files to process")
  .option(
    "-o, --output <path>",
    "output directory (default: overwrite original files)",
  )
  .option("--dry-run", "Show what would change, but don't write files")
  .option("--debug", "Show debug output")
  .option("--no-todo", "Do not add TODO comments")
  .option("-c, --config <path>", "Path to a JSON configuration file")
  .action(async (files, options) => {
    try {
      if (files.length === 0) {
        console.error("Error: No files specified.");
      process.exit(1);
    }

      let config = {};
      if (options.config) {
        const configPath = path.resolve(process.cwd(), options.config);
        if (fs.existsSync(configPath)) {
          const configContent = fs.readFileSync(configPath, "utf8");
          config = JSON.parse(configContent);
        }
      }

      if (options.debug) {
        process.env.DEBUG = "true";
      }

      if (options.config) {
        console.log(`Loading config from: ${options.config}`);
      }

      const processorOptions = {
        ...config,
        ...options,
      };

      const normalizedFiles = files.map((f) => path.resolve(process.cwd(), f));
      const stats = await processFiles(normalizedFiles, processorOptions);

      console.log("\nProcessing complete.");
      process.exit(0);
    } catch (error) {
      console.error("Error in processFiles:", error.message);
      process.exit(1);
    }
  });

// Add error handling for unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Add error handling for uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

console.log("Program configured, parsing arguments...");

// Parse arguments
try {
  program.parse(process.argv);
  if (program.opts().debug) {
    console.log("Arguments parsed successfully");
  }
} catch (error) {
  console.error("Error parsing arguments:", {
    message: error.message,
    code: error.code,
    name: error.name,
    stack: error.stack,
  });
  process.exit(1);
}

if (program.opts().debug) {
  console.log("Script completed successfully");
}
