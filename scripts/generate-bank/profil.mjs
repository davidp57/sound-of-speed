/**
 * Le profil que produit une banque générée.
 *
 * Séparé de `generate.mjs` pour une raison simple : il se vérifie sans banque
 * sous la main. `profile.test.mjs` ne tournait qu'avec la variable
 * `PROFIL_GENERE`, donc jamais en intégration continue — et le défaut qu'il
 * aurait dû attraper y est resté du 5 au 14 septembre 2026. Un test qui ne
 * tourne nulle part ne protège rien.
 */

/**
 * Assemble le profil partiel, importable tel quel par l'application.
 *
 * Ce qu'il porte de particulier :
 *
 * - **`engineDefinition` porte le moteur**, les vingt-neuf nombres du contrat.
 *   Il portait la définition de banque, ce qui n'est pas la même chose : à
 *   l'import, `clampEngineDefinition` la bornait au contrat et en faisait
 *   disparaître le dossier et la recette. La recette, elle, vit à côté des
 *   fichiers qu'elle a produits, dans `mesures.json` — et `sampleDir` la
 *   désigne. Avantage de ce rangement : basculer ce profil en son direct joue le
 *   moteur qui a produit ses échantillons.
 * - **Quatre réglages de mixage à zéro.** `loadReliefDb`, `rpmReliefDb`,
 *   `idleLevelDb` et `offLoadGain` compensaient à la main ce que la banque
 *   enregistrée ne portait pas. Les gains de couche le portent désormais,
 *   mesuré : les laisser appliquerait deux fois le même relief.
 */
export function buildProfile({ definition, moteur, layers, anchorList }) {
  return {
    name: definition.name,
    soundSource: 'prerendered',
    engineDefinition: moteur.nommees,
    sampleDir: definition.sampleDir,
    engine: {
      cylinders: moteur.cylinders,
      idleRpm: definition.idleRpm,
      redlineRpm: moteur.redlineRpm,
    },
    mix: {
      loadReliefDb: 0,
      rpmReliefDb: 0,
      idleLevelDb: 0,
      offLoadGain: 1,
      // Sans effet au-delà de deux couches par famille — le fondu se fait alors
      // d'un ancrage au suivant — mais écrits pour que le profil reste juste si
      // l'on désactive des couches.
      crossfadeLowRpm: Math.round(anchorList[0]),
      crossfadeHighRpm: Math.round(anchorList[1] ?? anchorList[0]),
      idleFadeOutRpm: Math.round(anchorList[1] ?? anchorList[0]),
    },
    layers,
  }
}
