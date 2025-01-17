# Use WireMock's official Docker image
FROM wiremock/wiremock:latest

# Copy mappings and files from the project
COPY ./wiremock/mappings /home/wiremock/mappings

# Expose the default WireMock port
EXPOSE 9090
