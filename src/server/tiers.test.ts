/**
 * Ce qu'on vérifie ici : **ce qui n'est pas configuré n'existe pas**.
 *
 * C'est le critère du ticket, et c'est aussi la promesse faite à celui qui
 * déploie chez lui : aucune variable à inscrire, donc aucun bouton à l'écran.
 * Le reste — la moitié d'une paire, une variable déclarée sans valeur — doit
 * compter pour rien plutôt que pour un fournisseur à moitié monté.
 */

import { describe, expect, it } from 'vitest'

import { comptesTenusAilleurs, nomDuFournisseur } from './tiers'

describe('les comptes tenus ailleurs', () => {
  it('n’en monte aucun quand rien n’est configuré', () => {
    const monte = comptesTenusAilleurs({})

    expect(monte.integres).toEqual({})
    expect(monte.generiques).toEqual([])
  })

  it('ignore une variable déclarée sans valeur', () => {
    // C'est ce qu'on obtient le plus souvent dans l'écran d'une pile : la
    // variable existe, sa valeur est vide. Un identifiant vide ferait pire que
    // pas de fournisseur du tout — un bouton qui mène à une erreur.
    const monte = comptesTenusAilleurs({
      SPEED_OAUTH_GOOGLE_ID: '   ',
      SPEED_OAUTH_GOOGLE_SECRET: 'un-secret',
    })

    expect(monte.integres).toEqual({})
  })

  it('ignore un fournisseur dont il manque la moitié', () => {
    const monte = comptesTenusAilleurs({ SPEED_OAUTH_TESLA_ID: 'un-client' })

    expect(monte.generiques).toEqual([])
  })

  it('monte Google et Apple sur ce que la bibliothèque connaît déjà', () => {
    const monte = comptesTenusAilleurs({
      SPEED_OAUTH_GOOGLE_ID: 'google-client',
      SPEED_OAUTH_GOOGLE_SECRET: 'google-secret',
      SPEED_OAUTH_APPLE_ID: 'apple-client',
      SPEED_OAUTH_APPLE_SECRET: 'apple-jeton',
    })

    expect(monte.integres).toEqual({
      google: { clientId: 'google-client', clientSecret: 'google-secret', disableSignUp: true },
      apple: { clientId: 'apple-client', clientSecret: 'apple-jeton', disableSignUp: true },
    })
    expect(monte.generiques).toEqual([])
  })

  it('monte Tesla sur son document de découverte', () => {
    const monte = comptesTenusAilleurs({
      SPEED_OAUTH_TESLA_ID: 'tesla-client',
      SPEED_OAUTH_TESLA_SECRET: 'tesla-secret',
    })

    expect(monte.integres).toEqual({})
    expect(monte.generiques).toHaveLength(1)
    const tesla = monte.generiques[0]
    expect(tesla?.providerId).toBe('tesla')
    expect(tesla?.discoveryUrl).toContain('.well-known/openid-configuration')
    expect(tesla?.clientId).toBe('tesla-client')
  })

  it('interdit à un compte tenu ailleurs d’en créer un', () => {
    // Le point qui protège le plus : sans cela, « ouvrir le compte qui l'a
    // déjà » pressé depuis la voiture fabriquerait un compte neuf et vide, et
    // abandonnerait les réglages qu'on avait.
    const monte = comptesTenusAilleurs({
      SPEED_OAUTH_TESLA_ID: 'tesla-client',
      SPEED_OAUTH_TESLA_SECRET: 'tesla-secret',
      SPEED_OAUTH_GOOGLE_ID: 'google-client',
      SPEED_OAUTH_GOOGLE_SECRET: 'google-secret',
    })

    expect(monte.generiques[0]?.disableSignUp).toBe(true)
    expect(monte.integres['google']?.disableSignUp).toBe(true)
  })

  it('ne demande que de quoi savoir qui est là', () => {
    // Aucune portée qui donnerait accès aux données de la voiture chez Tesla :
    // une portée qu'on ne sert pas est une portée qu'on n'a pas à faire
    // approuver sur l'écran de consentement.
    const monte = comptesTenusAilleurs({
      SPEED_OAUTH_TESLA_ID: 'tesla-client',
      SPEED_OAUTH_TESLA_SECRET: 'tesla-secret',
    })

    expect(monte.generiques[0]?.scopes).toEqual(['openid', 'email', 'profile'])
  })
})

describe('le nom d’un fournisseur', () => {
  it('rend le nom d’affichage de ceux qu’on connaît', () => {
    expect(nomDuFournisseur('tesla')).toBe('Tesla')
    expect(nomDuFournisseur('apple')).toBe('Apple')
  })

  it('rend l’identifiant tel quel quand on ne le connaît pas', () => {
    // Un fournisseur ajouté à la bibliothèque sans passer par ici s'afficherait
    // sous son identifiant plutôt que sous « undefined ».
    expect(nomDuFournisseur('quelquun-dautre')).toBe('quelquun-dautre')
  })
})
