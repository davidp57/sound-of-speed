# BANQUES — plusieurs banques de son, sans y passer la soirée

**Statut :** 🧑 attend David — les quatre premiers tickets sont livrés, reste l'essai hors réseau ; deux s'y sont ajoutés le 17 septembre 2026 : ce que l'écran dit d'une banque absente, et le fait que deux banques ne sonnent pas au même niveau
**Branche :** `feature/banques`
**Version visée :** 0.3

## Le problème

Une banque de son, c'est cinq fichiers et une poignée de nombres : le régime
d'ancrage de chaque prise, son gain, ses bornes de lecture. L'application sait
déjà en jouer plusieurs — chaque profil porte un `sampleDir`, et le moteur
charge `/audio/{sampleDir}/{fichier}` — mais **rien n'aide à en ajouter une**.

Aujourd'hui, pour exploiter une banque nouvelle, il faut : la déposer sur le
NAS, créer un profil, taper le nom du dossier à la main sans savoir s'il existe,
déclarer cinq couches une par une, lancer l'analyse sur chacune pour trouver son
ancrage, puis **régler les gains à l'oreille** faute de savoir de combien chaque
prise est plus faible que les autres.

Ce dernier point est celui qui coûte le plus. Le lot RELIEF a établi que la
compensation doit vivre dans le gain de chaque couche, au déficit près : mesuré
sur `procar`, 9,6 dB pour la prise « pied levé » basse et 6,5 dB pour la haute.
Ces deux nombres ont été relevés à la main avec ffmpeg. Toute banque nouvelle
demande le même relevé, et personne ne le fera à l'oreille correctement.

## La solution

Trois choses, dont une seule est du confort d'écran :

- **découvrir** les banques présentes, au lieu de taper un nom de dossier en
  aveugle. `library.ts` obtient déjà la liste des profils déposés sur le NAS
  par le listage JSON que nginx sait produire — et il **écarte** les dossiers.
  Il suffit de faire l'inverse sur `/audio/` : aucun service à ajouter, aucune
  base, la même protection que le reste du site ;
- **mesurer** une banque par un script, plutôt qu'à l'oreille : ancrages
  proposés et déficits de niveau, donc les gains à écrire. C'est le travail
  qu'on vient de faire à la main, et qu'il faudra refaire à chaque banque ;
- **choisir** la banque d'un profil dans une liste.

Le format de profil ne bouge pas : `sampleDir` existe depuis le début.

## Histoires

1. En tant qu'utilisateur, je veux voir les banques présentes sur le NAS et en
   choisir une, sans deviner le nom d'un dossier.
2. En tant qu'utilisateur, je veux savoir si la banque choisie a bien les
   fichiers que mon profil déclare, avant d'activer le son et d'entendre un
   silence.
3. En tant que David, je veux qu'un script me donne les ancrages et les gains
   d'une banque nouvelle, parce que les régler à l'oreille prend une soirée et
   se trompe.
4. En tant qu'utilisateur hors réseau, je veux que la banque du profil actif
   soit mise en cache quand j'en change, sans avoir à y penser.

## Décisions d'implémentation

- **Rien de neuf côté serveur.** Le listage JSON de nginx suffit, comme pour la
  bibliothèque de profils. Une banque est donc un simple dossier déposé avec le
  gestionnaire de fichiers du NAS — c'est ce qui rend l'affaire tenable sans
  base ni service.
- **Le script mesure, il ne décide pas.** Il imprime les ancrages candidats et
  les gains proposés ; c'est un humain qui les recopie dans le profil, à
  l'oreille s'il n'est pas d'accord. L'analyse rend d'ailleurs plusieurs
  candidats classés, l'ambiguïté d'octave n'étant pas tranchable par un
  critère spectral — le script ne prétendra pas le contraire.
- **Les gains sont relatifs à la prise la plus forte de la banque**, pas à une
  valeur absolue : c'est l'écart entre les couches qui compte, le niveau
  d'ensemble étant réglé par le volume général et le relief.
- **Aucun échantillon dans le dépôt.** `public/audio/` n'est pas versionné et ne
  le sera pas : les banques vivent dans un volume du NAS. Le script travaille
  donc sur un dossier local passé en argument.

## Décisions de test

Ce qui se teste sans navigateur : la lecture du listage — dossiers retenus,
fichiers écartés, dossier absent, réponse illisible — exactement comme
`library.ts` est testable. Le script, lui, est de l'outillage : il se vérifie en
le lançant sur la banque présente et en comparant à ce qu'on sait d'elle.

Ce qui ne se teste pas : qu'une banque sonne bien. C'est l'objet du script, pas
d'une assertion.

## Hors périmètre

- **Se procurer des banques.** Ce lot outille l'accueil d'une banque, il n'en
  fournit aucune. Les prises de moteur sont des œuvres : elles s'enregistrent,
  ou s'obtiennent sous licence.
- Le nombre de couches par banque : cinq aujourd'hui parce que la banque livrée
  en a cinq. Une banque à six ou sept couches fonctionne déjà — le mixage fond
  entre voisines dès qu'il y en a plus de deux — mais ce lot ne l'explore pas.
- Une couche de ralenti, qui manque à la banque livrée. Le jour où une banque en
  apporte une, le rôle `idle` est déjà géré et testé.

## Notes

Le lot naît d'une conversation sur les banques d'une application concurrente,
qui en compte cinq là où Speed en a une. La leçon technique en est retenue —
plusieurs banques, choisies par profil — pas le contenu.
