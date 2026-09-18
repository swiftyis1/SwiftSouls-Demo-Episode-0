import { GameManager } from '../src/systems/GameManager.ts';
import { CharacterLayerCompositor } from '../src/systems/CharacterLayerCompositor.ts';

function assert(condition: boolean, msg: string) {
    if (!condition) {
        console.error(`FAIL: ${msg}`);
        process.exit(1);
    }
    console.log(`PASS: ${msg}`);
}

// Mock localStorage for Node test environment
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

console.log('=== VERIFYING VISUAL LAYER REFINEMENTS ===');

// 1. Uninfused State
GameManager.instance.resetGame();
const uninfusedLayers = CharacterLayerCompositor.getCompositedLayers({
    equippedCrystals: GameManager.instance.getState().equippedCrystals
});

const uninfusedSword = uninfusedLayers.find(l => l.type === 'sword');
const uninfusedShield = uninfusedLayers.find(l => l.type === 'shield');
const uninfusedHelmet = uninfusedLayers.find(l => l.type === 'helmet');

assert(uninfusedSword?.assetKey === 'sword_bronze', 'Uninfused sword defaults to sword_bronze');
assert(uninfusedShield !== undefined, 'Default shield is present in layers when uninfused');
assert(uninfusedShield?.assetKey === 'shield_silver', 'Default shield is shield_silver');
assert(uninfusedHelmet?.offsetY === 0, 'Helmet layer offsetY is 0 for natural brow alignment');

// 2. Bat Infusion State
GameManager.instance.getState().soulCrystals['bat'] = { fragments: 5, isExtinct: false };
GameManager.instance.equipSoulCrystal('sword', 'bat');
const batLayers = CharacterLayerCompositor.getCompositedLayers({
    equippedCrystals: GameManager.instance.getState().equippedCrystals
});
const batSword = batLayers.find(l => l.type === 'sword');
assert(batSword?.assetKey === 'sword_winged', 'Bat infused sword dynamically resolves to sword_winged (Bat Sword)');

// 3. Unsocket Sword State
GameManager.instance.unsocketCrystal('sword');
const unsocketedLayers = CharacterLayerCompositor.getCompositedLayers({
    equippedCrystals: GameManager.instance.getState().equippedCrystals
});
const unsocketedSword = unsocketedLayers.find(l => l.type === 'sword');
assert(unsocketedSword?.assetKey === 'sword_bronze', 'Unsocketed sword dynamically reverts to sword_bronze');

console.log('=== ALL VISUAL REFINEMENTS VERIFIED 100% ===');
