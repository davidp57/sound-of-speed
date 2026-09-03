# MODE-SIMPLE — quelques curseurs qui commandent les quarante-huit autres

**Statut :** ⬜ prêt
**Branche :** `feature/mode-simple`
**Version visée :** 0.3

## Le problème

Relevé à l'usage : « les paramètres sont très (trop) nombreux ; il faudrait un
mode simplifié qui reprenne des curseurs globaux qui *drivent* les paramètres
actuels, lesquels seraient cachés derrière un mode avancé ».

Le compte est exact, et il est pire que « trop » : **quarante-huit curseurs** à
l'écran de configuration, pour quarante-trois champs numériques dans un profil —
sans compter le caractère et les couches. Les lots récents en ont ajouté six à
eux seuls, trois pour la boîte et trois pour le relief. C'est une colonne qu'on
parcourt sans savoir lequel bougera ce qu'on entend.

Or **le guide de création sait déjà faire l'inverse** : de quatre réponses —
tempérament, terrain, nombre de rapports, type de moteur — il déduit l'ensemble,
et il le fait bien. Ce savoir ne sert qu'une fois, à la création, puis
disparaît : ensuite on est seul avec les quarante-huit curseurs.

## La solution

Rendre au mode simplifié le savoir du guide, en continu. Deux ou trois curseurs
globaux qui recalculent les réglages détaillés à chaque mouvement, et le détail
derrière un mode avancé.

Ceux que David nomme :

- **calme ↔ sportif** — la `sportiness` du guide, qui pilote déjà onze valeurs :
  inertie, montée à vide, temps de passage, écart de charge, seuils de passage,
  plancher de croisière, délai de croisière, seuil de freinage, rétrogradage
  forcé, pétarade, à-coup ;
- **nerveux ↔ pépère** — à distinguer du précédent. Le premier est le caractère
  du **moteur et de la boîte**, celui-ci serait plutôt la **réactivité du
  signal** : raideur du lissage, fenêtre d'accélération, lissage de la charge,
  temporisations. C'est la différence entre une voiture qui pousse fort et une
  voiture qui répond vite, et elle est réelle ;
- **le nombre de rapports.**

## Une correction factuelle

David le croit impossible à changer après création. **Il l'est.** Le champ
« Démultiplications » accepte la liste séparée par des virgules et la réécrit
entièrement : ajouter ou retirer un rapport tient à une saisie.

Mais c'est **bancal**, et c'est la vraie remarque : les tables qui dépendent du
nombre de rapports ne suivent pas. Les régimes de passage et les temporisations
gardent leur longueur, et le code se rabat sur le dernier seuil connu
(`table[gear] ?? table[table.length - 1]`) et sur une temporisation par défaut
de 0,8 s. Un rapport ajouté hérite donc du seuil de son prédécesseur et d'une
temporisation qui n'a rien à voir avec le profil.

Le ticket n'est donc pas « rendre possible » mais « redimensionner les tables
avec le nombre de rapports », ce que le guide sait faire — il les calcule depuis
le tempérament.

## La question qui décide de la forme

**Un curseur global écrase-t-il un réglage trouvé à la main ?**

Il ne peut pas faire autrement : il recalcule. Trois réponses possibles, et elles
donnent trois produits différents.

1. **Oui, franchement.** Bouger un curseur global refait le profil. Simple à
   comprendre, brutal à l'usage : une heure de réglage fin part au premier
   mouvement.
2. **Oui, mais réversible.** Le lot [ORIGINE](../ORIGINE/spec.md) a doté chaque
   profil d'un état de retour ; on peut en faire un second, pris juste avant le
   mouvement du curseur global.
3. **Non : le global devient un décalage.** Les curseurs globaux appliquent un
   écart relatif aux valeurs détaillées plutôt que de les remplacer. Le réglage
   fin survit, mais la notion de « calme » n'a alors plus de sens absolu, et
   deux profils au même curseur ne sonnent pas pareil.

À trancher avant d'écrire une ligne : c'est le choix dont tout le reste découle.

## Hors périmètre

- Réduire le nombre de réglages détaillés. Les quarante-huit restent, derrière
  le mode avancé : chacun a été ajouté pour une raison mesurée, et le lot n'en supprime
  aucun.
- Le volume général, qui sort du profil par le lot
  [VOLUME-GLOBAL](../VOLUME-GLOBAL/spec.md) : ce n'est pas un caractère, c'est
  une préférence d'appareil.
- Le défilement de l'écran, traité par [UI-DEFILEMENT](../UI-DEFILEMENT/spec.md).
  Le mode simplifié raccourcira la colonne, il ne réglera pas le glissement qui
  dérègle.
