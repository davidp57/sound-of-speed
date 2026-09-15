# 20 — L'écran du compte cache ce qu'on vient y faire

**Statut :** ✅ fait

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

### L'intention se déclare d'abord, le moyen ensuite

**La forme est tranchée par David le 15 septembre 2026**, et elle supprime le
problème au lieu de le contourner.

Le problème était réel : la bibliothèque agit **au retour de la redirection**,
pas sur validation, et son garde-fou « ne se déclenche que lorsqu'aucun
utilisateur existant n'est trouvé ». Le verdict tombe donc après Google, et
aucune des deux routes ne sait faire les deux cas :

| Route | Adresse connue | Adresse inconnue |
|---|---|---|
| `sign-in/social` | ouvre le compte | refuse |
| `link-social` | refuse | rattache |

Un bouton unique aurait dû choisir sans savoir. **Demander l'intention avant de
partir lève l'inconnue** : on sait quelle route appeler, sans deviner, sans deux
allers-retours, et sans reprendre le rappel OAuth.

L'écran porte donc **deux boutons d'intention** :

- **« J'ai déjà un compte »** → ouvre le compte que le moyen désigne ;
- **« Je n'en ai pas encore »** → rattache le moyen au compte de cet appareil.

Les libellés sont des **états**, pas des opérations : « rattacher un compte
existant » se lisait à l'envers — comme attacher ce compte-là à celui-ci, donc
fusionner.

Chacun ouvre **la même fenêtre**, qui ne demande que le *moyen* : un compte tenu
ailleurs — Google aujourd'hui, d'autres ensuite — ou une adresse et un mot de
passe. Un seul modèle pour tous les moyens, présents et à venir.

Une **vraie fenêtre modale**, décidée par David : c'est la norme pour ce geste.
Elle s'appuie sur `<dialog>`, natif — aucune bibliothèque, et le piégeage du
focus vient avec.

### Se tromper d'intention se rattrape

C'est le cas qui arrivera, et il ne doit pas punir : on clique « je n'en ai pas
encore », et l'adresse Google a déjà un compte.

Le retour distingue déjà `refus-connexion` de `refus-rattachement`. Chacun sait
donc ce qui a manqué, et propose l'autre intention plutôt qu'un message d'erreur :

| Refus | Ce qu'on propose |
|---|---|
| `refus-connexion` — aucun compte avec ce moyen | « Aucun compte ne s'ouvre avec ça. En créer un ? » |
| `refus-rattachement` — ce moyen sert déjà ailleurs | « Ce moyen ouvre déjà un compte. L'ouvrir ? » |

L'intention devient une orientation, pas un engagement : personne ne peut se
coincer.

### Ce que « j'ai déjà un compte » coûte, et qui doit se lire avant

Ouvrir un compte existant fait **quitter** celui que l'appareil porte — effacé
s'il est vide, gardé sinon. C'est écrit aujourd'hui dans le repli du bas ; ça
doit survivre au déménagement et se lire dans la fenêtre, pas après.

### Ce qui reste à ranger

Le reste de l'écran — code à donner, code à recevoir, appareil, emporter,
supprimer — mérite d'être remis dans l'ordre de ce qu'on vient y faire : c'est
l'« agencement » que David vise, au-delà du seul bouton d'authentification.

## Critères d'acceptation

- [x] Deux boutons d'intention, visibles sans déplier ni faire défiler
- [x] Les deux ouvrent la même fenêtre, qui ne demande que le moyen
- [x] Le moyen vaut pour tous : compte tenu ailleurs comme adresse et mot de
      passe, et un fournisseur de plus n'ajoute qu'une icône
- [x] « J'ai déjà un compte » dit **dans la fenêtre** ce que devient le compte
      que l'appareil porte
- [x] Un refus propose l'autre intention au lieu d'un message d'erreur, dans les
      deux sens
- [x] Aucun chemin ne fabrique un compte neuf et vide en abandonnant des
      réglages — c'est la garde que `disableSignUp` pose, et elle doit tenir
- [ ] ~~L'ordre des sections suit ce qu'on vient y faire~~ — **non fait**, voir
      « ce qui reste à ranger » ci-dessus. Ce lot a remonté le geste
      d'authentification et retiré le repli ; les autres sections — code à
      donner, code à recevoir, appareil, emporter, supprimer — n'ont pas bougé.
- [x] Vérifié sur les trois appareils : au volant, l'écran ne propose pas ce qui
      demande un clavier

## Ce qui a été fait, et vérifié

Le repli du bas a disparu. À sa place, un bouton qui ouvre la même fenêtre que
l'intention « j'ai déjà un compte » — ce qui protège d'un geste distrait n'est
plus d'être caché, mais la fenêtre : elle demande un choix explicite et dit ce
que ça coûte avant d'agir.

**La fenêtre se ferme sur un succès, reste ouverte sur un échec.** C'est un
défaut trouvé en essayant : après la création, elle restait par-dessus un compte
qui venait d'être créé, en affichant encore « Créer votre compte » — ce qui se
lit comme un échec. Les deux gestes rendent maintenant un verdict plutôt que de
laisser l'écran deviner au message affiché.

Vérifié sur un vrai serveur, base neuve, parcours complet :

| | Résultat |
|---|---|
| Deux intentions en tête, compte anonyme | oui |
| La fenêtre change de propos et d'avertissement selon l'intention | oui |
| Créer un compte par adresse | fait, fenêtre fermée, écran à jour |
| Mot de passe faux | fenêtre ouverte, message dans la fenêtre |
| En 375 px | 339 × 289, tient en hauteur, aucun débordement |
| Appareil « voiture » | aucune intention, aucun champ, « Pas au volant » |

La fenêtre n'est même plus montée sur l'appareil « voiture » : elle était
fermée et inatteignable, mais un champ de mot de passe n'a rien à faire dans le
document d'une voiture.

Ce qui n'a **pas** été vérifié : le parcours OAuth lui-même, qui demande le NAS
et Google configuré. Le serveur d'essai n'a aucun fournisseur monté — ce qui a
au moins prouvé que la fenêtre se passe d'eux proprement, sans bouton ni « ou »
orphelin.

## Fait avec le [ticket 19](19-le-compte-tiers-ne-se-dit-pas-a-l-ecran.md)

Les deux se sont montrés dans le même parcours, et le second brouillait le
premier : tant qu'un compte Google rattaché s'annonçait comme anonyme, on ne
pouvait pas juger si l'écran montrait le bon geste au bon moment.
