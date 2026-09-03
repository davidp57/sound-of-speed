# 02 — Le détail passe derrière un mode avancé

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

L'écran de configuration s'ouvre sur une vue courte. Les quarante-huit réglages
détaillés ne disparaissent pas : ils passent derrière une bascule « avancé »,
que l'on active quand on veut régler au détail.

Le choix de la bascule est une préférence de l'appareil, comme le volume : on ne
la redemande pas à chaque ouverture, et elle ne fait pas partie du profil.

Ce ticket est livrable seul et vaut par lui-même, avant même qu'un curseur global
existe : la colonne raccourcit tout de suite. Il ne règle pas le glissement qui
dérège un curseur — c'est [UI-DEFILEMENT](../../UI-DEFILEMENT/spec.md).

Aucun réglage n'est supprimé. Chacun a été ajouté pour une raison mesurée.

## Critères d'acceptation

- [x] La vue par défaut est courte, et le détail est atteignable en un geste
- [x] Tous les réglages restent accessibles en mode avancé, sans exception
- [x] Le choix du mode survit à un rechargement
- [x] Le choix du mode ne fait pas partie du profil et ne voyage pas
- [x] Les réglages du mode avancé restent groupés par section, comme aujourd'hui
