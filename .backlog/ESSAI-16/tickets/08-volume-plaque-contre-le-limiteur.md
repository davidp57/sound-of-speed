# 08 — Le volume maximal est plaqué contre le limiteur

**Statut :** ⬜ prêt — mesurer avant de toucher quoi que ce soit

David : « le volume max n'est pas suffisant ; quand j'écoute un podcast mixé un
peu fort, j'entends à peine le moteur. On peut augmenter le pic du curseur de
50 % ? »

## Pourquoi allonger la course ne suffira pas

Le volume général porte sur l'**entrée** de la chaîne de sortie, donc **avant le
limiteur** (`output-chain.ts`, le commentaire du champ `input` le dit). Ce
limiteur est réglé dur : seuil à **−1,5 dBFS** dans le profil de David, rapport
**12:1**, puis un gain de rattrapage de 1,8 après lui.

Au-dessus du seuil, pousser l'entrée de +3,5 dB — les 50 % demandés — ne rend
que **+0,3 dB** en sortie. Il ne manque donc pas de course au curseur : il est
plaqué contre le limiteur. Monter son maximum donnerait au conducteur un
mouvement qui ne s'entend pas, ce qui est pire que pas de mouvement du tout.

## Ce qu'il faut mesurer d'abord

Ce qui donnerait vraiment plus fort est le gain **après** le limiteur —
`MAKEUP_GAIN`, aujourd'hui 1,8. Le monter au jugé n'est pas une option : à ce
niveau on entre dans l'écrêtage de la sortie, et le remède serait un son sale
plutôt qu'un son fort.

La chaîne est constructible dans un contexte hors ligne — c'est même la raison
d'être du module, qui a été sorti d'`engine.ts` pour cela. Donc, sans rouler :

1. Faire tourner la chaîne sur la banque de David, à volume 1, et relever le
   niveau de sortie réel — crête et niveau moyen.
2. Dire combien de décibels sont récupérables avant écrêtage.
3. Voir si le seuil du limiteur, qui est un réglage de profil, a plus à donner
   que le gain de rattrapage, qui est une constante partagée.

Alors seulement proposer, chiffres en main.

## Ce qu'il ne faut pas faire

Monter le maximum du curseur sans rien d'autre. C'est la demande littérale, et
elle ne produirait pas l'effet attendu.

## Critères d'acceptation

- [ ] Le niveau de sortie à volume maximal est mesuré, crête et moyenne.
- [ ] La marge disponible avant écrêtage est chiffrée.
- [ ] La proposition faite à David dit ce qu'on gagne en décibels, et ce qu'on
      risque de perdre en propreté.
- [ ] Écouté en roulant, par-dessus un podcast mixé fort — c'est le cas d'usage
      qui a déclenché le ticket.
