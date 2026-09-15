# 02 — Une banque restreinte ne descend que chez qui y a droit

**Statut :** 🧑 attend David — le mécanisme est fait ; ce qu'il faut y mettre
n'est pas dans le dépôt

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

- [x] Une banque déclarée restreinte est absente du listage servi à un compte qui
      n'y a pas droit.
- [x] Un fichier de cette banque, demandé directement par un tel compte, reçoit
      un refus.
- [x] Un compte qui y a droit la voit et la joue comme n'importe quelle autre.
- [x] Aucune route ne permet d'accorder ni de s'accorder ce droit.
- [x] Ni le nom de la banque ni la liste des comptes n'apparaissent dans le
      dépôt.
- [x] Un profil qui désigne une banque à laquelle le compte n'a pas droit se
      comporte comme devant une banque absente, et non comme devant une panne.

## Comment ça se déclare

Deux variables de la pile, et rien d'autre :

| Variable | Ce qu'elle dit |
|---|---|
| `SPEED_BANQUES_RESTREINTES` | les dossiers qui demandent un droit, séparés par des virgules |
| `SPEED_BANQUES_ACCORDEES` | qui a droit à quoi : `adresse=banque,banque;adresse=banque`, `*` accordant toutes les restreintes |

**L'adresse plutôt que l'identifiant du compte** : un identifiant fait
trente-deux caractères tirés au sort, et se recopierait de travers un jour sur
deux. Conséquence assumée : un compte sans adresse rattachée n'a jamais droit à
une banque restreinte, n'ayant rien pour le nommer.

**Un refus se donne en 404, pas en 403.** Dire « interdit » confirmerait
l'existence de ce qu'on cherche à taire — et c'est exactement ce que le profil
côté client sait déjà traiter : une banque absente, pas une panne.

## Ce qui a été vérifié

Sept cas : le fichier refusé et la banque absente du listage chez qui n'y a pas
droit, servie et listée chez le compte nommé, une banque nommée qui n'en accorde
pas une autre, le refus quand personne n'est nommé, et l'absence totale d'effet
quand rien n'est déclaré. Plus la lecture de la déclaration — espaces, entrées
sans forme, et une adresse qui revient deux fois et dont les droits s'ajoutent
au lieu de s'écraser.

## Ce qui attend David

**Rien à écrire dans le dépôt, et c'est voulu.** Il reste à poser les deux
variables dans l'écran de la pile : le dossier de la banque concernée, et les
adresses qui y ont droit. C'est le seul endroit où ces noms doivent exister.

Le ticket 03 — les identifiants opaques — n'est pas fait, et il porte le reste du
sujet : le nom voyage encore dans un profil partagé, dans une archive exportée et
dans le journal, là où cette porte-ci ne ferme rien.
