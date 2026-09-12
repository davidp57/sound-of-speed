# 06 — Les traces, le journal et les relevés vivent en base

**Statut :** ⬜ prêt

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

- [ ] Déposer une trace, une tranche de journal, un relevé écrit en base
- [ ] Le relecteur retrouve et relit une session déposée, tranche par tranche
- [ ] Une tranche compressée redescend sous le nom qui dit qu'elle l'est
- [ ] Une charge trop grosse est refusée avec le code qui interdit de rejouer
- [ ] La sonde dépose toujours, avec le compte qu'elle relit elle-même
- [ ] La part « dépôts » du test d'accord passe contre le nouveau serveur
- [ ] Une session déjà déposée n'est pas dupliquée si elle repart
