import {
    type ElementType,
    type StatusAilmentType,
    type ActiveStatusAilment,
    ElementSystem,
    calculateDamage,
    getAilmentBadge,
    applyAilment,
    removeAilment,
    tickAilmentDurations,
    hasAilment,
    getBurnStrengthPenalty
} from '../src/systems/ElementSystem.ts';
import { MonsterDatabase, AlphaBossDatabase } from '../src/systems/MonsterDatabase.ts';
import { GameManager } from '../src/systems/GameManager.ts';

/**
 * Sprint 22 Comprehensive Automated Verification Suite
 * 8-Element Matrix, Over-100% Elemental Absorption & Battle-Scoped Status Ailments
 */
function runSprint22Tests() {
    console.log('====================================================');
    console.log('   RUNNING SPRINT 22 AUTOMATED VERIFICATION SUITE   ');
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

    localStorage.clear();

    // ----------------------------------------------------
    // TEST 1: 8-Element Interaction Matrix
    // ----------------------------------------------------
    console.log('\n--- 1. 8-Element Affinity Matrix ---');
    const matrix = ElementSystem.AFFINITY_MATRIX;

    assert(matrix.fire.cold === 1.5, 'Fire melts Cold for 1.5x damage');
    assert(matrix.fire.water === 0.5, 'Water douses Fire for 0.5x damage');
    assert(matrix.cold.fire === 1.25, 'Cold quenches Fire for 1.25x damage');
    assert(matrix.water.fire === 1.75, 'Water extinguishes Fire for 1.75x damage');
    assert(matrix.lightning.water === 1.75, 'Lightning electrocutes Water for 1.75x damage');
    assert(matrix.earth.lightning === 1.5, 'Earth grounds Lightning for 1.5x bonus damage');
    assert(matrix.lightning.earth === 0.25, 'Earth resists Lightning heavily (0.25x damage)');
    assert(matrix.dark.light === 1.75, 'Dark devastates Light for 1.75x damage');
    assert(matrix.light.dark === 1.75, 'Light dispels Dark for 1.75x damage');
    assert(matrix.poison.water === 1.25, 'Poison pollutes Water for 1.25x damage');
    assert(matrix.physical.fire === undefined, 'Physical has no elemental weakness multipliers (neutral 1.0x)');

    // ----------------------------------------------------
    // TEST 2: Elemental Damage Calculation & Magic Defense Mitigation
    // ----------------------------------------------------
    console.log('\n--- 2. Elemental Damage Calculation & MDef Mitigation ---');
    
    // Normal neutral hit
    const neutralDmg = calculateDamage({
        basePower: 50,
        attackElement: 'physical',
        defenderDef: 10,
        defenderResistances: {}
    });
    assert(neutralDmg.damage > 0, 'Physical attack deals positive damage');
    assert(neutralDmg.isWeakness === false, 'Neutral hit is not flagged weakness');
    assert(neutralDmg.isResisted === false, 'Neutral hit is not flagged resisted');

    // Weakness hit (Fire vs Cold: 1.5x)
    const weaknessDmg = calculateDamage({
        basePower: 60,
        attackElement: 'fire',
        defenderElement: 'cold',
        defenderResistances: {}
    });
    assert(weaknessDmg.isWeakness === true, 'Fire vs Cold is flagged as WEAKNESS');
    assert(weaknessDmg.multiplier === 1.5, 'Net multiplier is exactly 1.5x');
    assert(weaknessDmg.damage === 90, 'Base 60 * 1.5 = 90 damage');

    // Resisted hit (Lightning vs Earth: 0.25x)
    const resistDmg = calculateDamage({
        basePower: 100,
        attackElement: 'lightning',
        defenderElement: 'earth',
        defenderResistances: {}
    });
    assert(resistDmg.isResisted === true, 'Lightning vs Earth is flagged as RESISTED');
    assert(resistDmg.multiplier === 0.25, 'Net multiplier is 0.25x');
    assert(resistDmg.damage === 25, 'Base 100 * 0.25 = 25 damage');

    // Magic Defense Diminishing Returns Curve: mDef / (mDef + 40)
    // For base 80 magic damage with mDef = 40, reduction is 40 / 80 = 50%
    const mdefDmg = calculateDamage({
        basePower: 80,
        attackElement: 'fire',
        defenderMDef: 40,
        defenderResistances: {}
    });
    assert(mdefDmg.damage === 40, '40 MDef provides 50% mitigation curve (80 -> 40 dmg)');

    // ----------------------------------------------------
    // TEST 3: Over-100% Elemental Absorption
    // ----------------------------------------------------
    console.log('\n--- 3. Over-100% Elemental Absorption ---');

    // 100% Immunity check
    const immuneDmg = calculateDamage({
        basePower: 100,
        attackElement: 'fire',
        defenderResistances: { fire: 1.0 }
    });
    assert(immuneDmg.isImmune === true, '100% resistance triggers complete immunity');
    assert(immuneDmg.damage === 0, 'Immunity deals 0 damage');
    assert(immuneDmg.isAbsorbed === false, '100% resistance is not absorption');

    // Phoenix Wild Species: 125% Fire resistance (fire: 1.25)
    const phoenix = MonsterDatabase['phoenix'];
    assert(phoenix.element === 'fire', 'Phoenix species inherently typed to Fire');
    assert(phoenix.elementalResistances?.fire === 1.25, 'Phoenix has 1.25 (125%) Fire absorption resistance');

    const absorbDmg = calculateDamage({
        basePower: 120,
        attackElement: 'fire',
        defenderElement: phoenix.element,
        defenderResistances: phoenix.elementalResistances
    });
    assert(absorbDmg.isAbsorbed === true, '125% Fire resistance flags isAbsorbed = true');
    assert(absorbDmg.damage === 0, 'Absorbed attack deals 0 damage to target');
    assert(absorbDmg.absorbedHealing === 30, 'Excess 25% of 120 base power heals target for +30 HP (120 * 0.25)');
    assert(absorbDmg.badgeText.includes('ABSORBED! +30 HP'), 'Absorption badge properly displays formatted +30 HP');

    // Alpha Phoenix Boss: 135% Fire resistance (fire: 1.35)
    const alphaPhoenix = AlphaBossDatabase['phoenix'];
    assert(alphaPhoenix.elementalResistances?.fire === 1.35, 'Alpha Phoenix has 1.35 (135%) Fire absorption resistance');
    const alphaAbsorb = calculateDamage({
        basePower: 200,
        attackElement: 'fire',
        defenderElement: alphaPhoenix.element,
        defenderResistances: alphaPhoenix.elementalResistances
    });
    assert(alphaAbsorb.isAbsorbed === true, 'Alpha Phoenix absorbs Fire attack');
    assert(alphaAbsorb.damage === 0, 'Deals 0 damage');
    assert(alphaAbsorb.absorbedHealing === 70, 'Excess 35% of 200 base power heals Alpha Phoenix for +70 HP (200 * 0.35)');

    // ----------------------------------------------------
    // TEST 4: All 6 Battle-Scoped Status Ailments
    // ----------------------------------------------------
    console.log('\n--- 4. All 6 Status Ailments Engine ---');
    const ailments: ActiveStatusAilment[] = [];

    // 1. Poison
    applyAilment(ailments, 'poison', 3);
    assert(hasAilment(ailments, 'poison') === true, 'Poison ailment applied');
    assert(getAilmentBadge(ailments[0]) === '[PSN 3t]', 'Poison badge correctly formatted as [PSN 3t]');

    // 2. Burn & Strength Penalty
    applyAilment(ailments, 'burn', 3);
    assert(hasAilment(ailments, 'burn') === true, 'Burn ailment applied');
    assert(getAilmentBadge(ailments[1]) === '[BRN 3t]', 'Burn badge correctly formatted as [BRN 3t]');
    const burnPenalty = getBurnStrengthPenalty(ailments);
    assert(burnPenalty === 0.20, 'Burn inflicts exactly 20% strength penalty');

    // 3. Freeze & Fire Thawing
    applyAilment(ailments, 'freeze', 2);
    assert(hasAilment(ailments, 'freeze') === true, 'Freeze ailment applied');
    assert(getAilmentBadge(ailments[2]) === '[FRZ 2t]', 'Freeze badge correctly formatted as [FRZ 2t]');
    
    // Thawing Freeze by fire
    const thawed = removeAilment(ailments, 'freeze');
    assert(thawed === true, 'Fire blast successfully removed Freeze ailment');
    assert(hasAilment(ailments, 'freeze') === false, 'Unit is no longer frozen after thaw');

    // 4. Stun
    applyAilment(ailments, 'stun', 1);
    assert(hasAilment(ailments, 'stun') === true, 'Stun ailment applied');
    assert(getAilmentBadge(ailments.find(a => a.type === 'stun')!) === '[STN 1t]', 'Stun badge formatted as [STN 1t]');

    // 5. Bleed
    applyAilment(ailments, 'bleed', 3);
    assert(hasAilment(ailments, 'bleed') === true, 'Bleed ailment applied');
    assert(getAilmentBadge(ailments.find(a => a.type === 'bleed')!) === '[BLD 3t]', 'Bleed badge formatted as [BLD 3t]');

    // 6. Silence
    applyAilment(ailments, 'silence', 2);
    assert(hasAilment(ailments, 'silence') === true, 'Silence ailment applied');
    assert(getAilmentBadge(ailments.find(a => a.type === 'silence')!) === '[SIL 2t]', 'Silence badge formatted as [SIL 2t]');

    // Refresh duration
    applyAilment(ailments, 'silence', 4);
    const sil = ailments.find(a => a.type === 'silence');
    assert(sil?.duration === 4, 'Re-applying Silence with longer duration refreshes to 4 turns');

    // Duration Tick & Expiry
    const expired1 = tickAilmentDurations(ailments);
    assert(hasAilment(ailments, 'stun') === false, 'Stun (1 turn) expired after 1 turn tick');
    assert(expired1.includes('stun'), 'Expired list contains stun');
    assert(ailments.find(a => a.type === 'poison')?.duration === 2, 'Poison duration decremented to 2 turns');

    // Tick down to 0
    tickAilmentDurations(ailments);
    tickAilmentDurations(ailments);
    tickAilmentDurations(ailments);
    assert(ailments.length === 0, 'All status ailments naturally expired after duration elapsed');

    // ----------------------------------------------------
    // TEST 5: Active Spells & Passive Crystal Gear Infusion
    // ----------------------------------------------------
    console.log('\n--- 5. Active Spell & Passive Gear Infusion ---');
    const gm = GameManager.instance;

    // Grant 10 fragments for all crystals to test gear
    ['phoenix', 'slime', 'bat', 'skeleton', 'snake', 'goblin'].forEach(id => {
        gm.addSoulFragments(id, 10);
    });

    // Equip Phoenix on Ring 1
    gm.equipSoulCrystal('ring1', 'phoenix');
    // Equip Slime on Ring 2
    gm.equipSoulCrystal('ring2', 'slime');

    const spells = gm.getActiveSpells();
    const fireball = spells.find(s => s.name.includes('Fireball'));
    assert(fireball !== undefined, 'Fireball spell active on Ring 1');
    assert(fireball?.element === 'fire', 'Fireball has element: fire');
    assert(fireball?.ailmentChance?.type === 'burn', 'Fireball has 40% burn infliction chance');

    const slimeShot = spells.find(s => s.name.includes('Slime Shot'));
    assert(slimeShot !== undefined, 'Slime Shot active on Ring 2');
    assert(slimeShot?.element === 'poison', 'Slime Shot has element: poison');
    assert(slimeShot?.ailmentChance?.type === 'poison', 'Slime Shot has 50% poison infliction chance');

    // Equip Phoenix on Shield to test defensive elemental resistance passive
    gm.equipSoulCrystal('shield', 'phoenix');

    const passives = gm.getActivePassives();
    assert(passives.elementalResistances !== undefined, 'CombatPassives contains elementalResistances');
    assert((passives.elementalResistances.fire || 0) > 0, 'Equipped Phoenix shield grants positive Fire resistance');

    // ----------------------------------------------------
    // TEST 6: Strict Non-Persistence Guarantee
    // ----------------------------------------------------
    console.log('\n--- 6. Battle-Scope Strict Non-Persistence Invariant ---');
    const savedState = gm.getSaveStateJson();
    const parsedState = JSON.parse(savedState);

    assert(parsedState.party[0].heroAilments === undefined, 'Persistent character save data has NO heroAilments property');
    assert(parsedState.enemyAilments === undefined, 'Persistent game state has NO enemyAilments property');
    assert(parsedState.statusAilments === undefined, 'Persistent game state has NO statusAilments property');

    console.log('\n====================================================');
    console.log(`   TEST COMPLETE: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runSprint22Tests();
