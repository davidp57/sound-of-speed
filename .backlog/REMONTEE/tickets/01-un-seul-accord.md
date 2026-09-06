# 01 — Un seul accord, qui dit tout ce qui part

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

L'accord réglé dans l'écran de configuration ne parle plus du seul journal : il
gouverne **tout** ce que l'application envoie d'elle-même. Ses trois positions
disent, en clair et avant que rien ne parte, ce que chacune ajoute.

| Position | Ce qui remonte tout seul |
|---|---|
| Rien n'est envoyé | rien, et le journal n'est même pas tenu |
| Le minimum | le journal, les relevés de mesure, les profils |
| Et la conduite | en plus : les traces enregistrées, et la position dans le journal |

Rien ne part encore de neuf à ce stade : le journal continue de partir comme
avant, et c'est voulu. Ce ticket pose la promesse et le vocabulaire ; les tickets
suivants s'y rangent sans avoir à la renégocier.

Les traces sont au troisième cran parce qu'une trace porte la conduite à la
cadence du GPS, là où le journal n'en garde qu'un relevé toutes les dix
secondes. Elle ne contient aucune coordonnée, mais une conduite complète et datée
en dit assez pour être annoncée.

Le geste manuel de dépôt d'une trace ne dépend pas de l'accord : il reste
disponible même à « rien n'est envoyé ». Ce qu'on fait soi-même n'a pas à être
autorisé d'avance.

## Critères d'acceptation

- [x] Les trois positions et ce qu'elles envoient sont écrites à l'écran, avant
      le choix
- [x] Passer à une position qui envoie demande une confirmation ; couper est
      immédiat
- [x] Le troisième cran ne se déduit jamais du second
- [x] L'accord est une préférence de l'appareil : il ne voyage ni par fichier, ni
      par lien, ni avec un profil
- [x] Le dépôt manuel d'une trace fonctionne à « rien n'est envoyé »
- [x] Le README dit ce que chaque position envoie, à jour de la table ci-dessus

## Fait, le 6 septembre 2026

Vérifié dans le navigateur : les trois positions s'affichent, la confirmation
dit ce que chacune envoie, et couper reste immédiat. La clé de rangement de
l'accord n'a pas changé — la renommer aurait remis à « rien n'est envoyé » un
accord déjà donné, et fait croire à une panne.
