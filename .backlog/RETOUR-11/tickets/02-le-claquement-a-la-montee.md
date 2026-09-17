# 02 — Claquement à la montée, moins trente pour cent

**Statut :** 🔁 rouvert le 17 septembre 2026 — David a écouté : « ça claque encore un peu trop fort à la montée ; à affiner, réduire un peu ». Chiffre validé : `clack` 0,35 → 0,25 et `clackDownshift` 0,786 → 1,1, pour que le rétrogradage reste exactement à 0,275

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

- [x] Le claquement à la montée perd trente pour cent d'amplitude.
- [x] Le claquement au rétrogradage est inchangé, à la valeur près.
- [x] Un test couvre les deux amplitudes, montée et descente.
- [x] Un profil dérivé du caractère donne le même équilibre.
- [x] Contrôle qualité vert.

Critères établis le 12 septembre 2026 : le claquement porte deux amplitudes distinctes, montée et descente, et un test du mixage compare les deux réglages — 0,50 avant, 0,35 après, soit les trente pour cent demandés, la descente restant à sa valeur. Le caractère dérive les deux. Contrôle qualité vert.
