# 06 — Les traces, le journal et les relevés vivent en base

**Statut :** ✅ fait le 12 septembre 2026

**Bloqué par :** 05 — Les profils vivent en base.

## Ce qu'il faut obtenir

Ce qui remonte de la voiture est écrit en base : les traces, les tranches de
journal, les relevés de mesure. Le relecteur les relit de là, et la voiture
continue de déposer exactement comme avant.

C'est le gros du trafic, et c'est là que le modèle de fichiers montrait ses
limites : quand le journal s'est mis à déposer une tranche toutes les cinq
minutes, la parade a été de créer un dossier séparé pour ne pas alourdir le
listage des traces. Ce contournement disparaît de lui-même.

## Ce à quoi il faut faire attention

- **Les tranches arrivent compressées**, et le client décide de décompresser
  **au nom du fichier**, pas au type déclaré par le serveur. Le nom doit donc
  être rendu tel qu'il a été déposé.
- **La charge refusée ne se rejoue pas.** Une tranche trop grosse doit être
  refusée avec le code qui le dit, sinon la voiture réessaie indéfiniment.
- **Une page autonome dépose aussi** — la sonde — avec son propre compte relu
  dans le stockage du navigateur. Elle n'est pas dans l'application et personne
  ne la verra casser.
- **Sept cent vingt-six dépôts manqués à l'arrêt** sont un problème ouvert d'un
  autre lot. Ce ticket ne le corrige pas, mais il ne doit pas l'aggraver : ce qui
  part aujourd'hui doit continuer de partir.

## Critères d'acceptation

- [x] Déposer une trace, une tranche de journal, un relevé écrit en base
- [x] Une session déposée se relit tranche par tranche, à l'octet près.
      **Reste à voir** : le relecteur lui-même, pointé sur ce serveur — il
      demande un navigateur, et viendra avec le déploiement
- [x] Une tranche compressée redescend sous le nom qui dit qu'elle l'est
- [x] Une charge trop grosse est refusée avec le code qui interdit de rejouer
- [x] La sonde dépose toujours, avec le compte qu'elle relit elle-même
- [x] La part « dépôts » du test d'accord passe contre le nouveau serveur
- [x] Une session déjà déposée n'est pas dupliquée si elle repart

## Ce que ce ticket a corrigé dans le schéma du ticket 03

**Les dépôts étaient déclarés en texte.** Ils arrivent compressés : les ranger
dans une colonne de texte les aurait fait passer par un décodage qui n'a pas de
sens pour eux, et ce qui serait redescendu n'aurait plus été ce qui était monté —
sans que rien ne le signale, jusqu'à ce que le relecteur ne sache plus rien lire.

Corrigé par migration, la seconde depuis le schéma initial. Le défaut n'était
visible que le jour où l'on dépose vraiment quelque chose de compressé, et c'est
ce jour-là.

## La mesure qui compte

Une tranche gzip déposée puis relue redescend **à l'octet près**, et se
décompresse en ce qui a été écrit. Vérifié contre un serveur réel avant d'écrire
le test, puis figé par lui.

## Où en est le serveur neuf

**Vingt-sept cas sur vingt-sept.** Le contrat entier passe, comme contre le
serveur en service : les deux sont désormais indiscernables. L'intégration
continue n'exclut plus aucune part.
