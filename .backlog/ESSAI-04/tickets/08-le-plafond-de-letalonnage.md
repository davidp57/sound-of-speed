# 08 — le blocage revient, et cette fois c'est l'étalonnage

**Statut :** ✅ fait

**Bloqué par :** aucun

## Ce qui a déclenché

Le ticket 02 tenait le blocage de la vitesse pour réglé : la source GPS se
taisait parce que la position de référence était remplacée même quand l'écart
était refusé. C'était vrai, et ce n'était pas tout.

Essai de David, le 4 septembre 2026 au soir, avec le correctif en place : **le
blocage ne se produit que s'il existe un étalonnage.** Il avait enregistré
l'étape de ville dans les bouchons de l'autoroute, à moins de 30 km/h, et la
vitesse a fini par se figer comme avant. Un test discriminant, qui a évité de
retourner chercher des chiffres dans les mesures.

## Ce qu'on a trouvé

L'étalonnage n'est pas une liste de suggestions : tout ce qu'il mesure est
appliqué au profil que le moteur emploie, sans geste ni retour. Parmi les neuf
réglages informés, la **vitesse plausible maximale** vaut « la plus haute vitesse
pratiquée sur les étapes de conduite ordinaire, plus quinze pour cent, arrondie
à la dizaine supérieure ».

Une étape de ville dans un bouchon donne un 99ᵉ centile vers 30 km/h, donc une
borne à **40 km/h** au lieu des 260 du profil livré. Au-delà, une mesure n'est
pas écrêtée mais rejetée entière — à la source (`geolocation.ts`) comme au
conditionnement (`conditioner.ts`). Plus une seule vitesse ne sort : vitesse,
régime et son figés, le chien de garde relançant toutes les cinq secondes un
suivi qui fonctionne. Avec une étape de route valide en plus, la borne monte
vers 70 km/h, ce qui recoupe le seuil relevé en roulant.

Et rien ne le montrait : l'écran de configuration édite le profil réglé, donc
affichait toujours 260, et la liste des réglages remplacés ne donnait que des
libellés.

La même mécanique guettait les deux bornes d'accélération. Le commentaire de
`suggest.ts` le raconte déjà pour la borne basse : un étalonnage sans freinage
franc avait proposé −0,5 m/s², de quoi écrêter tout freinage réel. La protection
avait été posée au cas par cas.

## Ce qui a été fait

**L'étalonnage ne s'applique qu'entier** — la règle que David a désignée : un
étalonnage tout seul ne sert à rien, il faut le jeu. Tant qu'une des six étapes
manque ou a été refusée, `overridesFor` ne rend rien. Les propositions restent
affichées étape par étape et se recopient à la main : c'est l'application
automatique et silencieuse qui demande le jeu complet.

Deux ajouts pour que ce genre de défaut ne se cache plus :

- l'écran de configuration annonce **la valeur** de chaque réglage remplacé et
  celle du profil, et dit quelles étapes manquent quand l'étalonnage ne
  s'applique pas ;
- l'écran de conduite nomme la cause quand la source reçoit des positions sans
  en tirer aucune vitesse pendant trois secondes — plafond dépassé, précision,
  positions trop rapprochées. Le chien de garde ne sait pas les distinguer, et
  les deux ne parlent pas en même temps (`core/speed/rejection.ts`, sept tests).

## Critères d'acceptation

- [x] Un étalonnage à qui il manque une étape n'applique rien
- [x] Une étape enregistrée mais refusée compte comme manquante
- [x] Le jeu complet s'applique comme avant, bornes comprises
- [x] L'écran dit quelles étapes manquent, et la valeur de ce qui est remplacé
- [x] Une source qui rejette tout dit pourquoi, la source muette restant au
      chien de garde
- [ ] 🧑 Vérifié en roulant : refaire le jeu complet d'étalonnage, ou l'oublier,
      et confirmer que le blocage ne revient pas
