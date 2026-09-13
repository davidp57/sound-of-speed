# 07 — Voir ce que la règle emporterait, sans rien effacer

**Statut :** ⬜ prêt

**Bloqué par :** [04 — Le dépôt sait quand le trajet a eu lieu](04-la-date-du-trajet-en-base.md),
[05 — Le dépôt sait s'il a été analysé, et de quelle exemption il relève](05-l-etat-d-analyse-et-les-deux-exemptions.md),
[06 — Épingler une session, dans une limite annoncée](06-epingler-dans-une-limite-annoncee.md).
La règle a besoin des trois pour décider.

## Ce qu'il faut obtenir

La règle de rétention est écrite, et elle rend son verdict **sans rien
supprimer** : quelles sessions partiraient, à quelle date, combien d'octets, et
pour chacune de celles qui restent, la raison qui la retient.

Le relecteur affiche ce verdict.

C'est le ticket qui permet de juger les seuils sur les vraies données avant que
quoi que ce soit disparaisse. Aucun contrôle ne dira qu'un délai est trop court :
un mauvais seuil efface des données et rien ne rougit. La seule façon de le
savoir est de regarder le verdict d'abord.

## La règle

Une session part quand **toutes** ces conditions tiennent :

- sa date d'enregistrement est plus vieille que le délai ;
- le profileur l'a traitée ;
- elle n'est ni épinglée ni archivée.

Les délais, réglables par l'environnement du serveur :

| Ce qui est concerné | Défaut | Le raisonnement |
|---|---|---|
| Une session de trace | 30 jours | Un mois pour revoir un trajet qu'on a encore en tête, et pour télécharger ce qu'on garde |
| Un journal sans trace | 14 jours | Le délai entre « ça a fait quelque chose de bizarre » et le moment où on va voir |

**Le journal d'une session qui a une trace suit sa trace**, et part avec elle.
Deux délais stricts couperaient une session en deux : à vingt jours on relirait
un trajet ayant perdu ses faits marquants. Sur la base de production, deux
sessions ont les deux, six n'ont que la trace, quatre n'ont que le journal.

## Ce à quoi il faut faire attention

- **Le verdict n'efface rien.** C'est tout l'intérêt du ticket. La suppression
  est le ticket suivant.
- **Le verdict dit aussi pourquoi on garde.** « Retenue » sans raison ne se
  vérifie pas : épinglée, archivée, trop récente, pas encore analysée.
- **Les deux traces sans session ne se rangent nulle part.** Elles sont
  archivées, donc retenues, mais le verdict doit les nommer plutôt que de les
  taire.
- **Sur la base d'aujourd'hui, le verdict doit être vide.** Les 14 sessions sont
  archivées. Un verdict non vide sur ces données-là signale un défaut, pas un
  seuil à discuter.
- **Les délais se mesurent sur la date d'enregistrement**, jamais sur la date de
  dépôt — c'est le sens du ticket 04.

## Critères d'acceptation

- [ ] La règle rend un verdict : sessions à effacer, dates, octets
- [ ] Chaque session retenue est accompagnée de la raison qui la retient
- [ ] Une session non analysée est retenue, quelle que soit son ancienneté
- [ ] Le journal d'une session à trace suit le délai de sa trace ; un journal
      seul suit le délai court
- [ ] Les délais se règlent par l'environnement, et valent 30 et 14 jours par
      défaut
- [ ] Le verdict est vide sur la base de production, et les deux traces sans
      session y sont nommées comme retenues
- [ ] Rien n'est supprimé par ce ticket, et un test le vérifie
