# 01 — Les dossiers du NAS entrent dans la base

**Statut :** ✅ fait le 12 septembre 2026

**Bloqué par :** aucun, peut démarrer tout de suite.

## Ce qu'il faut obtenir

On désigne au serveur l'ancien dossier, monté en lecture seule, et il y verse ce
qu'il trouve au démarrage — comme il joue ses migrations, sans commande à lancer
à la main. Quarante et une traces, cinquante-trois tranches de journal, quatre
profils, aucun relevé. Les traces entrent épinglées.

Il imprime ce qu'il a fait : trouvé, entré, écarté, dossier par dossier. Relancé,
il ne change rien.

Le profil mesuré n'est pas repris : le serveur le recalcule tout seul depuis les
traces qu'il vient de recevoir. Celui d'aujourd'hui est cumulé sur trois traces
d'essai et pèse neuf cents octets ; celui d'après le sera sur quarante et une.

## Ce à quoi il faut faire attention

- **Rien ne s'écrit à la source.** Le montage en lecture seule est la garantie
  mécanique ; une intention écrite dans le code n'en est pas une.
- **La base est remise à blanc avant le premier passage.** Elle porte deux
  profils et trois traces déposés pendant les essais du 12 septembre, dont David
  a dit qu'on pouvait les perdre. C'est une suppression de fichier, pas du code.
- **La reprise n'écrase jamais ce qui est déjà en base.** Invisible au premier
  passage, protectrice ensuite : un profil du disque ne doit pas effacer celui
  qu'on aura réglé entre-temps dans la voiture.
- **Les traces ne sont pas toutes de la même forme.** Deux sont du JSON d'un
  seul tenant, les autres des tranches compressées. La reprise déplace des
  octets ; elle ne les relit pas et n'a pas à les comprendre.
- **L'ordre compte.** Le cumul de mesure se recalcule au démarrage : si la
  reprise se joue après, il se refait sur l'ancien contenu et il faut redémarrer
  une seconde fois pour rien.
- **La séquence des traces du 11 septembre saute deux tranches.** C'est le
  problème des dépôts manqués d'un autre lot. Le décompte doit le montrer, pas le
  réparer.
- **Le déclencheur se retire quand c'est fait.** Le laisser ne casse rien mais
  fait relire un dossier à chaque démarrage.

## Critères d'acceptation

- [x] Le serveur désigné sur l'ancien dossier reprend traces, journal, relevés et
      profils à son démarrage
- [x] Les traces reprises sont épinglées
- [x] Le profil mesuré se recalcule depuis les traces reprises, et le décompte
      dit sur combien de trajets il est cumulé
- [x] Un décompte s'imprime : trouvé, entré, écarté, dossier par dossier
- [x] Relancer la reprise ne crée aucun doublon, ne change rien, n'écrase rien
- [x] Les fichiers du NAS sont intacts, en nombre et en octets
- [x] Le compte en base correspond au compte sur le disque, dossier par dossier

## Ce que la mesure a donné

Rejouée contre le vrai dossier du NAS, sur une base neuve, le 12 septembre 2026 :

```
reprise des anciens dossiers : le dossier de la pile de production
  traces : 41 trouvé(s), 41 entré(s), 2262 Kio
  journal : 53 trouvé(s), 53 entré(s), 767 Kio
  mesures : 0 trouvé(s), 0 entré(s)
  profiles : 4 trouvé(s), 4 entré(s), 18 Kio
  mesure-voiture : 1 trouvé(s), 0 entré(s), 1 écarté(s)
    écarté (ignoré, le cumul se recalcule depuis les traces) : tout le dossier
```

Relancée sur la même base, elle n'entre rien : 41, 53 et 4 « déjà en base,
identique(s) », et pas une ligne de plus. Les 94 fichiers du disque sont intacts.

**Le profil mesuré s'est refait tout seul** sur les quarante et un trajets :
28 731 octets, contre 930 quand il n'était cumulé que sur trois traces d'essai.
Sa couverture est complète — 7 départs à l'arrêt, 78 passages en ville, 65 sur
route, 163 sur autoroute.

**Le décompte a changé de forme en route.** Il nommait tout ce qu'il laissait de
côté, ce qui donnait 98 lignes au second passage — le cas le plus courant noyait
le seul qui compte. Il compare désormais le contenu : ce qui est identique se
compte, ce qui diffère se nomme.
