# 04 — La banque suit le profil dans le cache

**Statut :** ⬜ prêt

**Bloqué par :** 03 — Choisir la banque d'un profil

## Ce qu'il faut obtenir

Changer de banque met la nouvelle en cache, pour que l'application reste
utilisable hors réseau — ce qui est son usage normal, en voiture.

Le mécanisme existe : le service worker accepte une demande de précache, et
l'application lui envoie les adresses des échantillons du profil actif. Ce
ticket vérifie que ce chemin fonctionne encore quand la banque change, et que
l'ancienne ne reste pas indéfiniment dans un cache qu'elle encombre.

Les échantillons vivent dans un cache à part, indépendant de la version du code,
pour ne pas retélécharger plusieurs mégaoctets à chaque mise à jour. Ce ticket
ne change pas cet arrangement.

## Critères d'acceptation

- [ ] Choisir une banque nouvelle propose sa mise en cache
- [ ] L'écran dit combien de fichiers de la banque active sont en cache, comme
      il le fait déjà
- [ ] Le cache des échantillons reste séparé de celui du code
- [ ] Les fichiers d'une banque qu'aucun profil n'utilise plus peuvent être
      libérés, sans toucher aux autres
- [ ] 🧑 Vérifié hors réseau, sur le téléphone : c'est le seul endroit où le
      service worker se comporte pour de vrai
