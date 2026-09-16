# 09 — Au ralenti, le tremblement est amputé de moitié

**Statut :** ⬜ prêt

David : « j'ai pas l'impression que les oscillations aléatoires de rpm qui sont
censées être codées soient là. En particulier au ralenti, le moteur est à
800 rpm stables. »

Il a raison, et c'est mesurable sans rouler.

## La cause

Le régime tremblé est borné par le bas au ralenti :

```
clamp(this.rpm + amplitude * offset, this.preset.idleRpm, this.preset.redlineRpm)
```

Or **au ralenti, `this.rpm` vaut exactement `idleRpm`**. Toute la
demi-oscillation vers le bas est donc écrasée contre la borne. Le commentaire du
code l'admet déjà — « l'excursion est donc à sens unique, mesuré, 0 à
+24 tr/min » — mais il ne dit pas ce que cela coûte à l'oreille.

Simulé sur les réglages du profil de David (`flutterRpm` 25, `flutterHz` 6,
ralenti 800, les trois sinusoïdes du code), sur deux minutes :

| | À l'arrêt (charge 0,04) |
|---|---|
| Amplitude calculée | 24,4 tr/min |
| Régime réellement joué | 800 à 824 tr/min |
| Temps passé **collé à 800 pile** | **50 %** |
| Excursion audible | 0,51 demi-ton, au lieu d'environ 1 |

Une seconde sur deux, le moteur est rigoureusement stable. C'est exactement ce
que David décrit.

## La piste

Au ralenti, laisser le régime osciller **autour** de sa consigne au lieu de buter
dessus : un vrai moteur au ralenti descend sous sa consigne autant qu'il monte
au-dessus. Le plancher du bornage ne doit donc pas être `idleRpm` mais quelque
chose comme `idleRpm − amplitude`.

Cela ne touche pas à l'amplitude réglée, et ne change rien au-dessus du ralenti,
où `rpm` est déjà au-dessus du plancher.

**Attention à ce que le bornage protège vraiment.** Il empêche aussi de franchir
le rupteur par le haut — cette borne-là reste. Et il faut vérifier que rien en
aval ne suppose `audibleRpm ≥ idleRpm` : la lecture des échantillons, notamment,
peut avoir un domaine jouable qui commence au ralenti.

## Critères d'acceptation

- [ ] Au ralenti, le régime joué oscille des deux côtés de la consigne, et un
      test le montre.
- [ ] Le temps passé exactement au plancher tombe sous quelques pour cent.
- [ ] Rien en aval ne se trouve sorti de son domaine par un régime légèrement
      sous le ralenti.
- [ ] Écouté : le ralenti ne sonne plus comme une fréquence pure.

## À ne pas confondre

L'affichage, lui, ne montrera toujours rien : voir le ticket 10. Ce ticket-ci ne
traite que ce qui s'entend.
