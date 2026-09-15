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

**Un seul geste : « s'authentifier avec Google ».** Tranché par David les 15 et
16 septembre 2026. Une fois l'adresse connue, deux cas et deux seulement :

| Ce que Google rend | Ce qu'on fait |
|---|---|
| une adresse qui désigne un compte existant | on **ouvre** ce compte |
| une adresse inconnue | on la **rattache** au compte que cet appareil porte |

Le second se dit « créer un compte avec cette adresse » à l'écran : c'est ce que
la personne croit faire, et c'est ce qui compte. Techniquement c'est un
rattachement, et il faut que ç'en reste un — l'appareil porte déjà un compte
anonyme avec des profils, et une vraie création les abandonnerait. C'est la garde
que `disableSignUp` pose sur chaque fournisseur, pour la raison écrite dans
`server/tiers.ts` : « cliquer *se connecter avec Google* depuis la voiture
fabriquerait un compte neuf et vide, et abandonnerait les réglages qu'on avait ».

### On annonce avant de partir, on applique au retour

C'est le point qui décide de la forme, et il est tranché : **(a)**.

La bibliothèque agit **au retour de la redirection**, pas sur validation.
`sign-in/social` ouvre la session dès que Google répond ; `link-social` rattache
dès que Google répond. Il n'existe pas de moment où l'on connaît l'adresse sans
avoir déjà agi — et « revenir à l'anonyme » n'est pas toujours possible, un
compte quitté vide étant effacé.

Donc le bouton **annonce les deux cas avant de partir** — « si un compte existe
avec cette adresse, il s'ouvrira ; sinon elle sera rattachée à ce compte-ci » —
et le retour applique sans redemander.

Ce que ça coûte, et qui est assumé : on ne peut pas dire non après avoir vu
l'adresse. Le consentement est donné en cliquant, en sachant ce qu'on déclenche.

Les deux autres voies ont été écartées : une route de retour à nous, qui lirait
l'identité sans rien faire et attendrait la validation, obligerait à écrire
nous-mêmes le rappel OAuth — la partie pour laquelle on a pris la bibliothèque ;
agir puis proposer de défaire n'est pas « ne rien faire », et le retour arrière
est parfois impossible.

### Ce qui reste à ranger

Le reste de l'écran — code à donner, code à recevoir, appareil, emporter,
supprimer — mérite d'être remis dans l'ordre de ce qu'on vient y faire : c'est
l'« agencement » que David vise, au-delà du seul bouton d'authentification.

## Critères d'acceptation

- [ ] Un seul bouton « s'authentifier avec Google », visible sans déplier ni
      faire défiler
- [ ] Il annonce les deux cas **avant** de partir chez Google
- [ ] Une adresse qui désigne un compte existant l'ouvre, et l'écran dit au
      retour ce qu'est devenu le compte que l'appareil portait
- [ ] Une adresse inconnue se rattache au compte courant : **rien de ce qu'il
      portait n'est perdu**
- [ ] Aucun chemin ne fabrique un compte neuf et vide en abandonnant des
      réglages — c'est la garde que `disableSignUp` pose, et elle doit tenir
- [ ] L'ordre des sections suit ce qu'on vient y faire, du plus fréquent au plus
      rare
- [ ] Vérifié sur les trois appareils : au volant, l'écran ne propose pas ce qui
      demande un clavier

## À traiter avec le [ticket 19](19-le-compte-tiers-ne-se-dit-pas-a-l-ecran.md)

Les deux se sont montrés dans le même parcours, et le second brouille le premier :
tant qu'un compte Google rattaché s'annonce comme anonyme, on ne peut pas juger
si l'écran montre le bon geste au bon moment.
