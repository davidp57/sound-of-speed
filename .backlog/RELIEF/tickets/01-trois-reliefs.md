# 01 — Trois reliefs, réglables en décibels

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Le niveau d'ensemble suit l'effort et le régime, et le ralenti se distingue.
Trois réglages en décibels, exposés à l'écran de configuration, appliqués après
les fondus et à toutes les couches à la fois.

Le point neutre est la croisière : monter un relief ne doit pas obliger à
rebaisser le volume général derrière.

À zéro, le son doit être **exactement** celui d'avant.

## Critères d'acceptation

- [x] Le relief de charge donne deux fois sa valeur d'écart entre lever le pied
      et écraser, vérifié en décibels
- [x] Il ne change rien à la charge de croisière
- [x] Il suit la charge **brute** : un contraste nul ne le désactive pas —
      défaut écrit puis attrapé par le test, qui rendait le relief muet dès
      qu'on touchait au contraste
- [x] Le relief du régime monte régulièrement du ralenti au rupteur, et donne sa
      valeur d'écart entre les deux
- [x] Le niveau au ralenti ne s'applique qu'au ralenti
- [x] Les trois à zéro rendent un niveau indépendant du régime et de la charge
- [x] Les trois curseurs sont à l'écran, avec leur ligne dans la « Référence des
      réglages » du README
