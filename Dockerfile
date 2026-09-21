# Nuxt 4 needs Node >= 22.19 (rolldown's native binding is skipped by npm on older
# 22.x releases, which breaks `nuxt prepare`) — node:22-slim tracks the latest 22.x.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build /app/.output ./.output
# Elevation-tile cache (server/utils/dem.ts) lives in ./.cache/tiles by default.
RUN mkdir -p .cache && chown -R node:node .cache
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
