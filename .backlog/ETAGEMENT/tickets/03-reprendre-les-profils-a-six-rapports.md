# 03 — Les profils à six rapports ne se perdent pas

**Statut :** ⬜ prêt

**Bloqué par :** 01.

## Ce qu'il faut obtenir

Les profils déjà enregistrés ont six rapports : ceux du stockage local du
téléphone, ceux déposés sur le NAS, et ceux partagés par URL. Ils doivent
continuer de s'ouvrir.

C'est le cinquième point de la checklist de `CLAUDE.md` : le format de profil
change de forme, donc `PROFILE_FORMAT_VERSION` monte et la reprise s'écrit dans
`core/preset/store.ts`.

**Ce que fait la reprise :** un profil à six rapports gagne une septième
dérivée de son propre étagement, plutôt que la valeur du V8 plaquée dessus — un
profil réglé à la main n'a pas à hériter des rapports d'un autre. Les tableaux
qui se comptent par rapport s'allongent en conséquence.

## Critères d'acceptation

- [ ] Un profil enregistré à six rapports s'ouvre et sonne, sans rien perdre.
- [ ] Un test part d'un profil au format précédent et vérifie les sept rapports
      obtenus, ainsi que la longueur des tableaux qui les suivent.
- [ ] Un profil partagé par URL, écrit avant ce lot, s'ouvre encore.
- [ ] `PROFILE_FORMAT_VERSION` monte d'un cran.
- [ ] Contrôle qualité vert.
