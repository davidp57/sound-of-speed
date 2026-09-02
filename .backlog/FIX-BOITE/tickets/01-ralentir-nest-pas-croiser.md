# 01 — Ralentir n'est pas croiser

**Statut :** ✅ fait

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

Un ralentissement doux fait descendre la boîte régulièrement, et ne passe plus
pour une croisière.

La bande d'accélération considérée comme « vitesse tenue » était symétrique —
±0,3 m/s², soit ±1,08 km/h par seconde — si bien qu'un lever de pied sur du plat
tombait dedans. La descente au régime s'en trouvait suspendue, alors qu'elle
n'est suspendue que pour éviter le yoyo en croisière. Mesuré : le dernier rapport
était gardé **jusqu'à l'arrêt**, puis toute la cascade tombait au premier
freinage franc.

Tenir une vitesse, c'est ne pas la perdre : la bande devient asymétrique.

Il faut en même temps tolérer le **tremblement** de la mesure : l'accélération
vient d'une dérivée du GPS, et sans tolérance la montée en croisière ne se
déclencherait jamais en conduite réelle — mesuré, 0,25 m/s² de bruit suffisait à
l'empêcher tout à fait. Un ralentissement, lui, sort de la bande et y reste :
c'est ce qui permet de distinguer les deux.

## Critères d'acceptation

- [x] Un ralentissement doux, dans l'ancienne bande, fait descendre les rapports
      régulièrement — mesuré, quatre descentes étalées de 104 à 55 km/h
- [x] Le dernier rapport n'est plus gardé jusqu'à l'arrêt
- [x] Une décélération faible et constante ne déclenche aucune montée en
      croisière
- [x] Un tremblement de 0,25 m/s² laisse la montée en croisière se déclencher
- [x] Une oscillation de 1,5 m/s² — même forme, six fois l'amplitude — ne la
      déclenche pas
- [x] Aucune montée en croisière dans les secondes qui suivent une descente
- [x] Le banc de test expose l'instant de chaque passage, sans quoi la phase de
      descente ne peut pas être isolée
