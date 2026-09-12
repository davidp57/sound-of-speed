import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * Les frontières entre le cœur, l'interface et le serveur tiennent-elles ?
 *
 * Ce fichier ne teste pas du code du projet : il teste **le garde**. Une règle
 * qu'on n'a jamais vue refuser quoi que ce soit n'est pas un garde, c'est une
 * intention — elle peut être désactivée par mégarde, ou ne jamais s'appliquer
 * parce qu'un motif ne correspond à rien, et personne ne s'en apercevrait avant
 * que la chose qu'elle interdisait soit entrée.
 *
 * L'invariant le plus ancien du dépôt — « le cœur n'importe jamais Vue » — a
 * tenu des mois sur un `grep` qu'on lançait à la main. Il a tenu, mais rien ne
 * le tenait.
 *
 * Chaque cas écrit **exprès** l'import interdit, au chemin où il serait interdit,
 * et exige que le garde le refuse.
 */

/** Passe un bout de code à ESLint comme s'il était à ce chemin-là. */
async function analyse(chemin: string, code: string) {
  const eslint = new ESLint()
  const [resultat] = await eslint.lintText(code, { filePath: chemin })
  return resultat?.messages ?? []
}

function refuseLimport(messages: { ruleId?: string | null }[]) {
  return messages.some((m) => m.ruleId === 'no-restricted-imports')
}

describe('la frontière du cœur', () => {
  it('refuse que le cœur importe Vue', async () => {
    const messages = await analyse(
      'src/core/essai-frontiere.ts',
      "import { ref } from 'vue'\nexport const x = ref(0)\n",
    )
    expect(refuseLimport(messages)).toBe(true)
  })

  it("refuse que le cœur importe l'interface", async () => {
    const messages = await analyse(
      'src/core/preset/essai-frontiere.ts',
      "import x from '../../ui/ConfigView.vue'\nexport const y = x\n",
    )
    expect(refuseLimport(messages)).toBe(true)
  })

  it('refuse que le cœur importe le serveur', async () => {
    const messages = await analyse(
      'src/core/preset/essai-frontiere.ts',
      "import { x } from '../../server/profileur/profileur'\nexport const y = x\n",
    )
    expect(refuseLimport(messages)).toBe(true)
  })

  it('laisse le cœur importer le cœur', async () => {
    const messages = await analyse(
      'src/core/preset/essai-frontiere.ts',
      "import { x } from '../audio/mix'\nexport const y = x\n",
    )
    expect(refuseLimport(messages)).toBe(false)
  })
})

describe("la frontière de l'interface", () => {
  it("refuse qu'un écran importe le serveur", async () => {
    const messages = await analyse(
      'src/ui/essai-frontiere.ts',
      "import { x } from '../server/profileur/profileur'\nexport const y = x\n",
    )
    expect(refuseLimport(messages)).toBe(true)
  })

  it("refuse que l'assemblage de l'état importe le serveur", async () => {
    // `state.ts` est à la racine des sources et non sous `ui/` : c'est lui qui
    // assemble la chaîne et il est le plus exposé à la tentation.
    const messages = await analyse(
      'src/state.ts',
      "import { x } from './server/profileur/profileur'\nexport const y = x\n",
    )
    expect(refuseLimport(messages)).toBe(true)
  })

  it("laisse l'interface importer le cœur", async () => {
    const messages = await analyse(
      'src/ui/essai-frontiere.ts',
      "import { x } from '../core/audio/mix'\nexport const y = x\n",
    )
    expect(refuseLimport(messages)).toBe(false)
  })
})

describe('la frontière du serveur', () => {
  it('refuse que le serveur importe Vue', async () => {
    const messages = await analyse(
      'src/server/essai-frontiere.ts',
      "import { ref } from 'vue'\nexport const x = ref(0)\n",
    )
    expect(refuseLimport(messages)).toBe(true)
  })

  it('laisse le serveur importer le cœur — c’est sa raison d’être', async () => {
    // Dix mille neuf cents lignes du cœur servent aux deux côtés : le format des
    // profils, la lecture des traces, l'étalonnage. Le profileur a été écrit en
    // une journée pour cette seule raison.
    const messages = await analyse(
      'src/server/profileur/essai-frontiere.ts',
      "import { x } from '../../core/calibration/coverage'\nexport const y = x\n",
    )
    expect(refuseLimport(messages)).toBe(false)
  })
})
