const storageMock: { [key: string]: string } = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
};

import fs from 'fs';
import path from 'path';
import { MonsterDatabase, SpecialBossDatabase, getSpecialBoss } from '../src/systems/MonsterDatabase.ts';
import { GameManager } from '../src/systems/GameManager.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
}

console.log('=== VERIFYING CATACLYSM BESTIARY INTEGRATION ===\n');

// 1. Verify MonsterDatabase['cataclysm']
console.log('--- 1. MonsterDatabase Registration ---');
const cataclysmMonster = MonsterDatabase['cataclysm'];
assert(!!cataclysmMonster, 'MonsterDatabase contains cataclysm entry');
assert(cataclysmMonster.speciesId === 'cataclysm', 'Cataclysm speciesId is "cataclysm"');
assert(cataclysmMonster.name === 'Cataclysm', 'Cataclysm name is "Cataclysm"');
assert(cataclysmMonster.level === 10, 'Cataclysm level is 10');
assert(cataclysmMonster.hp === 10056, 'Cataclysm base HP is 10056 (tops 10k)');
 assert(cataclysmMonster.maxHp === 10056, 'Cataclysm base maxHp is 10056 (tops 10k)');
assert(cataclysmMonster.strength === 100, 'Cataclysm base Strength is 100 (rebalanced: goblin 32 + phoenix 64)');
assert(cataclysmMonster.defense === 66, 'Cataclysm base Defense is 66 (halved for balance)');
assert(cataclysmMonster.agility === 131, 'Cataclysm base Agility is 131');
assert(cataclysmMonster.element === 'dark', 'Cataclysm element is dark');
assert(cataclysmMonster.elementalResistances?.['fire'] === 0.5, 'Cataclysm fire resistance is 0.5');
assert(cataclysmMonster.elementalResistances?.['dark'] === 0.5, 'Cataclysm dark resistance is 0.5');
assert(cataclysmMonster.elementalResistances?.['physical'] === 0.5, 'Cataclysm physical resistance is 0.5');

// 2. Verify SpecialBossDatabase['cataclysm']
console.log('\n--- 2. SpecialBossDatabase Registration ---');
const cataclysmBoss = SpecialBossDatabase['cataclysm'];
assert(!!cataclysmBoss, 'SpecialBossDatabase contains cataclysm entry');
assert(cataclysmBoss.speciesId === 'cataclysm', 'Boss entry speciesId is "cataclysm"');
assert(cataclysmBoss.maxHp === 10056, 'Boss entry maxHp is 10056 (tops 10k)');

// 3. Verify getSpecialBoss('cataclysm') dynamic computation
console.log('\n--- 3. getSpecialBoss Dynamic Computation ---');
const dynamicCataclysm = getSpecialBoss('cataclysm');
const expectedDynamicStats = GameManager.computeCataclysmBossStats();
assert(dynamicCataclysm.speciesId === 'cataclysm', 'getSpecialBoss("cataclysm") returns cataclysm');
assert(dynamicCataclysm.hp === expectedDynamicStats.hp, 'Dynamic HP matches GameManager computation');
assert(dynamicCataclysm.strength === expectedDynamicStats.strength, 'Dynamic Strength matches GameManager computation');
assert(dynamicCataclysm.defense === expectedDynamicStats.defense, 'Dynamic Defense matches GameManager computation');
assert(dynamicCataclysm.agility === expectedDynamicStats.agility, 'Dynamic Agility matches GameManager computation');

// 4. Verify existing bosses unaffected
console.log('\n--- 4. Existing Boss Lookups Regression Check ---');
const astral = getSpecialBoss('astral_scavenger');
assert(astral.speciesId === 'astral_scavenger', 'Astral Scavenger is properly retrieved');
assert(astral.maxHp === 200, 'Astral Scavenger maxHp is 200');

// 5. Verify BESTIARY_AND_BALANCE.md Documentation
console.log('\n--- 5. BESTIARY_AND_BALANCE.md Documentation Verification ---');
const bestiaryDocPath = path.resolve(process.cwd(), '../BESTIARY_AND_BALANCE.md');
assert(fs.existsSync(bestiaryDocPath), 'BESTIARY_AND_BALANCE.md exists');
const docContent = fs.readFileSync(bestiaryDocPath, 'utf-8');

assert(docContent.includes('☄️ Cataclysm (`cataclysm`) — The Extinction Engine Singularity'), 'Documentation contains entry for Cataclysm');
assert(docContent.includes('| `cataclysm` | **Cataclysm** | **World Boss (Climax)** | **Max LV** | **10,056** | **100** | **66** | **131** |'), 'Comparative Balance & Stat Matrix table contains Cataclysm row (balanced values)');
assert(docContent.includes('ACH_EXTINCTION_80_PERCENT'), 'Documentation references the 80% extinction awakening trigger');
assert(docContent.includes('world_map` grid `(50, 50)`'), 'Documentation references overworld spawn coordinates (50, 50)');

console.log('\n🎉 ALL CATACLYSM BESTIARY INTEGRATION TESTS PASSED!\n');
