const fs = require('fs');
const path = require('path');
const yaml = require('yamljs');
const { v4: uuidv4 } = require('uuid');

// Function to read and parse the OpenAPI spec file (both JSON and YAML)
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

// Function to replace path variables with their example values
function replacePathVariables(pathPattern, parameters) {
  return pathPattern.replace(/{(\w+)}/g, (match, paramName) => {
    const param = parameters.find(p => p.name === paramName);
    if (param && param.example) {
      return param.example; // Replace with the example value
    }
    return match; // If no example is found, keep the placeholder
  });
}

// Function to handle array examples by generating sequential mock response body
function handleExampleBody(example) {
  if (Array.isArray(example)) {
    return example.map((item, index) => {
      if (typeof item === 'object') {
        // If the item is an object, add an index field to represent sequence
        return { ...item, index };
      }
      // If it's a primitive value, just return the indexed value
      return item;
    });
  } else if (typeof example === 'object') {
    return example; // Return the object as is for object examples
  } else {
    return example; // For primitive values, return the value as is
  }
}

// Function to generate WireMock stubs from the OpenAPI paths
function generateWireMockStubs(openApiSpec) {
  const mappings = [];
  const paths = openApiSpec.paths;

  // Loop through each path and method in the OpenAPI spec
  for (const [pathPattern, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const responses = operation.responses;
      const parameters = operation.parameters || [];

      // Replace path variables with examples
      const urlWithExamples = replacePathVariables(pathPattern, parameters);

      for (const [statusCode, response] of Object.entries(responses)) {
        const responseExample = response.content?.['application/json']?.example;
        
        // Handle response body based on the example
        const responseBody = JSON.stringify({
          uuid: uuidv4(), // Add a unique UUID in the response body
          ...handleExampleBody(responseExample), // Handle arrays or objects in the response example
        });

        const responseHeaders = { 'Content-Type': 'application/json' };

        const wireMockResponse = {
          status: parseInt(statusCode),
          body: responseBody,
          headers: responseHeaders,
        };

        // Request matching criteria based on the X-WIREMOCK-API-ClientRef header matching the response code
        const requestMatcher = {
          method: method.toUpperCase(),
          urlPattern: urlWithExamples, // Use the URL with replaced variables
          headers: {
            'X-WIREMOCK-API-ClientRef': {
              equalTo: statusCode, // Match the header with the response status code
            },
          },
        };

        // Generate a unique ID for the stub using UUID
        const stubId = uuidv4();

        // Create the mapping entry with the unique ID
        const wireMockMapping = {
          id: stubId, // Unique stub ID
          request: requestMatcher,
          response: wireMockResponse,
        };

        // Add the mapping to the mappings array
        mappings.push(wireMockMapping);
      }
    }
  }

  return mappings;
}

// Function to write the WireMock stubs to a file
function writeWireMockStubsToFile(mappings, outputDir, fileName) {
  const outputFilePath = path.join(outputDir, fileName);
  const wireMockStubs = { mappings };
  fs.writeFileSync(outputFilePath, JSON.stringify(wireMockStubs, null, 2), 'utf-8');
  console.log(`WireMock stubs written to ${outputFilePath}`);
}

// Function to generate WireMock stubs from OpenAPI spec in all files in a given directory
function generateStubsFromOpenApiFiles(inputDir, outputDir = './output') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(inputDir);

  // Filter only .yaml, .yml, and .json files
  const openApiFiles = files.filter(file => /\.(yaml|yml|json)$/i.test(file));

  if (openApiFiles.length === 0) {
    console.log('No OpenAPI spec files found in the directory.');
    return;
  }

  openApiFiles.forEach(file => {
    const filePath = path.join(inputDir, file);
    try {
      console.log(`Processing file: ${filePath}`);

      // Load the OpenAPI specification
      const openApiSpec = loadOpenApiSpec(filePath);

      // Generate WireMock stubs for the OpenAPI spec
      const wireMockStubs = generateWireMockStubs(openApiSpec);

      // Extract the name of the file without extension
      const fileNameWithoutExt = path.basename(file, path.extname(file));

      // Use the same name as the input file but change extension to .json
      const outputFileName = `WireMockStub-${fileNameWithoutExt}.json`;

      // Write the generated stubs to the output directory with the original filename convention
      writeWireMockStubsToFile(wireMockStubs, outputDir, outputFileName);
    } catch (err) {
      console.error(`Error processing file ${filePath}:`, err.message);
    }
  });
}

// Example usage
const inputDir = '../specs';  // Directory containing OpenAPI spec files
generateStubsFromOpenApiFiles(inputDir);
