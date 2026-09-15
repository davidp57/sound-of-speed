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

**Un seul geste : « s'authentifier avec Google ».** Tranché par David le
15 septembre 2026. L'application résout ensuite, et demande validation avant
d'agir :

| Ce que Google rend | Ce qu'on fait |
|---|---|
| une adresse qui désigne un compte existant | on le dit, l'utilisateur valide, on **ouvre** ce compte |
| une adresse inconnue | on le dit, l'utilisateur valide, on **rattache** l'adresse au compte que cet appareil porte |

### La troisième branche n'est pas « créer », et c'est déjà instruit

L'énoncé de départ disait « sinon on crée ». Le code l'interdit délibérément,
et la raison est écrite dans `core/identity/tiers.ts` : « il n'en crée jamais
aucun […]. Sans cela, ce bouton fabriquerait depuis la voiture un compte neuf et
vide, et abandonnerait les réglages qu'on avait. »

Le cas que cette raison protège est exactement celui qui a montré le défaut :
**l'appareil porte déjà un compte anonyme avec des profils**. Créer les
abandonnerait ; rattacher les garde, et c'est ce que fait déjà `link-social`.

Pour l'utilisateur, ça reste un seul bouton : la différence est dans ce que
l'application fait derrière.

### Le point de séquence qui décide de la forme

**On ne sait pas si l'adresse est connue avant d'être passé par Google.** La
validation arrive donc **au retour** de la redirection, pas avant : Google →
retour → « ce compte existe, l'ouvrir ? » ou « rattacher cette adresse à ce que
porte cet appareil ? » → validation → action.

C'est ce que la mise en œuvre doit trancher : tenter `sign-in/social` et retomber
sur `link-social` quand le serveur refuse, ou une route qui décide côté serveur.
Le second demande de sortir du chemin natif de la bibliothèque.

### Ce qui reste à ranger

Le reste de l'écran — code à donner, code à recevoir, appareil, emporter,
supprimer — mérite d'être remis dans l'ordre de ce qu'on vient y faire : c'est
l'« agencement » que David vise, au-delà du seul bouton d'authentification.

## Critères d'acceptation

- [ ] Un seul bouton « s'authentifier avec Google », visible sans déplier ni
      faire défiler
- [ ] Une adresse qui désigne un compte existant l'ouvre, après validation, et
      l'écran dit ce que devient le compte que l'appareil portait
- [ ] Une adresse inconnue se rattache au compte courant, après validation :
      **rien de ce qu'il portait n'est perdu**
- [ ] Aucun chemin ne fabrique un compte neuf et vide en abandonnant des
      réglages — c'est la garde que `tiers.ts` posait, et elle doit tenir
- [ ] L'utilisateur voit ce qui va se passer **avant** de valider, pas après
- [ ] L'ordre des sections suit ce qu'on vient y faire, du plus fréquent au plus
      rare
- [ ] Vérifié sur les trois appareils : au volant, l'écran ne propose pas ce qui
      demande un clavier

## À traiter avec le [ticket 19](19-le-compte-tiers-ne-se-dit-pas-a-l-ecran.md)

Les deux se sont montrés dans le même parcours, et le second brouille le premier :
tant qu'un compte Google rattaché s'annonce comme anonyme, on ne peut pas juger
si l'écran montre le bon geste au bon moment.
