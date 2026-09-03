# 02 — L'effort du moteur tient compte de la vitesse

**Statut :** ⬜ prêt

**Bloqué par :** 01 — Remesurer, et dire si le lot vaut encore

## Ce qu'il faut obtenir

Tenir 130 km/h s'entend comme un effort, tenir 50 km/h s'entend comme une
promenade. Aujourd'hui les deux donnent exactement le même son, parce que la
charge se déduit de la seule accélération : tenir une vitesse vaut toujours la
moitié de l'échelle, quelle que soit la vitesse tenue.

Une seconde grandeur apparaît donc, l'**effort** : ce que le moteur fournit
réellement, soit l'accélération **plus** la traînée à vaincre, laquelle croît
comme le carré de la vitesse.

**La séparation est le point du ticket.** L'effort ne sert qu'au son — le fondu
entre les familles « en charge » et « pied levé », et le relief de charge. La
**charge** continue de piloter la boîte : les seuils de passage, le rétrogradage
appuyé, le rétrogradage forcé. Ce sont deux questions différentes, confondues
jusqu'ici : la boîte veut connaître l'intention du conducteur, le son veut
connaître le travail du moteur.

C'est ce découpage qui rend le ticket sans risque pour la boîte, et le test qui
l'affirme est le garde-fou du lot.

Un réglage nouveau, et un seul : la vitesse à laquelle tenir l'allure consomme la
moitié de la charge disponible. Ce n'est pas un réglage de physique mais un
curseur de contraste, à régler à l'oreille.

Deux effets à assumer, tous deux mesurés d'avance : le niveau au ralenti descend
et doit être recalé, et le pied levé s'entendra franchement plus comme un pied
levé — un gain, mais un changement de caractère.

## Critères d'acceptation

- [ ] À accélération nulle, l'effort croît avec la vitesse
- [ ] À l'arrêt, l'effort est nul
- [ ] Le niveau au ralenti est celui d'avant le ticket, après recalage
- [ ] Une reprise douce à 130 km/h s'entend au moins 3 dB au-dessus de la
      croisière à la même vitesse
- [ ] Le pied levé reste au moins 5 dB sous une reprise douce
- [ ] **Les passages de rapports se produisent aux mêmes vitesses qu'avant le
      ticket**
- [ ] Le guide de création donne une valeur cohérente avec le caractère choisi
- [ ] Le réglage est dans la référence des réglages du README
- [ ] 🧑 Vérifié en roulant : tenir 50 et tenir 130 ne sonnent plus pareil
