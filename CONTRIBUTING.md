# Contribuer à Sound of Speed

Les corrections et les idées sont bienvenues. Ce fichier dit le strict
nécessaire pour qu'une proposition soit recevable ; le reste est dans
[`CLAUDE.md`](CLAUDE.md), qui est la source de vérité du process et vaut pour
tout le monde, humains compris.

## Avant d'écrire du code

**Ouvrez une issue d'abord** si le changement touche à la conception, ajoute une
dépendance, ou change un comportement décrit dans le [README](README.md). Une
correction évidente ou une faute de frappe n'en a pas besoin.

Le projet a des choix arrêtés qui surprennent si on ne les connaît pas :

- **Aucune bibliothèque d'interface, aucun gestionnaire d'état.** `src/state.ts`
  est l'état, en `ref` Vue. Une dépendance pèse sur une application qui doit se
  charger hors réseau, sur un téléphone, en voiture.
- **Aucune animation.** Les valeurs changent, rien ne bouge pour le plaisir :
  l'écran se lit en conduisant. Une aiguille de cadran ne relève pas de cette
  règle — son mouvement *est* la valeur.
- **Trois zones qui ne se mélangent pas.** `src/core/` est le calcul, partagé
  entre le navigateur et le serveur ; `src/ui/` est l'affichage ; `src/server/`
  est ce qui tourne sur la machine qui sert. Le cœur n'importe ni Vue ni un
  écran, l'interface n'importe pas le serveur, le serveur n'importe pas d'écran.
  `npm run lint` le refuse, et vous dira pourquoi.
- **Un correctif de son ou de signal se justifie par une mesure**, pas par un
  raisonnement. Un niveau, un écart, un saut d'énergie. « Ça sonne mieux » n'est
  pas un argument recevable tout seul — mais « je l'entends » est un point de
  départ tout à fait valable pour aller mesurer.

## Les règles de langue

Le dépôt est bilingue, et la frontière est nette :

| | |
|---|---|
| Identifiants du code — types, variables, fichiers, branches | **anglais** |
| Commentaires, docstrings, documentation, README, CHANGELOG | **français** |
| Textes affichés à l'écran | français, en clair dans les composants |
| Messages de commit | Conventional Commits, description en français |

Il n'y a pas d'internationalisation et il n'en faut pas.

Sur le registre : des phrases courtes, des mots courants, pas de superlatif ni
d'emoji. Un commentaire dit **pourquoi**, pas quoi — le quoi se lit dans le
code. Ce qui n'est pas vérifié est annoncé comme tel.

## Le contrôle qualité

Quatre commandes, et c'est exactement ce que fait l'intégration continue :

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Les quatre doivent passer avant d'ouvrir une pull request. Si votre changement
touche `src/core/`, il vient avec ses tests — et pour un comportement, le test
s'écrit avant le code.

## Les branches

```
main                 production
develop              intégration, toujours déployable
feature/<slug>       nouveauté, depuis develop
fix/<slug>           correction, depuis develop
```

Les pull requests visent **`develop`**, jamais `main`. Un commit dont le diff ne
touche que du Markdown n'a besoin ni de branche ni de PR.

## Le son, et ce qu'il faut pour l'entendre

Le dépôt contient **une** banque d'échantillons : celle de démonstration, dans
[`public/audio/demo/`](public/audio/demo/LISEZMOI.md). C'est un moteur simulé,
et c'est volontaire — une prise sur une vraie voiture appartient à qui l'a
faite, et le projet ne redistribue que ce qu'il a le droit de redistribuer.

Pour travailler sur le son, vous pouvez produire vos propres banques avec
[`scripts/generate-bank/`](scripts/generate-bank/README.md), qui fait tourner
engine-sim au banc, ou déposer vos propres enregistrements. N'ajoutez **jamais**
au dépôt un échantillon dont vous ne pouvez pas nommer l'auteur et la licence.

## La licence

En proposant une contribution, vous acceptez qu'elle soit distribuée sous
l'AGPL-3.0, comme le reste du projet. Voir [`LICENSE`](LICENSE).
