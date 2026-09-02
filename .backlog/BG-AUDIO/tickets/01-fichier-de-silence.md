# 01 — Un fichier de silence réel, servi et long

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

L'application sert un fichier de silence de deux minutes, en MP3 mono à
8 kbit/s, disponible aussi hors réseau. Il remplace le WAV de quatre secondes
fabriqué en mémoire et porté par une adresse `blob:`.

Il vit dans `public/`, et non dans `public/audio/` : cette arborescence n'est pas
versionnée, c'est celle des échantillons, qui sont déposés dans un volume du
NAS. Le silence appartient à l'application — il doit être dans l'image Docker et
dans le cache du service worker.

Le script qui le produit est versionné avec lui : un fichier binaire dont on ne
sait pas comment il a été fabriqué est un fichier qu'on n'osera pas refaire.

## Critères d'acceptation

- [x] Un script du dépôt produit le fichier avec `ffmpeg`, en une commande
- [x] Le fichier pèse moins de 200 Ko et dure au moins deux minutes
- [x] Il est servi à une adresse fixe, hors de `public/audio/`
- [x] Il est dans la liste de précache du service worker, et la version du cache
      est montée pour que les installations existantes le récupèrent
- [x] `npm run build` l'emporte dans `dist/`
