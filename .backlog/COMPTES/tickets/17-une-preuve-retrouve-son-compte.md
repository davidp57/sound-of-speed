# 17 — Une preuve retrouve son compte

**Statut :** ✅ fait — 13 septembre 2026

**Vient de** l'essai de David sur la pile de production, le soir même où Google a
été configuré.

## Ce qui se passait

Rattacher son compte Google marchait. S'en servir ensuite pour rouvrir son compte
depuis un autre navigateur, jamais : l'écran répondait que ce fournisseur n'avait
été rattaché à aucun compte d'ici.

Relevé dans la base de production : le compte portait bien la preuve `google`,
posée une minute après sa création, et avec elle cinq profils, trois moteurs,
trois boîtes et quatre-vingt-quatorze dépôts. La preuve était là ; la connexion
la refusait quand même.

## La cause

Pour savoir à qui appartient une preuve, la bibliothèque appelle
`findAccountOwnerByKey`, qui **joint** la preuve et son compte. Deux choses
manquaient, et il fallait les deux :

1. **Les relations Drizzle n'étaient pas déclarées.** La jointure native n'avait
   rien à suivre.
2. **Les jointures natives n'étaient pas demandées.** Sans
   `advanced.database.joins`, la bibliothèque prend un repli qui, sur un schéma
   dont les tables et les champs sont renommés comme ici, rend un compte vide.

Résultat : la preuve était trouvée, son propriétaire non. La bibliothèque
concluait que la preuve était **orpheline** et refusait — avec un message qui
parlait d'un rattachement manquant.

**Ce défaut ne pouvait pas apparaître avant qu'un fournisseur soit configuré**,
ce qui n'était le cas d'aucun serveur jusqu'à ce soir-là. Et il est asymétrique :
le rattachement sait déjà de quel compte il parle, donc il marchait. On
rattachait Google avec succès, et on ne pouvait plus s'en servir pour revenir.

## Ce qui a été fait

- Les deux relations descendantes — d'une preuve vers son compte, d'une session
  vers son compte — et les deux montantes, dans `base/schema.ts`.
- `advanced: { database: { joins: true } }` sur la bibliothèque.
- `proprietaire.test.ts` : deux tests sur la seule question qui compte, à qui
  appartient cette preuve. Ils échouent sans l'un ou l'autre des deux points
  ci-dessus.

**Les noms des relations ne sont pas libres**, et l'un d'eux porte un `s` en trop
(`auth_identitiess`) : c'est le nom que l'adaptateur construit pour une relation
à plusieurs. Le corriger en le relisant casserait la connexion par mot de passe,
et seulement à l'exécution. Le commentaire du schéma le dit, les tests le
tiennent.

## Ce qui reste

Que David rouvre son compte par Google, sur la pile redéployée.
