# 08 — Le poids chargé par la voiture, mesuré avant et après

**Statut :** ⬜ prêt

**Bloqué par :** [06 — Les droits ouvrent les écrans](06-les-droits-ouvrent-les-ecrans.md),
qui décide de ce qui s'affiche et donc de ce qui peut ne pas se charger.

## Ce qu'il faut obtenir

Une seule application qui porte les trois usages fait télécharger à la voiture du
code qu'elle n'utilisera pas. Le chargement à la demande ramène ce coût près de
zéro — **au prix d'un découpage, et il doit être mesuré, pas supposé.**

Le chiffre avant, le chiffre après, et ce qu'on en conclut.

## Ce à quoi il faut faire attention

- **La mesure est le livrable.** Un découpage qui fait gagner trois kilo-octets
  ne vaut pas la complexité qu'il ajoute ; on ne le saura qu'en regardant. Le
  premier relevé se prend au ticket 01, avant que la bibliothèque soit là.
- **Ce qui compte est ce que la voiture tire au démarrage**, pas le poids total
  du paquet. Un écran de banc qui ne se charge jamais ne coûte rien, même gros.
- **L'application doit se charger hors réseau**, donc le service worker doit
  savoir ce qu'il met en cache. Un morceau chargé à la demande qu'il n'a pas
  gardé est un écran qui manque dans un tunnel.
- **Le relecteur a déjà son propre paquet**, tiré seulement quand on ouvre son
  adresse. C'est le motif à suivre, et le point de comparaison le plus proche.
- **Ne pas découper pour découper.** Si la mesure dit que le gain est
  négligeable, l'écrire et s'arrêter là est une conclusion valable — et c'est
  celle qu'il faudra assumer.

## Critères d'acceptation

- [ ] Le poids tiré au démarrage par la voiture est mesuré avant le découpage
- [ ] Il est mesuré après, dans les mêmes conditions
- [ ] L'écart est écrit, et la conclusion — découper ou non — est argumentée
- [ ] Hors réseau, tous les écrans qu'un compte ouvre restent accessibles
- [ ] Aucun écran ne se charge pour un compte qui n'y a pas droit
