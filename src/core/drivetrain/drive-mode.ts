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
 * La courbe de chaque mode : une fraction du rupteur par passage.
 *
 * Elles disent enfin explicitement ce que les deux profils faisaient sans le
 * dire : **Route monte de plus en plus tôt** — on cherche le rapport long — et
 * **Sport de plus en plus tard** — on garde le régime. Personne n'avait énoncé
 * ces deux philosophies ; elles vivaient dans dix nombres.
 */
export const DRIVE_MODE_CURVES: Record<DriveMode, readonly number[]> = {
  // Les seuils du profil Route, divisés par son rupteur. Écrits en division et
  // non en décimales : quatre décimales déplacent le seuil de quelques dixièmes
  // de tour, ce qui suffit à faire basculer une comparaison qui se joue à
  // l'égalité — un test de la boîte l'a montré, et un réglage trouvé à l'oreille
  // ne mérite pas d'être arrondi en le déplaçant.
  road: [3700 / 6500, 3350 / 6500, 3050 / 6500, 2950 / 6500, 2950 / 6500],
  // Idem pour Sport, rupteur 8 500.
  sport: [5200 / 8500, 5600 / 8500, 5900 / 8500, 6200 / 8500, 6500 / 8500],
}

export function isDriveMode(value: unknown): value is DriveMode {
  return DRIVE_MODES.includes(value as DriveMode)
}

/**
 * La fraction du rupteur à laquelle ce passage se fait.
 *
 * La courbe est **redimensionnée** quand la boîte n'a pas cinq passages : les
 * fractions s'interpolent sur la longueur voulue, si bien qu'un rapport ajouté
 * reçoit un seuil cohérent avec ses voisins. C'était le défaut que
 * `resizeGearTables` devait corriger à la main sur les seuils absolus — un
 * rapport ajouté héritait du seuil de son prédécesseur.
 *
 * `gear` est l'indice du rapport qu'on quitte, `shifts` le nombre de passages
 * de la boîte, c'est-à-dire un de moins que son nombre de rapports.
 */
export function upshiftFraction(mode: DriveMode, gear: number, shifts: number): number {
  const courbe = DRIVE_MODE_CURVES[mode]
  const dernier = courbe[courbe.length - 1] ?? 0.5
  if (courbe.length === 0) return 0.5
  if (shifts <= 1) return courbe[0] ?? dernier

  // Position relative de ce passage dans la boîte, de 0 à 1, reportée sur la
  // courbe : c'est ce qui rend la courbe indépendante du nombre de rapports.
  const position = Math.min(1, Math.max(0, gear / (shifts - 1)))
  const echelle = position * (courbe.length - 1)
  const bas = Math.floor(echelle)
  const haut = Math.min(courbe.length - 1, bas + 1)
  const reste = echelle - bas
  const a = courbe[bas] ?? dernier
  const b = courbe[haut] ?? dernier
  return a + (b - a) * reste
}

/**
 * Le régime auquel ce passage se fait, sur un moteur donné.
 *
 * C'est tout le propos : le même mode sur deux moteurs donne deux régimes, et
 * changer de moteur change enfin la façon de conduire.
 */
export function upshiftRpmFor(
  mode: DriveMode,
  gear: number,
  shifts: number,
  redlineRpm: number,
): number {
  return upshiftFraction(mode, gear, shifts) * redlineRpm
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
        somme + Math.abs(seuil - upshiftRpmFor(mode, gear, shifts, redlineRpm)),
      0,
    ) / shifts
  return ecart('sport') < ecart('road') ? 'sport' : 'road'
}
