# REMONTEE — tout ce qui naît dans la voiture remonte tout seul

**Statut :** ⬜ prêt
**Branche :** `feature/remontee`
**Version visée :** 0.4

## Le besoin, dans les mots de David

> « l'objectif est de déposer régulièrement, en automatique sur le NAS, avec une
> option en opt-in comme décrit dans le PRD, les traces, les logs, les relevés
> de mesure, les profils, tout ce qui peut servir à la fois de mémoire pour
> l'utilisateur et de source de données pour le debugging et le réglage des
> paramètres plus tard sur PC »

Le point de départ était plus étroit — pousser les relevés de mesure sur le NAS,
laissé hors périmètre par
[MOTEURS-EN-VOITURE](../MOTEURS-EN-VOITURE/spec.md). Il est élargi à toutes les
données que la voiture produit, et ce n'est pas la même chose : une remontée
nature par nature aurait donné quatre mécanismes, quatre endroits où l'accord se
règle, et quatre façons d'échouer sans le dire.

## Ce qui existe déjà

- **Le tuyau.** nginx reçoit un fichier par `PUT`, authentifié, éprouvé sur le
  NAS depuis le 3 septembre 2026. Aucun service à ajouter à la pile.
- **Le journal** part tout seul, par tranches de cinq minutes, et ce qui n'a pas
  pu partir se joint à la tranche suivante. Il a son accord à trois positions.
- **Une trace** se dépose d'un geste, depuis l'écran de télémétrie.
- **Les profils du serveur** se lisent — la bibliothèque les liste — mais le
  dossier est monté en lecture seule : rien ne s'y dépose depuis l'application.
- **La sonde** affiche son relevé et propose de le copier. Dans la voiture, la
  copie ne mène nulle part : c'est précisément là que le relevé se prend.

## Ce qui manque

**Chaque nature a son chemin, ou n'en a pas.** Le journal part seul, la trace
demande un geste, le profil n'a aucune voie, le relevé de mesure non plus. Deux
modules de dépôt existent déjà et se ressemblent ; un troisième et un quatrième
auraient divergé.

**Rien ne repart au retour du réseau, sauf le journal.** Une trace enregistrée
dans un secteur sans couverture — le cas normal sur une route — échoue et reste
là. C'est le ticket 04 de [DEPOSER](../DEPOSER/spec.md), jamais fait.

**L'accord ne gouverne que le journal.** Si les traces et les profils se mettent
à partir tout seuls, la promesse faite à l'utilisateur doit couvrir tout ce qui
part, et non une nature sur quatre.

## Les décisions

### 1. Un seul mécanisme, et une file d'attente

Tout ce qui remonte passe par une **file** persistée : on y pose un dépôt, elle
l'envoie quand elle peut, et ce qui est parti la quitte. Le hors-réseau cesse
alors d'être un cas particulier de chaque producteur.

La file est **bornée**. Le stockage local a déjà échoué à garder une trace
longue, et cet échec est signalé — c'est un acquis. Une file qui grossit sans
fin rendrait ce défaut plus fréquent, pas moins.

### 2. Un accord unique, à trois positions, et une table

L'accord du journal devient l'accord de la remontée. Rien ne part par défaut.

| Position | Ce qui remonte tout seul |
|---|---|
| **Rien n'est envoyé** | rien, et le journal n'est même pas tenu |
| **Le minimum** | le journal, les relevés de mesure, les profils |
| **Et la conduite** | en plus : les traces enregistrées, et la position dans le journal |

**Pourquoi les traces au troisième cran et non au second.** Une trace ne contient
aucune coordonnée — c'est écrit dans le README, et c'est ce qui permet de
l'exporter sans accord. Mais elle porte la conduite à la cadence du GPS là où le
journal n'en garde qu'un relevé toutes les dix secondes, et une conduite complète
et datée en dit long. On la met donc du même côté que la position.

**Un profil ne dit rien de l'utilisateur** : ce sont des réglages de son. Il est
au minimum sans hésitation.

### 3. Un dossier par nature, et les profils s'ouvrent en écriture

`traces/` et `journal/` existent. Les relevés de mesure vont dans un dossier
`mesures/`. Les profils vont dans `profiles/`, celui-là même que la bibliothèque
lit déjà — c'est tout l'intérêt d'un profil déposé — et il passe donc en
écriture, authentifiée comme les autres.

Un profil déposé porte un nom **stable**, tiré de son identifiant : le déposer à
nouveau remplace sa version précédente au lieu d'accumuler des copies. C'est une
synchronisation, pas un archivage.

### 4. Le geste manuel reste

Le bouton de dépôt d'une trace ne disparaît pas. Il sert quand l'accord est à
« rien n'est envoyé », et il sert à ne pas attendre.

## Histoires

1. En tant que conducteur, je veux que ce que j'ai enregistré en roulant se
   retrouve sur mon poste sans que j'aie à y penser.
2. En tant que conducteur, je veux savoir ce qui est parti et ce qui attend, sans
   avoir à le deviner.
3. En tant qu'utilisateur, je veux régler un profil dans la voiture et le
   retrouver sur les autres appareils.
4. En tant que développeur, je veux relire trois semaines plus tard ce que la
   voiture a vécu et mesuré, sans dépendre de ce qui a été recopié à la main.
5. En tant qu'utilisateur, je veux que rien ne parte tant que je ne l'ai pas dit,
   et savoir exactement ce qui part quand je le dis.

## Ce que cela pèse

Ordres de grandeur, pour un trajet d'une demi-heure :

| Nature | Poids | Cadence |
|---|---|---|
| Journal, minimum | ~25 Ko | une tranche par cinq minutes |
| Journal, avec position | ~200 Ko | idem |
| Trace | de 50 Ko à quelques Mo | une par enregistrement |
| Profil | quelques Ko | à l'enregistrement, sans répéter |
| Relevé de mesure | moins de 5 Ko | à la demande |

## Hors périmètre

- Un service de synchronisation, un compte, une base. Le projet s'en passe depuis
  le début.
- La **relecture** depuis le NAS de ce qui a été déposé — sauf les profils, que
  la bibliothèque lit déjà. Récupérer une trace déposée se fait par le
  gestionnaire de fichiers.
- Le ménage sur le NAS. Ni `DELETE` ni `MKCOL` ne sont ouverts, et cela ne change
  pas : un témoin qui peut effacer ses notes est un mauvais témoin.

## Ce qu'il reprend d'ailleurs

- [DEPOSER](../DEPOSER/spec.md), ticket 03 — déposer un profil.
- [DEPOSER](../DEPOSER/spec.md), ticket 04 — un dépôt en attente part au retour
  du réseau.
- [SYNTHESE](../SYNTHESE/tickets/01-la-sonde.md) — le relevé de la sonde, qui
  attend d'être fait dans la Tesla et n'en sortirait pas.

## Deux gestes sur le NAS, et ils sont à David

1. Créer le dossier `mesures/` à côté des autres, avec File Station.
2. Repasser `profiles/` en lecture-écriture dans la pile, puis redéployer.

Rien de tout cela n'empêche d'écrire ni de vérifier le code : le dépôt échoue
proprement et le dit tant que les deux gestes ne sont pas faits.
