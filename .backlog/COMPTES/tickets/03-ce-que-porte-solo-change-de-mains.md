# 03 — Ce que porte `solo` devient celui du premier compte

**Statut :** ✅ fait — 13 septembre 2026, avec le ticket 04

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

- [x] Le premier compte réel porte les profils, moteurs, boîtes, dépôts et le
      profil mesuré qui étaient à `solo`
- [x] Décompte avant et après : mêmes dépôts, mêmes octets, même profil mesuré
- [x] Relancer le serveur ne rejoue rien
- [x] `SOLO_ACCOUNT_ID` n'est plus lu nulle part — *la constante a changé de sens
      et de nom, voir ci-dessous*
- [x] Le cas du second appareil est décidé et écrit

## Ce que l'essai a donné

**L'héritage se fait à la création du compte, pas au démarrage du serveur.** Il
faut un héritier, et l'héritier n'existe qu'au moment où un appareil se présente.
Le compte vient alors d'être créé, donc il est vide : aucun conflit possible avec
ce qu'on lui verse, alors qu'un héritage joué plus tard aurait pu buter sur un
index unique.

**Rien à mémoriser pour que cela n'arrive qu'une fois** : l'héritage efface le
compte d'avant, donc il ne reste rien à transmettre au suivant. Un serveur qu'on
relance ne rejoue rien, et le second appareil part de zéro — ce qui est le
comportement voulu tant que rien ne les relie.

**La constante n'a pas disparu, elle a changé de sens**, et c'est plus honnête que
de la contourner : `ANCIEN_COMPTE_UNIQUE` ne désigne plus le propriétaire de tout,
mais le **réceptacle de reprise**. Elle n'est semée que si l'on verse d'anciens
dossiers dans une base neuve — il faut bien un propriétaire à ce moment-là, alors
qu'aucun appareil ne s'est peut-être encore présenté. Elle n'est plus lue nulle
part ailleurs : le serveur résout le compte de chaque requête depuis sa session,
et le ménage de rétention comme le rattrapage du profil mesuré passent sur tous
les comptes.

**Le décompte est rendu et écrit au journal du conteneur** : profils, moteurs,
boîtes, dépôts et octets, plus le profil mesuré. C'est le seul endroit où l'on
verra que l'héritage a eu lieu — après coup, il n'y a plus de compte d'avant à
regarder. Sept tests couvrent le décompte, l'absence de perte, l'effacement, le
second compte qui ne reçoit rien, l'installation neuve et la ligne de journal.

**Le second appareil, décidé** : il crée son propre compte, vide, et l'écran le
dit. Les relier est le [ticket 05](05-relier-un-appareil-par-un-code.md).
