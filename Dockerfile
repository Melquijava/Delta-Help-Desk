FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

RUN npm --prefix backend ci
RUN npm --prefix frontend ci

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY --from=deps /app/backend/node_modules backend/node_modules
COPY --from=deps /app/frontend/node_modules frontend/node_modules
COPY . .

RUN npm --prefix backend run prisma:generate
RUN npm --prefix frontend run build
RUN npm --prefix backend run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/backend backend
COPY --from=build /app/frontend/dist frontend/dist
COPY package*.json ./

EXPOSE 3333

CMD ["npm", "start"]
