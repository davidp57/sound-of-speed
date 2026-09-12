# 02 — Ce qui part est compressé

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite — mais prend tout son sens
après le 01, la capture pesant dix fois le journal

## Ce qu'il faut obtenir

Tout ce que l'application dépose part compressé, et le compresseur est celui du
navigateur : aucune bibliothèque n'entre dans une application qui doit se
charger hors réseau.

Le gain se voit des deux côtés. Sur la 4G en roulant, où une tranche de capture
non compressée fait plusieurs centaines de kilo-octets à envoyer en couverture
incertaine. Sur le serveur, où trente-six minutes de journal occupent
aujourd'hui deux cent trente kilo-octets pour un contenu qui en vaut trente.

Le bouton « Tout récupérer » livre les fichiers **tels qu'ils sont sur le
serveur**, donc compressés : sa raison d'être est de sortir les fichiers d'une
voiture qui refuse les téléchargements, pas de les rendre lisibles à l'œil.

Un navigateur qui ne saurait pas compresser dépose en clair plutôt que de ne
rien déposer.

## Critères d'acceptation

- [x] Une tranche de journal déposée arrive compressée sur le serveur, et se
      décompresse avec un outil courant.
- [x] Une tranche de capture déposée arrive compressée.
- [x] Le nom du fichier dit qu'il est compressé.
- [x] Le gain mesuré sur une tranche réelle est écrit dans le CHANGELOG — un
      chiffre, pas un adjectif.
- [x] « Tout récupérer » rend un paquet contenant les fichiers tels quels.
- [x] Sur un navigateur sans compresseur natif, le dépôt se fait en clair et
      l'application ne s'arrête pas.
- [x] Les fichiers déjà déposés en clair restent en place et lisibles.

Critères établis le 12 septembre 2026 : des tests nomment le corps compressé qui se relit à l'identique, le suffixe du nom, le repli en clair là où le navigateur ne sait pas compresser, et la lecture des fichiers déjà déposés sans compression. Le gain mesuré est au CHANGELOG.
