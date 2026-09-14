// Sonde native : instancie un moteur d'engine-sim sans son interface ni son
// langage de script, le fait tourner, et imprime le temps processeur qu'il
// faut pour produire une seconde de son.
//
// C'est le chiffre de reference de ce poste, celui auquel comparer la mesure
// WebAssembly puis celle de la voiture. Rien n'est joue : la sortie audio est
// lue puis jetee.
//
// Le moteur est un quatre cylindres en ligne, code en dur, decalque des
// valeurs du Subaru EJ25 livre avec engine-sim. Il ne cherche pas a sonner
// juste : il sert d'etalon de cout, et un quatre cylindres suffit pour ca.

#include "engine.h"
#include "piston_engine_simulator.h"
#include "transmission.h"
#include "vehicle.h"
#include "standard_valvetrain.h"
#include "direct_throttle_linkage.h"
#include "units.h"
#include "constants.h"

#include "engines.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

namespace {

using Clock = std::chrono::steady_clock;

double seconds(Clock::duration d) {
    return std::chrono::duration<double>(d).count();
}

} // namespace

// Les constructeurs de moteur et le contrat qu'ils lisent vivent dans
// engines.h : le banc hors ligne de scripts/generate-bank en a besoin autant
// que cette sonde. Ils y ont demenage plutot que d'y etre recopies — la copie
// d'avant avait fige la geometrie en dur, et le banc ne savait plus produire
// que deux moteurs.
using namespace engines;

namespace {

// Une reponse impulsionnelle synthetique. Le contenu importe peu : seule sa
// longueur pese sur le cout de la convolution, qui est un produit direct.
// 10 000 echantillons est le plafond que le code impose de toute facon
// (synthesizer.cpp, initializeImpulseResponse).
std::vector<int16_t> makeImpulseResponse(unsigned int samples) {
    std::vector<int16_t> ir(samples);
    std::srand(1);
    for (unsigned int i = 0; i < samples; ++i) {
        const double decay = std::exp(-4.0 * (double)i / samples);
        const double noise = 2.0 * ((double)std::rand() / RAND_MAX) - 1.0;
        ir[i] = (int16_t)(noise * decay * 20000.0);
    }
    // Le chargeur coupe la queue sous 100 en valeur absolue : on garantit que
    // le dernier echantillon compte, sinon la reponse serait tronquee.
    ir[samples - 1] = 1000;
    return ir;
}

struct Result {
    double simCpu = 0.0;      // temps passe dans la simulation
    double synthCpu = 0.0;    // temps passe dans la synthese
    double audioSeconds = 0.0;
    double rpm = 0.0;
};

Result run(int simFrequency, double targetAudioSeconds, unsigned int impulseSamples,
           int cylinders = 8) {
    Engine *engine = buildEngine(defaultDefinition(cylinders));

    Vehicle *vehicle = new Vehicle;
    Vehicle::Parameters vehicleParams;
    vehicleParams.mass = units::mass(2700.0, units::lb);
    vehicleParams.dragCoefficient = 0.2;
    vehicleParams.crossSectionArea =
        units::distance(66.0, units::inch) * units::distance(56.0, units::inch);
    vehicleParams.diffRatio = 3.9;
    vehicleParams.tireRadius = units::distance(10.0, units::inch);
    vehicleParams.rollingResistance = units::force(300.0, units::N);
    vehicle->initialize(vehicleParams);

    const double gearRatios[6] = { 3.636, 2.375, 1.761, 1.346, 0.971, 0.756 };
    Transmission *transmission = new Transmission;
    Transmission::Parameters transmissionParams;
    transmissionParams.GearCount = 6;
    transmissionParams.GearRatios = gearRatios;
    transmissionParams.MaxClutchTorque = units::torque(300.0, units::ft_lb);
    transmission->initialize(transmissionParams);

    Simulator *simulator = engine->createSimulator(vehicle, transmission);
    simulator->setSimulationFrequency(simFrequency);

    Synthesizer::AudioParameters audioParams = simulator->synthesizer().getAudioParameters();
    audioParams.inputSampleNoise = (float)engine->getInitialJitter();
    audioParams.airNoise = (float)engine->getInitialNoise();
    audioParams.dF_F_mix = (float)engine->getInitialHighFrequencyGain();
    simulator->synthesizer().setAudioParameters(audioParams);

    // Une reponse impulsionnelle par sortie d'echappement, et non une seule.
    // Le V8 en a deux, une par banc : sans la seconde, le synthetiseur convolue
    // sur un registre jamais alloue et le programme meurt au premier appel.
    const std::vector<int16_t> ir = makeImpulseResponse(impulseSamples);
    for (int i = 0; i < engine->getExhaustSystemCount(); ++i) {
        simulator->synthesizer().initializeImpulseResponse(
            ir.data(), (unsigned int)ir.size(), 0.01f, i);
    }

    simulator->startAudioRenderingThread();

    engine->getIgnitionModule()->m_enabled = true;
    // Petite ouverture : sans charge, boite au point mort, le moteur monte au
    // rupteur des qu'on ouvre plus. A 0,10 il se stabilise autour de 3 000 tr/min.
    engine->setSpeedControl(0.10);
    simulator->m_dyno.m_enabled = false;
    simulator->m_starterMotor.m_enabled = true;

    const double frameDt = 1.0 / 60.0;
    const int audioTarget = (int)(targetAudioSeconds * 44100);
    std::vector<int16_t> out(4096);

    // Rodage : on lance le moteur avant de chronometrer, sinon on mesurerait un
    // moteur a l'arret, ou l'attenuation coupe le flux d'echappement.
    for (int i = 0; i < 120; ++i) {
        simulator->startFrame(frameDt);
        while (simulator->simulateStep()) { /* void */ }
        simulator->endFrame();
        simulator->readAudioOutput((int)out.size(), out.data());
        if (i == 60) simulator->m_starterMotor.m_enabled = false;
    }

    Result result;
    int produced = 0;
    int frames = 0;
    const int frameLimit = (int)(targetAudioSeconds * 60 * 20) + 100;

    while (produced < audioTarget && frames < frameLimit) {
        const auto t0 = Clock::now();
        simulator->startFrame(frameDt);
        while (simulator->simulateStep()) { /* void */ }
        simulator->endFrame();
        const auto t1 = Clock::now();

        int read = 0;
        int guard = 0;
        // On tire jusqu'a la ration de la trame, ou jusqu'a ce que le
        // synthetiseur n'ait plus rien : c'est lui qui limite, pas la boucle.
        while (read < 735 && guard < 8) {
            const int n = simulator->readAudioOutput(
                std::min(735 - read, (int)out.size()), out.data());
            if (n <= 0) break;
            read += n;
            ++guard;
        }
        const auto t2 = Clock::now();

        result.simCpu += seconds(t1 - t0);
        result.synthCpu += seconds(t2 - t1);
        produced += read;
        ++frames;
    }

    result.audioSeconds = produced / 44100.0;
    result.rpm = engine->getRpm();

    simulator->endAudioRenderingThread();
    simulator->releaseSimulation();
    delete simulator;
    engine->destroy();
    delete engine;
    delete vehicle;
    delete transmission;

    return result;
}

void report(const char *label, const Result &r) {
    const double total = r.simCpu + r.synthCpu;
    std::printf("%-38s ", label);
    if (r.audioSeconds <= 0.0) {
        std::printf("aucun son produit\n");
        return;
    }
    std::printf("%6.3f s son | sim %5.3f s + synth %5.3f s = %5.3f s CPU"
                " | x%.2f temps reel | %5.0f tr/min\n",
                r.audioSeconds, r.simCpu / r.audioSeconds,
                r.synthCpu / r.audioSeconds, total / r.audioSeconds,
                r.audioSeconds / total, r.rpm);
}


} // namespace

// ---------------------------------------------------------------------------
// Banc persistant, pour la page de mesure.
//
// La sonde en ligne de commande construit tout, mesure, et jette. La page, elle,
// chronometre chaque appel de l'exterieur : il lui faut un banc qui vive entre
// les appels, et trois operations separees.
//
// La synthese seule n'alimente pas la physique : elle ecrit dans l'entree du
// synthetiseur un signal fabrique, puis lit la sortie. C'est bien la convolution
// qu'on mesure alors, sans le cout du moteur derriere.
// ---------------------------------------------------------------------------

namespace {

struct Rig {
    Engine *engine = nullptr;
    Vehicle *vehicle = nullptr;
    Transmission *transmission = nullptr;
    Simulator *simulator = nullptr;
    unsigned int impulseSamples = 0;
    std::vector<int16_t> out;
};

Rig *g_rig = nullptr;

Rig *buildRig(int simFrequency, unsigned int impulseSamples, int cylinders) {
    Rig *rig = new Rig;
    // Huit cylindres par defaut : c'est le moteur vise, et il coute a peu
    // pres le double du quatre cylindres. Mesurer l'autre reviendrait a
    // decider sur un moteur qu'on ne veut pas.
    rig->engine = buildEngine(defaultDefinition(cylinders));
    rig->impulseSamples = impulseSamples;
    rig->out.resize(4096);

    rig->vehicle = new Vehicle;
    Vehicle::Parameters vp;
    vp.mass = units::mass(2700.0, units::lb);
    vp.dragCoefficient = 0.2;
    vp.crossSectionArea =
        units::distance(66.0, units::inch) * units::distance(56.0, units::inch);
    vp.diffRatio = 3.9;
    vp.tireRadius = units::distance(10.0, units::inch);
    vp.rollingResistance = units::force(300.0, units::N);
    rig->vehicle->initialize(vp);

    static const double gearRatios[6] = { 3.636, 2.375, 1.761, 1.346, 0.971, 0.756 };
    rig->transmission = new Transmission;
    Transmission::Parameters tp;
    tp.GearCount = 6;
    tp.GearRatios = gearRatios;
    tp.MaxClutchTorque = units::torque(300.0, units::ft_lb);
    rig->transmission->initialize(tp);

    rig->simulator = rig->engine->createSimulator(rig->vehicle, rig->transmission);
    rig->simulator->setSimulationFrequency(simFrequency);

    Synthesizer::AudioParameters ap = rig->simulator->synthesizer().getAudioParameters();
    ap.inputSampleNoise = (float)rig->engine->getInitialJitter();
    ap.airNoise = (float)rig->engine->getInitialNoise();
    ap.dF_F_mix = (float)rig->engine->getInitialHighFrequencyGain();
    rig->simulator->synthesizer().setAudioParameters(ap);

    const std::vector<int16_t> ir = makeImpulseResponse(impulseSamples);
    for (int i = 0; i < rig->engine->getExhaustSystemCount(); ++i) {
        rig->simulator->synthesizer().initializeImpulseResponse(
            ir.data(), (unsigned int)ir.size(), 0.01f, i);
    }

    rig->simulator->startAudioRenderingThread();
    rig->engine->getIgnitionModule()->m_enabled = true;
    rig->engine->setSpeedControl(0.10);
    rig->simulator->m_dyno.m_enabled = false;
    rig->simulator->m_starterMotor.m_enabled = true;

    // Rodage hors chronometre : un moteur a l'arret ne mesure rien.
    const double frameDt = 1.0 / 60.0;
    for (int i = 0; i < 120; ++i) {
        rig->simulator->startFrame(frameDt);
        while (rig->simulator->simulateStep()) { /* void */ }
        rig->simulator->endFrame();
        rig->simulator->readAudioOutput((int)rig->out.size(), rig->out.data());
        if (i == 60) rig->simulator->m_starterMotor.m_enabled = false;
    }

    return rig;
}

void destroyRig(Rig *rig) {
    if (rig == nullptr) return;
    rig->simulator->endAudioRenderingThread();
    rig->simulator->releaseSimulation();
    delete rig->simulator;
    rig->engine->destroy();
    delete rig->engine;
    delete rig->vehicle;
    delete rig->transmission;
    delete rig;
}

} // namespace

extern "C" {

/** Construit le banc. Rend 1, ou 0 si un banc existait deja. */
int bench_create(int simFrequency, int impulseSamples, int cylinders) {
    if (g_rig != nullptr) return 0;
    g_rig = buildRig(simFrequency, (unsigned int)impulseSamples, cylinders);
    return 1;
}

void bench_dispose() {
    destroyRig(g_rig);
    g_rig = nullptr;
}

/** Physique seule : aucune sortie n'est lue, donc rien n'est convolue. */
void bench_simulate(double seconds) {
    if (g_rig == nullptr) return;
    const double frameDt = 1.0 / 60.0;
    const int frames = (int)(seconds * 60.0);
    for (int i = 0; i < frames; ++i) {
        g_rig->simulator->startFrame(frameDt);
        while (g_rig->simulator->simulateStep()) { /* void */ }
        g_rig->simulator->endFrame();
    }
}

/**
 * Synthese seule : on alimente l'entree d'un signal fabrique et l'on tire la
 * sortie. Aucune physique, donc c'est bien la convolution qu'on mesure.
 */
void bench_synthesize(double seconds) {
    if (g_rig == nullptr) return;
    Synthesizer &synth = g_rig->simulator->synthesizer();
    const int target = (int)(seconds * 44100.0);
    int produced = 0;
    int guard = 0;
    double phase = 0.0;
    while (produced < target && guard < target * 8 + 1000) {
        for (int k = 0; k < 64; ++k) {
            const double sample = std::sin(phase) * 0.2;
            phase += 0.05;
            synth.writeInput(&sample);
            synth.endInputBlock();
        }
        const int n = synth.readAudioOutput(
            std::min(target - produced, (int)g_rig->out.size()), g_rig->out.data());
        if (n > 0) produced += n;
        ++guard;
    }
}

/** La chaine complete, telle qu'elle tournerait. */
void bench_run(double seconds) {
    if (g_rig == nullptr) return;
    const double frameDt = 1.0 / 60.0;
    const int target = (int)(seconds * 44100.0);
    int produced = 0;
    int frames = 0;
    const int frameLimit = (int)(seconds * 60 * 20) + 100;
    while (produced < target && frames < frameLimit) {
        g_rig->simulator->startFrame(frameDt);
        while (g_rig->simulator->simulateStep()) { /* void */ }
        g_rig->simulator->endFrame();
        int read = 0;
        int guard = 0;
        while (read < 735 && guard < 8) {
            const int n = g_rig->simulator->readAudioOutput(
                std::min(735 - read, (int)g_rig->out.size()), g_rig->out.data());
            if (n <= 0) break;
            read += n;
            ++guard;
        }
        produced += read;
        ++frames;
    }
}

double bench_rpm() { return g_rig == nullptr ? 0.0 : g_rig->engine->getRpm(); }
int bench_impulse_samples() { return g_rig == nullptr ? 0 : (int)g_rig->impulseSamples; }

} // extern "C"

// ---------------------------------------------------------------------------
// Banc vivant, pour faire sortir le son.
//
// Le banc precedent mesure : il tourne a son rythme et jette ce qu'il produit.
// Celui-ci alimente un haut-parleur, ce qui change trois choses.
//
// 1. **Le regime est impose, pas trouve.** Speed calcule deja un regime a
//    partir de la vitesse et du rapport ; c'est lui qui s'affiche au cadran. Le
//    dynamometre d'engine-sim existe exactement pour cela : `m_hold` a vrai, il
//    tient l'arbre a la vitesse demandee quoi que fasse la combustion. Laisser
//    le moteur trouver son regime serait plus fidele, mais le regime entendu ne
//    serait plus celui du cadran — et c'est le cadran qu'on croirait faux.
//
// 2. **La cadence audio est celle du navigateur.** engine-sim cable 44 100 Hz
//    dans `Simulator::initializeSynthesizer`. On ne le patche pas : on detruit
//    le synthetiseur juste apres sa construction et on le reinitialise a la
//    frequence du contexte audio. Rien a reechantillonner ensuite.
//
// 3. **L'effort commande le papillon.** A regime tenu, ouvrir le papillon
//    remplit davantage les cylindres : la pression de combustion monte, les
//    bouffees d'echappement changent de forme. Le timbre bouge, pas seulement
//    le niveau.
// ---------------------------------------------------------------------------

namespace {

struct Live {
    Engine *engine = nullptr;
    Vehicle *vehicle = nullptr;
    Transmission *transmission = nullptr;
    Simulator *simulator = nullptr;
    double audioSampleRate = 48000.0;
    /** Regime demande par la chaine de Speed, en tours par minute. */
    double targetRpm = 800.0;
    /** Regime effectivement impose au dynamometre, apres limitation de pente. */
    double heldRpm = 800.0;
    /** Effort, de 0 a 1, tel que le calcule `core/engine/engine.ts`. */
    double effort = 0.0;
    /** Ouverture du papillon a effort nul, puis a plein effort. */
    double throttleIdle = 0.06;
    double throttleFull = 1.0;
    std::vector<int16_t> scratch;
    /**
     * L'ondulation du regime, relevee a chaque pas de simulation.
     *
     * Un vilebrequin reel accelere a chaque explosion et ralentit entre deux :
     * c'est cette ondulation qui empeche le son d'etre une frequence pure. Le
     * regime lu depuis le fil principal ne la montre pas — il est echantillonne
     * quatre fois par seconde, la ou l'ondulation vaut cent a deux cents hertz.
     * Elle ne s'observe donc qu'ici, entre les pas.
     *
     * David, le 8 septembre 2026, sur l'EJ25 a 1 820 tr/min : « la frequence est
     * vraiment tres stable et trop pure, on dirait un oscilloscope ».
     */
    double rpmMin = 0.0;
    double rpmMax = 0.0;
    double rpmSum = 0.0;
    long long rpmCount = 0;
    /**
     * Amplitude de l'ondulation imposee au vilebrequin, en tours par minute.
     *
     * Le dynamometre tient la vitesse par une contrainte du solveur : mesuree a
     * chaque pas, l'ondulation du vilebrequin est **exactement nulle**, a tous
     * les regimes. Un moteur reel accelere a chaque explosion et ralentit entre
     * deux ; sans cette ondulation le son est une frequence pure, et David l'a
     * entendu du premier coup — « on dirait un oscilloscope ».
     *
     * On ne peut pas la laisser naitre de la physique : quand on desserre le
     * dynamometre assez pour cela, il ne tient plus le regime, et ce qui apparait
     * ne depasse pas un quart de pour cent. On l'impose donc a la consigne, ici,
     * a chaque pas de simulation — la seule cadence qui permette de suivre la
     * frequence d'allumage, cent vingt et un hertz sur un V8 a 1 820 tr/min.
     *
     * En tours par minute et non en pourcentage : l'energie d'une explosion et
     * l'inertie du volant ne dependent pas du regime, si bien qu'une amplitude
     * constante en tours donne d'elle-meme une part qui decroit quand le moteur
     * monte — 2,5 % au ralenti pour 0,7 % a trois mille.
     *
     * **C'est un bruit filtre, et non une sinusoide calee sur les explosions.**
     * La sinusoide a ete essayee d'abord, et mesuree : elle ne change rien au
     * spectre — 46,3 % de l'energie dans les cinquante plus grandes raies sans
     * elle, 45,4 % avec quarante tours d'amplitude. La raison est arithmetique :
     * moduler a la frequence d'allumage place les bandes laterales exactement
     * sur les harmoniques voisines, donc l'energie reste sur la meme grille. Ce
     * qui manque a ce son n'est pas une ondulation reguliere, c'est de
     * l'irregularite — un vrai moteur ne fait pas deux explosions identiques.
     */
    double rippleRpm = 0.0;
    /** Frequence de coupure du bruit qui module le regime, en hertz. */
    double rippleHz = 15.0;
    /** Etat du filtre passe-bas, entre -1 et 1 environ. */
    double rippleState = 0.0;
    /** Generateur congruentiel : reproductible, et sans dependance. */
    unsigned int rippleSeed = 22695477u;
};

Live *g_live = nullptr;

/**
 * Pente maximale du regime impose, en tours par minute et par seconde.
 *
 * Le dynamometre est une contrainte rigide : un saut de regime d'une trame a
 * l'autre secoue le solveur et s'entend comme un claquement. La chaine de Speed
 * ne saute pas — le conditionnement et l'inertie du moteur l'en empechent —,
 * mais un changement de rapport, lui, saute. La limitation absorbe ce cas-la.
 *
 * Elle valait 12 000 tr/min par seconde, ce qui etait trop lent : un passage de
 * rapport fait chuter le regime de deux mille cinq cents tours d'un coup, soit
 * plus de deux dixiemes de seconde a cette pente. David l'a entendu — « les
 * tours retombent avant le son ». A 40 000, la meme chute prend soixante
 * millisecondes, sous le seuil ou l'oreille separe deux evenements.
 */
const double MAX_RPM_SLEW = 40000.0;

/**
 * Ce qui n'est pas le moteur : la cadence de simulation, celle du contexte
 * audio, la longueur de la reponse impulsionnelle et le niveleur.
 *
 * Ces reglages-la ne decrivent pas un moteur et n'ont donc pas leur place dans
 * la definition du contrat. `synth_create_from` ne prend qu'un tableau de
 * valeurs : le banc se pose avant, par `synth_set_rig`.
 */
struct RigSettings {
    int simFrequency = 10000;
    int audioSampleRate = 48000;
    int impulseSamples = 0;
    int leveler = 1;
    double levelerGain = 0.5;
    // La crete que le niveleur vise, sur l'echelle des entiers 16 bits.
    //
    // engine-sim vise 30 000 sur 32 767, soit 92 % du plafond : 0,8 dB de
    // marge. Or `Synthesizer::renderAudio` borne la sortie a INT16_MAX. Deux
    // constantes de temps du filtre expliquent l'ecretage : le gain applique
    // est lisse par un coefficient 0,9 par echantillon (~0,2 ms), donc un front
    // soudain n'a que 10 % du bon gain applique quand il arrive ; la crete
    // elle-meme decroit par un coefficient 0,999 (~23 ms), donc le gain reduit
    // par une bouffee met ce temps a remonter — a comparer aux 19-38 ms entre
    // deux coups d'un V8 au ralenti. Simule sur un V8 au ralenti, un signal de
    // 50 000 de crete ressort ecrete a 17,5 % avec la cible d'origine, contre
    // 0,4 % a 12 000. Le volume perdu se rattrape dans Web Audio, en flottant,
    // ou il n'y a pas de plafond dur.
    double levelerTarget = 12000.0;
};

RigSettings g_rigSettings;

/**
 * Construit le moteur qui va jouer.
 *
 * `audioSampleRate` est la cadence du contexte audio du navigateur, pas les
 * 44 100 Hz cables dans engine-sim : le synthetiseur est reinitialise dessus.
 * `impulseSamples` a 0 supprime la convolution interne — c'est le mode ou la
 * reverberation d'echappement est deportee sur un `ConvolverNode`, que Web
 * Audio calcule en FFT partitionnee au lieu d'un produit direct.
 */
int createLive(const RigSettings &rig, const EngineDefinition &def) {
    if (g_live != nullptr) return 0;

    const int simFrequency = rig.simFrequency;
    const int audioSampleRate = rig.audioSampleRate;
    const int impulseSamples = rig.impulseSamples;
    const int leveler = rig.leveler;
    const double levelerGain = rig.levelerGain;
    const double levelerTarget = rig.levelerTarget;

    Live *live = new Live;
    live->audioSampleRate = (double)audioSampleRate;
    live->engine = buildEngine(def);
    live->scratch.resize(4096);

    live->vehicle = new Vehicle;
    Vehicle::Parameters vp;
    vp.mass = units::mass(2700.0, units::lb);
    vp.dragCoefficient = 0.2;
    vp.crossSectionArea =
        units::distance(66.0, units::inch) * units::distance(56.0, units::inch);
    vp.diffRatio = 3.9;
    vp.tireRadius = units::distance(10.0, units::inch);
    vp.rollingResistance = units::force(300.0, units::N);
    live->vehicle->initialize(vp);

    static const double gearRatios[6] = { 3.636, 2.375, 1.761, 1.346, 0.971, 0.756 };
    live->transmission = new Transmission;
    Transmission::Parameters tp;
    tp.GearCount = 6;
    tp.GearRatios = gearRatios;
    tp.MaxClutchTorque = units::torque(300.0, units::ft_lb);
    live->transmission->initialize(tp);

    live->simulator = live->engine->createSimulator(live->vehicle, live->transmission);
    live->simulator->setSimulationFrequency(simFrequency);

    // Reinitialisation du synthetiseur a la cadence du navigateur. `destroy()`
    // libere ce que `initialize()` avait alloue : sans lui, on fuirait un
    // tampon de 44 100 flottants et autant de filtres a chaque construction.
    Synthesizer &synth = live->simulator->synthesizer();

    // Le niveleur se regle **ici et nulle part ailleurs**. `renderAudio` ne
    // relit que sa cible a chaque echantillon ; ses deux bornes de gain, elles,
    // sont recopiees une seule fois, dans `Synthesizer::initialize`. Les ecrire
    // par `setAudioParameters` apres coup ne fait rien — mesure : le gain fixe
    // passe de 0,5 a 0,05 sans que le niveau bouge d'un centieme.
    Synthesizer::AudioParameters ap;
    ap.inputSampleNoise = (float)live->engine->getInitialJitter();
    ap.airNoise = (float)live->engine->getInitialNoise();
    ap.dF_F_mix = (float)live->engine->getInitialHighFrequencyGain();
    // La cible se pose ici comme le reste, mais elle est le seul parametre du
    // niveleur que `renderAudio` relit a chaque echantillon : la changer sans
    // rebatir marcherait. Elle passe quand meme par la construction, pour que
    // le reglage se lise au meme endroit que ses deux bornes.
    ap.levelerTarget = (float)levelerTarget;
    if (leveler == 0) {
        // Gain fige : la dynamique du modele passe telle quelle, et l'effort
        // s'entend. C'est ce que le niveleur, qui vise une crete constante,
        // efface par construction.
        ap.levelerMinGain = (float)levelerGain;
        ap.levelerMaxGain = (float)levelerGain;
    }

    Synthesizer::Parameters sp;
    sp.audioBufferSize = audioSampleRate;
    sp.audioSampleRate = (float)audioSampleRate;
    sp.inputBufferSize = audioSampleRate;
    sp.inputChannelCount = live->engine->getExhaustSystemCount();
    sp.inputSampleRate = (float)simFrequency;
    sp.initialAudioParameters = ap;
    synth.destroy();
    synth.initialize(sp);

    // Une reponse impulsionnelle par sortie d'echappement : le V8 en a deux, une
    // par banc, et le synthetiseur convolue sur un registre par banc.
    //
    // Convolution deportee (`impulseSamples` a zero) : un seul coefficient, egal
    // a un. Le synthetiseur laisse alors passer son signal tel quel et c'est le
    // `ConvolverNode` qui resonne. Une reponse courte tiree au hasard, elle,
    // donnait un gain de l'ordre du millieme et **variable d'un demarrage a
    // l'autre** : mesure a 0,009 de niveau crete contre 0,9 attendu, le meme
    // reglage sonnant cinquante fois plus faible selon le tirage.
    const std::vector<int16_t> unitTap(1, (int16_t)32767);
    const std::vector<int16_t> ir =
        impulseSamples > 0 ? makeImpulseResponse((unsigned int)impulseSamples) : unitTap;
    const float irVolume = impulseSamples > 0 ? 0.01f : 1.0f;
    for (int i = 0; i < live->engine->getExhaustSystemCount(); ++i) {
        synth.initializeImpulseResponse(ir.data(), (unsigned int)ir.size(), irVolume, i);
    }

    live->simulator->startAudioRenderingThread();
    live->engine->getIgnitionModule()->m_enabled = true;
    // Un peu plus de gaz que le ralenti le temps que le moteur prenne : c'est
    // ce que fait le banc hors ligne, et en dessous il cale.
    live->engine->setSpeedControl(0.10);

    // On demarre au demarreur, dynamometre coupe. Engager le dynamometre sur un
    // moteur a l'arret le fait tourner sans jamais s'allumer : le banc hors
    // ligne l'a mesure — a 3 000 tr/min tenus, plein gaz, la chambre la plus
    // chaude plafonnait a 530 K et le couple restait negatif. Le son entendu
    // etait alors celui du pompage d'air, plus fort papillon **ferme** que
    // papillon ouvert, d'ou un effort qui agissait a l'envers.
    live->simulator->m_dyno.m_enabled = false;
    live->simulator->m_starterMotor.m_enabled = true;

    // Reserve interne du synthetiseur : c'est le tampon qu'engine-sim se
    // constitue tout seul, en ajustant le nombre de pas de simulation par
    // trame. 60 ms suffisent ici — le tampon du lecteur, en aval, absorbe le
    // reste, et allonger celui-ci ne ferait qu'ajouter du retard au son.
    live->simulator->setTargetSynthesizerLatency(0.06);

    // Rodage hors mesure : les chambres partent a la pression atmospherique et
    // la premiere combustion n'a pas encore eu lieu. Le demarreur lache a la
    // soixantieme trame, le moteur doit tenir seul ensuite.
    for (int i = 0; i < 240; ++i) {
        live->simulator->startFrame(1.0 / 60.0);
        while (live->simulator->simulateStep()) { /* void */ }
        live->simulator->endFrame();
        live->simulator->readAudioOutput(
            (int)live->scratch.size(), live->scratch.data());
        if (i == 60) live->simulator->m_starterMotor.m_enabled = false;
    }

    // Le dynamometre prend alors le relais et tient le regime dans les deux
    // sens : il absorbe quand le moteur pousse, il entraine quand il freine.
    live->simulator->m_dyno.m_rotationSpeed = units::rpm(live->heldRpm);
    live->simulator->m_dyno.m_enabled = true;
    live->simulator->m_dyno.m_hold = true;
    live->engine->setSpeedControl(live->throttleIdle);

    g_live = live;
    return 1;
}

} // namespace

extern "C" {

/** Pose les reglages du banc. A appeler avant `synth_create_from`. */
void synth_set_rig(int simFrequency, int audioSampleRate, int impulseSamples,
                   int leveler, double levelerGain, double levelerTarget) {
    g_rigSettings.simFrequency = simFrequency;
    g_rigSettings.audioSampleRate = audioSampleRate;
    g_rigSettings.impulseSamples = impulseSamples;
    g_rigSettings.leveler = leveler;
    g_rigSettings.levelerGain = levelerGain;
    g_rigSettings.levelerTarget = levelerTarget;
}

/**
 * Construit le moteur a partir de la definition portee par le profil.
 *
 * `values` est le tableau du contrat (native/CONTRAT-MOTEUR.md), lu dans
 * l'ordre de l'enumeration `EngineParam`. Un tableau plus court que le contrat
 * laisse les valeurs de reference en place sur la fin ; un tableau plus long
 * voit sa queue ignoree. C'est ce qui permet a un binaire d'avance de tourner
 * avec un profil d'hier, et l'inverse.
 */
int synth_create_from(const double *values, int count) {
    if (values == nullptr || count <= 0) return 0;

    const int cylinders = count > ENGINE_CYLINDERS ? (int)values[ENGINE_CYLINDERS] : 8;
    EngineDefinition def = defaultDefinition(cylinders);

    const int n = count < ENGINE_PARAM_COUNT ? count : ENGINE_PARAM_COUNT;
    for (int i = 0; i < n; ++i) def.v[i] = values[i];

    // La seule valeur qu'on retouche apres l'avoir lue, et la voici dite : un
    // peu au-dessus du rupteur du profil, parce que c'est la boite qui doit
    // tenir le regime, pas la coupure d'allumage. Sans marge, le moindre
    // depassement ferait taire le moteur juste au moment ou on l'ecoute le
    // plus.
    def.v[ENGINE_REV_LIMIT] =
        def[ENGINE_REV_LIMIT] > 1000.0 ? def[ENGINE_REV_LIMIT] * 1.05 : 6800.0;

    return createLive(g_rigSettings, def);
}

/**
 * L'ancienne porte d'entree : les valeurs de reference du moteur a tant de
 * cylindres, avec le rupteur du profil. Le banc de mesure s'en sert, et elle
 * evite de rendre le tableau obligatoire pour un appelant qui n'a rien a
 * regler.
 */
int synth_create(int simFrequency, int audioSampleRate, int cylinders, int impulseSamples,
                 int leveler, double levelerGain, double revLimitRpm) {
    // La valeur d'engine-sim : cette porte d'entrée courte reste au comportement
    // d'origine, la cible se règle par `synth_set_rig` pour qui en a besoin.
    synth_set_rig(simFrequency, audioSampleRate, impulseSamples, leveler, levelerGain, 30000.0);
    EngineDefinition def = defaultDefinition(cylinders);
    def.v[ENGINE_REV_LIMIT] = revLimitRpm;
    return synth_create_from(def.v, ENGINE_PARAM_COUNT);
}

void synth_dispose() {
    if (g_live == nullptr) return;
    g_live->simulator->endAudioRenderingThread();
    g_live->simulator->releaseSimulation();
    delete g_live->simulator;
    g_live->engine->destroy();
    delete g_live->engine;
    delete g_live->vehicle;
    delete g_live->transmission;
    delete g_live;
    g_live = nullptr;
}

/** Le regime que le cadran affiche, et l'effort que le moteur fournit. */
void synth_set_target(double rpm, double effort) {
    if (g_live == nullptr) return;
    g_live->targetRpm = rpm < 0.0 ? 0.0 : rpm;
    g_live->effort = effort < 0.0 ? 0.0 : (effort > 1.0 ? 1.0 : effort);
}

/** Les deux bornes du papillon, pour regler ce que l'effort change. */
void synth_set_throttle_range(double idle, double full) {
    if (g_live == nullptr) return;
    g_live->throttleIdle = idle;
    g_live->throttleFull = full;
}

/**
 * La fermete du dynamometre, en livres-pied.
 *
 * Il tient le regime par une contrainte du solveur, resolue a chaque pas, et
 * son couple maximal vaut dix mille livres-pied par defaut. A chaque explosion
 * il freine d'un coup, entre deux il entraine : ce va-et-vient injecte du bruit
 * large bande dans la rotation, et la rotation module tout le son.
 *
 * Baisser ce couple laisse le regime respirer entre les explosions — ce que
 * fait un vrai volant d'inertie. Trop bas, le regime ne suit plus le cadran.
 */
void synth_set_dyno(double maxTorqueFtLb) {
    if (g_live == nullptr) return;
    g_live->simulator->m_dyno.m_maxTorque = units::torque(maxTorqueFtLb, units::ft_lb);
}

/**
 * Les deux bruits qu'engine-sim ajoute a dessein.
 *
 * Ils sont a leurs valeurs d'origine depuis le debut du portage, et personne
 * ne les avait regardees. Elles expliquent les deux anomalies mesurees dans le
 * spectre :
 *
 * `airNoise` a 1,0 ne s'ajoute pas au signal, il le **multiplie** :
 *   r_mixed = airNoise * bruit + (1 - airNoise)
 *   v_in    = ... + f * r_mixed * ...
 * A un, le moteur est donc entierement module par un bruit blanc filtre a
 * 2 kHz. C'est le plateau plat mesure jusqu'a 2 kHz. A zero, r_mixed vaut un
 * et le signal passe intact.
 *
 * `inputSampleNoise` a 0,5 est une gigue appliquee a l'echantillon d'entree,
 * filtree a 10 kHz. C'est la bosse mesuree de 3 a 10 kHz, qui culmine a 8 kHz
 * onze decibels au-dessus du creux a 2 kHz — une remontee qu'aucun moteur reel
 * ne produit.
 *
 * L'application d'origine d'engine-sim expose ces deux reglages a l'ecran ;
 * nous avions garde les valeurs de la structure, qui sont des valeurs de
 * demonstration, pas un reglage.
 */
void synth_set_noise(double airNoise, double inputSampleNoise) {
    if (g_live == nullptr) return;
    Synthesizer &synth = g_live->simulator->synthesizer();
    Synthesizer::AudioParameters ap = synth.getAudioParameters();
    ap.airNoise = (float)airNoise;
    ap.inputSampleNoise = (float)inputSampleNoise;
    synth.setAudioParameters(ap);
}

void synth_set_volume(double volume) {
    if (g_live == nullptr) return;
    Synthesizer &synth = g_live->simulator->synthesizer();
    Synthesizer::AudioParameters ap = synth.getAudioParameters();
    ap.volume = (float)volume;
    synth.setAudioParameters(ap);
}

/**
 * Change la crete visee par le niveleur, sans rebatir.
 *
 * `Synthesizer::renderAudio` relit `m_audioParameters.levelerTarget` a chaque
 * echantillon (`synthesizer.cpp:359`) : ce n'est pas fige a la construction
 * comme les deux bornes de gain. Le meme mecanisme que `synth_set_noise`, pour
 * la meme raison : une correction qui suit la charge en temps reel demanderait
 * une coupure d'une seconde a chaque pas si elle passait par un rebatissage.
 */
void synth_set_leveler_target(double target) {
    if (g_live == nullptr) return;
    Synthesizer &synth = g_live->simulator->synthesizer();
    Synthesizer::AudioParameters ap = synth.getAudioParameters();
    ap.levelerTarget = (float)target;
    synth.setAudioParameters(ap);
}

/**
 * Rend un bloc d'echantillons, en flottants de -1 a 1.
 *
 * La trame de simulation dure exactement le bloc demande : c'est ce qui garde
 * la physique et le son sur la meme horloge, celle du lecteur, plutot que sur
 * un minuteur qui deriverait.
 *
 * Rend le nombre d'echantillons reellement produits. Un chiffre inferieur au
 * demande est un creux : le reste du bloc est mis a zero, et l'appelant le
 * compte.
 */
int synth_render(float *dest, int frames) {
    if (g_live == nullptr || frames <= 0) return 0;

    const double blockSeconds = frames / g_live->audioSampleRate;

    const double step = MAX_RPM_SLEW * blockSeconds;
    const double delta = g_live->targetRpm - g_live->heldRpm;
    if (delta > step) g_live->heldRpm += step;
    else if (delta < -step) g_live->heldRpm -= step;
    else g_live->heldRpm = g_live->targetRpm;

    g_live->simulator->m_dyno.m_rotationSpeed = units::rpm(g_live->heldRpm);
    g_live->engine->setSpeedControl(
        g_live->throttleIdle + (g_live->throttleFull - g_live->throttleIdle) * g_live->effort);

    // Le bruit qui module le regime : un passe-bas d'ordre un sur du bruit
    // blanc, dont la coupure decide de la vitesse a laquelle le regime derive.
    const double simHz = (double)g_rigSettings.simFrequency;
    const double alpha = simHz > 0.0
        ? 1.0 - std::exp(-2.0 * 3.14159265358979323846 * g_live->rippleHz / simHz)
        : 0.0;
    // Un passe-bas d'ordre un ne laisse passer qu'une fraction de l'ecart-type
    // du bruit blanc : la racine de alpha sur deux moins alpha. On la compense
    // pour que le reglage dise ce qu'il produit.
    const double rippleGain = alpha > 0.0 ? std::sqrt((2.0 - alpha) / alpha) : 0.0;

    g_live->simulator->startFrame(blockSeconds);
    while (g_live->simulator->simulateStep()) {
        // L'ondulation s'impose ici, entre deux pas, et non une fois par bloc :
        // un bloc dure vingt et une millisecondes, on ne pourrait pas depasser
        // quarante-cinq hertz, quand il en faut cent vingt et un.
        if (g_live->rippleRpm > 0.0) {
            g_live->rippleSeed = g_live->rippleSeed * 1103515245u + 12345u;
            const double blanc =
                ((double)((g_live->rippleSeed >> 16) & 0x7fff) / 16383.5) - 1.0;
            g_live->rippleState += alpha * (blanc - g_live->rippleState);
            // Le passe-bas divise l'amplitude : on la rend, sans quoi le reglage
            // annoncerait des tours qu'il ne produit pas.
            const double wobble = g_live->rippleRpm * g_live->rippleState * rippleGain;
            g_live->simulator->m_dyno.m_rotationSpeed = units::rpm(g_live->heldRpm + wobble);
        }
        // Un releve par pas : c'est la seule cadence a laquelle l'ondulation du
        // vilebrequin est visible. Le cout est un acces memoire par pas.
        const double r = g_live->engine->getRpm();
        if (g_live->rpmCount == 0 || r < g_live->rpmMin) g_live->rpmMin = r;
        if (g_live->rpmCount == 0 || r > g_live->rpmMax) g_live->rpmMax = r;
        g_live->rpmSum += r;
        ++g_live->rpmCount;
    }
    g_live->simulator->endFrame();

    int produced = 0;
    int guard = 0;
    while (produced < frames && guard < 16) {
        const int want = std::min(frames - produced, (int)g_live->scratch.size());
        const int n = g_live->simulator->readAudioOutput(want, g_live->scratch.data());
        if (n <= 0) break;
        for (int i = 0; i < n; ++i) {
            dest[produced + i] = g_live->scratch[i] / 32768.0f;
        }
        produced += n;
        ++guard;
    }
    for (int i = produced; i < frames; ++i) dest[i] = 0.0f;

    return produced;
}

/** Le regime que le moteur simule tient vraiment, pour verifier qu'il suit. */
double synth_rpm() { return g_live == nullptr ? 0.0 : g_live->engine->getRpm(); }

/**
 * L'amplitude de l'ondulation imposee au vilebrequin, en tours par minute.
 *
 * Zero rend le regime rigoureusement constant, c'est-a-dire le defaut qu'on
 * cherche a corriger. Elle s'ecrit a chaud : le moteur n'est pas rebati.
 */
void synth_set_ripple(double rpmAmplitude, double hz) {
    if (g_live == nullptr) return;
    g_live->rippleRpm = rpmAmplitude < 0.0 ? 0.0 : rpmAmplitude;
    g_live->rippleHz = hz < 0.1 ? 0.1 : (hz > 500.0 ? 500.0 : hz);
}

/**
 * L'ondulation du regime depuis le dernier appel, en tours par minute.
 *
 * L'ecart entre le plus haut et le plus bas releve a chaque pas de simulation.
 * Zero veut dire que le vilebrequin tourne a vitesse rigoureusement constante,
 * ce qu'aucun moteur thermique ne fait — et ce qui s'entend comme un son de
 * synthese. La lecture remet le compte a zero.
 */
double synth_rpm_ripple() {
    if (g_live == nullptr || g_live->rpmCount == 0) return 0.0;
    return g_live->rpmMax - g_live->rpmMin;
}

/** Le regime moyen sur la meme fenetre, pour rapporter l'ondulation a sa base. */
double synth_rpm_mean() {
    if (g_live == nullptr || g_live->rpmCount == 0) return 0.0;
    return g_live->rpmSum / (double)g_live->rpmCount;
}

/**
 * Ouvre une fenetre de mesure neuve.
 *
 * Les deux lectures ci-dessus ne remettent rien a zero, sans quoi la premiere
 * appelee viderait ce que la seconde doit lire — et l'ordre des appels
 * deviendrait un piege.
 */
void synth_rpm_window_reset() {
    if (g_live == nullptr) return;
    g_live->rpmCount = 0;
    g_live->rpmSum = 0.0;
}

/** Reserve interne du synthetiseur, en secondes. Diagnostic. */
double synth_latency() {
    return g_live == nullptr ? 0.0 : g_live->simulator->getSynthesizerInputLatency();
}

} // extern "C"

int main(int argc, char **argv) {
    double duration = 1.0;
    if (argc > 1) duration = std::atof(argv[1]);
    // Second argument : le nombre de cylindres, 4 ou 8. Ce n'est pas un detail
    // de confort. La question n'est pas de savoir si le temps reel passe, mais
    // jusqu'a combien de cylindres il passe : un bicylindre bien simule vaudrait
    // mieux qu'un V8 echantillonne.
    int cylinders = 8;
    if (argc > 2) cylinders = std::atoi(argv[2]);

    std::printf("Sonde native engine-sim - %g s de son par releve, %d cylindres\n",
        duration, cylinders);
    std::printf("Chaque ligne : cout processeur pour une seconde de son.\n\n");

    // 10 000 echantillons : la reponse impulsionnelle pleine, telle que le code
    // la plafonne. 100 : le meme calcul sans le poids de la convolution, pour
    // voir ce qu'un ConvolverNode de Web Audio deporterait.
    report("Chaine complete, 10 kHz", run(10000, duration, 10000, cylinders));
    report("Chaine complete, 20 kHz", run(20000, duration, 10000, cylinders));
    report("Convolution courte, 10 kHz", run(10000, duration, 100, cylinders));
    report("Convolution courte, 20 kHz", run(20000, duration, 100, cylinders));

    return 0;
}
