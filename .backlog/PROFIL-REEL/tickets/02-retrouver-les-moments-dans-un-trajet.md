# 02 — Retrouver dans un trajet ordinaire les moments que le protocole demande

**Statut :** ✅ fait — livré le 11 septembre 2026

**Bloqué par :** 01 — Lire une capture déposée. Il n'y a rien à découper tant
qu'on ne sait pas lire.

## Ce qu'il faut obtenir

**Que le trajet d'un matin ordinaire rende ce que six étapes guidées rendaient.**
Le protocole demande au conducteur de garantir le contexte : « pars de l'arrêt
et accélère franchement », « roule une minute en ville ». Personne ne le
garantit sur un trajet ordinaire — il faut le reconnaître dans le signal.

Les critères existent déjà, écrits dans `analyze.ts`, et ils disent exactement
ce qu'on cherche : une accélération franche part de moins de 3 km/h, gagne plus
de 30 km/h et dépasse 2 m/s² ; une étape d'autoroute pratique plus de 90 km/h et
contient au moins un palier. On les applique à des fenêtres du trajet au lieu
d'un enregistrement entier.

Ce ticket ne traite **pas** les ralentissements : distinguer un pied levé d'un
freinage est le ticket 03.

## Ce que la trace réelle a appris

**Le critère du protocole ne trouvait rien.** Il exige un départ arrêté, et sur
le trajet du 11 septembre aucune accélération n'en partait au-dessus du seuil —
les trois départs relevés montaient à 3 ou 4 km/h en une seconde. Pourtant 285
relevés dépassaient 2 m/s², jusqu'à 3,38 : toutes les accélérations franches du
trajet étaient des **relances en roulant**.

D'où deux relevés distincts plutôt qu'un : les **départs** disent comment la
voiture s'élance, les **mises de gaz** disent ce qu'elle a sous le pied. Le
protocole exigeait l'arrêt pour garantir qu'on mesurait bien une mise des gaz ;
sur un trajet ordinaire, la garantie vient d'ailleurs — une accélération
soutenue au-dessus du seuil ne s'obtient pas en roue libre.

Relevé sur le trajet : 8 mises de gaz franches, de 2,35 à 3,38 m/s², aux mêmes
instants que les rétrogradages forcés entendus ce matin-là.

## Critères d'acceptation

- [ ] Un trajet rend ses départs arrêtés, ses accélérations franches, et ses
      paliers rangés par régime — ville, route, autoroute — selon les mêmes
      seuils que le protocole.
- [ ] Le recollage des paliers est en place **avant** le filtre de durée : sans
      lui, 0,5 km/h de bruit coupe un palier de 80 s en vingt-sept morceaux.
- [ ] Le plancher de 5 km/h tient : un feu rouge n'est pas le palier le mieux
      tenu du trajet.
- [ ] Relevé sur la session du 11 septembre, et les comptes sont confrontés à ce
      que le relecteur montre du même trajet.
- [ ] Contrôle qualité vert.
