# OUVRIR — le dépôt devient forkable, et le conteneur fait du bruit tout seul

**Statut :** ✅ fait le 12 septembre 2026
**Branche :** `feature/ouvrir`
**Version visée :** 0.3
**Dérivé de :** [PLATEFORME](../PLATEFORME/spec.md)

## Ce qu'il faut obtenir

Quelqu'un qui découvre le dépôt peut le cloner, le déployer et l'entendre
sonner, sans rien demander à personne et sans risque juridique.

C'est le seul des cinq lots qui ne dépende de rien. Il se livre en une soirée et
il débloque tout le reste — tant qu'il n'est pas fait, « open source » est une
intention, pas un état.

## Le problème

**Un dépôt sans licence est « tous droits réservés ».** Il n'y a aucun fichier
`LICENSE`, et rien dans `package.json`. Personne ne peut donc légalement le
forker, le redéployer ni proposer une correction — quelles que soient les
intentions affichées.

**Et qui clone obtient une application muette.** Les échantillons sont exclus de
git, pour leur poids. Une application de son sans son n'est pas un logiciel
qu'on essaie.

**La banque qui joue aujourd'hui ne peut pas combler ce trou.** `procar` vient de
l'application dribe.app : elle est jouable ici, elle n'a aucune licence qui nous
autorise à la rediffuser. Vérifié le 12 septembre 2026 — aucun échantillon n'est
jamais entré dans git, seuls `public/impulse/` et `silence.mp3` y sont, et le
`.gitignore` posé pour le poids a tenu les droits à l'écart sans qu'on l'ait
cherché. Rien à nettoyer, donc, mais rien à publier non plus.

## Ce qu'on construit

### AGPL-3.0

Le choix est arbitré dans [PLATEFORME](../PLATEFORME/spec.md) : c'est la seule
licence courante qui couvre l'usage **en service**, ce qu'est devenu ce produit.
Qui déploie Speed pour d'autres publie ses modifications, même sans distribuer
de fichier.

Un fichier `LICENSE` à la racine, le champ dans `package.json`, et l'en-tête
d'usage dans le README. Les dépendances sont sous MIT, qui se combine avec.

### Une banque de démonstration produite par engine-sim

Elle est embarquée dans l'image : le dépôt reste léger, le conteneur fait du
bruit au premier lancement, et il n'y a aucune question de droits.

Le relevé [banques-libres](../PLATEFORME/banques-libres.md) a cherché mieux et
n'a rien trouvé : ce qui est au bon format n'a pas de droits clairs, ce qui a des
droits clairs n'a que deux boucles. Le générateur, lui, vient de gagner son
échappement capté et sa banque a été jugée à l'oreille le 12 septembre.

La provenance se documente comme celle des réponses d'échappement, qui est le
standard déjà tenu dans `public/impulse/` : d'où ça vient, sous quelle licence,
et le texte de la licence recopié.

### De quoi contribuer

Un `CONTRIBUTING.md` qui dit l'essentiel et pas plus : les règles de langue, le
flux de branches, le contrôle qualité à passer avant de proposer. Ce qui existe
déjà dans `CLAUDE.md` n'est pas recopié, il est cité.

### De quoi déployer

Un `.env.example` commenté et une installation décrite en quatre étapes, doublée
d'une procédure pour NAS. C'est le patron de déploiement relevé sur Solde, et
il ne coûte rien de l'écrire avant que le serveur existe : ce qui est décrit
ici, c'est la pile d'aujourd'hui.

## Ce qu'on ne construit pas

- **Le serveur.** Il est le lot suivant. OUVRIR décrit ce qui existe.
- **Une reprise de l'historique git.** Rien n'y est à retirer, c'est vérifié.
- **Le dépôt public lui-même.** Rendre le dépôt visible est une décision de
  David, pas une tâche : ce lot le rend *possible*.

## Critères d'acceptation

- [x] Un fichier `LICENSE` porte l'AGPL-3.0, et `package.json` la déclare
- [x] Une banque de démonstration est dans l'image, et le conteneur sonne au
      premier lancement sans qu'on dépose quoi que ce soit
- [x] La provenance et la licence de cette banque sont écrites à côté d'elle
- [x] `CONTRIBUTING.md` dit comment proposer une correction
- [x] Un `.env.example` et une procédure d'installation permettent à un tiers de
      monter la pile sans poser de question
- [x] Le README dit ce que l'AGPL implique pour qui déploie le service

## Ce que la réalisation a ajouté au périmètre

**Le lien « Source » dans l'interface.** La section 13 de l'AGPL demande que qui
fait tourner le programme comme service en offre la source aux gens qui s'en
servent à distance — un lien dans l'interface est la façon que la licence cite
elle-même. L'écran d'aide le porte, avec la version servie. Sans lui, notre
propre déploiement ne respecterait pas la licence qu'on choisit.

**Le profil d'usine de démonstration.** Livrer la banque ne suffisait pas : sans
profil qui la désigne, il fallait importer un fichier à la main, et « sans qu'on
dépose quoi que ce soit » aurait été faux. Le profil est donc **premier** dans la
liste d'usine, puisque c'est le premier de cette liste qui joue au tout premier
lancement. Vingt tests décrivaient « un seul profil livré » et ont été repris ;
l'un d'eux a attrapé un vrai défaut au passage — la démonstration manquait aux
profils d'usine **connus**, donc réinitialiser une de ses sections lui aurait
rendu les valeurs du V8, réglées sur une tout autre banque.

**Le contournement du montage.** Le volume des échantillons se monte **sur**
`/usr/share/nginx/html/audio` : il masque tout ce que l'image place là-dessous.
Une démonstration rangée dans `audio/demo/` aurait donc été invisible dès que la
pile tourne avec son volume, c'est-à-dire toujours. Elle est rangée ailleurs dans
l'image, et nginx la ramène sous `/audio/demo/` par un alias.

## Ce que le contrat a trouvé après coup

**La banque de démonstration n'est pas découvrable.** Relevé le 12 septembre 2026
par le jeu de requêtes du lot SERVEUR, à sa première exécution contre un vrai
conteneur.

L'application énumère les banques en listant le dossier des échantillons. Or la
démonstration n'est pas dedans : le volume masque ce que l'image y place, elle
vit donc ailleurs et revient par un alias. Elle **joue** — le profil d'usine la
désigne par son nom — mais elle n'apparaît dans aucune liste, et on ne peut donc
pas l'attribuer à un autre profil depuis l'écran de réglage.

Deux moitiés, dont une est corrigée :

- **Lister ses prises** rendait 403, l'alias ayant perdu le listage du bloc
  parent. Corrigé dans le même mouvement.
- **La voir parmi les banques** ne pouvait pas venir de l'ancien serveur, aucun
  listage n'y fusionnant deux sources. **Réglé le 12 septembre** par le serveur
  du ticket 04 de [SERVEUR](../SERVEUR/spec.md), qui cherche dans le volume des
  banques déposées **et** dans ce que l'application embarque, et dont le listage
  montre les deux. Le correctif côté client, envisagé ici, n'aurait valu que pour
  un serveur qu'on remplace.

## Ce qui n'a pas pu être vérifié

**Rien n'a été essayé dans un conteneur** : Docker n'est pas installé sur le
poste. Le YAML des deux fichiers de pile est validé, la substitution
`${VAR:-défaut}` ne l'est pas, et l'alias nginx non plus. Le premier `docker
compose up` sur une machine neuve est le vrai contrôle de ce lot.

**Le rendu de la section « Code source et licence »** n'a pas été vu dans un
navigateur : celui de l'outillage n'a pas d'accès réseau au serveur de
développement et ne sert que son cache. La compilation valide la syntaxe, pas
l'apparence.
