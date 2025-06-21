const { extractParams, generateParamDocs } = require("../src/param-utils");
const { parse } = require("acorn");

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
          type: "any",
          isRest: false,
          hasDefault: true,
          defaultValue: "5",
          isParamProperty: false,
          optional: false,
        },
        {
          name: "b",
          type: "any",
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
  });

  describe("generateParamDocs", () => {
    it("should generate JSDoc for simple parameters", () => {
      const code = `function test(a, b) {
  return a + b;
}`;

      const result = generateParamDocs(code);

      expect(result).toContain("@param {any} a - Parameter 'a'");
      expect(result).toContain("@param {any} b - Parameter 'b'");
    });

    it("should handle arrow functions", () => {
      const code = "const test = (a, b) => a + b;";
      const result = generateParamDocs(code);

      expect(result).toContain("@param {any} a - Parameter 'a'");
      expect(result).toContain("@param {any} b - Parameter 'b'");
    });

    it("should handle methods", () => {
      const code = `class Test {
  method(a, b) {
    return a + b;
  }
}`;
      const result = generateParamDocs(code);

      expect(result).toContain("@param {any} a - Parameter 'a'");
      expect(result).toContain("@param {any} b - Parameter 'b'");
    });

    it("should handle complex parameter patterns", () => {
      const code = `function test({\n  a = 1,\n  b = { x: 1, y: 2 },\n  ...rest\n} = {}) {\n  return { a, b, ...rest };\n}`;

      const result = generateParamDocs(code);
      console.log("Generated docs:", result);

      // Check for the main object parameter
      expect(result).toContain("@param {Object} param1 - Object parameter");

      // Check for nested properties with default values
      expect(result).toContain("@param {number} param1.a=1 - Property 'a'");
      expect(result).toContain("@param {any} param1.b=");

      // Check for rest parameter
      expect(result).toContain("@param {Object} param1.rest - Property 'rest'");
    });

    it("should return empty string for invalid code", () => {
      const result = generateParamDocs("!@#$%");
      expect(result).toBe("");
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
});
