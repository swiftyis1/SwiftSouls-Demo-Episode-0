import { GameManager } from '../src/systems/GameManager.ts';

const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

const gm = GameManager.instance;
console.log('--- 1. Testing fresh browser state ---');
if (gm.hasAnySave()) {
    throw new Error('FAILED: fresh browser has saves!');
}
console.log('  [PASS] Fresh browser starts with 0 saves (no pre-seeded slots)');

console.log('--- 2. Testing creating new game save in Slot 1 ---');
gm.resetGame();
gm.saveGame(1);
if (!gm.hasAnySave()) {
    throw new Error('FAILED: save slot 1 was not saved!');
}
console.log('  [PASS] User created save in Slot 1 properly recorded');

console.log('\n====================================================');
console.log('   FRESH SAVE SLOTS TEST PASSED (100%)');
console.log('====================================================');
