# 06 — Une seule origine à la fois, décidée au changement

**Statut :** ✅ fait

**Bloqué par :** 03 — Trois origines de son ; 04 — Le son sort

## Ce qu'il fallait obtenir

Changer l'origine du son d'un profil pendant que le son joue doit prendre effet
tout de suite, et les deux origines ne doivent jamais s'entendre ensemble.

## Ce qui n'allait pas

Relevé par David le 7 septembre 2026, sur l'image `develop`, dans son
navigateur, à l'arrêt — donc au ralenti, faute de simulateur.

1. Profil *procar*, son activé : la banque joue le ralenti.
2. Il passe le profil en *généré en direct* et revient à l'écran de conduite :
   **toujours le son procar**.
3. Il clique sur le bouton du son : « Moteur en construction », puis le son de
   synthèse **par-dessus** le ralenti de la banque. Le bouton affichait
   « Son actif ».

Deux défauts, l'un dans l'autre.

**Le veilleur ne traitait qu'un sens.** Dans `src/state.ts`, la surveillance de
l'origine arrêtait la synthèse quand on la quittait, et ne faisait rien quand on
y entrait : ni arrêt de la banque, ni démarrage du moteur simulé. C'est le
symptôme 2.

**La règle « une seule origine à la fois » était tenue par la boucle d'images.**
Elle appelait `audio.mute()` à chaque tour tant que le moteur simulé tournait.
Un invariant qui dépend d'un battement de boucle lâche dès que la boucle
s'arrête — et c'est ce qui s'est produit : le bouton affichant « Son actif », la
phase du synthé valait bien `ready`, donc la boucle aurait dû couper la banque à
chaque tour. Elle ne l'a pas fait.

## Ce qui a été mesuré

Rejoué au poste, en silence — volume général à 0,0005, soit −66 dB, pour que le
niveau de sortie existe sans que rien ne s'entende.

Avant correction :

| état | phase banque | lectures | phase synthé |
|---|---|---|---|
| après passage en *direct*, sans toucher au bouton | `ready` | 5 | `idle` |

Le symptôme 1 est donc reproduit tel quel. Le symptôme 2 ne l'est **pas** au
poste : une fois le synthé en `ready`, le niveau de la banque tombe à 0 exact,
contre 4,9 × 10⁻⁵ quand le synthé est arrêté. La boucle y fait son travail.

Après correction, l'aller-retour complet :

| étape | phase banque | lectures | niveau banque | phase synthé |
|---|---|---|---|---|
| banque active | `ready` | 5 | 1,10 × 10⁻⁴ | `idle` |
| passage en *direct* | `idle` | 0 | 0 | `ready` |
| retour en *enregistré* | `ready` | 5 | 5,5 × 10⁻⁵ | `idle` |

Deux cas limites vérifiés : trois bascules coup sur coup finissent dans l'état
demandé par la dernière, et changer d'origine sans avoir jamais activé le son
n'allume rien.

## Ce qui a été fait

- `core/audio/engine.ts` — une méthode `unload()` qui démonte les couches en
  gardant le contexte ouvert. Le fermer obligerait à en rouvrir un au retour, or
  un contexte neuf naît suspendu et son réveil demande un geste de
  l'utilisateur — geste qui n'existe pas quand on revient d'un écran de réglage.
- `src/state.ts` — la bascule se fait à la transition, dans les deux sens, et
  les changements s'enchaînent au lieu de se croiser. Un drapeau retient que le
  son a été demandé : sans lui, changer d'origine allumerait un son que personne
  n'a réclamé, ou laisserait muet un son qui jouait.

Pas de test unitaire ajouté : le graphe Web Audio n'est pas exerçable sous Node,
et c'est assumé par l'architecture — `core/audio/mix.ts` est la partie pure et
testée, le graphe se vérifie dans un navigateur. La vérification est celle du
tableau ci-dessus.

## Critères d'acceptation

- [x] Changer l'origine du son pendant que le son joue prend effet sans toucher
      au bouton
- [x] Les deux origines ne s'entendent jamais ensemble
- [x] Changer d'origine sans avoir activé le son n'allume rien
- [x] Des bascules rapides finissent dans l'état demandé par la dernière
- [ ] 🧑 Vérifié dans la voiture : plus de superposition, et le son suit
      l'origine

## Ce qui reste ouvert

**Pourquoi la boucle d'images s'était-elle arrêtée ?** Le correctif rend la
question sans effet sur le son, mais pas sans intérêt : une boucle arrêtée, ce
sont aussi la vitesse et le rapport qui cessent d'être suivis. Le suspect est le
second contexte audio — le moteur simulé en ouvre un à lui, distinct de celui de
la banque, et c'est dans celui de la banque que bat l'`AudioWorklet` qui cadence
tout.

L'observable est déjà à l'écran de télémétrie : **l'horloge** et la **durée
d'image**. À regarder la prochaine fois que les deux origines sont basculées
dans la voiture. Si l'horloge s'arrête au démarrage du moteur simulé, c'est un
ticket à part.
