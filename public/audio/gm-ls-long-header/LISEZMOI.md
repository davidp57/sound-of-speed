# V8 croisé, collecteur long

Le même GM LS, avec l'échappement que David a trouvé à l'oreille le 8 septembre
2026 : collecteur du premier cylindre à 30 pouces au lieu de 6,8, débit du
primaire doublé, tube primaire à 30 pouces, débit de sortie à 2 000.

Ce qu'il cherchait, dans ses mots : « quand on l'augmente, fait mieux entendre le
bruit des explosions (poutoum poutoum) — surtout au ralenti ». Le réglage arbitre
— long, il apporte le rugueux en charge et des parasites en décélération ; court,
il enlève les deux.

**Simulée**, pas enregistrée : le moteur tourne sur
[engine-sim](https://github.com/ange-yaghi/engine-sim) au banc, une prise par
plage de régime, et l'application rejoue ces prises comme n'importe quelle autre
banque. Aucune question de droits, donc, et c'est pour ça qu'elle est dans le
dépôt.

| | |
|---|---|
| Prises | 18 — 8 ancrages par famille, de 780 à 6 500 tr/min, plus le ralenti et le rupteur |
| Familles | en charge et pied levé |
| Format | FLAC, 44,1 kHz, mono |
| Poids | 1,5 Mo |
| Échappement | captation `smooth_39`, la même que le son en direct |
| Vitesse de lecture | 0,74 à 1,35 sur toute la conduite ordinaire |
| Erreur de timbre | 1,14 demi-ton |
| Saut d'énergie au bouclage | 13,6 % au pire, 3,3 % en médiane |
| Génération | 212 s |

Le profil se trouve à côté, dans `profil.json` : il s'importe tel quel dans
l'écran de configuration. Il emporte aussi **les vingt-neuf nombres du moteur**
qui a produit ce son — basculer ce profil en son direct joue donc le même moteur.

## Provenance et licence

Produite par [`scripts/generate-bank/`](../../../scripts/generate-bank/README.md),
depuis la définition
[`engines/gm-ls-long-header.json`](../../../scripts/generate-bank/engines/gm-ls-long-header.json). Elle se refait en trois commandes :

```bash
bash native/build-generator.sh   # après node native/prepare.mjs, une fois
node scripts/generate-bank/generate.mjs scripts/generate-bank/engines/gm-ls-long-header.json
node scripts/transcode.mjs public/audio/gm-ls-long-header
```

Il reste ensuite à passer les couches du profil en `.flac`, à effacer les `.wav`
et `.brut/`, et à recopier `profil.json` dans
[`src/core/preset/gm-ls-long-header-profile.json`](../../../src/core/preset/gm-ls-long-header-profile.json)
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
