# 03 — Les profils à six rapports ne se perdent pas

**Statut :** ✅ fait

**Bloqué par :** 01.

## Ce qu'il faut obtenir

Les profils déjà enregistrés ont six rapports : ceux du stockage local du
téléphone, ceux déposés sur le NAS, et ceux partagés par URL. Ils doivent
continuer de s'ouvrir.

C'est le cinquième point de la checklist de `CLAUDE.md` : le format de profil
change de forme, donc `PROFILE_FORMAT_VERSION` monte et la reprise s'écrit dans
`core/preset/store.ts`.

**Ce que fait la reprise, et ce qu'elle ne fait pas.** Seule **la boîte de route
livrée** est reprise — son étagement d'origine *et* son pont de 3,7. Elle reçoit
alors le nouvel étagement complet, et les tableaux qui se comptent par rapport
s'allongent d'une valeur prolongeant la dernière.

Tout le reste est laissé tel quel :

- une boîte réglée à la main garde ce qu'on lui a donné — lui ajouter un rapport
  que personne n'a demandé serait décider à sa place, et l'écran de
  configuration sait déjà changer ce nombre ;
- une boîte de route dont on a changé le pont a été retouchée : même raison ;
- **la boîte de sport garde ses six rapports.** Les deux boîtes livrées
  portaient le même étagement, et seul le pont les séparait — sans cette
  condition, une sportive aurait reçu des rapports longs.

Trois chemins mènent à un profil, et les trois passent par la reprise : le
stockage local, le registre des boîtes — c'est là que vit celle de David —, et
un lien de partage. Un lien ancien à qui il manquerait d'autres champs récents
reste rendu tel quel, comme il l'a toujours été : ce n'est pas ce lot qui
réparera le partage.

## Critères d'acceptation

- [x] Un profil enregistré à six rapports s'ouvre et sonne, sans rien perdre.
- [x] Un test part d'un profil au format précédent et vérifie les sept rapports
      obtenus, ainsi que la longueur des tableaux qui les suivent.
- [x] Un profil partagé par URL, écrit avant ce lot, s'ouvre encore.
- [x] `PROFILE_FORMAT_VERSION` monte d'un cran.
- [x] Contrôle qualité vert.

Critères établis le 12 septembre 2026, en relisant le code et les tests : la
reprise s'applique aux trois chemins d'entrée d'une boîte — le stockage local,
un profil reçu par lien, une boîte enregistrée — et sept tests la couvrent, dont
quatre qui vérifient qu'une boîte réglée à la main n'est pas touchée. La version
du format de profil est montée par le commit du lot. Seul le mot « sonne » du
premier critère relève de l'écoute, et il est couvert par la vérification en
roulant du ticket 01.
