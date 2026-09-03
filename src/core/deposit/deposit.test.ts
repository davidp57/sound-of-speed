import { describe, expect, it, vi } from 'vitest'

import {
  authHeader,
  credentialsUrl,
  deposit,
  depositName,
  durationS,
  readCredentialsFromUrl,
} from './deposit'
import { tracesFromFile } from '../preset/store'
import type { Trace } from '../speed/replay'

/**
 * Tests du dépôt d'une trace.
 *
 * Le réseau est remplacé par une fonction : ce qui compte ici n'est pas qu'un
 * serveur réponde, c'est que **chaque échec dise lequel il est**. « Jeton
 * absent » se corrige à l'écran de configuration, « refusé » veut dire que le
 * jeton ne correspond pas, et « réseau » qu'on roule hors couverture — ce qui
 * n'est pas une erreur. Confondre les trois laisserait l'utilisateur sans rien
 * à faire de l'information.
 */

const IDENTIFIANTS = { user: 'depot', token: 'un-jeton-assez-long' }

function trace(name: string, startedAt = 1_700_000_000_000, durationMs = 12_000): Trace {
  const samples = []
  for (let ms = 0; ms <= durationMs; ms += 1000) {
    samples.push({ kmh: 50, at: startedAt + ms, accuracyM: 5, derived: false })
  }
  return { name, startedAt, samples }
}

/**
 * Faux réseau : rend ce qu'on lui dit, et retient ce qu'on lui a demandé.
 *
 * `listing` répond à la lecture du dossier, `put` à l'envoi. Par défaut le
 * dossier est vide, ce qui est le cas d'un premier dépôt.
 */
function reseau(reponses: { listing?: Response | Error; put?: Response | Error }) {
  const appels: { url: string; method: string; headers?: HeadersInit }[] = []
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    appels.push({ url: String(url), method, ...(init?.headers ? { headers: init.headers } : {}) })
    if (method === 'PUT') {
      const reponse = reponses.put
      if (reponse instanceof Error) throw reponse
      return reponse ?? new Response(null, { status: 201 })
    }
    const reponse = reponses.listing
    if (reponse instanceof Error) throw reponse
    return reponse ?? Response.json([])
  })
  return { impl: impl as unknown as typeof fetch, appels }
}

/** Liste de dossier telle que nginx la rend. */
function listeAvec(...noms: string[]): Response {
  return Response.json(noms.map((name) => ({ name, type: 'file', size: 10 })))
}

describe('depositName', () => {
  it('dit la date, le nom et la durée', () => {
    // On doit retrouver une trace sans l'ouvrir.
    const nom = depositName(trace('Retour du boulot'))

    expect(nom).toContain('2023-11-14')
    expect(nom).toContain('retour-du-boulot')
    expect(nom).toContain('12s')
    expect(nom.endsWith('.json')).toBe(true)
  })

  it('ne garde que des caractères sûrs', () => {
    // Le nom voyage dans une adresse et atterrit sur un système de fichiers.
    const nom = depositName(trace('Été : A7 / 130 km/h *test*'))

    expect(nom).toMatch(/^[a-zA-Z0-9._-]+$/)
  })

  it('tient sur une trace sans nom ni échantillon', () => {
    const nom = depositName({ name: '', startedAt: 1_700_000_000_000, samples: [] })

    expect(nom).toContain('trace')
    expect(nom).toContain('0s')
  })

  it('mesure la durée sur les horodatages, non sur le nombre de mesures', () => {
    // Une trace enregistrée à trente millisecondes et une à une seconde n'ont
    // pas le même nombre d'échantillons pour la même durée.
    expect(durationS(trace('x', 1_700_000_000_000, 90_000))).toBeCloseTo(90, 1)
  })
})

describe('authHeader', () => {
  it('encode le couple nom et jeton', () => {
    expect(authHeader({ user: 'depot', token: 'secret' })).toBe(`Basic ${btoa('depot:secret')}`)
  })

  it('accepte un jeton accentué', () => {
    // `btoa` seul échouerait, et l'échec ressemblerait à un refus du serveur.
    expect(() => authHeader({ user: 'dépôt', token: 'clé-é' })).not.toThrow()
  })
})

describe('deposit', () => {
  it('dépose et rend le nom du fichier', async () => {
    const { impl, appels } = reseau({ put: new Response(null, { status: 201 }) })

    const issue = await deposit(trace('essai'), IDENTIFIANTS, impl)

    expect(issue.ok).toBe(true)
    const envoi = appels.find((appel) => appel.method === 'PUT')
    expect(envoi?.url).toContain('/traces/')
    expect(envoi?.headers).toMatchObject({ Authorization: authHeader(IDENTIFIANTS) })
  })

  it('dépose un fichier que l import sait relire', async () => {
    let corps = ''
    const impl = (async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') corps = String(init.body)
      return new Response(null, { status: init?.method === 'PUT' ? 201 : 404 })
    }) as unknown as typeof fetch

    await deposit(trace('aller-retour'), IDENTIFIANTS, impl)
    const relues = tracesFromFile(corps)

    expect(relues).toHaveLength(1)
    expect(relues[0]?.name).toBe('aller-retour')
    expect(relues[0]?.samples.length).toBe(13)
  })

  it('refuse de partir sans jeton, et le dit', async () => {
    const { impl, appels } = reseau({ put: new Response(null, { status: 201 }) })

    const issue = await deposit(trace('essai'), { user: 'depot', token: '' }, impl)

    expect(issue).toMatchObject({ ok: false, reason: 'no-credentials' })
    // Et surtout : rien n'est parti sur le réseau.
    expect(appels).toHaveLength(0)
  })

  it('distingue un jeton refusé d un droit d écriture manquant', async () => {
    const refus = await deposit(
      trace('essai'),
      IDENTIFIANTS,
      reseau({ put: new Response(null, { status: 401 }) }).impl,
    )
    const interdit = await deposit(
      trace('essai'),
      IDENTIFIANTS,
      reseau({ put: new Response(null, { status: 403 }) }).impl,
    )

    expect(refus).toMatchObject({ ok: false, reason: 'refused' })
    expect((refus as { detail: string }).detail).toContain('jeton')
    expect(interdit).toMatchObject({ ok: false, reason: 'refused' })
    expect((interdit as { detail: string }).detail).toContain('droit')
  })

  it('ne réécrit pas une trace déjà déposée', async () => {
    const deja = depositName(trace('essai'))
    const { impl, appels } = reseau({ listing: listeAvec(deja) })

    const issue = await deposit(trace('essai'), IDENTIFIANTS, impl)

    expect(issue).toMatchObject({ ok: false, reason: 'exists' })
    expect(appels.some((appel) => appel.method === 'PUT')).toBe(false)
  })

  it('dépose quand le dossier contient d autres traces', async () => {
    const { impl } = reseau({ listing: listeAvec('une-autre.json', 'et-encore.json') })

    expect((await deposit(trace('essai'), IDENTIFIANTS, impl)).ok).toBe(true)
  })

  it('ne se fie pas à un serveur qui répond oui à tout', async () => {
    // Le faux positif rencontré à l'usage : le serveur de développement replie
    // les chemins inconnus sur la page d'accueil, donc il répond 200 avec du
    // HTML. Le premier dépôt était refusé comme déjà fait.
    const { impl, appels } = reseau({
      listing: new Response('<!doctype html><html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    })

    const issue = await deposit(trace('essai'), IDENTIFIANTS, impl)

    expect(issue.ok).toBe(true)
    expect(appels.some((appel) => appel.method === 'PUT')).toBe(true)
  })

  it('tente le dépôt quand la vérification d existence échoue', async () => {
    // Une vérification qui échoue ne condamne pas le dépôt : c'est l'envoi qui
    // dira ce qui ne va pas.
    const { impl, appels } = reseau({ listing: new Error('coupure') })

    const issue = await deposit(trace('essai'), IDENTIFIANTS, impl)

    expect(issue.ok).toBe(true)
    expect(appels.some((appel) => appel.method === 'PUT')).toBe(true)
  })

  it('dit qu on est hors couverture plutôt que d accuser le jeton', async () => {
    // Le cas normal en roulant : la trace reste locale, et l'on ne va pas
    // envoyer l'utilisateur vérifier un jeton qui est bon.
    const issue = await deposit(
      trace('essai'),
      IDENTIFIANTS,
      reseau({ put: new Error('Failed to fetch') }).impl,
    )

    expect(issue).toMatchObject({ ok: false, reason: 'network' })
    expect((issue as { detail: string }).detail).toContain('Failed to fetch')
  })

  it('rend le code du serveur quand il répond autre chose', async () => {
    const issue = await deposit(
      trace('essai'),
      IDENTIFIANTS,
      reseau({ put: new Response(null, { status: 405 }) }).impl,
    )

    expect(issue).toMatchObject({ ok: false, reason: 'network' })
    expect((issue as { detail: string }).detail).toContain('405')
  })
})

describe('jeton reçu par l adresse', () => {
  const oublie = () => {}

  it('lit le nom et le jeton', () => {
    // Réglé au poste, le jeton n'est nulle part dans la voiture : il y arrive
    // par l'adresse, comme un profil partagé.
    expect(readCredentialsFromUrl('#depot=depot:route-moteur-tesla', oublie)).toEqual({
      user: 'depot',
      token: 'route-moteur-tesla',
    })
  })

  it('efface le fragment même quand il est illisible', () => {
    // Sans quoi il resterait dans la barre d'adresse et se réinstallerait à
    // chaque rechargement.
    let efface = 0
    readCredentialsFromUrl('#depot=sansdeuxpoints', () => { efface += 1 })

    expect(efface).toBe(1)
  })

  it('accepte un jeton qui contient des deux-points', () => {
    // Seul le premier sépare : un jeton n'a pas à s'interdire un caractère.
    expect(readCredentialsFromUrl('#depot=depot:a:b:c', oublie)?.token).toBe('a:b:c')
  })

  it('accepte un jeton encodé', () => {
    const url = credentialsUrl('https://exemple', { user: 'depot', token: 'clé à moi' })

    expect(readCredentialsFromUrl(url.slice(url.indexOf('#')), oublie)).toEqual({
      user: 'depot',
      token: 'clé à moi',
    })
  })

  it('ne trouve rien quand il n y a rien', () => {
    expect(readCredentialsFromUrl('', oublie)).toBeNull()
    expect(readCredentialsFromUrl('#p=unprofil', oublie)).toBeNull()
  })

  it('refuse une forme incomplète plutôt que de retenir un jeton vide', () => {
    expect(readCredentialsFromUrl('#depot=depot:', oublie)).toBeNull()
    expect(readCredentialsFromUrl('#depot=:jeton', oublie)).toBeNull()
  })

  it('cohabite avec un profil partagé dans la même adresse', () => {
    expect(readCredentialsFromUrl('#p=abc&depot=depot:mon-jeton', oublie)?.user).toBe('depot')
  })
})
