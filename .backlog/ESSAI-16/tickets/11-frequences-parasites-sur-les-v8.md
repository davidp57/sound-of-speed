# 11 — Des fréquences parasites sur les deux V8, à moyen régime

**Statut :** ⬜ prêt — à corriger tranquillement, dit David

David, après avoir essayé trois banques lors de la sortie du 16 septembre 2026 :
« j'ai testé le V8 (GM), le V8-long (GM collecteur long) et le L4. Ils sonnent
bien, je trouve. Les deux V8 ont des fréquences parasites, surtout à moyen
régime — à corriger tranquillement à l'avenir. »

## Ce que l'observation dit déjà

Elle est précise sur deux points, et c'est ce qui la rend exploitable :

- **Les deux V8 et pas le L4.** Les trois banques sont **produites par
  engine-sim**, livrées par le commit `e63d4ab` le 14 septembre 2026. Ce ne sont
  donc pas des prises d'enregistrement, et le défaut ne peut pas venir d'un
  micro : il vient du moteur simulé, du rendu, ou du découpage en couches.
  `gm-ls` et `gm-ls-long-header` sont **le même bloc**, au collecteur près ;
  `subaru-ej25` est un quatre cylindres à plat. La cause est donc à chercher dans
  ce que ce V8 simulé a de particulier — sa définition dans la bibliothèque de
  moteurs, ou ce que le banc en tire.
- **À moyen régime.** C'est la zone de fondu entre couches. Sur le profil Route,
  le fondu va de 2 600 à 5 200 tr/min : au milieu, deux couches du même
  enregistrement jouent ensemble.

## Les pistes, dans l'ordre de ce qu'elles coûtent à vérifier

1. **Une raie du moteur simulé lui-même.** C'est la piste neuve, et la première
   à regarder : un V8 simulé porte des ordres d'allumage et des longueurs de
   conduits qui peuvent produire une résonance étroite. Le banc rend le spectre,
   et la bibliothèque de moteurs se relit — attention au motif partagé entre deux
   constructeurs de la même famille, qui a déjà fait modifier le mauvais moteur.
2. **Deux couches qui se renforcent en peigne.** Le projet connaît ce risque :
   chaque boucle démarre à une position tirée au sort pour l'éviter. Reste à
   vérifier que c'est bien le cas ici, et que le désaccord entre couches
   (`layerDetuneCents`) n'y produit pas un battement audible.
3. **Une raie propre à la boucle elle-même.** Une boucle courte crée une
   périodicité qui s'entend comme une fréquence. Le relevé de banque
   (`npm run banque`) donne les longueurs.
4. **Le raccord des boucles**, dont le saut d'énergie est mesuré au chargement.
   Un saut résiduel se répète à la période de la boucle.

## Comment l'instruire

Les deux banques sont sur le serveur et se téléchargent depuis le poste, et
surtout **elles se refabriquent** : le banc est dans le dépôt, la définition du
moteur aussi. On peut donc comparer ce que le moteur simulé produit, ce que le
banc en rend, et ce que la voiture joue — et savoir à quelle étape la raie
apparaît. La mesure se fait au bureau, sans rouler.

**Mais le verdict reste à l'oreille.** Sur un défaut sonore, ce que David entend
mène plus vite qu'un spectre : lui rendre le son découpé en bandes, ou un profil
importable, plutôt qu'un graphique.

## Critères d'acceptation

- [ ] La fréquence parasite est identifiée et chiffrée, pas décrite.
- [ ] On sait pourquoi elle touche les deux V8 et pas le L4.
- [ ] Le correctif est jugé à l'oreille par David, dans l'application.
