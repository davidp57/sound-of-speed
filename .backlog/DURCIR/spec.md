# DURCIR — sécuriser le code et les données

**Statut :** 🔄 en cours — cadre posé le 13 septembre 2026, découpé et attaqué le
15 septembre. 11 tickets faits, 2 en attente de David, 1 restant.
**Branche :** `feature/durcir`
**Version visée :** avant la 1.0

## Où ça en est

| Ticket | État |
|---|---|
| 01 les échantillons demandent un compte | 🧑 le cache hors réseau reste à confirmer en voiture |
| 02 la banque restreinte | ✅ vérifié sur le serveur ; un défaut d'adresse trouvé en le vérifiant, corrigé à part |
| 03 identifiants opaques | ✅ le renommage était fait le 14 septembre ; les étiquettes audio sont mesurées et propres, le reste ne paie pas |
| 04 mesurer ce que le serveur dépense | 🧑 le serveur relève ses quatre chiffres tout seul, une ligne par jour ; reste à tirer l'image et à lire |
| 05 borner le volume par compte | ⬜ attend les chiffres du 04 |
| 06 isolation entre comptes | ✅ dix routes, deux comptes ; l'isolation était juste |
| 07 changer un compte de mains | ✅ trois cas manquaient, vus du compte cible |
| 08 l'archive du compte | ✅ un nom déposé pouvait composer un chemin |
| 09 la copie des rôles | ✅ rattachée au compte ; le rôle de synthèse est un verrou d'affichage, écrit |
| 10 les en-têtes | ✅ politique de contenu mesurée dans un navigateur |
| 11 l'origine d'une requête | ✅ la prémisse du ticket était fausse : la garde mordait déjà |
| 12 le code de liaison | ✅ borne mesurée, un seul code vivant par compte |
| 13 les données en clair | ✅ on ne chiffre pas, et le README dit pourquoi |
| 14 offrir la source | ✅ c'était déjà en place |

## D'où vient ce lot

David regarde les échanges réseau pendant le lot COMPTES, et relève que la route
des droits répond en clair la liste des rôles du compte. Son mot : « c'est
beaucoup trop facile de s'approprier des rôles qu'on n'a pas ».

**Vérifié le jour même, et ce n'est pas ce qui se passe.** Aucune route n'écrit
dans la table des droits. La route est en lecture seule et exige une session. Le
contrôle mord côté serveur, route par route : les droits sont relus en base à
chaque requête protégée, et un navigateur qui réécrirait la réponse ne changerait
que son propre affichage.

**Ce que la réponse dit vraiment**, c'est que les trois rôles sont offerts à tout
le monde — valeur par défaut assumée, en attendant qu'il y ait quelque chose à
encaisser. De l'extérieur, « ça protège » et « ça laisse tout passer » se
ressemblent donc exactement, ce qui explique l'impression.

## À quoi servent les rôles, et ce que ça change

Instruit le 15 septembre 2026. David : les rôles ne sont pas là pour vendre des
fonctions, mais pour **borner ce que le serveur dépense**.

Ça déplace le sujet, parce que le rôle est un mauvais outil pour ça : il n'a que
deux crans, et il est offert à tout le monde par défaut. Ce qui borne une
ressource est un **quota** ; le rôle est ce qui choisit le quota. Seul le premier
champ existe.

La carte des dépenses, dressée sur le code :

| Ce que ça coûte au serveur | Gardé par, avant ce lot |
|---|---|
| Le service des échantillons — le poste dominant | **rien : ni compte ni rôle** |
| Le stockage des dépôts | un rôle, et 16 Mio par requête ; rien sur le total |
| L'analyse d'une trace, relancée à chaque dépôt | un rôle, déclenché par l'envoi |
| L'archive d'un compte, qui relit tout | aucun rôle, délibérément |
| La synthèse | un rôle — et elle ne coûte **rien** au serveur |

D'où l'ordre du lot : **mesurer, puis fermer la porte du service des
échantillons, puis borner le volume**. Les quotas par rôle attendent les chiffres
— un seuil inventé refuse ou efface des données sans que rien ne rougisse.

## Une banque qui n'est pas à nous

Une des banques d'échantillons ne nous appartient pas. Elle sert à l'essai local
en attendant les moteurs produits par la synthèse ; elle n'est pas livrée, et
aucun échantillon n'est jamais entré dans le dépôt — vérifié sur tout
l'historique le 15 septembre 2026.

**Mais elle est servie sans aucune authentification.** C'est le seul endroit où
l'état contredit ce que le dossier du projet écrit depuis le début. C'est la
raison d'être des tickets 01 à 03, et le point le plus urgent du lot.

Ce qui a été arbitré le 15 septembre :

- **La porte d'abord** (ticket 01). Toute la protection repose dessus : l'accès
  restreint à une poignée de comptes rend sans objet les parades plus lourdes.
- **Les identifiants opaques quand même** (ticket 03), parce qu'un nom voyage là
  où la porte ne ferme rien : profil partagé par lien ou par code à scanner,
  archive exportée, journal, capture d'écran.
- **Pas de découpage en boucles servies séparément.** Le client cherche
  lui-même où boucler, sur le fichier entier, et cette recherche est une pièce
  délicate du projet. Déplacer ça coûterait cher et, la porte posée,
  n'achèterait rien.
- **Pas de chiffrement du flux audio.** La clé partirait avec le client.

## Ce qui est écarté, et n'est pas à reproposer

- **L'obscurcissement du code servi.** Le dépôt est public et la licence oblige à
  offrir la source : ça ne protège rien, et ça casse les cartes de source, donc
  le débogage en voiture. L'arbitrage s'écrit dans le ticket 14.
- **La réécriture de l'historique du dépôt.** Envisagée puis retirée le
  15 septembre après lecture complète des documents concernés : ils montrent un
  projet qui connaît la limite, ne redistribue rien, et cherche une alternative
  sous licence. Les effacer transformerait une trace de bonne foi en apparence de
  dissimulation.
- **Un contrôle serveur sur le rôle de synthèse.** Il ne commande aucune route et
  ne coûte rien au serveur : c'est un verrou d'affichage, assumé, à écrire
  (ticket 09).

## Ce qui part dans un autre lot

L'écran d'administration — rôle d'administrateur, liste des comptes, attribution
des rôles, des banques restreintes et des quotas — est le lot
[RÉGIE](../REGIE/spec.md). Ici, ces droits se posent par la configuration du
serveur, ce qui suffit et ce qui est le plus sûr.

## Ce qui est déjà établi, et n'est pas à refaire

- Le contrôle de rôle existe et s'applique côté serveur, pas seulement à l'écran.
- Les trois rôles sont offerts par défaut, délibérément.
- Aucun échantillon n'est jamais entré dans le dépôt.
- Aucune route ne permet d'écrire dans la table des droits.
