// Prepare les sources C++ d'engine-sim, a revision fixe, avec nos correctifs
// de portabilite. Rien de tout cela n'est versionne dans Speed : le depot ne
// garde que les patchs, pas les 11 000 lignes qu'ils modifient.
//
// Relancer le script est sans danger : il remet les deux depots a leur
// revision epinglee (`git reset --hard`) avant de reappliquer les patchs. Toute
// modification faite a la main dans .work/ est donc perdue — c'est voulu, le
// dossier est un plan de travail jetable.
//
// Usage : node native/prepare.mjs

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORK = join(HERE, '.work')
const PATCHES = join(HERE, 'patches')

// Revisions figees. engine-sim n'a plus de publication depuis janvier 2023 et
// le projet est passe en source fermee ; suivre `master` n'apporterait rien et
// rendrait la mesure de la sonde incomparable d'une semaine a l'autre. Nos
// patchs sont ecrits contre ces deux revisions exactement.
const SOURCES = [
  {
    name: 'engine-sim',
    url: 'https://github.com/ange-yaghi/engine-sim.git',
    // master au 22/01/2023, dernier commit du depot
    revision: '85f7c3b959a908ed5232ede4f1a4ac7eafe6b630',
    path: join(WORK, 'engine-sim'),
  },
  {
    name: 'simple-2d-constraint-solver',
    url: 'https://github.com/ange-yaghi/simple-2d-constraint-solver.git',
    // la revision que le sous-module d'engine-sim pointe a la revision ci-dessus
    revision: 'e009f4ff1c9c4c5874e865e893cdb62e208fb2b3',
    path: join(WORK, 'engine-sim', 'dependencies', 'submodules', 'simple-2d-constraint-solver'),
  },
]

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function hasCommit(repo, revision) {
  try {
    git(repo, 'cat-file', '-e', `${revision}^{commit}`)
    return true
  } catch {
    return false
  }
}

function fetchAt(source) {
  // On teste le .git, pas le dossier : git cree un dossier vide pour le
  // sous-module, et une commande git lancee dedans remonterait au depot parent.
  if (!existsSync(join(source.path, '.git'))) {
    console.log(`clonage de ${source.name}`)
    mkdirSync(dirname(source.path), { recursive: true })
    git(WORK, 'clone', '--quiet', source.url, source.path)
  }
  if (!hasCommit(source.path, source.revision)) {
    console.log(`recuperation de ${source.revision.slice(0, 8)} pour ${source.name}`)
    git(source.path, 'fetch', '--quiet', 'origin', source.revision)
  }
  git(source.path, 'reset', '--quiet', '--hard', source.revision)
  console.log(`${source.name} : ${source.revision.slice(0, 8)}`)
}

function applyPatches(source) {
  const dir = join(PATCHES, source.name)
  if (!existsSync(dir)) return
  const patches = readdirSync(dir).filter((f) => f.endsWith('.patch')).sort()
  for (const patch of patches) {
    git(source.path, 'apply', '--whitespace=nowarn', join(dir, patch))
    console.log(`  applique ${patch}`)
  }
}

mkdirSync(WORK, { recursive: true })
for (const source of SOURCES) {
  fetchAt(source)
}
// Les patchs viennent apres les deux `reset --hard` : celui du depot parent
// n'ecrase pas le sous-module, mais l'ordre reste plus lisible ainsi.
for (const source of SOURCES) {
  applyPatches(source)
}

console.log('\nSources pretes dans native/.work/. Compilation : bash native/build-native.sh')
