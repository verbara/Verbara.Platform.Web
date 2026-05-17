FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_DEFAULT_TENANT_ID
ENV VITE_DEFAULT_TENANT_ID=$VITE_DEFAULT_TENANT_ID
# Copy .npmrc FIRST so legacy-peer-deps=true is honored during `npm ci`.
# The project's .npmrc enables that flag to accommodate eslint-plugin-jsx-a11y
# whose peer-dep matrix (eslint ^3..^9) hasn't caught up to the project's
# eslint 10 dev dep. Without copying .npmrc the build fails ERESOLVE.
COPY .npmrc package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
