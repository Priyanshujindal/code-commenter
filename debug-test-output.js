const { generateParamDocs, extractParams } = require("./src/param-utils");
const { parse } = require("acorn");
const fs = require("fs");

const code = `function test({\n  a = 1,\n  b = { x: 1, y: 2 },\n  ...rest\n} = {}) {\n  return { a, b, ...rest };\n}`;

// 1. Parse the code to AST
const ast = parse(code, {
  ecmaVersion: "latest",
  sourceType: "module",
  locations: true,
  ranges: true,
});

// 2. Save the full AST to a file
fs.writeFileSync("ast-output.json", JSON.stringify(ast, null, 2));
console.log("Full AST saved to ast-output.json");

// 3. Get the function node
const functionNode = ast.body[0];
fs.writeFileSync("function-node.json", JSON.stringify(functionNode, null, 2));
console.log("Function node saved to function-node.json");

// 4. Extract and save the function parameters
const functionParams = functionNode.params;
fs.writeFileSync(
  "function-params.json",
  JSON.stringify(functionParams, null, 2),
);
console.log("Function parameters saved to function-params.json");

// 5. Extract parameters using our function
console.log("Extracting parameters...");
const params = extractParams(functionNode);
fs.writeFileSync("extracted-params.json", JSON.stringify(params, null, 2));
console.log("Extracted parameters saved to extracted-params.json");

// 6. Generate the full documentation
console.log("Generating documentation...");
const result = generateParamDocs(code);
console.log("Generated docs:", result);

// 7. Save all results to a single file for easier inspection
const output = `Code:
${code}

Generated docs:
${result}

Extracted parameters:
${JSON.stringify(params, null, 2)}`;

fs.writeFileSync("test-output.txt", output);
console.log("Complete output saved to test-output.txt");
