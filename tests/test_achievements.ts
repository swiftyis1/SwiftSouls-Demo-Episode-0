import { AchievementManager, type AchievementDefinition, type AchievementPlatformBridge } from '../src/systems/AchievementManager.ts';
import { GameManager, type EquipmentSlot } from '../src/systems/GameManager.ts';

/**
 * Comprehensive Automated Verification Suite for Universal Achievement Manager
 * & 80% Extinction Climax Event System.
 */
function runAchievementTests() {
    console.log('====================================================');
    console.log('   RUNNING UNIVERSAL ACHIEVEMENT MANAGER TEST SUITE  ');
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

    // Mock localStorage for Node environment if needed
    if (typeof (globalThis as any).localStorage === 'undefined') {
        const store: { [key: string]: string } = {};
        (globalThis as any).localStorage = {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, val: string) => { store[key] = val; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { for (const k in store) delete store[k]; },
            get length() { return Object.keys(store).length; },
            key: (idx: number) => Object.keys(store)[idx] || null
        };
    }

    // Mock window for dispatchEvent and bridge tests
    if (typeof (globalThis as any).window === 'undefined') {
        (globalThis as any).window = {
            localStorage: (globalThis as any).localStorage,
            dispatchEvent: () => true
        };
    }

    localStorage.clear();
    const gm = GameManager.instance;
    const am = AchievementManager.instance;
    am.resetAll();

    // ----------------------------------------------------
    // TEST 1: Catalog Completeness & Integrity
    // ----------------------------------------------------
    console.log('--- 1. Achievement Catalog Completeness ---');
    const catalog = am.getAllDefinitions();
    assert(catalog.length >= 20, `Catalog contains at least 20 universal achievements (found: ${catalog.length})`);

    const idSet = new Set<string>();
    let duplicates = 0;
    for (const def of catalog) {
        if (idSet.has(def.id)) {
            duplicates++;
        }
        idSet.add(def.id);
        assert(!!def.id && !!def.title && !!def.description && !!def.icon, `Definition valid: ${def.id}`);
        assert(!!def.steamId && !!def.googlePlayId, `Cross-platform mappings exist for: ${def.id}`);
    }
    assert(duplicates === 0, 'All achievement IDs are strictly unique in catalog');

    // Specific key definitions
    const apexAwakens = am.getDefinition('ACH_EXTINCTION_80_PERCENT');
    assert(!!apexAwakens, 'ACH_EXTINCTION_80_PERCENT exists in catalog');
    assert(apexAwakens?.title === 'The Apex Awakens', '80% Extinction title is "The Apex Awakens"');
    assert(apexAwakens?.isHidden === true, '80% Extinction achievement is hidden/secret until unlocked');

    const totalSilence = am.getDefinition('ACH_EXTINCTION_100_PERCENT');
    assert(!!totalSilence, 'ACH_EXTINCTION_100_PERCENT exists in catalog');
    assert(totalSilence?.title === 'Total Silence', '100% Extinction title is "Total Silence"');

    // ----------------------------------------------------
    // TEST 2: Local & GameState Unlock Mechanics
    // ----------------------------------------------------
    console.log('\n--- 2. Unlock Mechanics & Duplicate Prevention ---');
    assert(!am.isUnlocked('ACH_STARFALL_ARRIVAL'), 'Starfall Arrival initially locked');

    const firstUnlock = am.unlock('ACH_STARFALL_ARRIVAL');
    assert(firstUnlock === true, 'First unlock call returns true');
    assert(am.isUnlocked('ACH_STARFALL_ARRIVAL'), 'Achievement is now flagged as unlocked');
    assert(gm.hasAchievement('ACH_STARFALL_ARRIVAL'), 'Recorded in GameManager GameState');

    const rawUniversal = localStorage.getItem('swiftsouls_universal_achievements');
    assert(!!rawUniversal && rawUniversal.includes('ACH_STARFALL_ARRIVAL'), 'Persisted to cross-save universal profile in localStorage');

    const duplicateUnlock = am.unlock('ACH_STARFALL_ARRIVAL');
    assert(duplicateUnlock === false, 'Duplicate unlock returns false (no duplicate trigger/spam)');

    const unknownUnlock = am.unlock('NON_EXISTENT_ACHIEVEMENT');
    assert(unknownUnlock === false, 'Attempting to unlock non-existent achievement safely returns false');

    // ----------------------------------------------------
    // TEST 3: 80% Extinction Climax Event Trigger
    // ----------------------------------------------------
    console.log('\n--- 3. Extinction Milestones & 80% Cataclysm Event ---');
    am.resetAll();
    assert(!gm.isCataclysmEventTriggered(), 'Cataclysm event not triggered initially');
    assert(!gm.isFinalBossUnlocked(), 'Final boss not unlocked initially');

    // Extinction step 1: 1 extinct out of 10 (10%)
    const res1 = am.checkExtinctionProgress(1, 10);
    assert(res1.unlockedAchievements.includes('ACH_EXTINCTION_FIRST'), '1 extinction triggers ACH_EXTINCTION_FIRST (First Blood)');
    assert(!res1.cataclysmTriggered, '10% does not trigger Cataclysm');

    // Extinction step 2: 3 extinct out of 10 (30%)
    const res2 = am.checkExtinctionProgress(3, 10);
    assert(res2.unlockedAchievements.includes('ACH_EXTINCTION_25_PERCENT'), '30% triggers ACH_EXTINCTION_25_PERCENT');
    assert(!res2.cataclysmTriggered, '30% does not trigger Cataclysm');

    // Extinction step 3: 5 extinct out of 10 (50%)
    const res3 = am.checkExtinctionProgress(5, 10);
    assert(res3.unlockedAchievements.includes('ACH_EXTINCTION_50_PERCENT'), '50% triggers ACH_EXTINCTION_50_PERCENT (Halfway to Silence)');
    assert(!res3.cataclysmTriggered, '50% does not trigger Cataclysm');

    // Extinction step 4: 8 extinct out of 10 (80%) -> CLIMAX EVENT!
    let listenerCalled = false;
    let listenerExtinctCount = 0;
    am.onCataclysmClimaxEvent((count, _total) => {
        listenerCalled = true;
        listenerExtinctCount = count;
    });

    const res4 = am.checkExtinctionProgress(8, 10);
    assert(res4.unlockedAchievements.includes('ACH_EXTINCTION_80_PERCENT'), '80% triggers ACH_EXTINCTION_80_PERCENT (The Apex Awakens)');
    assert(res4.cataclysmTriggered === true, 'Cataclysm Climax Event flagged as triggered in result');
    assert(gm.isCataclysmEventTriggered() === true, 'GameManager.isCataclysmEventTriggered() is true');
    assert(gm.isFinalBossUnlocked() === true, 'GameManager.isFinalBossUnlocked() is true');
    assert(listenerCalled === true && listenerExtinctCount === 8, 'Custom Cataclysm listener successfully invoked with 8/10');

    // Calling again at 80% does not re-trigger the event
    const res4Repeat = am.checkExtinctionProgress(8, 10);
    assert(res4Repeat.cataclysmTriggered === false, 'Cataclysm event not re-triggered on repeated check');

    // Extinction step 5: 10 extinct out of 10 (100%) -> Total Extinction
    const res5 = am.checkExtinctionProgress(10, 10);
    assert(res5.unlockedAchievements.includes('ACH_EXTINCTION_100_PERCENT'), '100% triggers ACH_EXTINCTION_100_PERCENT (Total Silence)');

    // ----------------------------------------------------
    // TEST 4: Cross-Platform Bridge Dispatch
    // ----------------------------------------------------
    console.log('\n--- 4. Cross-Platform Bridge Architecture ---');
    let mockSteamUnlockedId: string | null = null;
    let mockSteamSteamId: string | null = null;

    const mockSteamBridge: AchievementPlatformBridge = {
        name: 'MockSteam',
        isAvailable: () => true,
        unlock: (id, def) => {
            mockSteamUnlockedId = id;
            mockSteamSteamId = def.steamId;
            return true;
        }
    };

    am.registerPlatformBridge(mockSteamBridge);
    am.unlock('ACH_MASTER_FORGE');

    assert(mockSteamUnlockedId === 'ACH_MASTER_FORGE', 'Mock Steam bridge received universal unlock ID');
    assert(mockSteamSteamId === 'ACH_MASTER_FORGE', 'Mock Steam bridge received mapped platform Steam ID');

    // ----------------------------------------------------
    // TEST 5: Gameplay System Action Triggers
    // ----------------------------------------------------
    console.log('\n--- 5. Gameplay Action Hook Integration ---');
    am.resetAll();

    // Sockets crystal
    gm.getState().soulCrystals['goblin'] = { fragments: 10, isExtinct: false };
    gm.socketCrystal('goblin', 'sword');
    assert(am.isUnlocked('ACH_FIRST_INFUSION'), 'Socketing crystal triggers ACH_FIRST_INFUSION');

    // Equip all 7 slots with 7 unique crystals
    const speciesList = ['goblin', 'snake', 'slime', 'bat', 'skeleton', 'phoenix', 'specter'];
    const slots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'helmet', 'ring1', 'ring2', 'amulet'];
    slots.forEach((s, idx) => {
        const spec = speciesList[idx];
        gm.getState().soulCrystals[spec] = { fragments: 10, isExtinct: false };
        gm.getState().equippedCrystals[s] = spec;
    });
    // Trigger socket to verify full infusion check
    gm.socketCrystal('specter', 'amulet');
    assert(am.isUnlocked('ACH_FULL_INFUSION'), 'Filling all 7 slots triggers ACH_FULL_INFUSION');

    // Refine to tier 5
    gm.getState().forgeRefinements!['sword'] = 4;
    gm.refineEquipmentSlot('sword');
    assert(gm.getForgeRefinements()['sword'] === 5, 'Sword reached Masterwork Tier 5');
    assert(am.isUnlocked('ACH_MASTER_FORGE'), 'Reaching Tier 5 triggers ACH_MASTER_FORGE');

    // Meld boss soul
    gm.getState().soulCrystals['phoenix'] = { fragments: 255, isExtinct: true };
    gm.meldBossSoul('phoenix');
    assert(am.isUnlocked('ACH_ALPHA_PREDATOR'), 'Melding boss soul triggers ACH_ALPHA_PREDATOR');

    // ----------------------------------------------------
    // TEST 6: Save State Validation & Repair
    // ----------------------------------------------------
    console.log('\n--- 6. State Serialization & Repair Integrity ---');
    const dirtyState: any = {
        party: [],
        soulCrystals: {},
        achievements: 'invalid_string_not_object',
        extinctionEventTriggered: 'yes_string',
        finalBossUnlocked: null
    };

    const repaired = gm.validateAndRepairState(dirtyState);
    assert(typeof repaired.achievements === 'object' && !Array.isArray(repaired.achievements), 'Achievements repaired to object map');
    assert(repaired.extinctionEventTriggered === false, 'Invalid extinction event boolean repaired to false');
    assert(repaired.finalBossUnlocked === false, 'Invalid final boss boolean repaired to false');

    // Valid achievements preserved
    const stateWithAch: any = {
        party: [],
        soulCrystals: {},
        achievements: { ACH_FIRST_INFUSION: 1725580800000 },
        extinctionEventTriggered: true,
        finalBossUnlocked: true
    };
    const repaired2 = gm.validateAndRepairState(stateWithAch);
    assert(repaired2.achievements.ACH_FIRST_INFUSION === 1725580800000, 'Existing achievement timestamp preserved on repair');
    assert(repaired2.extinctionEventTriggered === true, 'Cataclysm event state preserved on repair');
    assert(repaired2.finalBossUnlocked === true, 'Final boss state preserved on repair');

    // ----------------------------------------------------
    // TEST 7: Overall Progress Summary
    // ----------------------------------------------------
    console.log('\n--- 7. Progress Tracking & Metrics ---');
    const progress = am.getProgress();
    assert(progress.unlockedCount > 0, `Unlocked count tracked properly (${progress.unlockedCount})`);
    assert(progress.totalCount === catalog.length, `Total count matches catalog size (${progress.totalCount})`);
    assert(progress.percentage > 0 && progress.percentage <= 100, `Completion percentage is valid (${progress.percentage}%)`);

    console.log('\n====================================================');
    console.log(`   TEST COMPLETE: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
        throw new Error(`${failed} tests failed in Achievement Test Suite`);
    }
}

runAchievementTests();
