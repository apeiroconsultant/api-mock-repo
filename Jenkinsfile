pipeline {
  agent any

  environment {
    DOCKER_IMAGE = 'wiremock/wiremock:latest'  // Docker image for WireMock
    MAPPING_DIR = 'mappings'  // Directory to store WireMock mappings
    MOCK_PORT = 9090
  }

  stages {	
    stage('Install Dependencies') {
      steps {
        script {
          // Install WireMock npm dependencies
          powershell '''
          cd lib
          npm install
          '''
        }
      }
    }

    stage('Run WireMock to generate mocks') {
      steps {
        script {
          // Run npm script to generate mocks from the API spec
          powershell '''
          cd lib
          node generateWireMockStubs.js
		  node generatePostmanCollections.js
          '''
        }
      }
    }

    stage('Start WireMock Docker Container') {
      steps {
        script {
          // Use Windows-compatible commands for Docker and paths
          def dockerCommand = """
            docker run -d -p ${MOCK_PORT}:8080 ^
            -v ${pwd()}\\wiremock\\mappings:/home/wiremock/mappings ^
            -v ${pwd()}\\wiremock\\__files:/home/wiremock/__files ^
            ${DOCKER_IMAGE}
          """
          echo "Running Docker command: ${dockerCommand}"
          bat dockerCommand // Using `bat` for Windows shell commands
        }
      }
    }

    stage('Test Service') {
      steps {
        script {
          // Place generated mock mappings into the mappings folder
		  powershell '''
          echo "Test Service"
		  cd consumer/postmanCollection
          npx newman run dt_pet_api-postman-collection.json
		  '''
        }
      }
    }

    stage('Cleanup') {
      steps {
        script {
          // Stop WireMock Docker container after test completion
          echo "Stopping WireMock Docker containers"
          powershell '''
          $containers = docker ps -q --filter "ancestor=wiremock/wiremock:latest"
          foreach ($container in $containers) {
              docker stop $container
          }
          '''
        }
      }
    }
  }

  post {
    always {
      cleanWs()
    }
  }
}
