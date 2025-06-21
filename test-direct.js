#!/usr/bin/env node

"use strict";

console.log("Testing processor directly...");
console.log("Node.js version:", process.version);

const { processFile } = require("./src/processor");

async function runTest() {
  try {
    console.log("Starting test...");
    const result = await processFile("test-function.js", { debug: true });
    console.log("Test completed successfully");
    console.log("Result:", result);
  } catch (error) {
    console.error("Test failed with error:");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

runTest();
