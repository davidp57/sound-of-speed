# 05 — Le dépôt sait s'il a été analysé, et de quelle exemption il relève

**Statut :** ⬜ prêt

**Bloqué par :** [04 — Le dépôt sait quand le trajet a eu lieu](04-la-date-du-trajet-en-base.md).
Même table, et la migration de 04 doit être passée avant qu'une seconde y touche.

## Ce qu'il faut obtenir

Deux choses se lisent désormais sur un dépôt, et la liste du relecteur les
montre.

**S'il a été analysé.** Le profileur traite chaque trace à son arrivée ; ce qu'il
en a fait se marque sur le dépôt — traité, ou pas encore. Sans cette marque, rien
ne distingue « il n'y avait rien à en tirer » de « on n'a pas encore regardé », et
la règle d'effacement confondrait les deux.

**De quelle exemption il relève.** Aujourd'hui un dépôt est épinglé ou non, et
les 94 le sont tous. Deux natures apparaissent :

- **l'épingle**, posée à la main sur une session qu'on veut garder — un choix,
  qui sera borné ;
- **l'archive**, posée par la reprise sur ce qui vient d'un ancien serveur — un
  fait, qui ne l'est pas.

Les 94 dépôts repris deviennent des archives. Les confondre obligerait soit à
leur retirer leur exemption, soit à laisser la borne sans effet.

## Ce à quoi il faut faire attention

- **Écarté n'est pas « pas analysé ».** Une session trop courte que le profileur
  refuse a été regardée : elle ne montre rien, et elle est effaçable. Une session
  jamais soumise au profileur ne l'est pas. Les six départs avortés de la base
  sont du premier cas.
- **Une tranche illisible ne bloque pas sa session.** Le profileur écarte la
  tranche et nomme ce qu'il a laissé ; la session reste analysée.
- **Le rattrapage au démarrage marque aussi.** Une trace déposée pendant que le
  serveur était arrêté est analysée au redémarrage ; elle doit en porter la
  marque comme les autres.
- **La marque d'analyse suit le procédé.** Le profileur relit tout quand son
  procédé a changé, parce que l'ancien cumul ne vaut plus rien. Ce qui était
  marqué avec l'ancien procédé ne dit plus la vérité.
- **Le journal n'est pas analysé.** Il ne passe pas par le profileur. Son
  effacement ne peut donc pas dépendre d'une marque d'analyse, et sa règle est
  ailleurs.

## Critères d'acceptation

- [ ] Une trace qui arrive est marquée analysée une fois le profileur passé
- [ ] Une session que le profileur a écartée est marquée analysée, et non « pas
      encore vue »
- [ ] Une trace déposée serveur arrêté est marquée au rattrapage du démarrage
- [ ] Un changement de procédé du profileur invalide les marques, et le décompte
      le dit
- [ ] Les 94 dépôts repris sont des archives, pas des épingles
- [ ] La liste du relecteur distingue analysé, épinglé et archivé
