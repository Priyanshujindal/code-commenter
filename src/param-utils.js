/**
 * Utility functions for working with function parameters.
 * @module param-utils
 */

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
        case 'TSAnyKeyword': return 'any';
        case 'TSVoidKeyword': return 'void';
        case 'TSArrayType': {
            const elementType = getTSType(tsNode.elementType, 'any');
            return `Array<${elementType}>`;
        }
        case 'TSTypeReference':
            if (tsNode.typeName && tsNode.typeName.name) {
                return tsNode.typeName.name;
            } else if (tsNode.typeName && tsNode.typeName.left && tsNode.typeName.right) {
                // Handle qualified names (e.g., ns.Type)
                return tsNode.typeName.left.name + '.' + tsNode.typeName.right.name;
            }
            return defaultType;
        case 'TSUnionType':
            return tsNode.types.map(t => getTSType(t, defaultType)).join(' | ');
        case 'TSIntersectionType':
            return tsNode.types.map(t => getTSType(t, defaultType)).join(' & ');
        case 'TSLiteralType':
            if (tsNode.literal && typeof tsNode.literal.value !== 'undefined') {
                return typeof tsNode.literal.value;
            }
            return defaultType;
        case 'ObjectPattern': return 'Object';
        case 'ArrayPattern': return 'Array';
        default: return defaultType;
    }
}

function extractObjectPatternProperties(properties, isTypeScript, _parentName) {
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
            paramInfo = { name: p.name, type: isTypeScript ? getTSType(p) : inferTypeFromDefault(p), isRest: false, hasDefault: false, optional: false, isParamProperty: false };
            break;
        case "AssignmentPattern":
            paramInfo = extractParam(p.left, isTypeScript, paramIndex);
            if (paramInfo) {
                paramInfo.hasDefault = true;
                paramInfo.defaultValue = generate(p.right, { format: { quotes: 'double' } });
                if (p.right.type === 'Literal') {
                    if (typeof p.right.value === 'number') {
                        paramInfo.type = 'number';
                    } else if (typeof p.right.value === 'string') {
                        paramInfo.type = 'string';
                    } else if (typeof p.right.value === 'boolean') {
                        paramInfo.type = 'boolean';
                    }
                } else if (p.right.type === 'ArrayExpression') {
                    paramInfo.type = 'Array';
                } else if (p.right.type === 'ObjectExpression') {
                    paramInfo.type = 'Object';
                }
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

function inferTypeFromDefault(identifierNode) {
    // Try to infer type from default value if available
    if (identifierNode && identifierNode.typeAnnotation) {
        return getTSType(identifierNode.typeAnnotation);
    }
    if (identifierNode && identifierNode.default) {
        const val = identifierNode.default;
        if (typeof val === 'string') return 'string';
        if (typeof val === 'number') return 'number';
        if (typeof val === 'boolean') return 'boolean';
        if (Array.isArray(val)) return 'Array';
        if (typeof val === 'object') return 'Object';
    }
    // Fallback to any
    return 'any';
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
            if (extracted.name && extracted.name.startsWith("param")) {
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

function generateParamDocs(functionNode, options = {}, functionNameArg) {
    try {
        if (!functionNode) return "";

        const { isTypeScript = false } = options;
        const params = extractParams(functionNode, isTypeScript);
        const paramDocs = [];

        // First pass: collect all names/types for alignment
        const allNames = [];
        const allTypes = [];

        // Helper function to collect names and types for alignment
        const collectNamesAndTypes = (param, parentName = "") => {
            const nameStr = parentName ? `${parentName}.${param.name}` : param.name;
            allNames.push(nameStr);
            allTypes.push(param.type);
            if (param.properties) {
                param.properties.forEach(p => collectNamesAndTypes(p, nameStr === undefined ? "" : nameStr));
            }
            if (param.elements) {
                param.elements.forEach(e => { if (e) collectNamesAndTypes(e, nameStr === undefined ? "" : nameStr); });
            }
        };

        params.forEach(param => collectNamesAndTypes(param));
        // Improved: ignore undefined/empty names/types for alignment
        const filteredNames = allNames.filter(Boolean);
        const filteredTypes = allTypes.filter(Boolean);
        const maxTypeLen = filteredTypes.reduce((max, t) => Math.max(max, (t || '').length), 0);
        const maxNameLen = filteredNames.reduce((max, n) => Math.max(max, (n || '').length), 0);

        const pad = (str, len) => str + ' '.repeat(Math.max(0, len - str.length));

        // Helper function to generate documentation for a parameter
        const docForParam = (param, parentName = "", kind = "param", isArrayElement = false) => {
            const typeStr = param.type;
            let nameStr;
            if (isArrayElement && param.name) {
                nameStr = param.name;
            } else if (kind === "property" && parentName && param.name) {
                nameStr = `${parentName}.${param.name}`.replace(/^param\d+\./, '');
            } else {
                nameStr = parentName ? `${parentName}.${param.name}` : param.name;
                nameStr = nameStr.replace(/^param\d+\./, '');
            }
            if (/^param\d+$/.test(nameStr)) {
                if (param.properties) {
                    param.properties.forEach(p => docForParam(p, nameStr, "property"));
                }
                if (param.elements) {
                    param.elements.forEach(e => { if (e) docForParam(e, nameStr, kind, true); });
                }
                return;
            }
            let doc;
            if (isArrayElement && param.isRest && (typeStr === 'Array' || typeStr === 'Array<any>')) {
                doc = `@param {Array} ...${param.name.replace('...', '')} - Rest parameter`;
            } else if (isArrayElement) {
                if (param.hasDefault) {
                    doc = `@param {${typeStr}} ${pad(nameStr, maxNameLen)} - Default value: \`${param.defaultValue}\`. - Parameter '${param.name}'`;
                } else {
                    doc = `@param {${typeStr}} ${pad(nameStr, maxNameLen)} - Parameter '${param.name}'`;
                }
            } else if (param.hasDefault) {
                if (kind === "property" && !isArrayElement) {
                    doc = `@param {${typeStr}} ${pad(nameStr, maxNameLen)} - Default value: \`${param.defaultValue}\`. - Property '${param.name}'`;
                } else {
                    doc = `@param {${pad(typeStr, maxTypeLen)}} [${pad(nameStr, maxNameLen)}=${param.defaultValue}] - Parameter '${nameStr}'`;
                }
            } else if (param.isRest) {
                doc = `@param {...${typeStr.replace('Array<', '').replace('>', '')}} ${nameStr.replace("...", "")} - Rest parameter`;
            } else {
                if (kind === "property" && !isArrayElement) {
                    doc = `@param {${typeStr}} ${pad(nameStr, maxNameLen)} - Property '${param.name}'`;
                } else {
                    doc = `@param {${pad(typeStr, maxTypeLen)}} ${pad(nameStr, maxNameLen)} - Parameter '${nameStr}'`;
                }
            }
            if (typeStr === 'any') {
                doc += ' (Type could not be inferred)';
            }
            paramDocs.push(doc);
            if (param.properties) {
                param.properties.forEach(p => docForParam(p, nameStr, "property"));
            }
            if (param.elements) {
                param.elements.forEach(e => { if (e) docForParam(e, nameStr, kind, true); });
            }
        }
        params.forEach(param => docForParam(param));

        const returnType = getReturnType(functionNode, isTypeScript);
        if (returnType) {
            if (paramDocs.length > 0) {
                paramDocs.push(""); // Add a blank line for separation
            }
            paramDocs.push(`@returns {${returnType}} - The return value`);
        }
        // Smart summary logic
        const isValidIdentifier = name => !!name && name !== 'undefined' && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
        const paramNames = params.map(p => p.name);
        let functionName = functionNameArg;
        if (!functionName) {
            functionName = functionNode.id ? functionNode.id.name : 'anonymous';
        }
        const hasValidNames = paramNames.length > 0 && paramNames.every(p => isValidIdentifier(p.trim()));
        let summaryLine = '';
        if (hasValidNames) {
            if (functionName && functionName !== 'anonymous') {
                if (paramNames.length === 1) {
                    summaryLine = `Function ${functionName} with parameter '${paramNames[0]}'`;
                } else {
                    summaryLine = `Function ${functionName} with parameters '${paramNames.join("', '")}'`;
                }
            } else {
                if (paramNames.length === 1) {
                    summaryLine = `Function with parameter '${paramNames[0]}'`;
                } else {
                    summaryLine = `Function with parameters '${paramNames.join("', '")}'`;
                }
            }
        } else {
            // Only use the placeholder for truly unparseable/anonymous functions
            summaryLine = 'TODO: Describe what this function does (auto-generated)';
        }
        // Build JSDoc block
        let doc = "/**\n";
        doc += ` * @summary ${summaryLine}\n`;
        // Add @example if requested
        if (options.example) {
            const exampleCall = functionName && functionName !== 'anonymous'
                ? functionName + '(' + paramNames.map(n => n || 'value').join(', ') + ')'
                : 'function(' + paramNames.map(n => n || 'value').join(', ') + ')';
            doc += ` * @example\n * ${exampleCall}\n`;
        }
        if (paramDocs.length > 0) {
            doc += ` * \n`;
            doc += paramDocs.map(line => ` * ${line}`).join("\n");
            doc += "\n";
        }
        doc += " */";
        return doc;
    } catch (error) {
        return "";
    }
}

function processFunctionNode(node, options = {}, functionName) {
    return generateParamDocs(node, options, functionName);
}

function getReturnType(functionNode, isTypeScript) {
    if (isTypeScript && functionNode.returnType) {
        return getTSType(functionNode.returnType);
    }
    if (functionNode.body) {
        let hasReturn = false;
        const walk = require('acorn-walk');
        walk.simple(functionNode.body, {
            ReturnStatement(node) {
                if (node.argument) {
                    hasReturn = true;
                }
            }
        });
        if(hasReturn) return 'any';
    }
    if (functionNode.type === 'ArrowFunctionExpression' && functionNode.body.type !== 'BlockStatement') {
        return 'any';
    }

    return null;
}

function generateFunctionComment(node, code, functionName = "", options = {}) {
    const params = extractParams(node, options.isTypeScript);
    const doc = generateParamDocs(node, options, functionName);
    if (!doc) {
        return "/** TODO: Parsing failed for this function. Please check manually. */";
    }
    return doc;
}

module.exports = {
    generateParamDocs,
    processFunctionNode,
    extractParams,
    extractParam,
    getReturnType,
    findFunctionNode,
    generateFunctionComment,
};
