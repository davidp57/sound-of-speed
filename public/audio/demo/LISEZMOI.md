# Banque de démonstration

La seule banque d'échantillons versionnée avec l'application. Elle existe pour
qu'un dépôt fraîchement cloné fasse du son : sans elle, on installerait une
application de son qui n'en produit aucun.

## Ce que c'est

Un quatre cylindres en ligne, **simulé** — ce n'est pas l'enregistrement d'une
vraie voiture. Le moteur tourne sur [engine-sim](https://github.com/ange-yaghi/engine-sim)
au banc, une prise par plage de régime, et l'application rejoue ces prises comme
n'importe quelle autre banque.

| | |
|---|---|
| Prises | 15 — sept ancrages par famille, de 800 à 6 300 tr/min, plus le ralenti |
| Familles | en charge et pied levé |
| Format | FLAC, 44,1 kHz, mono |
| Poids | 1,2 Mo |
| Échappement | captation `smooth_39`, la même que le son en direct |

Le profil se trouve à côté, dans `profil.json` : il s'importe tel quel dans
l'écran de configuration.

## Pourquoi celle-là et pas un enregistrement

**Les droits.** Une prise sur une vraie voiture appartient à qui l'a faite. La
banque qui tourne dans la voiture de David vient d'une autre application et n'a
aucune licence qui autorise à la rediffuser : elle reste hors du dépôt, comme
toutes les banques enregistrées.

Un relevé des banques libres a cherché mieux et n'a rien trouvé — voir
[`.backlog/PLATEFORME/banques-libres.md`](../../../.backlog/PLATEFORME/banques-libres.md).
Ce qui est au bon format n'a pas de droits clairs ; ce qui a des droits clairs
n'a que deux boucles, soit le défaut que les prises par plage de régime
corrigent. Un moteur simulé, lui, n'appartient à personne.

## Provenance et licence

Produite par `scripts/generate-bank/`, depuis la définition
[`engines/demo.json`](../../../scripts/generate-bank/engines/demo.json). Elle se
refait en trois commandes :

```bash
bash native/build-generator.sh   # après node native/prepare.mjs, une fois
node scripts/generate-bank/generate.mjs scripts/generate-bank/engines/demo.json
node scripts/transcode.mjs public/audio/demo
```

Il reste ensuite à passer les couches du profil en `.flac`, à effacer les `.wav`
et `.brut/`, et à recopier `profil.json` dans
[`src/core/preset/demo-profile.json`](../../../src/core/preset/demo-profile.json)
— le profil d'usine, qui doit désigner exactement ces fichiers-là. Un test le
vérifie (`demo-bank.test.ts`) : les deux vivent à deux endroits, et rien
n'empêche mécaniquement de régénérer l'un sans l'autre.

**Refaite le 14 septembre 2026**, quand le banc a cessé de porter sa propre
géométrie pour construire le moteur que décrit la bibliothèque de l'application.
Sept valeurs avaient divergé, dont la gigue d'échantillonnage — corrigée le
8 septembre côté son direct, jamais côté banc. Ce que le remplacement change, et
qui s'entend :

- **le son est plus grave**, de 27 à 40 % sur le centre de gravité du spectre.
  Les cames ont repris les durées relevées dans le fichier d'engine-sim, 232 et
  236 degrés au lieu de 220 ;
- **le cliquetis a disparu** : la gigue valait 8,7 dB à 5 600 Hz et 25,5 dB à
  8 000 Hz ;
- **le pied levé est plus en retrait**, jusqu'à 6,8 dB sous son niveau d'avant
  au ralenti. C'est le relief mesuré sur le nouveau modèle, pas un réglage.

Le modèle de moteur et la réponse d'échappement viennent d'engine-sim
(© 2022 AngeTheGreat, licence MIT — texte recopié dans
[`public/impulse/LISEZMOI.md`](../../impulse/LISEZMOI.md)). Les fichiers produits
ici sont distribués sous la licence de l'application, l'AGPL-3.0.

## Ce qu'elle ne prétend pas être

Un moteur simulé ne sonne pas comme une prise réelle, et le projet ne le cache
pas. Elle est là pour que l'application s'essaie, pas pour être le meilleur son
qu'elle sache produire. Pour cela, il faut déposer une banque enregistrée — le
README dit comment.
