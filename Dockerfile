# Image autonome, pour le jour où le déploiement doit se faire d'un seul geste.
#
# Elle n'est pas nécessaire au départ : la pile de `docker/docker-compose.yml`
# obtient le même résultat sans rien construire. Elle le devient si le projet
# part sur un dépôt distant avec une construction automatique, ou s'il faut
# pouvoir revenir à une version précise sans retrouver le build correspondant.
#
# Les échantillons restent volontairement dehors : ils se montent en volume sur
# /usr/share/nginx/html/audio. Une image qui les contiendrait pèserait dix fois
# plus, et se redistribuerait avec eux.

FROM node:22-alpine AS build
WORKDIR /app

# Les dépendances d'abord : cette couche ne se reconstruit que lorsque les
# versions changent, pas à chaque modification du code.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/index.html || exit 1
