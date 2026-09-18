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

import { GameManager, ALL_EQUIPMENT_SLOTS } from '../src/systems/GameManager.ts';
import {
    CharacterLayerCompositor,
    MELODIE_ARTWORK_CATALOG,
    INFUSION_TINTS,
    ALLOWED_HEADWEAR_PREFIXES,
    FORBIDDEN_HEADWEAR_PATTERNS
} from '../src/systems/CharacterLayerCompositor.ts';

/**
 * Sprint 27 Automated Verification Test Suite
 * Validates:
 * 1. Layer Compositing Order & Depth Offsets (Cape -> Base -> Armor -> Helmet -> Shield -> Sword)
 * 2. Strict Headwear Constraint Enforcement (Circlets/Tiaras allowed; Enclosed Visors/Full Helms rejected)
 * 3. 4-Frame Flowing Cape Retro Breeze Animation Timing (Idle 180ms vs Moving 110ms)
 * 4. Elemental Infusion Color Tint Mapping (All 6 elements + physical + default)
 * 5. Melodie Swift 8-Slot Artwork Catalog & Variant Cycling
 * 6. Directional Flipping & Layer Offset Math
 * 7. Save Slot Preview Payload Compositing Integration
 */
function runSprint27Tests() {
    console.log('====================================================');
    console.log('   RUNNING SPRINT 27 AUTOMATED VERIFICATION SUITE   ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, desc: string) {
        if (condition) {
            console.log(`  [PASS] ${desc}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${desc}`);
            failed++;
        }
    }

    // ----------------------------------------------------
    // TEST 1: Layer Compositing Order & Depth Offsets
    // ----------------------------------------------------
    console.log('\n--- 1. Layer Compositing Order & Depth Offsets ---');

    const sampleLayers = CharacterLayerCompositor.getCompositedLayers({
        equippedCrystals: {
            sword: 'phoenix',
            shield: 'goblin',
            armor: 'slime',
            helmet: 'nightwing',
            ring1: null,
            ring2: null,
            amulet: null,
            earrings: null
        }
    });

    const layerTypes = sampleLayers.map(l => l.type);
    assert(layerTypes.length === 6, 'Compositor produced 6 visual layers');
    assert(layerTypes[0] === 'cape', 'Layer 0 is cape (back layer)');
    assert(layerTypes[1] === 'base', 'Layer 1 is base hero body');
    assert(layerTypes[2] === 'armor', 'Layer 2 is body armor');
    assert(layerTypes[3] === 'helmet', 'Layer 3 is circlet/headwear');
    assert(layerTypes[4] === 'shield', 'Layer 4 is off-hand shield');
    assert(layerTypes[5] === 'sword', 'Layer 5 is main-hand sword');

    const depths = sampleLayers.map(l => l.depthOffset);
    assert(depths[0] === -1, 'Cape depth offset is -1 (behind hero)');
    assert(depths[1] === 0, 'Base hero depth offset is 0');
    assert(depths[2] === 1, 'Armor depth offset is 1');
    assert(depths[3] === 2, 'Circlet depth offset is 2');
    assert(depths[4] === 3, 'Shield depth offset is 3');
    assert(depths[5] === 4, 'Sword depth offset is 4');

    // ----------------------------------------------------
    // TEST 2: Strict Headwear Constraint (Golden Rule #2)
    // ----------------------------------------------------
    console.log('\n--- 2. Strict Headwear Constraint Enforcement ---');

    // Permitted headwear
    const validCirclets = [
        'circlet_gold',
        'tiara_emerald',
        'coronet_silver',
        'browband_leather',
        'diadem_frost',
        'crown_of_light',
        'helmet_circlet_silver'
    ];
    for (const key of validCirclets) {
        assert(CharacterLayerCompositor.isCircletOrTiara(key), `isCircletOrTiara accepts valid headwear: ${key}`);
        assert(CharacterLayerCompositor.validateAndSanitizeHeadwear(key) === key, `validateAndSanitizeHeadwear preserves valid headwear: ${key}`);
    }

    // Forbidden enclosed helmets
    const forbiddenHelms = [
        'full_helm_iron',
        'heavy_visor_steel',
        'closed_helm_titan',
        'bucket_helm_bronze',
        'faceless_mask',
        'visor_knight'
    ];
    for (const key of forbiddenHelms) {
        assert(!CharacterLayerCompositor.isCircletOrTiara(key), `isCircletOrTiara rejects forbidden enclosed helm: ${key}`);
        const sanitized = CharacterLayerCompositor.validateAndSanitizeHeadwear(key);
        assert(sanitized === 'helmet_circlet_silver', `validateAndSanitizeHeadwear sanitizes '${key}' to 'helmet_circlet_silver'`);
    }

    // When requested via compositor with invalid headwear variant, headwear layer is sanitized
    const layersWithBadHelm = CharacterLayerCompositor.getCompositedLayers({
        selectedVariants: { helmet: 'full_helm_great_crusader' }
    });
    const helmLayer = layersWithBadHelm.find(l => l.type === 'helmet');
    assert(helmLayer !== undefined, 'Headwear layer exists');
    assert(helmLayer?.assetKey === 'helmet_circlet_silver', 'Compositor sanitized enclosed helm to helmet_circlet_silver');

    // ----------------------------------------------------
    // TEST 3: 4-Frame Flowing Cape Animation Timing
    // ----------------------------------------------------
    console.log('\n--- 3. 4-Frame Flowing Cape Animation Timing ---');

    // Idle cycle: 180ms per frame, 720ms total loop
    assert(CharacterLayerCompositor.getCapeFrame(0, false) === 0, 'Idle cape at 0ms is frame 0');
    assert(CharacterLayerCompositor.getCapeFrame(179, false) === 0, 'Idle cape at 179ms is frame 0');
    assert(CharacterLayerCompositor.getCapeFrame(180, false) === 1, 'Idle cape at 180ms is frame 1');
    assert(CharacterLayerCompositor.getCapeFrame(360, false) === 2, 'Idle cape at 360ms is frame 2');
    assert(CharacterLayerCompositor.getCapeFrame(540, false) === 3, 'Idle cape at 540ms is frame 3');
    assert(CharacterLayerCompositor.getCapeFrame(720, false) === 0, 'Idle cape at 720ms loops back to frame 0');
    assert(CharacterLayerCompositor.getCapeFrame(900, false) === 1, 'Idle cape at 900ms wraps to frame 1');

    // Moving cycle: 110ms per frame, 440ms total loop
    assert(CharacterLayerCompositor.getCapeFrame(0, true) === 0, 'Moving cape at 0ms is frame 0');
    assert(CharacterLayerCompositor.getCapeFrame(109, true) === 0, 'Moving cape at 109ms is frame 0');
    assert(CharacterLayerCompositor.getCapeFrame(110, true) === 1, 'Moving cape at 110ms is frame 1');
    assert(CharacterLayerCompositor.getCapeFrame(220, true) === 2, 'Moving cape at 220ms is frame 2');
    assert(CharacterLayerCompositor.getCapeFrame(330, true) === 3, 'Moving cape at 330ms is frame 3');
    assert(CharacterLayerCompositor.getCapeFrame(440, true) === 0, 'Moving cape at 440ms loops back to frame 0');
    assert(CharacterLayerCompositor.getCapeFrame(550, true) === 1, 'Moving cape at 550ms wraps to frame 1');

    // ----------------------------------------------------
    // TEST 4: Elemental Infusion Color Tint Mapping
    // ----------------------------------------------------
    console.log('\n--- 4. Elemental Infusion Color Tint Mapping ---');

    assert(CharacterLayerCompositor.getInfusionTint('phoenix') === INFUSION_TINTS.fire, 'Phoenix essence yields fire tint (0xff5533)');
    assert(CharacterLayerCompositor.getInfusionTint('water_elemental') === INFUSION_TINTS.water, 'Water elemental essence yields water tint (0x33ccff)');
    assert(CharacterLayerCompositor.getInfusionTint('slime') === INFUSION_TINTS.poison, 'Slime essence yields poison tint (0x33ee66)');
    assert(CharacterLayerCompositor.getInfusionTint('nightwing') === INFUSION_TINTS.dark, 'Nightwing essence yields dark tint (0xaa44ff)');
    assert(CharacterLayerCompositor.getInfusionTint('frost_elemental') === INFUSION_TINTS.cold, 'Frost elemental essence yields cold tint (0x99ffff)');
    assert(CharacterLayerCompositor.getInfusionTint('golem') === INFUSION_TINTS.earth, 'Golem essence yields earth tint (0xddaa44)');
    assert(CharacterLayerCompositor.getInfusionTint('goblin') === INFUSION_TINTS.physical, 'Goblin essence yields physical tint (0xeeeeee)');
    assert(CharacterLayerCompositor.getInfusionTint(null) === INFUSION_TINTS.default, 'Null essence yields uninfused neutral tint (0xffffff)');

    // Composited sword layer inherits Phoenix fire tint
    const fireInfusedLayers = CharacterLayerCompositor.getCompositedLayers({ sword: 'phoenix' });
    const swordLayer = fireInfusedLayers.find(l => l.type === 'sword');
    assert(swordLayer?.tint === INFUSION_TINTS.fire, 'Sword layer correctly tinted fire crimson (0xff5533)');

    // ----------------------------------------------------
    // TEST 5: Melodie Swift 8-Slot Artwork Catalog
    // ----------------------------------------------------
    console.log('\n--- 5. Melodie Swift 8-Slot Artwork Catalog ---');

    for (const slot of ALL_EQUIPMENT_SLOTS) {
        const slotData = MELODIE_ARTWORK_CATALOG[slot];
        assert(slotData !== undefined, `Catalog entry exists for slot: ${slot}`);
        assert(slotData.slot === slot, `Slot metadata matches key: ${slot}`);
        assert(slotData.variants.length >= 2, `Slot ${slot} has at least 2 hand-drawn variants (has ${slotData.variants.length})`);
        
        for (const variant of slotData.variants) {
            assert(typeof variant.id === 'string' && variant.id.length > 0, `${slot} variant has valid id: ${variant.id}`);
            assert(typeof variant.assetKey === 'string' && variant.assetKey.length > 0, `${slot} variant has assetKey: ${variant.assetKey}`);
            assert(typeof variant.name === 'string' && variant.name.length > 0, `${slot} variant has name: ${variant.name}`);
            assert(typeof variant.description === 'string' && variant.description.length > 0, `${slot} variant has description`);
            assert(typeof variant.artistLore === 'string' && variant.artistLore.length > 0, `${slot} variant has artistLore`);
        }

        // Test variant cycling
        const firstVariant = slotData.variants[0];
        const nextVariant = CharacterLayerCompositor.cycleNextArtworkVariant(slot, firstVariant.id);
        assert(nextVariant.id === slotData.variants[1].id, `${slot} cycles from variant 0 to variant 1`);

        // Test wrap-around cycling
        const lastVariant = slotData.variants[slotData.variants.length - 1];
        const wrappedVariant = CharacterLayerCompositor.cycleNextArtworkVariant(slot, lastVariant.id);
        assert(wrappedVariant.id === firstVariant.id, `${slot} wraps around from last variant to first variant`);
    }

    // ----------------------------------------------------
    // TEST 6: Directional Flipping & Layer Offset Math
    // ----------------------------------------------------
    console.log('\n--- 6. Directional Flipping & Layer Offset Math ---');

    const rightFacing = CharacterLayerCompositor.getCompositedLayers({
        equippedCrystals: { shield: 'goblin', sword: 'phoenix' },
        flipX: false
    });
    const leftFacing = CharacterLayerCompositor.getCompositedLayers({
        equippedCrystals: { shield: 'goblin', sword: 'phoenix' },
        flipX: true
    });

    const rightShield = rightFacing.find(l => l.type === 'shield')!;
    const leftShield = leftFacing.find(l => l.type === 'shield')!;
    assert(rightShield !== undefined && rightShield.scaleX > 0, 'Right-facing shield has positive scaleX');
    assert(leftShield !== undefined && leftShield.scaleX < 0, 'Left-facing shield has negative scaleX');
    assert(rightShield.offsetX === -leftShield.offsetX, 'Shield offsetX mirrors accurately when facing left');

    const rightSword = rightFacing.find(l => l.type === 'sword')!;
    const leftSword = leftFacing.find(l => l.type === 'sword')!;
    assert(rightSword.scaleX > 0, 'Right-facing sword has positive scaleX');
    assert(leftSword.scaleX < 0, 'Left-facing sword has negative scaleX');
    assert(rightSword.offsetX === -leftSword.offsetX, 'Sword offsetX mirrors accurately when facing left');

    // ----------------------------------------------------
    // TEST 7: Save Slot Preview Payload Compositing Integration
    // ----------------------------------------------------
    console.log('\n--- 7. Save Slot Preview Payload Integration ---');

    localStorage.clear();
    GameManager.instance.resetGame();
    GameManager.instance.setCurrentSaveSlot(1);

    // Setup an infused gear save state
    GameManager.instance.setHeroName('Melodie');
    GameManager.instance.unlockEarringsSlot();
    (GameManager.instance as any).saveTimestamps = [];
    GameManager.instance.addSoulFragments('bat', 40);
    (GameManager.instance as any).saveTimestamps = [];
    GameManager.instance.addSoulFragments('goblin', 30);
    (GameManager.instance as any).saveTimestamps = [];
    GameManager.instance.addSoulFragments('slime', 20);
    (GameManager.instance as any).saveTimestamps = [];
    GameManager.instance.equipSoulCrystal('sword', 'bat');
    (GameManager.instance as any).saveTimestamps = [];
    GameManager.instance.equipSoulCrystal('shield', 'goblin');
    (GameManager.instance as any).saveTimestamps = [];
    GameManager.instance.equipSoulCrystal('armor', 'slime');
    (GameManager.instance as any).saveTimestamps = [];
    GameManager.instance.saveGame();

    const preview = GameManager.instance.getSlotPreview(1);
    assert(preview !== null, 'Save slot 1 preview loaded successfully');
    assert(!preview?.isTampered, 'Preview is not tampered');
    assert(preview?.name === 'Melodie', 'Hero name in preview is Melodie');
    assert(preview?.equippedCrystals.sword === 'bat', 'Preview contains equipped sword crystal (bat)');
    assert(preview?.equippedCrystals.shield === 'goblin', 'Preview contains equipped shield crystal (goblin)');
    assert(preview?.equippedCrystals.armor === 'slime', 'Preview contains equipped armor crystal (slime)');

    const saveSlotLayers = CharacterLayerCompositor.getCompositedLayers({
        equippedCrystals: preview!.equippedCrystals
    });
    assert(saveSlotLayers.length === 6, 'Save slot preview generates 6 composited layers');
    const previewSwordLayer = saveSlotLayers.find(l => l.type === 'sword');
    assert(previewSwordLayer?.tint === INFUSION_TINTS.dark, 'Save slot sword layer correctly tinted with bat/nightwing dark essence');

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`SPRINT 27 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runSprint27Tests();
