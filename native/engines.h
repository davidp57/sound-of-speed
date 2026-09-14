// Les definitions de moteur d'engine-sim, en C++.
//
// **Un moteur est un tableau de nombres**, celui que decrit
// native/CONTRAT-MOTEUR.md, et ce fichier est ce qui le construit. Le reste du
// depot le remplit : le TypeScript pour le son en direct, une definition de
// banque pour le banc hors ligne.
//
// Il portait auparavant une copie figee de ces constructeurs, avec la geometrie
// ecrite en dur, et l'assumait — « la copie est le prix de ce partage ». Elle a
// coute ce que coutent les copies : le banc hors ligne ne savait produire que
// deux moteurs, et pas ceux que David avait regles a l'oreille. Les
// constructeurs parametres de `probe.cpp` ont donc demenage ici, et `probe.cpp`
// les inclut.
//
// Rien n'est invente dans les valeurs de reference : le quatre cylindres
// decalque le Subaru EJ25 livre avec engine-sim, le V8 croise le GM LS du meme
// dossier.

#ifndef SPEED_NATIVE_ENGINES_H
#define SPEED_NATIVE_ENGINES_H

#include "engine.h"
#include "piston_engine_simulator.h"
#include "transmission.h"
#include "vehicle.h"
#include "standard_valvetrain.h"
#include "direct_throttle_linkage.h"
#include "units.h"
#include "constants.h"

#include <cmath>
#include <cstdlib>
#include <utility>
#include <vector>

namespace engines {

double diskInertia(double mass, double radius) {
    return 0.5 * mass * radius * radius;
}

double rodInertia(double mass, double length) {
    return (1.0 / 12.0) * mass * length * length;
}

// Un lobe de came harmonique, comme le fait `harmonic_cam_lobe` dans le
// langage de script (scripting/include/actions.h).
Function *harmonicCamLobe(double durationAt50Thou, double gamma, double lift, int steps) {
    const double angle = durationAt50Thou / 4;
    const double s = std::pow(2 * units::distance(50, units::thou) / lift, 1 / gamma) - 1;
    const double k = std::acos(s) / angle;
    const double extents = constants::pi / k;
    const double step = extents / (steps - 5.0);

    Function *f = new Function;
    f->initialize(2 * steps + 1, step);
    for (int i = 0; i < steps; ++i) {
        if (i == 0) {
            f->addSample(0.0, lift);
        }
        else {
            const double x = i * step;
            const double l = (x >= extents)
                ? 0.0
                : lift * std::pow(0.5 + 0.5 * std::cos(k * x), gamma);
            f->addSample(x, l);
            f->addSample(-x, l);
        }
    }
    return f;
}

Function *flowCurve(const std::vector<std::pair<double, double>> &samples) {
    Function *f = new Function;
    f->initialize((int)samples.size(), units::distance(50, units::thou));
    for (const auto &s : samples) {
        f->addSample(
            units::distance(s.first, units::thou),
            GasSystem::k_28inH2O(s.second));
    }
    return f;
}

// ---------------------------------------------------------------------------
// La definition d'un moteur, telle qu'un profil la porte.
//
// L'ordre de cette enumeration **est** le contrat : il est fixe par
// native/CONTRAT-MOTEUR.md, le TypeScript ecrit le tableau dans le meme ordre,
// et un test compare les deux listes. Un parametre neuf s'ajoute a la fin ; un
// parametre retire laisse sa place occupee plutot que de decaler les suivants.
//
// Le nom de cle en fin de ligne est ce que le test relit. Il doit rester colle
// au format `// <cle>`, sans rien d'autre sur la ligne.
// ---------------------------------------------------------------------------

enum EngineParam {
    ENGINE_CYLINDERS = 0,             // cylinders
    ENGINE_BORE = 1,                  // bore
    ENGINE_STROKE = 2,                // stroke
    ENGINE_ROD_LENGTH = 3,            // rodLength
    ENGINE_CHAMBER_VOLUME = 4,        // chamberVolume
    ENGINE_INTAKE_RUNNER_VOLUME = 5,  // intakeRunnerVolume
    ENGINE_INTAKE_RUNNER_AREA = 6,    // intakeRunnerArea
    ENGINE_EXHAUST_RUNNER_VOLUME = 7, // exhaustRunnerVolume
    ENGINE_EXHAUST_RUNNER_AREA = 8,   // exhaustRunnerArea
    ENGINE_LOBE_SEPARATION = 9,       // lobeSeparation
    ENGINE_INTAKE_LOBE_CENTER = 10,   // intakeLobeCenter
    ENGINE_EXHAUST_LOBE_CENTER = 11,  // exhaustLobeCenter
    ENGINE_INTAKE_LIFT = 12,          // intakeLift
    ENGINE_EXHAUST_LIFT = 13,         // exhaustLift
    ENGINE_INTAKE_DURATION = 14,      // intakeDuration
    ENGINE_EXHAUST_DURATION = 15,     // exhaustDuration
    ENGINE_PLENUM_VOLUME = 16,        // plenumVolume
    ENGINE_INTAKE_FLOW_RATE = 17,     // intakeFlowRate
    ENGINE_IDLE_THROTTLE_PLATE = 18,  // idleThrottlePlate
    ENGINE_PRIMARY_TUBE_LENGTH = 19,  // primaryTubeLength
    ENGINE_PRIMARY_FLOW_RATE = 20,    // primaryFlowRate
    ENGINE_OUTLET_FLOW_RATE = 21,     // outletFlowRate
    ENGINE_COLLECTOR_VOLUME = 22,     // collectorVolume
    ENGINE_EXHAUST_AUDIO_VOLUME = 23, // exhaustAudioVolume
    ENGINE_REV_LIMIT = 24,            // revLimit
    ENGINE_LIMITER_DURATION = 25,     // limiterDuration
    ENGINE_AIR_NOISE = 26,            // airNoise
    ENGINE_INPUT_SAMPLE_NOISE = 27,   // inputSampleNoise
    ENGINE_HEADER_LENGTH = 28,        // headerLength
    ENGINE_PARAM_COUNT = 29
};

struct EngineDefinition {
    double v[ENGINE_PARAM_COUNT];
    double operator[](int i) const { return v[i]; }
};

// Les valeurs de reference du contrat, colonne EJ25. Elles ne sont pas celles
// que ce fichier portait en dur : l'alesage, la bielle, la chambre, les
// sections de conduit, la levee, la duree, la boite a air et le debit
// d'admission s'en ecartaient, sans que rien ne le dise. Le contrat tranche.
const EngineDefinition DEFAULT_INLINE4 = {{
    4,        // cylinders
    3.917,    // bore
    3.11,     // stroke
    5.142,    // rodLength
    67,       // chamberVolume
    149.6,    // intakeRunnerVolume
    1.8225,   // intakeRunnerArea
    50,       // exhaustRunnerVolume
    1.5625,   // exhaustRunnerArea
    114,      // lobeSeparation
    114,      // intakeLobeCenter
    114,      // exhaustLobeCenter
    0.395,    // intakeLift
    0.377,    // exhaustLift
    220,      // intakeDuration
    220,      // exhaustDuration
    1.325,    // plenumVolume
    800,      // intakeFlowRate
    0.9985,   // idleThrottlePlate
    10,       // primaryTubeLength
    200,      // primaryFlowRate
    1000,     // outletFlowRate
    100,      // collectorVolume
    4.0,      // exhaustAudioVolume
    6500,     // revLimit — le contrat ne le fixe pas, il vient du profil
    0.08,     // limiterDuration
    0.15,     // airNoise
    0.05,     // inputSampleNoise
    10,       // headerLength
}};

// Colonne GM LS du contrat, memes remarques : la chambre, les sections de
// conduit, la duree de came, la boite a air et le debit d'admission
// s'ecartaient de la reference.
const EngineDefinition DEFAULT_CROSSPLANE_V8 = {{
    8,        // cylinders
    3.78,     // bore
    3.622,    // stroke
    6.299,    // rodLength
    90,       // chamberVolume
    149.6,    // intakeRunnerVolume
    4.84,     // intakeRunnerArea
    50,       // exhaustRunnerVolume
    3.0625,   // exhaustRunnerArea
    114,      // lobeSeparation
    114,      // intakeLobeCenter
    114,      // exhaustLobeCenter
    0.551,    // intakeLift
    0.551,    // exhaustLift
    234,      // intakeDuration
    234,      // exhaustDuration
    1.325,    // plenumVolume
    700,      // intakeFlowRate
    0.9985,   // idleThrottlePlate — juge a l oreille, voir defaults.ts
    29,       // primaryTubeLength
    500,      // primaryFlowRate
    1000,     // outletFlowRate
    100,      // collectorVolume
    4.0,      // exhaustAudioVolume
    6800,     // revLimit — le contrat ne le fixe pas, il vient du profil
    0.2,      // limiterDuration
    0.15,     // airNoise
    0.05,     // inputSampleNoise
    20,       // headerLength
}};

const EngineDefinition &defaultDefinition(int cylinders) {
    return cylinders == 4 ? DEFAULT_INLINE4 : DEFAULT_CROSSPLANE_V8;
}

// Un pouce carre, en unites internes. Les sections de conduit sont donnees en
// pouces carres par le contrat, la ou le code d'origine ecrivait un produit de
// deux cotes.
const double INCH2 =
    units::distance(1.0, units::inch) * units::distance(1.0, units::inch);

// Le pendant direct de es_script::EngineNode::buildEngine(), sans piranha.
Engine *buildInline4(const EngineDefinition &def) {
    const double stroke = units::distance(def[ENGINE_STROKE], units::inch);
    const double bore = units::distance(def[ENGINE_BORE], units::inch);
    const double rodLength = units::distance(def[ENGINE_ROD_LENGTH], units::inch);
    const double rodMass = units::mass(535.0, units::g);
    const double compressionHeight = units::distance(1.0, units::inch);
    const double crankMass = units::mass(9.39, units::kg);
    const double flywheelMass = units::mass(6.8, units::kg);
    const double flywheelRadius = units::distance(6.0, units::inch);
    const double cycle = 2 * 360 * units::deg;

    Engine *engine = new Engine;

    Engine::Parameters params;
    params.name = "Sonde I4";
    params.cylinderBanks = 1;
    // Le nombre de cylindres choisit le constructeur, il ne se lit pas ici :
    // ordre d'allumage et angles de manetons le suivent, et ils definissent le
    // moteur.
    params.cylinderCount = 4;
    params.crankshaftCount = 1;
    params.exhaustSystemCount = 1;
    params.intakeCount = 1;
    params.starterTorque = units::torque(70.0, units::ft_lb);
    params.starterSpeed = units::rpm(500);
    params.redline = units::rpm(6500);
    params.dynoMinSpeed = units::rpm(1000);
    params.dynoMaxSpeed = units::rpm(6500);
    params.dynoHoldStep = units::rpm(100);
    params.initialSimulationFrequency = 10000;
    params.initialHighFrequencyGain = 0.01;
    // Les deux bruits que le synthetiseur ajoute a dessein. Sans ces deux
    // lignes, ils valent 1,0 et 0,5 — les valeurs de la structure d'engine-sim,
    // qui sont des valeurs de demonstration. Mesure sur le ralenti d'un quatre
    // cylindres : elles produisaient un plateau plat de 250 Hz a 2 kHz et une
    // remontee de 11 dB entre 2 et 8 kHz, la ou un moteur decroit. Le bruit
    // d'air ne s'ajoute pas au signal, il le **multiplie** : a un, le moteur
    // disparait derriere sa propre modulation.
    //
    // Pas zero pour autant : un moteur a du souffle, et le retirer tout a fait
    // sonne synthetique.
    params.initialNoise = def[ENGINE_AIR_NOISE];
    params.initialJitter = def[ENGINE_INPUT_SAMPLE_NOISE];

    DirectThrottleLinkage *throttle = new DirectThrottleLinkage;
    DirectThrottleLinkage::Parameters throttleParams;
    throttleParams.gamma = 2.0;
    throttle->initialize(throttleParams);
    params.throttle = throttle;

    engine->initialize(params);

    // Vilebrequin : manetons a 0, 180, 180, 0 degres.
    Crankshaft::Parameters crankParams;
    crankParams.mass = crankMass;
    crankParams.flywheelMass = flywheelMass;
    crankParams.momentOfInertia =
        diskInertia(crankMass, stroke / 2)
        + diskInertia(flywheelMass, flywheelRadius)
        + diskInertia(units::mass(10.0, units::kg), units::distance(6.0, units::cm));
    crankParams.crankThrow = stroke / 2;
    crankParams.frictionTorque = units::torque(1.0, units::ft_lb);
    crankParams.tdc = 90 * units::deg;  // banc vertical (angle 0), comme les moteurs en ligne livres
    crankParams.rodJournals = 4;
    Crankshaft *crank = engine->getCrankshaft(0);
    crank->initialize(crankParams);

    const double journalAngles[4] = {
        0.0 * units::deg, 180.0 * units::deg, 180.0 * units::deg, 0.0 * units::deg };
    for (int i = 0; i < 4; ++i) {
        crank->setRodJournalAngle(i, journalAngles[i]);
    }

    CylinderBank *bank = engine->getCylinderBank(0);
    CylinderBank::Parameters bankParams;
    bankParams.crankshaft = crank;
    bankParams.positionX = 0.0;
    bankParams.positionY = 0.0;
    bankParams.angle = 0.0;
    bankParams.bore = bore;
    bankParams.deckHeight = stroke / 2 + rodLength + compressionHeight;
    bankParams.displayDepth = 0.0;
    bankParams.cylinderCount = 4;
    bankParams.index = 0;
    bank->initialize(bankParams);

    for (int i = 0; i < 4; ++i) {
        Piston *piston = engine->getPiston(i);
        ConnectingRod *rod = engine->getConnectingRod(i);

        Piston::Parameters pistonParams;
        pistonParams.Rod = rod;
        pistonParams.Bank = bank;
        pistonParams.CylinderIndex = i;
        pistonParams.BlowbyFlowCoefficient = GasSystem::k_28inH2O(0.001);
        pistonParams.CompressionHeight = compressionHeight;
        pistonParams.WristPinPosition = 0.0;
        pistonParams.Displacement = 0.0;
        pistonParams.mass = units::mass(414.0 + 152.0, units::g);
        piston->initialize(pistonParams);

        ConnectingRod::Parameters rodParams;
        rodParams.mass = rodMass;
        rodParams.momentOfInertia = rodInertia(rodMass, rodLength);
        rodParams.centerOfMass = 0.0;
        rodParams.length = rodLength;
        rodParams.rodJournals = 0;
        rodParams.slaveThrow = 0.0;
        rodParams.piston = piston;
        rodParams.crankshaft = crank;
        rodParams.master = nullptr;
        rodParams.journal = i;
        rod->initialize(rodParams);
    }

    // Ordre d'allumage 1-3-4-2 : l'angle d'allumage de chaque cylindre, dans
    // l'ordre ou ils sont ranges dans le banc.
    const double firingAngle[4] = {
        0.00 * cycle, 0.75 * cycle, 0.25 * cycle, 0.50 * cycle };

    // Deux profils de came au lieu d'un : le contrat donne une levee et une
    // duree par cote, comme les fichiers de reference.
    Function *intakeLobe = harmonicCamLobe(
        def[ENGINE_INTAKE_DURATION] * units::deg, 2.0,
        units::distance(def[ENGINE_INTAKE_LIFT], units::inch), 100);
    Function *exhaustLobe = harmonicCamLobe(
        def[ENGINE_EXHAUST_DURATION] * units::deg, 2.0,
        units::distance(def[ENGINE_EXHAUST_LIFT], units::inch), 100);

    // `lobeSeparation` ne sert qu'a poser les deux centres par defaut, comme
    // dans le langage de script (`intake_lobe_center: lobe_separation`). Ce
    // sont les centres qui calent les cames ici.
    const double intakeLobeCenter = def[ENGINE_INTAKE_LOBE_CENTER] * units::deg;
    const double exhaustLobeCenter = def[ENGINE_EXHAUST_LOBE_CENTER] * units::deg;
    const double rot360 = 360 * units::deg;

    Camshaft *intakeCam = new Camshaft;
    Camshaft *exhaustCam = new Camshaft;
    Camshaft::Parameters camParams;
    camParams.lobes = 4;
    camParams.advance = 0.0;
    camParams.crankshaft = crank;
    camParams.baseRadius = units::distance(1.0, units::inch);
    camParams.lobeProfile = intakeLobe;
    intakeCam->initialize(camParams);
    camParams.lobeProfile = exhaustLobe;
    exhaustCam->initialize(camParams);
    for (int i = 0; i < 4; ++i) {
        intakeCam->setLobeCenterline(i, rot360 + intakeLobeCenter + firingAngle[i]);
        exhaustCam->setLobeCenterline(i, rot360 - exhaustLobeCenter + firingAngle[i]);
    }

    StandardValvetrain *valvetrain = new StandardValvetrain;
    StandardValvetrain::Parameters valvetrainParams;
    valvetrainParams.intakeCamshaft = intakeCam;
    valvetrainParams.exhaustCamshaft = exhaustCam;
    valvetrain->initialize(valvetrainParams);

    CylinderHead *head = engine->getHead(0);
    CylinderHead::Parameters headParams;
    headParams.Bank = bank;
    headParams.Valvetrain = valvetrain;
    headParams.IntakePortFlow = flowCurve({
        {0, 0}, {50, 58}, {100, 103}, {150, 156}, {200, 214},
        {250, 249}, {300, 268}, {350, 280}, {400, 280}, {450, 281} });
    headParams.ExhaustPortFlow = flowCurve({
        {0, 0}, {50, 37}, {100, 72}, {150, 113}, {200, 160},
        {250, 196}, {300, 222}, {350, 235}, {400, 245}, {450, 246} });
    headParams.CombustionChamberVolume = def[ENGINE_CHAMBER_VOLUME] * units::cc;
    headParams.IntakeRunnerVolume = def[ENGINE_INTAKE_RUNNER_VOLUME] * units::cc;
    headParams.IntakeRunnerCrossSectionArea = def[ENGINE_INTAKE_RUNNER_AREA] * INCH2;
    headParams.ExhaustRunnerVolume = def[ENGINE_EXHAUST_RUNNER_VOLUME] * units::cc;
    headParams.ExhaustRunnerCrossSectionArea = def[ENGINE_EXHAUST_RUNNER_AREA] * INCH2;
    headParams.FlipDisplay = false;
    head->initialize(headParams);

    Intake *intake = engine->getIntake(0);
    Intake::Parameters intakeParams;
    intakeParams.volume = def[ENGINE_PLENUM_VOLUME] * units::L;
    intakeParams.CrossSectionArea = 20.0 * units::cm2;
    intakeParams.InputFlowK = GasSystem::k_carb(def[ENGINE_INTAKE_FLOW_RATE]);
    intakeParams.IdleFlowK = GasSystem::k_carb(0.0);
    intakeParams.RunnerFlowRate = GasSystem::k_carb(250.0);
    // Le papillon au ralenti, a la valeur de reference d'engine-sim.
    //
    // Il valait 0,9985 chez nous, quasiment ferme. Le debit d'air passe en
    // cosinus de l'angle : cos(0,9985 * pi/2) = 0,0024 contre 0,0393 a 0,975,
    // soit **dix-sept fois moins d'air**. Le moteur etait asphyxie au ralenti,
    // il ne brulait presque pas, et ce qu'on entendait etait le pompage.
    //
    // C'est le defaut d'engine-sim (intake.h), et les moteurs qu'il livre le
    // gardent tel quel.
    intakeParams.IdleThrottlePlatePosition = def[ENGINE_IDLE_THROTTLE_PLATE];
    intakeParams.RunnerLength = units::distance(12.0, units::inch);
    intakeParams.VelocityDecay = 0.5;
    intake->initialize(intakeParams);

    // La reponse impulsionnelle n'est qu'un nom de fichier ici : la sonde
    // fabrique elle-meme les echantillons, plus bas.
    ImpulseResponse *impulse = new ImpulseResponse;
    impulse->initialize("sonde", 0.01);

    ExhaustSystem *exhaust = engine->getExhaustSystem(0);
    ExhaustSystem::Parameters exhaustParams;
    // Le langage de script derive la longueur du volume : length = volume /
    // collector_cross_section_area (es/objects/objects.mr).
    const double collectorArea = constants::pi
        * units::distance(2.0, units::inch) * units::distance(2.0, units::inch);
    exhaustParams.length = (def[ENGINE_COLLECTOR_VOLUME] * units::L) / collectorArea;
    exhaustParams.collectorCrossSectionArea = collectorArea;
    exhaustParams.outletFlowRate = GasSystem::k_carb(def[ENGINE_OUTLET_FLOW_RATE]);
    exhaustParams.primaryTubeLength =
        units::distance(def[ENGINE_PRIMARY_TUBE_LENGTH], units::inch);
    exhaustParams.primaryFlowRate = GasSystem::k_carb(def[ENGINE_PRIMARY_FLOW_RATE]);
    exhaustParams.velocityDecay = 1.0;
    // L'EJ25 declare `audio_volume: 0.5 * 8`, soit quatre.
    exhaustParams.audioVolume = def[ENGINE_EXHAUST_AUDIO_VOLUME];
    exhaustParams.impulseResponse = impulse;
    exhaust->initialize(exhaustParams);

    for (int i = 0; i < 4; ++i) {
        head->setIntake(i, intake);
        head->setExhaustSystem(i, exhaust);
        head->setSoundAttenuation(i, 1.0);
        // Le quatre cylindres n'etage pas ses collecteurs — l'EJ25 n'en declare
        // aucune longueur, et c'est pourquoi il n'a pas les resonances
        // multiples du V8.
        head->setHeaderPrimaryLength(
            i, units::distance(def[ENGINE_HEADER_LENGTH], units::inch));
    }

    Function *timingCurve = new Function;
    timingCurve->initialize(5, units::rpm(1000));
    timingCurve->addSample(units::rpm(0), 25 * units::deg);
    timingCurve->addSample(units::rpm(1000), 25 * units::deg);
    timingCurve->addSample(units::rpm(2000), 30 * units::deg);
    timingCurve->addSample(units::rpm(3000), 40 * units::deg);
    timingCurve->addSample(units::rpm(4000), 40 * units::deg);

    IgnitionModule::Parameters ignitionParams;
    ignitionParams.cylinderCount = 4;
    ignitionParams.crankshaft = crank;
    ignitionParams.timingCurve = timingCurve;
    // Le rupteur suit le profil, il n'est plus fige.
    //
    // Il valait 6 500 et 6 800 en dur, quand le profil Sport monte a 8 500 :
    // passe 6 800, engine-sim coupait l'allumage. Il ne restait alors que le
    // pompage d'air, aigu et sans corps — David l'a entendu comme « la
    // frequence sourde tout d'un coup coupee », vers 6 900 tr/min.
    ignitionParams.revLimit = units::rpm(def[ENGINE_REV_LIMIT]);
    ignitionParams.limiterDuration = def[ENGINE_LIMITER_DURATION];
    engine->getIgnitionModule()->initialize(ignitionParams);
    for (int i = 0; i < 4; ++i) {
        engine->getIgnitionModule()->setFiringOrder(i, firingAngle[i]);
    }

    Function *turbulence = new Function;
    turbulence->initialize(30, 1);
    for (int i = 0; i < 30; ++i) {
        turbulence->addSample((double)i, i * 0.5);
    }

    // La courbe par defaut du langage de script (es/objects/objects.mr) :
    // sans elle, la combustion dereference un pointeur nul.
    Function *flameSpeed = new Function;
    flameSpeed->initialize(10, 5.0);
    flameSpeed->addSample(0.0, 3.0);
    for (int i = 1; i < 10; ++i) {
        flameSpeed->addSample(i * 5.0, 1.5 * i * 5.0);
    }

    Fuel *fuel = engine->getFuel();
    Fuel::Parameters fuelParams;
    fuelParams.maxTurbulenceEffect = 2.5;
    fuelParams.maxBurningEfficiency = 0.75;
    fuelParams.turbulenceToFlameSpeedRatio = flameSpeed;
    fuel->initialize(fuelParams);

    CombustionChamber::Parameters ccParams;
    ccParams.CrankcasePressure = units::pressure(1.0, units::atm);
    ccParams.Fuel = fuel;
    ccParams.StartingPressure = units::pressure(1.0, units::atm);
    ccParams.StartingTemperature = units::celcius(25.0);
    ccParams.MeanPistonSpeedToTurbulence = turbulence;
    for (int i = 0; i < engine->getCylinderCount(); ++i) {
        ccParams.Piston = engine->getPiston(i);
        ccParams.Head = engine->getHead(ccParams.Piston->getCylinderBank()->getIndex());
        engine->getChamber(i)->initialize(ccParams);
    }

    engine->calculateDisplacement();
    return engine;
}


/**
 * Un V8 americain a vilebrequin croise, releve sur le GM LS livre avec
 * engine-sim (assets/engines/atg-video-2/07_gm_ls.mr).
 *
 * Rien n'y est invente : angle de V, point mort haut, angles de manetons, ordre
 * d'allumage et repartition des cylindres entre les bancs sont recopies du
 * fichier. Deux details qui ne se devinent pas :
 *
 * - le point mort haut depend de l'angle du banc. Le script l'ecrit
 *   `90 deg - v_angle / 2`, soit 45 degres ici. Avec une autre valeur le moteur
 *   demarre, allume, et cale : l'etincelle tombe au mauvais endroit.
 * - les manetons a 0, 270, 90 et 180 degres sont **la** definition du
 *   vilebrequin croise. C'est de la que vient le grondement inegal : chaque banc
 *   voit ses allumages espaces de 90 puis 180 degres, et non regulierement.
 */
Engine *buildCrossplaneV8(const EngineDefinition &def) {
    const double stroke = units::distance(def[ENGINE_STROKE], units::inch);
    const double bore = units::distance(def[ENGINE_BORE], units::inch);
    const double rodLength = units::distance(def[ENGINE_ROD_LENGTH], units::inch);
    const double rodMass = units::mass(675.0, units::g);
    const double compressionHeight = units::distance(1.115, units::inch);
    const double crankMass = units::mass(20.0, units::kg);
    const double flywheelMass = units::mass(9.0, units::kg);
    const double flywheelRadius = units::distance(6.0, units::inch);
    const double vAngle = 90.0 * units::deg;

    Engine *engine = new Engine;

    Engine::Parameters params;
    params.name = "Sonde V8 croise";
    params.cylinderBanks = 2;
    params.cylinderCount = 8;
    params.crankshaftCount = 1;
    params.exhaustSystemCount = 2;
    params.intakeCount = 1;
    params.starterTorque = units::torque(200.0, units::ft_lb);
    params.starterSpeed = units::rpm(500);
    params.redline = units::rpm(6500);
    params.dynoMinSpeed = units::rpm(1000);
    params.dynoMaxSpeed = units::rpm(6500);
    params.dynoHoldStep = units::rpm(100);
    params.initialSimulationFrequency = 10000;
    params.initialHighFrequencyGain = 0.01;
    // Les deux bruits que le synthetiseur ajoute a dessein. Sans ces deux
    // lignes, ils valent 1,0 et 0,5 — les valeurs de la structure d'engine-sim,
    // qui sont des valeurs de demonstration. Mesure sur le ralenti d'un quatre
    // cylindres : elles produisaient un plateau plat de 250 Hz a 2 kHz et une
    // remontee de 11 dB entre 2 et 8 kHz, la ou un moteur decroit. Le bruit
    // d'air ne s'ajoute pas au signal, il le **multiplie** : a un, le moteur
    // disparait derriere sa propre modulation.
    //
    // Pas zero pour autant : un moteur a du souffle, et le retirer tout a fait
    // sonne synthetique.
    params.initialNoise = def[ENGINE_AIR_NOISE];
    params.initialJitter = def[ENGINE_INPUT_SAMPLE_NOISE];

    DirectThrottleLinkage *throttle = new DirectThrottleLinkage;
    DirectThrottleLinkage::Parameters throttleParams;
    throttleParams.gamma = 2.0;
    throttle->initialize(throttleParams);
    params.throttle = throttle;

    engine->initialize(params);

    Crankshaft::Parameters crankParams;
    crankParams.mass = crankMass;
    crankParams.flywheelMass = flywheelMass;
    crankParams.momentOfInertia =
        diskInertia(crankMass, stroke / 2)
        + diskInertia(flywheelMass, flywheelRadius)
        + diskInertia(units::mass(10.0, units::kg), units::distance(6.0, units::cm));
    crankParams.crankThrow = stroke / 2;
    crankParams.frictionTorque = units::torque(2.0, units::ft_lb);
    crankParams.tdc = 90 * units::deg - vAngle / 2.0;
    crankParams.rodJournals = 4;
    Crankshaft *crank = engine->getCrankshaft(0);
    crank->initialize(crankParams);

    // Le croisement, recopie du GM LS.
    const double journalAngles[4] = {
        0.0 * units::deg, 270.0 * units::deg, 90.0 * units::deg, 180.0 * units::deg };
    for (int i = 0; i < 4; ++i) crank->setRodJournalAngle(i, journalAngles[i]);

    CylinderBank *banks[2];
    for (int b = 0; b < 2; ++b) {
        banks[b] = engine->getCylinderBank(b);
        CylinderBank::Parameters bankParams;
        bankParams.crankshaft = crank;
        bankParams.positionX = 0.0;
        bankParams.positionY = 0.0;
        bankParams.angle = (b == 0 ? -vAngle / 2.0 : vAngle / 2.0);
        bankParams.bore = bore;
        bankParams.deckHeight = stroke / 2 + rodLength + compressionHeight;
        bankParams.displayDepth = 0.0;
        bankParams.cylinderCount = 4;
        bankParams.index = b;
        banks[b]->initialize(bankParams);
    }

    // Ordre d'allumage 1-8-7-2-6-5-4-3, traduit en angle par cylindre. Les
    // cylindres impairs sont sur le banc 0, les pairs sur le banc 1.
    const double wireAngle[9] = {
        0.0,
        0 * 90 * units::deg,
        3 * 90 * units::deg,
        7 * 90 * units::deg,
        6 * 90 * units::deg,
        5 * 90 * units::deg,
        4 * 90 * units::deg,
        2 * 90 * units::deg,
        1 * 90 * units::deg };
    const int wireOf[8] = { 1, 3, 5, 7, 2, 4, 6, 8 };
    double firingAngle[8];
    for (int i = 0; i < 8; ++i) firingAngle[i] = wireAngle[wireOf[i]];

    for (int i = 0; i < 8; ++i) {
        const int bank = i / 4;
        const int inBank = i % 4;
        Piston *piston = engine->getPiston(i);
        ConnectingRod *rod = engine->getConnectingRod(i);

        Piston::Parameters pistonParams;
        pistonParams.Rod = rod;
        pistonParams.Bank = banks[bank];
        pistonParams.CylinderIndex = inBank;
        pistonParams.BlowbyFlowCoefficient = GasSystem::k_28inH2O(0.001);
        pistonParams.CompressionHeight = compressionHeight;
        pistonParams.WristPinPosition = 0.0;
        pistonParams.Displacement = 0.0;
        pistonParams.mass = units::mass(500.0 + 180.0, units::g);
        piston->initialize(pistonParams);

        ConnectingRod::Parameters rodParams;
        rodParams.mass = rodMass;
        rodParams.momentOfInertia = rodInertia(rodMass, rodLength);
        rodParams.centerOfMass = 0.0;
        rodParams.length = rodLength;
        rodParams.rodJournals = 0;
        rodParams.slaveThrow = 0.0;
        rodParams.piston = piston;
        rodParams.crankshaft = crank;
        rodParams.master = nullptr;
        // Les deux bancs partagent les memes manetons : c'est ce qui fait un V.
        rodParams.journal = inBank;
        rod->initialize(rodParams);
    }

    // Deux profils de came au lieu d'un : le contrat donne une levee et une
    // duree par cote, comme les fichiers de reference.
    Function *intakeLobe = harmonicCamLobe(
        def[ENGINE_INTAKE_DURATION] * units::deg, 2.0,
        units::distance(def[ENGINE_INTAKE_LIFT], units::inch), 100);
    Function *exhaustLobe = harmonicCamLobe(
        def[ENGINE_EXHAUST_DURATION] * units::deg, 2.0,
        units::distance(def[ENGINE_EXHAUST_LIFT], units::inch), 100);

    // `lobeSeparation` ne sert qu'a poser les deux centres par defaut, comme
    // dans le langage de script. Ce sont les centres qui calent les cames ici.
    const double intakeLobeCenter = def[ENGINE_INTAKE_LOBE_CENTER] * units::deg;
    const double exhaustLobeCenter = def[ENGINE_EXHAUST_LOBE_CENTER] * units::deg;
    const double rot360 = 360 * units::deg;

    Intake *intake = engine->getIntake(0);
    Intake::Parameters intakeParams;
    intakeParams.volume = def[ENGINE_PLENUM_VOLUME] * units::L;
    intakeParams.CrossSectionArea = 40.0 * units::cm2;
    intakeParams.InputFlowK = GasSystem::k_carb(def[ENGINE_INTAKE_FLOW_RATE]);
    intakeParams.IdleFlowK = GasSystem::k_carb(0.0);
    intakeParams.RunnerFlowRate = GasSystem::k_carb(300.0);
    // Le papillon au ralenti, a la valeur de reference d'engine-sim.
    //
    // Il valait 0,9985 chez nous, quasiment ferme. Le debit d'air passe en
    // cosinus de l'angle : cos(0,9985 * pi/2) = 0,0024 contre 0,0393 a 0,975,
    // soit **dix-sept fois moins d'air**. Le moteur etait asphyxie au ralenti,
    // il ne brulait presque pas, et ce qu'on entendait etait le pompage.
    //
    // C'est le defaut d'engine-sim (intake.h), et les moteurs qu'il livre le
    // gardent tel quel.
    intakeParams.IdleThrottlePlatePosition = def[ENGINE_IDLE_THROTTLE_PLATE];
    intakeParams.RunnerLength = units::distance(8.0, units::inch);
    intakeParams.VelocityDecay = 0.5;
    intake->initialize(intakeParams);

    for (int b = 0; b < 2; ++b) {
        Camshaft *intakeCam = new Camshaft;
        Camshaft *exhaustCam = new Camshaft;
        Camshaft::Parameters camParams;
        camParams.lobes = 4;
        camParams.advance = 0.0;
        camParams.crankshaft = crank;
        camParams.baseRadius = units::distance(1.0, units::inch);
        camParams.lobeProfile = intakeLobe;
        intakeCam->initialize(camParams);
        camParams.lobeProfile = exhaustLobe;
        exhaustCam->initialize(camParams);
        for (int i = 0; i < 4; ++i) {
            const double angle = firingAngle[b * 4 + i];
            intakeCam->setLobeCenterline(i, rot360 + intakeLobeCenter + angle);
            exhaustCam->setLobeCenterline(i, rot360 - exhaustLobeCenter + angle);
        }

        StandardValvetrain *valvetrain = new StandardValvetrain;
        StandardValvetrain::Parameters valvetrainParams;
        valvetrainParams.intakeCamshaft = intakeCam;
        valvetrainParams.exhaustCamshaft = exhaustCam;
        valvetrain->initialize(valvetrainParams);

        CylinderHead *head = engine->getHead(b);
        CylinderHead::Parameters headParams;
        headParams.Bank = banks[b];
        headParams.Valvetrain = valvetrain;
        headParams.IntakePortFlow = flowCurve({
            {0, 0}, {100, 69}, {200, 129}, {300, 180}, {400, 214},
            {500, 249}, {600, 268}, {700, 280} });
        headParams.ExhaustPortFlow = flowCurve({
            {0, 0}, {100, 53}, {200, 101}, {300, 135}, {400, 168},
            {500, 189}, {600, 206}, {700, 212} });
        headParams.CombustionChamberVolume = def[ENGINE_CHAMBER_VOLUME] * units::cc;
        headParams.IntakeRunnerVolume = def[ENGINE_INTAKE_RUNNER_VOLUME] * units::cc;
        headParams.IntakeRunnerCrossSectionArea = def[ENGINE_INTAKE_RUNNER_AREA] * INCH2;
        headParams.ExhaustRunnerVolume = def[ENGINE_EXHAUST_RUNNER_VOLUME] * units::cc;
        headParams.ExhaustRunnerCrossSectionArea = def[ENGINE_EXHAUST_RUNNER_AREA] * INCH2;
        headParams.FlipDisplay = (b == 1);
        head->initialize(headParams);

        // Une ligne d'echappement par banc : c'est ce qui fait qu'un V8 croise
        // ne sonne pas comme deux quatre cylindres cote a cote.
        ImpulseResponse *impulse = new ImpulseResponse;
        impulse->initialize("sonde", 0.01);

        ExhaustSystem *exhaust = engine->getExhaustSystem(b);
        ExhaustSystem::Parameters exhaustParams;
        const double collectorArea = constants::pi
            * units::distance(2.0, units::inch) * units::distance(2.0, units::inch);
        exhaustParams.length = (def[ENGINE_COLLECTOR_VOLUME] * units::L) / collectorArea;
        exhaustParams.collectorCrossSectionArea = collectorArea;
        // L'echappement, releve sur le GM LS lui aussi.
        //
        // Il ne l'etait pas : ces valeurs venaient du quatre cylindres, dont
        // l'echappement est celui d'un EJ25 Subaru. Le V8 portait donc la ligne
        // d'une Subaru — et c'est l'echappement qui fait le son. Le commentaire
        // en tete disait « rien n'y est invente » en enumerant ce qui est
        // recopie : angle de V, point mort haut, manetons, ordre d'allumage,
        // repartition des bancs. L'echappement n'etait pas dans la liste.
        exhaustParams.outletFlowRate = GasSystem::k_carb(def[ENGINE_OUTLET_FLOW_RATE]);
        exhaustParams.primaryTubeLength =
            units::distance(def[ENGINE_PRIMARY_TUBE_LENGTH], units::inch);
        exhaustParams.primaryFlowRate = GasSystem::k_carb(def[ENGINE_PRIMARY_FLOW_RATE]);
        exhaustParams.velocityDecay = 1.0;
        exhaustParams.audioVolume = def[ENGINE_EXHAUST_AUDIO_VOLUME];
        exhaustParams.impulseResponse = impulse;
        exhaust->initialize(exhaustParams);

        for (int i = 0; i < 4; ++i) {
            head->setIntake(i, intake);
            head->setExhaustSystem(i, exhaust);
            head->setSoundAttenuation(i, 1.0);
            // La longueur de collecteur de chaque cylindre.
            //
            // **Ce n'est pas la longueur du tube primaire**, et les confondre
            // etait une erreur : le tube primaire vaut vingt-neuf pouces sur le
            // GM LS, quand ses quatre collecteurs mesurent de 6,79 a 1,97 pouce.
            // On posait 29, 31, 33 et 35 pouces — cinq a dix fois trop long, et
            // croissant la ou les fichiers decroissent. Quatre resonances
            // fausses, que le quatre cylindres n'a pas puisqu'il n'etage rien :
            // c'est ce que David entendait comme « des frequences parasites par
            // dessus, qu'on dirait synchro sur le cote rugueux mais plus
            // aigues ».
            //
            // Le 454 les ecrit `distance * 4, 3, 2, 1` avec `distance` a cinq
            // pouces, soit 20, 15, 10 et 5. On reprend cette regle : le premier
            // cylindre porte le collecteur le plus long, et les suivants s'en
            // deduisent par quarts.
            // La longueur est reglable parce qu'elle arbitre : longue, elle
            // apporte le cote rugueux et vivant en charge **et** des frequences
            // parasites au ralenti ; courte, elle enleve les deux. David :
            // « moins (mais toujours) de parasites, et par contre un moteur
            // bien moins vivant en charge ». C'est un compromis, donc un
            // curseur, et non une valeur qu'on tranche a sa place.
            const double header = def[ENGINE_HEADER_LENGTH] * (4.0 - i) / 4.0;
            head->setHeaderPrimaryLength(i, units::distance(header, units::inch));
        }
    }

    Function *timingCurve = new Function;
    timingCurve->initialize(5, units::rpm(1000));
    timingCurve->addSample(units::rpm(0), 12 * units::deg);
    timingCurve->addSample(units::rpm(1000), 12 * units::deg);
    timingCurve->addSample(units::rpm(2000), 20 * units::deg);
    timingCurve->addSample(units::rpm(3000), 30 * units::deg);
    timingCurve->addSample(units::rpm(4000), 30 * units::deg);

    IgnitionModule::Parameters ignitionParams;
    ignitionParams.cylinderCount = 8;
    ignitionParams.crankshaft = crank;
    ignitionParams.timingCurve = timingCurve;
    // Le rupteur suit le profil, il n'est plus fige.
    //
    // Il valait 6 500 et 6 800 en dur, quand le profil Sport monte a 8 500 :
    // passe 6 800, engine-sim coupait l'allumage. Il ne restait alors que le
    // pompage d'air, aigu et sans corps — David l'a entendu comme « la
    // frequence sourde tout d'un coup coupee », vers 6 900 tr/min.
    ignitionParams.revLimit = units::rpm(def[ENGINE_REV_LIMIT]);
    ignitionParams.limiterDuration = def[ENGINE_LIMITER_DURATION];
    engine->getIgnitionModule()->initialize(ignitionParams);
    for (int i = 0; i < 8; ++i) {
        engine->getIgnitionModule()->setFiringOrder(i, firingAngle[i]);
    }

    Function *turbulence = new Function;
    turbulence->initialize(30, 1);
    for (int i = 0; i < 30; ++i) turbulence->addSample((double)i, i * 0.5);

    Function *flameSpeed = new Function;
    flameSpeed->initialize(10, 5.0);
    flameSpeed->addSample(0.0, 3.0);
    for (int i = 1; i < 10; ++i) flameSpeed->addSample(i * 5.0, 1.5 * i * 5.0);

    Fuel *fuel = engine->getFuel();
    Fuel::Parameters fuelParams;
    fuelParams.maxTurbulenceEffect = 2.5;
    fuelParams.maxBurningEfficiency = 0.75;
    fuelParams.turbulenceToFlameSpeedRatio = flameSpeed;
    fuel->initialize(fuelParams);

    CombustionChamber::Parameters ccParams;
    ccParams.CrankcasePressure = units::pressure(1.0, units::atm);
    ccParams.Fuel = fuel;
    ccParams.StartingPressure = units::pressure(1.0, units::atm);
    ccParams.StartingTemperature = units::celcius(25.0);
    ccParams.MeanPistonSpeedToTurbulence = turbulence;
    for (int i = 0; i < engine->getCylinderCount(); ++i) {
        ccParams.Piston = engine->getPiston(i);
        ccParams.Head = engine->getHead(ccParams.Piston->getCylinderBank()->getIndex());
        engine->getChamber(i)->initialize(ccParams);
    }

    engine->calculateDisplacement();
    return engine;
}

/**
 * Le seul point ou le nombre de cylindres decide de quelque chose.
 *
 * Ordre d'allumage, angles de manetons, angle de V et point mort haut
 * definissent le moteur : ils ne se reglent pas, ils suivent le constructeur.
 * Tout le reste vient du tableau.
 */
Engine *buildEngine(const EngineDefinition &def) {
    return (int)def[ENGINE_CYLINDERS] == 4 ? buildInline4(def) : buildCrossplaneV8(def);
}

} // namespace engines

#endif // SPEED_NATIVE_ENGINES_H
