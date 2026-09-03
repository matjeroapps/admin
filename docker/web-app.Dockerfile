FROM node:24-alpine AS build

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /src
COPY package.json package-lock.json ./
COPY web/admin/package.json web/admin/package.json
RUN npm ci

COPY web ./web
COPY scripts ./scripts

ARG WORKSPACE=@commerce/admin-web
RUN npm run build --workspace ${WORKSPACE}

# Admin dashboard runtime.
FROM node:24-alpine AS admin

ENV NODE_ENV=production \
    PORT=5173 \
    HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=build --chown=node:node /src/web/admin/dist ./dist
COPY --from=build --chown=node:node /src/web/admin/server.js ./server.js

USER node

EXPOSE 5173

CMD ["node", "server.js"]
