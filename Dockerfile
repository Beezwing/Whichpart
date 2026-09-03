# Builds and runs the NestJS API from the monorepo root so npm workspace
# dependencies (packages/shared) resolve correctly. Sits at the repo root
# so Railway auto-detects it with no config-as-code file needed — its
# railway.json build/deploy settings were silently ignored (Railpack kept
# being used regardless), so this doesn't rely on that file at all.
FROM node:20-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json

# apps/api's postinstall runs "prisma generate", which needs the schema
# file present -- that's why prisma/ is copied above, before install.
RUN npm install

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npx turbo run build --filter=api

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/package.json apps/api/package.json

EXPOSE 4000
# migrate deploy is safe to run on every boot -- no-op if nothing pending.
# Doing it here (not railway.json's preDeployCommand) since that file is
# not being read by this service at all.
CMD sh -c "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/src/main.js"
