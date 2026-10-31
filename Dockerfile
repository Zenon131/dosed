# Use Node 20 as the base image
FROM node:20-slim

# Build-time argument for private npm packages
ARG NPM_TOKEN

# Create and change to the app directory
WORKDIR /app

# Copy package files from the backend directory
COPY backend/package*.json ./

# Use a simpler way to create .npmrc:
# We avoid the variable expansion in the echo and let the shell handle it.
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc &&     npm install --no-audit --no-fund &&     rm -f .npmrc

# Copy the rest of the backend source
COPY backend/ .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
