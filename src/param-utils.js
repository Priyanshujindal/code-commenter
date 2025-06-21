/**
 * Utility functions for working with function parameters.
 * @module param-utils
 */

const { parse } = require("acorn");
const walk = require("acorn-walk");
const { parse: tsParse } = require("@typescript-eslint/typescript-estree");

// Helper function to extract type from TypeScript AST (module scope)
function getTSType(tsNode) {
  if (!tsNode) return "any";
  if (tsNode.typeAnnotation) {
    // Identifier with type annotation
    return getTSType(tsNode.typeAnnotation);
  }
  if (tsNode.type === "TSTypeAnnotation") {
    if (tsNode.typeAnnotation.type === "TSStringKeyword") return "string";
    if (tsNode.typeAnnotation.type === "TSNumberKeyword") return "number";
    if (tsNode.typeAnnotation.type === "TSBooleanKeyword") return "boolean";
    if (tsNode.typeAnnotation.type === "TSArrayType") return "Array";
    if (tsNode.typeAnnotation.type === "TSTypeReference")
      return tsNode.typeAnnotation.typeName.name || "any";
    if (tsNode.typeAnnotation.type === "TSVoidKeyword") return "void";
    if (tsNode.typeAnnotation.type === "TSAnyKeyword") return "any";
    if (tsNode.typeAnnotation.type === "TSUnknownKeyword") return "unknown";
    if (tsNode.typeAnnotation.type === "TSUnionType") {
      return tsNode.typeAnnotation.types.map(getTSType).join(" | ");
    }
    return "any";
  }
  if (tsNode.type === "TSStringKeyword") return "string";
  if (tsNode.type === "TSNumberKeyword") return "number";
  if (tsNode.type === "TSBooleanKeyword") return "boolean";
  if (tsNode.type === "TSArrayType") return "Array";
  if (tsNode.type === "TSTypeReference") return tsNode.typeName?.name || "any";
  if (tsNode.type === "TSVoidKeyword") return "void";
  if (tsNode.type === "TSAnyKeyword") return "any";
  if (tsNode.type === "TSUnknownKeyword") return "unknown";
  if (tsNode.type === "TSUnionType") {
    return tsNode.types.map(getTSType).join(" | ");
  }
  return "any";
}

/**
 * Extracts parameter information from a function's AST node.
 * @param {Object} node - The function AST node
 * @param {Object} [options] - Options for parameter extraction
 * @param {string} [options.parentName='param'] - Parent parameter name for nested patterns
 * @param {boolean} [options.isNested=false] - Whether this is a nested extraction
 * @param {boolean} [options.isTypeScript=false] - Whether this is a TypeScript extraction
 * @returns {Array<Object>} Array of parameter objects with name, type, and optional default value
 */
function extractParams(
  node,
  { parentName = "param", isNested = false, isTypeScript = false } = {},
) {
  if (!node || !node.params) return [];

  const params = [];
  let destructuredCount = 1;

  // Helper to check if a parameter is optional (TypeScript)
  function isOptional(tsNode) {
    return !!tsNode.optional;
  }

  // Helper to check if a parameter is a parameter property (TypeScript constructor)
  function isParamProperty(tsNode, parent) {
    // Only mark as parameter property if the parent is a TSParameterProperty node
    return parent && parent.type === "TSParameterProperty";
  }

  // Helper function to extract properties from an object pattern
  const extractObjectPatternProperties = (pattern, parentName = "") => {
    if (!pattern || pattern.type !== "ObjectPattern") return [];
    let results = [];
    for (const prop of pattern.properties) {
      if (prop.type === "RestElement") {
        results.push({
          name: prop.argument.name,
          type: "Object",
          isRest: true,
          hasDefault: false,
        });
        continue;
      }

      const currentName = parentName
        ? `${parentName}.${prop.key.name}`
        : prop.key.name;

      if (prop.value && prop.value.type === "ObjectPattern") {
        results = results.concat(
          extractObjectPatternProperties(prop.value, currentName),
        );
      } else if (prop.value && prop.value.type === "AssignmentPattern") {
        let type = isTypeScript ? getTSType(prop.value.left) : "any";
        let defaultValue = "…";

        if (prop.value.right.type === "Literal") {
          type = typeof prop.value.right.value;
          defaultValue = JSON.stringify(prop.value.right.value);
        } else if (prop.value.right.type === "ObjectExpression") {
          type = "Object";
          defaultValue = "{}";
        } else if (prop.value.right.type === "ArrayExpression") {
          type = "Array";
          defaultValue = "[]";
        }

        if (prop.value.left.type === "ObjectPattern") {
          results.push({
            name: currentName,
            type: "Object",
            hasDefault: true,
            defaultValue,
          });
          results = results.concat(
            extractObjectPatternProperties(prop.value.left, currentName),
          );
        } else {
          results.push({
            name: currentName,
            type,
            hasDefault: true,
            defaultValue,
          });
        }
      } else {
        results.push({
          name: currentName,
          type: isTypeScript ? getTSType(prop.value || prop.key) : "any",
          hasDefault: false,
        });
      }
    }
    return results;
  };

  for (const param of node.params) {
    let paramInfo = null;
    switch (param.type) {
      case "Identifier":
        paramInfo = {
          name: param.name,
          type: isTypeScript ? getTSType(param) : "any",
          isRest: false,
          hasDefault: false,
          optional: isTypeScript ? isOptional(param) : false,
          isParamProperty: false,
        };
        break;
      case "AssignmentPattern":
        if (param.left.type === "Identifier") {
          paramInfo = {
            name: param.left.name,
            type: isTypeScript ? getTSType(param.left) : "any",
            hasDefault: true,
            defaultValue:
              param.right && param.right.type === "Literal"
                ? JSON.stringify(param.right.value)
                : undefined,
            isRest: false,
            optional: isTypeScript ? isOptional(param.left) : false,
            isParamProperty: false,
          };
        } else if (param.left.type === "ObjectPattern") {
          // If type annotation is present, use it
          const typeAnn = param.left.typeAnnotation
            ? getTSType(param.left.typeAnnotation)
            : "Object";
          const baseName = `param${destructuredCount++}`;
          paramInfo = {
            name: baseName,
            type: typeAnn,
            isRest: false,
            hasDefault: false,
            properties: extractObjectPatternProperties(param.left, baseName),
          };
        } else if (param.left.type === "ArrayPattern") {
          const typeAnn = param.left.typeAnnotation
            ? getTSType(param.left.typeAnnotation)
            : "Array";
          paramInfo = {
            name: `param${destructuredCount++}`,
            type: typeAnn,
            isRest: false,
            hasDefault: false,
          };
        }
        break;
      case "RestElement":
        paramInfo = {
          name: `...${param.argument.name}`,
          type: isTypeScript ? getTSType(param.argument) : "Array<any>",
          isRest: true,
          hasDefault: false,
          optional: isTypeScript ? isOptional(param.argument) : false,
        };
        break;
      case "ObjectPattern": {
        const typeAnn = param.typeAnnotation
          ? getTSType(param.typeAnnotation)
          : "Object";
        const baseName = `param${destructuredCount++}`;
        paramInfo = {
          name: baseName,
          type: typeAnn,
          isRest: false,
          hasDefault: false,
          properties: extractObjectPatternProperties(param, baseName),
        };
        break;
      }
      case "ArrayPattern": {
        const arrTypeAnn = param.typeAnnotation
          ? getTSType(param.typeAnnotation)
          : "Array";
        paramInfo = {
          name: `param${destructuredCount++}`,
          type: arrTypeAnn,
          isRest: false,
          hasDefault: false,
        };
        break;
      }
      case "TSParameterProperty": {
        // param.parameter is the actual parameter node
        const inner = param.parameter;
        if (inner.type === "Identifier") {
          paramInfo = {
            name: inner.name,
            type: isTypeScript ? getTSType(inner) : "any",
            isRest: false,
            hasDefault: false,
            optional: isTypeScript ? isOptional(inner) : false,
            isParamProperty: true,
          };
        } else if (inner.type === "AssignmentPattern") {
          paramInfo = {
            name: inner.left.name,
            type: isTypeScript ? getTSType(inner.left) : "any",
            hasDefault: true,
            defaultValue:
              inner.right && inner.right.type === "Literal"
                ? JSON.stringify(inner.right.value)
                : undefined,
            isRest: false,
            optional: isTypeScript ? isOptional(inner.left) : false,
            isParamProperty: true,
          };
        } else if (inner.type === "ObjectPattern") {
          const typeAnn = inner.typeAnnotation
            ? getTSType(inner.typeAnnotation)
            : "Object";
          const baseName = `param${destructuredCount++}`;
          paramInfo = {
            name: baseName,
            type: typeAnn,
            isRest: false,
            hasDefault: false,
            isParamProperty: true,
            properties: extractObjectPatternProperties(inner, baseName),
          };
        } else if (inner.type === "ArrayPattern") {
          const typeAnn = inner.typeAnnotation
            ? getTSType(inner.typeAnnotation)
            : "Array";
          paramInfo = {
            name: `param${destructuredCount++}`,
            type: typeAnn,
            isRest: false,
            hasDefault: false,
            isParamProperty: true,
          };
        }
        break;
      }
      default:
        // Fallback: try to extract name/type if possible
        if (param.name && typeof param.name === "string") {
          paramInfo = {
            name: param.name,
            type: isTypeScript ? getTSType(param) : "any",
            isRest: false,
            hasDefault: false,
            optional: isTypeScript ? isOptional(param) : false,
            isParamProperty: false,
          };
        } else if (param.type) {
          // Destructured or unknown pattern
          paramInfo = {
            name: `param${destructuredCount++}`,
            type: "any",
            isRest: false,
            hasDefault: false,
            isParamProperty: false,
          };
        }
        break;
    }
    if (paramInfo) params.push(paramInfo);
  }

  return params;
}

function processFunctionNode(node, options = {}) {
  if (!node || !node.params) return [];
  const params = extractParams(node, { isTypeScript: options.isTypeScript });
  const paramDocs = [];
  if (options.isSetter) {
    if (params.length > 0) {
      paramDocs.push(
        ` * @param {${params[0].type || "any"}} ${params[0].name} - Value to set`,
      );
    }
    return paramDocs;
  }
  for (const param of params) {
    if (param.isRest) {
      paramDocs.push(
        ` * @param {...*} ${param.name.replace("...", "")} - Rest parameter`,
      );
    } else if (param.properties) {
      let baseDoc = ` * @param {Object} ${param.name || "param"} - Object parameter`;
      baseDoc = baseDoc.replace(/=.+ - Description$/, " - Object parameter");
      const propDocs = [];
      for (const prop of param.properties) {
        if (prop.name) {
          if (prop.isRest) {
            propDocs.push(` * @param {...*} ${prop.name} - Rest property`);
          } else {
            let propDoc = ` * @param {${prop.type || "any"}} ${prop.name}`;
            if (prop.optional) propDoc += " (optional)";
            if (
              prop.hasDefault &&
              prop.defaultValue !== undefined &&
              prop.type !== "Object" &&
              prop.type !== "Array"
            ) {
              propDoc += `=${prop.defaultValue}`;
            }
            propDoc += ` - Property '${prop.name}'`;
            propDocs.push(propDoc);
          }
        }
      }
      paramDocs.push(baseDoc);
      paramDocs.push(...propDocs);
    } else {
      let typeDesc = param.type || "any";
      let nameDoc = param.name || "param";
      if (param.optional) nameDoc += " (optional)";
      if (param.hasDefault && param.defaultValue !== undefined) {
        if (typeDesc === "Object") typeDesc = "Object";
        else if (typeDesc === "Array") typeDesc = "Array";
        else if (
          typeof param.defaultValue === "string" &&
          param.defaultValue.startsWith('"')
        )
          typeDesc = "string";
        else if (!isNaN(Number(param.defaultValue))) typeDesc = "number";
        nameDoc += `=${param.defaultValue}`;
      }
      let docLine = ` * @param {${typeDesc}} ${nameDoc} - Parameter '${param.name}'`;
      if (param.isParamProperty) docLine += " (parameter property)";
      paramDocs.push(docLine);
    }
  }
  // Try to infer return type from function body or arrow concise body
  let returnType = "any";
  if (options.isTypeScript && node.returnType) {
    // Use TypeScript return type annotation
    returnType = (function getReturnTSType(tsNode) {
      if (!tsNode) return "any";
      if (tsNode.typeAnnotation) return getTSType(tsNode.typeAnnotation);
      return getTSType(tsNode);
    })(node.returnType);
  } else if (options.isGetter) {
    if (node.body && node.body.body) {
      for (const stmt of node.body.body) {
        if (stmt.type === "ReturnStatement" && stmt.argument) {
          if (stmt.argument.type === "ArrayExpression") returnType = "Array";
          else if (stmt.argument.type === "ObjectExpression")
            returnType = "Object";
          else if (stmt.argument.type === "Literal")
            returnType = typeof stmt.argument.value;
          else if (stmt.argument.type === "Identifier") returnType = "any";
        }
      }
    }
    paramDocs.push(` * @returns {${returnType}} Value`);
    return paramDocs;
  }
  // Detect async/generator
  if (node.async) {
    returnType = "Promise<any>";
  } else if (node.generator) {
    paramDocs.push(" * @generator");
  }
  if (node.body && node.body.body) {
    for (const stmt of node.body.body) {
      if (stmt.type === "ReturnStatement" && stmt.argument) {
        if (stmt.argument.type === "ArrayExpression")
          returnType = node.async
            ? "Promise<Array>"
            : node.generator
              ? "Iterator<Array>"
              : "Array";
        else if (stmt.argument.type === "ObjectExpression")
          returnType = node.async
            ? "Promise<Object>"
            : node.generator
              ? "Iterator<Object>"
              : "Object";
        else if (stmt.argument.type === "Literal")
          returnType = node.async
            ? `Promise<${typeof stmt.argument.value}>`
            : node.generator
              ? `Iterator<${typeof stmt.argument.value}>`
              : typeof stmt.argument.value;
        else if (stmt.argument.type === "Identifier")
          returnType = node.async
            ? "Promise<any>"
            : node.generator
              ? "Iterator<any>"
              : "any";
      }
    }
  } else if (node.body && node.body.type !== "BlockStatement") {
    // Arrow function concise body
    const expr = node.body;
    if (expr.type === "ArrayExpression") returnType = "Array";
    else if (expr.type === "ObjectExpression") returnType = "Object";
    else if (expr.type === "Literal") returnType = typeof expr.value;
    else if (expr.type === "Identifier") returnType = "any";
  }
  paramDocs.push(` * @returns {${returnType}} Return value`);
  return paramDocs;
}

/**
 * Generates JSDoc parameter documentation for a function.
 * @param {string} code - The function code
 * @param {Object} [options] - Options for parameter extraction
 * @returns {string} JSDoc comment string
 */
function generateParamDocs(code, options = {}) {
  let ast;
  if (options.isTypeScript) {
    try {
      ast = tsParse(code, { loc: true, range: true });
    } catch (error) {
      // Try to wrap as a function declaration
      try {
        ast = tsParse("function dummy" + code, { loc: true, range: true });
      } catch (e2) {
        try {
          ast = tsParse("class Dummy { " + code + " }", {
            loc: true,
            range: true,
          });
        } catch (e3) {
          console.error("Error parsing TypeScript code:", error);
          return "";
        }
      }
    }
    // For TypeScript AST, find the first function node in ast.body
    let fnNode = null;
    if (ast.body && ast.body.length > 0) {
      for (const node of ast.body) {
        if (
          node.type === "FunctionDeclaration" ||
          node.type === "FunctionExpression" ||
          node.type === "ArrowFunctionExpression" ||
          node.type === "TSDeclareFunction"
        ) {
          fnNode = node;
          break;
        }
        // For class, look for methods
        if (node.type === "ClassDeclaration" && node.body && node.body.body) {
          for (const method of node.body.body) {
            // Use the method node itself if it has params, otherwise use method.value
            if (
              (method.params && method.params.length > 0) ||
              method.value?.params
            ) {
              fnNode = method.params ? method : method.value;
              break;
            }
          }
        }
      }
    }
    if (fnNode) {
      return processFunctionNode(fnNode, options).join("\n");
    }
    return "";
  } else {
    try {
      ast = parse(code, { ecmaVersion: "latest", sourceType: "module" });
    } catch (error) {
      // Try to wrap as a function declaration
      try {
        ast = parse("function dummy" + code, {
          ecmaVersion: "latest",
          sourceType: "module",
        });
      } catch (e2) {
        // Try to wrap as a method in a class
        try {
          ast = parse("class Dummy { " + code + " }", {
            ecmaVersion: "latest",
            sourceType: "module",
          });
        } catch (e3) {
          console.error("Error parsing code:", error);
          return "";
        }
      }
    }
    let paramDocs = [];
    let found = false;
    walk.simple(ast, {
      FunctionDeclaration(node) {
        if (!found) {
          paramDocs = processFunctionNode(node, options);
          found = true;
        }
      },
      FunctionExpression(node) {
        if (!found) {
          paramDocs = processFunctionNode(node, options);
          found = true;
        }
      },
      ArrowFunctionExpression(node) {
        if (!found) {
          paramDocs = processFunctionNode(node, options);
          found = true;
        }
      },
    });
    return paramDocs.join("\n");
  }
}

module.exports = {
  extractParams,
  processFunctionNode,
  generateParamDocs,
};
