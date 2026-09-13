# 12 — Un compte tenu ailleurs, et seulement s'il est configuré

**Statut :** ✅ fait — 13 septembre 2026, pour le code. Les identifiants des
trois fournisseurs restent à obtenir : c'est un dossier à déposer, pas un
développement, et la marche à suivre est plus bas.

**Bloqué par :** [11 — Un vrai compte](11-un-vrai-compte.md).

**Reprend** les arbitrages du [ticket 09](09-reprendre-son-compte.md), voie b.

## Ce qu'il faut obtenir

Se connecter avec un compte tenu ailleurs, **en plus** de l'adresse et du mot de
passe, jamais à la place. Tranché par David le 13 septembre 2026, contre la
recommandation inverse : celle-ci tenait sur une présomption — « personne n'est
sans compte tiers » — qui n'est pas un fait.

**Tesla est à essayer en premier.** C'est le fournisseur dont le compte
correspond à la personne assise dans la voiture. Ce qui reste à vérifier est
l'approbation de l'application de leur côté.

## Ce à quoi il faut faire attention

- **Ce qui n'est pas configuré n'apparaît pas.** Celui qui déploie chez lui n'a
  aucun service tiers à inscrire, et son écran ne doit pas montrer un bouton qui
  mène à une erreur.
- **`SPEED_URL` devient indispensable** dès qu'un fournisseur doit revenir sur le
  site : derrière un proxy inversé, l'adresse publique ne se devine pas depuis le
  conteneur, qui ne voit qu'un port local.
- **Un compte tiers s'ajoute à un compte qui existe**, il n'en crée pas un
  second : c'est une preuve de plus, dans `auth_identities`.
- **Perdre l'accès au fournisseur ne doit pas perdre le compte** — d'où l'ordre
  des tickets : l'adresse et le mot de passe d'abord.

## Ce qui a été fait

**Trois fournisseurs, deux montages, et le montage ne se voit pas en aval.**
Google et Apple passent par ce que la bibliothèque d'identité porte déjà ; Tesla
par son greffon générique, monté sur son **document de découverte OpenID
Connect**. Les trois répondent ensuite aux mêmes routes, et l'écran ne sait pas
lequel est lequel. Le choix tient à Apple : il ne rend pas de profil sur une
route à part — son identité vit dans le jeton signé — et son « secret » n'est pas
un secret mais un jeton qui se périme. Refaire cette plomberie à la main aurait
donné le même résultat avec les défauts en plus.

**Un compte tenu ailleurs ne crée jamais de compte** (`disableSignUp`). Se
connecter avec un fournisseur jamais rattaché échoue. Sans cela, ce bouton pressé
depuis la voiture aurait fabriqué un compte neuf et vide et abandonné les
réglages qu'on avait — l'inverse exact de ce qu'on venait chercher.

**Le rattachement se demande, il ne se devine pas**
(`accountLinking.disableImplicitLinking`). La bibliothèque relie d'ordinaire
d'elle-même un compte tiers à un compte d'ici qui porte la même adresse ; ici ce
serait un piège. Et comme un compte anonyme porte une adresse fabriquée sous
`.invalid`, qui ne vaudra jamais celle de Google, il a fallu ouvrir
`allowDifferentEmails` : ce que cette option ouvre d'ordinaire — un rattachement
sur la foi d'une adresse — reste fermé par la ligne du dessus. La session est la
preuve, et l'adresse du compte ne bouge pas.

**Un compte rattaché cesse d'être anonyme.** `is_anonymous` ne dit pas « sans
nom » mais « s'est créé tout seul, et rien ne permet d'y revenir ». Le laisser
vrai aurait une conséquence réelle : un compte relié à Tesla mais encore vide se
serait fait effacer au passage d'un autre appareil.

**Le compte abandonné se règle au retour.** Se connecter par adresse règle les
deux dans le même passage ; un aller-retour chez un fournisseur ne le permet pas,
le navigateur quittant le site. L'appareil range donc l'identifiant de son compte
avant de partir, et le rend au retour à `/compte/regler-l-ancien`, qui applique
la règle existante — effacé s'il est anonyme et vide, gardé sinon. Ce qu'on
accepte sur parole est borné par cette règle : reste, à qui devinerait un
identifiant de trente-deux caractères, la possibilité d'effacer un compte qui ne
porte rien. C'est assumé, et écrit dans le code plutôt que tu.

**`/compte/possibilites` lit ce qui est monté, pas ce qui était demandé.** Un
fournisseur dont le document de découverte ne répond pas au démarrage est écarté
par la bibliothèque ; l'annoncer quand même donnerait le bouton qui mène à une
erreur que ce ticket interdit.

### Ce qui a été mesuré

Sur le serveur construit, avec des identifiants factices :

- `SPEED_OAUTH_GOOGLE_*` seul → `/compte/possibilites` rend
  `[{"id":"google","nom":"Google"}]` ; rien de configuré → `[]`.
- `SPEED_OAUTH_TESLA_*` → le greffon lit le vrai document de découverte de Tesla
  et `link-social` rend
  `https://auth.tesla.com/oauth2/v3/authorize?…&redirect_uri=…/api/auth/callback/tesla&nonce=…&code_challenge_method=S256`.
  L'adresse de retour est bien celle de `SPEED_URL`.
- Depuis l'écran du compte, dans un navigateur : le bouton emmène chez Google,
  qui répond « The OAuth client was not found » — le seul refus qu'un identifiant
  factice puisse produire.
- Le retour : `?compte=rattache` affiche la bannière de rattachement,
  `?compte=refuse` celle du refus, et le paramètre disparaît de l'adresse.
- Le compte abandonné : un compte anonyme et vide mis de côté avant le départ est
  **effacé** au retour de `?compte=connecte` — sa session ne répond plus rien.
- Le poids : **1 342 octets compressés de plus** pour la voiture, 101 119 avant,
  102 461 après. La bibliothèque, elle, ne quitte pas le serveur.

## Ce qu'il reste : obtenir les identifiants

Aucun des trois n'est un développement. C'est un dossier à déposer, et les trois
ne demandent pas le même effort.

### Google — cinq minutes, gratuit

1. Sur la [console Google Cloud](https://console.cloud.google.com/), créer un
   projet (ou en reprendre un).
2. *APIs & Services* → *OAuth consent screen* : type **External**, nom de
   l'application, adresse d'assistance. Tant que l'écran n'est pas publié, seuls
   les comptes inscrits en *Test users* peuvent se connecter — ce qui suffit pour
   un usage personnel.
3. *APIs & Services* → *Credentials* → *Create credentials* → *OAuth client ID*,
   type **Web application**.
4. En *Authorized redirect URIs*, ajouter exactement :
   `https://<domaine public>/api/auth/callback/google`.
5. Reporter l'identifiant et le secret dans `SPEED_OAUTH_GOOGLE_ID` et
   `SPEED_OAUTH_GOOGLE_SECRET`, dans l'écran de la pile Portainer, section
   *Environment variables*.

Les deux piles ayant deux adresses, déclarer **les deux** adresses de retour chez
Google : celle de l'intégration et celle de la production. Un client OAuth en
accepte plusieurs, et c'est ce qui évite d'avoir à en créer un second.

### Apple — adhésion payante, et un secret qui se périme

1. Adhérer à l'*Apple Developer Program* (99 $ par an). C'est le préalable, et il
   n'y a pas de contournement.
2. Créer un **App ID** avec la capacité *Sign in with Apple*.
3. Créer un **Services ID** : c'est lui, et non l'App ID, qui sert de
   `client_id`. Y activer *Sign in with Apple*, déclarer le domaine et, en
   *Return URL*, `https://<domaine public>/api/auth/callback/apple`.
4. Créer une **clé** (*Keys*) avec *Sign in with Apple* activé, et télécharger le
   fichier `.p8` — il ne se retélécharge pas.
5. Le « secret » d'Apple n'est pas un secret fixe : c'est un **jeton signé** en
   ES256 avec cette clé, où `iss` est l'identifiant d'équipe, `sub` le Services
   ID, `aud` vaut `https://appleid.apple.com`, et `exp` est plafonné à **six
   mois**. C'est lui qu'on met dans `SPEED_OAUTH_APPLE_SECRET`, et **il faudra le
   refaire deux fois par an** — sans quoi le bouton Apple cessera de marcher un
   matin, sans prévenir. Cette servitude est la raison de ne configurer Apple que
   si quelqu'un le demande.

### Tesla — un dossier, et rien ne dit qu'il passe

Ce qui est **vérifié** au 13 septembre 2026, et ce qui ne l'est pas.

**Vérifié, en interrogeant leurs serveurs.** Tesla est un fournisseur OpenID
Connect en bonne et due forme. Son document de découverte,
`https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3/.well-known/openid-configuration`,
annonce `scopes_supported: ["email","profile","openid","metadata"]`, un
`userinfo_endpoint` et un jeu de clés de signature. Techniquement, il n'y a rien
de particulier à écrire : c'est le cas générique, et il est en place.

**Vérifié, dans leur documentation.** Les points d'accès d'authentification **ne
sont pas facturés** (« Authentication endpoints are not billed ») : se servir de
Tesla comme identité seulement ne coûte rien, indépendamment de la tarification à
l'usage de la Fleet API, entrée en vigueur le 1ᵉʳ février 2025.

**Vérifié, et c'est là que ça coince.** Leur procédure de création d'application
tient en quatre étapes, et les trois dernières ne sont pas des formalités :

1. Un compte Tesla avec adresse vérifiée et authentification à deux facteurs.
2. Une demande d'accès portant des « legal business details » — informations
   d'entreprise —, le nom de l'application, sa description et l'usage prévu.
   C'est une demande, donc quelque chose qui peut être refusé.
3. Une paire de clés EC (courbe `prime256v1`) dont la partie publique doit être
   servie, et **rester** servie, à
   `https://<domaine>/.well-known/appspecific/com.tesla.3p.public-key.pem`. Leur
   documentation présente ce point comme obligatoire pour **toute** application,
   pas seulement pour celles qui commandent la voiture.
4. Un appel d'enregistrement `POST /api/1/partner_accounts`, avec un jeton de
   partenaire, **à refaire dans chaque région d'exploitation**. Le domaine doit
   correspondre à la racine des `allowed_origins` déclarées.

**Ce qui n'est pas vérifié**, et ne peut pas l'être depuis ce dépôt : si une
demande sans société derrière aboutit. Aucune demande n'a été déposée.

La clé publique, elle, ne demande rien de plus que ce que le serveur sait déjà
faire : elle se génère avec
`openssl ecparam -name prime256v1 -genkey -noout -out cle-privee.pem` puis
`openssl ec -in cle-privee.pem -pubout -out cle-publique.pem`, et se sert comme
un fichier statique sous `/.well-known/`.

## Critères d'acceptation

- [x] Un compte tiers se rattache à un compte existant, sans en créer un autre
- [x] Un fournisseur non configuré n'apparaît pas à l'écran
- [x] La connexion par ce compte rouvre le même compte, avec tout ce qu'il porte
      — la mécanique est éprouvée bout en bout avec un identifiant factice ; elle
      ne s'éprouve avec un vrai qu'une fois les identifiants obtenus
- [x] Ce qui est vérifié de l'approbation côté Tesla est écrit, y compris si elle
      n'a pas abouti
