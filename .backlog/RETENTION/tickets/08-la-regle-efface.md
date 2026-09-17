# 08 — La règle efface, au démarrage puis chaque jour

**Statut :** 🧑 la règle est **déjà armée** — corrigé le 17 septembre 2026 : `menageDeRetention()` tourne au démarrage du conteneur puis toutes les 24 h, avec 30 jours pour les traces et 14 pour le journal. Elle n'a encore rien eu à effacer ; le premier passage utile tombe vers le 20 septembre

**Bloqué par :** [07 — Voir ce que la règle emporterait, sans rien effacer](07-voir-ce-que-la-regle-emporterait.md).
Le verdict doit avoir été regardé sur les vraies données avant qu'on l'exécute.

## Ce qu'il faut obtenir

Ce que le verdict du ticket 07 annonce, le serveur le fait : les sessions qui
remplissent les conditions disparaissent, entières, sans intervention.

Au démarrage d'abord, comme les migrations et la reprise — c'est le motif déjà
posé. Puis toutes les vingt-quatre heures, parce qu'un serveur qui ne redémarre
pas pendant trois mois ne doit pas cesser de faire le ménage.

Chaque passage s'écrit dans le journal du conteneur : ce qui est parti, ce qui a
été retenu et pourquoi. C'est le seul endroit où l'on verra ce qui a disparu,
puisque après coup il n'y a plus rien à regarder.

**C'est le seul geste irréversible du lot.** Il arrive en dernier, une fois que
les portes de sortie existent — on peut télécharger, on peut rouvrir depuis le
disque, on peut épingler — et une fois que le verdict a été lu.

## Ce à quoi il faut faire attention

- **Le verdict et l'exécution partagent la même décision.** Deux règles écrites
  deux fois divergeraient, et celle qui efface n'est pas celle qu'on aurait
  relue. L'exécution applique le verdict, elle ne le recalcule pas autrement.
- **Un passage qui échoue ne fait pas tomber le serveur.** La voiture a besoin de
  lui tout de suite ; le ménage se reprendra au passage suivant.
- **Le minuteur ne doit pas empêcher le serveur de rendre la main.** Un conteneur
  qu'on remplace envoie son signal, et un serveur qui l'ignore se fait tuer après
  un délai, avec une base qu'il n'a pas refermée.
- **Le profil mesuré ne bouge pas.** Ce que les trajets ont montré est déjà
  cumulé. Il faut le vérifier au chiffre avant et après un passage qui efface,
  pas le supposer.
- **Effacer zéro session est le cas normal**, et ne doit rien écrire de bruyant
  dans le journal. Sur la base d'aujourd'hui, tout est archivé.

## Critères d'acceptation

- [x] Le serveur applique la règle à son démarrage, puis toutes les 24 heures
- [x] Ce qui est effacé et ce qui est retenu s'écrivent dans le journal du
      conteneur, avec les raisons
- [x] Un passage qui échoue laisse le serveur servir
- [ ] Le serveur s'arrête proprement pendant qu'un minuteur est armé — le
      minuteur est détaché de la boucle (`unref`) et coupé au signal, mais cela
      n'a été vérifié qu'en lisant le code : sous Windows, tuer un processus
      n'envoie pas de vrai signal. Se verra au premier remplacement du conteneur
- [x] Le profil mesuré est inchangé après un passage qui efface — vérifié au
      chiffre, avant et après
- [ ] Sur la base de production, un passage n'efface rien et reste discret —
      vérifié sur une base de test entièrement archivée ; reste à le constater en
      production
- [x] Une session effacée par la règle se relit depuis l'archive téléchargée
      avant — le parcours complet est vérifié une fois
