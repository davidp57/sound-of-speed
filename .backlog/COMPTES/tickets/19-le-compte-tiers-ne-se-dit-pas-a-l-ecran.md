# 19 — Un compte tiers rattaché continue de s'annoncer comme anonyme

**Statut :** ⬜ prêt

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

Ce qui est affiché doit venir de la session, pas de ce que l'appareil portait
avant : c'est cet écart qui rend le défaut visible, et c'est probablement lui
qu'il faut chercher — **mais la cause n'a pas été instruite**, seulement
l'observable.

## Critères d'acceptation

- [ ] Après connexion par un compte tiers, l'écran annonce l'adresse de ce compte
- [ ] L'avatar suit la même identité
- [ ] Le cas d'un compte resté anonyme est inchangé : l'adresse de remplacement
      ne s'affiche pas comme une adresse
- [ ] Vérifié sur le parcours qui l'a montré — « Ouvrir un autre compte sur cet
      appareil », puis Google
