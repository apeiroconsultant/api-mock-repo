const fs = require('fs');
const path = require('path');
const openapiToPostman = require('openapi-to-postmanv2');

// Function to generate Postman collection from OpenAPI spec
function generatePostmanCollection(apiSpecPath, outputDir) {
    // Read the OpenAPI spec file
    fs.readFile(apiSpecPath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading OpenAPI spec file (${apiSpecPath}):`, err);
            return;
        }

        // Convert the OpenAPI spec to Postman collection
        openapiToPostman.convert(
            { type: 'string', data }, // Input spec
            { 
                schemaFaker: true,        // Generate values for missing examples
                useExamples: true,       // Use provided examples in the OpenAPI spec
				includeResponses: true,  // Include all responses for each endpoint
                requestNameSource: 'fallback', // Use fallback names for requests,
				requestParametersResolution: 'Example' //Select whether to generate the request parameters based on the schema or the example in the schema.
            },
            (err, result) => {
                if (err) {
                    console.error(`Error converting OpenAPI spec (${apiSpecPath}) to Postman collection:`, err);
                    return;
                }

                if (result.result) {
                    // Save the collection to the output directory
                    const outputPath = path.join(outputDir, `${path.basename(apiSpecPath, path.extname(apiSpecPath))}-postman-collection.json`);
                    fs.writeFile(outputPath, JSON.stringify(result.output[0].data, null, 2), (writeErr) => {
                        if (writeErr) {
                            console.error(`Error saving Postman collection (${outputPath}):`, writeErr);
                        } else {
                            console.log(`Postman collection successfully created: ${outputPath}`);
                        }
                    });
                } else {
                    console.error(`Failed to convert OpenAPI spec (${apiSpecPath}):`, result.reason);
                }
            }
        );
    });
}

// Function to process all specs in a directory
function processDirectory(inputDir, outputDir) {
    fs.readdir(inputDir, (err, files) => {
        if (err) {
            console.error('Error reading input directory:', err);
            return;
        }

        files.forEach((file) => {
            const filePath = path.join(inputDir, file);

            // Check if the file is a JSON or YAML file
            if (file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml')) {
                console.log(`Processing file: ${filePath}`);
                generatePostmanCollection(filePath, outputDir);
            } else {
                console.log(`Skipping non-API spec file: ${filePath}`);
            }
        });
    });
}

// Input directory containing OpenAPI specs
const inputDir = '../consumer/specs'; //Consumer
// Output directory to save the Postman collections
const outputDir = '../consumer/postmanCollection/'; // Replace with your output directory path

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Process all OpenAPI specs in the input directory
processDirectory(inputDir, outputDir);
