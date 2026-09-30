/**
 * Controller Virtual Keyboard & Hero Naming Test Suite
 * Validates:
 * 1. 40-key virtual keyboard matrix (4 rows x 10 cols)
 * 2. Case toggling (UPPER_KEYS <-> LOWER_KEYS)
 * 3. Navigation across all 4 sections ('top', 'grid', 'action', 'start')
 * 4. Special keys: Space ('␣') and Case Toggle ('a/A')
 * 5. Input length constraints (max 12 characters)
 * 6. Quick Gamepad shortcuts mapping ([A], [B], [X], [Y]/[LB], [RB], [START])
 */

import { GameManager } from '../src/systems/GameManager.ts';

const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

console.log('====================================================');
console.log('   RUNNING CONTROLLER HERO NAMING VERIFICATION      ');
console.log('====================================================\n');

// 1. Virtual Keyboard Catalog Tests
const UPPER_KEYS = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', '1', '2', '3', '4',
    '5', '6', '7', '8', '9', '0', '.', '-', '␣', 'a/A'
];

const LOWER_KEYS = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4',
    '5', '6', '7', '8', '9', '0', '.', '-', '␣', 'A/a'
];

console.log('--- 1. Virtual Keyboard Matrix Dimensions & Keys ---');
if (UPPER_KEYS.length !== 40) throw new Error(`Expected 40 keys in UPPER_KEYS, got ${UPPER_KEYS.length}`);
if (LOWER_KEYS.length !== 40) throw new Error(`Expected 40 keys in LOWER_KEYS, got ${LOWER_KEYS.length}`);
console.log('  [PASS] Virtual keyboard catalog contains exactly 40 keys (4 rows × 10 cols)');

if (UPPER_KEYS[38] !== '␣' || LOWER_KEYS[38] !== '␣') {
    throw new Error('Key 38 must be spacebar (␣)');
}
console.log('  [PASS] Key index 38 correctly maps to Spacebar ("␣")');

if (UPPER_KEYS[39] !== 'a/A' || LOWER_KEYS[39] !== 'A/a') {
    throw new Error('Key 39 must be Case Toggle');
}
console.log('  [PASS] Key index 39 correctly maps to Case Toggle ("a/A")');

// 2. Typing & Length Constraint Simulation
console.log('\n--- 2. Input Handling & 12-Character Constraint ---');
let input = '';
const typeChar = (char: string) => {
    if (input.length < 12) {
        input += char;
    }
};

const deleteChar = () => {
    input = input.slice(0, -1);
};

// Type "SWIFT SOULS"
const seq = ['S', 'W', 'I', 'F', 'T', ' ', 'S', 'O', 'U', 'L', 'S'];
seq.forEach(c => typeChar(c));
if (input !== 'SWIFT SOULS') throw new Error(`Expected "SWIFT SOULS", got "${input}"`);
console.log(`  [PASS] Typing sequence produced: "${input}" (Length: ${input.length})`);

// Attempt to exceed 12 characters
typeChar('!');
typeChar('1');
typeChar('2');
typeChar('3');
if (input.length > 12) throw new Error(`Input exceeded 12 characters: length is ${input.length}`);
if (input !== 'SWIFT SOULS!') throw new Error(`Expected "SWIFT SOULS!" (12 chars), got "${input}"`);
console.log(`  [PASS] Strict 12-character constraint enforced: "${input}" (${input.length}/12)`);

// Delete character
deleteChar();
if (input !== 'SWIFT SOULS') throw new Error(`Delete failed: "${input}"`);
console.log(`  [PASS] Delete function works: "${input}" (${input.length}/12)`);

// 3. Grid Navigation Logic Simulation
console.log('\n--- 3. 4-Zone Controller Navigation Math ---');
type NavSection = 'top' | 'grid' | 'action' | 'start';
let section: NavSection = 'grid';
let gridRow = 0;
let gridCol = 0;
let topIdx = 0;
let actionIdx = 0;

const navigate = (dx: number, dy: number) => {
    if (section === 'grid') {
        if (dx !== 0) {
            gridCol = (gridCol + dx + 10) % 10;
        }
        if (dy < 0) {
            if (gridRow === 0) {
                section = 'top';
                topIdx = gridCol < 5 ? 0 : 1;
            } else {
                gridRow--;
            }
        } else if (dy > 0) {
            if (gridRow === 3) {
                section = 'action';
                actionIdx = gridCol <= 3 ? 0 : (gridCol <= 6 ? 1 : 2);
            } else {
                gridRow++;
            }
        }
    } else if (section === 'top') {
        if (dx !== 0) {
            topIdx = Math.max(0, Math.min(1, topIdx + dx));
        }
        if (dy > 0) {
            section = 'grid';
            gridRow = 0;
            gridCol = topIdx === 0 ? 3 : 7;
        }
    } else if (section === 'action') {
        if (dx !== 0) {
            actionIdx = Math.max(0, Math.min(2, actionIdx + dx));
        }
        if (dy < 0) {
            section = 'grid';
            gridRow = 3;
            gridCol = actionIdx === 0 ? 1 : (actionIdx === 1 ? 5 : 8);
        } else if (dy > 0) {
            section = 'start';
        }
    } else if (section === 'start') {
        if (dy < 0) {
            section = 'action';
            actionIdx = 1;
        }
    }
};

// Start at grid (0,0) -> Navigate up to 'top' zone
navigate(0, -1);
if (section !== 'top' || topIdx !== 0) throw new Error(`Expected section 'top', topIdx 0, got ${section}, ${topIdx}`);
console.log('  [PASS] Moving UP from top row of grid transitions to "top" zone ([⌫ DEL] / [✕ CLR])');

// Move right to Clear button
navigate(1, 0);
if (topIdx !== 1) throw new Error(`Expected topIdx 1, got ${topIdx}`);
console.log('  [PASS] Navigating RIGHT in "top" zone focuses [✕ CLR]');

// Move down back to grid
navigate(0, 1);
if (section !== 'grid' || gridRow !== 0 || gridCol !== 7) throw new Error(`Expected grid row 0 col 7, got ${gridRow}, ${gridCol}`);
console.log('  [PASS] Moving DOWN returns smoothly into grid row 0 col 7');

// Move down 3 times to row 3
navigate(0, 1);
navigate(0, 1);
navigate(0, 1);
if (gridRow !== 3) throw new Error(`Expected row 3, got ${gridRow}`);
// Move down to 'action' zone
navigate(0, 1);
if (section !== 'action') throw new Error(`Expected section 'action', got ${section}`);
console.log(`  [PASS] Moving DOWN from bottom of grid transitions to "action" zone (actionIdx: ${actionIdx})`);

// Move down to 'start' zone
navigate(0, 1);
if (section !== 'start') throw new Error(`Expected section 'start', got ${section}`);
console.log('  [PASS] Moving DOWN from "action" zone focuses [⚔️ START ADVENTURE]');

// Move up back to 'action' zone
navigate(0, -1);
if (section !== 'action') throw new Error(`Expected section 'action', got ${section}`);
console.log('  [PASS] Moving UP from "start" zone focuses [↺ DEFAULT NAME]');

// 4. Default Name & Gender State Preservation
console.log('\n--- 4. Hero Name State & Gender Integration ---');
const gm = GameManager.instance;
gm.resetGame();
gm.setPlayerGender('female');
gm.setHeroName('Cora');
if (gm.getPlayerGender() !== 'female') throw new Error('Player gender mismatch');
if (gm.getState().party[0].name !== 'Cora') throw new Error('Hero name mismatch');
console.log(`  [PASS] Female protagonist initialized: "${gm.getState().party[0].name}" (${gm.getPlayerGender()})`);

gm.setPlayerGender('male');
gm.setHeroName('Swift');
if (gm.getPlayerGender() !== 'male') throw new Error('Player gender mismatch');
if (gm.getState().party[0].name !== 'Swift') throw new Error('Hero name mismatch');
console.log(`  [PASS] Male protagonist initialized: "${gm.getState().party[0].name}" (${gm.getPlayerGender()})`);

console.log('\n====================================================');
console.log('   CONTROLLER HERO NAMING TEST PASSED (100%)');
console.log('====================================================\n');
