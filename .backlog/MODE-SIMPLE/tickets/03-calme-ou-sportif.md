# 03 — Un curseur « calme ↔ sportif », en continu

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Les tables suivent le nombre de rapports ; 02 — Le détail
passe derrière un mode avancé

## Ce qu'il faut obtenir

Un curseur du mode simplifié qui recalcule le caractère du moteur et de la boîte
à chaque mouvement : inertie, montée à vide, temps de passage, écart de charge,
seuils de passage, plancher de croisière, délai de croisière, seuil de freinage
au rétrogradage, rétrogradage forcé, pétarade et à-coup de passage.

Le guide de création sait déjà le faire, à partir d'une seule réponse de
tempérament. Ce ticket rend ce savoir disponible **en continu**, au lieu de le
perdre après la création.

## La décision à prendre au démarrage

Un curseur global recalcule, donc il écrase un réglage trouvé à la main. La spec
pose trois réponses, et elles donnent trois produits différents : écraser
franchement, écraser mais offrir un retour, ou appliquer un décalage relatif qui
préserve le réglage fin.

**Reco : écraser, avec un retour.** Le lot [ORIGINE](../../ORIGINE/spec.md) a déjà
doté chaque profil d'un état de retour ; en prendre un second juste avant le
mouvement du curseur global coûte peu et rend le geste sans risque. Le décalage
relatif a l'air séduisant mais retire au curseur tout sens absolu : deux profils
au même « calme » ne sonneraient pas pareil, et le mot ne voudrait plus rien
dire.

À confirmer avant d'écrire : c'est le choix dont tout le reste découle.

## Critères d'acceptation

- [ ] Un mouvement du curseur change le caractère de façon audible et cohérente
- [ ] Aux deux extrêmes, le profil reste jouable : ni boîte qui brasse, ni boîte
      qui dort
- [ ] Le geste est réversible : on retrouve l'état d'avant le mouvement
- [ ] Le curseur reflète, à l'ouverture, le caractère du profil courant plutôt
      qu'une position arbitraire
- [ ] Un profil réglé à la main puis repris par le curseur ne devient pas
      incohérent
