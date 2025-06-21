/**
 * Utility functions for working with function parameters.
 * @module param-utils
 */

const { parse } = require("acorn");
const { generate } = require("escodegen");

function getPropertyName(property) {
    if (!property) return "unknown";
    if (property.key) return property.key.name;
    if (property.argument) return property.argument.name;
    if (property.type === "Identifier") return property.name;
    return "unknown";
}

function getTSType(tsNode, defaultType = "any") {
    if (!tsNode) return defaultType;
    if (tsNode.typeAnnotation) return getTSType(tsNode.typeAnnotation, defaultType);
    if (tsNode.type === 'TSTypeAnnotation') return getTSType(tsNode.typeAnnotation, defaultType);
    
    switch (tsNode.type) {
        case 'TSStringKeyword': return 'string';
        case 'TSNumberKeyword': return 'number';
        case 'TSBooleanKeyword': return 'boolean';
        case 'TSArrayType': return 'Array';
        case 'TSTypeReference': return tsNode.typeName?.name || defaultType;
        default: return defaultType;
    }
}

function extractObjectPatternProperties(properties, isTypeScript, parentName) {
    const extracted = [];
    if (!properties) return extracted;

    for (const prop of properties) {
        if (prop.type === "RestElement") {
            extracted.push({ name: getPropertyName(prop), type: 'Object', isRest: true, hasDefault: false });
            continue;
        }
        
        if (prop.type !== "Property") continue;

        const propName = getPropertyName(prop);
        const fullName = parentName ? `${parentName}.${propName}` : propName;
        let valueNode = prop.value;
        let defaultValue;
        let hasDefault = false;
        let type = isTypeScript ? getTSType(valueNode) : "any";

        if (valueNode.type === "AssignmentPattern") {
            hasDefault = true;
            const right = valueNode.right;
            defaultValue = generate(right, { format: { quotes: 'double' }});
            if (right.type === 'Literal') {
                if(typeof right.value === 'number') type = 'number';
                if(typeof right.value === 'string') type = 'string';
                if(typeof right.value === 'boolean') type = 'boolean';
            }
            valueNode = valueNode.left;
        }

        const param = { name: fullName, type, hasDefault, optional: false };
        if (defaultValue) {
            param.defaultValue = defaultValue;
        }

        if (valueNode.type === "ObjectPattern") {
            param.type = "Object";
            param.properties = extractObjectPatternProperties(
                valueNode.properties,
                isTypeScript,
                fullName
            );
        } else if (valueNode.type === "ArrayPattern") {
            param.type = "Array";
        }

        extracted.push(param);
    }
    return extracted;
}

function extractParam(p, isTypeScript, paramIndex) {
    if (!p) return null;
    let paramInfo = null;
    switch (p.type) {
        case "Identifier":
            paramInfo = { name: p.name, type: isTypeScript ? getTSType(p) : "any", isRest: false, hasDefault: false, optional: false, isParamProperty: false };
            break;
        case "AssignmentPattern":
            paramInfo = extractParam(p.left, isTypeScript, paramIndex);
            if (paramInfo) {
                paramInfo.hasDefault = true;
                paramInfo.defaultValue = generate(p.right, { format: { quotes: 'double' } });
            }
            break;
        case "ObjectPattern":
            paramInfo = { name: `param${paramIndex}`, type: isTypeScript ? getTSType(p, 'Object') : 'Object', isRest: false, hasDefault: false, properties: extractObjectPatternProperties(p.properties, isTypeScript, "") };
            break;
        case "ArrayPattern":
            paramInfo = { name: `param${paramIndex}`, type: "Array", isRest: false, hasDefault: false, elements: p.elements.map((e) => extractParam(e, isTypeScript, 0)) };
            break;
        case "RestElement":
            paramInfo = { name: `...${getPropertyName(p)}`, type: isTypeScript ? `Array<${getTSType(p.argument, 'any')}>` : "Array<any>", isRest: true, hasDefault: false, optional: false };
            break;
        case "TSParameterProperty":
            paramInfo = extractParam(p.parameter, isTypeScript, paramIndex);
            if (paramInfo) {
                paramInfo.isParamProperty = true;
                paramInfo.type = getTSType(p.parameter);
            }
            break;
    }
    return paramInfo;
}

function extractParams(node, isTypeScript = false) {
    const paramNodes = node.params || (node.value && node.value.params);
    if (!paramNodes) return [];

    const processedParams = [];
    let paramIndex = 1;

    for (const p of paramNodes) {
        const extracted = extractParam(p, isTypeScript, paramIndex);
        if (extracted) {
            processedParams.push(extracted);
            if (extracted.name && extracted.name.startsWith('param')) {
                paramIndex++;
            }
        }
    }
    return processedParams;
}

function findFunctionNode(ast) {
    if (!ast.body || ast.body.length === 0) return null;
    let node = ast.body[0];

    if (node.type === "ExpressionStatement") node = node.expression;
    if (node.type === "VariableDeclaration") node = node.declarations[0].init;
    if (node.type === "ClassDeclaration") {
        return node.body.body.find((def) => def.kind === "method");
    }

    if (typeof node === 'object' && node !== null && 'params' in node) {
        return node;
    }

    return null;
}

function generateParamDocs(code) {
    try {
        const ast = parse(code, { ecmaVersion: "latest", sourceType: "module" });
        const functionNode = findFunctionNode(ast);
        if (!functionNode) return "";

        const params = extractParams(functionNode);
        const paramDocs = [];

        const addPropDocs = (properties) => {
            for (const prop of properties) {
                let propDoc = `@param {${prop.type}} ${prop.name}`;
                if (prop.hasDefault) {
                    propDoc += `=${prop.defaultValue}`;
                }
                propDoc += ` - Property '${prop.name.split(".").pop()}'`;
                paramDocs.push(propDoc);

                if (prop.properties) {
                    addPropDocs(prop.properties);
                }
            }
        };

        for (const param of params) {
            if (param.isRest) {
                paramDocs.push(`@param {...*} ${param.name.replace("...", "")} - Rest parameter`);
            } else if (param.properties) {
                paramDocs.push(`@param {${param.type}} ${param.name} - Object parameter`);
                addPropDocs(param.properties);
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
