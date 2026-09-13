# 09 — Reprendre son compte quand on a tout perdu

**Statut :** 🧑 attend David — la voie tierce est proposée, pas tranchée

**Bloqué par :** [05 — Relier un second appareil](05-relier-un-appareil-par-un-code.md).

## Ce qu'il faut obtenir

Le [code à scanner](05-relier-un-appareil-par-un-code.md) relie deux appareils
qu'on a **sous la main**. Il ne peut rien quand on n'en a plus aucun : navigateur
nettoyé, voiture changée, téléphone perdu. Il faut alors quelque chose qui
survive à l'appareil.

Deux voies, et aucune n'est obligatoire.

## Ce à quoi il faut faire attention

- **Aucune des deux ne doit s'imposer à qui déploie chez lui.** Chacune demande
  une configuration ; celle qui n'est pas configurée **n'apparaît pas à l'écran**.
  Une installation sans rien garde le code à scanner, qui suffit tant qu'on a un
  appareil.
- **Une adresse seule n'ouvre rien.** Sans mot de passe et sans moyen de vérifier
  l'adresse, n'importe qui saisissant la vôtre entrerait dans votre compte. Le mot
  de passe n'est donc pas un confort, c'est ce qui tient la voie debout.
- **Se passer du mot de passe demande d'envoyer du courriel** — lien ou code à
  usage unique —, donc un relais à configurer. Chez David, celui du NAS.
- **Sans adresse, on ne reprend rien**, et l'écran le dit déjà. C'est accepté par
  David le 13 septembre 2026 : « sinon on est fichu ».

### La voie a — une adresse et un mot de passe

Le compte gagne une vraie adresse en remplacement de celle que la bibliothèque
avait fabriquée, et un mot de passe choisi. « J'ai oublié » envoie un message,
**quand un relais est configuré** ; sans relais, il n'y a rien à oublier puisque
personne n'a saisi d'adresse.

### La voie b — continuer avec un compte tiers

**Proposée le 13 septembre 2026, à l'initiative de David, et pas encore
tranchée.**

Ce qui la rend intéressante : elle **supprime le besoin d'envoi de courriel**. Un
compte tiers donne une adresse déjà vérifiée, sans qu'on envoie quoi que ce soit,
et sans mot de passe à retenir.

Ce qu'elle coûte, et qui est vérifié :

- La table existe déjà. `auth_identities` a été créée au
  [ticket 01](01-better-auth-entre-dans-le-serveur.md) avec `provider_id`,
  `provider_account_id`, `access_token`, `refresh_token`, `scope` : c'est
  exactement sa raison d'être. **Aucune migration.**
- La bibliothèque livre trente-six fournisseurs, dont Google, Apple, Microsoft et
  GitHub, sans dépendance de plus. La configuration tient en trois lignes.
- Le rattachement d'un compte anonyme à un compte tiers est **déjà prévu par la
  bibliothèque** : son greffon anonyme retient l'utilisateur anonyme avant la
  redirection et déclenche le rattachement au retour.
- Il faut créer une application chez chaque fournisseur — un identifiant, un
  secret, une adresse de retour déclarée.
- **`SPEED_URL` devient obligatoire** pour cette voie : l'adresse de retour doit
  être connue et stable. C'est précisément ce que l'avertissement relevé au
  ticket 01 annonçait.
- **Le geste ne se fait pas dans la voiture.** Il demande d'atteindre le
  fournisseur **et** le serveur au même moment, avec une redirection et une
  saisie ; or le README dit que le NAS n'a le plus souvent pas besoin d'être
  joignable de l'extérieur, et l'application est faite pour rouler hors réseau.
  Depuis le bureau ou le téléphone, à la maison ou en 4G, c'est un geste ordinaire.
- **À vérifier avant de promettre quoi que ce soit dans la voiture** : certains
  fournisseurs refusent les navigateurs embarqués. Celui de la Tesla est un
  Chromium complet et non une vue intégrée, donc il n'y a pas de raison de penser
  que ce soit bloqué — mais ce n'est pas mesuré, et le lot
  [NAVIGATEUR-VOITURE](../../NAVIGATEUR-VOITURE/spec.md) rappelle qu'on n'y a ni
  console ni outils pour diagnostiquer.

## Ce qui reste à trancher

1. Fait-on la voie b ? Si oui, quels fournisseurs ?
2. Fait-on les deux, ou la voie b **remplace-t-elle** la voie a — auquel cas il
   n'y a jamais de courriel à envoyer, ni de relais à configurer, ni de mot de
   passe oublié à traiter ?

## Critères d'acceptation

- [ ] Une installation sans rien configuré n'affiche aucune des deux voies, et
      garde le code à scanner
- [ ] La voie configurée rattache le compte **existant** : rien ne se perd, aucun
      compte orphelin
- [ ] Un compte repris depuis un appareil neuf y ramène profils, moteurs, boîtes,
      trajets et profil mesuré
- [ ] Hors réseau, l'écran dit qu'on ne peut pas se connecter maintenant
