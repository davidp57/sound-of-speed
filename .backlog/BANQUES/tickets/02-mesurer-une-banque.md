# 02 — Un script qui mesure une banque

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

`npm run banque <dossier>` imprime, pour chaque fichier d'une banque, de quoi
remplir un profil : les **régimes d'ancrage** candidats et le **gain** à écrire.

C'est le ticket qui fait gagner une soirée. Le lot RELIEF a établi que la
compensation doit vivre dans le gain de chaque couche, au déficit près — mesuré
sur `procar`, 9,6 dB pour la prise « pied levé » basse et 6,5 dB pour la haute.
Ces deux nombres ont été relevés à la main. Sans outil, chaque banque nouvelle
demande le même relevé, et l'oreille s'y trompe : un écart de 3 dB ne s'entend
pas comme un écart, il s'entend comme un mauvais réglage ailleurs.

Ce que le script doit rendre, fichier par fichier :

- la **durée**, la fréquence d'échantillonnage, le nombre de canaux ;
- le **niveau efficace**, et l'écart en décibels avec la prise la plus forte de
  la banque — d'où le gain proposé ;
- les **régimes d'ancrage candidats**, classés, avec leur score relatif ;
- la **discontinuité de boucle**, pour repérer une prise qui claquera.

Le script mesure, il ne décide pas : l'analyse rend plusieurs candidats parce
que l'ambiguïté d'octave n'est pas tranchable par un critère spectral, et il ne
prétendra pas le contraire. C'est un humain qui recopie, à l'oreille s'il n'est
pas d'accord.

Les gains sont **relatifs à la prise la plus forte** de la banque : c'est
l'écart entre les couches qui compte, le niveau d'ensemble étant réglé par le
volume général et le relief.

L'analyse existe déjà et est couverte : `analyzeSample` rend ancrages, raccord
et timbre. `ffmpeg` est déjà l'outil du dépôt. Le script assemble, il n'invente
pas d'algorithme.

## Critères d'acceptation

- [x] `npm run banque <dossier>` fonctionne sur un dossier local passé en
      argument — aucun échantillon n'entre dans le dépôt
- [x] Il imprime, par fichier : durée, format, niveau, écart en dB, gain
      proposé, ancrages candidats, discontinuité de boucle
- [x] Le gain proposé de la prise la plus forte vaut 1
- [x] Lancé sur la banque livrée, il retrouve les valeurs connues : ancrages
      autour de 3128 et 8150 tr/min pour les prises en charge, écarts de 9,6 et
      6,5 dB pour les prises pied levé
- [x] Un fichier illisible est signalé et n'interrompt pas le relevé
- [x] Un dossier vide ou absent donne un message clair, pas une trace

## Ce qui a été fait

`scripts/banque.mjs`, lancé par `npm run banque -- <dossier>`. Il lit le WAV
lui-même — flottant 32 bits stéréo pour la banque livrée, entier 16 bits mono
pour celles que produit `generate-bank`, plus 8, 24 et 32 bits entiers et
`WAVE_FORMAT_EXTENSIBLE` — et appelle `analyzeSample` du cœur, que Node exécute
directement depuis son TypeScript. Aucune copie de l'analyse, donc rien qui
dérive.

### Les valeurs connues, retrouvées

Le critère demandait la banque livrée. Elle a servi, mais le contrôle décisif est
ailleurs : les deux banques de `generate-bank` portent leur régime dans le nom
des fichiers, donc leur vérité est connue par construction.

| Banque | Prises | Bon régime en tête | Dans les six candidats |
|---|---|---|---|
| `i4-check`, 4 cylindres | 15 | 14 | 15 |
| `v8-crossplane`, 8 cylindres | 18 | 9 | 17 |

**C'est ce qui a fixé le nombre de candidats affichés à six et non trois** :
trois n'en couvrait que 30 sur 33. Le V8 crossplane est le plus ambigu, ce qui
se comprend — son ordre d'allumage irrégulier étale l'énergie sur des ordres non
entiers.

Sur la banque livrée, avec la prise en charge du registre comme référence :

| Prise | Attendu | Mesuré |
|---|---|---|
| `on-low` ancrage | 3128 | 3154, en tête |
| `on-high` ancrage | 8150 | 8106, par le rapport ×3 — absent des six candidats |
| `off-low` gain | 3 (9,6 dB) | 3,03 (9,6 dB) |
| `off-high` gain | 2,1 (6,5 dB) | 2,11 (6,5 dB) |
| `limiter` gain | 0,35 | 0,38 |

Les deux écarts de niveau tombent **exactement** sur les valeurs relevées à la
main. C'est le cas `on-high` qui a fait garder la ligne des rapports simples :
sur les banques synthétiques elle n'apporte rien, mesuré — sur ce cas réel, elle
est ce qui fait apparaître 8150.

### Deux écarts avec le ticket

- **`--reference` n'était pas prévu.** Le ticket voulait les gains rapportés à la
  prise la plus forte, et c'est le défaut. Mais la plus forte de la banque livrée
  est le rupteur, une prise à part : tous les gains s'en trouvaient décalés d'un
  facteur commun, et aucun des deux chiffres connus ne se lisait. L'option
  déplace la référence sans rien décider.
- **Pas de test automatisé**, conformément à la décision de test de la
  spécification : le script est de l'outillage, il se vérifie en le lançant. Le
  relevé des 33 prises ci-dessus tient lieu de contrôle.
