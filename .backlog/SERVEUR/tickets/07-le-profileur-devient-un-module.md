# 07 — Le profileur cesse de scruter un disque

**Statut :** ✅ fait le 12 septembre 2026

**Bloqué par :** 06 — Les traces et le journal vivent en base.

## Ce qu'il faut obtenir

Le serveur sait qu'une trace est arrivée, parce que c'est lui qui l'a écrite. Il
l'analyse dans la foulée et met à jour ce qu'il a appris de la vraie voiture. Le
second conteneur disparaît.

Aujourd'hui, un service Node séparé relit le dossier des traces toutes les cinq
secondes pour découvrir ce qui s'y trouve. Il est en Node précisément parce qu'il
importe cinq modules du cœur — son propre fichier de construction le dit. Une
fois le serveur écrit dans le même langage, il n'y a plus de raison qu'il soit à
côté.

## Ce qui ne change pas

**Ce qu'il calcule.** Le profil mesuré est cumulé exactement comme avant, et le
client le lit à la même adresse. Ce ticket déplace un déclencheur, il ne touche
pas à une mesure.

## Critères d'acceptation

- [x] Déposer une trace déclenche son analyse, sans qu'aucun dossier soit scruté
- [x] Le profil mesuré est servi depuis la base, et l'écran qui le propose n'a
      pas été retouché
- [x] Sur un même jeu de traces, le profil mesuré est identique à celui que
      l'ancien service produisait — et mieux qu'une comparaison : **c'est le
      même code**. Le profileur travaille sur deux méthodes, lister et lire ;
      on lui en a donné une version adossée à la base. Son calcul n'a pas été
      touché d'une ligne
- [ ] 🚫 **Déplacé au ticket 08.** Retirer le second conteneur des fichiers de
      pile **casserait la production**, qui tourne encore sur l'ancien serveur et
      dont le profil mesuré est écrit par ce service-là. Le retrait appartient à
      la bascule, pas à ce ticket
- [x] Une trace déposée pendant que le serveur redémarre est analysée au
      démarrage suivant, et non perdue

## Ce que le ticket a mesuré, et qui corrige une promesse

La spécification annonçait un profil mesuré de « quelques kilo-octets qui ne
grossissent pas ». Mesuré le 12 septembre :

| trajets | taille | trajets gardés entiers |
|---|---|---|
| 1 | 1 199 o | 1 |
| 10 | 3 588 o | 10 |
| 25 | 6 309 o | 20 — saturé |
| 50 | 6 509 o | 20 |
| 100 | 6 910 o | 20 |

Il **grossit**, et il cesse de le faire quand la fenêtre des trajets gardés
entiers sature à vingt. Au-delà, il ne reste que **huit octets par trajet** :
l'identifiant de ce qui a déjà été compté et ne doit pas l'être deux fois. À
mille trajets on serait vers quatorze kilo-octets.

La promesse est donc presque tenue, et le presque a son importance — c'est sur
cette propriété que [RETENTION](../../RETENTION/spec.md) s'appuiera pour effacer
les traces sans rien perdre de ce qu'elles ont montré. Le test vérifie la
saturation mesurée, et non un seuil qu'on aurait ajusté pour qu'il passe.

## Deux tests qui passaient sans rien mesurer

Les noms de tranches que j'avais écrits ne respectaient pas la convention —
horodatage, session, rang — et le profileur les ignorait donc en silence. Deux
tests se déclaraient verts sur un profil vide. Corrigés, et doublés d'une
vérification que la mesure a **eu lieu** : un trajet est entré dans le cumul.
