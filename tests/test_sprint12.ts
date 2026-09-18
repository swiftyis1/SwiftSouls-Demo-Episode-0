// Automated validation script for Sprint 12: Evolving Regional Towns & Sci-Fi Meteor Drop Pod
// Run with: node --experimental-strip-types tests/test_sprint12.ts

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

console.log('=== SPRINT 12: REGIONAL TOWNS & METEOR POD VALIDATION ===\n');

// 1. Map Topologies & Backwards Compatibility
console.log('--- 1. Map Topologies & Backwards Compatibility ---');
const meteorPod = MapRegistry.getMap('meteor_pod');
assert(meteorPod !== undefined, 'meteor_pod is registered');
assert(meteorPod.width === 15 && meteorPod.height === 10, 'meteor_pod has 15 columns and 10 rows');
assert(meteorPod.grid[8][7] === 0, 'meteor_pod exit portal hatch is at (7, 8)');

const oakhaven = MapRegistry.getMap('town_oakhaven');
assert(oakhaven !== undefined, 'town_oakhaven is registered');
assert(oakhaven.width === 22 && oakhaven.height === 17, 'town_oakhaven has 22 columns and 17 rows');
assert(oakhaven.grid[9][5] === 0, 'town_oakhaven exit portal is at (5, 9)');

// Backwards compatibility check
const legacyTown = MapRegistry.getMap('town_map');
assert(legacyTown !== undefined && legacyTown.id === 'town_oakhaven', 'legacy town_map resolves to town_oakhaven');

const aetheria = MapRegistry.getMap('town_aetheria');
assert(aetheria !== undefined, 'town_aetheria is registered');
assert(aetheria.width === 21 && aetheria.height === 15, 'town_aetheria has 21 columns and 15 rows');
assert(aetheria.grid[13][10] === 0, 'town_aetheria exit portal is at (10, 13)');

const ironspire = MapRegistry.getMap('town_ironspire');
assert(ironspire !== undefined, 'town_ironspire is registered');
assert(ironspire.width === 21 && ironspire.height === 15, 'town_ironspire has 21 columns and 15 rows');
assert(ironspire.grid[13][10] === 0, 'town_ironspire exit portal is at (10, 13)');

// 2. Overworld Portal Connections
console.log('\n--- 2. Overworld Portal Connections ---');
const worldMap = MapRegistry.getMap('world_map');
assert(worldMap !== undefined, 'world_map is registered');

// Portals check
const meteorPortal = worldMap.portals.find(p => p.targetMapId === 'meteor_pod');
assert(meteorPortal !== undefined && meteorPortal.gridX === 3 && meteorPortal.gridY === 5, 'Portal at (3, 5) connects to meteor_pod');
assert(meteorPortal?.targetGridX === 7 && meteorPortal?.targetGridY === 7, 'Portal enters meteor_pod at (7, 7)');

const oakhavenPortal = worldMap.portals.find(p => p.targetMapId === 'town_oakhaven');
assert(oakhavenPortal !== undefined && oakhavenPortal.gridX === 4 && oakhavenPortal.gridY === 7, 'Portal at (4, 7) connects to town_oakhaven');
assert(oakhavenPortal?.targetGridX === 5 && oakhavenPortal?.targetGridY === 8, 'Portal enters town_oakhaven at (5, 8)');

const aetheriaPortal = worldMap.portals.find(p => p.targetMapId === 'town_aetheria');
assert(aetheriaPortal !== undefined && aetheriaPortal.gridX === 20 && aetheriaPortal.gridY === 8, 'Portal at (20, 8) connects to town_aetheria');
assert(aetheriaPortal?.targetGridX === 10 && aetheriaPortal?.targetGridY === 12, 'Portal enters town_aetheria at (10, 12)');

const ironspirePortal = worldMap.portals.find(p => p.targetMapId === 'town_ironspire');
assert(ironspirePortal !== undefined && ironspirePortal.gridX === 16 && ironspirePortal.gridY === 1, 'Portal at (16, 1) connects to town_ironspire');
assert(ironspirePortal?.targetGridX === 10 && ironspirePortal?.targetGridY === 12, 'Portal enters town_ironspire at (10, 12)');

// 3. Dynamic Town Name Progression
console.log('\n--- 3. Dynamic Town Name Progression ---');
assert(MapRegistry.getTownName('town_oakhaven', 0).includes('Wild Clearing'), 'Oakhaven SL0 is Wild Clearing');
assert(MapRegistry.getTownName('town_oakhaven', 1).includes('Pioneer Outpost'), 'Oakhaven SL1 is Pioneer Outpost');
assert(MapRegistry.getTownName('town_oakhaven', 2).includes('Agricultural Hamlet'), 'Oakhaven SL2 is Agricultural Hamlet');
assert(MapRegistry.getTownName('town_oakhaven', 3).includes('Prosperous Village'), 'Oakhaven SL3 is Prosperous Village');

assert(MapRegistry.getTownName('town_aetheria', 0).includes('Silent Grove'), 'Aetheria SL0 is Silent Grove');
assert(MapRegistry.getTownName('town_aetheria', 1).includes('Luminescent Grove'), 'Aetheria SL1 is Luminescent Grove');
assert(MapRegistry.getTownName('town_aetheria', 2).includes('Aetheric Sanctum'), 'Aetheria SL2 is Aetheric Sanctum');
assert(MapRegistry.getTownName('town_aetheria', 3).includes('Celestial Enclave'), 'Aetheria SL3 is Celestial Enclave');

assert(MapRegistry.getTownName('town_ironspire', 0).includes('Barren Quarry'), 'Ironspire SL0 is Barren Quarry');
assert(MapRegistry.getTownName('town_ironspire', 1).includes("Miner's Post"), 'Ironspire SL1 is Miner\'s Post');
assert(MapRegistry.getTownName('town_ironspire', 2).includes('Masonry Bastion'), 'Ironspire SL2 is Masonry Bastion');
assert(MapRegistry.getTownName('town_ironspire', 3).includes('The Grand Forge'), 'Ironspire SL3 is The Grand Forge');

assert(MapRegistry.getTownName('meteor_pod', 0).includes('Meteor Drop Pod'), 'meteor_pod has invariant sci-fi name');

// 4. Soul Level Progression & Simulator
console.log('\n--- 4. Soul Level Progression & Debug Simulation ---');
const gm = GameManager.instance;

gm.setDebugSoulLevel(0);
assert(gm.getSoulLevel() === 0, 'Debug Soul Level 0 registered');

gm.setDebugSoulLevel(1);
assert(gm.getSoulLevel() === 1, 'Debug Soul Level 1 registered');

gm.setDebugSoulLevel(2);
assert(gm.getSoulLevel() === 2, 'Debug Soul Level 2 registered');

gm.setDebugSoulLevel(3);
assert(gm.getSoulLevel() === 3, 'Debug Soul Level 3 registered');

// 5. Herbalist Full Party Recovery Mechanic
console.log('\n--- 5. Herbalist Full Recovery Service ---');
gm.setHeroHp(1);
gm.setHeroSp(0);
let stats = gm.getHeroCalculatedStats();
assert(stats.hp === 1, 'Hero HP lowered to 1 for test');
assert(stats.sp === 0, 'Hero SP lowered to 0 for test');

gm.fullHealParty();
stats = gm.getHeroCalculatedStats();
assert(stats.hp === stats.maxHp, `Hero HP fully restored to max (${stats.hp}/${stats.maxHp})`);
assert(stats.sp === stats.maxSp, `Hero SP fully restored to max (${stats.sp}/${stats.maxSp})`);

// 6. Validate Town Walkability for Evolution Positions
console.log('\n--- 6. Evolution Entities Grid Walkability ---');
// Oakhaven Walkability Check
const oakhavenCoords = [
    { name: 'Scout Kira', x: 14, y: 5 },
    { name: 'Loyal Hound', x: 16, y: 5 },
    { name: 'Herbalist Mira', x: 7, y: 13 },
    { name: 'Calico Cat', x: 8, y: 14 },
    { name: 'Meadow Sheep', x: 18, y: 14 }
];
oakhavenCoords.forEach(c => {
    const tile = oakhaven.grid[c.y][c.x];
    assert(tile === 3, `Oakhaven entity '${c.name}' at (${c.x}, ${c.y}) is on walkable path (found ${tile})`);
});

// Aetheria Walkability Check (0 = grass, 3 = path, both walkable)
const aetheriaCoords = [
    { name: 'Soul Altar', x: 10, y: 6 },
    { name: 'Astrologer Cynthia', x: 12, y: 6 },
    { name: 'Alchemist Vesper', x: 6, y: 8 },
    { name: 'Spirit Cat Familiar', x: 13, y: 8 },
    { name: 'Arch-Mage Eldrin', x: 10, y: 3 }
];
aetheriaCoords.forEach(c => {
    const tile = aetheria.grid[c.y][c.x];
    assert([0, 3].includes(tile), `Aetheria entity '${c.name}' at (${c.x}, ${c.y}) is walkable (found ${tile})`);
});

// Ironspire Walkability Check (3 = path, 4 = terrace, both walkable)
const ironspireCoords = [
    { name: 'Surveyor Dane', x: 12, y: 6 },
    { name: 'Quarry Hound', x: 13, y: 7 },
    { name: 'Architect Bowen', x: 12, y: 7 },
    { name: 'Master Blacksmith Thorgan', x: 8, y: 6 },
    { name: 'Masterwork Anvil', x: 9, y: 6 }
];
ironspireCoords.forEach(c => {
    const tile = ironspire.grid[c.y][c.x];
    assert([3, 4].includes(tile), `Ironspire entity '${c.name}' at (${c.x}, ${c.y}) is walkable (found ${tile})`);
});

// Reset debug level
gm.setDebugSoulLevel(0);
console.log('\n🎉 ALL SPRINT 12 AUTOMATED TESTS PASSED SUCCESSFULLY!');
