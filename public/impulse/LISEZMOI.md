# Réponses d'échappement

Quatre captations d'échappements réels, utilisées par le son synthétisé.

Le moteur simulé produit des impulsions de pression ; ces fichiers portent ce
qu'elles traversent ensuite — la géométrie du tube, le silencieux, la caisse, le
lieu de la prise. Aucun modèle ne reproduit cela : c'est la différence entre un
échappement et l'idée qu'on s'en fait. Une résonance fabriquée reste disponible
dans l'écran de réglage, sous le nom « Tube fabriqué », mais elle ne sert que de
repli.

| Fichier | Ce que c'est |
|---|---|
| `smooth_39.wav` | celle du V8 Chevrolet 454 livré avec engine-sim |
| `mild_exhaust.wav` | un silencieux doux |
| `minimal_muffling_01.wav` | un échappement peu silencieux |
| `sharp_01.wav` | une réponse sèche, peu de queue |

Ces fichiers sont versionnés avec l'application, contrairement aux banques
d'échantillons qui vivent sur le NAS : sans eux le moteur simulé n'a pas de
corps, ils font donc partie du produit. Cent quatre-vingt-douze kilo-octets pour
les quatre.

## Provenance

Ils viennent de [engine-sim](https://github.com/ange-yaghi/engine-sim), dossier
`assets/sound-library/`, et sont repris tels quels.

```
Copyright 2022 AngeTheGreat (Ange Yaghi)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
