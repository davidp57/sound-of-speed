# 03 — Rien ne doit nommer une banque restreinte

**Statut :** ✅ fait — le renommage était déjà fait, et ce qui reste ne paie pas

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il fallait obtenir

Le nom d'une banque voyage bien au-delà du son : il est dans le profil, et un
profil se partage par lien et par code à scanner ; il est dans l'archive que le
compte emporte ; il peut finir dans une tranche de journal ou dans une capture
d'écran. Partout là, il arrive **sans son contexte**.

## Ce qui était déjà fait, et que ce ticket ignorait

**Le renommage a eu lieu le 14 septembre 2026**, commit `89cde16` — un jour avant
que ce ticket soit écrit. Il a renommé le dossier, retiré le préfixe des cinq
fichiers, et suivi le champ des profils. Le ticket a été rédigé sans le voir.

## Ce qui a été mesuré

**Les étiquettes internes des fichiers : il n'y a rien à nettoyer.** Les dix
fichiers de la banque ont été ouverts. La seule étiquette présente est
`encoder=Lavf63.1.101` sur les FLAC — c'est le nom de la bibliothèque qui a
transcodé, et elle n'identifie rien. Les WAV n'en portent aucune. Ni titre, ni
auteur, ni nom d'origine, ni provenance.

C'est le genre de criterion qu'une mesure ferme mieux qu'un script.

## Ce qui reste, et pourquoi on n'y touche pas

Le nom subsiste dans sept fichiers versionnés hors backlog, dont trois qui
comptent :

| Où | Ce que ça dit |
|---|---|
| `CHANGELOG.md` | la **correspondance** entre l'ancien nom et le nouveau |
| `.gitignore` | que la banque vient d'une autre application |
| `defaults.ts` | l'identifiant du profil livré, resté à l'ancien nom |

**Retirer la correspondance du CHANGELOG ne changerait rien** tant que
`.backlog/` porte le nom **et** sa provenance dans une cinquantaine de fichiers.
Et nettoyer `.backlog/` a été écarté le 15 septembre, après lecture complète :
ces documents montrent un projet qui connaît la limite, ne redistribue rien et
cherche une alternative sous licence. Les effacer transformerait une trace de
bonne foi en apparence de dissimulation.

Donc : soit on nettoie tout et on perd la pièce à décharge, soit on ne nettoie
rien de plus. C'est la seconde qui est retenue, David le 15 septembre 2026.

**L'identifiant du profil est le seul reste qui sorte à l'exécution** — il voyage
dans un profil exporté ou partagé. Le code l'assume déjà et dit pourquoi : c'est
la clé par laquelle un profil enregistré retrouve sa base, et la changer ferait
compléter un « Sport » enregistré avec les valeurs d'un autre.

## Critères d'acceptation

- [x] Un profil exporté, partagé par lien ou par code à scanner, ne porte aucun
      nom identifiable — sauf l'identifiant du profil livré, assumé ci-dessus.
- [x] L'archive emportée par un compte n'en porte pas davantage.
- [ ] **Un contrôle automatique refuse tout fichier servi qui porte encore une
      étiquette interne.** Non fait : la mesure montre qu'il n'y a rien à
      garder, et aucun traitement automatique ne réencode ces fichiers — la
      commande de transcodage se lance à la main. À reprendre si elle entre un
      jour dans une chaîne qui tourne toute seule.
- [x] Le dépôt ne contient la correspondance nulle part — **non tenu, et
      accepté** : voir ci-dessus.
- [x] L'image se construit et l'application joue, cache hors réseau compris.
- [x] Le relevé sur les banques libres dit ce que la banque fait là et jusqu'à
      quand.

## Ce qui a quand même été corrigé

`README.md` donnait un chemin d'installation vers le dossier d'avant le
renommage : qui suivait ces instructions créait un dossier que le serveur ne
regarde plus. La ligne décrit désormais la forme plutôt qu'un exemple qui se
périme au premier renommage.
