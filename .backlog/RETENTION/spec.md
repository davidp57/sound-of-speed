# RETENTION — analyser puis oublier, sauf ce qu'on épingle

**Statut :** ⬜ prêt
**Branche :** `feature/retention`
**Version visée :** 0.4
**Dérivé de :** [PLATEFORME](../PLATEFORME/spec.md)
**Bloqué par :** [MIGRER](../MIGRER/spec.md) — effacer est le seul geste
irréversible de ce chantier, il vient après que tout est rapatrié et vérifié.

## Ce qu'il faut obtenir

Le serveur garde ce que les trajets **montrent**, pas les trajets. Une trace
analysée ne sert plus qu'au relecteur ; passé un délai, elle disparaît, sauf si
on l'a épinglée ou emportée.

## Le problème

**`PUT` sans `DELETE` : rien ne s'efface, rien ne tourne.** Une trace ratée, une
session avortée d'un kilo-octet, un dépôt de travers restent là pour toujours —
la base en porte six. Ce lot ouvre la suppression.

Et le stockage décide de la facture, pas le calcul. Une trace brute pèse ; le
profil mesuré qu'on en tire pèse quelques kilo-octets et ne grossit pas.

**Ce n'est pas le stockage qui presse, et il faut le dire.** Mesuré le
12 septembre 2026 : 0,87 Mio de trace par heure de conduite, soit environ
0,4 Gio par an à une heure par jour, sur un volume qui en a 2 512 de libres. Ce
lot ne se justifie pas par la place qu'il rend aujourd'hui, mais par l'archive
qu'il met chez l'utilisateur et par l'économie du jour où les comptes ne sont
plus un seul.

## Ce que la mesure du 12 septembre a établi

La base de production a été relevée avant d'écrire les tickets. Elle pèse
3,2 Mo, dont **97 % en dépôts** — 3 100 Kio sur 3 200. Le profil mesuré en fait
32. Le reste est négligeable.

Cinq constats, et quatre d'entre eux changent la conception.

**Un dépôt n'est pas une trace.** Les 41 traces sont **8 sessions**, dont une de
22 tranches et une de 13 ; les 53 tranches de journal sont 6 sessions. Six des
huit sessions de trace sont des départs avortés d'une seule tranche de 1 Kio.

**La date de dépôt n'est pas la date du trajet.** Les 94 dépôts portent tous
`deposited_at = 2026-09-12T20:32` : la date de la reprise de MIGRER. La date
d'enregistrement est dans le nom, et elle est fiable — aucun dépôt sans date, et
le nom concorde avec le `startedAt` de l'en-tête sur les six sessions
vérifiables. Le défaut existe aussi hors reprise : une trace enregistrée hors
réseau et remontée trois jours plus tard porte une date de dépôt postérieure au
trajet.

**Tout est épinglé, journal compris.** 94 dépôts sur 94. MIGRER n'annonçait que
les traces ; `reprise.ts` épingle tout ce qu'il verse. La borne d'épingle que
cette spec demande est donc dépassée avant d'exister, quel que soit son chiffre.

**Le relecteur ne sait pas ouvrir un fichier local.** Il ne lit que le serveur
(`listSessions` / `loadSession`). La seconde porte de sortie est entièrement à
construire.

**Le profil mesuré est borné, et son plafond n'est pas celui qu'on croit.**
`aggregate.recent` garde au plus `RECENT_TRIPS = 20` trajets
(`core/calibration/aggregate.ts`), et tout le cumul hors `recent` tient en
249 octets — l'affirmation de cette spec tient donc. Mais les 28 731 octets
d'aujourd'hui sont cumulés sur **2** trajets seulement : les douze autres
sessions sont trop courtes pour compter. Le plafond réel est autour de
**287 Ko**, pas 29.

## Ce qu'on construit

### L'unité est la session, jamais le dépôt

On efface un trajet entier ou rien. Les tranches d'une même session se
regroupent par leur nom — `<date>_<jeton>_<NNN>` —, comme le relecteur le fait
déjà. Effacer tranche par tranche rendrait des sessions à trous, que le
relecteur afficherait comme des trajets amputés sans le dire.

### Deux dates, parce qu'une seule ne suffit pas

Le dépôt porte désormais **la date d'enregistrement**, tirée du nom à l'écriture,
à côté de la date de dépôt qu'il avait déjà. C'est elle qui décide de
l'effacement. Une migration la rétro-remplit sur les 94 dépôts existants, qui
prétendent tous dater du 12 septembre.

Lire l'en-tête de la première tranche donnerait la même date, exactement, mais
obligerait à décompresser à chaque passage de la règle. Le nom suffit et ne coûte
rien.

### On n'efface pas ce qu'on n'a pas encore lu

Le dépôt porte aussi **l'état de son analyse**. Une session ne s'efface que
lorsque le profileur l'a traitée — qu'il en ait tiré un trajet ou qu'il l'ait
écartée comme trop courte. Tant qu'elle n'a pas été vue, elle reste.

C'est la condition de la phrase d'ouverture : garder ce que les trajets montrent
suppose de les avoir regardés. Sans cet état, rien ne distingue « il n'y avait
rien à en tirer » de « on n'a pas encore regardé », et la règle efface les deux.

### Deux natures d'exemption

- **L'épingle**, posée à la main sur une session qu'on veut garder. Elle est
  **bornée** et le nombre est annoncé. C'est un choix de l'utilisateur.
- **L'archive**, posée par la reprise de MIGRER sur ce qui vient d'un ancien
  serveur. Elle n'est pas bornée, parce qu'elle n'est pas un choix mais un fait :
  ces trajets ont été déménagés, pas déposés.

Les confondre obligerait soit à trahir la promesse de MIGRER — les 14 sessions
reprises perdraient leur exemption —, soit à laisser la borne sans effet. Deux
natures coûtent un état de plus sur le dépôt et règlent les deux.

### Le journal a sa propre règle

Il sert au diagnostic d'un défaut qu'on vient de constater, pas à la relecture
d'un trajet. Son délai est **plus court** que celui des traces, et il ne
s'épingle pas individuellement : on ne choisit pas une tranche de journal, on
regarde les dernières.

Les 53 tranches épinglées par la reprise gardent leur archive, comme les traces.

### Télécharger rend un fichier, pas vingt-deux

Une session fait jusqu'à 22 tranches. Le téléchargement en rend **une archive
zip**, que le relecteur rouvre depuis le disque. Concaténer les tranches en un
seul fichier serait plus simple à relire, mais irréversible : on perdrait le
découpage d'origine et la trace des tranches manquantes — celles du 11 septembre
en sautent deux.

### Rien ne s'efface en silence

Ce qui va disparaître se voit avant de disparaître : combien de sessions, quelles
dates, ce qui est épinglé, ce qui est archivé. Un effacement qui surprend est un
effacement qu'on regrette.

Et l'effacement **à la demande** existe aussi : une session qu'on ne veut plus
part tout de suite, sans attendre le délai. C'est ce qui manque aujourd'hui pour
les six départs avortés.

### Les délais se règlent, et ils ont des valeurs par défaut

Par variables d'environnement, là où le serveur se règle déjà — l'écran de la
pile dans Portainer, à côté de `SPEED_DB` et `SPEED_REPRISE`. Un réglage en base
modifiable depuis l'application demanderait un écran d'administration qui
n'existe pas ; [COMPTES](../COMPTES/spec.md) le portera mieux.

| Réglage | Défaut proposé | Pourquoi ce chiffre |
|---|---|---|
| Délai des traces | 30 jours | Le relecteur sert à revoir un trajet qu'on a encore en tête. Un mois laisse le temps de télécharger ce qu'on veut garder. |
| Délai du journal | 14 jours | Deux semaines couvrent le délai entre « ça a fait quelque chose de bizarre » et le moment où on va voir. |
| Épingles par compte | 20 sessions | Sans effet sur un compte unique ; la borne existe pour le jour où il y en a d'autres. Même ordre que les 20 trajets du profil mesuré. |

**Ces trois chiffres sont proposés, pas mesurés.** Aucun contrôle ne dira qu'ils
sont mauvais : un délai trop court efface des données et rien ne rougit. Ils sont
écrits ici pour être discutés, et réglables pour être corrigés sans livrer.

### La règle tourne au démarrage, puis chaque jour

Au démarrage comme les migrations et la reprise, parce que c'est le motif déjà
posé dans `main.ts`. Puis toutes les 24 heures, parce qu'un serveur qui ne
redémarre pas pendant trois mois ne doit pas cesser de faire le ménage pour
autant.

## Ce qu'on ne construit pas

- **Des quotas par compte.** Ils appartiennent à [COMPTES](../COMPTES/spec.md),
  qui porte les droits. Ici, une seule règle pour tout le monde.
- **Une analyse nouvelle.** Le profileur sait déjà ce qu'il cumule ; ce lot
  décide quand et où, pas quoi.
- **Un écran d'administration.** Les délais se règlent par l'environnement.
- **Le bouton « tout réinitialiser ».** Il appartient à
  [REMISE-A-ZERO](../REMISE-A-ZERO/spec.md), il remet les réglages de l'appareil
  à leurs valeurs d'usine, et il ne touche pas au serveur — c'est un choix,
  confirmé par David le 12 septembre 2026, et non une limite que ce lot lèverait.
  Une version de cette spec a affirmé le contraire ; elle avait tort.

## Critères d'acceptation

- [ ] Une trace arrivée est analysée et cumulée dans le profil mesuré sans
      intervention, et son dépôt porte l'état de cette analyse
- [ ] Une session non exemptée disparaît passé le délai, **entière**, et le délai
      est réglable
- [ ] Une session que le profileur n'a pas encore traitée ne s'efface pas, quelle
      que soit sa date
- [ ] L'effacement se fonde sur la date d'enregistrement, pas sur la date de
      dépôt ; les 94 dépôts repris portent la bonne
- [ ] Épingler exempte de l'effacement, dans une limite bornée et annoncée ;
      l'archive de reprise exempte sans être bornée
- [ ] Le journal suit sa propre règle, plus courte, et ne s'épingle pas
- [ ] Télécharger rend une archive que le relecteur rouvre depuis le disque
- [ ] Une session s'efface à la demande, sans attendre le délai
- [ ] Ce qui va être effacé est montré avant de l'être
- [ ] Le profil mesuré ne grossit pas avec le nombre de trajets — mesuré, et le
      plafond annoncé
