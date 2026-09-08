# Image publiée sur le registre de conteneurs GitHub par le workflow
# .github/workflows/docker.yml.
#
# `--platform=$BUILDPLATFORM` sur l'étape de construction n'est pas un détail :
# sans lui, produire une image pour un NAS à processeur ARM ferait tourner npm
# sous émulation, pour de longues minutes. Avec lui, la construction se fait
# nativement sur le runner, et seule l'image finale — qui ne fait que servir des
# fichiers — est bâtie pour l'architecture visée.
#
# Les échantillons restent dehors, montés en volume : ils ne sont pas dans le
# dépôt, et une image qui les contiendrait se redistribuerait avec eux.

FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app

# Les dépendances d'abord : cette couche n'est reconstruite que lorsque les
# versions changent, pas à chaque modification du code.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Les écrans de banc — simulateur de vitesse et réglage de la synthèse — ne sont
# dans l'image que si on le demande. Le workflow ne le demande que pour
# l'étiquette `develop` : c'est la pile d'essai qui sert à régler dans la
# voiture, pas celle qui roule au quotidien.
ARG BENCH=""
RUN BENCH=$BENCH npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/index.html || exit 1
