# 09 — Livrer les trois banques, le V8 en tête

**Statut :** ✅ fait

**Bloqué par :** aucun — suite directe des tickets 07 et 08

## Ce qui a déclenché

David, le 14 septembre 2026 :

> on va faire mieux : au lieu de livrer juste une banque de démo, on va livrer
> tout ce qu'on a généré (donc, tout ce qui est légalement livrable puisque
> procar n'est pas à nous), en mettant le v8-crossplane en premier dans la liste
> (profil par défaut).

## Ce qui est livré

| Profil | Dossier | Moteur | Prises | Poids |
|---|---|---|---|---|
| **V8** | `gm-ls` | V8 croisé, GM LS 5,7 L | 18 | 1,5 Mo |
| **V8 collecteur long** | `gm-ls-long-header` | le même, échappement réglé à l'oreille | 18 | 1,5 Mo |
| **L4** | `subaru-ej25` | quatre cylindres à plat | 15 | 1,2 Mo |

4,2 Mo en FLAC, contre 1,2 pour la seule démonstration d'avant. **Rien ne change
côté voiture** : la mise en cache hors réseau ne prend que les couches du profil
actif (`core/offline.ts`), donc les deux autres banques ne sont jamais
téléchargées tant qu'on ne les choisit pas. Le poids se paie dans le clone et
dans l'image, pas dans la 4G.

## Les trois décisions

Prises par David le 14 septembre, sur proposition.

**1. Une seule banque pour le quatre cylindres.** `demo` et `i4-check` étaient le
même moteur, la même définition — seules les prises témoins différaient. En
livrer deux aurait été livrer deux fois le même son.

**2. Chaque dossier porte le nom du moteur qui l'a produite.** `demo` et
`i4-check` étaient des noms d'essai, et « demo » devenait faux dès qu'il y en a
trois. Les dossiers suivent maintenant les identifiants de `ENGINE_LIBRARY`,
comme les définitions de banque.

**3. Le profil V8 qui désignait `procar` n'est plus livré.** Sa banque est une
prise sur une vraie voiture, qu'on n'a pas le droit de redistribuer : il était
donc **muet** chez qui découvrait l'application. Il reste dans
`knownFactoryProfiles()` — c'est le profil que David a enregistré, et
réinitialiser une de ses sections cherche là son origine — mais il ne part plus
avec l'application, et le nom « V8 » se libère pour la banque générée.

## Ce que ça a touché ailleurs

**L'image nginx.** Le volume des échantillons se monte **sur**
`/usr/share/nginx/html/audio` et masque tout ce que l'image y place. Une seule
banque en sortait par un alias ; les trois en sortent désormais, et c'est le
dossier entier qui déménage vers `_banques/` — ce qu'il contient est exactement
ce que le dépôt versionne, donc jamais une banque enregistrée. Trois blocs
d'alias, un par banque, chacun avec son listage : nginx n'a pas de boucle, et la
liste suit celle du `.gitignore`.

**Le contrôle d'image**, qui vérifiait qu'une banque survit au montage, les
vérifie toutes les trois — listage compris, le piège que l'alias avait déjà
tendu une fois.

**Les tests du serveur** portaient `demo` comme nom d'exemple. Un nom de dossier
qui n'existe plus entretient un fantôme : ils portent `gm-ls`.

## Ce qu'une installation en service va voir

Le profil de démonstration enregistré désigne un dossier qui n'existe plus et se
taira. C'est assumé : les profils d'usine se récupèrent d'un bouton, « Profils
d'usine » dans l'écran de configuration, et la restauration ne se déclenche que
sur demande. Un profil réglé à la main, lui, garde ses couches et son dossier.

## Critères d'acceptation

- [x] Les trois banques sont versionnées, en FLAC, avec leur fiche de provenance
- [x] Un profil d'usine par banque, aux valeurs **mesurées** du fichier produit
- [x] Le V8 croisé est premier, donc actif au premier lancement
- [x] Aucun profil livré ne désigne une banque absente de l'image — un test le
      vérifie
- [x] L'image nginx sert les trois malgré le montage du volume — le contrôle
      d'image le vérifie, listage compris

## Ce qui n'est pas vérifié

- **L'image n'a pas été construite ici** : pas de Docker sur ce poste. Les trois
  alias nginx suivent exactement le patron de celui qui marchait, et c'est la CI
  qui les éprouve.
- **Le timbre**, comme toujours : David a écouté les trois et les a jugées
  livrables, mais le quatre cylindres reste derrière les deux V8 — voir le
  ticket 08.
