import type { Profile } from '../preset/schema'
import type { SynthRendering } from './rendering'

/**
 * De quoi refabriquer, au bureau, la banque du son qu'on vient d'entendre.
 *
 * **Ce n'est pas le serveur qui fabrique, et c'est une décision.** La chaîne
 * lance un binaire natif compilé sur le poste ; le serveur est une image Linux
 * ARM64 sur un NAS qui sert déjà l'application, les échantillons et la base. Une
 * compilation croisée rouvrirait le chantier que le lot IMAGE-ARM64 a fermé — et
 * ce qui l'avait sauvé, c'est que npm sait installer pour une autre
 * architecture, ce qu'un binaire C++ ne sait pas faire.
 *
 * **La friction n'est pas de taper une commande, c'est de retrouver les
 * paramètres** après avoir réglé à l'oreille. C'est elle que ce module
 * supprime : il rend la définition telle qu'elle doit être enregistrée, et la
 * ligne qui la consomme.
 *
 * Il ne parle ni au réseau ni au disque : ce qu'il produit se copie.
 */

/** Dossier où la chaîne va chercher les définitions. */
export const DOSSIER_DEFINITIONS = 'scripts/generate-bank/engines'

/**
 * Les réglages de prise, tels que la chaîne les attend.
 *
 * Ils ne se règlent pas au banc — celui-ci fait entendre un timbre, pas une
 * campagne d'enregistrement — et reprennent donc les valeurs des définitions
 * livrées. Les changer se fait dans le fichier, une fois enregistré.
 */
export const PRISE_PAR_DEFAUT = {
  spacingOctaves: 0.5,
  takeSeconds: 3.0,
  settleSeconds: 5.0,
  idleThrottle: 0.08,
  reliefCompression: 0.35,
  witnesses: true,
} as const

export interface DefinitionDeBanque {
  name: string
  sampleDir: string
  engine: string
  idleRpm: number
  redlineRpm: number
  simulationHz: number
  impulseSamples: number
  exhaustResponse: string
  bank: Record<string, number | boolean>
}

/**
 * La définition à enregistrer, tirée du profil et du rendu qu'on écoute.
 *
 * `engine` désigne le fichier de moteur d'engine-sim, pas des cotes : le banc
 * paramètre la prise, il ne fabrique pas un moteur. Il reprend donc la banque du
 * profil, qui porte déjà ce nom.
 *
 * **`limiterRpm` n'est pas le rupteur**, et c'est le piège de cette pièce. Le
 * rupteur est le plafond du moteur *joué* ; le limiteur est le régime auquel la
 * prise a été *enregistrée*, plus haut. Sur la banque du V8 livrée, l'un vaut
 * 6 500 et l'autre 6 950 — l'écart se lit dans le profil, dont la couche du
 * rupteur porte l'ancrage 6 950.
 *
 * Il se prend donc sur cette couche, et retombe sur le rupteur quand il n'y en a
 * pas. Le déduire du rupteur donnerait une banque qui s'arrête plus bas que
 * celle qu'on écoute.
 */
export function definitionDeBanque(
  profile: Profile,
  rendering: SynthRendering,
  simulationHz = 10_000,
  impulseSamples = 10_000,
): DefinitionDeBanque {
  return {
    name: profile.name,
    sampleDir: profile.sampleDir,
    engine: profile.sampleDir,
    idleRpm: Math.round(profile.engine.idleRpm),
    redlineRpm: Math.round(profile.engine.redlineRpm),
    simulationHz,
    impulseSamples,
    exhaustResponse: rendering.exhaustResponse,
    bank: {
      ...PRISE_PAR_DEFAUT,
      limiterRpm: regimeDuLimiteur(profile),
    },
  }
}

/** L'ancrage de la couche du rupteur, ou le rupteur à défaut. */
export function regimeDuLimiteur(profile: Profile): number {
  const couche = profile.layers.find((entry) => entry.role === 'limiter')
  return Math.round(couche?.anchorRpm ?? profile.engine.redlineRpm)
}

/**
 * Le nom du fichier de définition, tiré de la banque.
 *
 * La banque, et non le nom du profil : c'est elle qui nomme le dossier produit,
 * et deux fichiers qui fabriquent le même dossier sous deux noms différents se
 * contrediraient un jour.
 */
export function nomDeDefinition(profile: Profile): string {
  return `${slug(profile.sampleDir || profile.name)}.json`
}

export function cheminDeDefinition(profile: Profile): string {
  return `${DOSSIER_DEFINITIONS}/${nomDeDefinition(profile)}`
}

/**
 * La ligne à coller, dans son état exact.
 *
 * Deux commandes et non une : le binaire se compile avant de servir, et
 * l'oublier donne une erreur qui ne dit pas ce qui manque. Elles sont séparées
 * par un saut de ligne plutôt que par un `&&`, qui ne s'écrit pas pareil selon
 * le terminal — et se coller l'une après l'autre ne coûte rien.
 */
export function commandeDeFabrication(profile: Profile): string {
  return ['bash native/build-generator.sh', `node scripts/generate-bank/generate.mjs ${cheminDeDefinition(profile)}`].join(
    '\n',
  )
}

/** La définition, mise en forme comme les fichiers du dépôt. */
export function definitionEnTexte(
  profile: Profile,
  rendering: SynthRendering,
): string {
  return `${JSON.stringify(definitionDeBanque(profile, rendering), null, 2)}\n`
}

function slug(nom: string): string {
  return (
    nom
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'moteur'
  )
}
