// Mock localStorage, window, and document for headless Node environment
const store: { [key: string]: string } = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (idx: number) => Object.keys(store)[idx] || null
};
(globalThis as any).window = {
    localStorage: (globalThis as any).localStorage,
    location: { hash: '', search: '' },
    addEventListener: () => {},
    removeEventListener: () => {},
    navigator: { userAgent: 'Node' },
    document: {
        createElement: () => ({ getContext: () => null }),
        addEventListener: () => {},
        removeEventListener: () => {}
    }
};
(globalThis as any).document = (globalThis as any).window.document;

import { GameManager } from '../src/systems/GameManager.ts';
import { PetBattleAI } from '../src/systems/PetBattleAI.ts';
import { PetFollowerMath } from '../src/systems/PetFollowerMath.ts';

/**
 * Sprint 26 Automated Verification Test Suite
 * Validates:
 * 1. Pet Companion Creation & Stat Scaling Formulas (HP & SP pools, Signature Skills)
 * 2. Overworld Pet Follower Movement (Trail interpolation, Snap threshold, Position math)
 * 3. Autonomous AI Rule 1: Low-HP Healing Logic (<50% threshold for ally or pet)
 * 4. Autonomous AI Rule 2: Signature Elemental Offensive Skill Execution
 * 5. Autonomous AI Rule 3: SP Conservation & Basic Attack Fallback when SP < cost
 * 6. Autonomous AI Rule 4 & Defeat Handling: Turn pass on unconsciousness & Enemy Targeting
 * 7. Pet Resurrection & Sanctuary Restoration at Healing Stations / Respawn
 * 8. Earrings Upgrade Rule Invariant: Single-pet constraint preserved during soulmelding
 */
function runSprint26Tests() {
    console.log('====================================================');
    console.log('   RUNNING SPRINT 26 AUTOMATED VERIFICATION SUITE   ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, desc: string) {
        if (condition) {
            console.log(`  [PASS] ${desc}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${desc}`);
            failed++;
        }
    }

    // Mock localStorage for Node testing environment
    if (typeof (globalThis as any).localStorage === 'undefined') {
        const store: { [key: string]: string } = {};
        (globalThis as any).localStorage = {
            getItem: (key: string) => (key in store ? store[key] : null),
            setItem: (key: string, val: string) => { store[key] = String(val); },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { for (const k in store) delete store[k]; },
            get length() { return Object.keys(store).length; },
            key: (idx: number) => Object.keys(store)[idx] || null
        };
    }

    localStorage.clear();
    GameManager.instance.resetGame();

    // ----------------------------------------------------
    // TEST 1: Pet Companion Creation & Stat Scaling Formulas
    // ----------------------------------------------------
    console.log('\n--- 1. Pet Creation & Stat Scaling Formulas ---');

    // Unlock earrings slot and grant soul fragments
    GameManager.instance.unlockEarringsSlot();
    GameManager.instance.addSoulFragments('goblin', 30);
    GameManager.instance.addSoulFragments('phoenix', 55);
    GameManager.instance.addSoulFragments('slime', 10);

    const goblinPet = GameManager.instance.createPetCompanion('goblin');
    assert(goblinPet !== null, 'Goblin pet successfully instantiated');
    assert(goblinPet.speciesId === 'goblin', 'Pet species is goblin');
    assert(goblinPet.name === 'Goblin Brawler', 'Pet name matches species archetype');
    assert(goblinPet.level === 2, 'Pet level calculated from fragments: Math.floor(30/25)+1 = 2');
    assert(goblinPet.hp === 45 + (2 - 1) * 8, 'Pet HP matches formula baseHp(45) + (level-1)*8 = 53');
    assert(goblinPet.maxHp === 53, 'Pet maxHp matches 53');
    assert(goblinPet.sp === 25 + (2 - 1) * 5, 'Pet SP matches formula baseSp(25) + (level-1)*5 = 30');
    assert(goblinPet.maxSp === 30, 'Pet maxSp matches 30');
    assert(goblinPet.signatureSkill.name === 'Fierce Strike', 'Goblin signature skill is Fierce Strike');
    assert(goblinPet.signatureSkill.element === 'earth', 'Fierce Strike element is earth');
    assert(goblinPet.signatureSkill.spCost === 8, 'Fierce Strike SP cost is 8');
    assert(goblinPet.isDefeated === false, 'New pet starts conscious (isDefeated = false)');

    const phoenixPet = GameManager.instance.createPetCompanion('phoenix');
    assert(phoenixPet.speciesId === 'phoenix', 'Phoenix pet successfully instantiated');
    assert(phoenixPet.level === 3, 'Phoenix level is 3 (55 fragments)');
    assert(phoenixPet.signatureSkill.name === 'Healing Ember', 'Phoenix signature skill is Healing Ember');
    assert(phoenixPet.signatureSkill.type === 'heal', 'Healing Ember is type "heal"');
    assert(phoenixPet.signatureSkill.spCost === 14, 'Healing Ember SP cost is 14');

    // ----------------------------------------------------
    // TEST 2: Overworld Pet Follower Movement & Trail Math
    // ----------------------------------------------------
    console.log('\n--- 2. Overworld Pet Follower Trail & Movement Math ---');

    // Snap threshold logic: snap if distance > 180
    assert(PetFollowerMath.shouldSnap(200, 180) === true, 'Pet snaps if distance is 200 (> 180)');
    assert(PetFollowerMath.shouldSnap(150, 180) === false, 'Pet does not snap if distance is 150 (<= 180)');
    assert(PetFollowerMath.shouldSnap(180, 180) === false, 'Pet does not snap at exact threshold (180)');

    // Trail target calculation with history
    const trailHistory = [
        { x: 100, y: 100 },
        { x: 110, y: 100 },
        { x: 120, y: 100 },
        { x: 130, y: 100 },
        { x: 140, y: 100 },
        { x: 150, y: 100 },
        { x: 160, y: 100 },
        { x: 170, y: 100 }
    ];
    const target = PetFollowerMath.computeTrailTarget(trailHistory, 4);
    assert(target.x === 130 && target.y === 100, 'computeTrailTarget picks trail offset correctly (index 3: x=130)');

    // Empty history fallback
    const emptyFallback = PetFollowerMath.computeTrailTarget([], 4);
    assert(emptyFallback.x === 0 && emptyFallback.y === 0, 'computeTrailTarget handles empty history safely');

    // Position interpolation
    const nextPos = PetFollowerMath.interpolatePosition({ x: 100, y: 100 }, { x: 200, y: 200 }, 0.1);
    assert(Math.abs(nextPos.x - 110) < 0.001 && Math.abs(nextPos.y - 110) < 0.001, 'interpolatePosition moves 10% toward target: (100,100) -> (110,110)');

    // ----------------------------------------------------
    // TEST 3: Autonomous AI Rule 1 - Low-HP Healing Logic
    // ----------------------------------------------------
    console.log('\n--- 3. Autonomous AI: Low-HP Healing Logic ---');

    const heroStats = GameManager.instance.getHeroCalculatedStats();
    
    // Case 3A: Hero is low HP (<50%) -> Phoenix pet should heal Hero
    const lowHpHero = { ...heroStats, hp: 10, maxHp: 50 }; // 20% HP
    const fullHpPet = { ...phoenixPet, hp: 50, maxHp: 50, sp: 30, maxSp: 30 };
    const healDecisionA = PetBattleAI.evaluateTurn(fullHpPet, lowHpHero, 100, 100, 'physical');

    assert(healDecisionA.actionType === 'HEAL', 'Phoenix casts HEAL when player HP is below 50%');
    assert(healDecisionA.target === 'PLAYER', 'Phoenix targets PLAYER with heal');
    assert(healDecisionA.spCost === 14, 'Phoenix heal consumes 14 SP');
    assert(healDecisionA.rawAmount > 0, 'Heal amount is positive');

    // Case 3B: Pet is low HP (<50%) and Hero is high HP (80%) -> Phoenix should heal Pet
    const highHpHero = { ...heroStats, hp: 40, maxHp: 50 }; // 80% HP
    const lowHpPet = { ...phoenixPet, hp: 15, maxHp: 50, sp: 30, maxSp: 30 }; // 30% HP
    const healDecisionB = PetBattleAI.evaluateTurn(lowHpPet, highHpHero, 100, 100, 'physical');

    assert(healDecisionB.actionType === 'HEAL', 'Phoenix casts HEAL when pet HP is below 50%');
    assert(healDecisionB.target === 'PET', 'Phoenix targets PET with heal when pet is more injured');

    // Case 3C: Both Hero and Pet are healthy (>=50%) -> Phoenix should NOT heal
    const healthyHero = { ...heroStats, hp: 45, maxHp: 50 }; // 90% HP
    const healthyPet = { ...phoenixPet, hp: 45, maxHp: 50, sp: 30, maxSp: 30 }; // 90% HP
    const noHealDecision = PetBattleAI.evaluateTurn(healthyPet, healthyHero, 100, 100, 'physical');

    assert(noHealDecision.actionType !== 'HEAL', 'Phoenix does NOT heal when both allies are above 50% HP');
    assert(noHealDecision.actionType === 'ATTACK', 'Phoenix falls back to basic attack when healing is unneeded');

    // ----------------------------------------------------
    // TEST 4: Autonomous AI Rule 2 - Signature Elemental Offensive Skill
    // ----------------------------------------------------
    console.log('\n--- 4. Autonomous AI: Signature Elemental Offensive Skill ---');

    const goblinReady = { ...goblinPet, sp: 25, maxSp: 25 };
    const skillDecision = PetBattleAI.evaluateTurn(goblinReady, healthyHero, 100, 100, 'lightning');

    assert(skillDecision.actionType === 'SKILL', 'Goblin unleashes signature SKILL when SP is sufficient');
    assert(skillDecision.skillUsed?.name === 'Fierce Strike', 'Skill used is Fierce Strike');
    assert(skillDecision.spCost === 8, 'Fierce Strike consumes 8 SP');
    assert(skillDecision.element === 'earth', 'Skill element is earth');
    assert(skillDecision.target === 'ENEMY', 'Skill targets ENEMY');
    assert(skillDecision.rawAmount > 0, 'Skill deals positive damage');

    // ----------------------------------------------------
    // TEST 5: Autonomous AI Rule 3 - SP Conservation
    // ----------------------------------------------------
    console.log('\n--- 5. Autonomous AI: SP Conservation & Basic Attack Fallback ---');

    // Goblin has 5 SP, but Fierce Strike costs 8 SP
    const goblinLowSp = { ...goblinPet, sp: 5, maxSp: 25 };
    const conserveDecision = PetBattleAI.evaluateTurn(goblinLowSp, healthyHero, 100, 100, 'physical');

    assert(conserveDecision.actionType === 'ATTACK', 'Pet conserves SP and defaults to ATTACK when SP < skill cost');
    assert(conserveDecision.spCost === 0, 'Basic attack costs 0 SP');
    assert(conserveDecision.element === 'physical', 'Basic attack is physical element');
    assert(conserveDecision.message.includes('Conserving SP'), 'Dialogue log announces SP conservation');

    // ----------------------------------------------------
    // TEST 6: Autonomous AI Rule 4 - Defeat / Unconscious State & Enemy Targeting
    // ----------------------------------------------------
    console.log('\n--- 6. Autonomous AI: Defeat / Unconscious State & Enemy Targeting ---');

    // Defeated pet passes turn
    const defeatedPet = { ...goblinPet, hp: 0, isDefeated: true };
    const passDecision = PetBattleAI.evaluateTurn(defeatedPet, healthyHero, 100, 100, 'physical');
    assert(passDecision.actionType === 'PASS', 'Unconscious pet passes turn without taking action');
    assert(passDecision.message.includes('unconscious'), 'Log mentions unconscious state');

    // Enemy targeting: 75% Player, 25% Pet
    assert(PetBattleAI.evaluateEnemyTarget(null, 0.1) === 'PLAYER', 'Enemy targets PLAYER when no pet exists');
    assert(PetBattleAI.evaluateEnemyTarget(defeatedPet, 0.1) === 'PLAYER', 'Enemy targets PLAYER when pet is unconscious');
    assert(PetBattleAI.evaluateEnemyTarget(goblinReady, 0.20) === 'PET', 'Enemy targets PET when roll < 0.25');
    assert(PetBattleAI.evaluateEnemyTarget(goblinReady, 0.26) === 'PLAYER', 'Enemy targets PLAYER when roll >= 0.25');

    // Damage application to Pet
    const activePet = { ...goblinPet, hp: 30, maxHp: 50, isDefeated: false };
    const hitResult = PetBattleAI.applyDamageToPet(activePet, 10);
    assert(activePet.hp === 20, 'Pet HP drops from 30 to 20 after taking 10 damage');
    assert(hitResult.isDefeated === false, 'Pet is not defeated after non-lethal hit');

    // Lethal damage application
    const fatalHitResult = PetBattleAI.applyDamageToPet(activePet, 25);
    assert(activePet.hp === 0, 'Pet HP is clamped to 0 on lethal damage');
    assert(activePet.isDefeated === true, 'Pet isDefeated set to true on lethal damage');
    assert(fatalHitResult.isDefeated === true, 'Result reports pet is defeated');
    assert(fatalHitResult.message.includes('unconscious'), 'Defeat message announces unconsciousness');

    // ----------------------------------------------------
    // TEST 7: Pet Revival & Sanctuary Restoration
    // ----------------------------------------------------
    console.log('\n--- 7. Pet Revival & Sanctuary Full Restoration ---');

    // Socket pet into GameManager
    GameManager.instance.socketCrystal('goblin', 'earrings');
    const statePet = GameManager.instance.getPetCompanion();
    assert(statePet !== null, 'Pet companion active in GameManager state');

    // Injure and knock out pet
    GameManager.instance.setPetCompanionHp(0);
    GameManager.instance.setPetCompanionSp(2);
    assert(statePet!.hp === 0, 'Pet HP reduced to 0');
    assert(statePet!.isDefeated === true, 'Pet marked defeated');
    assert(statePet!.sp === 2, 'Pet SP reduced to 2');

    // Test direct revivePetCompanion()
    const revived = GameManager.instance.revivePetCompanion();
    assert(revived === true, 'revivePetCompanion() returns true');
    assert(statePet!.hp === statePet!.maxHp, 'Pet HP fully restored to maxHp');
    assert(statePet!.sp === statePet!.maxSp, 'Pet SP fully restored to maxSp');
    assert(statePet!.isDefeated === false, 'Pet isDefeated reset to false');

    // Injure again, then test Healing Station sanctuary rest
    GameManager.instance.setPetCompanionHp(5);
    GameManager.instance.setPetCompanionSp(4);
    (statePet as any).isDefeated = true;

    const restResult = GameManager.instance.attuneAndRestAtHealingStation('station_meteor_pod');
    assert(restResult.success === true, 'Resting at Meteor Pod succeeds');
    assert(statePet!.hp === statePet!.maxHp, 'Sanctuary rest restored Pet HP to 100%');
    assert(statePet!.sp === statePet!.maxSp, 'Sanctuary rest restored Pet SP to 100%');
    assert(statePet!.isDefeated === false, 'Sanctuary rest reset Pet isDefeated to false');

    // Injure again, then test handlePlayerDeath()
    GameManager.instance.setPetCompanionHp(0);
    (statePet as any).isDefeated = true;
    GameManager.instance.handlePlayerDeath();
    assert(statePet!.hp === statePet!.maxHp, 'Player death reconstruction fully restored Pet HP');
    assert(statePet!.sp === statePet!.maxSp, 'Player death reconstruction fully restored Pet SP');
    assert(statePet!.isDefeated === false, 'Player death reconstruction reset Pet isDefeated to false');

    // ----------------------------------------------------
    // TEST 8: Strict Single-Pet Invariant (Earrings Upgrade Rule)
    // ----------------------------------------------------
    console.log('\n--- 8. Strict Single-Pet Invariant & Catalyst Augmentation ---');

    // Unlock boss dual-socket for earrings
    const unlockDual = GameManager.instance.unlockDualSocket('earrings');
    assert(unlockDual.success === true, 'Boss Soulmeld unlocked for Earrings slot');
    assert(GameManager.instance.isDualSocketUnlocked('earrings') === true, 'isDualSocketUnlocked("earrings") returns true');

    // Socket secondary Phoenix crystal into earrings
    const socketSec = GameManager.instance.socketSecondaryCrystal('earrings', 'phoenix');
    assert(socketSec === true, 'Socketing Phoenix catalyst into Earrings succeeds');

    // Invariant verification: Exactly ONE pet companion exists!
    const updatedPet = GameManager.instance.getPetCompanion();
    assert(updatedPet !== null, 'Pet companion exists');
    assert(updatedPet!.speciesId === 'goblin', 'Primary pet remains Goblin Brawler');
    assert(updatedPet!.augmentation !== null && updatedPet!.augmentation !== undefined, 'Pet augmentation is populated');
    assert(updatedPet!.augmentation!.secondarySpeciesId === 'phoenix', 'Augmentation catalyst is Phoenix');
    assert(updatedPet!.augmentation!.auraEffect === 'fire_aura', 'Augmentation grants fire_aura');
    assert(updatedPet!.augmentation!.bonusSkill === 'Phoenix Flame', 'Augmentation grants Phoenix Flame bonus');

    // Verify aura increases enemy target threat to 45%
    assert(PetBattleAI.evaluateEnemyTarget(updatedPet, 0.40) === 'PET', 'Augmented pet with aura has elevated 45% threat (roll 0.40 < 0.45)');
    assert(PetBattleAI.evaluateEnemyTarget(updatedPet, 0.46) === 'PLAYER', 'Enemy targets player when roll >= 0.45');

    // Unsocket secondary crystal
    const unsocketSec = GameManager.instance.unsocketSecondaryCrystal('earrings');
    assert(unsocketSec === true, 'Unsocketing secondary crystal succeeds');
    assert(updatedPet!.augmentation === null, 'Augmentation cleanly removed');
    assert(GameManager.instance.getPetCompanion()!.speciesId === 'goblin', 'Primary companion remains active');

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`   SPRINT 26 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runSprint26Tests();
