# 12 — Rétrograder plus tôt en ralentissant, sans traîner un rapport en croisière

**Statut :** ⬜ prêt — à analyser avant de toucher un seuil

David, après la sortie du 16 septembre 2026 :

> « Le rétrogradage au ralentissement pourrait se produire plus tôt ; mais si on
> étage comme ça on risque de garder le rapport en croisière. À analyser. »

Il valide dans le même mouvement le lot [FIX-BOITE](../../FIX-BOITE/spec.md) —
ralentir n'est plus croiser — **avec ce bémol**.

## La tension, telle qu'il la pose

Elle est réelle et c'est elle qui rend le ticket difficile : un seul seuil sert
deux situations opposées.

- **En ralentissant**, on veut descendre tôt : le frein moteur se fait entendre,
  et le rapport est prêt quand on réaccélère.
- **En croisière**, au même régime, on veut garder le rapport long : descendre
  ferait monter le moteur pour rien et sonnerait faux.

Baisser le seuil de descente sans autre garde donne donc le second défaut en
corrigeant le premier. C'est exactement ce que David anticipe.

## Ce qu'il y a déjà, et qui n'est pas la réponse

La boîte sait distinguer les deux cas depuis le lot
[MOUVEMENT](../../MOUVEMENT/spec.md) : une seule lecture de l'allure, qui dit si
on ralentit, si on tient, ou si on accélère. Le seuil de descente est donc déjà
conditionné à « on ralentit ».

Ce qui manque n'est pas la distinction, c'est **où** placer le seuil une fois
qu'on ralentit — et le ticket ne se tranchera pas sans mesure.

## Ce qu'il faut mesurer avant de proposer

Les journaux du 16 portent chaque descente avec sa vitesse et son régime, et
chaque bascule d'allure. Donc, sans rouler :

1. À quel régime les descentes se font aujourd'hui, en ralentissant, rapport par
   rapport — et de combien il faudrait les avancer pour que le frein moteur
   s'entende.
2. Combien de descentes se produiraient **en trop** si on avançait ce seuil,
   c'est-à-dire pendant des phases classées « tient l'allure ». C'est le chiffre
   qui dit si le risque que David nomme est réel ou théorique.
3. Si le mode Route et le mode Sport doivent bouger ensemble.

## Lien avec le pompage en bouchons

Le ticket [MOUVEMENT/04](../../MOUVEMENT/tickets/04-verifie-en-roulant.md) est
rouvert sur un constat voisin : en accordéon d'autoroute, la boîte fait
1,23 aller-retour par minute. Avancer le seuil de descente **aggraverait**
mécaniquement ce pompage. Les deux tickets doivent donc être instruits ensemble,
et une hystérésis de temps est probablement la pièce qui manque aux deux.

## Critères d'acceptation

- [ ] Les trois mesures ci-dessus sont faites sur les journaux existants.
- [ ] La proposition dit ce qu'on gagne en frein moteur et ce qu'on risque en
      croisière, chiffres à l'appui.
- [ ] Elle est soumise à David avant d'être écrite.
- [ ] Écouté en roulant : le frein moteur s'entend, et rien ne descend en
      croisière.
