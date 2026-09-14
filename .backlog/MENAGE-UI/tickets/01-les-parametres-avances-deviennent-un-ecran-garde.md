# 01 — Les paramètres avancés deviennent un écran à part, gardé

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

L'écran de configuration se coupe en deux. Ce qui se règle simplement reste dans
« Paramètres » ; Moteur, Transmission, Signal de vitesse et Caractère passent
dans un second onglet, « Paramètres avancés ». Le bouton Simplifié / Avancé
disparaît : ce n'est plus une préférence qu'on coche, c'est un écran qu'on
ouvre.

Le second onglet porte la garde du lot, et c'est ce ticket qui l'écrit une fois
pour toutes — les tickets suivants la réutilisent.

Quand la source est le GPS et qu'on roule, l'onglet reste **visible et grisé**.
Il ne disparaît pas : un onglet qui va et vient déplace ses voisins sous le
doigt. Sélectionné, il s'ouvre sur un écran vide qui dit pourquoi, plutôt que de
rester un bouton mort.

La pétarade et le clac quittent la section Caractère pour rejoindre le premier
niveau : ce sont deux effets sonores qu'on veut pouvoir couper en ville ou avec
un passager, sans changer de caractère.

## La garde, en une phrase

Si la source est le GPS, l'écran est fermé — sauf vitesse nulle depuis trente
secondes **et** application au repos. Sous simulateur ou rejeu, aucune garde.

Tant qu'aucune position n'a jamais été reçue, il n'y a pas de vitesse non nulle à
opposer : la garde est ouverte. Sans cela, ouvrir cet écran sur un poste neuf
ferait attendre une demi-minute pour rien.

## Critères d'acceptation

- [ ] L'écran de configuration ne porte plus que ce qui se règle simplement, et
      le bouton Simplifié / Avancé n'existe plus
- [ ] Un second onglet porte Moteur, Transmission, Signal de vitesse et
      Caractère
- [ ] La pétarade et le clac se règlent depuis le premier niveau
- [ ] Au GPS, en roulant, l'onglet est visible et grisé ; ouvert, il affiche
      « disponible uniquement à l'arrêt »
- [ ] Au GPS, arrêté depuis trente secondes et au repos, il s'ouvre sur ses
      quatre sections
- [ ] Repartir referme l'écran sans attendre un redémarrage
- [ ] Sous simulateur, l'onglet est ouvert sans condition
- [ ] Sur un appareil qui n'a jamais reçu de position, l'onglet est ouvert sans
      attendre
- [ ] La garde est couverte par des tests du cœur, sans navigateur
