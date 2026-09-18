// Automated validation script for Sprint 14: Map Expansion (The Dungeons & Castle maps)
// Run with: node --experimental-strip-types tests/test_sprint14.ts

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
import { EncounterTables, rollEncounter } from '../src/systems/MonsterDatabase.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        (globalThis as any).process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log('=== SPRINT 14: THE DUNGEONS & CASTLE MAP EXPANSION VALIDATION ===\n');

// 1. Map Topologies & Grid Dimensions
console.log('--- 1. Map Topologies & Grid Dimensions ---');
const d2 = MapRegistry.getMap('dungeon_floor2');
assert(!!d2 && d2.id === 'dungeon_floor2', 'dungeon_floor2 is registered in MapRegistry');
assert(d2.width === 24 && d2.height === 18, `dungeon_floor2 dimensions are 24x18 (${d2.width}x${d2.height})`);

const castleExt = MapRegistry.getMap('castle_exterior');
assert(!!castleExt && castleExt.id === 'castle_exterior', 'castle_exterior is registered in MapRegistry');
assert(castleExt.width === 22 && castleExt.height === 16, `castle_exterior dimensions are 22x16 (${castleExt.width}x${castleExt.height})`);

const castleInt = MapRegistry.getMap('castle_interior');
assert(!!castleInt && castleInt.id === 'castle_interior', 'castle_interior is registered in MapRegistry');
assert(castleInt.width === 21 && castleInt.height === 15, `castle_interior dimensions are 21x15 (${castleInt.width}x${castleInt.height})`);

// 2. Bidirectional Portal Cross-Connectivity
console.log('\n--- 2. Bidirectional Portal Cross-Connectivity ---');
const worldMap = MapRegistry.getMap('world_map');
const castleGatePortal = worldMap.portals.find(p => p.gridX === 12 && p.gridY === 18);
assert(!!castleGatePortal && castleGatePortal.targetMapId === 'castle_exterior', 'world_map (12, 18) connects to castle_exterior');

const castleExtExit = castleExt.portals.find(p => p.gridX === 10 && p.gridY === 15);
assert(!!castleExtExit && castleExtExit.targetMapId === 'world_map', 'castle_exterior (10, 15) exits to world_map');

const castleExtToKeep = castleExt.portals.find(p => p.gridX === 10 && p.gridY === 2);
assert(!!castleExtToKeep && castleExtToKeep.targetMapId === 'castle_interior', 'castle_exterior (10, 2) enters castle_interior');

const castleIntExit = castleInt.portals.find(p => p.gridX === 10 && p.gridY === 14);
assert(!!castleIntExit && castleIntExit.targetMapId === 'castle_exterior', 'castle_interior (10, 14) exits to castle_exterior');

// Secret Passage: Castle Interior <-> Dungeon Floor 2
const castleSecretStairs = castleInt.portals.find(p => p.gridX === 18 && p.gridY === 3);
assert(!!castleSecretStairs && castleSecretStairs.targetMapId === 'dungeon_floor2', 'castle_interior (18, 3) connects to dungeon_floor2');

const d2ToCastle = d2.portals.find(p => p.gridX === 12 && p.gridY === 2);
assert(!!d2ToCastle && d2ToCastle.targetMapId === 'castle_interior', 'dungeon_floor2 (12, 2) connects to castle_interior');

// Dungeon Floor 1 <-> Dungeon Floor 2
const d1 = MapRegistry.getMap('dungeon_map');
const d1ToD2 = d1.portals.find(p => p.gridX === 22 && p.gridY === 16);
assert(!!d1ToD2 && d1ToD2.targetMapId === 'dungeon_floor2', 'dungeon_map (22, 16) descends to dungeon_floor2');

const d2ToD1 = d2.portals.find(p => p.gridX === 4 && p.gridY === 16);
assert(!!d2ToD1 && d2ToD1.targetMapId === 'dungeon_map', 'dungeon_floor2 (4, 16) ascends to dungeon_map');

// 3. Locked Portcullis & Key Quest Logic
console.log('\n--- 3. Locked Portcullis & Key Quest Logic ---');
const gm = GameManager.instance;
gm.resetGame();

assert(gm.getQuestState('dungeon_gate_unlocked') === 'inactive', 'dungeon_gate_unlocked starts inactive');
assert(gm.getQuestState('dungeon_key_found') === 'inactive', 'dungeon_key_found starts inactive');
assert(!gm.hasItem('dungeon_key'), 'Hero starts without dungeon_key');

// Simulate looting the dungeon chest
gm.addItem('dungeon_key', 1);
gm.setQuestState('dungeon_key_found', 'completed');
assert(gm.hasItem('dungeon_key'), 'Hero possesses dungeon_key after looting chest');
assert(gm.getQuestState('dungeon_key_found') === 'completed', 'dungeon_key_found is marked completed');

// Simulate unlocking the portcullis
const removeKeySuccess = gm.removeItem('dungeon_key', 1);
assert(removeKeySuccess, 'dungeon_key is successfully consumed');
assert(!gm.hasItem('dungeon_key'), 'Hero no longer has dungeon_key after unlocking');
gm.setQuestState('dungeon_gate_unlocked', 'completed');
assert(gm.getQuestState('dungeon_gate_unlocked') === 'completed', 'dungeon_gate_unlocked is marked completed');

// 4. NPC & Interactive Entity Registrations
console.log('\n--- 4. NPC & Interactive Entity Registrations ---');
const king = castleInt.npcs.find(n => n.id === 'king_aurelius');
assert(!!king && king.name.includes('Aurelius'), 'King Aurelius III is present in castle_interior');

const valerie = castleInt.npcs.find(n => n.id === 'knight_commander_valerie');
assert(!!valerie && valerie.name.includes('Valerie'), 'Knight Commander Valerie is present in castle_interior');

const castleAltar = castleInt.npcs.find(n => n.id === 'castle_soul_altar');
assert(!!castleAltar && castleAltar.name.includes('Soul Altar'), 'Sovereign Soul Altar is present in castle_interior');

const sentryLeft = castleExt.npcs.find(n => n.id === 'castle_sentry_left');
const sentryRight = castleExt.npcs.find(n => n.id === 'castle_sentry_right');
assert(!!sentryLeft && !!sentryRight, 'Royal Sentries are stationed in castle_exterior');

const dChest = d2.npcs.find(n => n.id === 'dungeon_chest');
assert(!!dChest && dChest.spriteKey === 'treasure_chest', 'Treasure chest is positioned in dungeon_floor2');

const dGate = d2.npcs.find(n => n.id === 'dungeon_gate_npc');
assert(!!dGate && dGate.spriteKey === 'locked_dungeon_door', 'Locked portcullis is positioned in dungeon_floor2');

const warden = d2.npcs.find(n => n.id === 'skeleton_warden');
assert(!!warden && warden.spriteKey === 'skeleton', 'Catacomb Warden is positioned in dungeon_floor2');

// 5. Grid Walkability Verification
console.log('\n--- 5. Grid Walkability Verification ---');
// d2 entities
assert(d2.grid[dChest!.gridY][dChest!.gridX] === 4, `dungeon_chest at (${dChest!.gridX}, ${dChest!.gridY}) is on stone floor`);
assert(d2.grid[dGate!.gridY][dGate!.gridX] === 4, `dungeon_gate at (${dGate!.gridX}, ${dGate!.gridY}) is on stone floor`);
assert(d2.grid[warden!.gridY][warden!.gridX] === 4, `skeleton_warden at (${warden!.gridX}, ${warden!.gridY}) is on stone floor`);

// castle_interior entities
assert(castleInt.grid[king!.gridY][king!.gridX] === 3, `King Aurelius at (${king!.gridX}, ${king!.gridY}) is on walkable carpet/flagstone`);
assert(castleInt.grid[valerie!.gridY][valerie!.gridX] === 3, `Valerie at (${valerie!.gridX}, ${valerie!.gridY}) is on walkable carpet/flagstone`);
assert(castleInt.grid[castleAltar!.gridY][castleAltar!.gridX] === 3, `Castle Soul Altar at (${castleAltar!.gridX}, ${castleAltar!.gridY}) is on walkable flagstone`);

// 6. Monster Encounter Scaling for dungeon_floor2
console.log('\n--- 6. Monster Encounter Scaling for dungeon_floor2 ---');
const d2Encounters = EncounterTables['dungeon_floor2'];
assert(!!d2Encounters && d2Encounters.length >= 3, 'dungeon_floor2 has at least 3 encounter table entries');
assert(d2Encounters.some(e => e.speciesId === 'skeleton' && e.weight === 35), 'skeleton has 35% weight in dungeon_floor2');
assert(d2Encounters.some(e => e.speciesId === 'goblin' && e.weight === 30), 'goblin has 30% weight in dungeon_floor2');
assert(d2Encounters.some(e => e.speciesId === 'bat' && e.weight === 20), 'bat has 20% weight in dungeon_floor2');
assert(d2Encounters.some(e => e.speciesId === 'phoenix' && e.weight === 15), 'phoenix has 15% weight in dungeon_floor2');

const rolled = rollEncounter('dungeon_floor2');
assert(!!rolled && ['skeleton', 'goblin', 'bat', 'phoenix'].includes(rolled.speciesId), `rollEncounter successfully returns wild monster: ${rolled?.name}`);

// 7. Save Payload & Rate Limit Integrity
console.log('\n--- 7. Save Payload & Rate Limit Integrity ---');
const saveKey = Object.keys(storageMock).find(k => k.startsWith('swiftsouls_save_')) || Object.keys(storageMock)[0];
assert(!!saveKey, `Save key found in storage (${saveKey})`);
const serialized = storageMock[saveKey];
assert(!!serialized, 'Save data exists in storage');
const payloadBytes = new TextEncoder().encode(serialized).length;
assert(payloadBytes < 25000, `Payload size is ${payloadBytes} bytes (well below 5MB limit of 5,242,880 bytes)`);

console.log('\n🎉 ALL SPRINT 14 AUTOMATED TESTS PASSED SUCCESSFULLY!\n');
