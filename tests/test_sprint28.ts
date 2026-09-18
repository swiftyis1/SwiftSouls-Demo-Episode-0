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
import { GameManager } from '../src/systems/GameManager.ts';
import { CharacterLayerCompositor } from '../src/systems/CharacterLayerCompositor.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sprint 28 Automated Verification Test Suite
 * Validates:
 * 1. Gender Selection Persistence Engine (GameManager state, set/get, default repair)
 * 2. Gender-Aware Base Sprite Selection in CharacterLayerCompositor (Valen -> 'player', Cora -> 'player_female')
 * 3. Layer Compositing Integrity with Cora Swift (cape, armor, circlet, shield, sword)
 * 4. Save Slot Preview Payload carrying playerGender
 * 5. Melodie Art Asset Checklist verification for Cora Swift & Grass Patch
 * 6. BootScene procedural asset registration for Cora Swift
 */
function runSprint28Tests() {
    console.log('====================================================');
    console.log('   RUNNING SPRINT 28 AUTOMATED VERIFICATION SUITE   ');
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

    const gm = GameManager.instance;

    // --- 1. Gender Selection & State Persistence ---
    console.log('--- 1. Gender Selection & State Persistence ---');
    gm.resetGame();
    assert(gm.getPlayerGender() === 'male', 'Default protagonist gender on fresh game reset is male (Valen)');

    gm.setPlayerGender('female');
    assert(gm.getPlayerGender() === 'female', 'setPlayerGender("female") correctly stores female protagonist (Cora)');

    gm.setPlayerGender('male');
    assert(gm.getPlayerGender() === 'male', 'setPlayerGender("male") correctly switches back to Valen');

    gm.setPlayerGender('female');

    // --- 2. State Repair & Legacy Save Backward Compatibility ---
    console.log('\n--- 2. State Repair & Backward Compatibility ---');
    const legacyState: any = {
        saveSlot: 2,
        heroName: 'AncientPlayer',
        gold: 100,
        equippedCrystals: {}
    };
    (gm as any).validateAndRepairState(legacyState);
    assert(legacyState.playerGender === 'male', 'Legacy save without playerGender is repaired to default "male"');

    const invalidGenderState: any = {
        saveSlot: 3,
        heroName: 'CorruptedHero',
        playerGender: 'unknown_alien'
    };
    (gm as any).validateAndRepairState(invalidGenderState);
    assert(invalidGenderState.playerGender === 'male', 'Invalid playerGender string is safely repaired to default "male"');

    const validFemaleState: any = {
        saveSlot: 4,
        heroName: 'CoraLegacy',
        playerGender: 'female'
    };
    (gm as any).validateAndRepairState(validFemaleState);
    assert(validFemaleState.playerGender === 'female', 'Valid female gender is preserved during state validation');

    // --- 3. CharacterLayerCompositor Gender Routing ---
    console.log('\n--- 3. CharacterLayerCompositor Gender Routing ---');
    const maleLayers = CharacterLayerCompositor.getCompositedLayers({
        equippedCrystals: {},
        gender: 'male',
        direction: 'down',
        isMoving: false
    });
    const maleBase = maleLayers.find(l => l.type === 'base');
    assert(maleBase !== undefined, 'Base layer exists for male hero');
    assert(maleBase?.assetKey === 'player', 'Male hero maps to "player" sprite key (Valen Swift)');

    const femaleLayers = CharacterLayerCompositor.getCompositedLayers({
        equippedCrystals: {},
        gender: 'female',
        direction: 'down',
        isMoving: false
    });
    const femaleBase = femaleLayers.find(l => l.type === 'base');
    assert(femaleBase !== undefined, 'Base layer exists for female hero (Cora Swift)');
    assert(femaleBase?.assetKey === 'player_female', 'Female hero maps to "player_female" sprite key (Cora Swift)');

    // --- 4. Layer Ordering & Infusion Integrity for Cora Swift ---
    console.log('\n--- 4. Visual Layering & Equipment Compositing for Cora ---');
    const equippedCoraLayers = CharacterLayerCompositor.getCompositedLayers({
        equippedCrystals: {
            sword: 'slime',
            shield: 'goblin',
            armor: 'bat',
            helmet: 'phoenix'
        },
        gender: 'female',
        direction: 'right',
        isMoving: true
    });

    const layerOrder = equippedCoraLayers.map(l => l.type);
    assert(layerOrder.includes('cape'), 'Cora has flowing cape layer');
    assert(layerOrder.includes('base'), 'Cora has base hero layer');
    assert(layerOrder.includes('armor'), 'Cora has equipped armor layer');
    assert(layerOrder.includes('helmet'), 'Cora has equipped helmet (circlet) layer');
    assert(layerOrder.includes('shield'), 'Cora has equipped shield layer');
    assert(layerOrder.includes('sword'), 'Cora has equipped sword layer');

    // Verify depth order: cape < base < armor < helmet < shield < sword
    const capeIdx = layerOrder.indexOf('cape');
    const baseIdx = layerOrder.indexOf('base');
    const armorIdx = layerOrder.indexOf('armor');
    const helmetIdx = layerOrder.indexOf('helmet');
    const shieldIdx = layerOrder.indexOf('shield');
    const swordIdx = layerOrder.indexOf('sword');

    assert(capeIdx < baseIdx, 'Cape renders behind Cora base sprite');
    assert(baseIdx < armorIdx, 'Armor renders over Cora base sprite');
    assert(armorIdx < helmetIdx, 'Circlet renders over armor');
    assert(helmetIdx < shieldIdx, 'Shield renders above helmet');
    assert(shieldIdx < swordIdx, 'Sword renders on top');

    // --- 5. Save Slot Preview Integration ---
    console.log('\n--- 5. Save Slot Preview Payload Integration ---');
    (gm as any).saveTimestamps = [];
    gm.setPlayerGender('female');
    gm.setHeroName('Cora');
    gm.setCurrentSaveSlot(2);
    (gm as any).saveTimestamps = [];
    gm.saveGame();

    const slot2 = gm.getSlotPreview(2);
    assert(slot2 !== null, 'Save slot 2 preview exists');
    assert(slot2?.playerGender === 'female', 'Save slot 2 preview accurately persists playerGender: "female"');
    assert(slot2?.name === 'Cora', 'Save slot 2 preview has heroName: "Cora"');

    // --- 6. Melodie Art Asset Checklist Verification ---
    console.log('\n--- 6. Melodie Art Asset Checklist Integration ---');
    const checklistPath = path.resolve(__dirname, '../../MELODIE_ART_CHECKLIST.md');
    assert(fs.existsSync(checklistPath), 'MELODIE_ART_CHECKLIST.md exists in repository');

    const checklistContent = fs.readFileSync(checklistPath, 'utf-8');
    const coraCompleted = checklistContent.includes('`player_female`') && checklistContent.includes('Cora Swift') && checklistContent.includes('`[x]` **COMPLETED**');
    assert(coraCompleted, 'MELODIE_ART_CHECKLIST.md lists player_female (Cora Swift) as [x] COMPLETED');

    const grassCompleted = checklistContent.includes('`grass_patch`') && checklistContent.includes('`[x]` **COMPLETED**');
    assert(grassCompleted, 'MELODIE_ART_CHECKLIST.md lists grass_patch as [x] COMPLETED');

    // --- 7. BootScene Asset Registration Verification ---
    console.log('\n--- 7. BootScene Code Verification ---');
    const bootScenePath = path.resolve(__dirname, '../src/scenes/BootScene.ts');
    const bootSceneCode = fs.readFileSync(bootScenePath, 'utf-8');
    assert(bootSceneCode.includes('player_female'), 'BootScene.ts registers player_female asset');
    assert(bootSceneCode.includes('grass_patch'), 'BootScene.ts registers grass_patch asset');
    assert(bootSceneCode.includes('canvasF'), 'BootScene.ts includes procedural canvas fallback for Cora Swift');

    console.log('\n====================================================');
    console.log(`SPRINT 28 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runSprint28Tests();
