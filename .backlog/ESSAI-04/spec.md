# ESSAI-04 — six défauts relevés en roulant le 4 septembre

**Statut :** ✅ fait — huit tickets sur huit
**Branche :** `fix/essai-04`
**Version visée :** 0.2 — avant tout le reste

## Ce qui a déclenché

Un essai sur route le 4 septembre 2026, sur l'image `develop` déployée le matin
même. Trois symptômes rapportés, un quatrième découvert en les cherchant :

- le son est sourd, trop fort au ralenti et en croisière, pas assez en haut
  régime ;
- sous 20 à 30 km/h, le régime reste à 800 tr/min alors que la vitesse
  s'affiche correctement ;
- l'application cesse de réagir au GPS après cinq à dix minutes, ou en montant
  sur l'autoroute — deux fois, vers 70 km/h. La vitesse, le régime et le son
  restent figés, que l'on accélère ou que l'on ralentisse. Le simulateur
  fonctionne encore ; repasser au GPS rebloque aussitôt ;
- l'écran d'étalonnage s'est retrouvé inutilisable, chaque étape affichant
  « un autre enregistrement est en cours » sans qu'aucun bouton ne permette de
  l'arrêter ;
- en plein écran, la croix de sortie se confond avec le bouton de profil le plus
  à droite ;
- le décor qui défile derrière les cadrans défile de côté, comme un jeu de
  plateforme, alors que l'écran se voit de la place du conducteur.

## Ce qu'on a mesuré

Les quatre causes ont été cherchées au banc, hors navigateur, en reproduisant
l'assemblage complet de la chaîne sur des trajets écrits à la main, à la
cadence réelle du GPS de la voiture et avec un bruit de mesure de ±1 km/h.

**La source GPS se tait pour de bon.** Quand le navigateur ne renseigne pas la
vitesse, elle est déduite de deux positions ; un écart de moins de 150 ms est
refusé, mais la position de référence est **remplacée quand même**. L'écart ne
peut donc jamais s'accumuler. Mesuré sur une minute à 110 km/h : zéro vitesse
produite à 30 ms de cadence, zéro à 100 ms, 400 à 150 ms. Le chien de garde
relance le suivi toutes les cinq secondes sans rien changer, la cadence restant
rapide.

**L'accélération transmise n'est pas celle qu'on croit.** La première piste — le
curseur de réactivité, qui abaisse la fenêtre d'accélération à 400 ms — a été
**écartée par la mesure** : balayée de 200 à 2000 ms, la fenêtre ne changeait
presque rien, l'écart-type restant entre 0,82 et 0,93 m/s². La raison est que
l'accélération donnée à la charge et à la boîte était la dérivée du ressort de
lissage, et non la pente estimée sur cette fenêtre — le ressort porte tout le
bruit du GPS. Mesuré sur une vitesse parfaitement tenue : 0,83 m/s² d'écart-type
pour le ressort, 0,10 pour la pente, et 1,96 contre 2,00 sur une reprise établie
à 2 m/s².

S'y ajoutait un second défaut, dans la boîte : la croisière se jugeait sur
l'accélération instantanée, dont le bruit résiduel est du même ordre que la
borne basse de sa bande. Le critère se décidait donc au tirage au sort, la
descente au régime restait suspendue en ralentissant, et sous 26 km/h en
quatrième le régime se plaquait au ralenti.

**Le relief franchit la chaîne de sortie**, contrairement à ce que ce paragraphe
annonçait. L'estimation analytique — 3,9 dB en entrée, 0,3 dB conservés —
supposait un limiteur qui écrase en permanence. Mesuré sur le graphe réel, il
n'atténue jamais plus de 0,2 dB, et la chaîne entière coûte 0,09 dB sur 6,58. Ce
qu'elle abîme est un écrêtage en sortie, dû au gain de rattrapage placé après le
limiteur, et cet écrêtage ne s'entend pas : comparé au même niveau, « quasiment
aucune différence » (ticket 04).

**Le son est joué sous sa hauteur.** La prise bas régime est ancrée à
3128 tr/min, la haute à 8150, et le profil Route fait vivre le moteur entre 800
et 2800 tr/min. Mesuré : la vitesse de lecture reste entre 0,26 et 0,81 sur
toute la conduite ordinaire, et la couche haut régime ne sort jamais.

## Périmètre

Huit tickets. Six sont faits, un attend le jugement à l'oreille, un — le relief
en sortie — attend que la mesure soit reprise.

Le huitième est né de l'essai du soir, avec le lot déjà livré : **le blocage de
la vitesse avait une seconde cause**, l'étalonnage. Le ticket 02 avait bien
corrigé la source, mais une étape de ville enregistrée dans un bouchon plafonne
la vitesse acceptée à 40 km/h, et tout est rejeté au-delà. L'étalonnage ne
s'applique donc plus qu'entier (ticket 08).

Ce que le lot a livré : l'accélération vient de la pente estimée, la croisière
se juge sur la dérive de la vitesse (aucun passage parasite mesuré, contre
quarante-six avant), la source GPS ne se tait plus quelle que soit la cadence,
son diagnostic remonte à l'écran, un enregistrement d'étalonnage s'arrête
toujours, on quitte le plein écran par une flèche qui ne recouvre rien, et le
décor faux est retiré en attendant d'être redessiné.

Hors périmètre : les 16 passages de rapport parasites par minute relevés à
réglage d'usine. Ils sont réels, mais **antérieurs** à cette mise à jour — la
comparaison avant/après le lot PENTE donne des chiffres identiques à cadence
rapide. Ils relèvent d'un lot à part, sur la stabilité de la boîte face au
bruit de mesure.

Hors périmètre également : le trou entre 5 et 13,2 km/h au démarrage, où la
première est larguée à 5 km/h sans retour possible alors que la seconde
n'atteint le ralenti qu'à 13,2. Reproduit au banc, mais datant du 29 août et
écarté par David comme n'étant pas le symptôme qu'il a entendu.
