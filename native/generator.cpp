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
#include <cstddef>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <algorithm>
#include <cstring>
#include <string>
#include <vector>

// Les constructeurs de moteur, le contrat et ses valeurs de reference sont dans
// engines.h, partages avec la sonde : un moteur est un tableau de nombres, et ce
// programme en construit un comme le fait le son en direct.
using namespace engines;

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

/**
 * Lit une captation d'echappement : WAV PCM 16 bits mono.
 *
 * Le generateur fabriquait sa propre resonance — un train de pics espaces de
 * 57 Hz, donc un filtre en peigne. Mesure contre la captation que le son en
 * direct utilise depuis le 8 septembre : le tube creuse le medium de 5,3 dB et
 * laisse passer 14 a 22 dB d'aigu de trop. La banque produite sonnait sourde,
 * avec un souffle haute frequence qui bat a contretemps des explosions.
 *
 * Aucun repli silencieux ici : un fichier absent ou mal forme arrete le
 * programme. Une banque produite avec la mauvaise reponse ne se distingue pas a
 * l'oeil d'une bonne, et c'est plusieurs minutes de calcul jetees.
 */
std::vector<int16_t> readImpulseWav(const std::string &path) {
    FILE *f = std::fopen(path.c_str(), "rb");
    if (f == nullptr) {
        std::fprintf(stderr, "captation introuvable : %s\n", path.c_str());
        std::exit(1);
    }

    std::vector<unsigned char> raw;
    unsigned char tampon[65536];
    for (size_t lu = std::fread(tampon, 1, sizeof(tampon), f); lu > 0;
         lu = std::fread(tampon, 1, sizeof(tampon), f)) {
        raw.insert(raw.end(), tampon, tampon + lu);
    }
    std::fclose(f);

    auto u16 = [&raw](size_t i) { return (uint16_t)(raw[i] | (raw[i + 1] << 8)); };
    auto u32 = [&raw](size_t i) {
        return (uint32_t)(raw[i] | (raw[i + 1] << 8) | (raw[i + 2] << 16) | (raw[i + 3] << 24));
    };

    if (raw.size() < 44 || std::memcmp(raw.data(), "RIFF", 4) != 0 ||
        std::memcmp(raw.data() + 8, "WAVE", 4) != 0) {
        std::fprintf(stderr, "pas un WAV : %s\n", path.c_str());
        std::exit(1);
    }

    uint16_t format = 0;
    uint16_t channels = 0;
    uint16_t bits = 0;
    uint32_t rate = 0;
    const unsigned char *data = nullptr;
    uint32_t dataBytes = 0;

    for (size_t i = 12; i + 8 <= raw.size();) {
        const uint32_t taille = u32(i + 4);
        if (std::memcmp(raw.data() + i, "fmt ", 4) == 0 && taille >= 16) {
            format = u16(i + 8);
            channels = u16(i + 10);
            rate = u32(i + 12);
            bits = u16(i + 22);
        } else if (std::memcmp(raw.data() + i, "data", 4) == 0) {
            data = raw.data() + i + 8;
            dataBytes = (uint32_t)std::min<size_t>(taille, raw.size() - i - 8);
        }
        i += 8 + taille + (taille & 1);
    }

    if (data == nullptr || format != 1 || bits != 16 || channels != 1) {
        std::fprintf(stderr,
                     "captation illisible : %s (format %u, %u canaux, %u bits ; "
                     "attendu PCM 16 bits mono)\n",
                     path.c_str(), (unsigned)format, (unsigned)channels, (unsigned)bits);
        std::exit(1);
    }
    if (rate != (uint32_t)kAudioRate) {
        std::fprintf(stderr, "captation a %u Hz : %s (attendu %d)\n", (unsigned)rate,
                     path.c_str(), kAudioRate);
        std::exit(1);
    }

    std::vector<int16_t> samples(dataBytes / 2);
    for (size_t i = 0; i < samples.size(); ++i) {
        samples[i] = (int16_t)(data[2 * i] | (data[2 * i + 1] << 8));
    }
    return samples;
}


/**
 * La reponse d'un tube d'echappement.
 *
 * **Ce n'est pas un bruit.** La premiere version tirait un bruit blanc
 * decroissant, avec ce commentaire : « le contenu importe peu, seule sa
 * longueur pese sur le cout ». C'etait vrai tant qu'on mesurait le cout
 * processeur ; c'est faux des qu'on produit du son a ecouter. Convoluer des
 * explosions par du bruit rend du bruit : mesure sur la banque produite, le
 * spectre remontait de 10 dB entre 2 et 8 kHz, la ou une prise faite sur une
 * vraie voiture descend de 17.
 *
 * Un echappement est un tube. L'onde court jusqu'au bout, se reflechit sur
 * l'extremite ouverte — en changeant de signe —, revient, et ainsi de suite en
 * s'affaiblissant. Sa reponse est donc une suite d'echos espaces du temps
 * d'aller-retour, adoucis a chaque reflexion.
 *
 * Miroir de `exhaustImpulse` dans `src/core/synth/impulse.ts`, qui fait la meme
 * chose pour le son en direct. Toute correction portee la doit l'etre ici.
 */
std::vector<int16_t> makeImpulseResponse(
        unsigned int samples, double sampleRate = 44100.0, double tubeHz = 57.0) {
    std::vector<double> reponse(samples, 0.0);

    const double period = sampleRate / (tubeHz > 1.0 ? tubeHz : 1.0);
    for (unsigned int k = 0; k * period < (double)samples; ++k) {
        const unsigned int position = (unsigned int)(k * period + 0.5);
        if (position >= samples) break;
        // Le signe alterne : l'extremite ouverte reflechit une onde de pression
        // en onde de depression. C'est ce qui met la fondamentale a un demi-tour
        // de tube et non a un tour entier.
        const double sign = (k % 2 == 0) ? 1.0 : -1.0;
        reponse[position] += sign * std::exp(-4.0 * (double)position / samples);
    }

    // Une reflexion reelle s'etale et perd ses aigus. Un train de pics nus
    // sonnerait comme un tuyau d'orgue, pas comme un echappement.
    const double a = 1.0 - std::exp(-2.0 * 3.14159265358979 * 2000.0 / sampleRate);
    double state = 0.0;
    double crete = 0.0;
    for (unsigned int i = 0; i < samples; ++i) {
        state += a * (reponse[i] - state);
        reponse[i] = state;
        const double abs = state < 0 ? -state : state;
        if (abs > crete) crete = abs;
    }

    std::vector<int16_t> ir(samples);
    const double echelle = crete > 0.0 ? 20000.0 / crete : 0.0;
    for (unsigned int i = 0; i < samples; ++i) {
        ir[i] = (int16_t)(reponse[i] * echelle);
    }
    // Le chargeur coupe la queue sous 100 en valeur absolue : on garantit que
    // le dernier echantillon compte, sinon la reponse serait tronquee.
    ir[samples - 1] = 1000;
    return ir;
}

Bench *buildBench(const EngineDefinition &definition, int simFrequency,
                  unsigned int impulseSamples, const std::string &exhaustPath) {
    Bench *bench = new Bench;
    // Le nombre de cylindres est le seul parametre qui choisisse un
    // constructeur ; tout le reste du moteur vient du tableau.
    bench->engine = buildEngine(definition);
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

    // `--exhaust none` : une impulsion unite, donc aucun filtrage. Le banc rend
    // alors le son **sec** du moteur, et c'est `generate.mjs` qui pose
    // l'echappement ensuite.
    //
    // Pourquoi deplacer ce calcul : la convolution d'engine-sim est entiere, et
    // le son en direct n'en garde que 45 % — le reste est le son sec. Mesure du
    // 14 septembre 2026 sur le quatre cylindres a 2 245 tr/min, part d'energie
    // entre 1 et 4 kHz : -21,7 dB sec, -26,3 dB convolue entierement, -18,6 dB
    // sur une prise reelle. Appliquee a cent pour cent, la reponse — celle d'un
    // V8 Chevrolet — remplace le moteur par le corps d'un autre. David :
    // « ca fait trop propre, trop synthetiseur ».
    //
    // La captation d'abord, le tube fabrique seulement quand aucune n'est
    // donnee — c'est ce que dit public/impulse/LISEZMOI.md : la resonance
    // fabriquee « ne sert que de repli ».
    std::vector<int16_t> ir;
    if (exhaustPath == "none") {
        // Trois echantillons : le chargeur coupe la queue sous 100 en valeur
        // absolue, donc une impulsion d'un seul echantillon serait tronquee.
        ir = { 20000, 0, 1000 };
    }
    else if (exhaustPath.empty()) {
        ir = makeImpulseResponse(impulseSamples, kAudioRate);
    }
    else {
        ir = readImpulseWav(exhaustPath);
    }
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

/**
 * Lit la definition de moteur : un nombre par ligne, dans l'ordre du contrat.
 *
 * Pas de JSON, pour la meme raison que dans le module WebAssembly — il faudrait
 * un analyseur, et l'ordre suffit. Le fichier est ecrit par l'outil qui pilote
 * ce programme et reste dans `.brut/` : une banque se refait en le relisant.
 *
 * Un fichier plus court que le contrat laisse les valeurs de reference en place
 * sur la fin, un fichier plus long voit sa queue ignoree. C'est ce qui permet a
 * un binaire d'avance de tourner avec une definition d'hier, et l'inverse.
 *
 * Aucun repli silencieux : un fichier annonce et introuvable arrete le
 * programme. Produire plusieurs minutes de son avec le mauvais moteur ne se voit
 * pas a l'oeil.
 */
EngineDefinition readEngineDefinition(const std::string &path) {
    if (path.empty()) return defaultDefinition(8);

    FILE *f = std::fopen(path.c_str(), "r");
    if (f == nullptr) {
        std::fprintf(stderr, "definition de moteur introuvable : %s\n", path.c_str());
        std::exit(1);
    }

    std::vector<double> lus;
    char ligne[256];
    while (std::fgets(ligne, sizeof(ligne), f) != nullptr) {
        if (ligne[0] == '#' || ligne[0] == '\n' || ligne[0] == '\r') continue;
        double valeur = 0.0;
        if (std::sscanf(ligne, "%lf", &valeur) == 1) lus.push_back(valeur);
    }
    std::fclose(f);

    if (lus.empty()) {
        std::fprintf(stderr, "definition de moteur vide : %s\n", path.c_str());
        std::exit(1);
    }

    // Le nombre de cylindres choisit la colonne de reference, comme dans
    // `synth_create_from` : c'est le seul parametre qui decide d'un autre moteur
    // plutot que d'un reglage.
    const int cylindres = (int)lus[ENGINE_CYLINDERS];
    EngineDefinition def = defaultDefinition(cylindres);
    const size_t n = lus.size() < ENGINE_PARAM_COUNT ? lus.size() : (size_t)ENGINE_PARAM_COUNT;
    for (size_t i = 0; i < n; ++i) def.v[i] = lus[i];
    return def;
}

} // namespace

int main(int argc, char **argv) {
    // Le moteur arrive par fichier. Sans lui, le V8 de reference : c'est ce que
    // ce programme a toujours construit.
    const std::string enginePath = argValue(argc, argv, "--engine-def", "");
    const int simFrequency = std::atoi(argValue(argc, argv, "--sim-hz", "10000"));
    const int impulseSamples = std::atoi(argValue(argc, argv, "--impulse", "10000"));
    // Vide : le tube fabrique. Renseigne : la captation, qui est la norme.
    const std::string exhaustPath = argValue(argc, argv, "--exhaust", "");
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
    const EngineDefinition definition = readEngineDefinition(enginePath);
    Bench *bench =
        buildBench(definition, simFrequency, (unsigned int)impulseSamples, exhaustPath);

    // En-tete du releve, lu par l'outil qui pilote ce programme.
    std::printf("# moteur %s cylindres %d echappements %d sim %d Hz echappement %s\n",
        enginePath.empty() ? "reference" : enginePath.c_str(),
        bench->engine->getCylinderCount(),
        bench->engine->getExhaustSystemCount(), simFrequency,
        exhaustPath.empty() ? "tube fabrique" : exhaustPath.c_str());
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
