# 01 — Les sept rapports, et tout ce qui se compte par rapport

**Statut :** ⬜ prêt

## Ce qu'il faut obtenir

Les rapports passent de six à sept, réétagés du quatrième au septième :

```
3.55 · 2.04 · 1.36 · 1.00 · 0.73 · 0.53 · 0.39
```

La septième est un rapport d'autoroute : 130 km/h à 1 508 tr/min.

## Ce qui se compte par rapport, et qu'il faut suivre

Un rapport de plus n'est pas une valeur de plus. À vérifier un par un :

- `gearRatios` — sept valeurs ;
- `upshiftRpm` — une entrée de moins que les rapports, donc **six** ;
- `shiftDelaysS` — une par rapport, donc **sept** ;
- tout ce qui itère sur les rapports dans `core/drivetrain/`, et tout ce qui
  suppose six quelque part ;
- l'écran de configuration, qui édite ces tableaux ;
- les profils par défaut, et les lois de `core/preset/character.ts` qui
  dérivent ces tableaux du caractère — un profil régénéré doit sortir avec sept
  rapports, pas six.

## Ce qu'il faudra écouter

Rien ne dit encore comment sonne une boîte qui tient 110 km/h à 1 734 tr/min.
La couche sonore a un domaine jouable : à ces régimes-là, les couches basses
travaillent loin de leur ancrage. C'est à vérifier en roulant, pas au banc.

## Critères d'acceptation

- [ ] Sept rapports, aux valeurs ci-dessus.
- [ ] Un test donne le régime de chaque rapport à 50, 80, 110 et 130 km/h, et
      fixe les quatre chiffres attendus.
- [ ] Aucun endroit du code ne suppose six rapports.
- [ ] Un profil dérivé du caractère sort avec sept rapports et des tableaux de
      la bonne longueur.
- [ ] Contrôle qualité vert.
