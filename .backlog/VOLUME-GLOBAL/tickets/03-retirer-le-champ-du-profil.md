# 03 — Retirer le champ du profil

**Statut :** ✅ fait

**Bloqué par :** 01 — Le volume devient une préférence de l'appareil ; 02 — Le
volume ne voyage plus avec un profil

## Ce qu'il faut obtenir

Le champ de volume quitte le schéma de profil, les profils livrés, le guide de
création et la référence des réglages. Plus rien ne le lit depuis le 01, plus
rien ne l'écrit depuis le 02 : le laisser en place serait un mensonge à
retardement pour qui lirait le schéma.

C'est la dernière étape d'une séquence en trois temps : ajouter à côté, faire
basculer les usages, puis retirer. Aucune version intermédiaire ne perd le
réglage de l'utilisateur.

La forme du profil change, donc la version de format monte, et les profils
enregistrés se reprennent — c'est exactement le cas prévu par la règle du dépôt.

## Critères d'acceptation

- [x] Le champ a disparu du schéma, des profils livrés et du guide de création
- [x] La référence des réglages du README ne le mentionne plus dans le mixage
- [x] La version de format de profil a monté
- [x] Un profil enregistré par la version précédente se relit sans perdre autre
      chose que ce champ
- [x] Un fichier de profil exporté par la version précédente s'importe encore
