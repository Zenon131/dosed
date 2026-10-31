# Use Node 20 as the base image
FROM node:20-slim

# Create and change to the app directory
WORKDIR /app

# Copy package files from the backend directory
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend source
COPY backend/ .

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
