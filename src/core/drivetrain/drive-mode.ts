/**
 * Le mode de conduite : le tempérament de la boîte.
 *
 * Les seuils de passage étaient en **tours absolus**, et la boîte ignorait donc
 * le moteur qu'elle avait devant elle. Mesuré au banc, accélération franche de 0
 * à 150 km/h sur le profil Sport :
 *
 * | Moteur | Rupteur | Passage 3ᵉ → 4ᵉ |
 * |---|---|---|
 * | GM LS | 6 500 | 136 km/h |
 * | Chevrolet 454 | 5 500 | 116 km/h |
 * | Honda B18C5 | 8 400 | 142 km/h |
 * | Hayabusa | 11 000 | 144 km/h |
 *
 * Un moteur de moto qui monte à onze mille tours passait ses rapports au même
 * endroit qu'un V8 qui s'arrête à six mille cinq : il n'exploitait pas sa plage.
 * Et le Chevrolet 454 tapait son rupteur **avant d'avoir le droit de monter** —
 * les seuils de Sport vont jusqu'à 6 500 pour un rupteur à 5 500, et seul un
 * plafonnement de dernier recours l'empêchait de rester coincé.
 *
 * Idée de David, le 10 septembre 2026 : « les seuils de passage des rapports
 * doivent dépendre du moteur. On peut dériver les passages des valeurs du
 * rupteur à mon avis ». L'asymétrie était d'ailleurs dans le code depuis le
 * début : la **descente** s'exprimait déjà en fraction du rupteur, la montée en
 * tours.
 *
 * **Une fraction par passage, et non deux interpolées.** Un tempérament à deux
 * nombres — le premier passage et le dernier, le reste en ligne droite — aurait
 * été plus élégant, mais il s'écarte de 265 tr/min au milieu de la boîte sur le
 * profil Route : huit pour cent sur un seuil de 3 050, et ce seuil vient de
 * quatorze écoutes. On garde donc la courbe entière, exprimée en fractions.
 *
 * Ce que cela change pour les profils livrés : rien. Les fractions ci-dessous
 * sont leurs seuils actuels divisés par leur rupteur.
 */

/** Les deux tempéraments. Ce sont des choix de conduite, pas des réglages. */
export type DriveMode = 'road' | 'sport'

export const DRIVE_MODES: readonly DriveMode[] = ['road', 'sport']

/** Ce qui s'affiche, dans l'ordre des boutons. */
export const DRIVE_MODE_LABELS: Record<DriveMode, string> = {
  road: 'Route',
  sport: 'Sport',
}

/**
 * Le tempérament d'un mode : deux marges, et un seuil de rétrogradage forcé.
 *
 * **La règle a changé le 10 septembre 2026 au soir**, après une écoute en
 * roulant. Les seuils étaient une courbe de fractions du rupteur, une par
 * passage ; ils sont maintenant un **plancher de régime** — le régime en
 * dessous duquel un rapport n'a pas sa place. Idée de David : « on peut passer
 * le rapport suivant dès lors que les tours dans ce rapport seraient supérieurs
 * au ralenti plus une marge ; en fonction de l'agressivité du mode, on ajuste
 * la marge ; en fonction de la charge, on ajuste la marge ».
 *
 * Ce que cela apporte, au-delà du réglage. Le critère porte sur le régime du
 * rapport **visé**, donc il s'adapte de lui-même à l'étagement de la boîte : un
 * saut court et un saut long ne reçoivent plus le même seuil, ce que la courbe
 * de fractions ne savait pas faire. Et un seul nombre gouverne les deux sens,
 * si bien que la montée et la descente ne peuvent plus se contredire — c'est ce
 * qui produisait, sur chaque rapport, une plage de vitesse où la croisière
 * autorisait un rapport que la descente au régime refusait.
 *
 * Les marges sont des **points de départ**, calculés pour retomber sur les
 * seuils d'avant au premier passage. Elles se règlent à l'oreille.
 */
export interface DriveModeFeel {
  /** Marge au-dessus du ralenti pour engager le rapport suivant, à charge moyenne. */
  upshiftMarginRpm: number
  /** Marge au-dessus du ralenti en dessous de laquelle on rétrograde, pied levé. */
  downshiftMarginRpm: number
  /** Charge à partir de laquelle un rétrogradage forcé se déclenche. */
  kickdownLoad: number
}

export const DRIVE_MODE_FEEL: Record<DriveMode, DriveModeFeel> = {
  // Route : on cherche le rapport long, et le rétrogradage forcé demande le
  // pied au plancher. 0,95 de charge, c'est +1,8 m/s² sur le profil Route —
  // six relevés sur deux cent dix-huit lors de l'essai du 10 septembre.
  //
  // La marge est passée de 900 à 640 après la sortie du 11 septembre 2026 —
  // David : « ça reste trop longtemps en deux », et « que les vitesses passent
  // plus tôt qu'aujourd'hui, moins vingt pour cent ». Le ralenti étant un
  // plancher fixe, la baisse ne se reporte pas telle quelle sur le seuil : elle
  // vaut −20 % pied au plancher, où il l'a demandée, et −15 % en conduite
  // ordinaire.
  road: { upshiftMarginRpm: 640, downshiftMarginRpm: 400, kickdownLoad: 0.95 },
  // Sport : on garde le régime, et une demande forte suffit à faire descendre.
  sport: { upshiftMarginRpm: 2200, downshiftMarginRpm: 700, kickdownLoad: 0.85 },
}

/**
 * Le plancher du tout premier passage, en tours par minute, absolu.
 *
 * David : « on passe la deuxième dès qu'on peut, sans attendre, quelle que soit
 * la charge et le mode ». Ni marge de mode, ni effet de la charge, ni tirage au
 * sort : la première n'est qu'une amorce de lancement, et la seule chose à
 * éviter est que la deuxième tombe sous le ralenti — c'était le défaut du
 * passage imposé à la vitesse de lancement, 486 tr/min à 8 km/h.
 */
export const FIRST_UPSHIFT_FLOOR_RPM = 810

/**
 * Le plancher au-dessus duquel un rapport a sa place, à cette demande.
 *
 * La marge est **doublée à pleine charge** et de moitié pied levé : plus on
 * demande, plus on laisse monter dans les tours avant de passer.
 */
export function upshiftFloorRpm(mode: DriveMode, demand: number, idleRpm: number): number {
  const marge = DRIVE_MODE_FEEL[mode].upshiftMarginRpm
  const facteur = Math.min(2, Math.max(0.5, 2 * clamp01(demand)))
  return idleRpm + marge * facteur
}

/**
 * Le plancher en dessous duquel le rapport engagé est rendu.
 *
 * Il **remonte avec la décélération** : plus on ralentit fort, plus on
 * rétrograde tôt, et c'est ce qui donne l'impression du frein moteur. Une
 * décélération franche — deux mètres par seconde carrée — double la marge.
 *
 * Il reste sous le plancher de montée, et c'est l'hystérésis : un rapport qu'on
 * vient d'engager tourne au-dessus du plancher de montée, donc au-dessus de
 * celui-ci, donc il ne peut pas être rendu dans la foulée. L'invariant se
 * démontre au lieu de se régler.
 */
export function downshiftFloorRpm(
  mode: DriveMode,
  accelMs2: number,
  idleRpm: number,
  upshiftFloor: number,
): number {
  const marge = DRIVE_MODE_FEEL[mode].downshiftMarginRpm
  const facteur = 1 + Math.min(1, Math.max(0, -accelMs2 / 2))
  return Math.min(idleRpm + marge * facteur, upshiftFloor * 0.9)
}

/** La charge à partir de laquelle ce mode accepte un rétrogradage forcé. */
export function kickdownLoadFor(mode: DriveMode): number {
  return DRIVE_MODE_FEEL[mode].kickdownLoad
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function isDriveMode(value: unknown): value is DriveMode {
  return DRIVE_MODES.includes(value as DriveMode)
}

/**
 * Les courbes d'avant, gardées pour une seule chose : reconnaître un profil.
 *
 * Elles ont piloté les passages entre le 10 septembre 2026 au matin et le même
 * soir. Elles ne pilotent plus rien — le plancher les a remplacées — mais les
 * profils enregistrés portent encore les seuils absolus qu'elles donnaient, et
 * c'est à eux qu'on lit le tempérament choisi. Les effacer ferait conduire un
 * profil Sport comme un profil Route.
 */
const LEGACY_UPSHIFT_CURVES: Record<DriveMode, readonly number[]> = {
  road: [3700 / 6500, 3350 / 6500, 3050 / 6500, 2950 / 6500, 2950 / 6500],
  sport: [5200 / 8500, 5600 / 8500, 5900 / 8500, 6200 / 8500, 6500 / 8500],
}

/** Ce que la courbe d'avant donnait pour ce passage, sur ce rupteur. */
function legacyUpshiftRpm(
  mode: DriveMode,
  gear: number,
  shifts: number,
  redlineRpm: number,
): number {
  const courbe = LEGACY_UPSHIFT_CURVES[mode]
  const dernier = courbe[courbe.length - 1] ?? 0.5
  if (shifts <= 1) return (courbe[0] ?? dernier) * redlineRpm

  const position = Math.min(1, Math.max(0, gear / (shifts - 1)))
  const echelle = position * (courbe.length - 1)
  const bas = Math.floor(echelle)
  const haut = Math.min(courbe.length - 1, bas + 1)
  const reste = echelle - bas
  const a = courbe[bas] ?? dernier
  const b = courbe[haut] ?? dernier
  return (a + (b - a) * reste) * redlineRpm
}

/**
 * Le mode que décrivent des seuils absolus, pour la reprise.
 *
 * Sans elle, un appareil qui démarre avec un mode par défaut ferait conduire le
 * profil Sport comme un profil Route : le mode remplace précisément la
 * différence qui vivait dans les seuils, et il faut donc la lire avant de la
 * remplacer.
 *
 * La comparaison porte sur l'écart moyen entre les seuils enregistrés et ce que
 * chaque courbe donnerait sur ce rupteur-là. Le mode le plus proche gagne ; à
 * égalité — une table vide, un rupteur absurde — c'est la route, le tempérament
 * le plus sobre.
 */
export function driveModeFromUpshiftRpm(
  upshiftRpm: readonly number[],
  redlineRpm: number,
): DriveMode {
  if (upshiftRpm.length === 0 || !(redlineRpm > 0)) return 'road'
  const shifts = upshiftRpm.length
  const ecart = (mode: DriveMode): number =>
    upshiftRpm.reduce(
      (somme, seuil, gear) =>
        somme + Math.abs(seuil - legacyUpshiftRpm(mode, gear, shifts, redlineRpm)),
      0,
    ) / shifts
  return ecart('sport') < ecart('road') ? 'sport' : 'road'
}
