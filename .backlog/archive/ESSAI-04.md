# ESSAI-04 — six défauts relevés en roulant le 4 septembre

**Statut :** ✅ fait — clos le 2026-09-06, huit tickets sur huit
**Branche :** `fix/essai-04`
**Version visée :** 0.2 — avant tout le reste

Un essai sur route le 4 septembre 2026 : son sourd et mal étagé, régime bloqué à
800 tr/min sous 20-30 km/h, application figée après cinq à dix minutes ou vers
70 km/h, et écran d'étalonnage inutilisable.

La cause la plus lourde était une mesure d'accélération inexploitable :
écart-type de 0,83 m/s² sur une vitesse tenue, contre 0,10 pour la pente. La
boîte jugeait la croisière sur l'accélération instantanée, d'où un régime plaqué
au ralenti sous 26 km/h en quatrième.

Deux constats sont restés hors périmètre et le sont encore : les seize passages
de rapport parasites par minute à réglage d'usine, et le trou entre 5 et
13,2 km/h au démarrage — reproduits, non corrigés, écartés par David comme
n'étant pas ce qu'il avait entendu.

Le ticket 05 a écarté la piste de l'ancrage de banque, ce qui a ouvert le lot
[SYNTHESE](../SYNTHESE/spec.md).

## Tickets

| # | Titre | Statut |
|---|---|---|
| 01 | Une accélération que la boîte peut croire | ✅ fait |
| 02 | Le GPS ne se tait plus pour de bon | ✅ fait |
| 03 | Un enregistrement d'étalonnage s'arrête toujours | ✅ fait |
| 04 | L'effort s'entend en sortie, pas seulement dans le mixage | ✅ fait — la chaîne de sortie est hors de cause |
| 05 | La banque jouée à sa hauteur | ✅ fait — l'essai écarte la piste |
| 06 | Quitter le plein écran sans viser un profil | ✅ fait |
| 07 | Le décor qui défilait est retiré | ✅ fait |
| 08 | Le blocage revient, et cette fois c'est l'étalonnage | ✅ fait |
