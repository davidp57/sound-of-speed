# Vocabulaire de statut

Ce dépôt n'a qu'une ligne `Statut :` par fichier de backlog, avec une seule
valeur à la fois. Les rôles de tri des skills s'y projettent ainsi :

| Statut       | Emoji | Rôle de tri du skill        |
|--------------|-------|-----------------------------|
| prêt         | ⬜    | `ready-for-agent`           |
| en cours     | 🔄    | —                           |
| attend David | 🧑    | `ready-for-human`, `needs-info` |
| fait         | ✅    | —                           |
| abandonné    | 🚫    | `wontfix`                   |

`en cours` 🔄 et `fait` ✅ n'existent que dans le cycle de vie : aucun rôle de
tri ne leur correspond.

`needs-triage` n'est pas utilisé : les lots naissent déjà spécifiés, ils ne sont
pas triés depuis des remontées extérieures. `/to-spec` et `/to-tickets` créent
leurs artefacts à `⬜ prêt`. La correspondance ci-dessus reste complète pour
qu'un skill de tri fonctionne s'il est adopté plus tard.

**🧑 attend David** est le statut qui compte le plus ici : beaucoup de choses ne
se vérifient qu'en roulant — le GPS écran éteint, le verrou d'écran, le rendu
sonore. Un ticket dont la vérification demande la voiture passe à 🧑 quand le
code est prêt, et pas à ✅.

La ligne `Statut :` d'une spécification est le statut **d'ensemble** du lot,
choisi par l'agent ; celle d'un ticket est le statut précis de ce ticket. Ce
n'est pas un calcul automatique de l'un vers l'autre.
