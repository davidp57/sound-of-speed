# PROFIL-REEL — le serveur apprend la vraie voiture et propose son profil

**Statut :** ⬜ prêt — spécifié le 11 septembre 2026, à découper
**Branche :** à ouvrir
**Version visée :** à décider

## L'idée

Les traces d'un trajet partent déjà au serveur, toutes seules, depuis le
10 septembre 2026. Elles portent ce qu'il faut pour connaître la voiture :
vitesse, accélération, régime, rapport, charge, à la cadence de l'appareil. Une
seule sortie en a laissé vingt-quatre mille relevés.

Le serveur peut donc **dériver le profil de la vraie voiture** — sa reprise, son
freinage, son ralentissement pied levé, les vitesses qu'on y pratique — à partir
de la conduite ordinaire. Sans protocole, sans que le conducteur roule exprès,
sans qu'il touche à rien.

Quand il estime en avoir assez, il le propose : **« profil de la voiture généré,
voulez-vous l'appliquer ? »**

David, le 11 septembre 2026 :

> le serveur peut utiliser ces enregistrements pour dériver les données de profil
> de la vraie voiture (performance) comme ce qui est fait avec l'écran dédié.
> Une fois qu'on estime avoir assez de données pour générer un profil, on popup
> un message sur l'écran de la voiture qui dit « profil de la voiture généré,
> voulez-vous l'appliquer ? ». Si oui, alors on l'applique. Si non, il est juste
> mis à disposition dans le navigateur. Dans tous les cas il reste disponible sur
> le serveur, on peut ajouter un bouton pour le récupérer.

## Ce que cela n'est pas

C'est la troisième pièce d'une série, et il faut les distinguer :

| | Qui mesure | Comment | Ce qu'on en fait |
|---|---|---|---|
| [ETALONNAGE](../ETALONNAGE/spec.md) | l'appareil | six étapes guidées, on roule exprès | on lit et on recopie à la main |
| [REFONTE](../REFONTE/spec.md) | l'appareil | idem | un interrupteur applique tout |
| **PROFIL-REEL** | **le serveur** | **la conduite ordinaire, sans rien demander** | **il propose, on accepte ou non** |

ETALONNAGE reste utile : il mesure vite et sur commande, et c'est l'outil quand
on veut un chiffre tout de suite. PROFIL-REEL mesure lentement et tout seul.

## Décisions déjà prises

- **Le serveur calcule, pas l'appareil.** C'est lui qui a les traces, et lui qui
  peut les relire toutes. L'appareil reçoit un profil, il ne le dérive pas.
- **Le profil vit dans le compte de l'utilisateur.** Les comptes n'existent pas
  encore ; c'est la dépendance principale, et elle vient de
  [REFONTE](../REFONTE/spec.md).
- **La proposition se refuse sans rien perdre.** Refusée, elle reste disponible
  dans le navigateur ; dans tous les cas le profil reste sur le serveur, et un
  bouton le récupère.

## Ce qu'il faut trancher

Ces points ne sont pas décidés, et ce lot ne prétend pas les trancher :

1. **Quelles grandeurs on dérive**, et par quel calcul. ETALONNAGE en a déjà
   éprouvé plusieurs, et noté ce qui rate — la détection de palier qui coupe un
   trajet en vingt-sept morceaux, le délai de croisière pris à la médiane quand
   c'est le dixième centile qu'il faut. Ces mesures se reprennent, elles ne se
   réinventent pas.
2. **Comment distinguer une accélération franche du reste** sans pédale : une
   montée en côte, un démarrage chargé et une reprise à plat ne donnent pas la
   même accélération pour la même demande.
3. **Ce que « assez de données » veut dire.** Un nombre de trajets ? de
   kilomètres ? la stabilité d'une mesure d'un trajet au suivant ? La dernière
   forme est la plus juste et la plus difficile.
4. **Ce qui se passe quand deux trajets se contredisent** — voiture chargée,
   pluie, pneus d'hiver. On moyenne, on garde le meilleur, on refuse de
   conclure ?
5. **Les traces sans position.** L'utilisateur peut refuser de déposer sa
   position ; la dérivation doit alors travailler sur la vitesse et
   l'accélération seules. À vérifier : ce que cela coûte en précision.
6. **Ce qu'on propose au juste.** Un profil complet, ou une couche par-dessus le
   profil choisi — c'est la forme qu'ETALONNAGE a retenue, et elle évite
   d'écraser un son réglé à la main.
7. **Quand la proposition s'affiche.** Une fenêtre au milieu d'un trajet est
   exactement ce qu'on ne veut pas sur l'écran d'une voiture qui roule.

## Dépendances

- **Les comptes** ([REFONTE](../REFONTE/spec.md)) : sans eux, les traces ne sont
  rattachées à personne et le profil n'a pas où vivre.
- **Un serveur qui calcule.** Aujourd'hui le NAS ne fait que servir des fichiers
  et en recevoir. C'est le premier traitement qu'on lui demanderait, et cela se
  chiffre avant de se décider.
- **La capture automatique** ([RELECTURE](../RELECTURE/spec.md)) : livrée, elle
  est la matière première de ce lot.

## Hors périmètre

- **Deviner le caractère du moteur.** La vraie voiture n'a pas de moteur
  thermique : aucune trace ne dira quel rupteur choisir. C'est déjà la limite
  posée par ETALONNAGE, elle ne bouge pas.
- **Régler le son.** Ce lot mesure une voiture, il ne choisit pas une banque.
