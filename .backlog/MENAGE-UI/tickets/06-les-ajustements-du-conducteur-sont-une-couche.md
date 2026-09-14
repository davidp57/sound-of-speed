# 06 — Les ajustements du conducteur deviennent une couche

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le conducteur ne crée plus de profil : il choisit parmi ce qu'on lui a livré et
bouge trois curseurs — calme ↔ sportif, pépère ↔ nerveux, nombre de rapports.
Ces ajustements ne doivent ni écraser le profil livré, ni disparaître le jour où
l'atelier en dépose une version corrigée.

Ils se rangent donc **à côté** du profil, comme l'étalonnage : le profil reste
intact, et la couche se réapplique par-dessus la version qui arrive.

La couche pèse trois nombres, pas trente : le tempérament et la réactivité ne
sont pas enregistrés dans un profil, ils s'en déduisent. C'est ce qui rend cette
forme possible — et c'est à vérifier avant d'écrire, pas à supposer.

« Revenir aux réglages d'avant » devient « enlever la couche ».

## Critères d'acceptation

- [ ] Bouger un curseur global ne modifie pas le profil livré
- [ ] Une version corrigée du même profil déposée depuis l'atelier arrive avec
      l'ajustement du conducteur conservé
- [ ] Enlever la couche rend le profil livré tel quel
- [ ] La couche voyage avec le compte, comme le reste de ce qu'un appareil porte
- [ ] Un profil partagé par lien n'emporte pas la couche de celui qui le donne
- [ ] Le comportement est couvert par des tests du cœur
