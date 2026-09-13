# 11 — Un vrai compte : une adresse et un mot de passe, choisis depuis un clavier

**Statut :** ✅ fait — 13 septembre 2026

**Bloqué par :** [10 — L'écran du compte](10-l-ecran-du-compte.md).

**Reprend** les arbitrages du [ticket 09](09-reprendre-son-compte.md), voie a.

## Ce qu'il faut obtenir

Le compte gagne une **vraie adresse**, en remplacement de celle que la
bibliothèque avait fabriquée sous `.invalid`, et un **mot de passe choisi**. À
partir de là, il se rouvre n'importe où, même quand on a perdu tous ses
appareils — et il se range dans un gestionnaire de mots de passe.

**Et cela se fait depuis un poste de travail**, pas depuis la voiture : on y
arrive par un code de liaison, et on saisit sur un clavier. C'est tout l'intérêt
du chemin décidé le 13 septembre 2026.

## Ce à quoi il faut faire attention

- **Rien ne s'impose.** Un compte anonyme reste utilisable indéfiniment ; c'est la
  règle du lot. L'écran propose, il ne demande pas.
- **Une adresse seule n'ouvre rien.** Sans mot de passe et sans moyen de vérifier
  l'adresse, quiconque saisit la vôtre entrerait dans votre compte. Le mot de
  passe n'est pas un confort, c'est ce qui tient la voie debout.
- **Aucun courriel ne part.** L'adresse n'est pas vérifiée, et c'est assumé tant
  qu'aucun relais n'est configuré — voir le [ticket 13](13-tenir-son-compte.md)
  pour « j'ai oublié ».
- **Le compte ne change pas d'identifiant.** Tout ce qu'il porte pend à lui par
  clé étrangère : ce qui bouge est son adresse, jamais sa ligne.
- **`is_anonymous` repasse à faux ici**, et pas avant : c'est à ce moment que le
  compte devient réellement récupérable, et que la mise en garde de l'écran doit
  disparaître.
- **Le jeton de liaison ne touche pas à ce mot de passe** — c'est exactement ce
  que le [ticket 05](05-relier-un-appareil-par-un-code.md) a été rouvert pour
  garantir.

## Critères d'acceptation

- [x] Une adresse et un mot de passe se choisissent depuis l'écran du compte
- [x] Le compte garde tout ce qu'il portait : profils, moteurs, boîtes, trajets,
      profil mesuré
- [x] Il se rouvre depuis un appareil neuf, sans code de liaison
- [x] Un compte qui a une adresse n'est plus marqué anonyme, et l'écran cesse
      d'avertir
- [x] Afficher un code de liaison ne change pas le mot de passe choisi
- [x] Aucun courriel n'est envoyé, aucun relais n'est nécessaire

## Ce qui a été fait, et ce qui a été mesuré

Un greffon `src/server/compte.ts`, à côté de celui de la liaison, avec deux
routes : rattacher une adresse au compte de la session, et ouvrir ici un compte
qui existe ailleurs.

**La connexion est une route à nous, et ce n'est pas un caprice.** Elle doit
régler dans le même passage le sort du compte que l'appareil abandonne — la
preuve qu'il le possède étant son témoin, qui disparaît avec la connexion. La
première version faisait deux appels : abandonner, puis `sign-in/email` de la
bibliothèque. **Mesuré dans un navigateur : ça ne marche pas.** Effacer le compte
d'ici invalide sa session, et la connexion qui suit n'installe plus de témoin —
l'appareil se retrouvait connecté selon la réponse, et sans session selon le
serveur. Les deux dans le même endpoint, et le problème disparaît. `sign-in/email`
reste en place et fonctionne ; elle ignore simplement ce qu'est un compte
abandonné.

**Ce que le sort de l'ancien compte a gagné :** il est refusé tant que le mot de
passe n'est pas reconnu. Rien n'est effacé sur une connexion qui rate, ce qui
était le défaut de la version en deux appels.

**Mesuré bout en bout dans le navigateur** : un profil déposé au volant, l'adresse
rattachée, puis un appareil neuf qui ouvre le compte par son adresse — même
identifiant de compte, session installée, `/profiles/` à 200, et le profil
redescendu.

**Le sort de l'ancien compte vit désormais dans `abandon.ts`** : les deux gestes
qui y mènent — un code de liaison, une connexion — le partagent.
