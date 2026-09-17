/**
 * Ce que la mesure de niveau a besoin de savoir du projet.
 *
 * Elle tourne sous Node et doit pourtant poser **les mêmes** gains que le moteur
 * audio du navigateur : c'est `computeMix` qui les calcule, et les recopier ici
 * reviendrait à mesurer un mixage que personne n'entend. Ce module ne fait que
 * rassembler ce qui existe déjà, pour qu'esbuild en produise un paquet que Node
 * sait charger.
 */

export { computeMix } from '../../src/core/audio/mix'
export { createFactoryProfiles } from '../../src/core/preset/defaults'
