# 08 — La rotation fait de la place, et le refus dit ce qui bloque

**Statut :** ✅ fait — vérifié contre un serveur qui tourne : sur un plafond de 1 Mio, le trajet de juillet est parti et les deux récents sont restés ; tous épinglés, le dépôt suivant a pris un 507 « tout est épinglé »

**Bloqué par :** 07 — le serveur dit la place sur chaque dépôt

## Ce qu'il faut obtenir

Au-delà de **95 %**, le serveur accepte quand même le dépôt, puis fait le ménage :
les trajets les plus anciens partent jusqu'à repasser sous le seuil. La voiture ne
perd jamais ce qu'elle vient d'enregistrer, et le dépassement des 100 % est
temporaire, borné par la taille d'une tranche.

C'est le motif déjà en place dans le serveur : la reprise du profil mesuré court
après un dépôt de trace, et son échec ne fait pas échouer le dépôt.

`Speed-Place` gagne son troisième état, `rotation`.

### Ce qui part, et ce qui ne part pas

**Seule l'épingle protège.** Elle veut dire « ce trajet, je le garde », et c'est
la seule chose qu'on ne peut pas prendre à quelqu'un pour faire de la place. Les
dépôts repris de l'ancien serveur de fichiers retiennent la rétention, qui juge
sur l'âge, mais **pas** la rotation, qui manque de place — tranché le 15 septembre
2026.

**La rotation n'est pas la rétention** : celle-ci juge sur l'âge et ne libère rien
quand tout est récent, ce qui est le cas d'une voiture qui roule beaucoup. Mais
**ce qui est protégé reste défini à un seul endroit** : la rotation lit la notion
d'exemption du cœur plutôt que d'en écrire une seconde.

### Quand il ne reste que des épingles

Le dépôt est refusé, comme aujourd'hui, en **507** — le code que le client ne
rejoue pas et qui lui fait garder sa tranche. Ce qui change est le message : il
dit de **décrocher une épingle**, et non plus d'effacer des trajets, parce que
effacer est justement ce qu'on vient de ne pas pouvoir faire.

## Critères d'acceptation

- [x] Au-delà de 95 %, le dépôt est accepté **puis** la place est faite, dans cet
      ordre — vérifié par un dépôt qui passe alors que le compte était plein.
- [x] Les trajets partent du plus ancien au plus récent, jusqu'à repasser sous le
      seuil, et pas au-delà.
- [x] Un trajet épinglé ne part jamais, à aucun seuil.
- [x] Un trajet repris de l'ancien serveur peut partir : seule l'épingle protège.
- [x] `Speed-Place` vaut `rotation` quand le ménage est armé.
- [x] Un compte qui n'a plus que des épingles reçoit 507, avec un message qui dit
      de décrocher.
- [x] Le ménage qui échoue ne fait pas échouer le dépôt.
- [x] La rotation ne réécrit pas la notion de ce qui est protégé : elle lit celle
      du cœur.
- [x] Contrôle qualité vert.
