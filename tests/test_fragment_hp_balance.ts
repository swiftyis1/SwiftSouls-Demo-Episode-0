import { GameManager, SoulCrystalDatabase } from '../src/systems/GameManager.ts';
import { PetBattleAI } from '../src/systems/PetBattleAI.ts';
import { calculateDamage } from '../src/systems/ElementSystem.ts';

// Mock localStorage for Node test environment
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
    if (condition) {
        console.log(`  [PASS] ${msg}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${msg}`);
        failed++;
    }
}

console.log('====================================================');
console.log('   RUNNING FRAGMENT 75% REDUCTION & HP TRUNCATION TEST');
console.log('====================================================\n');

// -------------------------------------------------------------
// 1. SoulCrystalDatabase statPerFragment Validation
// -------------------------------------------------------------
console.log('--- 1. SoulCrystalDatabase 75% Reduced Fragment Bonuses ---');
const keenkat = SoulCrystalDatabase['keenkat'];
assert(keenkat.statPerFragment.maxHp === 0.25, 'Keenkat grants +0.25 HP per fragment');
assert(keenkat.statPerFragment.critChance === 0.0025, 'Keenkat grants +0.0025% Crit Chance per fragment');

const goblin = SoulCrystalDatabase['goblin'];
assert(goblin.statPerFragment.strength === 0.25, 'Goblin grants +0.25 Strength per fragment');

const snake = SoulCrystalDatabase['snake'];
assert(snake.statPerFragment.maxHp === 0.25, 'Snake grants +0.25 HP per fragment (was 1, cut 75%)');

const slime = SoulCrystalDatabase['slime'];
assert(slime.statPerFragment.maxSp === 0.25, 'Slime grants +0.25 SP per fragment (was 1, cut 75%)');

const bat = SoulCrystalDatabase['bat'];
assert(bat.statPerFragment.agility === 0.25, 'Bat grants +0.25 Agility per fragment (was 1, cut 75%)');

const skeleton = SoulCrystalDatabase['skeleton'];
assert(skeleton.statPerFragment.defense === 0.25, 'Skeleton grants +0.25 Defense per fragment (was 1, cut 75%)');

const phoenix = SoulCrystalDatabase['phoenix'];
assert(phoenix.statPerFragment.maxSp === 0.5, 'Phoenix grants +0.5 SP per fragment (was 2, cut 75%)');
assert(phoenix.statPerFragment.strength === 0.5, 'Phoenix grants +0.5 Strength per fragment (was 2, cut 75%)');

// -------------------------------------------------------------
// 2. Linear Fragment HP Growth & Truncation Invariant
// -------------------------------------------------------------
console.log('\n--- 2. Linear Fragment HP Growth & Truncation Invariant ---');
const gm = GameManager.instance;
gm.resetGame();

// Clear any equipped gear and setup 0 fragments
const eq = gm.getState().equippedCrystals;
for (const k in eq) { eq[k as any] = null; }
for (const k in gm.getState().soulCrystals) {
    gm.getState().soulCrystals[k] = { fragments: 0, isExtinct: false };
}

const baseStats = gm.getHeroCalculatedStats();
const initialHp = baseStats.maxHp; // 24

// 1 Snake Fragment: 24 + 0.25 = 24.25 => Truncated to 24
gm.getState().soulCrystals['snake'].fragments = 1;
let stats = gm.getHeroCalculatedStats();
assert(stats.maxHp === initialHp, `1 Snake Fragment (24.25 HP) truncates to ${initialHp} HP`);

// 2 Snake Fragments: 24 + 0.50 = 24.50 => Truncated to 24 (Rounding would give 25!)
gm.getState().soulCrystals['snake'].fragments = 2;
stats = gm.getHeroCalculatedStats();
assert(stats.maxHp === initialHp, `2 Snake Fragments (24.50 HP) truncates to ${initialHp} HP (NOT rounded up)`);

// 3 Snake Fragments: 24 + 0.75 = 24.75 => Truncated to 24 (Rounding would give 25!)
gm.getState().soulCrystals['snake'].fragments = 3;
stats = gm.getHeroCalculatedStats();
assert(stats.maxHp === initialHp, `3 Snake Fragments (24.75 HP) truncates to ${initialHp} HP (NOT rounded up)`);

// 4 Snake Fragments: 24 + 1.00 = 25.00 => 25
gm.getState().soulCrystals['snake'].fragments = 4;
stats = gm.getHeroCalculatedStats();
assert(stats.maxHp === initialHp + 1, `4 Snake Fragments (25.00 HP) yields exact ${initialHp + 1} HP`);

// 7 Snake Fragments: 24 + 1.75 = 25.75 => Truncated to 25
gm.getState().soulCrystals['snake'].fragments = 7;
stats = gm.getHeroCalculatedStats();
assert(stats.maxHp === initialHp + 1, `7 Snake Fragments (25.75 HP) truncates to ${initialHp + 1} HP (NOT rounded to 26)`);

// -------------------------------------------------------------
// 3. SP Growth Truncation Invariant
// -------------------------------------------------------------
console.log('\n--- 3. SP Growth Truncation Invariant ---');
const initialSp = baseStats.maxSp; // 8

// 1 Slime Fragment: 8 + 0.25 = 8.25 => 8
gm.getState().soulCrystals['slime'].fragments = 1;
stats = gm.getHeroCalculatedStats();
assert(stats.maxSp === initialSp, `1 Slime Fragment (8.25 SP) truncates to ${initialSp} SP`);

// 3 Slime Fragments: 8 + 0.75 = 8.75 => 8 (Rounding would give 9!)
gm.getState().soulCrystals['slime'].fragments = 3;
stats = gm.getHeroCalculatedStats();
assert(stats.maxSp === initialSp, `3 Slime Fragments (8.75 SP) truncates to ${initialSp} SP (NOT rounded up)`);

// 4 Slime Fragments: 8 + 1.00 = 9.00 => 9
gm.getState().soulCrystals['slime'].fragments = 4;
stats = gm.getHeroCalculatedStats();
assert(stats.maxSp === initialSp + 1, `4 Slime Fragments (9.00 SP) yields exact ${initialSp + 1} SP`);

// -------------------------------------------------------------
// 4. Hero & Pet HP Setting / Healing Truncation
// -------------------------------------------------------------
console.log('\n--- 4. Hero & Pet HP Setting / Healing Truncation ---');
gm.setHeroHp(15.9);
assert(gm.getState().party[0].hp === 15, 'setHeroHp(15.9) truncates to 15 (NOT rounded to 16)');

gm.setHeroSp(7.8);
assert(gm.getState().party[0].sp === 7, 'setHeroSp(7.8) truncates to 7 (NOT rounded to 8)');

// Pet companion truncation
gm.getState().hasUnlockedEarrings = true;
gm.getState().soulCrystals['snake'].fragments = 25;
gm.equipSoulCrystal('earrings', 'snake');
assert(gm.getState().petCompanion !== null, 'Viperling pet companion equipped');

gm.setPetCompanionHp(22.7);
assert(gm.getState().petCompanion!.hp === 22, 'setPetCompanionHp(22.7) truncates to 22 (NOT rounded to 23)');

// -------------------------------------------------------------
// 5. ElementSystem Absorption Healing Truncation
// -------------------------------------------------------------
console.log('\n--- 5. ElementSystem Absorption Healing Truncation ---');
// Absorption with fractional result: 15 base damage * 0.25 excess ratio = 3.75 => Truncates to 3
const absorbResult = calculateDamage({
    basePower: 15,
    attackElement: 'fire',
    defenderElement: 'fire',
    defenderResistances: { fire: 1.25 } // 125% absorption (25% absorbed)
});
assert(absorbResult.isAbsorbed === true, 'Attack correctly marked as absorbed');
assert(absorbResult.absorbedHealing === 3, 'Absorption healing 15 * 0.25 = 3.75 is truncated to 3 HP (NOT rounded to 4)');

// -------------------------------------------------------------
// 6. PetBattleAI Healing Truncation
// -------------------------------------------------------------
console.log('\n--- 6. PetBattleAI Healing Truncation ---');
const testPet = gm.getState().petCompanion!;
testPet.hp = 10;
testPet.maxHp = 50;
testPet.signatureSkill = {
    id: 'soothing_mist',
    name: 'Soothing Mist',
    type: 'heal',
    element: 'water',
    spCost: 5,
    power: 12.8
};
testPet.sp = 10;
testPet.level = 1;

const petDecision = PetBattleAI.evaluateTurn(testPet, {
    name: 'Swift',
    hp: 10,
    maxHp: 50,
    level: 1,
    strength: 10,
    defense: 5,
    agility: 5,
    magic: 5,
    magicDefense: 5,
    sp: 10,
    maxSp: 10,
    accuracy: 95,
    evasion: 5,
    critChance: 5,
    critDamage: 1.5,
    luck: 10,
    physicalPenetration: 0,
    magicPenetration: 0,
    spCostReduction: 0
}, 50, 50, 'physical');

assert(petDecision.actionType === 'HEAL', 'Pet chooses heal action for low ally');
assert(petDecision.rawAmount === 12, 'Pet heal power 12.8 is truncated to 12 HP (NOT rounded to 13)');

// -------------------------------------------------------------
// 7. SoulCrystalDatabase Extinction Mastery 75% Reduction
// -------------------------------------------------------------
console.log('\n--- 7. SoulCrystalDatabase Extinction Mastery 75% Reduction ---');
assert(keenkat.extinctionBonus.critChance === 2, 'Keenkat extinction bonus grants +2% Crit Chance (was 8, cut 75%)');
assert(keenkat.extinctionBonus.maxHp === 25, 'Keenkat extinction bonus grants +25 HP (was 100, cut 75%)');

assert(goblin.extinctionBonus.strength === 125, 'Goblin extinction bonus grants +125 Strength (was 500, cut 75%)');

assert(snake.extinctionBonus.maxHp === 125, 'Snake extinction bonus grants +125 HP (was 500, cut 75%)');

assert(slime.extinctionBonus.maxSp === 75, 'Slime extinction bonus grants +75 SP (was 300, cut 75%)');

assert(bat.extinctionBonus.agility === 62.5, 'Bat extinction bonus grants +62.5 Agility (was 250, cut 75%)');

assert(skeleton.extinctionBonus.defense === 75, 'Skeleton extinction bonus grants +75 Defense (was 300, cut 75%)');

assert(phoenix.extinctionBonus.maxSp === 150, 'Phoenix extinction bonus grants +150 SP (was 600, cut 75%)');
assert(phoenix.extinctionBonus.strength === 100, 'Phoenix extinction bonus grants +100 Strength (was 400, cut 75%)');

// Test Extinction Stat Application
gm.resetGame();
for (const k in gm.getState().equippedCrystals) { gm.getState().equippedCrystals[k as any] = null; }
for (const k in gm.getState().soulCrystals) {
    gm.getState().soulCrystals[k] = { fragments: 0, isExtinct: false };
}
const preExtinctionHp = gm.getHeroCalculatedStats().maxHp; // 24
gm.getState().soulCrystals['snake'].fragments = 255;
gm.getState().soulCrystals['snake'].isExtinct = true;

const postExtinctionStats = gm.getHeroCalculatedStats();
// Base HP (24) + Flat Extinction Mastery Bonus (125) = 149 HP
assert(postExtinctionStats.maxHp === preExtinctionHp + 125, `Snake extinction yields exact flat mastery HP: ${preExtinctionHp + 125}`);

console.log('\n====================================================');
console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
    process.exit(1);
}
