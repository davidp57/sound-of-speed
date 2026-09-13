# 16 — S'approprier son compte : le parcours des autres applications

**Statut :** ✅ fait — 13 septembre 2026

**Bloqué par :** [10 — L'écran du compte](10-l-ecran-du-compte.md),
[11 — Un vrai compte](11-un-vrai-compte.md),
[12 — Un compte tenu ailleurs](12-un-compte-tiers.md).
Les trois posent les gestes ; celui-ci les range.

## D'où vient ce ticket

Les quinze premiers tickets livrés, David regarde le résultat et n'en est pas
content. Le reproche ne porte sur aucun geste en particulier — ils fonctionnent
tous — mais sur la façon dont l'écran les présente :

> il faut que ça soit simple, et que le processus soit celui utilisé dans toutes
> les autres apps existantes : mode anonyme, avec moyen de s'approprier ce compte
> anonyme.

Et il nomme lui-même la seule vraie différence : chez nous le compte anonyme
n'est pas une commodité, c'est une nécessité. La voiture dépose ses trajets dès
le premier démarrage, il faut bien les mettre quelque part, et le jeton à huit
caractères est ce qui permet de les récupérer quand l'application a été ouverte
dans la voiture d'abord.

## Ce qu'il faut obtenir

Le parcours que toutes les applications ont appris à leurs utilisateurs :

1. **On se sert de l'application, tout de suite**, sans écran d'identité. Déjà le
   cas.
2. **Une invitation discrète et persistante** propose d'enregistrer le compte.
3. **Un seul écran d'appropriation**, dessiné comme partout : les comptes tenus
   ailleurs en haut, un « ou », l'adresse et le mot de passe en dessous.
4. **Après, l'invitation disparaît entièrement**, et l'écran montre qui l'on est
   — un portrait et une adresse.

## Ce qui a été fait

- **Une route qui dit ce que ce compte-ci porte** (`/compte/preuves`) : un mot de
  passe, et quels fournisseurs. C'est la pièce qui manquait, et quatre défauts en
  découlaient — l'écran ne savait que ce que le *serveur* propose.
- **L'écran réorganisé** : portrait et nom en haut, bloc d'appropriation qui
  disparaît une fois le compte enregistré, gestes rares repliés en bas.
- **Deux faces selon l'appareil.** Dans la voiture, l'écran ne propose pas
  d'enregistrer le compte — ni clavier commode, ni envie de partir chez un
  fournisseur en conduisant : il donne un code et renvoie à l'appareil qui le
  recevra. C'est l'axe « appareil » du ticket 14, qui servait déjà à ranger les
  écrans.
- **Une étiquette qu'on retient** à la place du nom daté — voir
  [02](02-un-compte-se-cree-tout-seul.md).
- **Un portrait** : celui du fournisseur, sinon Gravatar, sinon l'initiale.
- **Le code de liaison porté à vingt-quatre heures** — voir
  [05](05-relier-un-appareil-par-un-code.md).
- **Le bandeau de rappel revient** au lieu de se montrer une seule fois.
- **L'aide du premier lancement finit sur le compte**, avec un bouton vers
  l'écran. Le formulaire reste à un seul endroit : deux copies divergeraient.
- **Plus de mot de passe demandé à qui n'en a pas** — voir
  [13](13-tenir-son-compte.md).

## Ce qui a été écarté, et pourquoi

- **Donner un mot de passe à un compte enregistré chez un fournisseur.** Tranché
  par David : non. Conséquence assumée — qui s'est enregistré par Google et perd
  son compte Google n'a pas d'autre chemin de retour que le code de liaison,
  tant qu'il lui reste un appareil.
- **Le formulaire d'inscription dans l'aide du premier lancement.** C'est ce que
  les autres applications ne font pas : elles laissent essayer, et invitent
  ensuite. L'aide renvoie donc à l'écran plutôt que de dupliquer le formulaire.
- **Faire de l'étiquette une clé d'entrée.** Elle n'ouvre rien : le code de
  liaison remplit déjà ce rôle, il s'use, et trois mots se devinent.

## Ce qui reste

L'essai en voiture, avec le reste du lot : la face « voiture » de cet écran ne se
juge qu'au volant.
