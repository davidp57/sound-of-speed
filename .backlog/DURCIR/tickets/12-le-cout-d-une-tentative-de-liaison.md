# 12 — Ce que coûte une tentative sur le code de liaison

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le code de liaison tient sur huit caractères et vingt-quatre heures. Ce qui le
rend sûr n'est pas sa longueur mais l'impossibilité d'essayer vite — et cette
borne n'était vérifiée par rien : la bibliothèque la coupe hors production, donc
aucun test ne la voyait. Le calcul écrit à côté du code n'avait jamais été
confronté à ce que le serveur fait vraiment.

## Critères d'acceptation

- [x] Un test en configuration de production montre qu'au-delà de la borne les
      tentatives sont refusées.
- [x] Demander un code neuf ne laisse pas l'ancien ouvert au-delà de ce qui est
      décidé, et la règle est écrite.
- [x] Le calcul écrit à côté du code correspond à ce qui est mesuré, ou il est
      corrigé.

## La borne mord, et le calcul tient

**Mesuré le 15 septembre 2026** contre un serveur en production, vingt tentatives
d'affilée sur un code faux :

| Statut rendu | Nombre |
|---|---|
| 401 — le code n'ouvre rien | 10 |
| 429 — trop de tentatives | 10 |

La onzième est la première refusée, exactement la borne annoncée. Le calcul écrit
à côté du code est donc juste : trente caractères sur huit rangs font 656
milliards de combinaisons, dix essais par minute en laissent 14 400 sur les
vingt-quatre heures de validité, soit une chance sur quarante-cinq millions.

**La mesure n'entre pas dans le jeu d'accord**, délibérément : elle épuise la
borne, et le jeu tourne contre le serveur en service. Y placer ce cas fermerait
la liaison pendant une minute à chaque passage.

**À savoir pour plus tard** : la borne porte sur l'adresse de l'appelant. Derrière
un proxy inversé qui ne transmet pas l'adresse d'origine, elle devient commune à
tout le monde — ce qui la rend plus stricte, pas moins, mais permet à un inconnu
d'épuiser le quota de tout le monde. Sans conséquence à quatre utilisateurs.

## Un seul code vivant par compte

Rien ne l'empêchait : chaque demande ajoutait un code, et tous restaient ouverts
vingt-quatre heures. Deux raisons de le fermer, et la seconde pèse plus que la
première :

- le calcul de la borne suppose **un** code à deviner ; chaque code vivant divise
  d'autant la protection qu'il annonce ;
- surtout, un code aperçu par-dessus une épaule survivait à sa régénération, et
  l'écran qui en montre un nouveau laissait croire que l'ancien était mort.

Poser un code retire donc celui d'avant. Le jeton étant rangé sous l'empreinte du
code, on ne peut pas retrouver ceux d'un compte : un second renvoi, qui ne porte
lui aussi qu'une empreinte, dit quel code est le sien.

Vérifié : le premier code ne relie plus rien, le second si. Et la base ne porte
toujours de quoi ouvrir aucun compte — les deux rangées sont contrôlées.
