# ORIGINE — réinitialiser un profil à ce qu'il était

**Statut :** ✅ fait
**Branche :** `fix/origine-des-profils`
**Version visée :** 0.2

## Le problème

Relevé à l'usage : « les profils créés par le guide devraient avoir leurs
valeurs d'usine stockées pour que le réinitialiser soit efficace. Il me semble
qu'actuellement ça reset à des valeurs d'usine d'un profil par défaut (sport ?) »

C'est exact, et le code le disait en une ligne : un profil était reconnu **à son
identifiant**, et tous ceux qui n'étaient pas livrés retombaient sur
`createDefaultProfile()`, dont l'identifiant est `procar` et le nom **Sport**.

Réinitialiser une section d'un profil fabriqué rendait donc les réglages de
Sport, qu'on n'avait jamais choisis. La fonction ne servait à rien précisément là
où elle sert le plus : sur un profil qu'on vient de créer et qu'on tâtonne — le
cas pour lequel elle a été écrite, puisque « une valeur mal saisie dans la
transmission ne doit plus coûter ce qui a été trouvé ailleurs ».

## La solution

Chaque profil peut porter ses **valeurs d'origine** : ce qu'il était à sa
création, tout sauf son identité. C'est à elles que la réinitialisation le
ramène.

Trois sources, dans cet ordre : ses propres valeurs d'origine, puis le profil
livré de même identifiant, puis les valeurs génériques. Le troisième cas ne
reste utile que pour les profils venus d'une version antérieure, qui n'ont pas
d'origine enregistrée — on ne leur en invente pas une.

## Histoires

1. En tant qu'utilisateur, je veux qu'une valeur mal saisie sur un profil que
   j'ai créé se répare en réinitialisant sa section, sans hériter des réglages
   d'un profil que je n'ai pas choisi.
2. En tant qu'utilisateur, je veux pouvoir réinitialiser plusieurs fois : la
   première ne doit pas effacer le point de retour.
3. En tant qu'utilisateur, je veux qu'une duplication ait elle aussi un état de
   retour, et non celui de Sport.
4. En tant qu'utilisateur, je ne veux pas que mes liens de partage doublent de
   longueur pour transporter un état initial dont le destinataire n'a que faire.

## Décisions d'implémentation

- **Un instantané, pas les choix du guide.** Rejouer la construction demanderait
  aussi le profil qui servait de modèle à la création — ses couches, sa banque,
  son nombre de cylindres — donc de le stocker également. Autant garder
  directement le résultat.
- **L'identité ne se réinitialise pas** : identifiant, nom, statut de favori.
  C'était déjà le cas et ça le reste.
- **L'origine survit à la réinitialisation.** Sinon la première remise à neuf
  supprimerait le point de retour, et la deuxième retomberait sur Sport.
- **Une duplication hérite** de l'origine de son modèle, et à défaut relève ses
  valeurs du moment. Dans les deux cas elle a un état de retour, ce qui n'était
  pas le cas avant.
- **Ne voyage pas dans un lien**, comme le statut de favori : il doublerait sa
  longueur, déjà surveillée. Suit en revanche dans un fichier exporté, où la
  taille n'importe pas.
- **Pas de montée de version du format.** Le champ est facultatif, et son
  absence a un sens : le repli d'avant.

## Décisions de test

Le point délicat est le **repli** : trois chemins, et c'est le troisième qui
était seul en cause. Chacun est vérifié — un profil du guide revient à ses
propres valeurs, un profil livré aux siennes par son identifiant, un profil sans
origine au comportement d'avant.

Et deux garde-fous que le défaut suggère : réinitialiser deux fois de suite doit
marcher deux fois, et le lien de partage ne doit pas grossir.

## Hors périmètre

- Reconstruire une origine pour les profils déjà enregistrés sans elle. On ne
  peut pas la deviner, et l'inventer serait pire que le repli documenté.
- Un historique des réglages : ce lot rend **un** point de retour, celui de la
  création, pas une pile d'annulations.

## Ce que le lot a donné

Huit tests nouveaux, 266 au total. Le défaut tenait à une seule ligne, mais son
correctif touche quatre endroits — la création, la duplication, le fichier et le
lien — parce qu'un état de retour n'a de valeur que s'il suit le profil partout
où il va.
