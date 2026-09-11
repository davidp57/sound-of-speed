import { Engine, type EngineState } from '../engine/engine'
import { Gearbox, type GearboxState } from '../drivetrain/gearbox'
import { driveModeFromUpshiftRpm, isDriveMode, type DriveMode } from '../drivetrain/drive-mode'
import { stateAt, type Session, type StatePoint } from './model'
import type { Profile } from '../preset/schema'

/**
 * Rejouer une session enregistrée à travers la chaîne, pour l'entendre.
 *
 * Le relecteur montrait un trajet sans le faire entendre depuis que le panneau
 * des traces a été retiré ; c'est pourtant l'outil de mise au point le plus
 * utile du projet — un trajet réel, écouté au bureau, autant de fois qu'on veut.
 *
 * **Ce qui est rejoué, et ce qui ne l'est pas.** La capture porte à la fois
 * l'entrée brute du GPS et la sortie de chaque étage. On repart de la vitesse
 * **conditionnée** — celle que la capture inscrit sous `out` — et on recalcule
 * le moteur, la boîte et le mixage. Le conditionnement, lui, n'est pas rejoué :
 * il dépend de l'instant où chaque mesure GPS arrive, et rien de tout cela ne
 * survit à un déplacement dans la timeline ni à une lecture au double de la
 * vitesse. Sa sortie est donc reprise telle qu'elle a été calculée ce jour-là.
 *
 * **La configuration est celle de l'en-tête**, jamais celle du profil actif du
 * moment : on écouterait sinon autre chose que ce qui a été vécu. Et le profil
 * d'une capture n'est pas repris au format courant, pour la même raison — une
 * capture du 11 septembre 2026 se rejoue avec ses six rapports.
 *
 * La chaîne a un état — régime lissé, rapport engagé, temporisations. Après un
 * saut, elle met environ une seconde à se rétablir. Ce n'est pas un défaut à
 * corriger, c'est un comportement à annoncer.
 */

/** Ce que la chaîne recalcule, et ce que la capture en disait. */
export interface PlaybackFrame {
  engine: EngineState
  gearbox: GearboxState
  /** La vitesse conditionnée lue dans la session, en km/h. */
  kmh: number
  /**
   * Ce que la capture portait au même instant, quand elle le portait.
   *
   * Le rapport y est ramené à la **numérotation de la boîte**, qui compte à
   * partir de zéro. Les fichiers, eux, l'écrivent comme on le lit au tableau de
   * bord — la première est `1` —, et comparer les deux sans conversion donnait
   * un écart d'un rapport à chaque image, partout, y compris là où la boîte
   * décidait exactement pareil.
   */
  recorded: { rpm: number; gear: number; load: number } | null
}

/**
 * L'écart entre ce qui a été enregistré et ce qu'on recalcule aujourd'hui.
 *
 * C'est la vérification que rien d'autre ne donne : une régression de la boîte
 * ou du moteur se voit ici, sur un trajet réel, sans avoir à reprendre la route.
 */
export interface PlaybackDrift {
  rpm: number
  gear: number
}

export class SessionPlayback {
  private engine: Engine
  private gearbox: Gearbox
  private load = 0
  private mode: DriveMode
  /** Les bascules Route/Sport de la session, dans l'ordre. */
  private readonly modes: { at: number; mode: DriveMode }[]

  constructor(
    private readonly profile: Profile,
    private readonly session: Session,
  ) {
    this.modes = modeChanges(session)
    // Faute de bascule inscrite, le tempérament se déduit du profil — ce que
    // l'application fait au chargement. Un rejeu qui l'oublierait ferait
    // conduire Route comme Sport.
    this.mode =
      this.modes[0]?.mode ??
      driveModeFromUpshiftRpm(profile.drivetrain.upshiftRpm, profile.engine.redlineRpm)
    this.engine = new Engine(profile.engine, profile.mix)
    this.gearbox = new Gearbox(profile.drivetrain, profile.engine, profile.feel, this.mode)
  }

  /**
   * Repositionne la lecture.
   *
   * La chaîne repart de son état de repos plutôt que de celui qu'elle avait
   * ailleurs dans le trajet : garder un régime et un rapport venus d'une autre
   * minute donnerait un son faux pendant plusieurs secondes, et une boîte qui
   * rattrape son retard par une cascade de passages qui n'ont pas eu lieu.
   */
  seek(atMs: number): void {
    this.mode = this.modeAt(atMs)
    this.engine = new Engine(this.profile.engine, this.profile.mix)
    this.gearbox = new Gearbox(
      this.profile.drivetrain,
      this.profile.engine,
      this.profile.feel,
      this.mode,
    )
    this.load = 0

    // Le rapport qui convient à la vitesse d'arrivée, sans passer par la
    // séquence : sans cela, un saut à 130 km/h démarrerait en première.
    const point = this.read(atMs)
    if (point) this.gearbox.settleFor((gear) => this.rpmInGear(gear, point.kmh))
  }

  /** Avance d'un pas, la lecture étant rendue à `atMs`. */
  tick(dt: number, atMs: number): PlaybackFrame | null {
    const point = this.read(atMs)
    if (point === null) return null

    // Le tempérament se change au volant, et un trajet en porte souvent deux —
    // celui du 11 septembre 2026 est passé en Sport à la vingt-deuxième minute.
    // Le rejouer d'un bout à l'autre dans le mode du départ ferait entendre une
    // conduite qui n'a pas eu lieu.
    const mode = this.modeAt(atMs)
    if (mode !== this.mode) {
      this.mode = mode
      this.gearbox.setDriveMode(mode)
    }

    const kmh = Math.max(0, point.kmh)
    const atStandstill = kmh < 0.5

    const gearbox = this.gearbox.tick(dt, {
      rpmInGear: (gear) => this.rpmInGear(gear, kmh),
      atStandstill,
      load: this.load,
      kmh,
      accelMs2: point.accelMs2,
    })

    const jolt = this.profile.feel.shiftJolt
    const engine = this.engine.tick(dt, {
      kmh,
      accelMs2: point.accelMs2,
      totalRatio: gearbox.ratio * this.profile.drivetrain.finalDrive,
      wheelRadiusM: this.profile.drivetrain.wheelRadiusM,
      atStandstill,
      isShifting: gearbox.isShifting,
      shiftProgress: gearbox.shiftProgress,
      shiftDipRpm: jolt.enabled ? jolt.dipRpm : 0,
      shiftBlipRpm: jolt.enabled ? jolt.blipRpm : 0,
      // La pédale n'existe pas dans une capture : la charge se déduit de
      // l'accélération, exactement comme elle l'a fait dans la voiture.
      throttle: null,
    })
    this.load = engine.load

    return {
      engine,
      gearbox,
      kmh,
      recorded: { rpm: point.rpm, gear: point.gear - 1, load: point.load },
    }
  }

  /** L'écart entre le recalculé et l'enregistré, quand il y a de quoi comparer. */
  static drift(frame: PlaybackFrame): PlaybackDrift | null {
    if (frame.recorded === null) return null
    return {
      rpm: frame.engine.rpm - frame.recorded.rpm,
      gear: frame.gearbox.gear - frame.recorded.gear,
    }
  }

  /** Le tempérament en vigueur à cet instant du trajet. */
  private modeAt(atMs: number): DriveMode {
    let mode = this.mode
    for (const change of this.modes) {
      if (change.at > atMs) break
      mode = change.mode
    }
    return mode
  }

  private read(atMs: number): StatePoint | null {
    return stateAt(this.session.states, atMs)?.value ?? null
  }

  private rpmInGear(gear: number, kmh: number): number {
    const { gearRatios, finalDrive, wheelRadiusM } = this.profile.drivetrain
    return Engine.kinematicRpm(kmh, (gearRatios[gear] ?? 1) * finalDrive, wheelRadiusM)
  }
}

/**
 * Les bascules Route/Sport inscrites dans la session.
 *
 * Le journal écrit un événement `profile` au démarrage et à chaque changement.
 * Une session qui n'a que sa capture n'en a pas, et le tempérament se déduit
 * alors du profil de l'en-tête.
 */
function modeChanges(session: Session): { at: number; mode: DriveMode }[] {
  const out: { at: number; mode: DriveMode }[] = []
  for (const event of session.events) {
    if (event.kind !== 'profile') continue
    const mode = event.data['driveMode']
    if (typeof mode === 'string' && isDriveMode(mode)) out.push({ at: event.at, mode })
  }
  return out.sort((a, b) => a.at - b.at)
}
