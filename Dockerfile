# Use Node.js LTS version
FROM node:20-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY index.mjs ./

# Expose port for health checks (Railway will set PORT env variable)
EXPOSE 3000

# Run the application
CMD ["node", "index.mjs"]

