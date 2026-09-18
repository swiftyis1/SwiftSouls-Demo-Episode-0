import { GameManager, HEALING_STATIONS } from '../src/systems/GameManager.ts';
import { AccessibilityManager } from '../src/systems/AccessibilityManager.ts';

/**
 * Sprint 24 Automated Verification Test Suite
 * Validates:
 * 1. Soul Level Triangular Progression Formula (100, 300, 600, 1000, 1500, 2100, 2800...)
 * 2. Total Fragment Counter & Derivation from all captured species
 * 3. Town Healing Stations Network, Level Gating, HP/SP & Pet Revival, Death Respawn Anchoring
 * 4. Rich Save Slot Metadata (timePlayedSeconds, totalFragments, equippedCrystals) & Formatted Time
 * 5. Safe Save Deletion Engine with confirmation gate ('DELETE')
 * 6. Accessibility & Visual Comfort Engine (Screen Shake & Combat Flashes toggles & persistence)
 * 7. Backward Compatibility & Save Repair Resilience
 */
function runSprint24Tests() {
    console.log('====================================================');
    console.log('   RUNNING SPRINT 24 AUTOMATED VERIFICATION SUITE   ');
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

    // Mock localStorage for Node testing environment
    if (typeof (globalThis as any).localStorage === 'undefined') {
        const store: { [key: string]: string } = {};
        (globalThis as any).localStorage = {
            getItem: (key: string) => (key in store ? store[key] : null),
            setItem: (key: string, val: string) => { store[key] = String(val); },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { for (const k in store) delete store[k]; },
            get length() { return Object.keys(store).length; },
            key: (idx: number) => Object.keys(store)[idx] || null
        };
    }

    localStorage.clear();

    // ----------------------------------------------------
    // TEST 1: Soul Level Triangular Progression Formula
    // ----------------------------------------------------
    console.log('\n--- 1. Soul Level Triangular Progression Formula ---');

    // Thresholds: Level L requires 50 * L * (L + 1) fragments
    // L=1 -> 100, L=2 -> 300, L=3 -> 600, L=4 -> 1000, L=5 -> 1500, L=6 -> 2100, L=7 -> 2800
    assert(GameManager.instance.getFragmentsForSoulLevel(0) === 0, 'Level 0 threshold is 0 frags');
    assert(GameManager.instance.getFragmentsForSoulLevel(1) === 100, 'Level 1 threshold is 100 frags');
    assert(GameManager.instance.getFragmentsForSoulLevel(2) === 300, 'Level 2 threshold is 300 frags');
    assert(GameManager.instance.getFragmentsForSoulLevel(3) === 600, 'Level 3 threshold is 600 frags');
    assert(GameManager.instance.getFragmentsForSoulLevel(4) === 1000, 'Level 4 threshold is 1000 frags');
    assert(GameManager.instance.getFragmentsForSoulLevel(5) === 1500, 'Level 5 threshold is 1500 frags');
    assert(GameManager.instance.getFragmentsForSoulLevel(6) === 2100, 'Level 6 threshold is 2100 frags');
    assert(GameManager.instance.getFragmentsForSoulLevel(7) === 2800, 'Level 7 threshold is 2800 frags');
    assert(GameManager.instance.getFragmentsForSoulLevel(8) === 3600, 'Level 8 threshold is 3600 frags');

    // Inverse function: Soul Level derived from fragment count
    assert(GameManager.instance.getSoulLevelFromFragments(0) === 0, '0 fragments -> Soul Level 0');
    assert(GameManager.instance.getSoulLevelFromFragments(50) === 0, '50 fragments -> Soul Level 0');
    assert(GameManager.instance.getSoulLevelFromFragments(99) === 0, '99 fragments -> Soul Level 0');
    assert(GameManager.instance.getSoulLevelFromFragments(100) === 1, '100 fragments -> Soul Level 1');
    assert(GameManager.instance.getSoulLevelFromFragments(250) === 1, '250 fragments -> Soul Level 1');
    assert(GameManager.instance.getSoulLevelFromFragments(299) === 1, '299 fragments -> Soul Level 1');
    assert(GameManager.instance.getSoulLevelFromFragments(300) === 2, '300 fragments -> Soul Level 2');
    assert(GameManager.instance.getSoulLevelFromFragments(599) === 2, '599 fragments -> Soul Level 2');
    assert(GameManager.instance.getSoulLevelFromFragments(600) === 3, '600 fragments -> Soul Level 3');
    assert(GameManager.instance.getSoulLevelFromFragments(999) === 3, '999 fragments -> Soul Level 3');
    assert(GameManager.instance.getSoulLevelFromFragments(1000) === 4, '1000 fragments -> Soul Level 4');
    assert(GameManager.instance.getSoulLevelFromFragments(1499) === 4, '1499 fragments -> Soul Level 4');
    assert(GameManager.instance.getSoulLevelFromFragments(1500) === 5, '1500 fragments -> Soul Level 5');
    assert(GameManager.instance.getSoulLevelFromFragments(2100) === 6, '2100 fragments -> Soul Level 6');
    assert(GameManager.instance.getSoulLevelFromFragments(2800) === 7, '2800 fragments -> Soul Level 7');

    // ----------------------------------------------------
    // TEST 2: Total Fragment Counter & Next Level Progress
    // ----------------------------------------------------
    console.log('\n--- 2. Total Fragment Counter & Level Derivation ---');

    GameManager.instance.resetGame();
    assert(GameManager.instance.getTotalFragmentsCollected() === 0, 'New game starts with 0 total fragments');
    assert(GameManager.instance.getSoulLevel() === 0, 'New game starts at Soul Level 0');

    // Grant fragments across multiple species
    GameManager.instance.addEssenceFragments('slime', 60);
    GameManager.instance.addEssenceFragments('snake', 40);
    assert(GameManager.instance.getTotalFragmentsCollected() === 100, 'Sum of 60 slime + 40 snake = 100 total fragments');
    assert(GameManager.instance.getSoulLevel() === 1, '100 fragments raises player to Soul Level 1');

    // Check next level progress calculation
    const prog1 = GameManager.instance.getNextLevelProgress();
    assert(prog1.currentLevel === 1, 'Current level is 1');
    assert(prog1.totalFragments === 100, 'Total fragments tracked is 100');
    assert(prog1.currentLevelThreshold === 100, 'Current level floor threshold is 100');
    assert(prog1.nextLevelThreshold === 300, 'Next level ceiling threshold is 300');
    assert(prog1.fragmentsNeeded === 200, 'Fragments needed to reach Level 2 is 200');
    assert(prog1.progressPercent === 0, 'Progress percent at exact floor is 0%');

    // Add 100 more fragments (total 200, midpoint between 100 and 300)
    GameManager.instance.addEssenceFragments('bat', 100);
    const prog2 = GameManager.instance.getNextLevelProgress();
    assert(prog2.totalFragments === 200, 'Total fragments is now 200');
    assert(prog2.fragmentsNeeded === 100, 'Fragments needed is now 100');
    assert(prog2.progressPercent === 50, 'Progress is exactly 50% toward Level 2');

    // Hero calculated stats derive level from Soul Level
    const stats = GameManager.instance.getHeroCalculatedStats();
    assert(stats.level === 1, 'Hero calculated stats reflect Soul Level 1');

    // ----------------------------------------------------
    // TEST 3: Town Healing Stations Network & Sanctuary Attunement
    // ----------------------------------------------------
    console.log('\n--- 3. Town Healing Stations Network & Attunement ---');

    assert(HEALING_STATIONS['station_meteor_pod'].requiredSoulLevel === 0, 'Meteor Pod requires SL 0');
    assert(HEALING_STATIONS['station_oakhaven'].requiredSoulLevel === 1, 'Oakhaven requires SL 1 (100 frags)');
    assert(HEALING_STATIONS['station_aetheria'].requiredSoulLevel === 3, 'Aetheria requires SL 3 (600 frags)');
    assert(HEALING_STATIONS['station_ironspire'].requiredSoulLevel === 5, 'Ironspire requires SL 5 (1500 frags)');
    assert(HEALING_STATIONS['station_royal_keep'].requiredSoulLevel === 7, 'Royal Keep requires SL 7 (2800 frags)');
    assert(HEALING_STATIONS['station_desert_oasis'].requiredSoulLevel === 7, 'Desert Oasis requires SL 7');
    assert(HEALING_STATIONS['station_glacier_haven'].requiredSoulLevel === 9, 'Glacier Haven requires SL 9');
    assert(HEALING_STATIONS['station_deepwood_grove'].requiredSoulLevel === 11, 'Deepwood Grove requires SL 11');
    assert(HEALING_STATIONS['station_volcano_core'].requiredSoulLevel === 13, 'Volcano Core requires SL 13');

    // Currently at SL 1: Attuning to Aetheria (SL 3) should fail
    const failRest = GameManager.instance.attuneAndRestAtHealingStation('station_aetheria');
    assert(!failRest.success, 'Attuning to Aetheria at SL 1 fails gate check');
    assert(failRest.message.includes('Requires Soul Level 3'), 'Failure message specifies required Soul Level 3');

    // Attuning to Oakhaven (SL 1) should succeed
    // Damage player first and knock out pet companion
    const gameState = GameManager.instance.getState();
    const party = gameState.party;
    party[0].hp = 10;
    party[0].sp = 5;
    gameState.petCompanion = {
        name: 'Gloop',
        level: 1,
        hp: 0,
        maxHp: 50,
        isDefeated: true
    };

    const successRest = GameManager.instance.attuneAndRestAtHealingStation('station_oakhaven');
    const calcStats = GameManager.instance.getHeroCalculatedStats();
    assert(successRest.success, 'Attuning to Oakhaven succeeds at SL 1');
    assert(party[0].hp === calcStats.maxHp, 'Player HP fully restored to 100%');
    assert(party[0].sp === calcStats.maxSp, 'Player SP fully restored to 100%');
    assert(gameState.petCompanion!.isDefeated === false, 'Fallen Pet Companion is resurrected');
    assert(gameState.petCompanion!.hp === 50, 'Pet Companion HP restored to 100%');
    assert(gameState.lastAttunedHealingStation?.stationId === 'station_oakhaven', 'Respawn anchor set to station_oakhaven');

    // Test Death Respawn Redirection: Player respawns at attuned station coords
    GameManager.instance.handlePlayerDeath();
    const respawnState = GameManager.instance.getState();
    assert(respawnState.currentMapId === 'town_oakhaven', 'Respawn redirected to Oakhaven map');
    assert(respawnState.playerGridX === 8 && respawnState.playerGridY === 4, 'Respawn redirected to Oakhaven coordinates');
    assert(party[0].hp > 0, 'Player HP restored upon respawn');

    // ----------------------------------------------------
    // TEST 4: Rich Save Slot Metadata & Formatted Time
    // ----------------------------------------------------
    console.log('\n--- 4. Rich Save Slot Metadata & Time Played ---');

    // Time formatting helper
    assert(GameManager.instance.getFormattedTimePlayed(0) === '00:00:00', '0s -> 00:00:00');
    assert(GameManager.instance.getFormattedTimePlayed(45) === '00:00:45', '45s -> 00:00:45');
    assert(GameManager.instance.getFormattedTimePlayed(125) === '00:02:05', '125s -> 00:02:05');
    assert(GameManager.instance.getFormattedTimePlayed(3661) === '01:01:01', '3661s -> 01:01:01');
    assert(GameManager.instance.getFormattedTimePlayed(36000) === '10:00:00', '36000s -> 10:00:00');

    // Accumulate time in GameManager
    GameManager.instance.updateTimePlayed(150);
    assert(GameManager.instance.getTimePlayedSeconds() === 150, 'Accumulated 150 seconds of playtime');

    // Save game in Slot 2
    GameManager.instance.setCurrentSaveSlot(2);
    (GameManager.instance as any).saveTimestamps = [];
    GameManager.instance.saveGame();

    const preview = GameManager.instance.getSlotPreview(2);
    assert(preview !== null, 'Slot 2 preview exists');
    assert(preview!.slot === 2, 'Slot index is 2');
    assert(preview!.timePlayedSeconds === 150, 'Slot preview accurately reports 150s playtime');
    assert(preview!.totalFragments === 200, 'Slot preview reports 200 total fragments');
    assert(preview!.level === 1, 'Slot preview reports Soul Level 1');
    assert(preview!.isTampered === false, 'Slot 2 is marked untampered');

    // ----------------------------------------------------
    // TEST 5: Safe Save Deletion Engine
    // ----------------------------------------------------
    console.log('\n--- 5. Safe Save Deletion Engine ---');

    // Attempt deletion with invalid tokens
    assert(!GameManager.instance.deleteSaveSlotWithConfirmation(2, ''), 'Empty token rejected');
    assert(!GameManager.instance.deleteSaveSlotWithConfirmation(2, 'del'), 'Short token rejected');
    assert(!GameManager.instance.deleteSaveSlotWithConfirmation(2, 'CANCEL'), 'Wrong word rejected');
    assert(!GameManager.instance.deleteSaveSlotWithConfirmation(2, 'YES'), 'Incorrect confirmation token rejected');
    assert(GameManager.instance.getSlotPreview(2) !== null, 'Save slot 2 still exists after rejected tokens');

    // Deletion on empty slot
    assert(!GameManager.instance.deleteSaveSlotWithConfirmation(5, 'DELETE'), 'Cannot delete empty slot');

    // Valid deletion with 'DELETE'
    const delResult = GameManager.instance.deleteSaveSlotWithConfirmation(2, 'DELETE');
    assert(delResult === true, 'Deletion with DELETE succeeds');
    assert(GameManager.instance.getSlotPreview(2) === null, 'Save slot 2 is completely wiped');
    assert(localStorage.getItem('swiftsouls_save_2') === null, 'localStorage key for slot 2 removed');

    // Case-insensitive check with 'delete'
    GameManager.instance.setCurrentSaveSlot(3);
    (GameManager.instance as any).saveTimestamps = [];
    GameManager.instance.saveGame();
    assert(GameManager.instance.deleteSaveSlotWithConfirmation(3, 'delete'), 'Deletion with lowercase delete succeeds');
    assert(GameManager.instance.getSlotPreview(3) === null, 'Save slot 3 wiped');

    // ----------------------------------------------------
    // TEST 6: Accessibility & Visual Comfort Engine
    // ----------------------------------------------------
    console.log('\n--- 6. Accessibility & Visual Comfort Engine ---');

    AccessibilityManager.resetDefaults();
    assert(AccessibilityManager.isScreenShakeEnabled() === true, 'Default screen shake is enabled');
    assert(AccessibilityManager.isCombatFlashesEnabled() === true, 'Default combat flashes are enabled');

    // Toggle screen shake off
    const shakeNext = AccessibilityManager.toggleScreenShake();
    assert(shakeNext === false, 'Screen shake toggled off');
    assert(AccessibilityManager.isScreenShakeEnabled() === false, 'Screen shake reported as disabled');
    assert(localStorage.getItem(AccessibilityManager.STORAGE_KEY_SCREEN_SHAKE) === 'false', 'Screen shake persisted as false');

    // Toggle combat flashes off
    const flashNext = AccessibilityManager.toggleCombatFlashes();
    assert(flashNext === false, 'Combat flashes toggled off');
    assert(AccessibilityManager.isCombatFlashesEnabled() === false, 'Combat flashes reported as disabled');
    assert(localStorage.getItem(AccessibilityManager.STORAGE_KEY_COMBAT_FLASHES) === 'false', 'Combat flashes persisted as false');

    // Test camera wrapper mock behavior
    let shakeInvoked = false;
    let flashInvoked = false;
    const mockCamera = {
        shake: () => { shakeInvoked = true; },
        flash: () => { flashInvoked = true; }
    };

    // When disabled, wrappers do NOT call camera methods
    AccessibilityManager.shakeCamera(mockCamera, 200, 0.01);
    AccessibilityManager.flashCamera(mockCamera, 200, 255, 255, 255);
    assert(shakeInvoked === false, 'Camera shake suppressed when accessibility preference is OFF');
    assert(flashInvoked === false, 'Camera flash suppressed when visual comfort preference is OFF');

    // Turn back on and verify invocation
    AccessibilityManager.setScreenShakeEnabled(true);
    AccessibilityManager.setCombatFlashesEnabled(true);
    AccessibilityManager.shakeCamera(mockCamera, 200, 0.01);
    AccessibilityManager.flashCamera(mockCamera, 200, 255, 255, 255);
    assert(shakeInvoked === true, 'Camera shake permitted when accessibility preference is ON');
    assert(flashInvoked === true, 'Camera flash permitted when visual comfort preference is ON');

    // ----------------------------------------------------
    // TEST 7: Backward Compatibility & Save Repair Resilience
    // ----------------------------------------------------
    console.log('\n--- 7. Backward Compatibility & Save Repair Resilience ---');

    // Simulate legacy save file (missing timePlayedSeconds and lastAttunedHealingStation)
    const legacySave = {
        version: 1,
        slot: 4,
        timestamp: Date.now(),
        party: [{ name: 'LegacyHero', level: 2, stats: { hp: 100, maxHp: 100, sp: 50, maxSp: 50 } }],
        currentMapId: 'world_map',
        playerGridX: 5,
        playerGridY: 5
    };
    localStorage.setItem('swiftsouls_save_4', JSON.stringify(legacySave));

    GameManager.instance.setCurrentSaveSlot(4);
    const loadLegacySuccess = GameManager.instance.loadGame();
    assert(loadLegacySuccess === true, 'Legacy v1 save loads successfully');
    const repairedState = GameManager.instance.getState();
    assert(repairedState.timePlayedSeconds === 0, 'Repaired state defaults timePlayedSeconds to 0');
    assert(repairedState.lastAttunedHealingStation?.stationId === 'station_meteor_pod', 'Repaired state defaults healing station to station_meteor_pod');
    assert(GameManager.instance.getCurrentSaveSlot() === 4, 'GameManager preserves slot index');

    // Cleanup
    GameManager.instance.deleteSaveSlotWithConfirmation(4, 'DELETE');
    localStorage.clear();

    // ----------------------------------------------------
    // TEST SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`   SPRINT 24 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED   `);
    console.log('====================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runSprint24Tests();
