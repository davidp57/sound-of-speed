# 13 — Ce qui est en clair sur le serveur

**Statut :** ✅ fait — verdict rendu : on ne chiffre pas dans l'application

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il fallait obtenir

Les traces sont des positions relevées au fil d'un trajet : c'est la donnée
sensible du projet, bien plus qu'un réglage de son. Personne n'avait regardé ce
que ça implique. Ce ticket rend un **verdict écrit** plutôt que du code.

## Critères d'acceptation

- [x] Le verdict dit ce qui est stocké et sous quelle forme, sans rien omettre.
- [x] Il dit qui peut lire ces données en dehors de l'application, sauvegardes
      comprises.
- [x] Il tranche, et le raisonnement est écrit — pas seulement la conclusion.
- [x] Ce qui est décidé et demande du code part en ticket ; ce qui est décidé et
      n'en demande pas est écrit dans la documentation de référence.

## Ce qui est stocké, et sous quelle forme

Tout vit dans un seul fichier de base, dans le volume de données du serveur.

| Ce que c'est | Forme |
|---|---|
| **Les traces** — un point par seconde, position comprise | en clair, tranches compressées telles qu'elles sont montées |
| Les tranches de journal | pareil |
| Les relevés de mesure et le profil mesuré | en clair |
| Les profils, moteurs et boîtes | en clair — ce sont des réglages |
| L'adresse d'un compte | en clair, comme dans toute base de comptes |
| Le mot de passe | **jamais** : seule son empreinte est rangée |
| Le code de liaison | **jamais** : seule son empreinte est rangée |
| Le témoin de session | signé par le secret du serveur |

**Le point sensible est un seul : les traces.** Une position par seconde sur
plusieurs trajets, c'est le domicile, le lieu de travail et les habitudes. Les
réglages de son, à côté, ne sont rien.

## Qui peut les lire

David, le 15 septembre 2026 : « personne, c'est local et les backups aussi ».

Une seule personne administre la machine, elle n'est pas exposée hors du réseau
local pour l'administration, et les sauvegardes restent sur place. Il n'y a donc
ni tiers, ni copie qui parte ailleurs.

## Le verdict : on ne chiffre pas dans l'application

**Parce que ça ne protégerait de rien.** Le serveur doit lire cette base à chaque
requête : il lui faut la clé, donc la clé vit sur la même machine que les
données. Qui obtient la machine obtient les deux. Un chiffrement applicatif
ajouterait du code sur tous les chemins de lecture et d'écriture, compliquerait
la reprise et les migrations, et n'écarterait aucune menace réelle.

**Le seul risque qu'un chiffrement écarterait est le vol du disque**, et il ne se
traite pas dans l'application : Synology chiffre un dossier partagé entier, en
une case à cocher, et cela couvre du même coup les sauvegardes et tout ce qui est
posé à côté. Si ce risque devient réel — un NAS qui déménage, une machine
d'occasion revendue —, c'est ce levier-là qu'il faut, pas du code ici.

**Ce qui protège vraiment les traces est ailleurs, et existe déjà :**

- elles ne partent **que** si l'on met le réglage de remontée à son dernier cran,
  qui demande une confirmation nommant ce qui va partir ;
- la **règle de rétention** les efface après leur délai, sauf ce qu'on épingle —
  c'est-à-dire que le stock ne grossit pas indéfiniment ;
- chaque compte ne lit que les siennes, ce que le ticket 06 prouve maintenant
  route par route ;
- et l'on peut **tout emporter puis tout effacer** depuis l'écran du compte.

Le meilleur geste de confidentialité sur ce projet n'est donc pas un chiffrement,
c'est un délai de rétention court. Ça ne demande aucun code : c'est une variable.

## À rouvrir si

- le serveur cesse d'être administré par une seule personne ;
- les sauvegardes partent ailleurs que sur place ;
- ou quelqu'un d'autre que son propriétaire dépose des traces dessus.
