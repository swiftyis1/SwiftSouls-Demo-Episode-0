// Automated validation script for Sprint 13: Evolving Regional Towns (Milestone 2 - Soul Levels 4 to 6 & Extinction Reactivity)
// Run with: node --experimental-strip-types tests/test_sprint13.ts

// Mock localStorage for headless Node environment
const storageMock: { [key: string]: string } = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
};

import { MapRegistry } from '../src/systems/MapRegistry.ts';
import { GameManager } from '../src/systems/GameManager.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        (globalThis as any).process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log('=== SPRINT 13: REGIONAL TOWNS LV 4-6 & EXTINCTION REACTIVITY VALIDATION ===\n');

// 1. Dynamic Town Name Progression (All 7 Tiers: Soul Levels 0 through 6)
console.log('--- 1. Dynamic Town Name Progression (Soul Levels 0-6) ---');
// Oakhaven
assert(MapRegistry.getTownName('town_oakhaven', 0).includes('Wild Clearing'), 'Oakhaven SL0: Wild Clearing');
assert(MapRegistry.getTownName('town_oakhaven', 1).includes('Pioneer Outpost'), 'Oakhaven SL1: Pioneer Outpost');
assert(MapRegistry.getTownName('town_oakhaven', 2).includes('Agricultural Hamlet'), 'Oakhaven SL2: Agricultural Hamlet');
assert(MapRegistry.getTownName('town_oakhaven', 3).includes('Prosperous Village'), 'Oakhaven SL3: Prosperous Village');
assert(MapRegistry.getTownName('town_oakhaven', 4).includes('Thriving Township'), 'Oakhaven SL4: Thriving Township');
assert(MapRegistry.getTownName('town_oakhaven', 5).includes('Merchant Haven'), 'Oakhaven SL5: Merchant Haven');
assert(MapRegistry.getTownName('town_oakhaven', 6).includes('Verdant Metropolis'), 'Oakhaven SL6: Verdant Metropolis');

// Aetheria
assert(MapRegistry.getTownName('town_aetheria', 0).includes('Silent Grove'), 'Aetheria SL0: Silent Grove');
assert(MapRegistry.getTownName('town_aetheria', 1).includes('Luminescent Grove'), 'Aetheria SL1: Luminescent Grove');
assert(MapRegistry.getTownName('town_aetheria', 2).includes('Aetheric Sanctum'), 'Aetheria SL2: Aetheric Sanctum');
assert(MapRegistry.getTownName('town_aetheria', 3).includes('Celestial Enclave'), 'Aetheria SL3: Celestial Enclave');
assert(MapRegistry.getTownName('town_aetheria', 4).includes('Arcane Sanctuary'), 'Aetheria SL4: Arcane Sanctuary');
assert(MapRegistry.getTownName('town_aetheria', 5).includes('Astral Academy'), 'Aetheria SL5: Astral Academy');
assert(MapRegistry.getTownName('town_aetheria', 6).includes('Starlight Citadel'), 'Aetheria SL6: Starlight Citadel');

// Ironspire
assert(MapRegistry.getTownName('town_ironspire', 0).includes('Barren Quarry'), 'Ironspire SL0: Barren Quarry');
assert(MapRegistry.getTownName('town_ironspire', 1).includes("Miner's Post"), 'Ironspire SL1: Miner\'s Post');
assert(MapRegistry.getTownName('town_ironspire', 2).includes('Masonry Bastion'), 'Ironspire SL2: Masonry Bastion');
assert(MapRegistry.getTownName('town_ironspire', 3).includes('The Grand Forge'), 'Ironspire SL3: The Grand Forge');
assert(MapRegistry.getTownName('town_ironspire', 4).includes('Roaring Smeltery'), 'Ironspire SL4: Roaring Smeltery');
assert(MapRegistry.getTownName('town_ironspire', 5).includes('Vulcan Bastion'), 'Ironspire SL5: Vulcan Bastion');
assert(MapRegistry.getTownName('town_ironspire', 6).includes('The Imperial Fortress'), 'Ironspire SL6: The Imperial Fortress');

// 2. Master Blacksmith Thorgan's Forge Refinements
console.log('\n--- 2. Master Blacksmith Thorgan Forge Refinements ---');
const gm = GameManager.instance;
gm.resetGame();

const initialStats = gm.getHeroCalculatedStats();
const refineRes = gm.refineEquipmentSlot('sword');
assert(refineRes.success, 'First sword refinement succeeds');
assert(refineRes.newTier === 1, 'Sword refinement newTier is 1');

const boostedStats = gm.getHeroCalculatedStats();
assert(boostedStats.strength === initialStats.strength + 6, `Sword refinement added +6 Strength (${initialStats.strength} -> ${boostedStats.strength})`);

// Shield refinement (+5 Def, +20 Max HP)
const shieldRes = gm.refineEquipmentSlot('shield');
assert(shieldRes.success && shieldRes.newTier === 1, 'Shield refinement tier 1 succeeds');
const shieldStats = gm.getHeroCalculatedStats();
assert(shieldStats.defense === boostedStats.defense + 5, `Shield refinement added +5 Defense (${boostedStats.defense} -> ${shieldStats.defense})`);
assert(shieldStats.maxHp === boostedStats.maxHp + 20, `Shield refinement added +20 Max HP (${boostedStats.maxHp} -> ${shieldStats.maxHp})`);

// Refine sword to max (Tier 5)
for (let i = 2; i <= 5; i++) {
    const res = gm.refineEquipmentSlot('sword');
    assert(res.success && res.newTier === i, `Sword refined to Tier ${i}`);
}
const overMax = gm.refineEquipmentSlot('sword');
assert(!overMax.success && overMax.newTier === 5, 'Refinement beyond Tier 5 is cleanly blocked');

// 3. Arch-Mage Eldrin Boss Soulmelding
console.log('\n--- 3. Arch-Mage Eldrin Boss Soulmelding ---');
// Cannot meld non-extinct species
const unextinctMeld = gm.meldBossSoul('slime');
assert(!unextinctMeld.success, 'Cannot meld boss soul while species is not extinct');

// Mark slime extinct and meld
gm.setDebugExtinctionCount(1);
assert(gm.isSpeciesExtinct('slime'), 'Slime is now flagged as extinct');

const meldSuccess = gm.meldBossSoul('slime');
assert(meldSuccess.success, 'Melding extinct slime boss soul succeeds');
assert(gm.getBossMelds().includes('slime'), 'Slime recorded in bossMelds');

const duplicateMeld = gm.meldBossSoul('slime');
assert(!duplicateMeld.success, 'Duplicate boss soulmeld is cleanly blocked');

// 4. Species Extinction Telemetry & Reactivity
console.log('\n--- 4. Species Extinction Count & Telemetry ---');
gm.setDebugExtinctionCount(0);
assert(gm.getExtinctSpeciesCount() === 0, 'Extinction count 0 correctly calculated');

gm.setDebugExtinctionCount(3);
assert(gm.getExtinctSpeciesCount() === 3, 'Extinction count 3 correctly calculated');

gm.setDebugExtinctionCount(6);
assert(gm.getExtinctSpeciesCount() === 6, 'Extinction count 6 (All Extinct) correctly calculated');

// 5. Soul Level Progression up to Level 6
console.log('\n--- 5. Soul Level Progression (0 to 6) ---');
for (let lvl = 0; lvl <= 6; lvl++) {
    gm.setDebugSoulLevel(lvl);
    assert(gm.getSoulLevel() === lvl, `Soul Level ${lvl} successfully simulated and registered`);
}

// 6. Walkability of Levels 4-6 Evolution Entities
console.log('\n--- 6. Entity Grid Walkability Checks (Levels 4-6) ---');
const oakhaven = MapRegistry.getMap('town_oakhaven');
const oakhavenLvl46 = [
    { name: 'Farmer Bran', x: 10, y: 14 },
    { name: 'Harvest Cart', x: 12, y: 14 },
    { name: 'Merchant Lin', x: 16, y: 8 },
    { name: 'Trade Crate', x: 17, y: 8 },
    { name: 'Bell Tower', x: 9, y: 4 }
];
oakhavenLvl46.forEach(c => {
    const tile = oakhaven.grid[c.y][c.x];
    assert(tile === 3, `Oakhaven entity '${c.name}' at (${c.x}, ${c.y}) is walkable path (found ${tile})`);
});

const aetheria = MapRegistry.getMap('town_aetheria');
const aetheriaLvl46 = [
    { name: 'Grand Arcane Nexus', x: 10, y: 5 },
    { name: 'Resonator Pylon 1', x: 8, y: 3 },
    { name: 'Resonator Pylon 2', x: 12, y: 3 }
];
aetheriaLvl46.forEach(c => {
    const tile = aetheria.grid[c.y][c.x];
    assert([0, 3].includes(tile), `Aetheria entity '${c.name}' at (${c.x}, ${c.y}) is walkable (found ${tile})`);
});

const ironspire = MapRegistry.getMap('town_ironspire');
const ironspireLvl46 = [
    { name: 'The Grand Blast Furnace', x: 6, y: 4 },
    { name: 'Ore Cart', x: 5, y: 6 },
    { name: 'Weapon Rack', x: 11, y: 6 },
    { name: 'Citadel Warmaster', x: 13, y: 5 }
];
ironspireLvl46.forEach(c => {
    const tile = ironspire.grid[c.y][c.x];
    assert([3, 4].includes(tile), `Ironspire entity '${c.name}' at (${c.x}, ${c.y}) is walkable (found ${tile})`);
});

// Reset debug level
gm.setDebugSoulLevel(0);
console.log('\n🎉 ALL SPRINT 13 AUTOMATED TESTS PASSED SUCCESSFULLY!');
