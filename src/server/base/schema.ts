/**
 * Le schéma de la base, décrit en TypeScript.
 *
 * **Ce qui est en colonnes, et ce qui est en JSON.** Un profil porte cent
 * cinquante-huit réglages, un moteur en porte vingt-sept de plus. Les étaler en
 * colonnes créerait une seconde description de ces objets, à tenir d'accord avec
 * celle du cœur — or le dépôt a déjà payé le prix de deux implémentations d'une
 * même notion, et c'est le lot MOUVEMENT. Le cœur reste donc la seule autorité
 * sur la forme d'une entité ; la base en garde le contenu tel quel, et n'ouvre
 * en colonnes que ce sur quoi elle a besoin de trier, filtrer ou joindre.
 *
 * **Pourquoi les droits sont là dès maintenant**, alors que tout le monde a tout
 * et que rien n'est encaissé : les poser plus tard coûterait une migration de
 * données, les poser maintenant ne coûte rien. Le jour où l'on ouvre, il reste à
 * brancher un encaissement et à changer une valeur par défaut.
 */

import { relations, sql } from 'drizzle-orm'
import { blob, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** L'instant présent, en secondes, tel que SQLite le calcule lui-même. */
const maintenant = sql`(unixepoch())`

/**
 * Les comptes.
 *
 * Un compte se crée tout seul au premier lancement et reste **anonyme** tant que
 * ça suffit : on monte dans la voiture et ça marche. L'adresse se rattache le
 * jour où elle sert — pour ne pas perdre ses réglages en changeant de téléphone,
 * ou parce qu'il y a de l'argent en jeu. Elle est donc facultative ici, et le
 * restera.
 */
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    /** Ce qui s'affiche. Jamais vide, même sur un compte anonyme. */
    name: text('name').notNull(),
    /**
     * Rattachée plus tard, ou jamais : celui qui déploie chez lui n'en donne pas.
     *
     * La bibliothèque d'identité la déclare obligatoire de son côté ; la colonne,
     * elle, reste facultative — et SQLite accepte autant de valeurs absentes
     * qu'on veut dans un index unique. C'est ce qui laisse coexister les comptes
     * anonymes sans lever la garantie d'unicité sur ceux qui en ont une.
     */
    email: text('email'),
    /**
     * L'adresse a-t-elle été confirmée ?
     *
     * Rien ne l'envoie aujourd'hui, et la valeur reste fausse. La colonne existe
     * parce que la bibliothèque d'identité la lit et l'écrit à chaque passage.
     */
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    /** Une image de compte, quand un fournisseur d'identité en donne une. */
    image: text('image'),
    /**
     * Ce compte s'est-il créé tout seul, sans que personne saisisse rien ?
     *
     * C'est **ici** qu'on lit qu'un compte est anonyme, et non dans son adresse.
     * La bibliothèque d'identité en fabrique une pour ses comptes anonymes —
     * elle exige un courriel non vide — et la fabrique sous le domaine réservé
     * `.invalid`, qui par construction ne désigne aucune boîte. Se fier à la
     * forme de l'adresse reviendrait à lire une convention là où il y a un fait.
     */
    isAnonymous: integer('is_anonymous', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(maintenant),
    /**
     * La dernière écriture, telle que la bibliothèque d'identité la pose.
     *
     * Facultative, et ce n'est pas un oubli : SQLite refuse d'ajouter à une table
     * déjà peuplée une colonne obligatoire dont le défaut se calcule. Les lignes
     * d'avant la reçoivent par un rattrapage dans la migration, et tout ce qui
     * s'écrit ensuite la porte.
     */
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (table) => [uniqueIndex('accounts_email').on(table.email)],
)

/**
 * Les sessions d'identité — **pas** les sessions de conduite.
 *
 * Deux mots identiques pour deux choses sans rapport : une session de conduite
 * est un trajet, recollé depuis les tranches de `deposits` ; une session
 * d'identité est ce qui dit qui tient le volant. Le préfixe `auth_` marque les
 * secondes, et `CONTEXT.md` dit lequel est lequel.
 *
 * La table appartient à la bibliothèque d'identité : elle seule y écrit.
 */
export const authSessions = sqliteTable(
  'auth_sessions',
  {
    id: text('id').primaryKey(),
    /**
     * Le compte à qui cette session appartient.
     *
     * La bibliothèque appelle ce champ `userId` ; il est renommé à la
     * configuration, pour que toutes les tables d'ici désignent un compte de la
     * même façon.
     */
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** Ce que porte le témoin de connexion. */
    token: text('token').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(maintenant),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(maintenant),
  },
  (table) => [
    uniqueIndex('auth_sessions_token').on(table.token),
    index('auth_sessions_account').on(table.accountId),
  ],
)

/**
 * Le lien entre un compte et une façon de prouver qui on est.
 *
 * **Ce n'est pas un compte.** La bibliothèque d'identité appelle cela un
 * « account », et le mot désigne chez elle le fournisseur d'identité — un mot de
 * passe rangé ici, ou un compte tenu ailleurs. Garder ce nom à côté de notre
 * table `accounts` garantirait la confusion, donc il ne le garde pas.
 *
 * Un compte peut en porter plusieurs : une adresse avec mot de passe, et un
 * fournisseur tiers, mènent au même compte.
 */
export const authIdentities = sqliteTable(
  'auth_identities',
  {
    id: text('id').primaryKey(),
    /** Le compte d'ici. La bibliothèque appelle ce champ `userId`. */
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** Qui prouve : `credential` pour un mot de passe d'ici, sinon le tiers. */
    providerId: text('provider_id').notNull(),
    /**
     * L'identifiant chez ce fournisseur.
     *
     * La bibliothèque appelle ce champ `accountId`, ce qui désigne exactement
     * l'inverse de ce que `account_id` désigne partout ailleurs ici. Il est donc
     * renommé à la configuration, et c'est le seul renommage qui compte vraiment.
     */
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
    scope: text('scope'),
    /** L'empreinte du mot de passe, quand c'en est un. Jamais le mot de passe. */
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(maintenant),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(maintenant),
  },
  (table) => [
    index('auth_identities_account').on(table.accountId),
    uniqueIndex('auth_identities_provider').on(table.providerId, table.providerAccountId),
  ],
)

/**
 * Ce qui attend d'être confirmé : un lien de vérification, un code à usage unique.
 *
 * Rien ne s'en sert aujourd'hui — aucun courriel ne part. La table existe parce
 * que la bibliothèque d'identité la veut, et parce qu'une table absente se
 * découvre au premier appel qui en a besoin, en production.
 */
export const authVerifications = sqliteTable(
  'auth_verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(maintenant),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(maintenant),
  },
  (table) => [index('auth_verifications_identifier').on(table.identifier)],
)

/**
 * Ce qu'un compte ouvre, et jusqu'à quand.
 *
 * La date de fin est facultative : un droit sans échéance ne se périme pas.
 * C'est ce que porte tout le monde aujourd'hui, gratuitement.
 */
export const rights = sqliteTable(
  'rights',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** Ce que le droit ouvre — un écran, une capacité. */
    scope: text('scope').notNull(),
    /** Sans échéance, il ne se périme pas. */
    expiresAt: integer('expires_at'),
    createdAt: integer('created_at').notNull().default(maintenant),
  },
  (table) => [uniqueIndex('rights_account_scope').on(table.accountId, table.scope)],
)

/**
 * Les moteurs, les boîtes, les profils.
 *
 * Trois tables de même forme, et c'est voulu : ce sont trois groupes de réglages
 * qu'un profil **assemble**, depuis la refonte du 10 septembre 2026. Un profil
 * ne porte plus de valeurs, il désigne un moteur et une boîte.
 *
 * Le nom est sorti du contenu parce qu'on liste par nom sans vouloir lire tout
 * le reste ; le reste dort dans `content`.
 */
export const engines = sqliteTable(
  'engines',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** L'entité entière, telle que le cœur la décrit et la valide. */
    content: text('content', { mode: 'json' }).notNull(),
    updatedAt: integer('updated_at').notNull().default(maintenant),
  },
  (table) => [index('engines_account').on(table.accountId)],
)

export const gearboxes = sqliteTable(
  'gearboxes',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    content: text('content', { mode: 'json' }).notNull(),
    updatedAt: integer('updated_at').notNull().default(maintenant),
  },
  (table) => [index('gearboxes_account').on(table.accountId)],
)

export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /**
     * Le nom sous lequel ce profil a été déposé, extension comprise.
     *
     * Deux noms, et ce n'est pas une redondance : `name` est ce qui s'affiche
     * dans une liste, `fileName` est **l'identité que le client manipule**. La
     * bibliothèque dépose « mon-v8.json », liste, et se sert du nom de fichier
     * comme clé. Lui rendre un nom dérivé d'autre chose reviendrait à renommer
     * son fichier dans son dos.
     */
    fileName: text('file_name'),
    /**
     * Le moteur et la boîte que ce profil assemble.
     *
     * Sans contrainte de clé étrangère, et c'est délibéré : une désignation qui
     * ne mène à rien **vaut une absence** — c'est ce qui fait marcher le partage,
     * un profil reçu désignant le moteur de celui qui l'a envoyé. Le cœur sait
     * déjà rendre un moteur d'ici dans ce cas.
     */
    engineId: text('engine_id'),
    gearboxId: text('gearbox_id'),
    content: text('content', { mode: 'json' }).notNull(),
    updatedAt: integer('updated_at').notNull().default(maintenant),
  },
  (table) => [
    index('profiles_account').on(table.accountId),
    // Déposer deux fois le même nom **remplace**, comme le faisait le dépôt de
    // fichiers. C'est ce que la bibliothèque attend quand elle renvoie un profil
    // qu'elle a modifié.
    uniqueIndex('profiles_account_file').on(table.accountId, table.fileName),
  ],
)

/**
 * Tout ce qui remonte de la voiture : traces, tranches de journal, relevés.
 *
 * Une seule table pour les quatre dossiers d'aujourd'hui, parce que ce sont
 * quatre fois la même chose — un nom, des octets, une date. Le découpage en
 * dossiers n'a pas été choisi : quand le journal s'est mis à déposer une tranche
 * toutes les cinq minutes, il a fallu l'écarter des traces pour ne pas alourdir
 * leur listage. Une base n'a pas ce problème.
 *
 * **Le nom est rendu tel qu'il a été déposé**, extension comprise : le client
 * décide de décompresser au nom du fichier, jamais au type que le serveur
 * annonce.
 *
 * Trois colonnes servent la règle de rétention : la date du trajet, qui décide
 * de l'ancienneté ; la marque d'analyse, sans laquelle on effacerait ce qu'on
 * n'a pas encore lu ; et l'exemption, qui dit ce qu'on garde et à quel titre.
 */
export const deposits = sqliteTable(
  'deposits',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** Le dossier d'origine : traces, journal, mesures, profils. */
    folder: text('folder').notNull(),
    /** Le nom déposé, extension comprise. */
    name: text('name').notNull(),
    /**
     * Les octets, tels qu'ils sont arrivés — compressés s'ils l'étaient.
     *
     * **Des octets, et non du texte.** Les tranches de journal et de trace
     * arrivent compressées : les ranger dans une colonne de texte les ferait
     * passer par un décodage qui n'a pas de sens pour elles, et ce qui
     * redescendrait ne serait plus ce qui est monté. Le schéma posé au ticket 03
     * disait « texte » ; le premier dépôt compressé l'a démenti.
     */
    content: blob('content', { mode: 'buffer' }).notNull(),
    bytes: integer('bytes').notNull(),
    depositedAt: integer('deposited_at').notNull().default(maintenant),
    /**
     * Quand le trajet a été enregistré, lu dans le nom de la tranche.
     *
     * Deux dates, parce qu'une seule ne suffit pas : la date de dépôt est celle
     * de l'arrivée sur le serveur, et elle ment dès que le dépôt est différé —
     * une trace enregistrée hors réseau et remontée trois jours plus tard, ou
     * les quatre-vingt-quatorze dépôts de la reprise, qui prétendent tous dater
     * de l'heure où elle a tourné. C'est cette date-ci qui décide de
     * l'effacement.
     *
     * Facultative : deux traces anciennes portent un nom libre, d'avant la
     * convention, et n'ont pas de date lisible. Elles reçoivent leur date de
     * dépôt à défaut, et le rattrapage du démarrage s'en charge.
     */
    recordedAt: integer('recorded_at'),
    /**
     * Le procédé du profileur qui a regardé ce dépôt, ou rien.
     *
     * Sans cette marque, rien ne distingue « il n'y avait rien à en tirer » de
     * « on n'a pas encore regardé », et la règle de rétention effacerait les
     * deux. Une session que le profileur a écartée parce qu'elle est trop courte
     * **a été regardée** : elle porte la marque, et elle est effaçable.
     *
     * C'est le numéro du procédé, et non un simple oui : le profileur relit tout
     * quand son procédé change, parce que l'ancien cumul ne vaut plus rien — une
     * marque posée par l'ancien ne dit plus la vérité.
     *
     * Le journal n'est jamais analysé : il ne passe pas par le profileur, et sa
     * règle d'effacement est ailleurs.
     */
    analyzedProcedure: integer('analyzed_procedure'),
    /**
     * Ce qui exempte ce dépôt de l'effacement, ou rien.
     *
     * Deux natures, et les confondre coûterait cher. **L'épingle** est un choix :
     * on garde ce trajet, et le nombre d'épingles est borné. **L'archive** est un
     * fait : ces trajets viennent d'un ancien serveur, la reprise les a
     * déménagés, et les effacer un mois plus tard reviendrait à les avoir
     * déplacés pour les perdre. Une seule nature obligerait soit à retirer leur
     * exemption aux quatre-vingt-quatorze dépôts repris, soit à laisser la borne
     * sans effet.
     */
    exemption: text('exemption', { enum: ['epingle', 'archive'] }),
  },
  (table) => [
    // Déposer deux fois le même nom remplace, comme le faisait le dépôt de
    // fichiers : c'est ce que la voiture attend quand elle rejoue un envoi.
    uniqueIndex('deposits_folder_name').on(table.accountId, table.folder, table.name),
    index('deposits_folder').on(table.accountId, table.folder),
  ],
)

/**
 * L'assistance qu'un conducteur a autorisée, et jusqu'à quand.
 *
 * **Une date d'échéance, et rien d'autre.** Le droit de regarder ses données
 * tombe dès qu'elle est dépassée, sans qu'aucun passage périodique n'ait à
 * s'exécuter : c'est la lecture qui écarte, comme pour les droits.
 *
 * **Pas de ligne, pas de droit** — l'absence est l'état normal, et c'est
 * pourquoi l'échéance est obligatoire ici. Dans la table des droits, une échéance
 * nulle veut dire « sans échéance » ; deux colonnes qui se ressemblent diraient
 * alors le contraire, et la seconde s'écrirait un jour en copiant la première.
 * Une table à part, avec une colonne obligatoire, retire la question.
 */
export const assistanceGrants = sqliteTable('assistance_grants', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  /** Jusqu'à quand, en secondes. Jamais nulle : une ligne est un accord ouvert. */
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull().default(maintenant),
})

/**
 * Qui a le droit d'écouter quelle banque réservée.
 *
 * **Les accords sont en base, le drapeau reste dans la pile.** C'est la
 * défaillance qui commande : une table de drapeaux vide — base neuve, migration
 * ratée — ouvrirait toutes les banques à tout le monde, ce qui est exactement le
 * trou qu'on vient de fermer. Une table d'accords vide, elle, ne fait que
 * refuser. Quelles banques sont réservées se déclare donc par l'environnement, et
 * les accords se posent ici.
 *
 * Par identifiant de compte, et non par adresse : le compte est la bonne unité,
 * et l'adresse était un pis-aller. Un compte sans adresse peut désormais écouter
 * une banque réservée.
 *
 * La cascade est ici le bon comportement, contrairement à la trace : un accord
 * donné à un compte qui n'existe plus ne veut rien dire.
 */
export const bankGrants = sqliteTable(
  'bank_grants',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** Le nom du dossier de la banque, tel que la pile le déclare réservé. */
    bank: text('bank').notNull(),
    createdAt: integer('created_at').notNull().default(maintenant),
  },
  (table) => [uniqueIndex('bank_grants_account_bank').on(table.accountId, table.bank)],
)

/**
 * Les gestes d'administration : quand, qui, sur qui, quoi.
 *
 * **Sans clé étrangère vers le compte, et c'est le point.** Toutes les tables
 * liées à un compte s'effacent en cascade avec lui ; une trace rattachée
 * disparaîtrait donc exactement au moment où l'on voudrait la relire — « qui a
 * effacé ce compte, et quand ? » est la question qui se pose six mois plus tard.
 *
 * **Rien ici ne porte un nom ni une adresse.** Seulement des identifiants
 * opaques, résolus à la lecture quand le compte existe encore. Un compte effacé
 * laisse donc une ligne qui dit toujours ce qui s'est passé, sans conserver
 * l'identité de quelqu'un qu'on vient d'effacer — c'est la raison d'être des
 * identifiants opaques.
 *
 * Elle se garde **sans limite** : quelques dizaines de lignes par an, et son
 * intérêt est justement de répondre tard.
 */
export const adminActions = sqliteTable(
  'admin_actions',
  {
    id: text('id').primaryKey(),
    /** L'administrateur qui a agi. Identifiant en clair, jamais son adresse. */
    adminId: text('admin_id').notNull(),
    /** Le compte visé. Lui aussi en clair : il peut ne plus exister. */
    targetId: text('target_id').notNull(),
    /** La nature du geste — voir `trace.ts` pour la liste. */
    action: text('action').notNull(),
    /**
     * Ce que le geste précise : le rôle donné, la banque accordée, le plafond.
     *
     * Jamais un nom de personne, jamais une adresse, jamais un nom de fichier :
     * ce serait rentrer par la fenêtre ce que la table ne garde pas par la porte.
     */
    detail: text('detail'),
    /**
     * L'instant, en **millisecondes** — et c'est la seule date de cette base qui
     * ne se compte pas en secondes.
     *
     * Les gestes d'administration arrivent en salve : donner trois rôles depuis
     * la même fiche tombe dans la même seconde, et la trace se lit « la plus
     * récente en haut ». À la seconde, cet ordre devient arbitraire.
     *
     * Écrite par le code, donc sans valeur par défaut : une insertion qui
     * l'oublierait doit échouer plutôt que d'inscrire une date en secondes qui
     * se lirait comme janvier 1970.
     */
    happenedAt: integer('happened_at').notNull(),
  },
  (table) => [index('admin_actions_target').on(table.targetId)],
)

/**
 * Ce que le serveur a appris de la vraie voiture.
 *
 * Un seul enregistrement par compte : c'est un cumul, pas une collection. Il
 * pèse quelques kilo-octets et **ne grossit pas** avec le nombre de trajets —
 * c'est ce qui permettra d'effacer les traces sans rien perdre de ce qu'elles
 * ont montré.
 */
export const measuredCars = sqliteTable('measured_cars', {
  accountId: text('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  content: text('content', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at').notNull().default(maintenant),
})

/**
 * Les relations que la bibliothèque d'identité a besoin de suivre.
 *
 * **Sans elles, une connexion par un compte tenu ailleurs est impossible.** Pour
 * savoir à qui appartient une preuve, Better Auth demande à Drizzle de joindre
 * la preuve et son compte. Cette jointure passe par `db.query`, qui ne connaît
 * que les relations déclarées ici : sans déclaration, la bibliothèque retrouve
 * la preuve mais pas son propriétaire, conclut que la preuve est **orpheline**,
 * et refuse la connexion. Le rattachement, lui, marchait — il sait déjà de quel
 * compte il parle —, ce qui rendait le défaut difficile à voir : on rattachait
 * Google, et on ne pouvait plus jamais s'en servir pour revenir.
 *
 * **Les noms ne sont pas libres, et ce ne sont pas ceux qu'on croit.** La
 * bibliothèque cherche la relation sous le **nom de la table** vers laquelle
 * elle joint — `accounts` ici, puisque c'est ainsi que s'appelle la table des
 * comptes —, et non sous le nom du modèle (`user`) de son propre vocabulaire.
 * Les renommer casserait la jointure sans rien dire, et le seul symptôme serait
 * une connexion refusée des heures plus tard.
 *
 * Il n'y a **que** le sens qui sert : d'une preuve vers son compte. Le sens
 * inverse n'est demandé nulle part, et le déclarer obligerait à nommer les deux
 * relations à la main pour que Drizzle les apparie.
 */
export const relationsDesPreuves = relations(authIdentities, ({ one }) => ({
  accounts: one(accounts, {
    fields: [authIdentities.accountId],
    references: [accounts.id],
  }),
}))

export const relationsDesSessions = relations(authSessions, ({ one }) => ({
  accounts: one(accounts, {
    fields: [authSessions.accountId],
    references: [accounts.id],
  }),
}))

/**
 * Et le sens inverse : ce qu'un compte porte comme preuves et comme sessions.
 *
 * Demandé dès qu'on cherche un compte par son adresse en voulant ses preuves —
 * ce que fait toute connexion par mot de passe.
 *
 * **Le `s` en trop n'est pas une faute de frappe.** Pour une relation « à
 * plusieurs », l'adaptateur construit le nom qu'il cherche en collant un `s` au
 * nom de la table jointe : `auth_identities` devient `auth_identitiess`. Sans ce
 * `s`, la jointure lève une erreur au premier appel — pas à la compilation, pas
 * au démarrage : à la première connexion par mot de passe. Les tests de
 * `compte.test.ts` le tiennent, et c'est bien pour cela qu'il ne faut pas
 * « corriger » ces noms en les relisant.
 */
export const relationsDesComptes = relations(accounts, ({ many }) => ({
  auth_identitiess: many(authIdentities),
  auth_sessionss: many(authSessions),
}))

