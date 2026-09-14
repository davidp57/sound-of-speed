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

# Une seule image pour les trois usages, depuis le 13 septembre 2026 : ce sont
# l'appareil et les rôles du compte qui décident des écrans, et non la
# construction.
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Les banques livrées sortent de `audio/`, et c'est ce qui les sauve.
#
# Le volume des échantillons se monte **sur** `/usr/share/nginx/html/audio` : il
# masque tout ce que l'image a mis là-dessous. Une banque rangée dans `audio/`
# serait donc invisible dès que la pile tourne avec son volume, c'est-à-dire
# toujours. On les déplace hors de portée du montage ; nginx les ramène sous
# `/audio/<banque>/` par un alias, un par banque.
#
# Le dossier entier déménage, et non les trois par leur nom : l'image est
# construite depuis un clone, où `dist/audio` ne contient que ce que le dépôt
# versionne — les banques produites au banc, jamais une banque enregistrée, et
# c'est le `.gitignore` qui le tient.
#
# Sur un poste de développement, `public/audio` contient en plus les banques
# déposées à la main, qui se retrouveraient ici. Elles n'en sortiraient pas pour
# autant : nginx ne ramène sous `/audio/` que les banques qu'il nomme, un bloc
# par banque, et une banque inconnue de sa liste reste invisible.
RUN mv /usr/share/nginx/html/audio /usr/share/nginx/html/_banques

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/index.html || exit 1
