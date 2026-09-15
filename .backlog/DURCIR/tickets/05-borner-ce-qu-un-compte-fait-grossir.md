# 05 — Borner ce qu'un compte peut faire grossir

**Statut :** ⬜ prêt

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

## Critères d'acceptation

- [ ] Un compte au plafond voit son dépôt refusé, et le client ne rejoue pas ce
      refus.
- [ ] L'écran dit ce qui se passe et ce qu'on peut faire : emporter ses trajets,
      en effacer.
- [ ] Le dépassement laisse une ligne dans le journal du serveur.
- [ ] Effacer ou emporter un trajet rend de la place, et le dépôt suivant repasse.
- [ ] Le plafond se règle sans reconstruire l'image.
- [ ] Un compte sous le plafond ne voit aucune différence.
