# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p storage data

# Expose ports
EXPOSE 3000 21

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]