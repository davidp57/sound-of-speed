# 06 — Le service qui tourne sur le NAS

**Statut :** ✅ sans objet le 17 septembre 2026 — le conteneur séparé n'existe plus depuis que SERVEUR a tout réuni en un service, et le profil mesuré est servi à jour : 6 trajets, `pushPeakMs2` 5,5455, relevé sur le serveur

**Bloqué par :** 04 — il n'y a rien à faire tourner tant que le calcul ne sait
pas se compléter.

## Ce qu'il faut obtenir

**Un second conteneur dans la pile, à côté de nginx.** Il voit les tranches
arriver, met l'agrégat à jour, et écrit le résultat là où l'application saura le
lire.

Il importe `src/core/` tel quel, et c'est tout l'intérêt : **un seul calcul**.
Un service écrit ailleurs donnerait deux procédés pour la même grandeur, et ils
divergeraient — la revue du 11 septembre a trouvé cinq défauts de ce genre en
une journée, tous nés d'un état dupliqué.

Le NAS ne construit rien et n'ouvre pas de terminal : l'image arrive prête,
publiée par la même chaîne d'intégration que celle de l'application, et
Portainer la tire.

## Ce qui est vérifié, et ce qui ne l'est pas

**Vérifié**, en faisant tourner le service pour de vrai sur le dossier de traces
rapatrié du 11 septembre : il lit les tranches, mesure le trajet, écrit le
fichier de profil, et ignore sans bruit les trois sessions avortées de ce
matin-là. Une tranche illisible est écartée et nommée sans faire tomber le
trajet ; une ligne tronquée — le cas normal d'un réseau qui lâche — ne fait rien
tomber du tout.

```
profileur : …/traces vers …/profils, toutes les 1000 ms
profil mis à jour : 1 trajets, complet

  accél max   3.38 m/s²      vitesse    151 km/h
  frein max  -2.46 m/s²      écartées          0
```

**Pas vérifié** : que le conteneur tourne sur le NAS. Le proxy du poste de
travail bloque le serveur et Portainer n'y est pas joignable ; l'image est
écrite, publiée par la même chaîne que l'application, et ajoutée aux deux piles,
mais c'est David qui verra si elle démarre.

**Une décision à connaître** : le service reçoit ses accès au disque au lieu de
les prendre. C'est ce qui a permis de l'éprouver sur un dossier en mémoire puis
sur le dossier réel, sans conteneur ni serveur — et c'est ce qui a donné les
chiffres ci-dessus.

## Critères d'acceptation

- [x] Le conteneur se construit et se publie avec l'application, sans étape
      manuelle.
- [x] Il détecte une tranche déposée et met l'agrégat à jour.
- [x] Le résultat est lisible par l'application, avec le compte de trajets qui
      le fondent et la date du dernier calcul.
- [x] Il survit à un redémarrage sans reperdre son agrégat.
- [x] Une tranche illisible ou tronquée ne l'arrête pas : elle est écartée et
      nommée.
- [x] La pile mise à jour est documentée dans le README, comme celle de
      l'application.
- [x] Contrôle qualité vert.
