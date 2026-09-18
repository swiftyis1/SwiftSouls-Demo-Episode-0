import { GameManager, ALL_EQUIPMENT_SLOTS } from '../src/systems/GameManager.ts';
import { getSpecialBoss } from '../src/systems/MonsterDatabase.ts';
import { AchievementManager } from '../src/systems/AchievementManager.ts';

/**
 * Sprint 25 Automated Verification Test Suite
 * Validates:
 * 1. 8th Equipment Slot (Earrings) Schema, Defaults & Integrity
 * 2. Prologue Crater Boss ("Astral Scavenger") Database & Relic Drop Unlock
 * 3. Earrings Pet Conduit Activation & Strict Single-Pet Invariant
 * 4. Pet Augmentation Engine (Secondary Catalyst Infusion, Stats & Auras)
 * 5. Boss Soulmelding (Dual-Socket on Equipment, Secondary Stats & Spells)
 * 6. Legacy Save State Validation & Repair Resilience
 * 7. Achievement Unlocks for Sprint 25 Milestones
 */
function runSprint25Tests() {
    console.log('====================================================');
    console.log('   RUNNING SPRINT 25 AUTOMATED VERIFICATION SUITE   ');
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
    // TEST 1: 8th Equipment Slot Schema & Defaults
    // ----------------------------------------------------
    console.log('\n--- 1. 8th Equipment Slot (Earrings) Schema & Defaults ---');

    assert(ALL_EQUIPMENT_SLOTS.length === 8, 'ALL_EQUIPMENT_SLOTS contains exactly 8 slots');
    assert(ALL_EQUIPMENT_SLOTS.includes('earrings'), 'ALL_EQUIPMENT_SLOTS includes "earrings"');

    GameManager.instance.resetGame();
    const initialState = GameManager.instance.getState();

    assert(initialState.hasUnlockedEarrings === false, 'New game starts with hasUnlockedEarrings = false');
    assert(GameManager.instance.hasEarringsUnlocked() === false, 'hasEarringsUnlocked() returns false initially');
    assert(initialState.equippedCrystals.earrings === null, 'initialState.equippedCrystals.earrings is null');
    assert(initialState.forgeRefinements?.earrings === 0, 'Forge refinement for earrings starts at 0');

    // Cannot refine earrings while locked
    const refineAttempt = GameManager.instance.refineEquipmentSlot('earrings');
    assert(refineAttempt.success === false, 'Cannot refine earrings slot before unlocking');

    // ----------------------------------------------------
    // TEST 2: Special Crater Boss (Astral Scavenger)
    // ----------------------------------------------------
    console.log('\n--- 2. Astral Scavenger Special Boss & Relic Recovery ---');

    const boss = getSpecialBoss('astral_scavenger');
    assert(boss !== undefined, 'Astral Scavenger is registered in SpecialBossDatabase');
    assert(boss.speciesId === 'astral_scavenger', 'Boss speciesId is astral_scavenger');
    assert(boss.name === 'Astral Scavenger', 'Boss name is Astral Scavenger');
    assert(boss.level === 3, 'Astral Scavenger is Level 3 for prologue crater difficulty');
    assert(boss.maxHp === 120, 'Astral Scavenger has 120 Max HP');
    assert(boss.element === 'dark', 'Astral Scavenger is cosmic dark elemental');

    // Defeating boss unlocks the earrings slot
    const unlockRes = GameManager.instance.unlockEarringsSlot();
    assert(unlockRes === true, 'unlockEarringsSlot() returns true');
    assert(GameManager.instance.hasEarringsUnlocked() === true, 'hasEarringsUnlocked() now returns true');

    // Verify achievement unlock
    assert(AchievementManager.instance.isUnlocked('ACH_ASTRAL_EARRINGS'), 'Achievement ACH_ASTRAL_EARRINGS unlocked');

    // Now refining earrings is permitted
    const refineSuccess = GameManager.instance.refineEquipmentSlot('earrings');
    assert(refineSuccess.success === true, 'Refining earrings succeeds after relic recovery');
    assert(GameManager.instance.getForgeRefinements().earrings === 1, 'Earrings forge refinement tier is 1');

    // ----------------------------------------------------
    // TEST 3: Earrings Pet Conduit & Single-Pet Invariant
    // ----------------------------------------------------
    console.log('\n--- 3. Earrings Pet Conduit & Single-Pet Invariant ---');

    // Add essence fragments for socketing
    GameManager.instance.addEssenceFragments('phoenix', 20);
    GameManager.instance.addEssenceFragments('snake', 20);
    GameManager.instance.addEssenceFragments('slime', 20);

    // Socket primary crystal into earrings
    assert(GameManager.instance.getState().petCompanion === null, 'Pet companion is initially null');
    const socketPrimary = GameManager.instance.socketCrystal('phoenix', 'earrings');
    assert(socketPrimary === true, 'Socketed phoenix crystal into earrings slot');

    const pet1 = GameManager.instance.getState().petCompanion;
    assert(pet1 !== null, 'Pet companion is created upon socketing earrings');
    assert(pet1?.speciesId === 'phoenix', 'Pet companion species is phoenix');
    assert(pet1?.name === 'Pyre Fledgling', 'Pet companion name is Pyre Fledgling');
    assert(pet1?.augmentation === null, 'Pet companion starts without secondary augmentation');

    // Unsocketing removes pet companion
    GameManager.instance.unsocketCrystal('earrings');
    assert(GameManager.instance.getState().petCompanion === null, 'Unsocketing earrings nullifies pet companion');

    // Re-socket phoenix
    GameManager.instance.socketCrystal('phoenix', 'earrings');

    // ----------------------------------------------------
    // TEST 4: Earrings Pet Augmentation Catalyst Engine
    // ----------------------------------------------------
    console.log('\n--- 4. Pet Augmentation Catalyst Engine (Invariant Validation) ---');

    // Unlock dual socket for earrings (Earrings Soulmeld Catalyst)
    const dualEarrings = GameManager.instance.unlockDualSocket('earrings');
    assert(dualEarrings.success === true, 'Unlocked dual socket on earrings');
    assert(GameManager.instance.isDualSocketUnlocked('earrings') === true, 'isDualSocketUnlocked("earrings") is true');

    // Socket secondary crystal (Snake) into earrings
    const socketSec = GameManager.instance.socketSecondaryCrystal('earrings', 'snake');
    assert(socketSec === true, 'Socketed snake secondary catalyst into earrings');

    // STRICT INVARIANT TEST: Still exactly 1 pet companion in state!
    const petAfterAug = GameManager.instance.getState().petCompanion;
    assert(petAfterAug !== null, 'Pet companion exists');
    assert(petAfterAug?.speciesId === 'phoenix', 'Primary pet companion species remains phoenix (no duplicate follower)');
    assert(petAfterAug?.augmentation !== null && petAfterAug?.augmentation !== undefined, 'Pet companion has augmentation attached');
    assert(petAfterAug?.augmentation?.secondarySpeciesId === 'snake', 'Augmentation catalyst is snake');
    assert(petAfterAug?.augmentation?.traitName === 'Verdant Mending', 'Augmentation traitName is Verdant Mending');
    assert(petAfterAug?.augmentation?.auraEffect === 'mending_aura', 'Augmentation aura is mending_aura');
    assert(petAfterAug?.augmentation?.bonusSkill === 'Venom Fang', 'Augmentation bonus skill is Venom Fang');

    // Verify achievement ACH_PET_AUGMENTED unlocked
    assert(AchievementManager.instance.isUnlocked('ACH_PET_AUGMENTED'), 'Achievement ACH_PET_AUGMENTED unlocked');

    // Verify hero stats receive companion aura benefit (+25 HP from mending aura)
    const heroStats = GameManager.instance.getHeroCalculatedStats();
    assert(heroStats.maxHp >= 40, 'Hero stats calculate with active pet aura bonus');

    // Test augmenting with different catalysts
    const slimeAug = GameManager.instance.getPetAugmentation('phoenix', 'slime');
    assert(slimeAug.traitName === 'Corrosive Buffer', 'Slime catalyst provides Corrosive Buffer');
    assert(slimeAug.bonusDefensePercent === 0.30, 'Slime catalyst provides +30% Defense');

    const batAug = GameManager.instance.getPetAugmentation('goblin', 'bat');
    assert(batAug.traitName === 'Shadow Wing Aura', 'Bat catalyst provides Shadow Wing Aura');
    assert(batAug.secondaryElement === 'dark', 'Bat catalyst element is dark');

    // Unsocketing secondary crystal clears augmentation
    GameManager.instance.unsocketSecondaryCrystal('earrings');
    assert(GameManager.instance.getState().petCompanion?.augmentation === null, 'Unsocketing secondary catalyst clears augmentation');
    assert(GameManager.instance.getState().petCompanion?.speciesId === 'phoenix', 'Primary pet remains active after unsocketing catalyst');

    // ----------------------------------------------------
    // TEST 5: Boss Soulmelding (Dual-Socket on 7 Gear Items)
    // ----------------------------------------------------
    console.log('\n--- 5. Boss Soulmelding (Dual Sockets on Standard Equipment) ---');

    // Unlock dual socket on sword and ring1
    GameManager.instance.unlockDualSocket('sword');
    GameManager.instance.unlockDualSocket('ring1');

    assert(GameManager.instance.isDualSocketUnlocked('sword') === true, 'Sword dual socket is unlocked');
    assert(GameManager.instance.isDualSocketUnlocked('ring1') === true, 'Ring1 dual socket is unlocked');
    assert(GameManager.instance.isDualSocketUnlocked('shield') === false, 'Shield dual socket remains locked');

    // Verify achievement ACH_BOSS_SOULMELDER
    assert(AchievementManager.instance.isUnlocked('ACH_BOSS_SOULMELDER'), 'Achievement ACH_BOSS_SOULMELDER unlocked');

    // Socket primary and secondary on sword
    GameManager.instance.addEssenceFragments('goblin', 30);
    GameManager.instance.socketCrystal('goblin', 'sword');
    GameManager.instance.socketSecondaryCrystal('sword', 'slime');

    assert(GameManager.instance.getState().equippedCrystals.sword === 'goblin', 'Primary sword crystal is goblin');
    assert(GameManager.instance.getSecondaryEquippedCrystal('sword') === 'slime', 'Secondary sword crystal is slime');

    // Socket primary and secondary on spell slot (ring1)
    GameManager.instance.socketCrystal('snake', 'ring1');
    GameManager.instance.socketSecondaryCrystal('ring1', 'phoenix');

    const activeSpells = GameManager.instance.getActiveSpells();
    const hasPrimarySpell = activeSpells.some(s => s.name === 'Heal' || s.source === 'ring1');
    const hasMeldedSpell = activeSpells.some(s => s.name.includes('(Melded)') || s.source === 'ring1_secondary');

    assert(hasPrimarySpell, 'Primary active spell from ring1 is registered');
    assert(hasMeldedSpell, 'Secondary (Melded) active spell from ring1 secondary socket is registered');

    // ----------------------------------------------------
    // TEST 6: Legacy Save State Validation & Repair
    // ----------------------------------------------------
    console.log('\n--- 6. Legacy Save State Validation & Repair Resilience ---');

    // Construct legacy save payload lacking earrings, dualSocketUnlocked, etc.
    const legacyState: any = {
        party: [{ name: 'Melodie', hp: 100, maxHp: 100, sp: 50, maxSp: 50, level: 1 }],
        soulCrystals: {
            goblin: { fragments: 15, isExtinct: false }
        },
        equippedCrystals: {
            sword: 'goblin',
            shield: null,
            armor: null,
            helmet: null,
            ring1: null,
            ring2: null,
            amulet: null
            // Missing 'earrings'!
        },
        forgeRefinements: {
            sword: 1
            // Missing 'earrings'!
        }
        // Missing hasUnlockedEarrings, dualSocketUnlocked, secondaryEquippedCrystals!
    };

    const repairedState = (GameManager.instance as any).validateAndRepairState(legacyState);

    assert(repairedState.equippedCrystals.earrings === null, 'Repaired state has earrings: null');
    assert(repairedState.hasUnlockedEarrings === false, 'Repaired state defaults hasUnlockedEarrings to false');
    assert(repairedState.dualSocketUnlocked !== undefined, 'Repaired state has dualSocketUnlocked map');
    assert(repairedState.secondaryEquippedCrystals !== undefined, 'Repaired state has secondaryEquippedCrystals map');
    assert(repairedState.forgeRefinements?.earrings === 0, 'Repaired state has forgeRefinements.earrings initialized to 0');

    // Verify system continues to function normally with repaired state
    assert(repairedState.equippedCrystals.sword === 'goblin', 'Sword preserved in repaired state');

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`   SPRINT 25 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runSprint25Tests();
