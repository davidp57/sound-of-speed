# 01 — Le bouton, la confirmation, et ce qu'il efface

**Statut :** ⬜ prêt

**Bloqué par :** les trois questions de périmètre de la
[spec](../spec.md#ce-qui-reste-à-trancher), à trancher avant de coder.

## Ce qu'il faut obtenir

Un bouton **« Tout réinitialiser »** qui remet l'application à son premier
démarrage : les profils livrés, aucune préférence, aucun consentement.

- **Tout en bas de l'écran de configuration**, dans une zone à part, visuellement
  détachée du reste. Rien qui se frôle en conduisant.
- **Une confirmation qui énumère** ce qui va disparaître, en clair — « vos
  profils, vos moteurs, vos boîtes, vos réglages et vos consentements » — et ce
  qui ne disparaît pas : rien n'est touché sur le serveur, les profils et les
  traces qui y sont déposés restent.
- **Un avertissement nommé quand un dépôt attend.** Une trace enregistrée hors
  réseau et pas encore remontée serait perdue : le dire, dire combien, et
  proposer d'attendre plutôt que d'effacer.
- **L'effacement passe par une seule fonction de `core/`**, qui connaît la liste
  des clés. Aujourd'hui elles sont déclarées dans huit modules ; une liste
  éparpillée finit toujours par oublier une entrée, et un « tout réinitialiser »
  qui laisse un reste est pire que pas de bouton du tout.
- **Recharger la page après l'effacement**, plutôt que de remettre l'état en
  mémoire à la main : c'est le seul moyen sûr d'être vraiment au premier
  démarrage.

## Ce qu'il faut vérifier

Un test qui parte d'un stockage rempli des seize clés et vérifie qu'il n'en
reste aucune — en lisant la liste depuis la source, pas en la recopiant dans le
test, sinon les deux dérivent ensemble.

## Critères d'acceptation

- [ ] Le bouton est en bas de la configuration, dans une zone à part.
- [ ] La confirmation énumère ce qui part et dit ce qui reste sur le serveur.
- [ ] Un dépôt en attente est signalé nommément, avec son compte.
- [ ] Après confirmation, aucune clé `speed.*` ne subsiste, et l'application
      redémarre sur ses profils livrés.
- [ ] Un test couvre l'effacement complet, en lisant la liste des clés à la
      source.
- [ ] Contrôle qualité vert.
