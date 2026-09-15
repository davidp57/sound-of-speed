# 05 — Le conducteur autorise l'assistance, et ça expire

**Statut :** ⬜ prêt

**Bloqué par :** 02 — la fiche d'un compte

## Ce qu'il faut obtenir

Sur son écran de compte, une section « autoriser l'assistance ». Le conducteur
l'ouvre, et l'écran lui dit en clair jusqu'à quand : 24 heures par défaut. Il
peut refermer avant.

Du côté de la régie, la fiche affiche l'état : ouvert jusqu'à telle heure, ou
fermé. Rien ne se lit encore — la lecture est le ticket suivant.

**Il n'y a aucun canal de demande.** Le serveur ne sait pas parler à une
voiture, et la voiture roule souvent hors réseau. On demande de vive voix, et le
conducteur accorde de lui-même.

**Un seul interrupteur, tout ou rien.** Pas de distinction entre ce qu'il a
fabriqué et ce qu'il a roulé : celui qui accorde n'a aucun choix à faire, donc
aucun mauvais choix à faire.

**L'accord est une date d'échéance, et rien d'autre.** Le droit tombe dès
qu'elle est dépassée, sans qu'aucun passage périodique n'ait à s'exécuter.
**Pas de date, pas de droit** — l'absence est l'état normal.

Attention au piège : dans la table des droits, une échéance nulle veut dire
« sans échéance ». Ici, une date nulle veut dire « aucun droit ». Deux colonnes
qui se ressemblent et disent le contraire.

## Critères d'acceptation

- [ ] Le conducteur ouvre l'assistance depuis son écran de compte et voit
      l'heure de fin en clair.
- [ ] La durée par défaut est de 24 heures.
- [ ] Il peut refermer avant l'échéance, et l'écran le reflète aussitôt.
- [ ] La régie affiche l'état de l'accord sur la fiche, échéance comprise.
- [ ] Un compte sans date d'accord est dans l'état fermé, sans qu'on ait rien
      écrit chez lui.
- [ ] Une date passée vaut fermé, sans qu'aucune tâche périodique n'intervienne.
- [ ] Seul le titulaire du compte pose et retire sa date : la régie ne peut pas
      s'accorder l'accès, vérifié.
- [ ] L'ouverture et la fermeture par le conducteur s'inscrivent dans la trace.
- [ ] Les routes ajoutées sont inscrites dans l'inventaire de l'essai
      d'isolation.
- [ ] Contrôle qualité vert.
