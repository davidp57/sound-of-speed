import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Ce que le serveur importe doit être installable dans son image.
 *
 * L'image n'installe que les dépendances de **production** : une pièce rangée
 * parmi celles de développement y manquera, et le serveur mourra au démarrage
 * sur un module introuvable. C'est arrivé le 12 septembre 2026 avec la
 * bibliothèque qui vérifie les mots de passe — elle était là pour un script
 * d'outillage, et le serveur s'est mis à en dépendre sans qu'elle change de
 * place.
 *
 * Le contrôle qui l'a trouvé construit l'image et la lance, ce qui prend trois
 * minutes. Celui-ci dit la même chose en une seconde, et sans Docker : il lit ce
 * que le paquet assemblé importe vraiment.
 */
describe('les dépendances du serveur', () => {
  it('sont toutes déclarées en production', () => {
    execFileSync('npm', ['run', 'build:serveur'], { stdio: 'ignore', shell: true })

    const assemble = readFileSync('dist-serveur/serveur.js', 'utf8')
    const manifeste = JSON.parse(readFileSync('package.json', 'utf8')) as {
      dependencies: Record<string, string>
    }

    // Les imports que l'assemblage a laissés dehors : tout le reste est déjà
    // dans le fichier.
    const importes = new Set(
      [...assemble.matchAll(/^import .*? from "([^"]+)"/gm)]
        .map((trouve) => trouve[1] ?? '')
        .filter((nom) => !nom.startsWith('node:'))
        // « drizzle-orm/libsql » est servi par le paquet « drizzle-orm ».
        .map((nom) => (nom.startsWith('@') ? nom.split('/').slice(0, 2).join('/') : nom.split('/')[0] ?? '')),
    )

    expect(importes.size).toBeGreaterThan(0)
    for (const paquet of importes) {
      expect(manifeste.dependencies, `${paquet} doit être une dépendance de production`).toHaveProperty(
        paquet,
      )
    }
  }, 60_000)
})
