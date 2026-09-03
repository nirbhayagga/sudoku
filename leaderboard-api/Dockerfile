FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# node, not root: data/ is chowned here so a fresh named volume inherits it.
# A volume created by an older root image needs a one-time:
#   docker compose exec -u root leaderboard chown -R node:node /app/data
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "server.js"]
