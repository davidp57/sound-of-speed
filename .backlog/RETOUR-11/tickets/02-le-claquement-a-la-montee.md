# 02 — Claquement à la montée, moins trente pour cent

**Statut :** 🧑 attend David — livré, reste l'écoute en roulant

## Ce qu'il faut obtenir

David, après la sortie du 11 septembre au soir : « diminuer le son du claquement
quand on monte d'un rapport (−30 %) ; quand on rétrograde c'est bien comme ça ».

## Ce qu'il ne faut pas rater

L'amplitude se calcule ainsi (`src/state.ts`) :

```ts
playEvent('clack', (t) => playClack(t, jolt.clack * (descend ? jolt.clackDownshift : 1)))
```

`clack` porte donc la montée **et** la descente ; `clackDownshift` n'est qu'un
facteur appliqué par-dessus en descente. Baisser `clack` seul baisserait les
deux, ce qui n'est pas la demande.

Sur le profil V8, `clack` vaut 0,50 et `clackDownshift` 0,55 — soit 0,50 à la
montée et 0,275 à la descente. Pour baisser la montée de trente pour cent en
laissant la descente où elle est :

| | avant | après |
|---|---|---|
| `clack` | 0,50 | **0,35** |
| `clackDownshift` | 0,55 | **0,79** |
| amplitude à la montée | 0,500 | **0,350** |
| amplitude à la descente | 0,275 | **0,275** |

Les profils par défaut portent la même paire, et `character.ts` la dérive du
caractère : les deux lois doivent bouger ensemble, sinon un profil régénéré
reviendrait à l'ancien équilibre.

## Critères d'acceptation

- [ ] Le claquement à la montée perd trente pour cent d'amplitude.
- [ ] Le claquement au rétrogradage est inchangé, à la valeur près.
- [ ] Un test couvre les deux amplitudes, montée et descente.
- [ ] Un profil dérivé du caractère donne le même équilibre.
- [ ] Contrôle qualité vert.
