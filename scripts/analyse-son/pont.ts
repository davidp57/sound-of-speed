/**
 * Ce que le banc d'analyse a besoin de savoir du projet.
 *
 * Il tourne sous Node, hors du navigateur, et doit pourtant décrire **le même**
 * moteur et le **même** rendu que ce qui sort des haut-parleurs. Recopier ces
 * valeurs dans un fichier à part les ferait diverger au premier réglage : on
 * mesurerait alors soigneusement un son que personne n'écoute.
 *
 * Ce module ne fait donc que rassembler ce qui existe déjà, pour qu'esbuild en
 * produise un paquet que Node sait charger.
 */

export { ENGINE_LIBRARY, libraryEngine } from '../../src/core/preset/engine-library'
export { engineDefinitionValues } from '../../src/core/preset/engine-definition'
export { DEFAULT_RENDERING, exhaustResponseFile } from '../../src/core/synth/rendering'
export { DEFAULT_SYNTH } from '../../src/core/synth/settings'
