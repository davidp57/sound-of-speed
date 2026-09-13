# 12 — Un compte tenu ailleurs, et seulement s'il est configuré

**Statut :** ⬜ prêt

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

## Critères d'acceptation

- [ ] Un compte tiers se rattache à un compte existant, sans en créer un autre
- [ ] Un fournisseur non configuré n'apparaît pas à l'écran
- [ ] La connexion par ce compte rouvre le même compte, avec tout ce qu'il porte
- [ ] Ce qui est vérifié de l'approbation côté Tesla est écrit, y compris si elle
      n'a pas abouti
