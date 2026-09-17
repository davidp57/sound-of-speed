# 06 — Deux banques ne sonnent pas au même niveau

**Statut :** 🧑 attend David le 17 septembre 2026 — mesuré et corrigé, reste
l'oreille

David, après avoir essayé les quatre profils livrés :

> « les profils L4 et L6 ont un volume audiblement plus faible que les V8 »

## La cause, et elle n'est pas où on la cherche

**Ce ne sont pas les prises.** Mesurées sur les fichiers, à régime comparable,
les banques à un seul banc de cylindres sont même **plus fortes** :

| Banque | Niveau des fichiers |
|---|---|
| `gm-ls` | référence |
| `gm-ls-long-header` | +0,3 dB |
| `bmw-i6-3l` | **+3,4 dB** |
| `subaru-ej25` | **+2,5 dB** |

**Ce sont les gains du profil**, calculés par le banc, qui vont dans l'autre sens
et plus loin :

| Banque | Gain moyen des couches « en charge » | Écart |
|---|---|---|
| `gm-ls` | 0,843 | référence |
| `gm-ls-long-header` | 0,957 | +0,3 dB |
| `bmw-i6-3l` | **0,346** | **−7,7 dB** |
| `subaru-ej25` | **0,541** | **−3,9 dB** |

Net : le six en ligne sort environ **4,3 dB** sous le V8, le quatre à plat
**1,4 dB**. C'est ce que David entend, et l'ordre de grandeur colle — quatre
décibels, c'est « audiblement plus faible » sans être une panne.

## Pourquoi le banc fait ça

Il normalise **à l'intérieur** d'une banque, pas entre banques. Chaque
`mesures.json` porte une `reference` qui est **une prise de cette banque**
(`on-4775.wav` pour le V8, `on-7000.wav` pour le six en ligne), et les gains
s'en déduisent en comprimant les écarts à 35 %.

Le résultat est juste pour ce qu'il vise : à l'intérieur d'une banque, les prises
gardent leurs écarts relatifs, comprimés. Mais rien ne rapporte deux banques l'une
à l'autre, et leurs niveaux mesurés sont très différents — de −6,8 dB moyen sur le
V8 à −18,8 sur le quatre à plat.

## Ce à quoi il faut faire attention

- **Un niveau commun ne se décrète pas sur le pic.** Les fichiers sont déjà tous
  normalisés au même pic (0,89) : c'est le niveau **perçu** qui diffère, et un
  V8 n'a pas le même facteur de crête qu'un quatre cylindres.
- **Le volume général ne règle pas ça** : il déplace tout ensemble, et David
  change de profil pour comparer — il faut que la comparaison soit honnête.
- **Changer les gains d'un profil livré change ce qu'on a écouté pour le
  valider.** Les banques ont été jugées à l'oreille le 14 septembre ; une
  renormalisation les rejuge toutes, et c'est l'oreille qui tranchera.
- **Le relief se calcule après**, sur le niveau d'ensemble : il ne rattrape pas
  un écart entre banques, il s'y ajoute.

## Critères d'acceptation

- [x] Les quatre banques livrées sonnent au même niveau, à régime et charge
      comparables — mesuré, pas estimé
- [x] La mesure se refait : ce qui l'a produite est dans le dépôt
- [x] Passer d'un profil à l'autre ne demande plus de toucher au volume
- [ ] Jugé à l'oreille par David, en roulant ou au simulateur

## Ce que la mesure a donné

Faite à travers le vrai mixage — `computeMix` posant les gains à neuf régimes,
pied levé et pleine charge — sur les fichiers décodés par ffmpeg
(`npm run niveau-banques`) :

| Banque | fichiers | joué | crête | écart |
|---|---|---|---|---|
| `gm-ls` | −10,2 dB | −13,4 dB | +2,1 dB | référence |
| `gm-ls-long-header` | −10,2 | −12,6 | +3,0 | +0,8 |
| `bmw-i6-3l` | −8,4 | −19,1 | −2,3 | **−5,7** |
| `subaru-ej25` | −8,7 | −14,1 | +1,3 | −0,8 |

**Une seule banque était en cause**, le six en ligne, et l'écart est net.
L'estimation du ticket disait −4,3 dB ; la mesure à travers le mixage donne
−5,7. Ses gains ont été multipliés par 1,932.

**Le quatre à plat n'a pas d'écart de niveau.** 0,8 dB, et le signe s'inverse
selon la charge : −1,1 à pleine charge, +0,6 pied levé. Ses gains n'ont donc
pas bougé — ce que David entend de moins sur lui vient d'ailleurs que du
niveau, timbre ou contenu grave, et se traitera comme tel s'il le confirme.

**Aligner vers le haut plutôt que vers le bas**, parce que le manque de volume
est déjà un sujet ([ESSAI-16/08](../../ESSAI-16/tickets/08-volume-plaque-contre-le-limiteur.md)),
et parce que cela ne crée aucun écrêtage nouveau : le six en ligne remonté reste
sous les deux V8 en crête, toutes couches supposées en phase.
