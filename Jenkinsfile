pipeline {
  agent any
  
  environment {
    DOCKER_IMAGE = 'wiremock/wiremock:latest'  // Docker image for WireMock
    MAPPING_DIR = 'mappings'  // Directory to store WireMock mappings
    MOCK_PORT = 9090
  }
  
  stages {
    stage('Clone Repo') {
      steps {
        // Clone the repository (done automatically by Jenkins, but for clarity)
        git 'https://github.com/apeiroconsultant/api-mock-repo.git
      }
    }

    stage('Install Dependencies') {
      steps {
        script {
          // Install WireMock npm dependencies
			cd wiremock && npm install
        }
      }
    }

    stage('Run WireMock to generate mocks') {
      steps {
        script {
          // Run npm script to generate mocks from the API spec
          cd wiremock && npm run start
        }
      }
    }

    stage('Start WireMock Docker Container') {
      steps {
        script {
                    // Use Windows-compatible commands if on Windows agent
                    def dockerCommand = """
                        docker run -d -p ${MOCK_PORT}:9090 ^
                        -v ${pwd()}/wiremock/mappings:/home/wiremock/mappings ^
                        -v ${pwd()}/wiremock/__files:/home/wiremock/__files ^
                        ${DOCKER_IMAGE}
                    """
                    echo "Running Docker command: ${dockerCommand}"
                    bat dockerCommand // Using `bat` for Windows shell commands
        }
      }
    }

    stage('Deploy Mock to Mapping Folder') {
      steps {
        script {
          // Place generated mock mappings into the mappings folder
          echo "Deploying mock mappings"
          bat 'copy wiremock\\mappings\\* C:\\temp\\mappings\\'
        }
      }
    }

    stage('Cleanup') {
      steps {
        script {
          // Stop WireMock Docker container after test completion
          bat 'docker ps -q --filter ancestor=wiremock/wiremock:latest | xargs docker stop'
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
