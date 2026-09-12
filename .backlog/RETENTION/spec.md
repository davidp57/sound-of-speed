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

**`PUT` sans `DELETE` : rien ne s'efface, rien ne tourne.** Une trace ratée, une
session avortée d'un kilo-octet, un dépôt de travers restent là pour toujours —
la base en porte six. Ce lot ouvre la suppression.

Et le stockage décide de la facture, pas le calcul. Une trace brute pèse ; le
profil mesuré qu'on en tire pèse quelques kilo-octets et ne grossit pas.

**Ce n'est pas le stockage qui presse, et il faut le dire.** Mesuré le
12 septembre 2026 : 0,87 Mio de trace par heure de conduite, soit environ
0,4 Gio par an à une heure par jour, sur un volume qui en a 2 512 de libres. Ce
lot ne se justifie pas par la place qu'il rend aujourd'hui, mais par l'archive
qu'il met chez l'utilisateur et par l'économie du jour où les comptes ne sont
plus un seul.

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

### Rien ne s'efface en silence

Ce qui va disparaître se voit avant de disparaître : combien de traces, quelle
date, ce qui est épinglé. Un effacement qui surprend est un effacement qu'on
regrette.

## Ce qu'on ne construit pas

- **Des quotas par compte.** Ils appartiennent à [COMPTES](../COMPTES/spec.md),
  qui porte les droits. Ici, une seule règle pour tout le monde.
- **Une analyse nouvelle.** Le profileur sait déjà ce qu'il cumule ; ce lot
  décide quand et où, pas quoi.
- **Le bouton « tout réinitialiser ».** Il appartient à
  [REMISE-A-ZERO](../REMISE-A-ZERO/spec.md), il remet les réglages de l'appareil
  à leurs valeurs d'usine, et il ne touche pas au serveur — c'est un choix,
  confirmé par David le 12 septembre 2026, et non une limite que ce lot lèverait.
  Une version de cette spec a affirmé le contraire ; elle avait tort.

## Critères d'acceptation

- [ ] Une trace arrivée est analysée et cumulée dans le profil mesuré sans
      intervention
- [ ] Une trace non épinglée disparaît passé le délai, et le délai est réglable
- [ ] Épingler exempte de l'effacement, dans une limite bornée et annoncée
- [ ] Télécharger rend un fichier que le relecteur rouvre depuis le disque
- [ ] Une trace s'efface à la demande, sans attendre le délai
- [ ] Ce qui va être effacé est montré avant de l'être
- [ ] Le profil mesuré ne grossit pas avec le nombre de trajets — mesuré
