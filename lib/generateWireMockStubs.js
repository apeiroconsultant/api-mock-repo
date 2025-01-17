/**
 * Script to generate WireMock stubs from OpenAPI specifications.
 * - Handles `examples` and `example` fields in response schemas.
 * - Resolves `$ref` references within OpenAPI specifications.
 * - Outputs WireMock mapping files and mock response JSON files.
 * 
 * Author: Rajesh K. Yadav
 */
const fs = require('fs');
const path = require('path');
const yaml = require('yamljs');
const {
    v4: uuidv4
} = require('uuid');
const casual = require('casual');

// Load OpenAPI spec (both JSON and YAML)
function loadOpenApiSpec(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let spec;

    if (ext === '.json') {
        spec = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else if (ext === '.yaml' || ext === '.yml') {
        spec = yaml.load(filePath);
    } else {
        throw new Error('Unsupported file format. Only JSON and YAML are supported.');
    }

    return spec;
}

// Generate random data for a given type
function generateRandomValue(type, format, enumValues) {
    switch (type) {
        case 'string':
            return casual.text;
        case 'integer':
        case 'number':
            return casual.integer(from = 0, to = 10000);
        case 'boolean':
            return Math.random() > 0.5;
        case 'date':
            return casual.date(format = 'YYYY-MM-DD');
        case 'datetime':
            return casual.date(format = 'YYYYMMDDHHmmSS');
        case 'enum':
            return enumValues ? enumValues[Math.floor(Math.random() * enumValues.length)] : null;
        case 'array':
            return [];
        case 'object':
            return {};
        default:
            if (format === 'uuid') {
                return uuidv4();
            }
            return null;
    }
}

// Resolve a reference to a definition in the OpenAPI spec with a limit on nested references
function resolveReference(reference, openApiSpec, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) {
        throw new Error(`Exceeded maximum reference depth of ${maxDepth}`);
    }

    const refPath = reference.replace('#/', '').split('/');
    let resolved = openApiSpec;

    refPath.forEach(part => {

        resolved = resolved[part];

    });

    if (resolved.$ref) {
        return resolveReference(resolved.$ref, openApiSpec, depth + 1, maxDepth);
    }

    return resolved;
}

// Handle response body based on example or random data
function handleExampleBody(example, schema, openApiSpec, depth = 0, maxDepth = 100) {
    if (depth > maxDepth) {
        throw new Error(`Exceeded maximum schema resolution depth of ${maxDepth}`);
    }

    if (example !== undefined) {
        return example;
    }

    if (schema) {
        const type = schema.type;
        const format = schema.format;
        const enumValues = schema.enum;

        if (schema.$ref) {

            const ref = schema.$ref;
            const resolvedSchema = resolveReference(ref, openApiSpec, depth + 1, maxDepth);
            return handleExampleBody(undefined, resolvedSchema, openApiSpec, depth + 1, maxDepth);

        }

        if (type === 'object') {

            return Object.keys(schema.properties || {}).reduce((obj, key) => {
                const prop = schema.properties[key];
                obj[key] = handleExampleBody(prop.example, prop, openApiSpec, depth + 1, maxDepth);
                return obj;
            }, {});
        } else if (type === 'array') {
            const items = schema.items || {};
            return [handleExampleBody(undefined, items, openApiSpec, depth + 1, maxDepth)];
        } else {
            return generateRandomValue(type, format, enumValues);
        }
    }

    return null;
}

function replacePathVariables(pathPattern, parameters, openApiSpec) {
    return pathPattern.replace(/{(\w+)}/g, (match, paramName) => {

        // Find the parameter in the parameters array or resolve it if it has a $ref
        let param = parameters.find(p => {
            // If the parameter has a $ref, resolve it
            if (p.$ref) {
                // Resolve the reference to get the full definition
                p = resolveReference(p.$ref, openApiSpec);
            }

            return p.name === paramName;


        });

        // If the parameter is still undefined, log an error or return the match as-is
        if (!param) {
            console.error(`Parameter '${paramName}' not found in parameters array or its references`);
            return match; // Return the original match if parameter is not found
        }

        if (param.$ref) {
            let p = resolveReference(param.$ref, openApiSpec);
            if (p.schema.example) {

                return p.schema.example;
            } else if (p.required) {
                return `example-${p.name}`
            }
        }

        // If the parameter has an example, use that example to replace the placeholder
        if (param.example) {

            return param.example;
        }

        // Fallback for required parameters without examples: create a default value
        if (param.required) {
            return `example-${paramName}`;
        }
        
        // Retain placeholder if no example or required parameter is found
        return match;
    });
}



// Generate WireMock stubs from OpenAPI paths
function generateWireMockStubs(openApiSpec, outputDir, specName) {
    const mappings = [];
    const paths = openApiSpec.paths;
    const filesDir = path.join(outputDir, '../__files');

    if (!fs.existsSync(filesDir)) {
        fs.mkdirSync(filesDir, {
            recursive: true
        });
    }

    let basePath = openApiSpec.servers?.[0]?.url ? new URL(openApiSpec.servers[0].url).pathname : '';
    if (basePath.endsWith('/')) {
        basePath = basePath.slice(0, -1);
    }

    for (const [pathPattern, methods] of Object.entries(paths)) {
        for (const [method, operation] of Object.entries(methods)) {
            const responses = operation.responses;
            const parameters = operation.parameters || [];

            let urlWithExamples = replacePathVariables(pathPattern, parameters, openApiSpec);
            

            for (const [statusCode, response] of Object.entries(responses)) {
                let responseExample = null;
                let responseHeaders = {};

                // Resolve response headers
                if (response.headers) {
                    for (const [headerName, headerSchema] of Object.entries(response.headers)) {
                        if (headerSchema.$ref) {
                            const resolvedHeader = resolveReference(headerSchema.$ref, openApiSpec);
                            responseHeaders[headerName] = resolvedHeader.schema.example || "example-header-value"; // Fallback to example
                            
                        } else {
                            responseHeaders[headerName] = headerSchema.schema?.example || "example-header-value";
                            
                        }
                    }
                }

                // Resolve response body		
                if (response.$ref) {

                    const ref = response.$ref;
                    const resolvedResponse = resolveReference(ref, openApiSpec);
                    if (resolvedResponse.content?.['application/json']?.examples) {
                        // Handle `examples`
                        const examples = resolvedResponse.content['application/json'].examples;
                        const exampleKeys = Object.keys(examples);
                        if (exampleKeys.length > 0) {
                            responseExample = examples[exampleKeys[0]].value; // Use the first example's value
                        }
                    } else if (resolvedResponse.content?.['application/json']?.example?.$ref) {

                        const ref = resolvedResponse.content['application/json'].example.$ref;
                        const resolvedSchema = resolveReference(ref, openApiSpec);
                        responseExample = handleExampleBody(undefined, resolvedSchema, openApiSpec);
                    } else {

                        const schema = resolvedResponse.content?.['application/json']?.schema;
                        responseExample = handleExampleBody(resolvedResponse.content?.['application/json']?.example, schema, openApiSpec);
                    }
                } else {
                    if (response.content?.['application/json']?.examples) {
                        // Handle `examples`
                        const examples = response.content['application/json'].examples;
                        const exampleKeys = Object.keys(examples);
                        if (exampleKeys.length > 0) {
                            responseExample = examples[exampleKeys[0]].value; // Use the first example's value
                        }
                    } else if (response.content?.['application/json']?.example?.$ref) {
                        const ref = response.content['application/json'].example.$ref;
                        const resolvedSchema = resolveReference(ref, openApiSpec);
                        responseExample = handleExampleBody(undefined, resolvedSchema, openApiSpec);
                    } else {
                        const schema = response.content?.['application/json']?.schema;
                        responseExample = handleExampleBody(response.content?.['application/json']?.example, schema, openApiSpec);
                    }
                }
                // Handle mandatory request headers
                const mandatoryRequestHeaders = {};
                if (operation.parameters) {
                    for (const param of operation.parameters) {
                       
                        if (param.$ref) {
                            let p = resolveReference(param.$ref, openApiSpec);
                            if (p.in === 'header' && p.required) {
                                mandatoryRequestHeaders[p.name] = {
                                    equalTo: p.schema.example || "example-header-value",
                                };
                            }

                        } else {
                            if (param.in === 'header' && param.required) {
                                mandatoryRequestHeaders[param.name] = {
                                    equalTo: param.example || "example-header-value",
                                };
                            }
                        }
                    }
                }
                const fileName = `${specName}-response-${statusCode}.json`;
                const filePath = path.join(filesDir, fileName);



                if (responseExample) {
                    // Write response file if there is a responseExample
                    fs.writeFileSync(filePath, JSON.stringify(responseExample, null, 2), 'utf-8');
                    console.log(`Mock response written to: ${filePath}`);
                }

                // Generate WireMock mapping with or without a response file
                const wireMockResponse = responseExample ?
                    {
                        status: parseInt(statusCode),
                        bodyFileName: fileName,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                    } :
                    {
                        status: parseInt(statusCode),
                    };

                if (Object.keys(responseHeaders).length > 0) {
                    wireMockResponse.headers = {
                        ...wireMockResponse.headers,
                        ...responseHeaders,
                    };
                }


                const requestMatcher = {
                    method: method.toUpperCase(),
                    urlPattern: `${basePath}${urlWithExamples}`,
                    headers: mandatoryRequestHeaders,
                };

                // Add identifier for error responses
                if (parseInt(statusCode) >= 400) {
                    requestMatcher.headers = {
                        'X-Error-Identifier': {
                            equalTo: statusCode,
                        },
                    };
                }

                const wireMockMapping = {
                    id: uuidv4(),
                    request: requestMatcher,
                    response: wireMockResponse,
                };

                mappings.push(wireMockMapping);
            }
        }
    }

    return mappings;
}

// Write WireMock stubs to a file
function writeWireMockStubsToFile(mappings, outputDir, fileName) {
    const outputFilePath = path.join(outputDir, fileName);
    const wireMockStubs = {
        mappings
    };
    fs.writeFileSync(outputFilePath, JSON.stringify(wireMockStubs, null, 2), 'utf-8');
    console.log(`WireMock stubs written to ${outputFilePath}`);
}

// Generate WireMock stubs from OpenAPI files in a directory
function generateStubsFromOpenApiFiles(inputDir, outputDir) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {
            recursive: true
        });
    }

    const files = fs.readdirSync(inputDir);
    const openApiFiles = files.filter(file => /\.(yaml|yml|json)$/i.test(file));

    if (openApiFiles.length === 0) {
        console.log('No OpenAPI spec files found in the directory.');
        return;
    }

    openApiFiles.forEach(file => {
        const filePath = path.join(inputDir, file);
        const specName = path.basename(file, path.extname(file));
        try {
            console.log(`Processing file: ${filePath}`);

            const openApiSpec = loadOpenApiSpec(filePath);
            const wireMockStubs = generateWireMockStubs(openApiSpec, outputDir, specName);

            const outputFileName = `WireMockStub-${specName}.json`;

            writeWireMockStubsToFile(wireMockStubs, outputDir, outputFileName);
        } catch (err) {
            console.error(`Error processing file ${filePath}:`, err.message);
        }
    });
}

// Directory usage
const inputDir = '../target/specs';
const outputDir = '../wiremock/mappings';
generateStubsFromOpenApiFiles(inputDir, outputDir);