# 04 — Le profil devient un assemblage

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Le moteur devient une entité qu'on nomme · 02 — La boîte
se déduit du moteur et du mode · 03 — La voiture réelle existe. Il ne reste un
assemblage que quand les groupes qu'il assemble existent.

**Ce ticket a grossi, et c'est voulu.** Il porte désormais **toute la
contraction** : les sections du moteur *et* celles du signal de vitesse quittent
le profil dans le même mouvement. Décidé par David le 10 septembre 2026 — « on
regroupe avec le 04 » — parce que vider le profil deux fois coûterait deux
migrations, deux reprises de l'étalonnage et deux fois le même travail sur les
mêmes fichiers.

L'étalonnage est le morceau qui commande le calendrier : il écrit dans quatre
réglages du signal par un aiguillage explicite, et il superpose ses mesures au
profil pour fabriquer le profil effectif que la chaîne consomme. Ses écritures
doivent viser la voiture réelle, ce qui touche cinq fichiers et leurs tests.

## Ce qu'il faut obtenir

Un profil **ne porte plus aucune valeur** : un nom, un moteur, une boîte, un
mode. Les cent cinquante-huit réglages relevés le 10 septembre 2026 vivent
désormais dans les groupes, et le profil n'est que la façon de les combiner.

Au bout, le geste qui n'existe pas aujourd'hui : essayer **le même moteur avec
deux boîtes**, ou la même boîte sur deux moteurs, sans refaire un profil
complet. C'est ce que David cherchait en demandant « une séparation nette des
groupes de paramètres ».

C'est aussi la dernière reprise des profils enregistrés : après elle, le format
est celui de la refonte.

## Critères d'acceptation

- [ ] Un profil porte un nom et trois références — moteur, boîte, mode — et rien
      d'autre.
- [ ] Créer un profil qui reprend un moteur existant avec une autre boîte ne
      demande de ressaisir aucune valeur.
- [ ] Partager un profil emporte ce qu'il faut pour qu'il joue chez celui qui le
      reçoit : les entités qu'il désigne partent avec lui, ou sont retrouvées si
      elles y sont déjà.
- [ ] Les profils déjà enregistrés sont repris une dernière fois : chacun se
      scinde en un moteur, une boîte et un mode, et sonne exactement comme avant.
- [ ] Les préférences d'appareil — volume, visage de l'écran, verrou, mode de
      boîte — restent locales et ne rejoignent aucun groupe partageable.
- [ ] Les six réglages du signal de vitesse quittent le profil, et changer de
      profil ne change plus aucun réglage de mesure.
- [ ] L'étalonnage recopie ses valeurs mesurées dans la voiture réelle, et non
      dans le profil actif.
- [ ] Un profil importé ou partagé n'écrase jamais la voiture réelle de celui qui
      le reçoit — c'est le sens même de la séparation.
- [ ] README à jour : la « Référence des réglages » se range par groupe, et le
      glossaire porte les cinq termes.
- [ ] Contrôle qualité vert.
