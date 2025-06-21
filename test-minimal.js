console.log("Minimal test script starting...");
console.log("Node.js version:", process.version);

// Test basic Node.js functionality
console.log("\n1. Testing basic Node.js functionality...");
console.log("  - Process PID:", process.pid);
console.log("  - Platform:", process.platform);
console.log("  - Architecture:", process.arch);

// Test each module one by one
const modules = [
  { name: "fs", mod: "fs" },
  { name: "path", mod: "path" },
  { name: "util", mod: "util" },
  { name: "acorn", mod: "acorn" },
  { name: "acorn-walk", mod: "acorn-walk" },
  { name: "glob", mod: "glob" },
  { name: "colors", mod: "colors/safe" },
  { name: "param-utils", mod: "./src/param-utils" },
  { name: "file-utils", mod: "./src/file-utils" },
];

async function testModule({ name, mod }) {
  console.log(`\nTesting module: ${name}`);
  console.log("----------------------------------------");

  try {
    console.log(`Requiring ${name}...`);
    const start = process.hrtime.bigint();
    const required = require(mod);
    const end = process.hrtime.bigint();
    const loadTime = Number(end - start) / 1e6; // Convert to milliseconds

    console.log(`✅ Successfully loaded ${name} in ${loadTime.toFixed(2)}ms`);

    // Basic module info
    if (required) {
      const type = typeof required;
      console.log(`  Type: ${type}`);

      if (type === "object") {
        const keys = Object.keys(required);
        console.log(
          `  Keys (first 5): ${keys.slice(0, 5).join(", ")}${keys.length > 5 ? "..." : ""}`,
        );
      }

      if (required.version) {
        console.log(`  Version: ${required.version}`);
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ Failed to load ${name}:`);
    console.error("  Error:", error.message);
    console.error("  Code:", error.code);
    console.error("  Error Type:", error.constructor.name);

    // Log more details for certain error types
    if (error.code === "MODULE_NOT_FOUND") {
      console.error("  Module not found. Try running: npm install");
    }

    // Log partial stack trace
    if (error.stack) {
      const stackLines = error.stack.split("\n").slice(0, 5);
      console.error("  Stack:", stackLines.join("\n    "));
    }

    return false;
  }
}

// Run tests sequentially
async function runTests() {
  console.log("\nStarting module tests...");

  for (const mod of modules) {
    const success = await testModule(mod);
    if (!success) {
      console.error(`\n❌ Test failed at module: ${mod.name}`);
      process.exit(1);
    }

    // Add a small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("\n✅ All modules loaded successfully!");
}

// Run the tests
runTests().catch((error) => {
  console.error("Unhandled error in test:", error);
  process.exit(1);
});
