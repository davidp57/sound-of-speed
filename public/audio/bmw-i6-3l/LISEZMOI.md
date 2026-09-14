# Six en ligne — 3,0 L

L'architecture des BMW, demandée par David le 14 septembre 2026. C'est la
troisième que le projet sait bâtir, après le quatre en ligne et le V8 croisé.

Ce qui la définit : **manetons à 0-120-240-240-120-0** — les cylindres vont par
paires, 1 avec 6, 2 avec 5, 3 avec 4 — et **ordre d'allumage 1-5-3-6-2-4**, soit
un allumage tous les 120 degrés de vilebrequin. Parfaitement régulier, là où le
V8 croisé grogne d'être inégal. C'est aussi ce qui lui donne son équilibre sans
arbre de compensation.

Son échappement est un **6-en-2** : deux lignes de trois cylindres, comme les six
de route. C'est la seule des sept pistes essayées pour retrouver le grain du V8
qui ait donné quelque chose — 12,1 dB de plus entre 4 et 8 kHz, mesurés.

**Simulée**, pas enregistrée : le moteur tourne sur
[engine-sim](https://github.com/ange-yaghi/engine-sim) au banc, une prise par
plage de régime, et l'application rejoue ces prises comme n'importe quelle autre
banque. Aucune question de droits, donc, et c'est pour ça qu'elle est dans le
dépôt.

| | |
|---|---|
| Prises | 18 — 8 ancrages par famille, de 750 à 7000 tr/min, plus le ralenti et le rupteur |
| Familles | en charge et pied levé |
| Format | FLAC, 44,1 kHz, mono |
| Poids | 1.3 Mo |
| Échappement | captation `smooth_39`, 45 % de la sortie |
| Vitesse de lecture | 0.73 à 1.37 sur toute la conduite ordinaire |
| Saut d'énergie au bouclage | 10.7 % au pire, 3.9 % en médiane |
| Génération | 98 s |

Le profil se trouve à côté, dans `profil.json` : il s'importe tel quel dans
l'écran de configuration.

## Ce qu'elle a de particulier

**Ses cotes ne sont pas sourcées.** C'est la seule banque du dépôt dans ce cas :
les autres moteurs sont relevés d'un fichier d'engine-sim, celui-ci est construit
de mémoire à partir de ce qu'on sait d'un six BMW de trois litres — 84 mm
d'alésage, 89,6 mm de course, un rapport volumétrique de 10,2. Le reste reprend
les valeurs du Subaru EJ25, faute d'un relevé.

**Il n'est pas réglé.** Comme le quatre cylindres, et à la différence du GM LS,
personne n'a cherché ses valeurs à l'oreille. David le trouve « moyen en
charge » — c'est peut-être l'architecture, c'est peut-être qu'il attend sa
séance de réglage. Voir le ticket
[SYNTHESE/12](../../../.backlog/SYNTHESE/tickets/12-le-six-en-ligne.md) pour les
sept hypothèses essayées et écartées.

## Provenance et licence

Produite par [`scripts/generate-bank/`](../../../scripts/generate-bank/README.md),
depuis la définition
[`engines/bmw-i6-3l.json`](../../../scripts/generate-bank/engines/bmw-i6-3l.json). Elle se refait en trois commandes :

```bash
bash native/build-generator.sh   # après node native/prepare.mjs, une fois
node scripts/generate-bank/generate.mjs scripts/generate-bank/engines/bmw-i6-3l.json
node scripts/transcode.mjs public/audio/bmw-i6-3l
```

Il reste ensuite à passer les couches du profil en `.flac`, à effacer les `.wav`
et `.brut/`, et à recopier `profil.json` dans
[`src/core/preset/bmw-i6-3l-profile.json`](../../../src/core/preset/bmw-i6-3l-profile.json)
— le profil d'usine, qui doit désigner exactement ces fichiers-là. Un test le
vérifie (`banques-livrees.test.ts`) : les deux vivent à deux endroits, et rien
n'empêche mécaniquement de régénérer l'un sans l'autre.

Le modèle de moteur et la réponse d'échappement viennent d'engine-sim
(© 2022 AngeTheGreat, licence MIT — texte recopié dans
[`public/impulse/LISEZMOI.md`](../../impulse/LISEZMOI.md)). Les fichiers produits
ici sont distribués sous la licence de l'application, l'AGPL-3.0.

## Ce qu'elle ne prétend pas être

Un moteur simulé ne sonne pas comme une prise réelle, et le projet ne le cache
pas. Pour aller plus loin, il faut déposer une banque enregistrée — le
[README](../../../README.md) dit comment.

`mesures.json`, à côté, porte le relevé complet : la recette, les régimes tenus,
les niveaux, les sauts d'énergie. Aucun chiffre de cette page n'y échappe.
