# 03 — Rien ne doit nommer une banque restreinte

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le nom d'une banque voyage bien au-delà du son. Il est dans le profil, et un
profil se partage par lien et par code à scanner. Il est dans l'archive que le
compte emporte. Il peut finir dans une tranche de journal, dans une capture
d'écran, dans un rapport de défaut. Partout là, il arrive **sans son contexte**,
chez quelqu'un qui n'a pas la moitié de l'histoire. Fermer la porte du service
des échantillons (ticket 01) ne ferme aucun de ces chemins-là.

Après ce ticket, une banque restreinte est désignée par un identifiant opaque de
bout en bout : dossier, fichiers, champ du profil, étiquette à l'écran, clé de
cache, archive exportée, journal, base. La correspondance vers le vrai nom vit
sur le serveur, jamais dans le dépôt.

Les fichiers servis ne portent pas davantage d'étiquette interne : les formats
audio gardent le nom d'origine, le logiciel qui a produit le fichier, parfois le
fournisseur. Un réencodage fait à la main les remet sans que rien ne le montre —
d'où un contrôle automatique plutôt qu'une consigne.

**Renommer est le geste qui échappe aux tests** : un chemin changé casse l'image
ou un contrat sans qu'aucun test ne rougisse. La construction de l'image et le
jeu de requêtes d'accord font partie de la vérification, pas seulement la suite
de tests.

## Critères d'acceptation

- [ ] Un profil exporté, partagé par lien ou par code à scanner, ne porte aucun
      nom identifiable.
- [ ] L'archive emportée par un compte n'en porte pas davantage.
- [ ] Un contrôle automatique refuse tout fichier servi qui porte encore une
      étiquette interne.
- [ ] Le dépôt ne contient la correspondance nulle part.
- [ ] L'image se construit et l'application joue, cache hors réseau compris,
      après le renommage.
- [ ] Le relevé sur les banques libres dit explicitement que cette banque sert à
      l'essai local en attendant les moteurs de synthèse, et qu'elle n'est ni
      livrée ni servie à des tiers.
