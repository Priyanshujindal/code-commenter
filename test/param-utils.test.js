const {
  extractParams,
  generateParamDocs,
  findFunctionNode,
  extractParam,
} = require("../src/param-utils");
const { parse } = require("acorn");

function parseCode(code) {
  return parse(code, { ecmaVersion: "latest", sourceType: "module" });
}

function getFunctionNode(code) {
  const ast = parseCode(code);
  // Return the first FunctionDeclaration from ast.body
  const fn = ast.body.find(n => n.type === "FunctionDeclaration");
  // If the function node exists but has no params, try to reconstruct from AST
  if (fn && (!fn.params || fn.params.length === 0)) {
    // Try to find an ArrayPattern in the AST and assign it as params
    const arrayPattern = (ast.body[0] && ast.body[0].params && ast.body[0].params.length > 0)
      ? ast.body[0].params
      : null;
    if (arrayPattern) {
      fn.params = arrayPattern;
    }
  }
  return fn || null;
}

describe("Parameter Utilities", () => {
  describe("extractParams", () => {
    it("should extract simple parameters", () => {
      const node = {
        params: [
          { type: "Identifier", name: "a" },
          { type: "Identifier", name: "b" },
        ],
      };
      const params = extractParams(node);
      expect(params).toEqual([
        {
          name: "a",
          type: "any",
          isRest: false,
          hasDefault: false,
          isParamProperty: false,
          optional: false,
        },
        {
          name: "b",
          type: "any",
          isRest: false,
          hasDefault: false,
          isParamProperty: false,
          optional: false,
        },
      ]);
    });

    it("should handle default parameters", () => {
      const node = {
        params: [
          {
            type: "AssignmentPattern",
            left: { type: "Identifier", name: "a" },
            right: { type: "Literal", value: 5 },
          },
          {
            type: "AssignmentPattern",
            left: { type: "Identifier", name: "b" },
            right: { type: "Literal", value: "test" },
          },
        ],
      };
      const params = extractParams(node);
      expect(params).toEqual([
        {
          name: "a",
          type: "number",
          isRest: false,
          hasDefault: true,
          defaultValue: "5",
          isParamProperty: false,
          optional: false,
        },
        {
          name: "b",
          type: "string",
          isRest: false,
          hasDefault: true,
          defaultValue: '"test"',
          isParamProperty: false,
          optional: false,
        },
      ]);
    });

    it("should handle rest parameters", () => {
      const node = {
        params: [{ type: "RestElement", argument: { name: "args" } }],
      };
      const params = extractParams(node);
      expect(params).toEqual([
        {
          name: "...args",
          type: "Array<any>",
          isRest: true,
          hasDefault: false,
          optional: false,
        },
      ]);
    });

    it("should handle destructured parameters", () => {
      const node = {
        params: [
          {
            type: "ObjectPattern",
            properties: [
              { type: "Property", key: { name: "a" }, value: { name: "a" } },
              { type: "Property", key: { name: "b" }, value: { name: "b" } },
            ],
          },
          {
            type: "ArrayPattern",
            elements: [
              { type: "Identifier", name: "c" },
              { type: "Identifier", name: "d" },
            ],
          },
        ],
      };
      const params = extractParams(node);
      expect(params).toEqual([
        {
          name: "param1",
          type: "Object",
          isRest: false,
          hasDefault: false,
          properties: [
            { name: "a", type: "any", hasDefault: false, optional: false },
            { name: "b", type: "any", hasDefault: false, optional: false },
          ],
        },
        {
          name: "param2",
          type: "Array",
          isRest: false,
          hasDefault: false,
          elements: [
            {
              name: "c",
              type: "any",
              isRest: false,
              hasDefault: false,
              optional: false,
              isParamProperty: false,
            },
            {
              name: "d",
              type: "any",
              isRest: false,
              hasDefault: false,
              optional: false,
              isParamProperty: false,
            },
          ],
        },
      ]);
    });

    it("should handle deeply destructured parameters", () => {
      const node = {
        params: [
          {
            type: "ObjectPattern",
            properties: [
              {
                type: "Property",
                key: { name: "a" },
                value: { name: "a" },
                shorthand: true,
              },
              {
                type: "Property",
                key: { name: "b" },
                value: {
                  type: "ObjectPattern",
                  properties: [
                    {
                      type: "Property",
                      key: { name: "c" },
                      value: { name: "c" },
                      shorthand: true,
                    },
                    {
                      type: "Property",
                      key: { name: "d" },
                      value: {
                        type: "ObjectPattern",
                        properties: [
                          {
                            type: "Property",
                            key: { name: "e" },
                            value: { name: "e" },
                            shorthand: true,
                          },
                        ],
                      },
                      shorthand: false,
                    },
                  ],
                },
                shorthand: false,
              },
            ],
          },
        ],
      };
      const params = extractParams(node);
      expect(params).toEqual([
        {
          name: "param1",
          type: "Object",
          isRest: false,
          hasDefault: false,
          properties: [
            { name: "a", type: "any", hasDefault: false, optional: false },
            {
              name: "b",
              type: "Object",
              hasDefault: false,
              optional: false,
              properties: [
                { name: "c", type: "any", hasDefault: false, optional: false },
                {
                  name: "d",
                  type: "Object",
                  hasDefault: false,
                  optional: false,
                  properties: [
                    { name: "e", type: "any", hasDefault: false, optional: false },
                  ],
                },
              ],
            },
          ],
        },
      ]);
    });

    it("should handle array destructuring with defaults", () => {
      const code = 'function test([a = 1, b = "default"]) {}';
      const ast = parseCode(code);
      // Directly extract the params from the AST
      const fn = ast.body.find(n => n.type === "FunctionDeclaration");
      const params = fn && fn.params && fn.params.length > 0 ? fn.params : (ast.body[0].params || []);
      // Use extractParam on the ArrayPattern
      const extracted = params.length > 0 ? extractParam(params[0], false, 1) : null;
      // Generate JSDoc for the destructured params
      let doc = '';
      if (extracted && extracted.elements) {
        doc = extracted.elements.map((el, i) => {
          const type = el.type;
          const name = `[${el.name}=${el.defaultValue}]`;
          return `@param {${type}} ${name}`;
        }).join('\n');
      }
      expect(doc).toMatch(/@param \{number\}\s+\[a\s*=1\]/);
      expect(doc).toMatch(/@param \{string\}\s+\[b\s*="default"\]/);
    });
  });

  describe("generateParamDocs", () => {
    it("should generate JSDoc for simple parameters", () => {
      const code = `function test(a, b) {
  return a + b;
}`;

      const functionNode = getFunctionNode(code);
      const result = generateParamDocs(functionNode);

      expect(result).toContain("@param {any} a - Parameter 'a'");
      expect(result).toContain("@param {any} b - Parameter 'b'");
    });

    it("should handle arrow functions", () => {
      const code = 'const add = (a, b) => a + b;';
      const ast = parseCode(code);
      // Find the ArrowFunctionExpression node
      let functionNode = null;
      if (ast.body[0].type === 'VariableDeclaration') {
        functionNode = ast.body[0].declarations[0].init;
      }
      const result = generateParamDocs(functionNode);
      expect(result).toContain("@param {any} a - Parameter 'a'");
      expect(result).toContain("@param {any} b - Parameter 'b'");
    });

    it("should handle methods", () => {
      const code = 'class C { method(a, b) {} }';
      const ast = parseCode(code);
      // Find the MethodDefinition node
      let functionNode = null;
      if (ast.body[0].type === 'ClassDeclaration') {
        functionNode = ast.body[0].body.body.find(m => m.type === 'MethodDefinition').value;
      }
      const result = generateParamDocs(functionNode);
      expect(result).toContain("@param {any} a - Parameter 'a'");
      expect(result).toContain("@param {any} b - Parameter 'b'");
    });

    it("should handle complex parameter patterns", () => {
      const code = 'function test({ a = 1, b: { c, d: [e] } }, [f, ...g]) {}';
      const ast = parseCode(code);
      // Find the FunctionDeclaration node
      const functionNode = ast.body.find(n => n.type === 'FunctionDeclaration');
      // Debug output
      console.log('DEBUG functionNode.params:', JSON.stringify(functionNode.params, null, 2));
      const { extractParams } = require('../src/param-utils');
      console.log('DEBUG extractParams:', JSON.stringify(extractParams(functionNode), null, 2));
      const result = generateParamDocs(functionNode);
      // Debug output
      console.log('TEST DEBUG JSDoc:', result);
      // Check for flattened destructured properties (allow for alignment)
      expect(result).toMatch(/@param \{number\}\s+a\s+- Default value: `1`\. - Property 'a'/);
      expect(result).toMatch(/@param \{Object\}\s+b\s+- Property 'b'/);
      expect(result).toMatch(/@param \{any\}\s+b\.c\s+- Property 'c'/);
      expect(result).toMatch(/@param \{Array\}\s+b\.d\s+- Property 'd'/);
      expect(result).toMatch(/@param \{any\}\s+e\s+- Parameter 'e'/);
      expect(result).toMatch(/@param \{any\}\s+f\s+- Parameter 'f'/);
      expect(result).toMatch(/@param \{Array\}\s+...g\s+- Rest parameter/);
    });

    it("should add a @returns tag if a return statement is present", () => {
      const code = `function add(a, b) { return a + b; }`;
      const functionNode = getFunctionNode(code);
      const result = generateParamDocs(functionNode);
      expect(result).toContain("@returns");
    });

    it("should infer types from default values", () => {
        const code = `function multiply(a = 1, b = "2") {}`;
        const functionNode = getFunctionNode(code);
        const result = generateParamDocs(functionNode);
        expect(result).toContain("@param {number} [a=1]");
        expect(result).toContain('@param {string} [b="2"]');
    });

    it("should generate an @example tag", () => {
        const code = `function add(a, b) { return a + b; }`;
        const functionNode = getFunctionNode(code);
        const result = generateParamDocs(functionNode, { example: true });
        expect(result).toContain("@example");
    });
  });

  describe("TypeScript parameter extraction", () => {
    it("should extract destructured, rest, and parameter property parameters correctly", () => {
      // Simulate a TS AST node for a constructor with parameter properties and destructured/rest params
      const node = {
        params: [
          // TSParameterProperty (class constructor)
          {
            type: "TSParameterProperty",
            parameter: {
              type: "Identifier",
              name: "foo",
              typeAnnotation: { typeAnnotation: { type: "TSStringKeyword" } },
              optional: false,
            },
          },
          // Destructured with type annotation
          {
            type: "ObjectPattern",
            typeAnnotation: {
              typeAnnotation: {
                type: "TSTypeReference",
                typeName: { name: "BarType" },
              },
            },
            properties: [
              { type: "Property", key: { name: "a" }, value: { name: "a" } },
              { type: "Property", key: { name: "b" }, value: { name: "b" } },
            ],
          },
          // Rest parameter
          {
            type: "RestElement",
            argument: {
              name: "args",
              typeAnnotation: {
                typeAnnotation: {
                  type: "TSArrayType",
                  elementType: { type: "TSNumberKeyword" },
                },
              },
            },
          },
        ],
      };
      const params = extractParams(node, { isTypeScript: true });
      expect(params).toEqual([
        {
          name: "foo",
          type: "string",
          isRest: false,
          hasDefault: false,
          optional: false,
          isParamProperty: true,
        },
        {
          name: "param1",
          type: "BarType",
          isRest: false,
          hasDefault: false,
          properties: [
            { name: "a", type: "any", hasDefault: false, optional: false },
            { name: "b", type: "any", hasDefault: false, optional: false },
          ],
        },
        {
          name: "...args",
          type: "Array<number>",
          isRest: true,
          hasDefault: false,
          optional: false,
        },
      ]);
    });
  });

  describe("Type Inference and JSDoc Formatting", () => {
    it("should infer array and object types from default values", () => {
      const node = {
        params: [
          {
            type: "AssignmentPattern",
            left: { type: "Identifier", name: "arr" },
            right: { type: "ArrayExpression", elements: [] },
          },
          {
            type: "AssignmentPattern",
            left: { type: "Identifier", name: "obj" },
            right: { type: "ObjectExpression", properties: [] },
          },
        ],
      };
      const params = extractParams(node);
      expect(params[0].type).toBe("Array");
      expect(params[1].type).toBe("Object");
    });

    it("should note when type could not be inferred in JSDoc", () => {
      const code = `function foo(bar) {}`;
      const node = getFunctionNode(code);
      const doc = generateParamDocs(node);
      expect(doc).toMatch(/@param \{any\} bar\s+- Parameter 'bar' \(Type could not be inferred\)/);
    });

    it("should align @param tags in JSDoc", () => {
      const code = `function test(a, longParam, b) {}`;
      const node = getFunctionNode(code);
      const doc = generateParamDocs(node);
      // All @param lines should have the same number of spaces between type and name
      const lines = doc.split('\n').filter(l => l.includes('@param'));
      const spacesBetweenTypeAndName = lines.map(l => {
        const match = l.match(/\{[^}]+\}(\s+)[^\s]/);
        return match ? match[1].length : 0;
      });
      expect(new Set(spacesBetweenTypeAndName).size).toBe(1);
    });
  });
});
