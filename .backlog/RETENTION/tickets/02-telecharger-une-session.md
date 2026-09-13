# 02 — Télécharger une session en une archive

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

Devant la liste des trajets du relecteur, on demande une session et on obtient
**un fichier**. Une archive zip, portant les tranches telles qu'elles ont été
déposées — trace et journal, sous leurs noms d'origine.

C'est la porte de sortie qui rend l'effacement acceptable : l'archive longue est
chez l'utilisateur, pas sur le serveur.

## Ce à quoi il faut faire attention

- **Un fichier, pas vingt-deux.** La plus grosse session de la base porte 22
  tranches de trace et 20 de journal. Rendre 42 téléchargements n'est pas une
  porte de sortie.
- **Les octets ne sont pas retouchés.** Les tranches sont déjà compressées ;
  l'archive les porte telles quelles, sans les décompresser ni les recomprimer.
  Ce qui ressort doit être exactement ce qui était monté.
- **Le découpage est conservé.** Concaténer les tranches en un seul fichier
  serait plus simple à relire, mais irréversible : on perdrait les rangs, donc la
  trace des tranches manquantes. La séquence du 11 septembre en saute deux, et ça
  doit rester visible.
- **Le nom de l'archive dit de quel trajet il s'agit** — la date du trajet, pas
  celle du téléchargement.
- **Une session lourde ne doit pas tenir en mémoire d'un bloc** si la façon de
  faire permet de l'éviter ; la plus grosse pèse un mégaoctet aujourd'hui, et
  rien ne dit que ça reste vrai.

## Critères d'acceptation

- [x] Une session demandée rend une archive zip unique
- [x] L'archive porte les tranches sous leur nom de dépôt, trace et journal —
      rangées sous leur dossier d'origine, une trace et un journal pouvant porter
      exactement le même nom
- [x] Les octets extraits de l'archive sont identiques à ceux déposés, tranche
      par tranche
- [x] Le nom de l'archive porte la date du trajet
- [x] Une session d'une seule tranche rend une archive valide, pas un cas
      particulier
