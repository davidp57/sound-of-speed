# 01 — Lire une capture déposée et en tirer des mesures

**Statut :** ✅ fait — livré le 11 septembre 2026

**Bloqué par :** rien.

## Ce qu'il faut obtenir

**Que le code d'étalonnage existant sache lire une capture de trajet.** Il sait
mesurer une `Trace` — un nom, un horodatage, des `SpeedSample`. Les captures
déposées depuis le 10 septembre ont un autre format : des tranches `.jsonl.gz`
avec un en-tête, des événements et des relevés bien plus riches.

Un adaptateur, et rien d'autre : les tranches d'une session se recollent dans
l'ordre, les relevés deviennent des `SpeedSample`, et `measureTrace` les avale
sans savoir d'où ils viennent.

Attention aux **trous** : la capture continue de tourner à l'arrêt et la page
en veille bat au ralenti — la session du 11 septembre a 52 minutes de trous sur
91, dont un pas de 20 secondes. Une mesure de cadence qui les compte serait
fausse ; la médiane les absorbe déjà, c'est à vérifier plutôt qu'à supposer.

## Critères d'acceptation

- [ ] Les tranches d'une session se recollent dans l'ordre, les doublons
      d'horodatage écartés.
- [ ] `measureTrace` rend ses grandeurs sur la session du 11 septembre 2026,
      qui sert de banc — elle est rapatriée et fait 24 000 relevés.
- [ ] Les chiffres obtenus sont confrontés à ce que la trace montre vraiment :
      vitesse maximale, nombre de départs arrêtés, cadence. Un chiffre qui ne
      se retrouve pas à la main est un chiffre faux.
- [ ] Les trous à l'arrêt ne faussent ni la cadence ni la durée retenue.
- [ ] Tests dans `core/`, sous Node, sans navigateur.
- [ ] Contrôle qualité vert.
