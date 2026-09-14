# 04 — L'étagement suit-il le moteur, ou la voiture ?

**Statut :** ⬜ prêt — question de conception posée, réponse à instruire

**Bloqué par :** aucun

## Ce qui a déclenché

David, le 14 septembre 2026, en livrant les trois banques générées :

> il faudra aussi réviser l'étagement des boîtes ; tu penses que ça fait du sens
> d'avoir le même étagement pour tous les moteurs ? ma question c'est : est-ce
> que l'étagement correspond à un moteur, ou à une (vraie) voiture ?

La question vient de ce que les trois profils livrés portent **le même
calibrage de transmission** — celui du profil Route — pour un V8 5,7 L et un
quatre cylindres à plat.

## Ce que le modèle dit déjà

Le dépôt a tranché, et en **trois** entités plutôt que deux :

| Entité | Ce qu'elle porte | Fichier |
|---|---|---|
| `EngineEntity` | banque, couches, mixage, pétarades | `core/preset/engine-entity.ts` |
| `GearboxEntity` | rapports, pont, rayon de roue, temps de passage, rétrogradage forcé, clac | `core/preset/gearbox-entity.ts` |
| `RealCar` | les six réglages du signal de vitesse — le récepteur GPS et la façon de bouger | `core/preset/real-car.ts` |

L'étagement n'appartient donc ni au moteur ni à la vraie voiture : c'est la boîte,
déjà une entité nommée et partageable. `RealCar` porte la note qui vient de
David : « on ne choisit pas sa vraie voiture comme on choisit un V8, c'est celle
qu'on a ».

## De quoi dépend son contenu, mesuré

**Ce qui l'attache à la vraie voiture, ce sont les vitesses qu'on pratique.**
L'étagement livré a été conçu pour ça — c'est l'objet de ce lot — et la mesure le
confirme, sur les 7 rapports `3,55 · 2,04 · 1,36 · 1,00 · 0,73 · 0,53 · 0,39`,
pont 3,7, roue 0,33 m :

| | 30 | 50 | 80 | 110 | 130 km/h |
|---|---|---|---|---|---|
| rapport tenu | 2e | 4e | 5e | 6e | 7e |
| régime | 1 820 | 1 487 | 1 737 | 1 734 | 1 508 tr/min |

Aucun moteur n'entre dans ce tableau.

**Ce qui l'attache au moteur, c'est la plage de régime utile.** Et le code le
sait déjà : `finalDriveFor()` dérive le pont d'une vitesse cible au rupteur. Le
pont est donc **déjà** une fonction du moteur, à ceci près que personne ne
l'applique quand on change de moteur.

**L'étagement est la charnière entre les deux.**

## Pourquoi ça ne se voit pas encore

Les trois moteurs livrés ont des rupteurs voisins — 6 500, 6 500 et 6 300, soit
3 % d'écart. Le défaut éclate sur les six autres moteurs de la bibliothèque :

| Moteur | Rupteur | À 110 km/h en 6e |
|---|---|---|
| Chevrolet 454 | 5 500 | 32 % du rupteur |
| GM LS | 6 500 | 27 % |
| Honda B18C5 | 8 400 | 21 % |
| Suzuki Hayabusa | 11 000 | **16 %** |

Une Hayabusa qui tient 110 km/h à seize pour cent de son rupteur ne chante
jamais — et c'est tout ce qu'on lui demande.

## La piste, à instruire

**Une seule boîte, dont les vitesses cibles appartiennent à la vraie voiture, et
dont le pont se dérive du rupteur du moteur choisi.** Plutôt que neuf boîtes à
régler à la main, on garde le seul réglage qui compte — à quel régime on est aux
vitesses où l'on roule — et la moitié du mécanisme existe déjà.

Ce qu'il faut trancher avant de coder :

1. **Le pont seul suffit-il**, ou faut-il aussi resserrer les rapports ? Un pont
   qui double ne fait pas d'un sept-rapports de route une boîte de moto.
2. **Que devient une boîte réglée à la main** si le pont se dérive tout seul ? Il
   faut pouvoir s'écarter de la règle, comme partout ailleurs dans ce projet.
3. **La vitesse cible au rupteur en dernier rapport** est-elle une valeur de la
   vraie voiture (« ma Tesla ne dépasse pas 150 ») ou un goût ?

## Ce qui n'est pas vérifié

- **Rien n'a été écouté.** Les chiffres ci-dessus sont de l'arithmétique de
  transmission, pas un jugement : c'est en roulant qu'on sait si un étagement
  tombe juste.
