/**
 * Ce qu'on vérifie ici : la bibliothèque retrouve le compte qu'une preuve
 * désigne.
 *
 * **C'est la question dont dépend toute connexion par un compte tenu ailleurs.**
 * Au retour du fournisseur, Better Auth cherche à qui appartient la preuve qu'on
 * vient de lui présenter. Si elle ne trouve pas le propriétaire, elle conclut
 * que la preuve est orpheline et refuse — en laissant croire, à l'écran, que ce
 * fournisseur n'a jamais été rattaché.
 *
 * Cette recherche passe par une **jointure**, et une jointure suppose deux
 * choses que ce dépôt doit fournir : des relations déclarées dans le schéma
 * Drizzle, et l'option qui demande les jointures natives. Sans l'une ou l'autre,
 * tout le reste marche — le rattachement compris — et seule la connexion casse,
 * des heures plus tard, sur un compte qu'on ne peut plus rouvrir.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ouvrirBase, type Base } from './base/base'
import { authIdentities } from './base/schema'
import { creerIdentite, type Identite } from './identite'
import { creerServeur } from './serveur'

const MIGRATIONS = 'src/server/base/migrations'
const SECRET = 'Zk7pQ2vX9mL4tR8wY1nB6jH3sD5gF0aC-essai-proprietaire'

let dossier: string
let base: Base
let identite: Identite
let aFermer: () => void

beforeEach(async () => {
  dossier = mkdtempSync(join(tmpdir(), 'proprietaire-'))
  const ouverte = await ouvrirBase({ fichier: join(dossier, 'speed.db'), migrations: MIGRATIONS })
  base = ouverte.base
  aFermer = ouverte.fermer
  identite = creerIdentite({ base, secret: SECRET, adresse: 'http://essai' })
})

afterEach(() => {
  aFermer()
  try {
    rmSync(dossier, { recursive: true, force: true })
  } catch {
    // Windows garde un instant la main sur le fichier.
  }
})

/** Un appareil qui se présente, et le compte qu'il reçoit. */
async function unCompte(): Promise<string> {
  const reponse = await creerServeur({ application: dossier, base, identite }).request(
    '/api/auth/sign-in/anonymous',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  )
  const dit = (await reponse.json()) as { user: { id: string } }
  return dit.user.id
}

describe('à qui appartient une preuve', () => {
  it('retrouve le compte qu’un compte tenu ailleurs désigne', async () => {
    const compte = await unCompte()

    // La preuve telle que le rattachement la range : c'est exactement la forme
    // trouvée dans la base de production le 13 septembre 2026.
    await base.insert(authIdentities).values({
      id: 'preuve-1',
      accountId: compte,
      providerId: 'google',
      providerAccountId: '100854269051837852897',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const contexte = await identite.$context
    const trouve = await contexte.internalAdapter.findAccountOwnerByKey({
      providerId: 'google',
      accountId: '100854269051837852897',
    })

    // `orphaned` est le résultat qui a cassé la connexion par Google : la preuve
    // était trouvée, son compte non.
    expect(trouve?.kind).toBe('owned')
    expect(trouve?.kind === 'owned' ? trouve.user.id : null).toBe(compte)
  })

  it('ne trouve rien pour une preuve que personne n’a rattachée', async () => {
    await unCompte()

    const contexte = await identite.$context
    expect(
      await contexte.internalAdapter.findAccountOwnerByKey({
        providerId: 'google',
        accountId: 'jamais-rattache',
      }),
    ).toBeNull()
  })
})
