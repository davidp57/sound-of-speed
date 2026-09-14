# 01 — Un écran d'accueil, le compte en tête

**Statut :** ⬜ prêt

## Ce qu'il faut obtenir

Au premier lancement, un écran **court** s'ouvre à la place du manuel de onze
sections. Il dit trois choses : que l'application donne un son de moteur, que le
compte existe déjà, et comment démarrer. Puis il s'efface.

Le bouton `?` continue d'ouvrir l'aide de référence, inchangée pour l'instant —
c'est le ticket 05 qui la reprendra.

## Ce qu'on construit

Un composant `src/ui/WelcomeView.vue`, séparé de `HelpView.vue`. Dans l'ordre :

1. **Le titre et une phrase** sur ce que fait l'application.
2. **Le compte, en gros**, en premier après le titre :

   > Vous avez déjà un compte. Il s'est créé tout seul, et c'est lui qui portera
   > vos réglages, vos moteurs et vos trajets — il n'y a rien à saisir pour
   > rouler. Tant qu'il n'est pas enregistré, il ne tient qu'à ce navigateur.

   Un bouton mène à l'écran Compte, comme le fait déjà l'aide aujourd'hui
   (`allerAuCompteDepuisLAide`).
3. **Au volant**, la troisième phrase change : elle propose de se donner un code
   et d'ouvrir l'application sur un ordinateur. Même distinction que l'écran
   Compte, qui la tient sur `appareil === 'voiture'`.
4. **Les trois gestes pour rouler** — D, autoriser la localisation, P en
   arrivant. C'est ce que dit déjà « Pour commencer ».
5. **Un bouton « Commencer »**, et en pied, en petit, le lien du code source avec
   la version : l'AGPL-3.0 demande que la source soit offerte, et c'est le premier
   écran que voit quelqu'un qui se sert du programme à distance.

`App.vue` montre `WelcomeView` quand `speed.helpSeen.v1` est absent, et
`HelpView` sur le bouton `?`. La clé ne change pas de nom : elle tient toujours
le même « une seule fois ».

## Comment on vérifie

- Stockage vidé, l'application s'ouvre : l'accueil apparaît, le compte est le
  premier bloc lisible sans défiler.
- « Commencer » ferme, et un rechargement ne le remontre pas.
- Le bouton `?` ouvre l'aide de référence, pas l'accueil.
- Avec l'appareil déclaré « voiture », le bloc compte propose le code au lieu de
  l'enregistrement.
- Le lien du code source et la version sont présents sur les deux écrans.

## Ce qui est hors de ce ticket

Les bulles (02), le rendu des onglets (03), l'allègement de l'aide (05).
