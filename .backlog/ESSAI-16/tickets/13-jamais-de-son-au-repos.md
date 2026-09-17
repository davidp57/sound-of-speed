# 13 — Le son ne doit jamais repartir quand la boîte est au repos

**Statut :** ⬜ prêt — défaut net, règle donnée par David

David, après la sortie du 16 septembre 2026 :

> « Quand on change le profil (en mode P) le son reprend alors qu'on est encore
> en P. **On ne doit jamais allumer le son en mode P.** »

La seconde phrase est une règle, pas la description d'un cas : ce n'est pas
seulement le changement de profil qu'il faut corriger, c'est toute voie qui
rallume le son au repos.

## Ce qui est établi

Changer de profil déclenche le rechargement des échantillons quand la signature
des couches change — `sampleSignature` dans `src/state.ts`, qui appelle
`audio.load()`. Et **`load()` démarre les voix** : pour chaque couche, il crée un
gain, le met à zéro, puis appelle `startVoice()` avec une position de départ
tirée au sort (`core/audio/engine.ts`).

Les gains partent donc à zéro. Ce qui reste à établir est **qui leur redonne du
niveau alors que la boîte est au repos** : le mixage appliqué une fois après le
chargement, la reprise du contexte audio suspendu, ou un chemin qui ne consulte
pas l'état de marche.

Rien n'est conclu ici : c'est la première chose à mesurer, et elle se voit au
poste de travail sans rouler — passer au repos, changer de profil, regarder le
gain du bus.

## La règle à faire tenir

Au repos, aucune voie ne produit de son. Ni un changement de profil, ni un
changement de banque, ni un rechargement, ni la reprise d'un contexte suspendu.

Un test doit la tenir, sans quoi elle se reperdra au prochain chemin ajouté :
c'est le genre de défaut qui revient par une porte qu'on n'avait pas prévue.

## Critères d'acceptation

- [ ] Au repos, changer de profil ne produit aucun son — vérifié dans
      l'application, pas seulement au test.
- [ ] Même chose pour un changement de banque et pour un rechargement des
      couches.
- [ ] Un test tient la règle au niveau du mixage : au repos, le gain de sortie
      est nul quelle que soit la voie empruntée.
- [ ] Le son repart normalement dès qu'on remet en marche.
