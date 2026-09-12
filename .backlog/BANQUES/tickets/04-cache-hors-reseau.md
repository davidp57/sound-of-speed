# 04 — La banque suit le profil dans le cache

**Statut :** 🧑 attend David — livré et mesuré ici, reste l'essai hors réseau sur le téléphone

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

- [x] Choisir une banque nouvelle propose sa mise en cache
- [x] L'écran dit combien de fichiers de la banque active sont en cache, comme
      il le fait déjà
- [x] Le cache des échantillons reste séparé de celui du code
- [x] Les fichiers d'une banque qu'aucun profil n'utilise plus peuvent être
      libérés, sans toucher aux autres
- [ ] 🧑 Vérifié hors réseau, sur le téléphone : c'est le seul endroit où le
      service worker se comporte pour de vrai

## Ce qui a été fait

Le ticket disait « ce ticket vérifie que ce chemin fonctionne encore ». Il ne
fonctionnait pas, et deux défauts sont sortis.

**Le premier : ce qui est surveillé n'était déclaré qu'au démarrage.**
`offline.watch(sampleUrls.value)` était appelé une fois, dans `initOffline`.
Changer de banque, changer de profil ou éteindre une couche laissait donc
l'écran compter les fichiers de l'ancienne liste, et « Préparer hors réseau »
mettait en cache ceux dont on venait de se détourner. Une observation suffit à
le voir : la banque passée de `procar` à `i4-check`, le compte restait à 5 / 5
au lieu de tomber à 0 / 5. C'est corrigé par un `watch` sur la liste.

**Le second, trouvé en lisant le contenu réel du cache : les listages de banques
s'y mettaient.** La règle `/audio/` du service worker sert le cache d'abord, sans
regarder les en-têtes — et le listage, que nginx déclare pourtant `no-store`,
tombait dedans à côté des échantillons. La découverte du ticket 01 aurait été
figée au premier chargement : une banque déposée sur le NAS ne serait jamais
apparue. Une adresse de listage se termine par une barre ; elle passe maintenant
par le réseau d'abord, la copie ne servant que hors réseau.

**La libération** est un message `FORGET_AUDIO` au service worker, qui porte les
banques à **garder** et non celle à effacer : on ne peut pas se tromper de sens,
et une banque oubliée du message se retéléchargerait au pire. Un bouton dans la
section *Hors réseau* dit la place rendue.

### Vérifié dans le navigateur, service worker actif

| Ce qui est vérifié | Résultat |
|---|---|
| Le compte suit un changement de banque | 5 / 5 sur `procar` → 0 / 5 dès `i4-check` |
| Mise en cache de la banque nouvelle | 5 / 5, 1,32 Mo, aucune erreur |
| Libération, `procar` et `v8-crossplane` gardés | 6 entrées `i4-check` retirées, 1,33 Mo ; `procar` intact à 5 / 5 |
| Deuxième passe, puis troisième | 2 listages retirés, puis 0 — rien à libérer |
| Caches séparés | `speed-audio` d'un côté, `speed-shell-v3` et `speed-assets-v3` de l'autre |
| Une banque déposée pendant la session | `banque-temoin` apparaît aussitôt, alors que `/audio/` est en cache |

Trois tests couvrent `usedBanks`.

**Ce qui n'est pas vérifié** : le comportement réellement hors réseau, sur le
téléphone. Le service worker se comporte pour de vrai là-bas, et nulle part
ailleurs.
