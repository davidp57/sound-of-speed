/**
 * La bibliothèque de moteurs, lue depuis le TypeScript de l'application.
 *
 * Un moteur est un tableau de vingt-neuf nombres — `native/CONTRAT-MOTEUR.md` —
 * et la liste de ceux qu'on sait construire vit dans `core/preset/`, où l'écran
 * de synthèse la prend aussi. Le banc hors ligne la lit **là**, et non dans une
 * copie : la copie d'avant vivait dans `native/engines.h`, avec la géométrie
 * écrite en dur, et c'est elle qui empêchait de produire une banque du GM à
 * collecteur long — le moteur que David avait réglé à l'oreille n'existait que
 * d'un côté.
 *
 * Le chargement passe par esbuild, déjà la dépendance qui construit le serveur :
 * il assemble les modules TypeScript en mémoire, et l'import se fait sur le
 * résultat sans écrire de fichier.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as esbuild from 'esbuild'

const HERE = dirname(fileURLToPath(import.meta.url))
const PRESET_DIR = resolve(HERE, '..', '..', 'src', 'core', 'preset')

/** Ce qu'on va chercher dans l'application, et rien d'autre. */
const POINT_ENTREE = `
export { ENGINE_LIBRARY } from './engine-library.ts'
export { engineDefinitionValues, clampEngineDefinition } from './engine-definition.ts'
export { ENGINE_FIELDS } from './schema.ts'
`

let cache = null

async function charger() {
  if (cache !== null) return cache
  const bundle = await esbuild.build({
    stdin: { contents: POINT_ENTREE, resolveDir: PRESET_DIR, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
  })
  const code = bundle.outputFiles[0].text
  cache = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  return cache
}

/** Les identifiants proposables, pour le message d'erreur comme pour la doc. */
export async function listerMoteurs() {
  const { ENGINE_LIBRARY } = await charger()
  return ENGINE_LIBRARY.map((moteur) => ({
    id: moteur.id,
    label: moteur.label,
    cylinders: moteur.definition.cylinders,
    redlineRpm: moteur.redlineRpm,
  }))
}

/**
 * Le moteur d'une définition de banque, prêt pour le banc.
 *
 * Rend les vingt-neuf nombres **dans l'ordre du contrat**, et la même chose sous
 * forme nommée : c'est celle-là que le profil produit emporte, pour que la
 * banque se rejoue en direct sur le moteur qui l'a faite.
 *
 * Le rupteur ne vient pas de la bibliothèque mais du profil, comme partout
 * ailleurs : la définition de banque le donne, sinon c'est celui du moteur.
 */
export async function resoudreMoteur(definition) {
  const { ENGINE_LIBRARY, engineDefinitionValues, clampEngineDefinition, ENGINE_FIELDS } =
    await charger()

  const id = definition.engine
  const moteur = ENGINE_LIBRARY.find((m) => m.id === id)
  if (moteur === undefined) {
    const connus = ENGINE_LIBRARY.map((m) => `  ${m.id.padEnd(24)} ${m.label}`).join('\n')
    throw new Error(
      `moteur inconnu : ${id === undefined ? '(aucun)' : id}\n` +
        `La définition de banque nomme un moteur de la bibliothèque :\n${connus}`,
    )
  }

  const redlineRpm = definition.redlineRpm ?? moteur.redlineRpm
  const borne = clampEngineDefinition(moteur.definition)
  const valeurs = engineDefinitionValues(moteur.definition, redlineRpm)

  return {
    id: moteur.id,
    label: moteur.label,
    redlineRpm,
    cylinders: borne.cylinders,
    /** Les vingt-neuf nombres, dans l'ordre du contrat. */
    valeurs,
    /** Les mêmes, nommés — la forme que porte le profil. */
    nommees: Object.fromEntries(ENGINE_FIELDS.map((champ, i) => [champ.key, valeurs[i]])),
    champs: ENGINE_FIELDS.map((champ) => champ.key),
  }
}

/**
 * Le fichier que le banc relit : un nombre par ligne, le nom en commentaire.
 *
 * Le nom ne sert qu'à la relecture humaine — le C++ lit le nombre et ignore la
 * suite de la ligne. C'est l'ordre qui fait le contrat, jamais les noms.
 */
export function fichierMoteur(moteur) {
  const lignes = [
    `# ${moteur.label} (${moteur.id}) — les ${moteur.valeurs.length} nombres du contrat,`,
    '# dans l’ordre de native/CONTRAT-MOTEUR.md. Le banc lit le nombre, le nom est',
    '# là pour qui relit.',
  ]
  for (let i = 0; i < moteur.valeurs.length; i += 1) {
    lignes.push(`${String(moteur.valeurs[i]).padEnd(12)} # ${moteur.champs[i]}`)
  }
  return `${lignes.join('\n')}\n`
}

/** `node scripts/generate-bank/moteur.mjs` liste ce qu'on sait construire. */
if (resolve(process.argv[1] ?? '') === resolve(fileURLToPath(import.meta.url))) {
  const moteurs = await listerMoteurs()
  console.log('Les moteurs qu’une définition de banque peut nommer :\n')
  for (const m of moteurs) {
    console.log(
      `  ${m.id.padEnd(24)} ${m.label.padEnd(44)} ${m.cylinders} cyl.  ${m.redlineRpm} tr/min`,
    )
  }
}
