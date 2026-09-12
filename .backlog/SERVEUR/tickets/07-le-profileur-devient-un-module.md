# 07 — Le profileur cesse de scruter un disque

**Statut :** ⬜ prêt

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

- [ ] Déposer une trace déclenche son analyse, sans qu'aucun dossier soit scruté
- [ ] Le profil mesuré est servi depuis la base, et l'écran qui le propose n'a
      pas été retouché
- [ ] Sur un même jeu de traces, le profil mesuré est **identique** à celui que
      l'ancien service produisait — comparé, pas supposé
- [ ] Le second conteneur n'est plus déclaré nulle part
- [ ] Une trace déposée pendant que le serveur redémarre est analysée au
      démarrage suivant, et non perdue
