# ── Build stage ───────────────────────────────────────────────────────
# Produces dist/ with minified, content-hashed assets.
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Everything not excluded by .dockerignore. Listing sources individually meant
# every new module silently 404'd in the container until someone remembered to
# add it here.
COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Resolved at container start by the image's envsubst entrypoint.
#   NGINX_RESOLVER      DNS server for the leaderboard lookup.
#                       127.0.0.11 is Docker's embedded DNS; podman users
#                       typically need their network's DNS instead.
#   LEADERBOARD_UPSTREAM  Where /api/ is proxied. Point it at an external host
#                       to serve the frontend separately from the API.
ENV NGINX_RESOLVER=127.0.0.11
ENV LEADERBOARD_UPSTREAM=http://leaderboard:3001

# Whole build output, so adding a frontend file never needs a Dockerfile change.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -q --spider http://127.0.0.1/ || exit 1
