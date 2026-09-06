# 03 — Déposer un profil dans la bibliothèque

**Statut :** 🚫 abandonné — repris par [REMONTEE](../../REMONTEE/spec.md)

**Bloqué par :** 01 — Le serveur accepte un dépôt, et lui seul

## Ce qu'il faut obtenir

Un profil réglé dans la voiture se dépose dans la bibliothèque partagée, que
l'application lit déjà. Il devient donc disponible sur les autres appareils sans
lien à transmettre ni fichier à manipuler.

Le besoin est moins pressant que pour les traces — le partage par lien et par
code existe déjà, et il ne télécharge rien — mais un profil déposé se retrouve
sans avoir à conserver une adresse.

Ce qui ne doit pas partir avec : le statut de favori, et le volume général si le
lot [VOLUME-GLOBAL](../../VOLUME-GLOBAL/spec.md) est passé avant. Les valeurs
d'origine, elles, suivent — comme dans un fichier exporté, où la taille
n'importe pas.

## Critères d'acceptation

- [ ] Un profil se dépose depuis l'écran de configuration
- [ ] Le profil déposé apparaît dans la bibliothèque sur un autre appareil
- [ ] Un profil déposé puis récupéré est identique à l'original, valeurs
      d'origine comprises
- [ ] Le statut de favori ne voyage pas
- [ ] Déposer un profil du même nom ne détruit pas le précédent en silence

## Repris ailleurs, le 6 septembre 2026

Ce ticket devient [REMONTEE 03 — Un profil réglé en voiture se retrouve sur les
autres appareils](../../REMONTEE/tickets/03-un-profil-se-retrouve-ailleurs.md).
Le besoin est le même ; ce qui change est qu'il ne se fait plus d'un geste mais
tout seul, par le même mécanisme que les traces et le journal.
