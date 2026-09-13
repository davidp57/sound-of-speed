# 13 — Tenir son compte : changer, oublier, emporter, supprimer

**Statut :** ⬜ prêt

**Bloqué par :** [11 — Un vrai compte](11-un-vrai-compte.md).

## Ce qu'il faut obtenir

Ce qu'on attend de n'importe quel compte, et qui manque une fois qu'il en est un
vrai : changer son mot de passe, se le faire renvoyer quand on l'a oublié,
**emporter ses données**, et **supprimer son compte**.

## Ce à quoi il faut faire attention

- **« J'ai oublié » demande un relais de courriel**, donc une configuration. Chez
  David, celui du NAS. Sans relais, le bouton n'apparaît pas : il n'y a rien à
  oublier puisque rien ne peut être renvoyé.
- **Supprimer emporte tout** — profils, moteurs, boîtes, trajets, profil mesuré,
  droits —, en deux temps, et c'est irréversible. La cascade de la base le fait
  déjà ; ce qui manque est le geste, et ce qui l'entoure.
- **Emporter ses données passe avant de supprimer**, et l'écran le propose à ce
  moment-là. Tranché par David le 13 septembre 2026.
- **Le navigateur de la voiture refuse les téléchargements.** C'est un fait déjà
  constaté, et c'est la raison d'être de la remontée au serveur. Donc : un fichier
  à télécharger depuis un poste de travail, un envoi par courriel quand un relais
  est configuré, et **sur la voiture sans relais, l'écran le dit** au lieu
  d'afficher un bouton qui ne fait rien.
- **Le serveur sait déjà faire une archive** : `/sessions/<clé>/archive.zip`
  existe. Ce qu'il faut est la même chose pour tout ce qu'un compte porte.
- **Supprimer le dernier compte ne doit pas casser l'installation.** Le compte
  d'avant l'identité a déjà été absorbé ; un appareil qui revient s'en crée un
  neuf, vide, et c'est le comportement attendu.

## Critères d'acceptation

- [ ] Le mot de passe se change depuis l'écran du compte
- [ ] « J'ai oublié » apparaît quand un relais est configuré, et pas autrement
- [ ] Tout ce qu'un compte porte s'emporte en un fichier, ou part par courriel
- [ ] Sur la voiture sans relais, l'écran dit pourquoi on ne peut pas emporter ici
- [ ] Supprimer son compte emporte tout, en deux temps, et le dit avant
- [ ] Après suppression, un appareil qui revient repart d'un compte neuf et vide
