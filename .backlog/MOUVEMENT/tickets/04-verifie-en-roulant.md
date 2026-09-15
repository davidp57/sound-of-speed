# 04 — Vérifié en roulant

**Statut :** 🧑 attend David — le code des trois précédents est en place

**Bloqué par :** plus rien — 03 est livré le 15 septembre 2026, et le journal
inscrit désormais chaque bascule d'allure, ce qui rend l'essai lisible après
coup.

## Ce qu'il faut obtenir

**L'essai qui clôt le lot.** Rien à coder : un trajet, puis la relecture de son
journal. Ce ticket passe à 🧑 dès que le code des trois précédents est en place,
et il ne peut pas être fait par un agent.

Ce qu'on cherche, dans l'ordre :

1. **Les allers-retours à vitesse tenue** — dix-neuf alternances relevées le
   10 septembre au soir sur 36 minutes, dont douze à charge moyenne entre 40 et
   72 km/h. Le journal des passages les compte maintenant exactement, là où ce
   relevé n'était qu'une borne basse.
2. **Le symptôme A** — la troisième tenue jusqu'à 150 km/h, rapportée le
   10 septembre au matin, jamais retrouvée dans un journal. Elle ne s'est pas
   reproduite le soir même ; si elle revient, l'inscription des passages la
   montrera cette fois.
3. **Les descentes au ralentissement**, qui doivent se faire rapport par
   rapport sans remonter.

## Critères d'acceptation

- [ ] Un trajet est roulé avec la lecture unifiée et son journal rapporté.
- [ ] Le nombre d'allers-retours est comparé à celui du 10 septembre, sur une
      durée comparable.
- [ ] Le symptôme A est cherché explicitement, et son absence ou sa présence est
      écrite — une absence constatée vaut mieux qu'une question laissée ouverte.
- [ ] Le verdict est consigné dans la spécification du lot, et le statut
      d'ensemble mis à jour.
