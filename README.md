# API Mock Repository

This repository demonstrates a **sample CI/CD pipeline** for generating API mocks, creating Postman collections, and testing integrations. It is designed to automate the creation of mock services based on target system specifications and ensure consumer contract compliance through comprehensive testing.

## Features

- **Mock Generation**: Automates the creation of WireMock-based mock services from API specifications.
- **Postman Collection Generation**: Generates Postman collections to verify API behavior from the consumer’s perspective.
- **Integration Testing**: Executes integration tests using Newman to validate the compatibility of the target system and the consumer.
- **CI/CD Pipeline**: Implements a Jenkins pipeline for seamless automation of the above processes.

## Workflow Overview

The pipeline includes the following key stages:

1. **Install Dependencies**:
   - Installs required npm packages for generating mocks and Postman collections.
   - Commands executed:
     ```bash
     cd lib
     npm install
     ```

2. **Generate Mock Configurations**:
   - Creates WireMock stubs and Postman collections based on the provided API specifications.
   - Commands executed:
     ```bash
     cd lib
     node generateWireMockStubs.js
     node generatePostmanCollections.js
     ```

3. **Start WireMock Docker Container**:
   - Runs a Docker container for hosting the mock services.
   - Commands executed:
     ```bash
     docker run -d -p 9090:8080 \
       -v /path/to/wiremock/mappings:/home/wiremock/mappings \
       -v /path/to/wiremock/__files:/home/wiremock/__files \
       wiremock/wiremock:latest
     ```

4. **Test the Service**:
   - Executes Postman collection tests using Newman to ensure API integration works as expected.
   - Commands executed:
     ```bash
     cd consumer/postmanCollection
     npx newman run dt_pet_api-postman-collection.json
     ```

5. **Cleanup**:
   - Stops the running WireMock Docker containers to free up resources.
   - Commands executed:
     ```powershell
     $containers = docker ps -q --filter "ancestor=wiremock/wiremock:latest"
     foreach ($container in $containers) {
         docker stop $container
     }
     ```

6. **Post Actions**:
   - Cleans the Jenkins workspace to prepare for the next build.

## How to Use

### Prerequisites

- **Docker**: Ensure Docker is installed and running on your system.
- **Node.js and npm**: Required for generating mock services and Postman collections.
- **Jenkins**: Configure a Jenkins instance with access to the repository.

### Steps to Execute

1. Clone the repository:
   ```bash
   git clone https://github.com/apeiroconsultant/api-mock-repo.git
   cd api-mock-repo
   ```

2. Run the Jenkins pipeline. The pipeline will:
   - Install dependencies.
   - Generate mock configurations and Postman collections.
   - Start the mock service in a Docker container.
   - Execute integration tests.
   - Clean up resources.

3. Verify the results in the Jenkins console logs or the Postman test reports.

## Repository Structure

- **`lib/`**: Contains scripts for generating mocks and Postman collections.
- **`wiremock/`**: Includes mappings and files for WireMock services.
- **`consumer`**: Contains the specifications and Postman collections for testing consumer APIs.
- **`target`**: Contains the target application specifications to creat the wiremock stubs.
- **`Jenkinsfile`**: Defines the CI/CD pipeline for automation.
- **`Dockerfile`**: Configuration for creating a Docker image of the mock service.

## Contributions

Contributions are welcome! Feel free to fork the repository, make your changes, and submit a pull request. Ensure your updates include proper documentation and testing.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Acknowledgments

This repository uses [WireMock](https://wiremock.org/) for API mocking and [Newman](https://github.com/postmanlabs/newman) for running Postman collection tests. Special thanks to these open-source tools for enabling seamless API development and testing workflows.

---

For further details or inquiries, contact the repository maintainer or visit the [GitHub page](https://github.com/apeiroconsultant/api-mock-repo).

