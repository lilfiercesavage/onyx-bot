FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache sqlite-dev build-base

COPY package*.json ./
RUN npm install --production

COPY . .

RUN npm run build || true

EXPOSE 3000

CMD ["node", "index.js"]