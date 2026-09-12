# 03 — Un profil réglé en voiture se retrouve sur les autres appareils

**Statut :** 🧑 attend David

**Bloqué par :** 02 — Une trace part toute seule, et repart au retour du réseau

## Ce qu'il faut obtenir

Un profil modifié dans la voiture remonte dans la bibliothèque partagée, celle
que l'application lit déjà au démarrage. Il est donc disponible sur le poste de
travail sans lien à transmettre ni fichier à manipuler.

Le dépôt suit le réglage, mais ne le suit pas à la frappe : un curseur qu'on
déplace produit des dizaines de valeurs intermédiaires, et aucune ne mérite un
fichier. Le profil part quand la main s'arrête.

Le fichier porte un nom **stable**, tiré de l'identifiant du profil : redéposer
un profil remplace sa version précédente au lieu d'accumuler des copies. C'est
une synchronisation. Le nom reste lisible — on doit reconnaître un profil dans
le gestionnaire de fichiers sans l'ouvrir.

Ce qui ne voyage pas : le statut de favori et le volume général, qui sont des
préférences d'appareil. Les valeurs d'origine, elles, suivent — comme dans un
fichier exporté.

Ce ticket demande que le dossier des profils soit ouvert en écriture sur le
serveur. Tant qu'il ne l'est pas, le dépôt échoue proprement et le dit.

## Critères d'acceptation

- [x] Un profil modifié remonte tout seul quand l'accord est au moins au minimum
- [x] Une rafale de modifications ne produit qu'un dépôt
- [ ] 🧑 Le profil déposé apparaît dans la bibliothèque sur un autre appareil
- [ ] 🧑 Un profil déposé puis récupéré est identique à l'original, valeurs
      d'origine comprises
- [x] Le statut de favori et le volume général ne voyagent pas
- [x] Redéposer le même profil remplace son fichier, sans en créer un second
- [x] Le nom du fichier dit de quel profil il s'agit
- [ ] 🧑 Le serveur accepte l'écriture dans le dossier des profils, authentifiée
      comme celle des traces
- [x] Le README dit comment ouvrir ce dossier en écriture, au même endroit que
      pour les traces

## Fait, le 6 septembre 2026

Vérifié dans le navigateur : modifier un profil met un dépôt en attente trois
secondes plus tard, une rafale n'en met qu'un, et le fichier visé porte un nom
stable. Le dépôt réel a été tenté ; le serveur de développement a répondu 404, ce
qui est exact — il n'a pas ce dossier.

**Un geste sur le NAS reste à faire** : remonter `profiles/` en lecture-écriture
dans la pile, puis redéployer. Tant qu'il ne l'est pas, le dépôt échoue en disant
que le serveur n'a pas le droit d'écrire.

Un détail trouvé à l'usage : les profils d'usine portent un identifiant qui est
déjà leur nom, et leur fichier s'appelait « route-route.json ».
