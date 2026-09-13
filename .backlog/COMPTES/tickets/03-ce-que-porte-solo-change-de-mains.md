# 03 — Ce que porte `solo` devient celui du premier compte

**Statut :** ⬜ prêt

**Bloqué par :** [02 — Un compte se crée tout seul](02-un-compte-se-cree-tout-seul.md),
qui fait exister le compte qui héritera.

## Ce qu'il faut obtenir

Tout ce que la base porte appartient aujourd'hui à un compte écrit en dur,
`solo` : les profils, les moteurs, les boîtes, les dépôts, le profil mesuré. Le
premier vrai compte en hérite, une fois, et `solo` disparaît.

Sans ce ticket, ouvrir l'identité ferait apparaître une application vide devant
quelqu'un dont toutes les données sont là.

## Ce à quoi il faut faire attention

- **Rien ne se perd, et le décompte le prouve.** Avant et après : le même nombre
  de dépôts, les mêmes octets, le même profil mesuré. C'est ce qu'a fait la
  migration des dates de trajet, et c'est le seul contrôle qui vaille.
- **Le profil mesuré est un cumul** qui a coûté quarante et une tranches de
  trace. Le perdre obligerait à tout relire — ce qui marche, mais seulement tant
  que les traces sont encore là ; la rétention les effacera un jour.
- **Une seule fois.** Relancer le serveur ne doit pas rejouer l'héritage ni
  rattacher les données d'un second compte au premier.
- **Le compte unique est semé au démarrage** (`semerLeCompteUnique`) et
  `SOLO_ACCOUNT_ID` est lu par le serveur en plusieurs endroits. Ce ticket est
  celui qui retire cette constante, pas celui qui la contourne.
- **Qui hérite, s'il y a plusieurs appareils ?** Le premier qui se présente. Il
  faut le dire, et il faut que le second ne reparte pas de rien sans le savoir.

## Critères d'acceptation

- [ ] Le premier compte réel porte les profils, moteurs, boîtes, dépôts et le
      profil mesuré qui étaient à `solo`
- [ ] Décompte avant et après : mêmes dépôts, mêmes octets, même profil mesuré
- [ ] Relancer le serveur ne rejoue rien
- [ ] `SOLO_ACCOUNT_ID` n'est plus lu nulle part
- [ ] Le cas du second appareil est décidé et écrit
