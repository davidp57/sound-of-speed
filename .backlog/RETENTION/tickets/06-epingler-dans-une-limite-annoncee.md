# 06 — Épingler une session, dans une limite annoncée

**Statut :** ✅ fait

**Bloqué par :** [05 — Le dépôt sait s'il a été analysé, et de quelle exemption il relève](05-l-etat-d-analyse-et-les-deux-exemptions.md),
qui pose les deux natures d'exemption.

## Ce qu'il faut obtenir

Devant la liste des trajets, on épingle une session qu'on veut garder, et on la
désépingle. L'épingle exempte de l'effacement automatique.

Le nombre d'épingles est **borné**, et la borne se voit : un compteur dit où on
en est, et une demande au-delà est refusée avec un message qui dit quoi faire —
désépingler autre chose, ou télécharger.

La valeur par défaut est **20 sessions**. Elle se règle par l'environnement du
serveur, là où le reste se règle déjà.

## Ce à quoi il faut faire attention

- **L'archive ne compte pas dans la borne.** Les 14 sessions reprises sont des
  archives, pas des choix ; les faire entrer dans le compte remplirait la borne
  avant la première épingle.
- **La borne n'a aucun effet aujourd'hui.** Il y a un seul compte et il porte 14
  sessions archivées. Elle existe pour le jour où les comptes ne sont plus un
  seul, et il faut qu'elle soit vérifiée par un test plutôt que par l'usage.
- **Épingler porte sur la session entière.** Trace et journal ensemble ; on ne
  choisit pas une tranche.
- **Un dépôt ordinaire ne désépingle rien.** La voiture rejoue un envoi sous le
  même nom ; le redéposer ne doit pas retirer l'épingle ni l'archive. C'est déjà
  la règle du dépôt, elle ne doit pas se perdre ici.
- **Un refus est un refus, pas une panne.** Le message doit dire la borne
  atteinte et l'action possible.

## Critères d'acceptation

- [x] On épingle et on désépingle une session depuis le relecteur
- [x] Une session épinglée le reste après un nouveau dépôt sous le même nom
- [x] La borne refuse l'épingle au-delà, avec un message qui dit quoi faire
- [x] Les sessions archivées ne comptent pas dans la borne
- [x] Le compteur affiche l'état — épinglées sur borne
- [x] La borne se règle par l'environnement — `SPEED_EPINGLES` —, et vaut 20 par
      défaut
