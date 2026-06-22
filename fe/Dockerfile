FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies needed for building Next.js)
RUN npm ci

# Copy application files
COPY . .

# Build Next.js application
RUN npm run build

# Expose port
EXPOSE 3000

# Set environment defaults
ENV PORT=3000
ENV NODE_ENV=production

# Start Next.js server
CMD ["npm", "run", "start"]
