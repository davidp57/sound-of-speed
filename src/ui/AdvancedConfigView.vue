<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'


import NumberField from './components/NumberField.vue'
import { finalDriveFor, rpmAtSpeed } from '../core/preset/defaults'
import {
  appareil,
  editedProfile,
  tryClack,
  setGearRatios,
  refreshBanks,
  setSource,
  simulatorAvailable,
  sourceKind,
  type SourceKind,
} from '../state'

/**
 * Le banc, chargé à la demande.
 *
 * Il l'était depuis `App.vue`, où il avait son propre onglet, et le rester est
 * ce qui permet de le déplacer sans alourdir ce que la voiture télécharge : le
 * morceau reste à part, et une voiture ne l'ouvre jamais.
 */
const BenchView = defineAsyncComponent(() => import('./BenchView.vue'))

/**
 * Les réglages de fond : le moteur, la transmission, le signal, le caractère.
 *
 * **Il ne demande aucun droit, seulement d'être posé.** Le conducteur qui
 * bricole ses profils chez lui est le même que celui qui roule ; ce qui les
 * sépare est la situation, et c'est `core/garde.ts` qui la tranche. `App.vue`
 * ne monte ce composant que lorsque la garde est ouverte — il n'a donc rien à
 * vérifier lui-même.
 *
 * Ces six sections vivaient dans l'écran de configuration, derrière un bouton
 * « Simplifié / Avancé » que n'importe qui cochait, y compris en roulant. Le
 * fichier faisait 2 454 lignes.
 *
 * Toute modification est appliquée immédiatement, pendant que la boucle tourne :
 * il n'y a pas de bouton « valider ».
 */

/**
 * Ce qu'on règle : le profil assemblé, sections vivantes.
 *
 * Chaque curseur écrit dans le groupe où le réglage vit — le moteur, la boîte ou
 * la voiture — et non plus dans le profil, qui ne porte plus de valeurs. Les
 * chemins n'ont pas changé pour autant : `profile.engine.idleRpm` désigne
 * toujours le ralenti, il atterrit simplement dans le moteur.
 */
const profile = editedProfile

/**
 * Le choix de la source, et pourquoi il n'existe pas en voiture.
 *
 * David : « en voiture on est toujours en GPS, pas besoin des boutons simu ou
 * rejeu ». Le simulateur et le rejeu sont des outils d'atelier ; au volant ils
 * ne seraient qu'un moyen de se tromper sur ce qu'on entend.
 *
 * **L'appareil range, la garde protège, et les deux se cumulent.** L'appareil
 * est déclaré par celui qui s'en sert, donc il se trompe ; mais cacher le
 * simulateur dans la voiture reste juste, et c'est la garde qui tient le reste.
 */
const horsVoiture = computed(() => appareil.value !== 'voiture')

const SOURCES = computed<{ id: SourceKind; label: string }[]>(() =>
  simulatorAvailable.value
    ? [
        { id: 'simulator', label: 'Simulateur' },
        { id: 'geolocation', label: 'GPS' },
        { id: 'replay', label: 'Rejeu' },
      ]
    : [{ id: 'geolocation', label: 'GPS' }],
)

// Les banques se lisent à l'ouverture de l'écran : c'est le seul endroit d'où
// l'on en change, et une banque déposée entre-temps apparaît en y revenant.
onMounted(() => void refreshBanks())

/**
 * Vitesse à laquelle le rupteur tombe dans le dernier rapport. C'est le chiffre
 * parlant : le rapport de pont, seul, ne dit rien à personne. Le modifier
 * recalcule le pont en conséquence.
 */
const redlineSpeed = computed<number>({
  get() {
    const { drivetrain, engine } = profile.value
    const top = drivetrain.gearRatios[drivetrain.gearRatios.length - 1] ?? 1
    const wheelRps =
      engine.redlineRpm / 60 / Math.max(0.01, top * drivetrain.finalDrive)
    return wheelRps * 2 * Math.PI * drivetrain.wheelRadiusM * 3.6
  },
  set(kmh: number) {
    const { drivetrain, engine } = profile.value
    const top = drivetrain.gearRatios[drivetrain.gearRatios.length - 1] ?? 1
    if (kmh <= 0) return
    drivetrain.finalDrive = Number(
      finalDriveFor(engine.redlineRpm, kmh, top, drivetrain.wheelRadiusM).toFixed(3),
    )
  },
})


/** Régime en croisière, repère utile pour juger si la boîte est trop courte. */
const cruiseRpm = computed(() => {
  const { drivetrain } = profile.value
  const top = drivetrain.gearRatios[drivetrain.gearRatios.length - 1] ?? 1
  return rpmAtSpeed(130, top, drivetrain.finalDrive, drivetrain.wheelRadiusM)
})

const ratiosText = computed<string>({
  get: () => profile.value.drivetrain.gearRatios.map((r) => r.toFixed(2)).join(', '),
  set(text: string) {
    const parsed = text
      .split(/[,\s]+/)
      .map((piece) => Number(piece.replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value > 0)
    // Par l'état, qui redimensionne au passage les tables indexées par rapport
    // quand le nombre de rapports change.
    setGearRatios(parsed)
  },
})

const delaysText = computed<string>({
  get: () => profile.value.drivetrain.shiftDelaysS.map((d) => d.toFixed(2)).join(', '),
  set(text: string) {
    const parsed = text
      .split(/[,\s]+/)
      .map((piece) => Number(piece.replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value >= 0)
    if (parsed.length > 0) profile.value.drivetrain.shiftDelaysS = parsed
  },
})
</script>

<template>
  <div class="config">
    <!--
      La source, en tête : on règle ce qu'on entend, et sans le simulateur il
      n'y a rien à entendre à l'arrêt. C'est aussi ce qui lève la garde — dès
      que la vitesse ne vient plus du GPS, cet écran ne se referme plus.
    -->
    <template v-if="horsVoiture && SOURCES.length > 1">
      <section class="panel wide">
        <h2>Source de vitesse</h2>
        <div class="choices">
          <button
            v-for="entry in SOURCES"
            :key="entry.id"
            :aria-pressed="sourceKind === entry.id"
            @click="setSource(entry.id)"
          >
            {{ entry.label }}
          </button>
        </div>
        <p class="note">
          En voiture on est toujours au GPS, et ces boutons n'y existent pas. Le
          simulateur fabrique une vitesse, le rejeu en redonne une enregistrée :
          l'un comme l'autre permet de régler et d'entendre sans rouler.
        </p>
      </section>
      <BenchView class="banc-en-grille" />
    </template>

    <section class="panel">
      <h2>Moteur</h2>
      <NumberField
        v-model="profile.engine.cylinders"
        label="Cylindres enregistrés"
        :min="1"
        :max="16"
        :step="1"
        hint="Nombre de cylindres du moteur enregistré, pas de celui qu'on veut entendre : ce réglage ne change pas le son. Il ne sert qu'à l'analyse des fichiers, où une valeur fausse fausserait les propositions d'autant."
      />
      <NumberField v-model="profile.engine.idleRpm" label="Ralenti" :min="400" :max="3000" :step="10" unit="tr/min"
        hint="Régime moteur à l'arrêt, embrayage débrayé. C'est le son qu'on entend au feu rouge."
      />
      <NumberField v-model="profile.engine.launchRpm" label="Régime de décollage" :min="600" :max="4000" :step="50" unit="tr/min"
        hint="Ce que l'embrayage impose dès que la voiture avance. Le moteur y monte et l'y tient pendant qu'elle prend de la vitesse, jusqu'à ce que les roues le rejoignent. Sans lui, le régime resterait au ralenti à très basse vitesse, et le son serait celui de l'arrêt."
      />
      <NumberField
        v-model="profile.engine.softLimitRpm"
        label="Seuil de coupure"
        :min="2000"
        :max="16000"
        :step="50"
        unit="tr/min"
        hint="Régime auquel l'allumage commence à être coupé."
      />
      <NumberField v-model="profile.engine.redlineRpm" label="Rupteur" :min="2000" :max="16000" :step="50" unit="tr/min"
        hint="Plafond absolu : le régime n'ira jamais au-delà. Un moteur de série tourne à 6000-7000, un moteur de course au-delà de 8000."
      />
      <NumberField
        v-model="profile.engine.limiterHoldMs"
        label="Durée de coupure"
        :min="0"
        :max="400"
        :step="5"
        unit="ms"
        hint="C'est le hachage qui produit le crépitement, pas le plafonnement du régime."
      />
      <NumberField
        v-model="profile.engine.inertia"
        label="Inertie"
        :min="0.1"
        :max="4"
        :step="0.05"
        hint="Poids du volant moteur. Plus il est lourd, plus le moteur met de temps à prendre ses tours."
      />
      <NumberField v-model="profile.engine.freeRevRate" label="Montée à vide" :min="1000" :max="30000" :step="100" unit="tr/min·s⁻¹"
        hint="Rapidité de montée en régime quand les roues n'entraînent pas le moteur, comme un coup d'accélérateur à l'arrêt."
      />
      <NumberField v-model="profile.engine.engineBraking" label="Frein moteur" :min="500" :max="20000" :step="100" unit="tr/min·s⁻¹"
        hint="Rapidité avec laquelle le régime retombe quand on lève le pied."
      />
      <NumberField
        v-model="profile.engine.flutterRpm"
        label="Tremblement au ralenti"
        :min="0"
        :max="150"
        :step="1"
        unit="tr/min"
        hint="Un moteur au ralenti oscille de quelques dizaines de tours, et sous charge partielle il tremble encore. Le tremblement décroît quand le régime monte et quand la charge monte. Zéro donne un régime parfaitement lisse, ce qu'aucun moteur thermique n'est. Il ne va que dans le son : la boîte et ses seuils gardent le régime net."
      />
      <NumberField
        v-model="profile.engine.flutterHz"
        label="Vitesse du tremblement"
        :min="0.5"
        :max="20"
        :step="0.1"
        unit="Hz"
        hint="Fréquence de la composante rapide ; une composante lente à un dixième de cette valeur s'y ajoute, sans quoi le tremblement s'entend comme un vibrato."
      />
    </section>

    <section class="panel">
      <h2>Transmission</h2>
      <label class="inline">
        Démultiplications
        <input
          type="text"
          :value="ratiosText"
          @change="ratiosText = ($event.target as HTMLInputElement).value"
        />
      </label>
      <p class="note">Du plus court au plus long, séparés par des virgules. Une seule valeur = prise directe.</p>

      <NumberField v-model="profile.drivetrain.finalDrive" label="Pont" :min="1" :max="12" :step="0.05"
        hint="Démultiplication commune à tous les rapports. La baisser fait tourner le moteur moins vite à toute vitesse ; le réglage voisin permet de raisonner en km/h plutôt qu'avec ce nombre."
      />
      <NumberField
        v-model="redlineSpeed"
        label="Rupteur atteint à"
        :min="60"
        :max="400"
        :step="1"
        unit="km/h"
        hint="Dans le dernier rapport. Modifier cette valeur recalcule le pont."
      />
      <NumberField v-model="profile.drivetrain.wheelRadiusM" label="Rayon de roue" :min="0.15" :max="0.6" :step="0.005" unit="m"
        hint="Rayon d'une roue, en mètres. Entre dans le calcul du régime : une roue plus grande fait moins de tours pour la même vitesse. Environ 0,33 m pour une berline."
      />
      <NumberField v-model="profile.drivetrain.shiftTimeMs" label="Temps de passage" :min="0" :max="1500" :step="10" unit="ms"
        hint="Durée pendant laquelle le couple est coupé, et durée de toute la séquence : chute au neutre, coup de gaz, clac, reprise. C'est elle qui décide si le passage s'entend — sous deux cents millisecondes, les quatre temps se chevauchent et l'on ne perçoit qu'un trou. Court sur une boîte moderne, plus long sur une ancienne."
      />
      <p class="note">
        Les régimes de passage ne se règlent plus ici : ils se déduisent du
        <strong>rupteur du moteur</strong> et du <strong>tempérament</strong> —
        route ou sport —, qui se choisit sur la touche de marche, entre les cadrans de l'écran de conduite.
        C'est ce qui fait qu'un moteur de moto tient ses rapports plus longtemps
        qu'un V8, là où cinq régimes en tours absolus ignoraient le moteur qu'ils
        avaient devant eux.
      </p>
      <NumberField
        v-model="profile.drivetrain.upshiftLoadSpreadRpm"
        label="Écart selon la charge"
        :min="0"
        :max="4000"
        :step="50"
        unit="tr/min"
        hint="De combien le passage recule pied au plancher et avance pied levé, de part et d'autre des valeurs ci-dessus."
      />
      <NumberField
        v-model="profile.drivetrain.upshiftJitterRpm"
        label="Dispersion aléatoire"
        :min="0"
        :max="600"
        :step="10"
        unit="tr/min"
        hint="Tiré au sort à chaque passage. Sans lui, la boîte passe toujours au même régime exact et s'entend comme une machine."
      />
      <div class="toggle">
        <button
          :aria-pressed="profile.drivetrain.firstGearLaunchOnly"
          @click="profile.drivetrain.firstGearLaunchOnly = !profile.drivetrain.firstGearLaunchOnly"
        >
          Première réservée au lancement
        </button>
        <span class="note">On la quitte tout de suite et on n’y revient plus.</span>
      </div>
      <NumberField
        v-if="profile.drivetrain.firstGearLaunchOnly"
        v-model="profile.drivetrain.launchUpshiftKmh"
        label="Passage en seconde à"
        :min="1"
        :max="40"
        :step="1"
        unit="km/h"
        hint="La première n'est qu'une amorce : au-delà de cette vitesse, elle cède la place."
      />
      <NumberField
        v-model="profile.drivetrain.minUpshiftRpm"
        label="Ne jamais monter sous"
        :min="800"
        :max="5000"
        :step="50"
        unit="tr/min"
        hint="Plancher appliqué aux régimes de passage ci-dessus, toutes charges confondues : il empêche l'écart de charge de faire monter un rapport à un régime où le moteur peinerait. Sans effet sur le rétrogradage."
      />
      <NumberField
        v-model="profile.drivetrain.downshiftAtRedlineRatio"
        label="Descente sous"
        :min="0.05"
        :max="0.8"
        :step="0.01"
        hint="Fraction du rupteur sous laquelle la boîte redescend, quand la vitesse n'est ni tenue ni franchement en baisse. Plus la valeur est élevée, plus elle rétrograde tôt."
      />
      <NumberField
        v-model="profile.drivetrain.cruiseMinRpm"
        label="Croisière au-dessus de"
        :min="600"
        :max="4000"
        :step="50"
        unit="tr/min"
        hint="Quand vous tenez une vitesse, la boîte monte les rapports d'elle-même et s'arrête juste avant de descendre sous ce régime. Trop bas, le moteur broute ; trop haut, il reste inutilement haut en croisière."
      />
      <NumberField
        v-model="profile.drivetrain.cruiseUpshiftAfterS"
        label="Monter après"
        :min="0.5"
        :max="10"
        :step="0.1"
        unit="s"
        hint="Durée de vitesse stable avant de tenter un rapport de plus. Court, la boîte monte dès que vous levez le pied ; long, elle garde ses rapports."
      />
      <NumberField
        v-model="profile.drivetrain.brakeDownshiftAccelMs2"
        label="Descendre en freinant à"
        :min="-4"
        :max="-0.2"
        :step="0.1"
        unit="m/s²"
        hint="Décélération à partir de laquelle la boîte descend pour aider à ralentir, sans attendre que le régime soit tombé. Proche de zéro, elle descend au moindre lever de pied."
      />
      <label class="inline">
        Temporisations de montée
        <input
          type="text"
          :value="delaysText"
          @change="delaysText = ($event.target as HTMLInputElement).value"
        />
      </label>
      <p class="note">
        En secondes, une par rapport. Des valeurs volontairement inégales : avec une
        temporisation unique, la boîte sonne comme un métronome.
      </p>
      <p class="derived">À 130 km/h dans le dernier rapport : <b class="numeric">{{ Math.round(cruiseRpm) }}</b> tr/min</p>
    </section>

    <section class="panel">
      <h2>Signal de vitesse</h2>
      <NumberField
        v-model="profile.speed.springOmega"
        label="Raideur du lissage"
        :min="2"
        :max="40"
        :step="0.5"
        hint="Haut : réactif, mais les sauts du GPS s'entendent. Bas : doux, mais en retard."
      />
      <NumberField
        v-model="profile.speed.accelWindowMs"
        label="Fenêtre d'accélération"
        :min="200"
        :max="3000"
        :step="50"
        unit="ms"
        hint="Durée sur laquelle l'accélération est calculée. Courte, elle réagit vite mais tremble ; longue, elle est stable mais en retard."
      />
      <NumberField v-model="profile.speed.maxPlausibleKmh" label="Vitesse plausible max" :min="50" :max="400" :step="10" unit="km/h"
        hint="Au-delà, la mesure est rejetée comme aberrante. Le GPS produit parfois des sauts sous un pont ou entre deux immeubles."
      />
      <NumberField v-model="profile.speed.maxAccuracyM" label="Précision GPS acceptée" :min="20" :max="1000" :step="10" unit="m"
        hint="Au-delà, la position est écartée : trop floue pour en tirer une vitesse. Volontairement large — relevez la précision réelle sur l'écran de télémétrie avant de resserrer, un seuil trop serré fait taire le GPS."
      />
      <NumberField v-model="profile.speed.maxAccelMs2" label="Accélération max retenue" :min="1" :max="30" :step="0.5" unit="m/s²"
        hint="Ignore les accélérations plus fortes que cette valeur : ce sont des sauts du GPS, pas votre conduite."
      />
      <NumberField v-model="profile.speed.minAccelMs2" label="Décélération max retenue" :min="-30" :max="-1" :step="0.5" unit="m/s²"
        hint="Le même plafond, en freinage."
      />
    </section>

    <section class="panel">
      <h2>Caractère</h2>
      <p class="note">
        Trois comportements qui rendent la conduite plus vivante. Chacun s'active
        séparément.
      </p>

      <div class="toggle">
        <button
          :aria-pressed="profile.feel.kickdown.enabled"
          @click="profile.feel.kickdown.enabled = !profile.feel.kickdown.enabled"
        >
          Rétrogradage forcé
        </button>
        <span class="note">Descend d'un ou deux rapports quand on enfonce la pédale, pour reprendre plus fort.</span>
      </div>
      <template v-if="profile.feel.kickdown.enabled">
        <NumberField
          v-model="profile.feel.kickdown.targetRpmFraction"
          label="Régime visé"
          :min="0.3"
          :max="0.95"
          :step="0.01"
          :hint="`Fraction du rupteur, soit ${Math.round(profile.engine.redlineRpm * profile.feel.kickdown.targetRpmFraction)} tr/min.`"
        />
        <NumberField
          v-model="profile.feel.kickdown.maxGears"
          label="Rapports descendus au plus"
          :min="1"
          :max="4"
          :step="1"
        hint="Deux suffisent pour une reprise franche ; trois donnent une réponse plus vive, au risque de monter très haut dans les tours."
      />
      </template>

      <div class="toggle">
        <button
          :aria-pressed="profile.feel.backfire.enabled"
          @click="profile.feel.backfire.enabled = !profile.feel.backfire.enabled"
        >
          Pétarade
        </button>
        <span class="note">Claquements à l'échappement quand on lève le pied.</span>
      </div>
      <template v-if="profile.feel.backfire.enabled">
        <NumberField
          v-model="profile.feel.backfire.minRpm"
          label="À partir de"
          :min="1000"
          :max="9000"
          :step="100"
          unit="tr/min"
          hint="En deçà, rien ne se produit : il ne reste pas assez à brûler."
        />
        <NumberField v-model="profile.feel.backfire.intensity" label="Intensité" :min="0" :max="1" :step="0.05"
        hint="Volume des claquements. Au-delà de la moitié, ils dominent le moteur."
      />
        <NumberField v-model="profile.feel.backfire.count" label="Claquements par salve" :min="1" :max="10" :step="1"
        hint="Nombre de détonations à chaque lever de pied. Peu et espacés pour rester crédible."
      />
      </template>

      <div class="toggle">
        <button
          :aria-pressed="profile.feel.shiftJolt.enabled"
          @click="profile.feel.shiftJolt.enabled = !profile.feel.shiftJolt.enabled"
        >
          À-coup de passage
        </button>
        <span class="note">Le petit trou pendant le changement de rapport.</span>
      </div>
      <template v-if="profile.feel.shiftJolt.enabled">
        <NumberField
          v-model="profile.feel.shiftJolt.depth"
          label="Profondeur"
          :min="0"
          :max="1"
          :step="0.05"
          hint="Combien le niveau baisse pendant la coupure. Zéro donne une boîte parfaitement lisse, ce qu'aucune n'est."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.cutDepth"
          label="Coupure de couple"
          :min="0"
          :max="1"
          :step="0.05"
          hint="Combien le moteur passe en roue libre le temps du passage. C'est ce qui fait entrer le son pied levé, donc changer le timbre et pas seulement le niveau. Zéro garde le son de pleine charge d'un bout à l'autre."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.dipRpm"
          label="Plongée du régime"
          :min="-800"
          :max="1500"
          :step="50"
          unit="tr/min"
          hint="De combien le moteur tombe sous le régime du nouveau rapport pendant la coupure, avant que l'embrayage ne l'y ramène : il diminue, puis remonte. Une valeur négative donne l'inverse, un coup de gaz au débrayage."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.blipRpm"
          label="Coup de gaz"
          :min="0"
          :max="2000"
          :step="50"
          unit="tr/min"
          hint="De combien le moteur remonte au-dessus du rapport visé, entre la chute au neutre et l'engagement. C'est le geste du double débrayage, et le mouvement qui s'entend le mieux dans un passage. Zéro laisse la séquence en trois temps."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.clack"
          label="Clac de la boîte"
          :min="0"
          :max="3"
          :step="0.05"
          hint="Le choc mécanique quand le rapport s'engage : sec, métallique, doublé d'un coup mat. Rien à voir avec le claquement d'échappement, qui est grave et traînant."
        />
        <NumberField
          v-model="profile.feel.shiftJolt.clackDownshift"
          label="Clac au rétrogradage"
          :min="0"
          :max="1.5"
          :step="0.05"
          hint="Part du clac gardée quand la boîte descend un rapport. On rétrograde pied levé ou en freinant, donc avec un moteur bien plus doux : à intensité égale le clac y ressort deux fois plus. Un pour le même niveau qu'en montant."
        />
        <div class="toggle">
          <button @click="tryClack()">Écouter le clac</button>
          <span class="note">
            Le joue seul, sans attendre un passage. Le son doit être activé.
          </span>
        </div>
        <NumberField
          v-model="profile.feel.shiftJolt.crackle"
          label="Claquement de reprise"
          :min="0"
          :max="1"
          :step="0.05"
          hint="Une détonation à l'échappement au moment où le couple revient. Zéro n'en produit aucune."
        />
      </template>
    </section>

  </div>
</template>

<style scoped>
/*
 * La bande de défilement était déclarée ici ; elle vit maintenant dans
 * `style.css` et se pose sur tous les écrans qui défilent, en voiture et sur
 * téléphone. Cet écran ne la porte donc plus lui-même.
 */
.config {
  display: grid;
  /*
   * Le `min()` est ce qui empêche la grille de déborder en portrait : une
   * colonne d'au moins vingt rem, plus la bande, dépasse la largeur d'un
   * téléphone, et la page se décale alors horizontalement. Mesuré avant
   * correction sur un écran de 375 px : soixante-cinq pixels de débordement.
   */
  grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  gap: 1rem;
  align-items: start;
  max-width: 80rem;
  margin: 0 auto;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
}

.panel.wide {
  grid-column: 1 / -1;
}

/*
 * Le banc occupe toute la largeur : il porte ses propres panneaux, et les
 * laisser entrer dans une colonne de la grille les couperait en deux.
 */
.banc-en-grille {
  grid-column: 1 / -1;
}

h2 {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  font-weight: 600;
}

.inline {
  display: block;
  color: var(--muted);
  margin-top: 0.6rem;
}

.inline input {
  margin-top: 0.25rem;
}

.note {
  color: var(--muted);
  font-size: 0.82rem;
  margin: 0.4rem 0 0.6rem;
}

/*
 * Une note qui avertit. La classe était déjà employée dans cet écran sans être
 * définie : l'avertissement s'y lisait dans le gris de tout le reste, donc il ne
 * se lisait pas.
 */
.note.warn {
  color: var(--warn);
}

.derived {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0.6rem 0 0;
}

.derived b {
  color: var(--text);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  font-size: 0.78rem;
  padding-bottom: 0.3rem;
}

td {
  padding: 0.2rem 0.3rem 0.2rem 0;
  border-top: 1px solid var(--line);
}

td input[type='number'] {
  width: 6rem;
  text-align: right;
}

.mode .note {
  flex: 1 1 16rem;
  margin: 0;
}

.global-actions .note {
  flex: 1 1 16rem;
  margin: 0;
}

.creation-pitch .note {
  flex: 1 1 18rem;
  margin: 0;
}

.reset .note {
  margin: 0;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.6rem 0 0.3rem;
  border-top: 1px solid var(--line);
}

.toggle .note {
  margin: 0;
  flex: 1 1 12rem;
}
</style>
