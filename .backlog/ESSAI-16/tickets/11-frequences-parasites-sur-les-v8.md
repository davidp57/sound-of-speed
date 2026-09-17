# 11 — Des fréquences parasites sur les deux V8, à moyen régime

**Statut :** ⬜ prêt — à corriger tranquillement, dit David

David, après avoir essayé trois banques lors de la sortie du 16 septembre 2026 :
« j'ai testé le V8 (GM), le V8-long (GM collecteur long) et le L4. Ils sonnent
bien, je trouve. Les deux V8 ont des fréquences parasites, surtout à moyen
régime — à corriger tranquillement à l'avenir. »

## Ce que l'observation dit déjà

Elle est précise sur deux points, et c'est ce qui la rend exploitable :

- **Les deux V8 et pas le L4.** `gm-ls` et `gm-ls-long-header` partagent leur
  origine ; `subaru-ej25` non. La cause est donc à chercher dans ce que les deux
  V8 ont en commun et que le L4 n'a pas — la prise d'origine, le découpage en
  couches, ou des réglages de mixage qui leur sont propres.
- **À moyen régime.** C'est la zone de fondu entre couches. Sur le profil Route,
  le fondu va de 2 600 à 5 200 tr/min : au milieu, deux couches du même
  enregistrement jouent ensemble.

## Les pistes, dans l'ordre de ce qu'elles coûtent à vérifier

1. **Deux couches du même enregistrement qui se renforcent en peigne.** Le
   projet connaît ce risque : chaque boucle démarre à une position tirée au sort
   pour l'éviter. Reste à vérifier que c'est bien le cas pour ces deux banques,
   et que le désaccord entre couches (`layerDetuneCents`) n'y produit pas un
   battement audible.
2. **Une raie propre à la boucle elle-même.** Une boucle courte crée une
   périodicité qui s'entend comme une fréquence. Le relevé de banque
   (`npm run banque`) donne les longueurs.
3. **Le raccord des boucles**, dont le saut d'énergie est mesuré au chargement.
   Un saut résiduel se répète à la période de la boucle.

## Comment l'instruire

Les deux banques sont sur le serveur et se téléchargent depuis le poste. La
mesure se fait donc au bureau, sans rouler : analyse spectrale des couches
concernées, puis du mélange à un régime moyen tenu.

**Mais le verdict reste à l'oreille.** Sur un défaut sonore, ce que David entend
mène plus vite qu'un spectre : lui rendre le son découpé en bandes, ou un profil
importable, plutôt qu'un graphique.

## Critères d'acceptation

- [ ] La fréquence parasite est identifiée et chiffrée, pas décrite.
- [ ] On sait pourquoi elle touche les deux V8 et pas le L4.
- [ ] Le correctif est jugé à l'oreille par David, dans l'application.
