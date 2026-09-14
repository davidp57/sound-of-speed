# 08 — La démonstration devrait-elle être un V8 ?

**Statut :** ✅ fait — tranché le 14 septembre 2026, et plus largement que la question posée

**Bloqué par :** aucun — le générateur sait déjà produire les deux

## Ce qui a déclenché

David, le 14 septembre 2026, après avoir écouté les quatre banques produites :

> c'est pas mal du tout ; je pense que ces profils sont livrables, en
> particulier les V8 qui sonnent bien mieux que les 4L.

Or c'est le quatre cylindres qui est livré. `public/audio/demo/` est la seule
banque versionnée avec l'application : c'est elle qui joue au tout premier
lancement, chez quelqu'un qui n'a encore rien déposé. La première écoute d'un
nouveau venu est donc la moins bonne des trois.

## Pourquoi c'était le quatre cylindres

Deux raisons, dont une seule tient encore.

**Le poids.** Quinze prises contre dix-huit, et des prises plus courtes en bas
de plage. La démonstration pèse 1,2 Mo ; un V8 au même écartement en pèserait
de l'ordre de 1,6 à 1,8, plus le rupteur. Ce n'est pas rien dans une image qu'on
tire par le réseau, mais ce n'est pas grand-chose non plus.

**Le ralenti.** David, en septembre : « j'entends le ralenti, c'est chouette » —
sur le quatre cylindres. C'était avant que le V8 ait le sien : les banques
générées portent toutes une prise de ralenti désormais.

## Ce qu'il faudrait faire, si la réponse est oui

Rien de neuf à écrire. Une définition de banque qui nomme `gm-ls` ou
`gm-ls-long-header` avec `sampleDir: "demo"`, la génération, le transcodage en
FLAC, et le profil d'usine recopié — la procédure est écrite dans
[`public/audio/demo/LISEZMOI.md`](../../../public/audio/demo/LISEZMOI.md).
Compter dix minutes, calcul compris.

Le choix entre les deux V8 est le même qu'ailleurs : le collecteur long est le
réglage que David a trouvé à l'oreille, le `gm-ls` est la référence d'engine-sim.

## L'autre voie : améliorer le quatre cylindres

Le quatre cylindres a changé de hauteur le 14 septembre — 27 à 40 % plus grave —
quand le banc a cessé de porter sa propre géométrie. Ce sont les **cames** qui
l'ont fait : `subaru-ej25` déclare 232 et 236 degrés de durée là où le banc
posait 220, avec des centres de lobes différents.

Ces valeurs sont relevées dans le fichier d'engine-sim, donc justes au sens du
contrat. Mais rien n'oblige la démonstration à être un EJ25 : un quatre
cylindres réglé à l'oreille est une entrée de bibliothèque comme une autre.

## Ce qui n'est pas vérifié

- **On ne sait pas ce qui fait que le V8 sonne mieux.** David l'a entendu, la
  machine ne l'a pas mesuré, et rien dans les relevés ne le montre : les deux
  banques ont des chiffres comparables de vitesse de lecture et de bouclage.
  C'est exactement le genre de question que ce lot dit depuis le début ne pas
  savoir trancher sans oreille.

## Tranché

David, le 14 septembre 2026 :

> on va faire mieux : au lieu de livrer juste une banque de démo, on va livrer
> tout ce qu'on a généré (donc, tout ce qui est légalement livrable puisque
> procar n'est pas à nous), en mettant le v8-crossplane en premier dans la liste
> (profil par défaut).

La question posée était « démonstration en V8 ou en quatre cylindres ». La
réponse est **les trois**, avec le V8 croisé en tête. Ce que ça change au-delà de
l'arbitrage : la notion même de « banque de démonstration » disparaît, et le
profil V8 qui désignait `procar` — muet chez qui découvre — cesse d'être livré.

Exécuté dans le ticket 09.
