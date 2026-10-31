# Use Node 20 as the base image
FROM node:20-slim

# Build-time argument for private npm packages
ARG NPM_TOKEN

# Create and change to the app directory
WORKDIR /app

# Copy package files from the backend directory
COPY backend/package*.json ./

# Configure npm to use the NPM_TOKEN for private packages
# We create a temporary .npmrc file and then delete it after install
RUN if [ -n "$NPM_TOKEN" ]; then       echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc;     fi &&     npm install &&     rm -f .npmrc

# Copy the rest of the backend source
COPY backend/ .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
