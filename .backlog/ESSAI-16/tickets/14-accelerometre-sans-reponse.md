# 14 — L'accéléromètre ne répond pas, et on ne peut pas savoir pourquoi

**Statut :** ⬜ prêt

David, le 17 septembre 2026 : « hier j'ai essayé d'activer l'accéléromètre, mais
j'ai pas l'impression qu'il fonctionne ».

## Ce qui existe, et ce qui n'existe pas

La sonde est arrivée le 10 septembre 2026 (`599133e`), dans l'écran de
télémétrie. Elle pose trois questions auxquelles aucune documentation ne répond
pour **cette** voiture : à quelle cadence les relevés arrivent, si l'accélération
sans la gravité est renseignée, et quelle amplitude on observe. L'écoute ne
démarre pas seule — iOS exige un geste, et un relevé de diagnostic n'a pas à
tourner quand personne ne le regarde.

**Il n'y a aucun ticket sur ce sujet, et aucune donnée.** Ce point est le premier.

## Pourquoi on ne peut rien vérifier après coup

Le résultat de la sonde **ne sort pas de l'écran**. Il n'est ni journalisé, ni
déposé : la liste fermée des genres d'événements du journal
(`core/journal/journal.ts`) n'en porte aucun pour l'accéléromètre. Recensé sur
les trois trajets du 16 septembre, le journal contient `sample`, `pace`,
`reject`, `shift`, `source`, `fix-restart`, `profile`, `device` et `audio` — et
rien d'autre.

Donc David ne peut rien dire de plus que « ça n'a pas l'air de fonctionner », et
personne ne peut savoir ce que la sonde a vu. **C'est le même défaut que la sonde
de synthèse** (REMONTEE/04, abandonné) : un diagnostic qu'on lit à l'écran, dans
une voiture, sans moyen de l'en faire sortir.

## Les trois hypothèses, à départager

1. **L'API existe mais aucun capteur ne l'alimente.** C'est l'hypothèse la plus
   probable : l'écran d'une Tesla est fixe, et `DeviceMotionEvent` est présent
   dans tout Chromium. La photo de David montre d'ailleurs le statut « à
   démarrer », donc l'API est bien là. L'écoute démarrerait alors sans qu'aucun
   événement n'arrive jamais.
2. **L'autorisation est refusée sans le dire.** Le code gère `requestPermission`
   pour iOS ; un refus silencieux laisserait le même écran vide.
3. **L'écoute démarre et les relevés arrivent**, mais l'affichage ne se
   rafraîchit pas — le rendu est limité par `motionLastPaint`.

## Ce qu'il faut faire, dans l'ordre

1. **Faire sortir le résultat.** Un genre d'événement au journal, écrit une fois
   quand l'écoute démarre et une fois quand elle s'arrête : statut, nombre de
   relevés reçus, cadence observée, présence de l'accélération sans gravité.
   Sans cela, toute la suite se fait à l'aveugle.
2. **Alors seulement**, conclure. Si l'hypothèse 1 est la bonne, la sonde n'a
   plus de raison d'être dans la voiture et l'écran doit le dire au lieu de
   laisser croire qu'on peut essayer.

## Ce que cela déciderait

La sonde n'est pas un caprice : l'accélération vient aujourd'hui de la vitesse
GPS, qui traîne derrière ce que fait la voiture, et c'est d'elle que dépendent la
charge, donc le son, donc les passages de rapport. Un accéléromètre la mesurerait
directement. Si la voiture n'en donne pas, cette voie se ferme — et il vaut mieux
le savoir écrit une fois pour toutes.

## Critères d'acceptation

- [ ] Le journal porte ce que la sonde a vu, sans que David ait rien à noter.
- [ ] On sait laquelle des trois hypothèses est la bonne, chiffres à l'appui.
- [ ] L'écran dit la vérité : soit la sonde donne quelque chose, soit elle
      annonce que cet appareil n'a pas d'accéléromètre.
