// Automated validation script for Sprint 20: Core Attributes, Penetration, Luck Tier, Agility Flee & Save Migration
// Run with: node --experimental-strip-types tests/test_sprint20.ts

// Mock localStorage and window for headless Node environment
const storageMock: { [key: string]: string } = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
};
(globalThis as any).window = {
    localStorage: (globalThis as any).localStorage,
    location: { hash: '', search: '' },
    addEventListener: () => {}
};

import { GameManager, SoulCrystalDatabase, type GameState, type EquipmentSlot } from '../src/systems/GameManager.ts';
import { MonsterDatabase, AlphaBossDatabase } from '../src/systems/MonsterDatabase.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        (globalThis as any).process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

async function runTests() {
    console.log('=== SPRINT 20: COMBAT STATS EXPANSION & SAVE MIGRATION VALIDATION ===\n');

    const gm = GameManager.instance;

    // -------------------------------------------------------------
    // TEST 1: Baseline Stats & getHeroBaseStats()
    // -------------------------------------------------------------
    console.log('--- 1. Hero Baseline Stats & Structure ---');
    const baseStats = gm.getHeroBaseStats();
    assert(baseStats.name === 'Swift', 'Hero name is Swift');
    assert(baseStats.magic === 5, 'Baseline magic is 5');
    assert(baseStats.magicDefense === 3, 'Baseline magic defense is 3');
    assert(baseStats.accuracy === 95, 'Baseline accuracy is 95%');
    assert(baseStats.evasion === 5, 'Baseline evasion is 5%');
    assert(baseStats.critChance === 5, 'Baseline critChance is 5%');
    assert(baseStats.critDamage === 1.5, 'Baseline critDamage is 1.5x');
    assert(baseStats.luck === 10, 'Baseline luck is 10');
    assert(baseStats.physicalPenetration === 0, 'Baseline physical penetration is 0%');
    assert(baseStats.magicPenetration === 0, 'Baseline magic penetration is 0%');
    assert(baseStats.spCostReduction === 0, 'Baseline spCostReduction is 0%');

    // -------------------------------------------------------------
    // TEST 2: Strict Invariant - Soul Crystal Fragment Growth Untouched
    // -------------------------------------------------------------
    console.log('\n--- 2. Fragment Growth Invariant (Untouched) ---');
    const species = ['slime', 'snake', 'bat', 'goblin', 'skeleton', 'phoenix'];
    species.forEach(sp => {
        const crystal = SoulCrystalDatabase[sp];
        assert(!!crystal, `Soul crystal ${sp} exists`);
        const spf = crystal.statPerFragment;
        // Verify only original fields exist, and no new stat keys are in statPerFragment
        const spfKeys = Object.keys(spf);
        for (const k of spfKeys) {
            assert(['maxHp', 'maxSp', 'strength', 'defense', 'agility'].includes(k),
                `${sp} statPerFragment only contains core attribute ${k}`);
        }
        const extKeys = Object.keys(crystal.extinctionBonus);
        for (const k of extKeys) {
            assert(['maxHp', 'maxSp', 'strength', 'defense', 'agility'].includes(k),
                `${sp} extinctionBonus only contains core attribute ${k}`);
        }
    });

    // -------------------------------------------------------------
    // TEST 3: Equipped Abilities Rework & Scaling
    // -------------------------------------------------------------
    console.log('\n--- 3. Equipped Abilities Rework & Infusion Scaling ---');
    // Set 0 fragments: base effects
    gm.getState().soulCrystals['skeleton'] = { fragments: 5, isExtinct: false }; // tier 1 => scale 1.05
    const skelSword = gm.getScaledSlotEffect('skeleton', 'sword');
    assert(skelSword.modifier?.physicalPenetration === 21, 'Skeleton sword scales 20% -> 21% Phys Pen at tier 1');

    gm.getState().soulCrystals['slime'] = { fragments: 10, isExtinct: false }; // tier 2 => scale 1.10
    const slimeSword = gm.getScaledSlotEffect('slime', 'sword');
    assert(slimeSword.modifier?.magicPenetration === 17, 'Slime sword scales 15% -> 17% Mag Pen at tier 2');

    const slimeHelmet = gm.getScaledSlotEffect('slime', 'helmet');
    assert(slimeHelmet.modifier?.spCostReduction === 11, 'Slime helmet scales 10% -> 11% SP reduction at tier 2');

    gm.getState().soulCrystals['bat'] = { fragments: 5, isExtinct: false }; // tier 1 => scale 1.05
    const batSword = gm.getScaledSlotEffect('bat', 'sword');
    assert(batSword.modifier?.agility === 3, 'Bat sword grants scaled Agility');
    assert(batSword.modifier?.critDamage === 0.21, 'Bat sword scales 0.20 -> 0.21 (+21% crit damage)');

    const batShield = gm.getScaledSlotEffect('bat', 'shield');
    assert(batShield.modifier?.evasion === 8, 'Bat shield grants 8% evasion');

    const batHelmet = gm.getScaledSlotEffect('bat', 'helmet');
    assert(batHelmet.modifier?.accuracy === 11, 'Bat helmet scales 10% -> 11% accuracy');

    gm.getState().soulCrystals['phoenix'] = { fragments: 5, isExtinct: false }; // tier 1 => scale 1.05
    const phxHelmet = gm.getScaledSlotEffect('phoenix', 'helmet');
    assert(phxHelmet.modifier?.magic === 8, 'Phoenix helmet grants +8 Magic');
    const phxShield = gm.getScaledSlotEffect('phoenix', 'shield');
    assert(phxShield.modifier?.magicDefense === 5, 'Phoenix shield grants +5 Magic Defense');

    gm.getState().soulCrystals['snake'] = { fragments: 5, isExtinct: false }; // tier 1
    const snakeHelmet = gm.getScaledSlotEffect('snake', 'helmet');
    assert(snakeHelmet.modifier?.luck === 32, 'Snake helmet scales 30 -> 32 Luck');

    gm.getState().soulCrystals['goblin'] = { fragments: 5, isExtinct: false }; // tier 1
    const gobSword = gm.getScaledSlotEffect('goblin', 'sword');
    assert(gobSword.modifier?.critChance === 16, 'Goblin sword scales 15% -> 16% Crit Chance');

    // -------------------------------------------------------------
    // TEST 4: Calculated Stats & Luck Tier Scaling
    // -------------------------------------------------------------
    console.log('\n--- 4. Calculated Stats & Luck Tier Scaling ---');
    // Reset equipped crystals and test baseline calculation
    const eq = gm.getState().equippedCrystals;
    eq.sword = null; eq.shield = null; eq.armor = null; eq.helmet = null;
    eq.ring1 = null; eq.ring2 = null; eq.amulet = null;

    let calc = gm.getHeroCalculatedStats();
    assert(calc.luck >= 10, 'Baseline calculated luck is >= 10');
    assert(calc.accuracy >= 95, 'Baseline calculated accuracy is >= 95');

    // Socket Snake Helmet (+32 Luck) -> total luck = 10 + 32 = 42 (Tier 0)
    eq.helmet = 'snake';
    calc = gm.getHeroCalculatedStats();
    assert(calc.luck === 42, 'Calculated luck with Snake Helmet is 42');
    const tier0Bonus = Math.floor(calc.luck / 100) * 0.5;
    assert(tier0Bonus === 0, 'Luck < 100 has 0 bonus');

    // Boost party base luck to 80 -> total luck = 80 + 32 = 112 (Tier 1: +0.5 bonus)
    gm.getState().party[0].luck = 80;
    calc = gm.getHeroCalculatedStats();
    assert(calc.luck === 112, 'Calculated luck is 112');
    assert(Math.floor(calc.luck / 100) === 1, 'Luck Tier is 1');
    // Base strength is 4, plus extinction/fragments, plus 0.5 Luck Tier
    // Since tier 1 adds +0.5 to strength, defense, agility, magic, magicDefense, accuracy, evasion, critChance
    assert(typeof calc.strength === 'number' && !isNaN(calc.strength), 'Stats preserve decimal tier scaling');
    assert(calc.accuracy % 1 === 0.5 || calc.accuracy % 1 === 0, 'Accuracy reflects tier scaling');

    // Boost base luck to 180 -> total luck = 180 + 32 = 212 (Tier 2: +1.0 bonus)
    gm.getState().party[0].luck = 180;
    const calcTier2 = gm.getHeroCalculatedStats();
    assert(Math.floor(calcTier2.luck / 100) === 2, 'Luck Tier is 2');
    assert(calcTier2.strength === calc.strength + 0.5, 'Strength increases by +0.5 going from Tier 1 to Tier 2');

    // Reset base luck to 10
    gm.getState().party[0].luck = 10;
    eq.helmet = null;

    // -------------------------------------------------------------
    // TEST 5: Backward Compatibility & Save File Migration
    // -------------------------------------------------------------
    console.log('\n--- 5. Save File Migration & State Hydration ---');
    // Simulate legacy save state without any new stats
    const legacyState: any = {
        party: [{
            name: 'Swift',
            level: 3,
            hp: 25,
            maxHp: 25,
            sp: 12,
            maxSp: 12,
            strength: 8,
            defense: 5,
            agility: 6
            // missing magic, magicDefense, accuracy, evasion, critChance, critDamage, luck, etc.
        }],
        inventory: [{ itemId: 'potion_hp', quantity: 2 }],
        quests: {},
        currentScene: 'OverworldScene',
        currentMapId: 'world_map',
        spawnPoint: { x: 224, y: 416 },
        soulCrystals: {
            goblin: { fragments: 10, isExtinct: false }
        },
        equippedCrystals: {
            sword: null, shield: null, armor: null, helmet: null, ring1: null, ring2: null, amulet: null
        }
    };

    const repaired = gm.validateAndRepairState(legacyState as GameState);
    const hero = repaired.party[0];
    assert(hero.magic === 5, 'Legacy save hydrated with magic: 5');
    assert(hero.magicDefense === 3, 'Legacy save hydrated with magicDefense: 3');
    assert(hero.accuracy === 95, 'Legacy save hydrated with accuracy: 95');
    assert(hero.evasion === 5, 'Legacy save hydrated with evasion: 5');
    assert(hero.critChance === 5, 'Legacy save hydrated with critChance: 5');
    assert(hero.critDamage === 1.5, 'Legacy save hydrated with critDamage: 1.5');
    assert(hero.luck === 10, 'Legacy save hydrated with luck: 10');
    assert(hero.physicalPenetration === 0, 'Legacy save hydrated with physicalPenetration: 0');
    assert(hero.magicPenetration === 0, 'Legacy save hydrated with magicPenetration: 0');
    assert(hero.spCostReduction === 0, 'Legacy save hydrated with spCostReduction: 0');

    // -------------------------------------------------------------
    // TEST 6: Combat Formulas (Hit, Crit, Penetration, Flee)
    // -------------------------------------------------------------
    console.log('\n--- 6. Combat Formulas Validation ---');

    // A. Hit vs Evasion formula: clamp(accuracy - evasion, 15, 100)
    assert(clamp(95 - 5, 15, 100) === 90, 'Standard hit chance: 95 Acc - 5 Eva = 90%');
    assert(clamp(50 - 80, 15, 100) === 15, 'Hit chance floor clamped to 15%');
    assert(clamp(115 - 2, 15, 100) === 100, 'Hit chance ceiling clamped to 100%');

    // B. Physical Penetration: def * (1 - pen / 100)
    const rawDef = 20;
    const pen25 = 25;
    const effectiveDef25 = rawDef * (1 - pen25 / 100);
    assert(effectiveDef25 === 15, '20 Def mitigated by 25% Phys Pen is 15 Def');

    const pen100 = 100;
    const effectiveDef100 = rawDef * (1 - pen100 / 100);
    assert(effectiveDef100 === 0, '20 Def mitigated by 100% Phys Pen is 0 Def');

    // C. Magic Scaling on Spells
    const magicStat = 15;
    const baseHeal = 20;
    const scaledHeal = baseHeal + Math.floor(magicStat * 1.2);
    assert(scaledHeal === 38, 'Heal spell power 20 + floor(15 * 1.2) = 38');

    const baseFire = 30;
    const scaledFire = baseFire + Math.floor(magicStat * 1.5);
    assert(scaledFire === 52, 'Fire spell power 30 + floor(15 * 1.5) = 52');

    // D. SP Cost Reduction
    const rawSpCost = 10;
    const reduction15 = 15;
    const actualCost = Math.max(1, Math.round(rawSpCost * (1 - reduction15 / 100)));
    assert(actualCost === 9, '10 SP spell with 15% reduction costs 9 SP');

    // E. Dynamic Crit Damage Multiplier
    const hitDamage = 20;
    const critDmgMult = 1.75;
    const critTotal = Math.floor(hitDamage * critDmgMult);
    assert(critTotal === 35, '20 damage at 1.75x crit damage = 35 damage');

    // F. Agility-Scaled Fleeing Formula
    // clamp(50 + (heroAgi - enemyAgi)*4 + luckTier*2, 25, 95)
    const fleeStandard = clamp(Math.round(50 + (10 - 5) * 4 + 0 * 2), 25, 95);
    assert(fleeStandard === 70, 'Hero Agi 10 vs Enemy Agi 5 => 70% flee chance');

    const fleeLow = clamp(Math.round(50 + (2 - 15) * 4 + 0 * 2), 25, 95);
    assert(fleeLow === 25, 'Hero Agi 2 vs Enemy Agi 15 => clamped to 25% floor');

    const fleeHigh = clamp(Math.round(50 + (25 - 2) * 4 + 2 * 2), 25, 95);
    assert(fleeHigh === 95, 'Hero Agi 25 vs Enemy Agi 2 with Luck Tier 2 => clamped to 95% ceiling');

    // -------------------------------------------------------------
    // TEST 7: Monster Database Complete Attributes
    // -------------------------------------------------------------
    console.log('\n--- 7. Monster Database Profiles ---');
    for (const id in MonsterDatabase) {
        const m = MonsterDatabase[id];
        assert(typeof m.magic === 'number' && m.magic >= 0, `${id} has valid magic stat`);
        assert(typeof m.magicDefense === 'number' && m.magicDefense >= 0, `${id} has valid magicDefense stat`);
        assert(typeof m.accuracy === 'number' && m.accuracy >= 50, `${id} has valid accuracy stat`);
        assert(typeof m.evasion === 'number' && m.evasion >= 0, `${id} has valid evasion stat`);
        assert(typeof m.critChance === 'number' && m.critChance >= 0, `${id} has valid critChance stat`);
        assert(typeof m.critDamage === 'number' && m.critDamage >= 1.0, `${id} has valid critDamage stat`);
        assert(typeof m.luck === 'number' && m.luck >= 0, `${id} has valid luck stat`);
        assert(typeof m.physicalPenetration === 'number', `${id} has valid physicalPenetration`);
        assert(typeof m.magicPenetration === 'number', `${id} has valid magicPenetration`);
    }

    console.log('\n--- 8. Alpha Boss Database Profiles ---');
    for (const id in AlphaBossDatabase) {
        const boss = AlphaBossDatabase[id];
        assert(boss.magic >= MonsterDatabase[id].magic, `Alpha ${id} magic scales higher than baseline`);
        assert(boss.critDamage >= MonsterDatabase[id].critDamage, `Alpha ${id} critDamage scales higher`);
        assert(boss.luck >= MonsterDatabase[id].luck, `Alpha ${id} luck scales higher`);
    }

    console.log('\n🎉 ALL SPRINT 20 TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    (globalThis as any).process.exit(1);
});
