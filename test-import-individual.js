console.log("Testing individual imports...");
console.log("Node.js version:", process.version);

const imports = [
  { name: "fs", module: "fs" },
  { name: "path", module: "path" },
  { name: "acorn", module: "acorn" },
  { name: "acorn-walk", module: "acorn-walk" },
  { name: "glob", module: "glob" },
  { name: "colors/safe", module: "colors/safe" },
  { name: "util", module: "util" },
  { name: "param-utils", module: "./src/param-utils" },
  { name: "file-utils", module: "./src/file-utils" },
];

let currentIndex = 0;

function testNextImport() {
  if (currentIndex >= imports.length) {
    console.log("\n✅ All imports tested successfully!");
    process.exit(0);
    return;
  }

  const { name, module } = imports[currentIndex++];
  console.log(`\nTesting import: ${name}`);

  try {
    const mod = require(module);
    console.log(`✅ Successfully imported ${name}`);

    // Log some basic info about the module
    if (mod) {
      if (typeof mod === "function") {
        console.log(`  Type: function (${mod.name || "anonymous"})`);
      } else if (Array.isArray(mod)) {
        console.log(`  Type: array (length: ${mod.length})`);
      } else if (mod && typeof mod === "object") {
        console.log(
          `  Type: object with keys: ${Object.keys(mod).join(", ").substring(0, 100)}`,
        );
      } else {
        console.log(`  Type: ${typeof mod}`);
      }

      if (mod && mod.version) {
        console.log(`  Version: ${mod.version}`);
      }
    }

    // Test the next import after a short delay
    setTimeout(testNextImport, 100);
  } catch (error) {
    console.error(`❌ Failed to import ${name}:`);
    console.error("  Error:", error.message);
    console.error("  Code:", error.code);
    console.error("  Error Type:", error.constructor.name);
    console.error(
      "  Stack:",
      error.stack.split("\n").slice(0, 3).join("\n    "),
    );
    process.exit(1);
  }
}

// Start testing
console.log(`Will test ${imports.length} imports...`);
testNextImport();
