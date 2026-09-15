# 08 — L'archive du compte, et ce qu'elle rend

**Statut :** ✅ fait

**Bloqué par :** 06 — Prouver l'isolation entre comptes, route par route

## Ce qu'il faut obtenir

L'archive d'un compte n'exige aucun rôle, délibérément : ce sont ses données, et
les retenir parce qu'un droit s'est refermé reviendrait à les confisquer. Il faut
donc que ce qu'elle rend soit exactement le compte qui la demande, et rien
d'autre — c'est la seule chose qui la protège.

Elle assemble par ailleurs des noms venus de l'extérieur : ceux sous lesquels les
dépôts sont montés. Un nom de travers ne doit pas fabriquer une entrée qui sorte
de son dossier chez celui qui ouvre l'archive.

## Critères d'acceptation

- [x] L'archive d'un compte ne contient rien d'un autre, sur une base qui en
      porte deux, tous deux garnis.
- [x] Un dépôt au nom de travers ne produit pas d'entrée qui sorte de son dossier
      à l'extraction.
- [x] Un compte vide rend une archive valable, et non une panne.
- [x] L'archive d'un trajet suit les mêmes règles que celle du compte.

## Le défaut trouvé : un nom déposé pouvait composer un chemin

**Mesuré avant d'être corrigé.** Déposer sous `..%2F..%2Fdehors.txt` était
accepté — code 201 —, listé tel quel, et l'archive du compte portait l'entrée
`traces/../../dehors.txt`. Un extracteur ordinaire écrit cette entrée **hors du
dossier** qu'on lui a désigné.

Ce que ça vaut, sans le grossir : le nom ne touche aucun disque sur le serveur,
il ne fait qu'aller en base. Il en touche un chez celui qui ouvre l'archive, sur
son poste de travail. Et seul le titulaire du compte peut déposer — le chemin
réaliste est donc un appareil relié qu'on ne contrôle plus, qui plante un nom que
le propriétaire déclenchera en extrayant. Étroit, mais réel, et sans contrepartie
à le fermer : aucun nom légitime ne porte de barre. La voiture dépose des noms
plats, la reprise verse ce qu'elle lit dans un dossier.

**Corrigé aux deux bouts.** À l'entrée, les trois familles de routes — profils,
registres, dépôts — refusent un nom qui n'est pas un nom. Dans l'archive, une
seconde barrière écarte l'entrée sans écarter l'archive : la base peut porter un
nom entré avant ce contrôle, ou versé par la reprise d'un ancien dossier.

## Ce qui a été vérifié

- Quatre formes de noms de travers refusées sur les trois familles de routes.
- L'archive d'un compte garni ne porte plus aucune remontée, et le reste de son
  contenu est intact.
- Le jeu de requêtes d'accord porte le cas : 58 cas au vert contre un serveur qui
  tourne.
- La cible du premier critère était déjà couverte par le test de l'archive, et
  l'est deux fois depuis le banc à deux comptes du ticket 06.
