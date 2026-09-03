# VOLUME-GLOBAL — le volume est une préférence d'appareil, pas un caractère

**Statut :** ✅ fait
**Branche :** `fix/volume-global`
**Version visée :** 0.3

## Le problème

Relevé à l'usage : « le volume global ne doit pas faire partie d'un profil —
c'est global ».

C'est juste, et le rangement actuel est fautif : `masterGain` vit dans la
section de mixage du profil. Trois conséquences, toutes désagréables.

- **Changer de profil change le volume.** On passe de Route à Sport en roulant
  et le niveau saute, alors qu'on voulait changer de voix.
- **Un profil partagé transporte le volume de celui qui l'a réglé.** Le lien de
  partage emporte déjà tout le mixage : le destinataire hérite d'un niveau réglé
  pour une autre voiture, d'autres haut-parleurs, une autre habitude.
- **Réinitialiser une section remet le volume**, ce qui n'a rien à voir avec le
  caractère qu'on voulait retrouver.

Le volume dépend de l'appareil et de la voiture : de la puissance de l'autoradio,
de la position du téléphone, du bruit de roulement. Rien de tout cela n'est un
attribut du moteur qu'on imite.

## La solution

Le volume général devient une **préférence de l'appareil**, rangée à côté du
profil choisi et du réglage de son en arrière-plan — dans le stockage local,
hors du profil. Il survit au changement de profil, ne voyage pas, et ne se
réinitialise pas avec une section.

Il reste sur l'écran de conduite, là où il est déjà, et à sa place : c'est le
seul réglage qu'on touche en roulant.

## La reprise des profils déjà enregistrés

Le champ existe dans tous les profils enregistrés, et l'un d'eux porte le niveau
que David a réellement réglé. Le perdre serait une régression même si le
rangement s'améliore.

La reprise : au premier chargement après la mise à jour, la préférence d'appareil
prend la valeur du profil **actif**, puis le champ cesse d'être lu. Le laisser
dans le schéma sans le lire est un mensonge à retardement ; mieux vaut le retirer
et monter `PROFILE_FORMAT_VERSION`, ce qui est exactement le cas d'usage prévu —
« si le format de profil change de forme ».

## Histoires

1. En tant que conducteur, je veux changer de profil sans que le niveau saute.
2. En tant qu'utilisateur, je ne veux pas imposer mon niveau à celui qui reçoit
   mon profil.
3. En tant que David, je ne veux pas perdre le niveau que j'ai réglé quand la
   mise à jour arrive.

## Décisions à prendre

- **Le relief part-il avec ?** Non : le relief de charge et celui du régime sont
  du caractère — un profil sportif exagère l'effort. Seul le niveau d'ensemble
  est une préférence. Le lot [RELIEF](../RELIEF/spec.md) le dit déjà : le point
  neutre est la croisière, précisément pour que le relief ne déplace pas le
  niveau moyen et reste indépendant du volume.
- **Et le seuil du limiteur, le coupe-bas, la saturation ?** Ils appartiennent au
  son, pas à l'appareil. Ils restent dans le profil.

## Hors périmètre

- Un volume par source de vitesse ou par profil « en plus » du global. Une seule
  notion, sinon on retombe dans la confusion qu'on corrige.
