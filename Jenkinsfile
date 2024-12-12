pipeline {
    agent any

    environment {
        // Define the WireMock port (can be set dynamically if needed)
        WIREMOCK_PORT = '8080'
        DOCKER_IMAGE = 'wiremock/wiremock:latest'
    }

    stages {
        stage('Checkout') {
            steps {
                // Checkout the Git repository
                checkout scm
            }
        }

        stage('Generate WireMock Mappings') {
            steps {
                script {
                    // Run the Node.js script to generate WireMock mappings
                    sh 'node wiremock/generate-mock.js'
                }
            }
        }

        stage('Build WireMock Docker Image') {
            steps {
                script {
                    // Build a custom WireMock Docker image (if using a custom Dockerfile)
                    docker.build('my-wiremock-image')
                }
            }
        }

        stage('Run WireMock Container') {
            steps {
                script {
                    // Start WireMock container using Docker
                    docker.run(
                        '-d -p 8080:8080 --name wiremock-container my-wiremock-image'
                    )
                }
            }
        }

        stage('Deploy Mocks') {
            steps {
                script {
                    // Optionally reset the WireMock mappings (e.g., using API calls or file removal)
                    // For simplicity, let's assume mappings are already in the container
                    echo 'Deploying mocks...'
                    // Additional steps like copying mappings to a specific folder can be added
                }
            }
        }

        stage('Test WireMock') {
            steps {
                script {
                    // Optionally, test the WireMock server to check if it's working
                    sh 'curl -X GET http://localhost:8080/mockEndpoint'
                }
            }
        }

        stage('Cleanup') {
            steps {
                script {
                    // Stop and remove the WireMock container after testing
                    sh 'docker stop wiremock-container && docker rm wiremock-container'
                }
            }
        }
    }
}
