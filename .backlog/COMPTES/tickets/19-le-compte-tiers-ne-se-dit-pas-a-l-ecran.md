# 19 — Un compte tiers rattaché continue de s'annoncer comme anonyme

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qui a été observé

David, le 14 septembre 2026, sur un poste de travail. Il se connecte avec Google
depuis « Ouvrir un autre compte sur cet appareil ». **Ses profils arrivent** —
donc le rattachement fonctionne, et c'est bien son compte qui est ouvert.

Mais l'écran du compte continue d'afficher l'identité anonyme :

- l'adresse annoncée est `tksw8…@anonymous.placeholder.invalid`, et non son
  adresse Google ;
- la phrase dit « enregistré au nom de `tksw8…@anonymous.placeholder.invalid`,
  avec Google » — elle sait donc que le fournisseur est Google, mais garde
  l'adresse de remplacement ;
- l'avatar montre le « T » de cette adresse de remplacement, et non son gravatar.

## Ce qu'il faut obtenir

L'écran du compte annonce l'adresse et l'avatar du compte réellement ouvert.

## La cause

L'écran est hors de cause : il affiche l'adresse du compte, et c'est le serveur
qui rendait celle-là.

Le greffon anonyme fabrique une adresse de remplacement à la création —
`<identifiant>@anonymous.placeholder.invalid`. Quand un fournisseur se rattache,
un crochet lève l'anonymat en écrivant `is_anonymous = false`, **et ne touche pas
à l'adresse**. Le compte devenait donc enregistré en gardant l'adresse fabriquée,
que l'écran affichait fidèlement. Le portrait suivait : l'initiale se prend sur
ce qui est écrit à côté.

## Ce qui a été fait

Le crochet lit maintenant ce que le fournisseur dit de la personne, dans le jeton
d'identité qu'il a signé, et le pose sur le compte : l'adresse et le portrait.

**Une adresse choisie ne se fait jamais remplacer.** Quelqu'un qui s'est
enregistré avec la sienne puis rattache un compte tiers garde la sienne — un
tiers est une preuve de plus, pas un remplacement. Seule une adresse de
remplacement cède la place, et elle se reconnaît à son domaine `.invalid`, que
la norme réserve. De même, un portrait déjà posé ne se fait pas remplacer par
celui du fournisseur suivant.

Le jeton est lu **sans revérifier sa signature**, et le module le dit : il vient
d'être validé par la bibliothèque pour ouvrir la session. Le revérifier
demanderait les clés publiques du fournisseur, donc un appel réseau, pour
rejouer un contrôle déjà passé.

## Critères d'acceptation

- [x] Après connexion par un compte tiers, l'écran annonce l'adresse de ce compte
- [x] L'avatar suit la même identité
- [x] Le cas d'un compte resté anonyme est inchangé : l'adresse de remplacement
      ne s'affiche pas comme une adresse
- [ ] ~~Vérifié sur le parcours réel~~ — **non fait** : il demande le NAS et
      Google configuré. Ce qui est vérifié est le crochet lui-même, sur une vraie
      base, la preuve posée **par la bibliothèque** et non par une écriture
      directe : cinq essais d'intégration, plus treize sur la lecture du jeton.
      Une insertion en base n'aurait rien prouvé, le crochet ne s'y déclenchant
      pas.
