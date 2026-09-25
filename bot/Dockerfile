FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY bot.mjs ./
CMD ["node", "bot.mjs"]
