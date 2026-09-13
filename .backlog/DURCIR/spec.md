# DURCIR — sécuriser le code et les données

**Statut :** ⬜ prêt — cadre posé le 13 septembre 2026, pas encore découpé
**Branche :** à ouvrir
**Version visée :** à décider

## D'où vient ce lot

David regarde les échanges réseau pendant le lot COMPTES, et relève que
`GET /api/droits` répond en clair :

```json
{"droits":[{"role":"conduite","expireLe":null},{"role":"atelier","expireLe":null},
{"role":"synthese","expireLe":null}],"offerts":["conduite","atelier","synthese"]}
```

Son mot : « c'est beaucoup trop facile de s'approprier des rôles qu'on n'a pas ».

**Vérifié le jour même, et ce n'est pas ce qui se passe.** Aucune route n'écrit
dans la table `rights` — la seule mention hors lecture est l'héritage, qui se
contente de compter. `GET /api/droits` est en lecture seule et exige une
session. Le contrôle mord côté serveur, route par route, dans
`compteAyantDroit` (`src/server/serveur.ts`). Un navigateur qui réécrirait la
réponse ne changerait que son propre affichage.

**Ce que la réponse dit vraiment**, c'est que les trois rôles sont offerts à
tout le monde — valeur par défaut assumée dans `src/server/roles.ts`, en
attendant qu'il y ait quelque chose à encaisser. De l'extérieur, « ça protège »
et « ça laisse tout passer » se ressemblent donc exactement, ce qui explique
l'impression. Le robinet se ferme avec `SPEED_ROLES_OFFERTS=` vide, cas prévu.

**Ce qui reste vrai malgré tout :** seuls les rôles ont été regardés. Rien
d'autre n'a été audité, et ce lot existe pour ça.

## Ce que David demande

Un lot à part : **sécurisation et obfuscation du code, et des données.**

## Ce qu'il reste à instruire

Rien n'est tranché ici — la liste dit où regarder, pas ce qu'il faut faire.

- **L'isolation entre comptes**, route par route : ce qu'un compte peut lire ou
  écrire de ce qu'un autre a déposé. C'est le point qui compte le plus, et le
  seul qui ferait perdre des données à quelqu'un.
- **Le jeton de liaison** : huit caractères, usage unique, et une durée qui
  passe à vingt-quatre heures dans le lot COMPTES. De quoi est-il tiré, et que
  coûte une tentative en série ?
- **Le rattachement d'une adresse et le rattachement d'un compte tenu
  ailleurs** : les deux gestes qui font changer un compte de mains.
- **L'archive du compte** (`emporter.ts`), qui rend tout ce qu'un compte porte
  en un fichier.
- **Ce qui n'est pas limité en débit.** Deux routes le sont — la connexion par
  adresse et le règlement du compte abandonné —, et la bibliothèque borne les
  siennes. Le reste ne l'est pas, à commencer par le dépôt.
- **Les en-têtes servis** par le serveur qui a remplacé nginx.
- **L'obfuscation du code servi**, et ce qu'elle protège réellement sur une
  application sous AGPL-3.0, dont la licence oblige à offrir la source.
- **Les données déposées** : ce qui est en clair sur le serveur, et ce qui
  mériterait de ne pas l'être.

## Ce qui est déjà établi, et n'est pas à refaire

- Le contrôle de rôle existe et s'applique côté serveur, pas seulement à
  l'écran.
- Les trois rôles sont offerts par défaut, délibérément.
- `SPEED_ROLES_OFFERTS=` vide permet de vérifier qu'un écran se ferme et qu'une
  route refuse, sur un serveur qui tourne.
