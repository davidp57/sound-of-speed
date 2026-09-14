# Quatre cylindres — Subaru EJ25

Le quatre cylindres à plat, à ses valeurs de référence.

C'est la banque que David place derrière les deux V8 : « les V8 sonnent bien
mieux que les 4L ». Elle est livrée quand même — un quatre cylindres ne sonne pas
comme un huit, et le choix appartient à qui écoute.

Deux chiffres à connaître avant d'y toucher. Son **centre de gravité spectral
zigzague** de huit demi-tons sur la plage, sans monotonie : c'est le modèle, pas
la banque, et c'est ce que dit son erreur de timbre de 5 demi-tons. Et le **saut
d'énergie de 39,7 %** porte sur une seule prise, `off-800` — le pied levé au
ralenti, la plus faible de toutes, retenue à −23 dB.

**Simulée**, pas enregistrée : le moteur tourne sur
[engine-sim](https://github.com/ange-yaghi/engine-sim) au banc, une prise par
plage de régime, et l'application rejoue ces prises comme n'importe quelle autre
banque. Aucune question de droits, donc, et c'est pour ça qu'elle est dans le
dépôt.

| | |
|---|---|
| Prises | 15 — 7 ancrages par famille, de 800 à 6 300 tr/min, plus le ralenti |
| Familles | en charge et pied levé |
| Format | FLAC, 44,1 kHz, mono |
| Poids | 1,2 Mo |
| Échappement | captation `smooth_39`, la même que le son en direct |
| Vitesse de lecture | 0,71 à 1,40 sur toute la conduite ordinaire |
| Erreur de timbre | 4,99 demi-tons |
| Saut d'énergie au bouclage | 39,7 % au pire, 3,1 % en médiane |
| Génération | 71 s |

Le profil se trouve à côté, dans `profil.json` : il s'importe tel quel dans
l'écran de configuration. Il emporte aussi **les vingt-neuf nombres du moteur**
qui a produit ce son — basculer ce profil en son direct joue donc le même moteur.

## Provenance et licence

Produite par [`scripts/generate-bank/`](../../../scripts/generate-bank/README.md),
depuis la définition
[`engines/subaru-ej25.json`](../../../scripts/generate-bank/engines/subaru-ej25.json). Elle se refait en trois commandes :

```bash
bash native/build-generator.sh   # après node native/prepare.mjs, une fois
node scripts/generate-bank/generate.mjs scripts/generate-bank/engines/subaru-ej25.json
node scripts/transcode.mjs public/audio/subaru-ej25
```

Il reste ensuite à passer les couches du profil en `.flac`, à effacer les `.wav`
et `.brut/`, et à recopier `profil.json` dans
[`src/core/preset/subaru-ej25-profile.json`](../../../src/core/preset/subaru-ej25-profile.json)
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
