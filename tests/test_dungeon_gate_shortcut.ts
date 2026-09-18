const storageMock: { [key: string]: string } = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
};

import { MapRegistry } from '../src/systems/MapRegistry';
import { GameManager } from '../src/systems/GameManager';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
}

console.log('=== VERIFYING DUNGEON GATE SHORTCUT ARCHITECTURE ===\n');

// 1. Map Registries & Portal Cross-Links
console.log('--- 1. Portal Connectivity & Tile Coordinates ---');
const d2 = MapRegistry.getMap('dungeon_floor2');
const castleInt = MapRegistry.getMap('castle_interior');

assert(!!d2, 'dungeon_floor2 is loaded');
assert(!!castleInt, 'castle_interior is loaded');

const castleToD2 = castleInt.portals.find(p => p.targetMapId === 'dungeon_floor2');
assert(!!castleToD2 && castleToD2.gridX === 18 && castleToD2.gridY === 3, 'castle_interior secret stairs at (18, 3) leads to dungeon_floor2');
assert(castleToD2!.targetGridX === 12 && castleToD2!.targetGridY === 3, 'castle stairs descend to dungeon_floor2 landing at (12, 3)');

const d2ToCastle = d2.portals.find(p => p.targetMapId === 'castle_interior');
assert(!!d2ToCastle && d2ToCastle.gridX === 12 && d2ToCastle.gridY === 2, 'dungeon_floor2 ascent stairs at (12, 2) leads to castle_interior');
assert(d2ToCastle!.targetGridX === 18 && d2ToCastle!.targetGridY === 4, 'dungeon_floor2 ascends to castle_interior tile (18, 4)');

// 2. Choke Point Topology Verification
console.log('\n--- 2. Choke Point Isolation Topology ---');
const gateNpc = d2.npcs.find(n => n.id === 'dungeon_gate_npc');
assert(!!gateNpc && gateNpc.gridX === 12 && gateNpc.gridY === 4, 'Ancient Portcullis is anchored at (12, 4)');

// Verify that column 12 is the ONLY walkable passage in rows 2 and 3
for (let c = 0; c < d2.width; c++) {
    if (c !== 12) {
        assert(d2.grid[2][c] === 1, `Row 2 col ${c} is solid wall`);
        assert(d2.grid[3][c] === 1, `Row 3 col ${c} is solid wall`);
    }
}
// Verify that column 12 on row 4 is flanked by walls on both sides
for (let c = 5; c <= 11; c++) {
    assert(d2.grid[4][c] === 1, `Row 4 west flanking col ${c} is solid wall`);
}
for (let c = 13; c <= 17; c++) {
    assert(d2.grid[4][c] === 1, `Row 4 east flanking col ${c} is solid wall`);
}
assert(d2.grid[2][12] === 4, 'Row 2 col 12 is walkable stair landing');
assert(d2.grid[3][12] === 4, 'Row 3 col 12 is walkable corridor landing');
assert(d2.grid[4][12] === 4, 'Row 4 col 12 is gate doorway tile');

// 3. BFS Reachability: Locked vs Unlocked
console.log('\n--- 3. BFS Path Isolation Analysis ---');

function isReachable(startX: number, startY: number, targetX: number, targetY: number, gateBlocked: boolean): boolean {
    const queue: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    const dirs = [
        [0, 1], [0, -1], [1, 0], [-1, 0]
    ];

    while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        if (cx === targetX && cy === targetY) return true;

        for (const [dx, dy] of dirs) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx < 0 || nx >= d2.width || ny < 0 || ny >= d2.height) continue;
            const key = `${nx},${ny}`;
            if (visited.has(key)) continue;

            // Check if blocked by gate
            if (gateBlocked && nx === 12 && ny === 4) continue;

            // Check wall collision (tile 1 is wall)
            if (d2.grid[ny][nx] === 1) continue;

            visited.add(key);
            queue.push([nx, ny]);
        }
    }
    return false;
}

// When gate is blocked:
const canReachDungeonFromCastle = isReachable(12, 3, 12, 5, true);
assert(!canReachDungeonFromCastle, 'When gate is locked, player entering at (12, 3) CANNOT walk down to (12, 5)');

const canReachChestFromCastle = isReachable(12, 3, 20, 4, true);
assert(!canReachChestFromCastle, 'When gate is locked, player entering at (12, 3) CANNOT reach the chest at (20, 4)');

const canReturnToStairsFromLanding = isReachable(12, 3, 12, 2, true);
assert(canReturnToStairsFromLanding, 'Player at (12, 3) CAN freely return up the stairs to (12, 2) without getting trapped');

const canDungeonReachStairsWhenLocked = isReachable(4, 15, 12, 2, true);
assert(!canDungeonReachStairsWhenLocked, 'When gate is locked, player entering from dungeon F1 CANNOT reach castle stairs (12, 2)');

// When gate is UNLOCKED:
const canReachDungeonWhenUnlocked = isReachable(12, 3, 12, 5, false);
assert(canReachDungeonWhenUnlocked, 'When gate is unlocked, passage between (12, 3) and (12, 5) is fully open');

const canDungeonReachCastleWhenUnlocked = isReachable(4, 15, 12, 2, false);
assert(canDungeonReachCastleWhenUnlocked, 'When gate is unlocked, player from dungeon F1 can reach castle stairs (12, 2)');

// 4. Quest Progression & Key Consumption
console.log('\n--- 4. Quest & Key Lifecycle Simulation ---');
const gm = GameManager.instance;
gm.resetGame();

assert(gm.getQuestState('dungeon_gate_unlocked') === 'inactive', 'dungeon_gate_unlocked starts inactive');
assert(!gm.hasItem('dungeon_key'), 'Hero has no key initially');

// Chest loot
gm.addItem('dungeon_key', 1);
gm.setQuestState('dungeon_key_found', 'completed');
assert(gm.hasItem('dungeon_key'), 'Hero receives dungeon_key from chest');

// Gate unlock
const consumed = gm.removeItem('dungeon_key', 1);
assert(consumed, 'Key is consumed on unlocking');
gm.setQuestState('dungeon_gate_unlocked', 'completed');
assert(gm.getQuestState('dungeon_gate_unlocked') === 'completed', 'dungeon_gate_unlocked is marked completed');
assert(!gm.hasItem('dungeon_key'), 'Key is no longer in inventory');

console.log('\n🎉 ALL DUNGEON GATE SHORTCUT TESTS PASSED SUCCESSFULLY!');
