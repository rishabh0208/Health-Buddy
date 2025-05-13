# 1. Use an official Node.js runtime as a base image
FROM node:20

# 2. Create app directory inside the container
WORKDIR /app

# 3. Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# 4. Install app dependencies
RUN npm install

# 5. Install faiss-node globally
RUN npm install -g faiss-node

# 6. Copy the rest of your project files
COPY . .

# 7. Expose the port your app uses (adjust if not 3000)
EXPOSE 3000

# 8. Start your app
CMD ["node", "index.js"]
