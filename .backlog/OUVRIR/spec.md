# OUVRIR — le dépôt devient forkable, et le conteneur fait du bruit tout seul

**Statut :** ⬜ prêt
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

- [ ] Un fichier `LICENSE` porte l'AGPL-3.0, et `package.json` la déclare
- [ ] Une banque de démonstration est dans l'image, et le conteneur sonne au
      premier lancement sans qu'on dépose quoi que ce soit
- [ ] La provenance et la licence de cette banque sont écrites à côté d'elle
- [ ] `CONTRIBUTING.md` dit comment proposer une correction
- [ ] Un `.env.example` et une procédure d'installation permettent à un tiers de
      monter la pile sans poser de question
- [ ] Le README dit ce que l'AGPL implique pour qui déploie le service
