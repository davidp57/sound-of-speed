# RETENTION — analyser puis oublier, sauf ce qu'on épingle

**Statut :** ⬜ prêt
**Branche :** `feature/retention`
**Version visée :** 0.4
**Dérivé de :** [PLATEFORME](../PLATEFORME/spec.md)
**Bloqué par :** [MIGRER](../MIGRER/spec.md) — effacer est le seul geste
irréversible de ce chantier, il vient après que tout est rapatrié et vérifié.

## Ce qu'il faut obtenir

Le serveur garde ce que les trajets **montrent**, pas les trajets. Une trace
analysée ne sert plus qu'au relecteur ; passé un délai, elle disparaît, sauf si
on l'a épinglée ou emportée.

## Le problème

**`PUT` sans `DELETE` : rien ne s'efface, rien ne tourne.** C'est pourquoi le
bouton « tout réinitialiser » de [REMISE-A-ZERO](../REMISE-A-ZERO/spec.md) est
spécifié « sans toucher au serveur » — pas par choix, par impossibilité. Ce lot
lève cette limite.

Et le stockage décide de la facture, pas le calcul. Une trace brute pèse ; le
profil mesuré qu'on en tire pèse quelques kilo-octets et ne grossit pas.

## Ce qu'on construit

### À l'arrivée : analyser, cumuler, puis laisser mourir

Le serveur analyse la trace dès qu'elle arrive et cumule le résultat dans le
profil mesuré du compte. La trace brute reste consultable un temps borné, puis
disparaît.

### Deux portes de sortie, et elles sont explicites

- **Épingler** une trace l'exempte de l'effacement, en nombre borné par compte.
  Le nombre est une valeur de configuration, pas une constante cachée.
- **Télécharger** une trace la sort en fichier, et le relecteur sait la relire
  **depuis le disque**. L'archive longue est chez l'utilisateur, pas sur le
  serveur — c'est ce qui rend l'effacement acceptable.

La seconde porte est la condition de la première : tant que le relecteur ne sait
pas ouvrir un fichier local, effacer revient à perdre.

### Effacer devient possible partout

[REMISE-A-ZERO](../REMISE-A-ZERO/spec.md) retrouve son périmètre entier : le
bouton efface aussi ce qui est sur le serveur. Sa limite « sans toucher au
serveur » est retirée de sa spec dans le même mouvement.

### Rien ne s'efface en silence

Ce qui va disparaître se voit avant de disparaître : combien de traces, quelle
date, ce qui est épinglé. Un effacement qui surprend est un effacement qu'on
regrette.

## Ce qu'on ne construit pas

- **Des quotas par compte.** Ils appartiennent à [COMPTES](../COMPTES/spec.md),
  qui porte les droits. Ici, une seule règle pour tout le monde.
- **Une analyse nouvelle.** Le profileur sait déjà ce qu'il cumule ; ce lot
  décide quand et où, pas quoi.

## Critères d'acceptation

- [ ] Une trace arrivée est analysée et cumulée dans le profil mesuré sans
      intervention
- [ ] Une trace non épinglée disparaît passé le délai, et le délai est réglable
- [ ] Épingler exempte de l'effacement, dans une limite bornée et annoncée
- [ ] Télécharger rend un fichier que le relecteur rouvre depuis le disque
- [ ] Le bouton « tout réinitialiser » efface aussi ce qui est sur le serveur,
      et la limite est retirée de la spec de REMISE-A-ZERO
- [ ] Ce qui va être effacé est montré avant de l'être
- [ ] Le profil mesuré ne grossit pas avec le nombre de trajets — mesuré
