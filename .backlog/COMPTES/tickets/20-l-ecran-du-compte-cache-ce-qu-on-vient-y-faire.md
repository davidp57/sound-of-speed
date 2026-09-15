# 20 — L'écran du compte cache ce qu'on vient y faire

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qui a été observé

David, le 14 septembre 2026 : « l'agencement de l'écran Comptes laisse à
désirer ; en particulier, le fait d'avoir caché tout en bas le rattachement du
compte par Google ou par mot de passe est une idée à la con : on veut justement
qu'ils le voient du premier coup d'œil ».

## Ce que l'écran fait aujourd'hui

Trois gestes mènent à un compte enregistré, et ils sont à trois endroits :

| Geste | Où | Quand il apparaît |
|---|---|---|
| **Enregistrer ce compte** — adresse et mot de passe, ou un compte tiers | en haut | seulement si le compte est encore anonyme |
| **Ajouter une façon de se reconnecter** | en haut | seulement si le compte est déjà enregistré |
| **Ouvrir un autre compte sur cet appareil** | replié, tout en bas | toujours |

Le repli du troisième a une raison, écrite dans le code : « le geste rare, et le
seul qui fasse perdre quelque chose ».

## Pourquoi cette raison ne tient pas

Elle décrit quelqu'un qui **a** son compte et pourrait le perdre par mégarde.
Elle ne décrit pas le cas qui s'est présenté : arriver sur un poste neuf, y
trouver un compte anonyme créé tout seul, et vouloir retrouver **son** compte
Google qui existe déjà ailleurs.

Pour cette personne, ce n'est pas un geste rare — c'est le premier. Et c'est le
plus caché de l'écran.

Le geste mis en avant, lui — « Enregistrer ce compte » — ferait autre chose :
il donnerait une adresse à l'anonyme local, créant un second compte au lieu de
rejoindre celui qu'on a.

## Ce qu'il faut obtenir

Quelqu'un qui ouvre cet écran voit du premier coup d'œil ce qui mène à un compte
enregistré — qu'il en ait déjà un ailleurs ou non.

**La forme n'est pas tranchée** et mérite d'être cuisinée : faut-il fondre
« enregistrer » et « se connecter » en un seul bloc, comme le font les autres
applications avec un « continuer avec Google » qui fait les deux selon le cas ?
Garder deux gestes distincts mais les monter tous les deux ? Le reste de l'écran
— code à donner, code à recevoir, appareil, emporter, supprimer — mérite aussi
d'être rangé au passage : c'est l'« agencement » que David vise.

## Critères d'acceptation

- [ ] Depuis un compte anonyme, se connecter à un compte existant se voit sans
      déplier ni faire défiler
- [ ] La distinction entre enregistrer l'anonyme local et rejoindre un compte qui
      existe est claire pour qui ne connaît ni l'un ni l'autre
- [ ] Le geste qui fait perdre le compte courant reste protégé d'un geste
      distrait, sans être introuvable
- [ ] L'ordre des sections suit ce qu'on vient y faire, du plus fréquent au plus
      rare
- [ ] Vérifié sur les trois appareils : au volant, l'écran ne propose pas ce qui
      demande un clavier

## À traiter avec le [ticket 19](19-le-compte-tiers-ne-se-dit-pas-a-l-ecran.md)

Les deux se sont montrés dans le même parcours, et le second brouille le premier :
tant qu'un compte Google rattaché s'annonce comme anonyme, on ne peut pas juger
si l'écran montre le bon geste au bon moment.
