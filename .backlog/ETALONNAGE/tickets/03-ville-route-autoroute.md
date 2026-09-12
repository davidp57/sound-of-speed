# 03 — Ville, route, autoroute : ce qu'on fait vraiment

**Statut :** ✅ fait

**Bloqué par :** 01 — Une étape, de la consigne à la valeur proposée

## Ce qu'il faut obtenir

Trois étapes de conduite ordinaire, chacune enregistrée à part, dont on tire des
**distributions** plutôt que des extrêmes : les vitesses réellement tenues, la
durée des paliers, les accélérations de tous les jours, la vitesse maximale
pratiquée.

Ce sont elles qui informent les réglages placés « à la vitesse où l'on roule
vraiment » : les seuils de passage, le plancher de croisière, le délai avant de
monter un rapport en croisière, la vitesse à laquelle on quitte l'arrêt en ville,
et la vitesse plausible maximale.

Le profil Route a été décrit comme « calibré sur les vitesses que l'on pratique
vraiment ». C'était de mémoire. Ce ticket remplace la mémoire par un relevé.

**Une électrique n'a pas de rapports** : ces étapes informent des seuils **en
vitesse**, jamais en régime. Le régime reste une fiction qu'on choisit.

Elles donnent aussi, gratuitement, quelque chose que le lot
[PENTE](../../PENTE/spec.md) a rendu nécessaire : le **bruit réel du GPS de
cette voiture**, dont dépendent la raideur du lissage et la fenêtre
d'accélération. C'est la mesure la plus directement exploitable des trois.

## Critères d'acceptation

- [x] Les trois étapes s'enregistrent séparément et se distinguent
- [x] Les vitesses tenues et la durée des paliers sont mesurées par étape
- [x] Des seuils de passage en vitesse sont proposés, ainsi qu'un plancher de
      croisière et un délai de croisière
- [x] La vitesse maximale pratiquée est proposée comme vitesse plausible
- [x] Le bruit de mesure du GPS est chiffré, avec la cadence observée
- [x] Aucune proposition n'est formulée en régime moteur
