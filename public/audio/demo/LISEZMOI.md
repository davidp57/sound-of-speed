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
| Poids | 1,6 Mo |
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
`scripts/generate-bank/engines/i4-check.json`. Elle se refait à l'identique :

```bash
node native/prepare.mjs
bash native/build-generator.sh
node scripts/generate-bank/generate.mjs scripts/generate-bank/engines/i4-check.json
```

Le modèle de moteur et la réponse d'échappement viennent d'engine-sim
(© 2022 AngeTheGreat, licence MIT — texte recopié dans
[`public/impulse/LISEZMOI.md`](../../impulse/LISEZMOI.md)). Les fichiers produits
ici sont distribués sous la licence de l'application, l'AGPL-3.0.

## Ce qu'elle ne prétend pas être

Un moteur simulé ne sonne pas comme une prise réelle, et le projet ne le cache
pas. Elle est là pour que l'application s'essaie, pas pour être le meilleur son
qu'elle sache produire. Pour cela, il faut déposer une banque enregistrée — le
README dit comment.
