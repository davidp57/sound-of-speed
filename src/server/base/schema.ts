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

import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
    /** Rattachée plus tard, ou jamais : celui qui déploie chez lui n'en donne pas. */
    email: text('email'),
    createdAt: integer('created_at').notNull().default(maintenant),
  },
  (table) => [uniqueIndex('accounts_email').on(table.email)],
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
 * `pinned` existe avant la règle de rétention qui lui donnera son sens : une
 * trace épinglée échappe à l'effacement. Les traces reprises d'un ancien serveur
 * entreront épinglées, sans quoi la reprise les perdrait un mois plus tard.
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
    /** Les octets, tels qu'ils sont arrivés — compressés s'ils l'étaient. */
    content: text('content').notNull(),
    bytes: integer('bytes').notNull(),
    depositedAt: integer('deposited_at').notNull().default(maintenant),
    /** Exempté de l'effacement. Voir le lot RETENTION. */
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  },
  (table) => [
    // Déposer deux fois le même nom remplace, comme le faisait le dépôt de
    // fichiers : c'est ce que la voiture attend quand elle rejoue un envoi.
    uniqueIndex('deposits_folder_name').on(table.accountId, table.folder, table.name),
    index('deposits_folder').on(table.accountId, table.folder),
  ],
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
