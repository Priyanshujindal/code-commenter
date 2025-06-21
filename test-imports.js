console.log("Testing imports...");
console.log("Node.js version:", process.version);

const testImports = async () => {
  const imports = [
    { name: "fs", module: "fs" },
    { name: "path", module: "path" },
    { name: "acorn", module: "acorn" },
    { name: "acorn-walk", module: "acorn-walk" },
    { name: "param-utils", module: "./src/param-utils" },
    { name: "file-utils", module: "./src/file-utils" },
    { name: "util", module: "util" },
    { name: "colors/safe", module: "colors/safe" },
    { name: "glob", module: "glob" },
  ];

  for (const { name, module } of imports) {
    try {
      console.log(`\nTesting import: ${name}`);
      const mod = require(module);
      console.log(`✅ Successfully imported ${name}`);
      if (name === "glob") {
        console.log("  glob version:", mod?.version || "unknown");
      }
    } catch (error) {
      console.error(`❌ Failed to import ${name}:`);
      console.error("  Error:", error.message);
      console.error("  Code:", error.code);
      console.error("  Stack:", error.stack.split("\n")[0]);
      return false;
    }
  }
  return true;
};

testImports()
  .then((success) => {
    console.log(
      "\nTest completed:",
      success ? "✅ All imports successful" : "❌ Some imports failed",
    );
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
