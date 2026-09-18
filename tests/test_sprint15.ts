// Automated validation script for Sprint 15: Global Spawning Safety & Migration
// Run with: node --experimental-strip-types tests/test_sprint15.ts

// Mock localStorage for headless Node environment
const storageMock: { [key: string]: string } = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
};

import { GameManager } from '../src/systems/GameManager.ts';
import { 
    EncounterTables, 
    rollEncounter, 
    getAlphaBoss, 
    getGlobalEcosystemStatus,
    MonsterDatabase 
} from '../src/systems/MonsterDatabase.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        (globalThis as any).process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log('=== SPRINT 15: GLOBAL SPAWNING SAFETY & MIGRATION VALIDATION ===\n');

// 1. Phoenix Wild Spawning Registration
console.log('--- 1. Phoenix Wild Spawning Registration ---');
assert(!!MonsterDatabase['phoenix'], 'Phoenix Guardian exists in MonsterDatabase');
assert(MonsterDatabase['phoenix'].level === 5, 'Phoenix Guardian base level is LV 5');
assert(MonsterDatabase['phoenix'].maxHp === 100, 'Phoenix Guardian maxHp is 100');

const d2Table = EncounterTables['dungeon_floor2'];
assert(!!d2Table, 'dungeon_floor2 has encounter table');
const phoenixD2Entry = d2Table.find(e => e.speciesId === 'phoenix');
assert(!!phoenixD2Entry && phoenixD2Entry.weight === 15, 'Phoenix is registered in dungeon_floor2 with 15% weight');

const castleExtTable = EncounterTables['castle_exterior'];
assert(!!castleExtTable, 'castle_exterior has encounter table');
const phoenixCastleEntry = castleExtTable.find(e => e.speciesId === 'phoenix');
assert(!!phoenixCastleEntry && phoenixCastleEntry.weight === 30, 'Phoenix is registered in castle_exterior with 30% weight');

// 2. Ecosystem Telemetry & Initial Status
console.log('\n--- 2. Ecosystem Telemetry & Initial Status ---');
const gm = GameManager.instance;
for (const key of ['slime', 'snake', 'bat', 'goblin', 'skeleton', 'phoenix']) {
    gm.getState().soulCrystals[key] = { fragments: 0, isExtinct: false };
}
let ecosystem = getGlobalEcosystemStatus();
assert(ecosystem.totalSpecies === 6, `Total species tracked is 6 (found ${ecosystem.totalSpecies})`);
assert(ecosystem.activeSpecies.length === 6, `All 6 species initially active (found ${ecosystem.activeSpecies.length})`);
assert(!ecosystem.allExtinctOrEndangered, 'Ecosystem is not silenced initially');

// 3. Native Encounter Rolling
console.log('\n--- 3. Native Encounter Rolling ---');
let foundPhoenix = false;
for (let i = 0; i < 50; i++) {
    const mon = rollEncounter('dungeon_floor2');
    if (mon && mon.speciesId === 'phoenix') {
        foundPhoenix = true;
        break;
    }
}
assert(foundPhoenix, 'rollEncounter successfully rolled Phoenix Guardian in dungeon_floor2');

// 4. Global Spawning Safety & Territory Migration
console.log('\n--- 4. Global Spawning Safety & Territory Migration ---');
// Extinguish or endanger all native world_map species: slime, snake, bat
gm.getState().soulCrystals['slime'].isExtinct = true;
gm.getState().soulCrystals['slime'].fragments = 255;

gm.getState().soulCrystals['snake'].isExtinct = true;
gm.getState().soulCrystals['snake'].fragments = 255;

gm.getState().soulCrystals['bat'].fragments = 254; // Endangered
gm.getState().soulCrystals['bat'].isExtinct = false;

ecosystem = getGlobalEcosystemStatus();
assert(ecosystem.isUnderMigration, 'Ecosystem flags active territory migration');
assert(ecosystem.activeSpecies.length === 3, 'Active species remaining: goblin, skeleton, phoenix');
assert(ecosystem.endangeredSpecies.includes('bat'), 'Bat is flagged as endangered');
assert(ecosystem.extinctSpecies.includes('slime') && ecosystem.extinctSpecies.includes('snake'), 'Slime & Snake are flagged extinct');

// Crucial check: Even though all native world_map species (slime, snake, bat) are extinct/endangered,
// rollEncounter('world_map') must NOT return null. It must pull from the migrated species pool!
let migratedMonsterFound = false;
const validMigratedSpecies = ['goblin', 'skeleton', 'phoenix'];
for (let i = 0; i < 20; i++) {
    const mon = rollEncounter('world_map');
    assert(mon !== null, `Global Spawning Safety: rollEncounter('world_map') did not return null despite native species extinction`);
    if (mon && validMigratedSpecies.includes(mon.speciesId)) {
        migratedMonsterFound = true;
    }
}
assert(migratedMonsterFound, 'Migrated species (goblin/skeleton/phoenix) successfully appeared on world_map');

// 5. Planetary Wilderness Silence (Total Pacification)
console.log('\n--- 5. Planetary Wilderness Silence ---');
// Now extinguish/endanger the remaining 3 species as well
gm.getState().soulCrystals['goblin'].isExtinct = true;
gm.getState().soulCrystals['goblin'].fragments = 255;

gm.getState().soulCrystals['skeleton'].isExtinct = true;
gm.getState().soulCrystals['skeleton'].fragments = 255;

gm.getState().soulCrystals['phoenix'].fragments = 254; // Endangered
gm.getState().soulCrystals['phoenix'].isExtinct = false;

ecosystem = getGlobalEcosystemStatus();
assert(ecosystem.allExtinctOrEndangered, 'All 6 species are now either extinct or endangered');
assert(ecosystem.activeSpecies.length === 0, 'Zero wild species remaining active');

const worldAfterSilence = rollEncounter('world_map');
assert(worldAfterSilence === null, 'world_map encounters cleanly silenced when all 6 species are endangered/extinct');

const dungeonAfterSilence = rollEncounter('dungeon_map');
assert(dungeonAfterSilence === null, 'dungeon_map encounters cleanly silenced when all 6 species are endangered/extinct');

const d2AfterSilence = rollEncounter('dungeon_floor2');
assert(d2AfterSilence === null, 'dungeon_floor2 encounters cleanly silenced when all 6 species are endangered/extinct');

// 6. Phoenix Alpha Boss Specimen & Habitat
console.log('\n--- 6. Phoenix Alpha Boss Specimen & Habitat ---');
const phoenixBoss = getAlphaBoss('phoenix');
assert(phoenixBoss.name === 'Eternal Phoenix Sovereign', `Phoenix Alpha Boss name is Eternal Phoenix Sovereign (${phoenixBoss.name})`);
assert(phoenixBoss.level === 10, `Phoenix Alpha Boss level is 10 (${phoenixBoss.level})`);
assert(phoenixBoss.maxHp === 250, `Phoenix Alpha Boss maxHp is 250 (${phoenixBoss.maxHp})`);
assert(phoenixBoss.strength === 32, `Phoenix Alpha Boss strength is 32 (${phoenixBoss.strength})`);
assert(phoenixBoss.defense === 22, `Phoenix Alpha Boss defense is 22 (${phoenixBoss.defense})`);
assert(phoenixBoss.agility === 18, `Phoenix Alpha Boss agility is 18 (${phoenixBoss.agility})`);
assert(phoenixBoss.spriteKey === 'phoenix', `Phoenix Alpha Boss spriteKey is phoenix (${phoenixBoss.spriteKey})`);

// 7. Save Payload & 7-Slot Gear Integrity
console.log('\n--- 7. Save Payload & 7-Slot Gear Integrity ---');
gm.saveGame();
const rawSave = storageMock['swiftsouls_save_1'];
assert(!!rawSave, 'Save game was recorded in storage');
const payloadBytes = rawSave.length;
assert(payloadBytes < 25000, `Payload size is ${payloadBytes} bytes (well below 5MB limit)`);

const equipKeys = Object.keys(gm.getState().equippedCrystals);
assert(equipKeys.length === 7, `Hero has exactly 7 equipment slots (${equipKeys.length})`);
const expectedSlots = ['sword', 'shield', 'armor', 'helmet', 'ring1', 'ring2', 'amulet'];
expectedSlots.forEach(slot => {
    assert(equipKeys.includes(slot), `Equipment slot '${slot}' is present`);
});

console.log('\n🎉 ALL SPRINT 15 AUTOMATED TESTS PASSED SUCCESSFULLY!\n');
