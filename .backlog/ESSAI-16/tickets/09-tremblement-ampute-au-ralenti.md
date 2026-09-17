# 09 — Au ralenti, le tremblement est amputé de moitié

**Statut :** 🧑 attend David — corrigé et mesuré le 17 septembre 2026 ; reste l'écoute

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

- [x] Au ralenti, le régime joué oscille des deux côtés de la consigne, et un
      test le montre.
- [x] Le temps passé exactement au plancher tombe sous quelques pour cent.
- [x] Rien en aval ne se trouve sorti de son domaine par un régime légèrement
      sous le ralenti.
- [ ] Écouté : le ralenti ne sonne plus comme une fréquence pure.

## À ne pas confondre

L'affichage relevait du [ticket 10](10-aiguille-sans-tremblement.md), tranché le
même jour : le cadran suit maintenant le régime entendu. Les deux se voient donc
ensemble — le compte-tours ne frémit pas seulement, il frémit **des deux côtés**.

## Le chiffre, relevé le 17 septembre 2026

Trouvé en vérifiant le ticket 10, dans l'application, au ralenti : sur
vingt-cinq relevés consécutifs, l'écart entre le régime entendu et le régime net
va de **0 à +20,9 tr/min**, et ne descend **jamais sous zéro**. Une seconde série
de dix relevés donne la même chose : 0 à +18,1, aucun négatif.

Un tremblement oscille autour d'une valeur ; celui-ci ne fait que s'ajouter. C'est
bien la moitié manquante que le titre du ticket annonce, et elle est mesurée, plus
seulement entendue.

## Ce qui a été fait, le 17 septembre 2026

**Le plancher descend avec l'amplitude.** Il valait `idleRpm` ; il vaut
`idleRpm - amplitude`, borné par la moitié du ralenti. Ce garde-fou-là ne mord
jamais — le curseur s'arrête à 150 tr/min pour un ralenti de 750 — et n'existe que
pour un profil importé qui ne passe pas par le curseur : sous la moitié de son
ralenti, un moteur a calé, et les couches se joueraient près d'une octave trop bas.

Le bornage par le haut ne bouge pas : le rupteur reste infranchissable.

### Mesuré

**Au banc**, sur trente secondes à l'arrêt : le temps passé collé à la consigne
passe de **51,2 %** à **moins de 5 %**, et l'excursion devient symétrique.

**Dans l'application**, 300 relevés au ralenti sur le profil V8 :

| | Avant | Après |
|---|---|---|
| Écart minimum | 0 | **−23,66 tr/min** |
| Écart maximum | +20,9 | +23,64 tr/min |
| Temps collé à la consigne | ~50 % | **2 %** |
| Temps passé sous la consigne | **0 %** | **49,7 %** |

**L'excursion des profils livrés a doublé** — 48,3 tr/min sur Route, 67,7 sur
Sport, contre 24,2 et 33,9 — et c'est la preuve du correctif plutôt qu'un
changement de réglage : la moitié manquante est revenue, l'amplitude réglée n'a
pas bougé.

### Ce que l'aval en dit

Le critère craignait qu'un régime sous le ralenti sorte une couche de son domaine
jouable. **Il ne le fait pas**, et la mesure dit pourquoi : le domaine se juge à la
demi-octave, quand le tremblement vaut trois pour cent du régime — 0,046 octave.
Plus d'un ordre de grandeur de marge.

Relevé au passage : `off_low` était **déjà** bornée en vitesse de lecture à ralenti
pile, avant tout correctif. Ce n'est pas le tremblement qui l'y met. Les gains
varient continûment avec le régime, −10 % au bas du tremblement et +10 % en haut :
le niveau respire des deux côtés, ce qui est ce qu'on veut entendre. Trois tests
tiennent cette propriété dans `mix.test.ts`.

### Ce qui reste

L'écoute. Le ralenti ne doit plus sonner comme une fréquence pure — c'est un
jugement d'oreille, et il appartient à David.
