// Le banc hors ligne : engine-sim tourne ici, aussi lentement qu'il le faut,
// et enregistre une prise par regime tenu.
//
// C'est l'inverse de la sonde. La sonde chronometre pour savoir si le temps
// reel passe ; ce programme se moque du temps qu'il prend et ne cherche qu'une
// chose : un signal stationnaire, propre, a un regime donne, en charge ou pied
// leve. La voiture ne le fera jamais tourner — elle rejouera ce qu'il ecrit.
//
// Le regime est **tenu par le dynamometre**, pas par le papillon : on lui donne
// une vitesse de rotation et il l'impose, en absorbant le couple quand le
// moteur pousse et en l'entrainant quand il freine. C'est ce qui permet
// d'enregistrer un pied leve a 4 000 tr/min, ce qu'aucune prise sur route ne
// donne proprement.
//
// Le plan des prises arrive sur l'entree standard, une ligne par prise. Le
// programme n'invente rien : ni les regimes, ni les longueurs, ni les noms de
// fichier. Il obeit et il rend compte.

#include "engines.h"

#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

namespace {

using Clock = std::chrono::steady_clock;

constexpr int kAudioRate = 44100;
/** Pas de trame de la simulation. Le meme que dans la voiture : 60 par seconde. */
constexpr double kFrameDt = 1.0 / 60.0;

/**
 * Volume de depart de l'etalonnage.
 *
 * Le niveau brut du synthetiseur n'est pas connu d'avance et l'ecriture en
 * entier 16 bits ecrete sans prevenir. On mesure donc la crete a volume reduit,
 * puis on en deduit le volume d'enregistrement. Le depart est ajuste par
 * tatonnement : mesure, le signal brut va de 830 a 740 000 selon le regime et
 * la charge — pres de soixante decibels, qu'aucun volume unique ne couvre sans
 * ecreter d'un cote ou manquer de resolution de l'autre.
 */
constexpr float kProbeVolumeStart = 0.05f;

/** Au-dela, la mesure d'etalonnage est ecretee : elle ne vaut rien. */
constexpr int kClipping = 32000;

/** En deca, l'etalonnage manque de resolution : moins de 1 % de precision. */
constexpr int kTooQuiet = 300;

/**
 * Crete visee a l'enregistrement, en fraction de la pleine echelle.
 *
 * Basse a dessein. L'etalonnage se fait sur la stabilisation, la prise vient
 * apres, et rien ne garantit qu'elle ne depasse pas : une marge large coute une
 * fraction de bit de resolution la ou l'ecretage coute la prise entiere. Le
 * niveau final est de toute facon repris a la normalisation, apres coup.
 */
constexpr double kTargetPeak = 0.6;

struct Take {
    std::string name;      // nom du fichier de sortie, sans dossier
    double rpm = 1000.0;   // regime tenu par le dynamometre
    double throttle = 1.0; // commande de gaz, 0 = pied leve, 1 = plein gaz
    int samples = 88200;   // longueur exacte de la prise, en echantillons
    double settle = 5.0;   // duree de stabilisation avant enregistrement
};

struct Bench {
    Engine *engine = nullptr;
    Vehicle *vehicle = nullptr;
    Transmission *transmission = nullptr;
    Simulator *simulator = nullptr;
    std::vector<int16_t> scratch;
    double currentRpm = 0.0;
    /** Chambre la plus chaude rencontree depuis le dernier `resetHeat`. */
    double hottest = 0.0;
};

void observeHeat(Bench &bench) {
    for (int i = 0; i < bench.engine->getCylinderCount(); ++i) {
        const double t = bench.engine->getChamber(i)->m_system.temperature();
        if (t > bench.hottest) bench.hottest = t;
    }
}

void setVolume(Bench &bench, float volume) {
    Synthesizer::AudioParameters ap = bench.simulator->synthesizer().getAudioParameters();
    ap.volume = volume;
    bench.simulator->synthesizer().setAudioParameters(ap);
}

/**
 * Fait tourner la chaine et rend ce qui sort.
 *
 * `capture` nul jette le son : c'est la stabilisation. Sinon on remplit jusqu'a
 * la longueur demandee. La crete rencontree est rendue dans tous les cas, c'est
 * elle qui sert a etalonner le volume.
 */
int pump(Bench &bench, int samples, std::vector<int16_t> *capture, int *peak) {
    int produced = 0;
    int guard = 0;
    const int guardLimit = samples * 4 + 10000;

    while (produced < samples && guard < guardLimit) {
        bench.simulator->startFrame(kFrameDt);
        while (bench.simulator->simulateStep()) { /* void */ }
        bench.simulator->endFrame();
        observeHeat(bench);

        int read = 0;
        int inner = 0;
        while (read < 735 && inner < 16) {
            const int want = std::min(735 - read, (int)bench.scratch.size());
            const int n = bench.simulator->readAudioOutput(want, bench.scratch.data());
            if (n <= 0) break;
            for (int i = 0; i < n; ++i) {
                const int magnitude = std::abs((int)bench.scratch[i]);
                if (peak != nullptr && magnitude > *peak) *peak = magnitude;
                if (capture != nullptr && (int)capture->size() < samples) {
                    capture->push_back(bench.scratch[i]);
                }
            }
            read += n;
            inner += 1;
        }
        produced += read;
        guard += (read > 0) ? read : 1;
    }
    return produced;
}

/** Amene le dynamometre au regime demande, sans a-coup. */
void ramp(Bench &bench, double targetRpm, double seconds) {
    const int frames = std::max(1, (int)(seconds * 60.0));
    const double from = bench.currentRpm;
    for (int i = 1; i <= frames; ++i) {
        const double t = (double)i / frames;
        bench.simulator->m_dyno.m_rotationSpeed = units::rpm(from + (targetRpm - from) * t);
        bench.simulator->startFrame(kFrameDt);
        while (bench.simulator->simulateStep()) { /* void */ }
        bench.simulator->endFrame();
        bench.simulator->readAudioOutput((int)bench.scratch.size(), bench.scratch.data());
    }
    bench.currentRpm = targetRpm;
}

void writeWav(const std::string &path, const std::vector<int16_t> &samples) {
    FILE *f = std::fopen(path.c_str(), "wb");
    if (f == nullptr) {
        std::fprintf(stderr, "ecriture impossible : %s\n", path.c_str());
        std::exit(1);
    }

    const uint32_t dataBytes = (uint32_t)(samples.size() * sizeof(int16_t));
    const uint32_t riffSize = 36 + dataBytes;
    const uint16_t channels = 1;
    const uint32_t rate = kAudioRate;
    const uint16_t bits = 16;
    const uint32_t byteRate = rate * channels * bits / 8;
    const uint16_t blockAlign = channels * bits / 8;
    const uint32_t fmtSize = 16;
    const uint16_t pcm = 1;

    std::fwrite("RIFF", 1, 4, f);
    std::fwrite(&riffSize, 4, 1, f);
    std::fwrite("WAVEfmt ", 1, 8, f);
    std::fwrite(&fmtSize, 4, 1, f);
    std::fwrite(&pcm, 2, 1, f);
    std::fwrite(&channels, 2, 1, f);
    std::fwrite(&rate, 4, 1, f);
    std::fwrite(&byteRate, 4, 1, f);
    std::fwrite(&blockAlign, 2, 1, f);
    std::fwrite(&bits, 2, 1, f);
    std::fwrite("data", 1, 4, f);
    std::fwrite(&dataBytes, 4, 1, f);
    std::fwrite(samples.data(), sizeof(int16_t), samples.size(), f);
    std::fclose(f);
}

Bench *buildBench(const std::string &engineName, int simFrequency, unsigned int impulseSamples) {
    Bench *bench = new Bench;
    bench->engine = (engineName == "inline4")
        ? engines::buildInline4()
        : engines::buildCrossplaneV8();
    bench->scratch.resize(4096);

    bench->vehicle = new Vehicle;
    Vehicle::Parameters vp;
    vp.mass = units::mass(2700.0, units::lb);
    vp.dragCoefficient = 0.2;
    vp.crossSectionArea =
        units::distance(66.0, units::inch) * units::distance(56.0, units::inch);
    vp.diffRatio = 3.9;
    vp.tireRadius = units::distance(10.0, units::inch);
    vp.rollingResistance = units::force(300.0, units::N);
    bench->vehicle->initialize(vp);

    static const double gearRatios[6] = { 3.636, 2.375, 1.761, 1.346, 0.971, 0.756 };
    bench->transmission = new Transmission;
    Transmission::Parameters tp;
    tp.GearCount = 6;
    tp.GearRatios = gearRatios;
    tp.MaxClutchTorque = units::torque(300.0, units::ft_lb);
    bench->transmission->initialize(tp);

    bench->simulator = bench->engine->createSimulator(bench->vehicle, bench->transmission);
    bench->simulator->setSimulationFrequency(simFrequency);

    Synthesizer::AudioParameters ap = bench->simulator->synthesizer().getAudioParameters();
    ap.inputSampleNoise = (float)bench->engine->getInitialJitter();
    ap.airNoise = (float)bench->engine->getInitialNoise();
    ap.dF_F_mix = (float)bench->engine->getInitialHighFrequencyGain();
    bench->simulator->synthesizer().setAudioParameters(ap);

    // Le correcteur de niveau est neutralise, et c'est le point le plus
    // important de tout ce fichier.
    //
    // C'est un limiteur a crete : il ramene toute sortie a 30 000, donc rend le
    // meme niveau a 800 tr/min et a 6 000. Une banque construite ainsi n'aurait
    // plus de relief de regime du tout — un moteur qui monte sans forcer. On
    // fige son gain a un, l'ecart entre les prises est mesure apres coup, et
    // c'est le gain de couche du profil qui le porte.
    //
    // `setAudioParameters` ne suffit pas : les bornes du correcteur ne sont
    // lues qu'a l'initialisation du synthetiseur (synthesizer.cpp, initialize).
    // On les ecrit donc directement, les membres sont publics.
    bench->simulator->synthesizer().m_levelingFilter.p_maxLevel = 1.0f;
    bench->simulator->synthesizer().m_levelingFilter.p_minLevel = 1.0f;

    const std::vector<int16_t> ir = engines::makeImpulseResponse(impulseSamples);
    for (int i = 0; i < bench->engine->getExhaustSystemCount(); ++i) {
        bench->simulator->synthesizer().initializeImpulseResponse(
            ir.data(), (unsigned int)ir.size(), 0.01f, i);
    }

    bench->simulator->startAudioRenderingThread();
    bench->engine->getIgnitionModule()->m_enabled = true;

    // On demarre au demarreur, dynamometre coupe, exactement comme la sonde.
    //
    // Mesure a l'appui : engager le dynamometre sur un moteur a l'arret le fait
    // tourner sans jamais s'allumer. A 3 000 tr/min tenus, plein gaz, la chambre
    // la plus chaude plafonnait a 530 K et le couple restait negatif — le banc
    // entrainait un moteur froid. Il faut d'abord qu'il prenne.
    bench->simulator->m_dyno.m_enabled = false;
    bench->simulator->m_starterMotor.m_enabled = true;
    bench->engine->setSpeedControl(0.10);
    for (int i = 0; i < 240; ++i) {
        bench->simulator->startFrame(kFrameDt);
        while (bench->simulator->simulateStep()) { /* void */ }
        bench->simulator->endFrame();
        bench->simulator->readAudioOutput((int)bench->scratch.size(), bench->scratch.data());
        if (i == 60) bench->simulator->m_starterMotor.m_enabled = false;
    }

    // Le dynamometre prend le relais et tient le regime dans les deux sens : il
    // absorbe quand le moteur pousse, il entraine quand il freine.
    bench->currentRpm = bench->engine->getRpm();
    bench->simulator->m_dyno.m_rotationSpeed = units::rpm(bench->currentRpm);
    bench->simulator->m_dyno.m_enabled = true;
    bench->simulator->m_dyno.m_hold = true;

    return bench;
}

void destroyBench(Bench *bench) {
    if (bench == nullptr) return;
    bench->simulator->endAudioRenderingThread();
    bench->simulator->releaseSimulation();
    delete bench->simulator;
    bench->engine->destroy();
    delete bench->engine;
    delete bench->vehicle;
    delete bench->transmission;
    delete bench;
}

const char *argValue(int argc, char **argv, const char *flag, const char *fallback) {
    for (int i = 1; i + 1 < argc; ++i) {
        if (std::strcmp(argv[i], flag) == 0) return argv[i + 1];
    }
    return fallback;
}

} // namespace

int main(int argc, char **argv) {
    const std::string engineName = argValue(argc, argv, "--engine", "crossplaneV8");
    const int simFrequency = std::atoi(argValue(argc, argv, "--sim-hz", "10000"));
    const int impulseSamples = std::atoi(argValue(argc, argv, "--impulse", "10000"));
    const std::string outDir = argValue(argc, argv, "--out-dir", ".");

    std::vector<Take> takes;
    char line[512];
    while (std::fgets(line, sizeof(line), stdin) != nullptr) {
        if (line[0] == '#' || line[0] == '\n' || line[0] == '\r') continue;
        Take take;
        char name[256] = { 0 };
        const int read = std::sscanf(line, "%255s %lf %lf %d %lf",
            name, &take.rpm, &take.throttle, &take.samples, &take.settle);
        if (read < 5) continue;
        take.name = name;
        takes.push_back(take);
    }

    if (takes.empty()) {
        std::fprintf(stderr, "aucune prise dans le plan\n");
        return 1;
    }

    const auto started = Clock::now();
    Bench *bench = buildBench(engineName, simFrequency, (unsigned int)impulseSamples);

    // En-tete du releve, lu par l'outil qui pilote ce programme.
    std::printf("# moteur %s cylindres %d echappements %d sim %d Hz impulsion %d\n",
        engineName.c_str(), bench->engine->getCylinderCount(),
        bench->engine->getExhaustSystemCount(), simFrequency, impulseSamples);
    std::fflush(stdout);

    for (const Take &take : takes) {
        const auto takeStarted = Clock::now();

        bench->engine->setSpeedControl(take.throttle);
        // Le rupteur du moteur mord de lui-meme des que le regime depasse sa
        // limite d'allumage. Les prises ordinaires restent en dessous et ne le
        // declenchent pas ; la prise de rupteur, elle, est simplement demandee
        // au-dessus, et le hachage vient du modele.
        ramp(*bench, take.rpm, 1.0);

        // Stabilisation : les gaz, la temperature des chambres et la queue de
        // convolution mettent du temps a s'etablir. On s'en sert pour etalonner
        // le volume, en corrigeant le tir tant que la mesure ne vaut rien.
        float probeVolume = kProbeVolumeStart;
        int probePeak = 0;
        int calibrations = 0;
        for (int attempt = 0; attempt < 8; ++attempt) {
            setVolume(*bench, probeVolume);
            probePeak = 0;
            const int span = (attempt == 0)
                ? (int)(take.settle * kAudioRate)
                : kAudioRate / 2;
            pump(*bench, span, nullptr, &probePeak);
            calibrations += 1;
            if (probePeak >= kClipping) { probeVolume /= 8.0f; continue; }
            if (probePeak < kTooQuiet) { probeVolume *= 8.0f; continue; }
            break;
        }

        const double truePeak = (probePeak > 0) ? (double)probePeak / probeVolume : 1.0;
        const float volume = (float)((kTargetPeak * 32767.0) / truePeak);
        setVolume(*bench, volume);

        // Le synthetiseur rend par avance : jusqu'a deux mille echantillons
        // dorment deja dans sa memoire tampon, calcules au volume
        // d'etalonnage. Les capturer donnerait un debut de boucle vingt fois
        // trop faible — mesure avant ce rinçage : un saut d'energie de 99,9 %
        // au raccord, sur toutes les prises.
        pump(*bench, kAudioRate / 4, nullptr, nullptr);

        std::vector<int16_t> captured;
        captured.reserve(take.samples);
        int peak = 0;
        bench->hottest = 0.0;
        pump(*bench, take.samples, &captured, &peak);

        // Deux temoins pour savoir si le moteur **brule**, et pas seulement
        // s'il tourne. Un couple negatif au dynamometre veut dire que le banc
        // entraine le moteur au lieu de l'absorber, et une chambre a la
        // temperature de l'air veut dire qu'aucune combustion n'a lieu. Sans
        // eux, une prise muette et une prise pied leve se ressemblent.
        const double torque =
            bench->simulator->getFilteredDynoTorque() / units::torque(1.0, units::ft_lb);
        const double hottest = bench->hottest;

        double energy = 0.0;
        for (const int16_t s : captured) energy += (double)s * (double)s;
        const double rms = captured.empty() ? 0.0 : std::sqrt(energy / captured.size());

        writeWav(outDir + "/" + take.name, captured);

        const double elapsed = std::chrono::duration<double>(Clock::now() - takeStarted).count();
        // Une ligne par prise : nom, regime demande, regime mesure, volume
        // applique, crete et niveau efficace **corriges du volume**, longueur,
        // temps de calcul. L'outil s'en sert pour poser les gains de couche.
        // Un ecretage a l'enregistrement fausse le niveau mesure et abime le
        // son : on le dit plutot que de le laisser passer.
        const int clipped = (peak >= 32767) ? 1 : 0;

        std::printf("%s %.1f %.1f %.9g %.6g %.6g %d %.2f %.1f %.0f %d %d\n",
            take.name.c_str(), take.rpm, bench->engine->getRpm(), (double)volume,
            peak / (double)volume, rms / (double)volume, (int)captured.size(), elapsed,
            torque, hottest, clipped, calibrations);
        std::fflush(stdout);
    }

    destroyBench(bench);

    const double total = std::chrono::duration<double>(Clock::now() - started).count();
    std::printf("# total %.2f s\n", total);
    return 0;
}
