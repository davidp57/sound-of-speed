# 05 — Dire quelle banque manque, plutôt que le nom d'un fichier

**Statut :** ⬜ prêt — demandé par David le 17 septembre 2026

Le 17 septembre 2026, le profil « V8 adouci » a rendu l'application muette : sa
banque n'était pas entrée dans l'image, et le serveur rendait 404 sur chacune de
ses prises. Ce que David a vu, en orange au bas de l'écran de conduite :

> `on-1021.flac : 404`

Et rien d'autre. Pas de son, et le bouton du haut-parleur qui ne faisait rien —
il relançait un chargement voué à échouer.

## Ce que ce message ne dit pas

Trois choses, et ce sont les trois dont on a besoin :

- **De quelle banque il s'agit.** `on-1021.flac` existe dans deux banques ; le
  nom du fichier ne désigne pas le dossier, donc il ne désigne rien.
- **Que le profil n'est pas jouable ici.** C'est pourtant l'information : ce
  profil-là, sur ce serveur-là, ne peut pas sonner.
- **Ce qu'il faut faire.** Changer de profil suffit à retrouver le son. Personne
  ne peut le deviner de ce message.

Le diagnostic a demandé une conversation ; il tenait dans une phrase.

## Ce qu'il faut obtenir

Un message qui **nomme la banque** et dit le geste. Par exemple : « La banque
*gm-ls-adouci* n'est pas sur ce serveur. Choisissez un autre profil. »

## Ce à quoi il faut faire attention

- **404 et 401 ne mènent pas au même geste**, et le second existe depuis que la
  banque est fermée derrière un compte ([DURCIR, ticket
  01](../../DURCIR/tickets/01-fermer-la-banque-derriere-un-compte.md)). « Cette
  banque n'est pas ici » et « il faut un compte pour l'écouter » sont deux
  phrases, pas une.
- **Hors réseau n'est pas une panne.** Le cache sert les banques déjà écoutées
  ([ticket 04](04-cache-hors-reseau.md)) : un profil dont la banque n'a jamais
  été chargée est un cas différent d'un serveur injoignable, et le message doit
  les distinguer plutôt que crier au loup dans un tunnel.
- **Le message se lit en conduisant, sur 773 px de large.** Une phrase, pas un
  paragraphe, et le nom de la banque en clair.
- **Le bouton du haut-parleur ne doit pas mentir.** Tant que la banque manque, il
  relance un chargement qui échouera : soit il le dit, soit il ne s'offre pas.
- **L'erreur est déjà remontée jusqu'à l'écran**, dans `audioStatus.error` — c'est
  sa *formulation* qui manque, pas son chemin. Elle naît dans `load()`
  (`core/audio/engine.ts`), qui connaît le dossier autant que le fichier.

## Critères d'acceptation

- [ ] Une banque absente du serveur nomme **la banque**, pas un fichier
- [ ] Le message dit le geste qui rend le son
- [ ] Un refus faute de compte dit autre chose qu'une banque absente
- [ ] Le message tient sur une ligne à la largeur de l'écran de la voiture
- [ ] Vérifié dans l'application, sur les trois cas : banque absente, compte
      manquant, serveur injoignable

## Pourquoi ce ticket est ici

Le défaut vient de l'intendance d'une banque livrée — corrigée, et tenue
maintenant par trois tests. Mais l'intendance se retrompera un jour, et **un
message juste aurait fait gagner le diagnostic** plutôt que de le faire
dépendre d'une conversation. C'est un ticket de BANQUES parce que c'est une
banque qu'il s'agit de nommer.
