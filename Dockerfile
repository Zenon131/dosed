# Use Node 20 as the base image
FROM node:20-slim

# Build-time argument for private npm packages
ARG NPM_TOKEN

# Create and change to the app directory
WORKDIR /app

# Copy package files from the backend directory
COPY backend/package*.json ./

# Set the token as an environment variable for the install step
ENV NPM_TOKEN=$NPM_TOKEN

# Use a simpler shell command to create .npmrc and install
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc &&     npm install --no-audit --no-fund &&     rm -f .npmrc

# Copy the rest of the backend source
COPY backend/ .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
