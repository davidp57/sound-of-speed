# 04 — Le relevé de la sonde arrive sur le NAS

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

La sonde dépose son relevé sur le NAS, d'un bouton, à côté de celui qui le
copie. Le relevé se retrouve ensuite depuis le poste de travail.

C'est le besoin d'origine du lot, et il bloque une décision : le verdict de
[SYNTHESE](../../SYNTHESE/tickets/01-la-sonde.md) attend le chiffre relevé dans
la Tesla, et ce chiffre n'a aujourd'hui aucun moyen d'en sortir. La page propose
de le copier — un geste qui ne mène nulle part dans une voiture, où rien ne se
colle ailleurs.

La sonde reste **autonome** : pas d'intégration à l'application, pas de
construction, pas de dépendance. Elle est servie par le même serveur, donc elle
lit le compte de dépôt là où l'application l'a rangé, et elle n'a rien à
demander.

Ce qui est déposé porte à la fois les chiffres et leur contexte — navigateur,
matériel annoncé, date, verdict. Un chiffre sans son contexte ne se relit pas
trois semaines plus tard, et le relevé du poste de David n'a pas la même valeur
que celui de la voiture.

Le bouton de copie reste : sur un poste, il est plus court.

## Critères d'acceptation

- [ ] La sonde dépose son relevé d'un bouton, sans quitter la page
- [ ] Le fichier déposé porte les mesures, l'environnement, la date et le verdict
- [ ] Le nom du fichier dit quand et où le relevé a été pris
- [ ] Le compte de dépôt est celui déjà saisi dans l'application, sans nouvelle
      saisie
- [ ] Un compte absent, un refus et un réseau injoignable donnent trois messages
      distincts
- [ ] Un relevé pris avec le bouchon est marqué comme tel dans le fichier
- [ ] Le bouton de copie fonctionne comme avant
