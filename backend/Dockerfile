FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "src/index.js"]
