# Use Node 20 as the base image
FROM node:20-slim

# Build-time argument for private npm packages
ARG NPM_TOKEN

# Create and change to the app directory
WORKDIR /app

# Copy package files from the backend directory
COPY backend/package*.json ./

# Set the authentication token as an environment variable that npm recognizes
ENV NPM_CONFIG_AUTH=$NPM_TOKEN

# Install dependencies
RUN npm install --no-audit --no-fund

# Copy the rest of the backend source
COPY backend/ .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
