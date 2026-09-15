# 02 — Une banque restreinte ne descend que chez qui y a droit

**Statut :** ⬜ prêt

**Bloqué par :** 01 — La banque d'échantillons ne descend plus sans compte

## Ce qu'il faut obtenir

Toutes les banques ne sont pas à nous. Celles-là ne doivent atteindre qu'une
poignée de comptes nommés, et le serveur doit le faire respecter lui-même.

Après ce ticket, une banque peut être déclarée restreinte. Le serveur la refuse à
tout compte qui n'y a pas droit, et surtout **elle n'apparaît pas dans le listage
que ces comptes reçoivent** : son existence ne doit pas fuir plus que son
contenu.

La déclaration de ce qui est restreint, et la liste des comptes qui y ont droit,
se posent **par la configuration du serveur**, jamais par une route. Personne ne
doit pouvoir s'attribuer ce droit en appelant quoi que ce soit. Un écran pour
gérer tout cela viendra dans le lot RÉGIE ; ici, la configuration suffit, et elle
est ce qui rend le contrôle sûr.

Rien dans le dépôt ne doit dire quelle banque est concernée.

## Critères d'acceptation

- [ ] Une banque déclarée restreinte est absente du listage servi à un compte qui
      n'y a pas droit.
- [ ] Un fichier de cette banque, demandé directement par un tel compte, reçoit
      un refus.
- [ ] Un compte qui y a droit la voit et la joue comme n'importe quelle autre.
- [ ] Aucune route ne permet d'accorder ni de s'accorder ce droit.
- [ ] Ni le nom de la banque ni la liste des comptes n'apparaissent dans le
      dépôt.
- [ ] Un profil qui désigne une banque à laquelle le compte n'a pas droit se
      comporte comme devant une banque absente, et non comme devant une panne.
