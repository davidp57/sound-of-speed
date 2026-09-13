# 15 — Le navigateur se dit dans le journal, une fois par session

**Statut :** ✅ fait — 13 septembre 2026

**Demandé par David** le 13 septembre 2026, en lisant le ticket 14 : « on pourrait
ajouter les données du navigateur (une seule fois par session) dans le journal
pour analyse ultérieure ? »

## Ce qu'il faut obtenir

Le ticket 14 reconnaît le navigateur de la voiture à sa chaîne d'agent, et ce
n'était qu'un **pari** : rien dans le dépôt ne permettait de le vérifier. Le
journal que la voiture dépose ne portait pas cette chaîne, et le volume du NAS
n'a pas de base à interroger.

Il la porte désormais. Un genre d'événement `device`, écrit une fois en tête de
session : la chaîne d'agent, les dimensions de l'écran, le pointeur, ce qu'on a
deviné, et ce qui s'applique.

## Ce à quoi il faut faire attention

- **Une fois par session, pas une par tranche.** C'est une ligne de plus dans un
  journal qui en porte des milliers ; répétée, elle en deviendrait le contenu.
- **L'accord commande, comme pour le reste du journal.** Rien n'est écrit tant
  que la remontée n'est pas accordée. Mais l'accorder **en cours de route** doit
  l'écrire aussi : c'est justement la session qu'on voudra lire.
- **Deviné et appliqué, les deux.** Un écart entre les deux dit que quelqu'un a
  dû corriger à la main — donc que la détection s'est trompée, ce qui est
  exactement ce qu'on cherche à savoir.

## Critères d'acceptation

- [x] Le journal porte la chaîne d'agent, l'écran et le pointeur, une fois par
      session
- [x] Il porte aussi ce qu'on a deviné et ce qui s'applique
- [x] Rien n'est écrit sans accord de remontée, et accorder en cours de session
      l'écrit
- [x] Le relecteur sait nommer ce genre d'événement
