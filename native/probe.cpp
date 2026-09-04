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

// Le pendant direct de es_script::EngineNode::buildEngine(), sans piranha.
Engine *buildInline4() {
    const double stroke = units::distance(79.0, units::mm);
    const double bore = units::distance(99.5, units::mm);
    const double rodLength = units::distance(5.142, units::inch);
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
    params.initialNoise = 1.0;
    params.initialJitter = 0.5;

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

    Function *lobeProfile = harmonicCamLobe(
        232 * units::deg, 2.0, units::distance(9.78, units::mm), 100);

    const double lobeSeparation = 114 * units::deg;
    const double rot360 = 360 * units::deg;

    Camshaft *intakeCam = new Camshaft;
    Camshaft *exhaustCam = new Camshaft;
    Camshaft::Parameters camParams;
    camParams.lobes = 4;
    camParams.advance = 0.0;
    camParams.crankshaft = crank;
    camParams.lobeProfile = lobeProfile;
    camParams.baseRadius = units::distance(1.0, units::inch);
    intakeCam->initialize(camParams);
    exhaustCam->initialize(camParams);
    for (int i = 0; i < 4; ++i) {
        intakeCam->setLobeCenterline(i, rot360 + lobeSeparation + firingAngle[i]);
        exhaustCam->setLobeCenterline(i, rot360 - lobeSeparation + firingAngle[i]);
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
    headParams.CombustionChamberVolume = 67.0 * units::cc;
    headParams.IntakeRunnerVolume = 149.6 * units::cc;
    headParams.IntakeRunnerCrossSectionArea =
        units::distance(1.35, units::inch) * units::distance(1.35, units::inch);
    headParams.ExhaustRunnerVolume = 50.0 * units::cc;
    headParams.ExhaustRunnerCrossSectionArea =
        units::distance(1.25, units::inch) * units::distance(1.25, units::inch);
    headParams.FlipDisplay = false;
    head->initialize(headParams);

    Intake *intake = engine->getIntake(0);
    Intake::Parameters intakeParams;
    intakeParams.volume = 1.325 * units::L;
    intakeParams.CrossSectionArea = 20.0 * units::cm2;
    intakeParams.InputFlowK = GasSystem::k_carb(800.0);
    intakeParams.IdleFlowK = GasSystem::k_carb(0.0);
    intakeParams.RunnerFlowRate = GasSystem::k_carb(250.0);
    intakeParams.IdleThrottlePlatePosition = 0.9985;
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
    exhaustParams.length = (100.0 * units::L) / collectorArea;
    exhaustParams.collectorCrossSectionArea = collectorArea;
    exhaustParams.outletFlowRate = GasSystem::k_carb(1000.0);
    exhaustParams.primaryTubeLength = units::distance(10.0, units::inch);
    exhaustParams.primaryFlowRate = GasSystem::k_carb(200.0);
    exhaustParams.velocityDecay = 1.0;
    exhaustParams.audioVolume = 1.0;
    exhaustParams.impulseResponse = impulse;
    exhaust->initialize(exhaustParams);

    for (int i = 0; i < 4; ++i) {
        head->setIntake(i, intake);
        head->setExhaustSystem(i, exhaust);
        head->setSoundAttenuation(i, 1.0);
        head->setHeaderPrimaryLength(i, units::distance(10.0, units::inch));
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
    ignitionParams.revLimit = units::rpm(6500);
    ignitionParams.limiterDuration = 0.08;
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
Engine *buildCrossplaneV8() {
    const double stroke = units::distance(3.622, units::inch);
    const double bore = units::distance(4.065, units::inch);
    const double rodLength = units::distance(6.098, units::inch);
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
    params.initialNoise = 1.0;
    params.initialJitter = 0.5;

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

    Function *lobeProfile = harmonicCamLobe(
        226 * units::deg, 2.0, units::distance(0.551, units::inch), 100);
    const double lobeSeparation = 114 * units::deg;
    const double rot360 = 360 * units::deg;

    Intake *intake = engine->getIntake(0);
    Intake::Parameters intakeParams;
    intakeParams.volume = 5.7 * units::L;
    intakeParams.CrossSectionArea = 40.0 * units::cm2;
    intakeParams.InputFlowK = GasSystem::k_carb(1200.0);
    intakeParams.IdleFlowK = GasSystem::k_carb(0.0);
    intakeParams.RunnerFlowRate = GasSystem::k_carb(300.0);
    intakeParams.IdleThrottlePlatePosition = 0.9985;
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
        camParams.lobeProfile = lobeProfile;
        camParams.baseRadius = units::distance(1.0, units::inch);
        intakeCam->initialize(camParams);
        exhaustCam->initialize(camParams);
        for (int i = 0; i < 4; ++i) {
            const double angle = firingAngle[b * 4 + i];
            intakeCam->setLobeCenterline(i, rot360 + lobeSeparation + angle);
            exhaustCam->setLobeCenterline(i, rot360 - lobeSeparation + angle);
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
        headParams.CombustionChamberVolume = 68.0 * units::cc;
        headParams.IntakeRunnerVolume = 149.6 * units::cc;
        headParams.IntakeRunnerCrossSectionArea =
            units::distance(2.0, units::inch) * units::distance(2.0, units::inch);
        headParams.ExhaustRunnerVolume = 50.0 * units::cc;
        headParams.ExhaustRunnerCrossSectionArea =
            units::distance(1.5, units::inch) * units::distance(1.5, units::inch);
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
        exhaustParams.length = (100.0 * units::L) / collectorArea;
        exhaustParams.collectorCrossSectionArea = collectorArea;
        exhaustParams.outletFlowRate = GasSystem::k_carb(1000.0);
        exhaustParams.primaryTubeLength = units::distance(10.0, units::inch);
        exhaustParams.primaryFlowRate = GasSystem::k_carb(300.0);
        exhaustParams.velocityDecay = 1.0;
        exhaustParams.audioVolume = 1.0;
        exhaustParams.impulseResponse = impulse;
        exhaust->initialize(exhaustParams);

        for (int i = 0; i < 4; ++i) {
            head->setIntake(i, intake);
            head->setExhaustSystem(i, exhaust);
            head->setSoundAttenuation(i, 1.0);
            head->setHeaderPrimaryLength(
                i, units::distance(10.0 + i * 2.0, units::inch));
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
    ignitionParams.revLimit = units::rpm(6800);
    ignitionParams.limiterDuration = 0.2;
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
    Engine *engine = (cylinders == 4) ? buildInline4() : buildCrossplaneV8();

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
    rig->engine = (cylinders == 4) ? buildInline4() : buildCrossplaneV8();
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
