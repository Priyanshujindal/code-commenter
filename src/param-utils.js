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
        case 'TSArrayType':
            const elementType = getTSType(tsNode.elementType, 'any');
            return `Array<${elementType}>`;
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
        let valueNode = prop.value;
        let defaultValue;
        let hasDefault = false;
        let type = "any";

        if(isTypeScript) {
            if(valueNode.type === "Identifier" && valueNode.typeAnnotation) {
                type = getTSType(valueNode.typeAnnotation);
            } else if (valueNode.type === "AssignmentPattern" && valueNode.left.typeAnnotation) {
                type = getTSType(valueNode.left.typeAnnotation);
            } else if (prop.typeAnnotation){
                type = getTSType(prop.typeAnnotation);
            }
        }

        if (valueNode.type === "AssignmentPattern") {
            hasDefault = true;
            const right = valueNode.right;
            defaultValue = generate(right, { format: { quotes: 'double' }});
            if (right.type === 'Literal') {
                if(typeof right.value === 'number') type = 'number';
                if(typeof right.value === 'string') type = 'string';
                if(typeof right.value === 'boolean') type = 'boolean';
            } else if (right.type === 'ObjectExpression') {
                type = 'Object';
            }
            valueNode = valueNode.left;
        }

        const param = { name: propName, type, hasDefault, optional: false };
        if (defaultValue) {
            param.defaultValue = defaultValue;
        }

        if (valueNode.type === "ObjectPattern" || (prop.value.type === 'AssignmentPattern' && prop.value.right.type === 'ObjectExpression') ) {
            param.type = "Object";
            let props;
            if(valueNode.type === 'ObjectPattern') {
                props = valueNode.properties;
            } else {
                props = prop.value.right.properties;
            }
            param.properties = extractObjectPatternProperties(
                props,
                isTypeScript,
                propName
            );
        } else if (valueNode.type === "ArrayPattern") {
            param.type = "Array";
            param.elements = valueNode.elements.map((e, i) => extractParam(e, isTypeScript, i));
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
            paramInfo = { name: `param${paramIndex}`, type: "Array", isRest: false, hasDefault: false, elements: p.elements.map((e, i) => extractParam(e, isTypeScript, i)) };
            break;
        case "RestElement":
            paramInfo = { name: `...${getPropertyName(p)}`, type: isTypeScript ? getTSType(p.argument) : "Array<any>", isRest: true, hasDefault: false, optional: false };
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
        const constructor = node.body.body.find((def) => def.kind === "constructor");
        if(constructor) return constructor;
        return node.body.body.find((def) => def.kind === "method");
    }

    if (typeof node === 'object' && node !== null && 'params' in node) {
        return node;
    }

    return null;
}

function generateParamDocs(code) {
    try {
        const ast = parse(code, {ecmaVersion: "latest", sourceType: "module", plugins: ['typescript']});
        const functionNode = findFunctionNode(ast);
        if (!functionNode) return "";

        const isTypeScript = code.includes("class") || /:/.test(code);
        const params = extractParams(functionNode, isTypeScript);
        const paramDocs = [];

        const addPropDocs = (properties, parentName) => {
            for (const prop of properties) {
                const docName = parentName ? `${parentName}.${prop.name}`: prop.name;
                let propDoc = `@param {${prop.type}} ${docName}`;
                if (prop.hasDefault && !prop.properties) {
                    propDoc += `=${prop.defaultValue}`;
                }
                propDoc += ` - Property '${prop.name}'`;
                paramDocs.push(propDoc);

                if (prop.properties) {
                    addPropDocs(prop.properties, docName);
                }
            }
        };

        for (const param of params) {
            if (param.isRest) {
                paramDocs.push(`@param {...${param.type.replace('Array<', '').replace('>', '')}} ${param.name.replace("...", "")} - Rest parameter`);
            } else if (param.properties) {
                paramDocs.push(`@param {${param.type}} ${param.name} - Object parameter`);
                addPropDocs(param.properties, param.name);
            } else if (param.hasDefault) {
                paramDocs.push(`@param {${param.type}} ${param.name}=${param.defaultValue} - Parameter '${param.name}'`);
            } else {
                paramDocs.push(`@param {${param.type}} ${param.name} - Parameter '${param.name}'`);
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
