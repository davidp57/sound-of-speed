# 06 — Les ajustements du conducteur deviennent une couche

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le conducteur ne crée plus de profil : il choisit parmi ce qu'on lui a livré et
bouge trois curseurs — calme ↔ sportif, pépère ↔ nerveux, nombre de rapports.
Ces ajustements ne doivent ni écraser le profil livré, ni disparaître le jour où
l'atelier en dépose une version corrigée.

Ils se rangent donc **à côté** du profil, comme l'étalonnage : le profil reste
intact, et la couche se réapplique par-dessus la version qui arrive.

La couche pèse trois nombres, pas trente : le tempérament et la réactivité ne
sont pas enregistrés dans un profil, ils s'en déduisent. C'est ce qui rend cette
forme possible — et c'est à vérifier avant d'écrire, pas à supposer.

« Revenir aux réglages d'avant » devient « enlever la couche ».

## Critères d'acceptation

- [x] Bouger un curseur global ne modifie pas le profil livré
- [x] Une version corrigée du même profil déposée depuis l'atelier arrive avec
      l'ajustement du conducteur conservé
- [x] Enlever la couche rend le profil livré tel quel
- [ ] ~~La couche voyage avec le compte~~ — **non fait**, voir ci-dessous
- [x] Un profil partagé par lien n'emporte pas la couche de celui qui le donne
- [x] Le comportement est couvert par des tests du cœur

## Ce qui a été fait, et mesuré

La couche vit dans `core/preset/reglage-conducteur.ts`, pure et couverte par
quatorze tests. Elle se compose **en premier** dans le profil de fonctionnement,
avant les deux étalonnages : une préférence ne doit pas écraser une mesure.

Vérifié dans le navigateur, et par le test qui tranche — effacer la couche et
recharger : le curseur retombe de 80 à 23, la position que porte le profil
livré. Le profil enregistré n'a pas bougé.

À l'intérieur, l'ordre compte : le nombre de rapports s'applique avant le
tempérament, parce qu'il redimensionne les tables indexées par rapport. L'inverse
réglerait des cases qu'il redistribuerait ensuite.

## Le critère non tenu : la couche ne voyage pas avec le compte

Elle est rangée dans le stockage local, sous `speed.reglageConducteur.v1`, comme
le volume et l'affichage de la conduite. Relier un second appareil au même compte
n'emporte donc pas les ajustements.

Ce n'est pas un oubli mais une question que le ticket tranchait trop vite, et qui
mérite d'être posée : **un ajustement est-il une préférence d'appareil ou une
donnée de compte ?** Les arguments des deux côtés sont réels — on veut retrouver
son tempérament en changeant de téléphone, mais le volume et l'affichage ont
quitté le profil précisément parce qu'ils dépendent de l'appareil où l'on écoute.

Le rendre synchronisable demande de le faire passer par le serveur, ce qui est le
sujet du premier volet d'[ATELIER](../../ATELIER/spec.md). À instruire là, pas
ici.

## Un bug de ma main, pour mémoire

`CLE_REGLAGES` était déclaré **sous** la fonction qui l'emploie : la zone morte
temporelle levait une `ReferenceError` que le `catch` prévu pour « stockage
fermé » avalait en silence. La couche revenait vide à chaque chargement, sans
rien dans la console. Le `catch` a été resserré sur ce qu'il doit couvrir, et la
constante remontée.
