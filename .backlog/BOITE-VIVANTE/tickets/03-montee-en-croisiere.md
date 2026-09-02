# 03 — Monter un rapport quand la vitesse se stabilise

**Statut :** ✅ fait

**Bloqué par :** 01 — La boîte reçoit l'accélération

## Ce qu'il faut obtenir

Tenir une vitesse fait monter les rapports, comme une vraie boîte automatique.
Mesuré aujourd'hui sur Route : 50 km/h tenus laissent la **2e à 3034 tr/min**
quand la 4e donnerait 1532.

La cause est que la montée est un événement déclenché par le régime : sur un
palier le régime ne monte plus, donc rien ne se produit. Il faut une seconde
raison de monter, qui ne regarde pas le régime mais la **stabilité de la
vitesse**.

Quand l'accélération reste sous 0,3 m/s² pendant 2,5 s, tenter un rapport de
plus — un seul à la fois, ce qui laisse la cascade se faire d'elle-même, palier
par palier. À condition que le rapport visé tourne encore au-dessus du **régime
de croisière minimal**, faute de quoi 50 km/h finiraient en 6e à 1071 tr/min, ce
qui broute.

**L'interaction à traiter dans le même ticket, sinon la boîte fait le yoyo** : la
4e à 50 km/h donne 1532 tr/min, sous le seuil de descente de 1820 — la règle
actuelle la ferait redescendre à l'image suivante. La descente au régime plancher
est donc suspendue pendant une croisière stable. C'est cohérent : elle existe
pour éviter de brouter, et le plancher de croisière garantit qu'on ne broute pas.

## Critères d'acceptation

- [x] Une vitesse tenue fait monter les rapports, un par un
- [x] La montée s'arrête au rapport dont le régime passe sous le plancher de
      croisière — et pas avant
- [x] Aucun yoyo : une fois montée, la boîte **reste** sur son rapport tant que
      la vitesse est tenue, vérifié sur une longue durée
- [x] Une vitesse instable ne déclenche aucune montée en croisière
- [x] Le délai est respecté : la montée n'arrive pas avant que la vitesse soit
      stable depuis le temps déclaré
- [x] Le rétrogradage forcé fonctionne toujours après une montée en croisière —
      c'est même là qu'il prend son sens
- [x] Le seuil de passage ordinaire, lié au régime, est inchangé
- [x] `minUpshiftRpm` garde son rôle : plancher des seuils de passage ordinaires,
      sans rapport avec le plancher de croisière, et le README le dit
- [x] Deux réglages nouveaux apparaissent à l'écran de configuration, avec leur
      ligne dans la « Référence des réglages » du README
