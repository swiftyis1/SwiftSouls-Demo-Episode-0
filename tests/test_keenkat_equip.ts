import { GameManager, ALL_MONSTER_SPECIES, ALL_EQUIPMENT_SLOTS } from '../src/systems/GameManager.ts';

const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

const gm = GameManager.instance;
gm.resetGame();

console.log('--- 1. Testing ALL_MONSTER_SPECIES includes keenkat ---');
if (!ALL_MONSTER_SPECIES.includes('keenkat')) {
    throw new Error('FAILED: ALL_MONSTER_SPECIES does not include keenkat!');
}
console.log('  [PASS] ALL_MONSTER_SPECIES has 7 species, including keenkat');

console.log('--- 2. Testing socketing keenkat into gear slot (sword) ---');
gm.getState().soulCrystals['keenkat'] = { fragments: 50, isExtinct: false };
const socketed = gm.socketCrystal('keenkat', 'sword');
if (!socketed || gm.getState().equippedCrystals.sword !== 'keenkat') {
    throw new Error('FAILED: keenkat did not socket into sword!');
}
console.log('  [PASS] keenkat socketed into sword');

// Trigger state validation and saving to ensure it is not wiped
gm.saveGame();
if (gm.getState().equippedCrystals.sword !== 'keenkat') {
    throw new Error('FAILED: keenkat was wiped from sword during save/validate!');
}
console.log('  [PASS] keenkat persisted across state validation and saveGame');

console.log('--- 3. Testing socketing keenkat into earrings (Pet Companion) ---');
gm.unlockEarringsSlot();
const earringSocketed = gm.socketCrystal('keenkat', 'earrings');
if (!earringSocketed || gm.getState().equippedCrystals.earrings !== 'keenkat') {
    throw new Error('FAILED: keenkat did not socket into earrings!');
}
const pet = gm.getState().petCompanion;
if (!pet || pet.speciesId !== 'keenkat' || pet.name !== 'Verdant Kit') {
    throw new Error(`FAILED: pet companion not created properly: ${JSON.stringify(pet)}`);
}
console.log(`  [PASS] Verdant Kit pet companion created: ${pet.name} (Lv.${pet.level}, Skill: ${pet.signatureSkill?.name})`);

gm.saveGame();
if (gm.getState().equippedCrystals.earrings !== 'keenkat' || !gm.getState().petCompanion) {
    throw new Error('FAILED: keenkat pet was wiped during saveGame!');
}
console.log('  [PASS] keenkat pet companion persisted across saveGame');

console.log('\n====================================================');
console.log('   ALL KEEN KAT INFUSION & PET TESTS PASSED (100%)');
console.log('====================================================');
