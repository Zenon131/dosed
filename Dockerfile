# Use Node 20 as the base image
FROM node:20-slim

# Build-time argument for private npm packages
ARG NPM_TOKEN

# Create and change to the app directory
WORKDIR /app

# Copy package files from the backend directory
COPY backend/package*.json ./

# Configure npm to use GitHub Packages for the @specific-dev scope
RUN echo "@specific-dev:registry=https://npm.pkg.github.com" > .npmrc &&     echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc &&     npm install --no-audit --no-fund &&     rm -f .npmrc

# Copy the rest of the backend source
COPY backend/ .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
