# 08 — Un conteneur, un langage, et la mesure qui manquait

**Statut :** ⬜ prêt

**Bloqué par :** 04 — Le serveur sert l'application · 07 — Le profileur devient
un module.

## Ce qu'il faut obtenir

Une pile à **un seul service**, tirée du registre, migrations jouées au
démarrage, déployée sur l'étiquette d'intégration à son adresse. La production
continue de servir dans la voiture et fait repli ; la bascule se fera quand le
neuf convaincra.

## La mesure, qui est le vrai critère de ce lot

Servir les échantillons en Node aussi bien que nginx le faisait : vingt-trois
mégaoctets, des requêtes par plage d'octets, sur le disque d'un NAS Synology.
C'est annoncé faisable depuis le début de ce lot et **ça n'a jamais été
mesuré**.

Le chiffre se prend sur le NAS et nulle part ailleurs : ni un poste de
développement ni l'intégration continue ne disent quoi que ce soit du disque
d'un NAS derrière un proxy. Si l'écart est défavorable, il est meilleur de le
savoir avant la bascule que de l'entendre en roulant.

## Critères d'acceptation

- [ ] Le fichier de pile ne déclare qu'un service
- [ ] Les migrations sont jouées au démarrage du conteneur, sans intervention
- [ ] La pile d'intégration tourne à son adresse, et la production est intacte
- [ ] Le débit et la latence de `/audio/` sont **mesurés sur le NAS**, comparés à
      nginx, et le chiffre est écrit — pas « ça marche »
- [ ] L'application se charge hors réseau après une première visite, depuis le
      nouveau serveur
- [ ] Le test d'accord passe **en entier** contre la pile d'intégration
