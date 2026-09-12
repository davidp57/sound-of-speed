# 08 — Un conteneur, un langage, et la mesure qui manquait

**Statut :** 🧑 attend David — tout est livré sauf ce qui se mesure sur le NAS

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

- [x] Le fichier de pile ne déclare qu'un service, et **le second conteneur
      n'est plus déclaré nulle part** — critère venu du ticket 07, où le retirer
      aurait cassé la production : elle tourne encore sur l'ancien serveur, dont
      le profil mesuré est écrit par ce service-là
- [x] Les migrations sont jouées au démarrage du conteneur, sans intervention
- [x] La pile tourne à son adresse, et la production est intacte. **Vérifié sur
      le NAS le 12 septembre 2026**, en 0.2.12 : l'image démarre sur
      l'architecture du NAS, Portainer la tire, le proxy inversé la sert. Elle a
      pris le port de la pile d'intégration, arrêtée — le serveur fait le travail
      de ses deux conteneurs
- [ ] Le débit et la latence de `/audio/` sont **mesurés sur le NAS**, comparés à
      nginx, et le chiffre est écrit — pas « ça marche »
- [x] L'application se charge hors réseau après une première visite, depuis le
      nouveau serveur
- [x] Le test d'accord passe **en entier** contre la pile d'intégration

## Ce qui est livré

**La pile à un service**, son image, et sa documentation. Elle se colle dans
Portainer, ne demande qu'un dossier de données et, si l'on veut protéger les
dépôts, un fichier de mots de passe. La base se crée et se migre toute seule.

**Le contrôle qui manquait à tout le lot.** Tout ce qui précède s'exécutait hors
conteneur et ne disait rien de l'image : ni que les dépendances s'y installent —
le pilote de la base est un binaire choisi par plateforme —, ni que les
migrations s'y jouent, ni que le serveur y démarre. L'intégration continue
construit désormais l'image, la lance, et lui fait passer le contrat.

**Et la promesse du ticket 03 est enfin vérifiée** : un profil déposé, le
conteneur **détruit et remplacé**, le profil toujours là. Elle avait été cochée
avec réserve faute de conteneur qui porte cette base ; il y en a un.

## Ce qui reste, et pourquoi ça ne peut pas être fait ici

Trois critères portent la marque 🧑. Ils ont en commun de demander soit le NAS,
soit un navigateur :

- **le débit des échantillons**, qui est le vrai critère de ce lot et qui ne se
  prend que sur le disque visé ;
- **la pile collée dans Portainer**, qui est une action sur l'infrastructure de
  David ;
- **la lecture hors réseau**, qui demande un navigateur pointé sur cette pile.

Le second conteneur, lui, **continue d'être publié** : la production tourne
encore sur l'ancienne pile, et cesser de publier cette image la laisserait sans
profil mesuré au premier redéploiement. Il s'arrêtera avec la bascule.

## Ce que le nouveau contrôle a trouvé à sa première exécution

**La bibliothèque qui vérifie les mots de passe était rangée parmi les
dépendances de développement.** Elle y était pour un script d'outillage, et le
serveur s'est mis à en dépendre sans qu'elle change de place. L'image n'installe
que les dépendances de production : le conteneur démarrait, jouait ses
migrations, puis mourait sur un module introuvable.

Rien d'autre ne pouvait le voir. Tout le reste du lot s'exécute hors conteneur,
là où les dépendances de développement sont présentes.

Un second contrôle a été ajouté dans la foulée : il lit ce que le paquet assemblé
importe vraiment et exige que chacun soit déclaré en production. Il dit la même
chose que la construction d'image, en une seconde et sans Docker — et il a été
vu refuser la régression avant d'être gardé.
