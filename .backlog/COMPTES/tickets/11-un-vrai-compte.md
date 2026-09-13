# 11 — Un vrai compte : une adresse et un mot de passe, choisis depuis un clavier

**Statut :** ⬜ prêt

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

- [ ] Une adresse et un mot de passe se choisissent depuis l'écran du compte
- [ ] Le compte garde tout ce qu'il portait : profils, moteurs, boîtes, trajets,
      profil mesuré
- [ ] Il se rouvre depuis un appareil neuf, sans code de liaison
- [ ] Un compte qui a une adresse n'est plus marqué anonyme, et l'écran cesse
      d'avertir
- [ ] Afficher un code de liaison ne change pas le mot de passe choisi
- [ ] Aucun courriel n'est envoyé, aucun relais n'est nécessaire
