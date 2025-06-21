/**
 * Utility functions for working with function parameters.
 * @module param-utils
 */

const { parse } = require("acorn");
const { generate } = require("escodegen");

function getPropertyName(property) {
    if (property.key) {
        return property.key.name;
    }
    if (property.argument) {
        return property.argument.name;
    }
    return "unknown";
}

function extractObjectPatternProperties(properties, isTypeScript, parentName = "") {
    const params = [];
    if (!properties) {
        return params;
    }
    for (const property of properties) {
        if (!property) continue;

        let param;
        const name = getPropertyName(property);
        const newParentName = parentName ? `${parentName}.${name}` : name;

        if (property.type === "Property") {
            param = processProperty(property, isTypeScript, newParentName);
        } else if (property.type === "RestElement") {
            param = extractParam(property, isTypeScript);
        } else {
            param = extractParam(property, isTypeScript);
        }

        if (param) {
            params.push(param);
        }
    }

    return params;
}

function processProperty(property, isTypeScript, parentName) {
    let param;

    switch (property.value.type) {
        case "ObjectPattern":
            param = {
                name: parentName,
                type: "Object",
                properties: extractObjectPatternProperties(
                    property.value.properties,
                    isTypeScript,
                    parentName
                ),
            };
            break;
        case "ArrayPattern":
            param = {
                name: parentName,
                type: "Array",
                properties: property.value.elements.map((element, index) => {
                    const elementName = element.name || `element${index}`;
                    return processProperty(
                        {
                            key: { name: elementName },
                            value: element,
                        },
                        isTypeScript,
                        `${parentName}.${elementName}`
                    );
                }),
            };
            break;
        case "AssignmentPattern":
            param = processProperty(
                {
                    key: property.key,
                    value: property.value.left,
                },
                isTypeScript,
                parentName
            );
            param.hasDefault = true;
            param.defaultValue = generate(property.value.right);
            break;
        default:
            param = {
                name: parentName,
                type: "any",
                hasDefault: false,
                optional: false,
            };
            break;
    }
    return param;
}

function extractParam(p, isTypeScript) {
    let paramInfo = null;
    switch (p.type) {
        case "Identifier":
            paramInfo = {
                name: p.name,
                type: "any",
                isRest: false,
                hasDefault: false,
                optional: false,
                isParamProperty: false,
            };
            break;
        case "AssignmentPattern":
            if (p.left.type === "Identifier") {
                paramInfo = {
                    name: p.left.name,
                    type: "any",
                    hasDefault: true,
                    defaultValue: generate(p.right),
                    isRest: false,
                    optional: false,
                    isParamProperty: false,
                };
            }
            break;
        case "RestElement":
            paramInfo = {
                name: `...${p.argument.name}`,
                type: "Array<any>",
                isRest: true,
                hasDefault: false,
                optional: false,
            };
            break;
    }
    return paramInfo;
}

function extractParams(node, isTypeScript = false) {
    if (!node || !node.params) return [];

    const processedParams = [];
    let paramIndex = 1;

    for (const param of node.params) {
        if (param.type === "ObjectPattern") {
            const baseName = `param${paramIndex}`;
            paramIndex++;
            const properties = extractObjectPatternProperties(param.properties, isTypeScript, baseName);
            processedParams.push({
                name: baseName,
                type: "Object",
                isRest: false,
                hasDefault: false,
                properties: properties,
            });
        } else if (param.type === "ArrayPattern") {
            const baseName = `param${paramIndex}`;
            paramIndex++;
            processedParams.push({
                name: baseName,
                type: "Array",
                isRest: false,
                hasDefault: false,
                elements: param.elements.map((e) => extractParam(e, isTypeScript))
            });
        } else {
            const extracted = extractParam(param, isTypeScript);
            if (extracted) {
                processedParams.push(extracted);
            }
        }
    }

    return processedParams;
}

function generateParamDocs(code) {
    try {
        const ast = parse(code, { ecmaVersion: "latest", sourceType: "module" });
        let functionNode;

        if (ast.body[0].type === 'ExpressionStatement' && ast.body[0].expression.type === 'ArrowFunctionExpression') {
            functionNode = ast.body[0].expression;
        } else if (ast.body[0].type === 'ExpressionStatement' && ast.body[0].expression.type === 'FunctionExpression') {
            functionNode = ast.body[0].expression;
        } else if (ast.body[0].type === 'FunctionDeclaration') {
            functionNode = ast.body[0];
        } else if (ast.body[0].type === 'VariableDeclaration') {
            functionNode = ast.body[0].declarations[0].init;
        } else if (ast.body[0].type === 'ClassDeclaration'){
            functionNode = ast.body[0].body.body.find(def => def.kind === 'method');
        } else {
            functionNode = ast.body[0].declaration || ast.body[0].expression || ast.body[0];
        }

        const params = extractParams(functionNode);
        const paramDocs = [];

        for (const param of params) {
            if (param.isRest) {
                paramDocs.push(`@param {...*} ${param.name.replace("...", "")} - Rest parameter`);
            } else if (param.properties) {
                paramDocs.push(`@param {${param.type}} ${param.name} - Object parameter`);
                for (const prop of param.properties) {
                    if (prop.hasDefault) {
                        paramDocs.push(`@param {any} ${prop.name}=${prop.defaultValue} - Property '${prop.name.split('.').pop()}'`);
                    } else {
                        paramDocs.push(`@param {any} ${prop.name} - Property '${prop.name.split('.').pop()}'`);
                    }
                }
            } else if (param.hasDefault) {
                paramDocs.push(`@param {any} ${param.name}=${param.defaultValue} - Parameter '${param.name}'`);
            } else {
                paramDocs.push(`@param {any} ${param.name} - Parameter '${param.name}'`);
            }
        }
        return paramDocs.join("\n");
    } catch (error) {
        // console.error("Error parsing code:", error);
        return "";
    }
}

module.exports = {
    extractParams,
    generateParamDocs,
};
