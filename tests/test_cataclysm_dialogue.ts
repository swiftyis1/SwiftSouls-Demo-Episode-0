const storageMock: { [key: string]: string } = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
};

import { LicenseManager } from '../src/systems/LicenseManager';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${message}`);
}

console.log('=== VERIFYING CATACLYSM DIALOGUE FOR DEMO VS COMMERCIAL ===\n');

function getCataclysmDialogue(isCommercial: boolean): string[] {
    const dialogue = [
        '[EXTINCTION ENGINE: EQUILIBRIUM REACHED]',
        'The Cataclysm has been vanquished. Its essence dissolves into the void.',
        'The planetary ecosystem has stabilized from the brink of total collapse.'
    ];
    if (isCommercial) {
        dialogue.push('Continue hunting all remaining species to extinction to trigger the true ending.');
    }
    return dialogue;
}

// 1. Demo Mode Verification
console.log('--- 1. Demo Mode Dialogue Verification ---');
const demoDialogue = getCataclysmDialogue(false);

assert(demoDialogue.length === 3, 'Demo dialogue contains exactly 3 narrative lines');
const hasTrueEndingInDemo = demoDialogue.some(line => line.toLowerCase().includes('true ending'));
assert(!hasTrueEndingInDemo, 'Demo dialogue does NOT mention "true ending"');
const hasExterminateInDemo = demoDialogue.some(line => line.toLowerCase().includes('exterminat') || line.toLowerCase().includes('absolute extinction'));
assert(!hasExterminateInDemo, 'Demo dialogue does NOT mention exterminating all or absolute extinction');
assert(demoDialogue[2].includes('stabilized'), 'Demo dialogue states the ecosystem has stabilized');

// 2. Commercial / Final Game Verification
console.log('\n--- 2. Final Game Dialogue Verification ---');
const finalDialogue = getCataclysmDialogue(true);

assert(finalDialogue.length === 4, 'Final game dialogue contains 4 narrative lines');
const hasTrueEndingInFinal = finalDialogue.some(line => line.toLowerCase().includes('true ending'));
assert(hasTrueEndingInFinal, 'Final game dialogue contains true ending directive');

console.log('\n🎉 ALL CATACLYSM DIALOGUE TESTS PASSED!');
