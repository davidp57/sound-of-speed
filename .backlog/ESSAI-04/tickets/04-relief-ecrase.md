# 04 — l'effort s'entend en sortie, pas seulement dans le mixage

**Statut :** 🔄 en cours

**Bloqué par :** 01 — la charge doit être stable avant qu'on mesure le niveau ;
et l'essai de l'ancrage du ticket 05, qui déplace le spectre entrant dans la
chaîne

## Ce qu'il faut obtenir

Le relief de charge et de régime livré le 3 septembre s'entend réellement. Le
mixage produit aujourd'hui 3,9 dB d'écart entre croisière et accélération
franche ; l'estimation analytique dit qu'il en reste 0,3 dB après la chaîne de
sortie, le limiteur travaillant à un seuil de −1,5 dB avec un rapport de 12
pour 1, très au-dessus duquel les deux niveaux se situent.

**La mesure d'abord.** Un banc reconstruit la chaîne de sortie à l'identique
dans un contexte audio hors ligne — qui calcule un tampon et ne fait sortir
aucun son — et relève le niveau conservé pour une série de gains d'entrée et de
volumes généraux, saturateur en service puis court-circuité, afin de savoir
lequel des deux écrase. Aucun réglage ne bouge avant ce chiffre.

La piste tenue pour la correction, si la mesure confirme : ramener le niveau
nominal sous le seuil du limiteur, pour qu'il ne travaille que sur les crêtes au
lieu de compresser en permanence. Le gain de rattrapage fixe placé après lui
remonte le tout sans rendre la dynamique.

## Critères d'acceptation

- [ ] Le banc de mesure existe, ne fait sortir aucun son, et son protocole est
      écrit — signal employé, valeurs relevées et leur provenance.
- [ ] L'écart conservé en sortie est chiffré avant et après correction.
- [ ] La part du saturateur et celle du limiteur sont mesurées séparément.
- [ ] Après correction, l'écart entre croisière et accélération franche
      s'entend, et le niveau de sortie ne sature pas.
- [ ] Le README dit ce que la chaîne de sortie fait au niveau.
