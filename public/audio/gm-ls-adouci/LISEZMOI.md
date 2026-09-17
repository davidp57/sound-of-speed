# V8 adouci — le même GM LS, sans ce qui n'est pas harmonique de son allumage

Cette banque **existe pour trancher une question**, pas pour rester. Elle est
produite à partir de [`gm-ls`](../gm-ls/LISEZMOI.md) par
`node scripts/adoucir-banque.mjs gm-ls gm-ls-adouci` : mêmes prises, mêmes
boucles, mêmes réglages. Rien d'autre ne change que ce qui est décrit ici.

## La question

Après la sortie du 16 septembre 2026, David a relevé que les deux banques de V8
portent « des fréquences parasites, surtout à moyen régime », là où le quatre
cylindres n'en a pas.

Mesuré le 17 septembre : un moteur à quatre temps dont tous les cylindres sonnent
pareil ne produit que des multiples de sa cadence d'explosion. Comparée au plus
fort de ces multiples, l'énergie qui n'en est pas un vaut −18 à +16 dB sur les
deux V8, et −30 à −58 dB sur le six en ligne et le quatre à plat. L'écart entre
les deux familles va de 30 à 70 dB.

**Ce n'est pas un accident, et le LISEZMOI de `gm-ls` le disait déjà** : le
vilebrequin croisé « donne le grondement inégal d'un V8 américain : chaque banc
voit ses allumages espacés de 90 puis 180 degrés ». Ce que la mesure appelle une
composante inharmonique, l'oreille peut l'appeler la signature du moteur.

D'où cette banque : entendre le même moteur sans elles, et décider.

## Ce qui a été fait

Un moyennage circulaire sur un cycle moteur — décaler le signal d'une période
d'allumage et moyenner huit fois, c'est rendre les huit explosions du cycle
identiques. Ce qui revient à chaque explosion survit intact ; ce qui ne revient
qu'une fois par cycle s'annule.

La période vient du régime **mesuré** de chaque prise, lu dans `mesures.json` :
une erreur d'un pour cent déplacerait les zéros du peigne et laisserait passer ce
qu'on voulait retirer.

**La correction est bornée entre 120 et 1 200 Hz.** Appliquée partout, elle
rendrait le son rigoureusement périodique à l'échelle du cycle et retirerait
aussi le grain de turbulence. Au-delà de la bande, le souffle sort intact.

## Ce que ça donne

| Prise | Avant | Après | Gagné |
|---|---|---|---|
| `on-1390` | −4,1 dB | −30,3 dB | 26,2 dB |
| `on-1892` | +0,8 dB | −22,2 dB | 23,0 dB |
| `on-2576` | −10,5 dB | −25,6 dB | 15,1 dB |
| `on-3507` | −6,4 dB | −26,5 dB | 20,1 dB |
| `on-4775` | −1,3 dB | −20,4 dB | 19,1 dB |
| `on-6500` | −18,4 dB | −32,8 dB | 14,4 dB |

Le chiffre est le niveau de la plus forte composante inharmonique, rapporté à la
plus forte harmonique d'allumage. Le quatre cylindres, pour référence, est à
−48 dB.

Les boucles ne sont pas abîmées : le moteur de lecture recolle 17 des 18 couches
au chargement, contre 18 sur 18 pour la banque d'origine.

## Ce qui reste

L'arbitrage. Il est à l'oreille, en roulant, et il est écrit dans
[ESSAI-16, ticket 11](../../../.backlog/ESSAI-16/tickets/11-frequences-parasites-sur-les-v8.md).
Celle des deux banques qui perd s'en ira.
