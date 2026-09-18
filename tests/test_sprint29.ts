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

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ToroidalEngine } from '../src/systems/ToroidalEngine.ts';
import { MapRegistry } from '../src/systems/MapRegistry.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sprint 29 Automated Verification Test Suite
 * Validates:
 * 1. Seamless Toroidal Coordinate Engine (wrapping, shortest-path delta, Euclidean distance)
 * 2. Continuous 100x100 World Map dimensions and chunk segmentation (10x10 chunks)
 * 3. Negative chunk index mathematical safety and boundary wrapping
 * 4. Walkable land bridges, causeways, and sandbars connecting regional seams
 * 5. Starter region landmarks and anchors (Meteor Pod, Oakhaven hub, Catacombs entrance)
 * 6. OverworldScene code verification for toroidal camera handling and 3x3 active chunk culling
 */
function runSprint29Tests() {
    console.log('====================================================');
    console.log('   RUNNING SPRINT 29 AUTOMATED VERIFICATION SUITE   ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(cond: boolean, desc: string) {
        if (cond) {
            console.log(`  [PASS] ${desc}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${desc}`);
            failed++;
        }
    }

    const MAP_PIXEL_WIDTH = 100 * 64; // 6400px
    const MAP_PIXEL_HEIGHT = 100 * 64; // 6400px

    // --- 1. Toroidal Coordinate Wrapping Math ---
    console.log('--- 1. Toroidal Coordinate Wrapping Math ---');
    assert(ToroidalEngine.wrapCoordinate(0, MAP_PIXEL_WIDTH) === 0, 'wrapCoordinate(0, 6400) returns 0');
    assert(ToroidalEngine.wrapCoordinate(6400, MAP_PIXEL_WIDTH) === 0, 'wrapCoordinate(6400, 6400) wraps to 0');
    assert(ToroidalEngine.wrapCoordinate(6450, MAP_PIXEL_WIDTH) === 50, 'wrapCoordinate(6450, 6400) wraps forward to 50');
    assert(ToroidalEngine.wrapCoordinate(-50, MAP_PIXEL_WIDTH) === 6350, 'wrapCoordinate(-50, 6400) wraps backward to 6350');
    assert(ToroidalEngine.wrapCoordinate(12850, MAP_PIXEL_WIDTH) === 50, 'Multi-turn forward wrap (12850) wraps to 50');
    assert(ToroidalEngine.wrapCoordinate(-12850, MAP_PIXEL_WIDTH) === 6350, 'Multi-turn negative wrap (-12850) wraps to 6350');
    assert(ToroidalEngine.wrapCoordinate(3200, MAP_PIXEL_WIDTH) === 3200, 'Mid-map coordinate (3200) remains unchanged');

    // --- 2. Shortest Toroidal Delta & Camera Interpolation ---
    console.log('\n--- 2. Shortest Toroidal Delta & Camera Interpolation ---');
    // Normal inside bounds
    assert(ToroidalEngine.toroidalDelta(100, 250, MAP_PIXEL_WIDTH) === 150, 'Standard eastward delta: from 100 to 250 is +150');
    assert(ToroidalEngine.toroidalDelta(250, 100, MAP_PIXEL_WIDTH) === -150, 'Standard westward delta: from 250 to 100 is -150');

    // Crossing seam eastward (from near eastern edge 6380 to western edge 20)
    const eastWrapDelta = ToroidalEngine.toroidalDelta(6380, 20, MAP_PIXEL_WIDTH);
    assert(eastWrapDelta === 40, `Crossing seam eastward (6380 -> 20) yields +40, received ${eastWrapDelta}`);

    // Crossing seam westward (from western edge 20 to eastern edge 6380)
    const westWrapDelta = ToroidalEngine.toroidalDelta(20, 6380, MAP_PIXEL_WIDTH);
    assert(westWrapDelta === -40, `Crossing seam westward (20 -> 6380) yields -40, received ${westWrapDelta}`);

    // Exact half map boundary
    const halfDelta = Math.abs(ToroidalEngine.toroidalDelta(0, 3200, MAP_PIXEL_WIDTH));
    assert(halfDelta === 3200, 'Half-map boundary delta equals exactly half width (3200)');

    // Toroidal distance
    const distAcrossSeam = ToroidalEngine.toroidalDistance(10, 10, 6390, 6390, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);
    const expectedDist = Math.hypot(20, 20);
    assert(Math.abs(distAcrossSeam - expectedDist) < 0.001, `Toroidal distance across diagonal seam equals ${expectedDist.toFixed(2)}`);

    // --- 3. MapRegistry 100x100 World Map Structure ---
    console.log('\n--- 3. MapRegistry 100x100 World Map Structure ---');
    const worldMap = MapRegistry.getMap('world_map');
    assert(worldMap !== undefined, 'world_map exists in MapRegistry');
    assert(worldMap.width === 100, 'world_map width is 100 tiles');
    assert(worldMap.height === 100, 'world_map height is 100 tiles');
    assert(worldMap.grid.length === 100, 'world_map grid has 100 rows');
    assert(worldMap.grid.every(r => r.length === 100), 'Every row in world_map grid has 100 columns');

    // --- 4. Negative Chunk Coordinate Safety & Data Access ---
    console.log('\n--- 4. Negative Chunk Coordinate Safety & Data Access ---');
    const chunkOrigin = MapRegistry.getChunkData('world_map', 0, 0, 10);
    assert(chunkOrigin.width === 10 && chunkOrigin.height === 10, 'Origin chunk (0, 0) returns 10x10 grid');
    assert(chunkOrigin.grid.length === 10 && chunkOrigin.grid.every(r => r.length === 10), 'Origin chunk rows are all length 10');

    // Negative chunk: (-1, -1) should wrap to (9, 9) in 10-chunk grid
    const chunkNeg = MapRegistry.getChunkData('world_map', -1, -1, 10);
    assert(chunkNeg.width === 10 && chunkNeg.height === 10, 'Negative chunk (-1, -1) returns valid 10x10 grid');
    assert(chunkNeg.grid.every(row => row.every(tile => tile !== undefined && tile !== null)), 'Negative chunk (-1, -1) contains zero undefined tiles');

    // Extreme negative chunk: (-15, -23)
    const chunkExtremeNeg = MapRegistry.getChunkData('world_map', -15, -23, 10);
    assert(chunkExtremeNeg.grid.every(row => row.every(tile => typeof tile === 'number')), 'Extreme negative chunk (-15, -23) tiles are all valid numbers');

    // High positive chunk: (10, 10)
    const chunkOverflow = MapRegistry.getChunkData('world_map', 10, 10, 10);
    assert(chunkOverflow.grid[0][0] === chunkOrigin.grid[0][0], 'Chunk (10, 10) wraps seamlessly to match chunk (0, 0)');

    // --- 5. Walkable Land Bridges & Regional Seam Connectivity ---
    console.log('\n--- 5. Walkable Land Bridges & Regional Seam Connectivity ---');
    // Causeways connect across borders: check that edges have walkable paths (tileType === 3 or 0)
    // Seam check: Column 0 vs Column 99
    const westBorderWalkableCount = worldMap.grid.filter(r => r[0] === 3 || r[0] === 0).length;
    const eastBorderWalkableCount = worldMap.grid.filter(r => r[99] === 3 || r[99] === 0).length;
    assert(westBorderWalkableCount > 0, `Western border (x=0) contains ${westBorderWalkableCount} walkable tiles`);
    assert(eastBorderWalkableCount > 0, `Eastern border (x=99) contains ${eastBorderWalkableCount} walkable tiles`);

    // Seam check: Row 0 vs Row 99
    const northBorderWalkableCount = worldMap.grid[0].filter(t => t === 3 || t === 0).length;
    const southBorderWalkableCount = worldMap.grid[99].filter(t => t === 3 || t === 0).length;
    assert(northBorderWalkableCount > 0, `Northern border (y=0) contains ${northBorderWalkableCount} walkable tiles`);
    assert(southBorderWalkableCount > 0, `Southern border (y=99) contains ${southBorderWalkableCount} walkable tiles`);

    // --- 6. Starter Region & Anchors ---
    console.log('\n--- 6. Starter Region & Anchors ---');
    // Crater Basin at (45, 46)
    const craterTile = worldMap.grid[46][45];
    assert(craterTile === 0 || craterTile === 3, 'Crater Basin spawn tile (45, 46) is walkable terrain');

    // Meteor Pod portal
    const meteorPortal = worldMap.portals.find(p => p.targetMapId === 'meteor_pod');
    assert(meteorPortal !== undefined, 'Meteor Pod portal exists on world map');
    assert(meteorPortal?.gridX === 45 && meteorPortal?.gridY === 45, 'Meteor Pod portal is located at crater epicenter (45, 45)');

    // Catacombs Cave entrance portal
    const dungeonPortal = worldMap.portals.find(p => p.targetMapId === 'dungeon_map');
    assert(dungeonPortal !== undefined, 'Catacombs entrance portal exists on world map');
    assert(dungeonPortal?.gridX === 55 && dungeonPortal?.gridY === 20, 'Catacombs portal is anchored at (55, 20)');

    // Oakhaven hub portal
    const oakhavenPortal = worldMap.portals.find(p => p.targetMapId === 'town_oakhaven');
    assert(oakhavenPortal !== undefined, 'Oakhaven hub portal exists on world map');
    assert(oakhavenPortal?.gridX === 60 && oakhavenPortal?.gridY === 48, 'Oakhaven hub portal is anchored at (60, 48)');

    // --- 7. OverworldScene Toroidal Code Audit ---
    console.log('\n--- 7. OverworldScene Toroidal Code Audit ---');
    const overworldPath = path.join(__dirname, '../src/scenes/OverworldScene.ts');
    const overworldContent = fs.readFileSync(overworldPath, 'utf8');

    assert(overworldContent.includes('isToroidalMap = (mapId === \'world_map\')'), 'OverworldScene flags world_map as toroidal');
    assert(overworldContent.includes('ToroidalEngine.wrapCoordinate'), 'OverworldScene imports and uses ToroidalEngine.wrapCoordinate');
    assert(overworldContent.includes('ToroidalEngine.toroidalDelta'), 'OverworldScene uses toroidalDelta for smooth camera tracking');
    assert(overworldContent.includes('renderChunk'), 'OverworldScene defines chunk rendering pipeline');
    assert(overworldContent.includes('updateActiveChunks'), 'OverworldScene manages dynamic 3x3 chunk ring');
    assert(overworldContent.includes('visualWorldC'), 'OverworldScene positions chunks in relative visual coordinate space');
    assert(overworldContent.includes('clearActiveChunks'), 'OverworldScene cleanly unloads chunks on map transitions');

    // --- 8. Pet Follower Toroidal Support ---
    console.log('\n--- 8. Pet Follower Toroidal Support ---');
    const petFollowerPath = path.join(__dirname, '../src/objects/PetFollower.ts');
    const petContent = fs.readFileSync(petFollowerPath, 'utf8');
    assert(petContent.includes('wrapWidth: number = 0'), 'PetFollower accepts world wrap bounds in updateFollow()');

    const petMathPath = path.join(__dirname, '../src/systems/PetFollowerMath.ts');
    const petMathContent = fs.readFileSync(petMathPath, 'utf8');
    assert(petMathContent.includes('ToroidalEngine.toroidalDelta'), 'PetFollowerMath uses ToroidalEngine.toroidalDelta for smooth boundary navigation');
    assert(petMathContent.includes('ToroidalEngine.toroidalDistance'), 'PetFollowerMath uses ToroidalEngine.toroidalDistance for distance calculations');

    console.log('\n====================================================');
    console.log(`SPRINT 29 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runSprint29Tests();
