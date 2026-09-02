# Vocabulaire et décisions du domaine

Dépôt à contexte unique : une seule application, pas de sous-produits.

- **Glossaire** — [`CONTEXT.md`](../../CONTEXT.md) : les termes qui ont un sens
  précis ici, leur identifiant anglais dans le code, et les mots à éviter.
  Employer ce vocabulaire dans les specs, les tickets et les commits ; il n'y a
  pas d'autre glossaire.
- **Fonctionnement** — la section « Comment ça marche » du
  [`README.md`](../../README.md) : la chaîne de traitement, la pièce importante
  (`conditioner.ts`), et les trois points délicats du son (raccord des boucles,
  cadence en arrière-plan, phase des couches). À lire avant de proposer quoi
  que ce soit qui touche au signal ou à l'audio.
- **Réglages** — la section « Référence des réglages » du README décrit chaque
  paramètre et ce qu'il fait. Un réglage nouveau se déclare à cinq endroits :
  voir « Toucher aux réglages » dans [`CLAUDE.md`](../../CLAUDE.md).
- **Invariants d'architecture** — la section « Trois invariants à ne pas
  casser » de `CLAUDE.md` : `core/` sans Vue, sources de vitesse toutes derrière
  la même interface, `mix.ts` fonction pure.
- **Ce qui n'est pas vérifié** — la fin du README dit honnêtement ce qui n'a
  jamais été confirmé en conditions réelles. Ne pas le présenter comme acquis
  dans une spec.

Il n'y a **pas encore de décision d'architecture écrite** (`docs/adr/`). La
première qui mérite de l'être y sera déposée au format
`docs/adr/NNNN-titre.md` — le skill `/domain-modeling` sait les rédiger. En
attendant, les décisions structurantes déjà prises sont commentées à l'endroit
où elles s'appliquent : le choix d'un régime de passage par rapport plutôt qu'un
seuil unique (`core/preset/schema.ts`), la mesure du saut d'énergie plutôt qu'un
critère indirect pour le raccord des boucles (`core/audio/engine.ts`), la
déduction de la charge depuis l'accélération faute de pédale
(`core/engine/engine.ts`).
