# Relevé — des banques de son libres pour l'image publique

**Statut :** ✅ fait le 12 septembre 2026
**Pour :** [PLATEFORME](spec.md), décision « une banque de démonstration dans l'image »

## La question

David, le 12 septembre 2026 :

> ça serait pas plus simple de chercher des banques de son libres de droit (ou
> pas chères) sur internet ? au moins pour notre première release

Elle se pose parce que la banque `procar` vient de l'application dribe.app :
elle est jouable ici, elle ne peut pas partir dans un dépôt public.

**Ce qu'elle fait ici, et jusqu'à quand.** Elle sert à faire tourner
l'application pendant la mise au point, sur le poste de développement et sur le
serveur d'essai. Elle n'est ni livrée avec l'application, ni servie à des tiers,
et aucun échantillon n'est jamais entré dans le dépôt. Elle est destinée à
disparaître au profit des moteurs produits par la synthèse, qui sont à nous :
c'est l'objet du lot SYNTHESE, et c'est la raison pour laquelle ce relevé
cherchait une alternative sous licence.

## Les deux critères, et pourquoi le second élimine presque tout

**Redistribuable, pas « libre de droit ».** *Royalty-free* veut dire « pas de
redevance par usage » et interdit presque toujours de rediffuser le fichier tel
quel — or mettre un WAV dans un dépôt public et dans une image, c'est le
rediffuser. Ce qu'il faut, c'est CC0, CC BY, CC BY-SA ou GPL.

**Au format d'une banque, pas d'un bruitage.** Il faut, par plage de régime, une
prise **à régime tenu**, en charge **et** pied levé, qui boucle. Les
bibliothèques de bruitage vendent des passages — démarrages, accélérations,
décélérations — dont le régime bouge et qui ne bouclent pas.

Le projet sait ce que coûte le mauvais format : `procar` n'a que deux prises par
famille, d'où une vitesse de lecture de 0,26 à 0,81 et 15,8 demi-tons d'erreur
de timbre. C'est ce défaut que les prises par demi-octave corrigent.

## Ce qui a été regardé

| Source | Licence | Format | Verdict |
|---|---|---|---|
| [VDrift](https://github.com/VDrift/vdrift) | code GPL-3.0 ; **données au statut douteux** | **exactement le nôtre** | écarté |
| [Stunt Rally 3](https://github.com/stuntrally/stuntrally3) | GPL-3.0, données non documentées | hérité de VDrift | écarté |
| [Speed Dreams](https://sourceforge.net/p/speed-dreams/) | GPL-2+ et **Free Art License** | une prise transposée | écarté |
| [OpenGameArt — Generic V8](https://opengameart.org/content/generic-v8-engine-sound) | CC BY-SA 4.0 | **deux** boucles, charge et pied levé | sans gain |
| [Freesound CC0](https://freesound.org/) | CC0 | boucles isolées | sans gain |

**VDrift décrit notre schéma terme à terme** — `NaturalRPM` est notre ancrage,
`MinimumRPM`/`MaximumRPM` notre domaine jouable, `power on`/`off` nos deux
familles. C'est la seule chose trouvée qui soit déjà une banque au bon format.
Mais ses données ont été **retirées du dépôt Debian** : des pistes portent des
mentions de droits EA et Sony, et plusieurs modèles n'ont pas d'auteur connu.
Une banque dont on ne peut pas nommer l'auteur ne se met pas dans un dépôt
public — c'est exactement le problème qu'on cherche à quitter avec `procar`.

**La Free Art License est déclarée incompatible avec la GPL** par la FSF, ce qui
écarte la part des données Speed Dreams qu'elle couvre. CC BY-SA 4.0, elle, est
utilisable : Creative Commons a déclaré sa compatibilité vers la GPLv3.

**Le V8 d'OpenGameArt est propre et inutile** : deux boucles, une en charge une
pied levé. C'est le format de `procar`, donc ses 15,8 demi-tons d'erreur. On ne
gagnerait qu'un moteur de plus, pas une meilleure banque.

## Conclusion

**Aucune source ne coche les deux cases.** Ce qui est au bon format n'a pas de
droits clairs ; ce qui a des droits clairs n'est pas au bon format. Le mur n'est
pas la licence, c'est qu'une banque par plage de régime avec deux familles se
fabrique au banc, et que personne ne publie ça gratuitement.

Restent trois voies pour l'image publique :

1. **engine-sim**, qui ne pose aucune question de droits et qui vient de gagner
   son échappement capté. C'est la décision déjà écrite dans la spec, et le
   relevé ne trouve rien pour la remplacer.
2. **Une prise à nous**, au banc ou sur une voiture prêtée, publiée sous la
   licence du projet. C'est le seul moyen d'avoir à la fois le format et les
   droits, et ça demande une voiture qui fait du bruit.
3. **CC BY-SA 4.0 en complément**, pour ajouter un moteur de caractère
   différent — pas pour porter la démonstration.

Ce relevé n'est pas un avis juridique. Sur la nuance entre agrégation et œuvre
combinée — un fichier audio distribué **à côté** d'une application n'est pas
forcément une œuvre dérivée — il faudrait un avis qualifié avant de s'appuyer
dessus.
