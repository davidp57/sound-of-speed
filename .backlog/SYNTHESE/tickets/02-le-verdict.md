# 02 — Le verdict : portage ou synthèse maison

**Statut :** ⬜ prêt

**Bloqué par :** 01 — la sonde, et son relevé dans la voiture

## Ce qu'il faut obtenir

Une décision écrite, et le découpage de la suite.

Le seuil est fixé d'avance, et il ne se rediscute pas en fonction du résultat :
**×3 temps réel mesuré dans la Tesla**.

| Relevé | Ce qu'on fait |
|---|---|
| **≥ ×3** | On porte engine-sim. Tickets suivants : `AudioWorklet`, convolution déportée sur `ConvolverNode`, moteur en JSON, coexistence, banc, effets |
| **entre ×1 et ×3** | On mesure ce que rend la convolution déportée — elle vaut à elle seule un facteur trois en natif. Si cela suffit à passer ×3, on continue ; sinon on bascule |
| **< ×1** | Abandon du portage. On écrit la synthèse maison, dont le coût est déjà mesuré comme identique à l'existant |

Le relevé du poste de David ne décide de rien : il vérifie que la page marche.
Sur un processeur de bureau on attend ×5 à ×10, ce qui ne dit rien du navigateur
embarqué.

## Critères d'acceptation

- [ ] Le chiffre relevé dans la voiture est écrit ici, avec le navigateur et la
      date
- [ ] La décision est écrite, quelle qu'elle soit, avec la règle qui l'a produite
- [ ] La spécification du lot est corrigée de ce qui devient faux
- [ ] Les tickets de la suite sont écrits, et eux seuls — pas ceux de la branche
      abandonnée
- [ ] 🧑 La décision est de David : la machine apporte le chiffre et la règle
