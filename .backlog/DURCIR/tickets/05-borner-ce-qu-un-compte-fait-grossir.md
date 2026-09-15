# 05 — Borner ce qu'un compte peut faire grossir

**Statut :** ✅ fait — livré par [REGIE, ticket 08](../../REGIE/tickets/08-les-gestes-de-la-fiche.md)
le 15 septembre 2026. La valeur par défaut ne vient pas des chiffres du
ticket 04, qui n'ont pas été lus : c'est **250 Mio**, décidés par David le même
jour. La suite est dans le [ticket 06](06-faire-de-la-place-plutot-que-refuser.md).

**Bloqué par :** 04 — Mesurer ce que le serveur dépense

## Ce qu'il faut obtenir

Un envoi est borné à seize mébioctets ; rien ne borne leur nombre. Une voiture
qui boucle — le cas s'est déjà produit — remplit le disque sans que rien ne s'y
oppose. Le rôle ne sert à rien ici : il est offert à tout le monde par défaut, et
il n'a que deux crans, tout ou rien.

Après ce ticket, un compte a un plafond de volume. Le dépassement est refusé par
un code que le client ne rejoue pas, l'écran dit ce qui se passe et ce qu'on peut
y faire, et le journal du serveur en garde la trace.

Le plafond se règle par la configuration, et sa valeur par défaut vient des
chiffres du ticket 04 — pas d'un nombre rond choisi à la main.

**Ce point n'est pas tenu.** La valeur livrée est 250 Mio, décidés à la main ;
le relevé de dépense existe depuis le 14 septembre 2026 mais n'a pas été lu. À
reprendre avec le ticket 06.

## Critères d'acceptation

- [x] Un compte au plafond voit son dépôt refusé, et le client ne rejoue pas ce
      refus.
- [x] L'écran dit ce qui se passe et ce qu'on peut faire. **Formulation
      corrigée** : emporter ne rend aucune place — ça télécharge —, seul
      l'effacement en rend. Le message le dit dans ce sens.
- [x] Le dépassement laisse une ligne dans le journal du serveur.
- [x] Effacer un trajet rend de la place, et le dépôt suivant repasse. Emporter,
      non : voir ci-dessus.
- [x] Le plafond se règle sans reconstruire l'image (`SPEED_PLAFOND_GIO`), et la
      régie pose des exceptions par compte.
- [x] Un compte sous le plafond ne voit aucune différence. Le contrôle coûte
      0,44 ms sur les 8,6 ms d'un dépôt, mesuré sur 1 200 dépôts pesant 60 Mio.
