FROM node:22 as development
WORKDIR /app/socket
COPY package*.json  .
RUN npm install
COPY . .
EXPOSE 3500

FROM node:22 as production
WORKDIR /app/socket
COPY package*.json  .
RUN npm install --only=production
COPY . .
EXPOSE 3500