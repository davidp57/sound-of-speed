# 14 — Offrir la source depuis l'application

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

La licence du projet couvre l'usage **en service** : qui se sert de l'application
par le réseau doit pouvoir en obtenir la source. Aucun écran ne la propose
aujourd'hui, et rien ne dit de quelle version on se sert.

Après ce ticket, l'application dit d'où elle vient et de quel état elle est
construite, à un endroit qu'on trouve sans chercher. Ça remplit l'obligation, et
ça sert au support : un défaut rapporté depuis la voiture devient rattachable à
un état précis.

C'est aussi ici qu'est écrit l'arbitrage sur l'**obscurcissement du code servi**,
et il est négatif. Le dépôt est public et la licence oblige à offrir la source :
obscurcir ce qu'on livre par ailleurs ne protège rien. Ça casse en revanche les
cartes de source, donc ça rend illisible l'endroit où ce projet a le plus de mal
à mesurer — la voiture, où certains défauts ne se voient nulle part ailleurs.

## Critères d'acceptation

- [ ] L'application donne le lien vers sa source et la version servie, trouvables
      sans chercher.
- [ ] La version affichée correspond à ce qui est construit, et se vérifie sur
      l'image publiée.
- [ ] L'arbitrage sur l'obscurcissement est écrit, avec sa raison, là où on le
      reproposera.
