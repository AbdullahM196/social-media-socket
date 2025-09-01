FROM node:22-alpine AS development
WORKDIR /app/socket
COPY package*.json  .
RUN npm install
COPY . .
EXPOSE 3500

FROM node:22-alpine AS production
WORKDIR /app/socket
COPY package*.json  .
RUN npm install --only=production
COPY . .
ENV PORT=3500
EXPOSE $PORT
CMD ["node", "src/index.js"]