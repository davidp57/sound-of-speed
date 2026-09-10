# 01 — La capture démarre toute seule et remonte par tranches

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

David monte dans sa voiture, ouvre l'application, roule, rentre. Sans avoir rien
touché, il trouve sur le serveur une capture complète de son trajet, découpée en
tranches, avec de quoi la rejouer et de quoi savoir dans quelles conditions elle
a été faite.

La capture démarre quand le GPS démarre, à condition que l'accord de remontée
soit au dernier cran. Elle s'arrête avec lui. Elle n'existe pas du tout aux
autres crans — l'accord gouverne, et rien ne s'écrit qu'on n'enverrait pas.

Chaque échantillon porte ce que la source a émis et ce que la chaîne en a fait
au même instant. Chaque tranche porte un en-tête qui décrit la session : profil
actif, moteur, boîte, voiture, version de l'application. Un changement de profil
en cours de route s'inscrit comme un événement daté, sans quoi la fin de la
session serait relue avec la configuration du début.

Rien n'est conservé dans le navigateur au-delà de ce que la file de remontée
garde pour renvoyer.

## Critères d'acceptation

- [ ] Le GPS démarre, l'accord est au dernier cran : la capture démarre sans
      aucun geste.
- [ ] L'accord est à un cran inférieur : rien n'est capturé, rien n'est écrit.
- [ ] Une tranche déposée contient l'en-tête complet et se relit seule.
- [ ] Un échantillon porte la vitesse brute, sa précision, son origine, et le
      régime, le rapport et la charge calculés au même instant.
- [ ] Un changement de profil en cours de session apparaît comme un événement
      daté.
- [ ] Une coupure du GPS puis sa reprise laissent une seule session, avec un
      trou.
- [ ] La capture porte l'identifiant de session du journal, pour qu'on puisse
      apparier les deux.
- [ ] Coupure du réseau en roulant : les tranches partent au retour, sans perte.
