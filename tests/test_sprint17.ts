// Automated validation script for Sprint 17: Save File Cryptographic Checksum (Tamper-Proofing)
// Run with: node --experimental-strip-types tests/test_sprint17.ts

// Mock localStorage and window for headless Node environment
const storageMock: { [key: string]: string } = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); }
};
(globalThis as any).window = {
    localStorage: (globalThis as any).localStorage
};

import { CryptoChecksum } from '../src/systems/CryptoChecksum.ts';
import { GameManager, type SaveEnvelope } from '../src/systems/GameManager.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        (globalThis as any).process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log('=== SPRINT 17: SAVE FILE CRYPTOGRAPHIC CHECKSUM VALIDATION ===\n');

// 1. Cryptographic Primitives & NIST Vectors
console.log('--- 1. Cryptographic Primitives & Standard Test Vectors ---');
const emptySha = CryptoChecksum.sha256('');
assert(emptySha === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'SHA-256 empty string matches NIST standard vector');

const abcSha = CryptoChecksum.sha256('abc');
assert(abcSha === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 "abc" matches NIST standard vector');

const hmacVector = CryptoChecksum.hmacSha256('key', 'The quick brown fox jumps over the lazy dog');
assert(hmacVector === 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8', 'HMAC-SHA256 test matches RFC 2104 standard vector');

assert(!CryptoChecksum.verifySignature(1, 1000, 'test', 'invalid_hex'), 'verifySignature cleanly rejects malformed short signature');
assert(!CryptoChecksum.verifySignature(1, 1000, 'test', '0'.repeat(63)), 'verifySignature rejects non-64 char signature');

// 2. Signature Uniqueness & Avalanche Effect
console.log('\n--- 2. Signature Uniqueness & Avalanche Effect ---');
const payloadA = JSON.stringify({ hp: 15, fragments: 10 });
const payloadB = JSON.stringify({ hp: 16, fragments: 10 }); // 1 character difference
const sigA = CryptoChecksum.signSavePayload(1, 1000000, payloadA);
const sigB = CryptoChecksum.signSavePayload(1, 1000000, payloadB);
assert(sigA !== sigB, 'Avalanche effect: 1-character difference produces totally distinct signatures');

// Slot isolation
const sigSlot1 = CryptoChecksum.signSavePayload(1, 1000000, payloadA);
const sigSlot2 = CryptoChecksum.signSavePayload(2, 1000000, payloadA);
assert(sigSlot1 !== sigSlot2, 'Slot isolation: Same payload on Slot 1 vs Slot 2 produces completely different signatures');

// Timestamp isolation
const sigTime1 = CryptoChecksum.signSavePayload(1, 1000000, payloadA);
const sigTime2 = CryptoChecksum.signSavePayload(1, 1000001, payloadA);
assert(sigTime1 !== sigTime2, 'Timestamp isolation: Modifying timestamp changes signature');

// 3. Save Game & Version 2 Envelope Generation
console.log('\n--- 3. Save System & Version 2 Envelope Generation ---');
const gm = GameManager.instance;
gm.resetGame();
gm.setCurrentSaveSlot(1);
const saveResult = gm.saveGame();
assert(saveResult === true, 'saveGame() executes successfully and returns true');

const rawStored = (globalThis as any).localStorage.getItem('swiftsouls_save_1');
assert(!!rawStored, 'swiftsouls_save_1 exists in storage');

const envelope: SaveEnvelope = JSON.parse(rawStored);
assert(envelope.version === 2, 'Save envelope version is 2');
assert(envelope.slot === 1, 'Save envelope slot is 1');
assert(typeof envelope.timestamp === 'number' && envelope.timestamp > 0, 'Save envelope contains valid timestamp');
assert(typeof envelope.signature === 'string' && envelope.signature.length === 64, 'Save envelope contains valid 64-char hex signature');
assert(typeof envelope.payload === 'string', 'Save envelope contains serialized payload string');

// Untampered preview & load
const preview1 = gm.getSlotPreview(1);
assert(!!preview1 && preview1.isTampered === false, 'getSlotPreview(1) validates clean signature with isTampered=false');
assert(preview1?.name === 'Swift', `Preview name is Swift (got ${preview1?.name})`);

const loadClean = gm.loadGame(1);
assert(loadClean === true, 'loadGame(1) succeeds on untampered save');

// 4. Tamper Detection & Security Rejection
console.log('\n--- 4. Tamper Detection & Security Rejection ---');

// Attack 4.1: Direct modification of hero HP in storage
console.log('Testing Attack 4.1: Modified HP payload tampering');
const tamperedPayloadHp = envelope.payload.replace(/"hp":\d+/, '"hp":9999');
const tamperedEnvelopeHp: SaveEnvelope = {
    ...envelope,
    payload: tamperedPayloadHp
};
(globalThis as any).localStorage.setItem('swiftsouls_save_1', JSON.stringify(tamperedEnvelopeHp));

const previewTamperedHp = gm.getSlotPreview(1);
assert(previewTamperedHp?.isTampered === true, 'getSlotPreview(1) flags isTampered=true for altered HP payload');
assert(previewTamperedHp?.name === 'TAMPERED', 'Preview displays TAMPERED for altered HP payload');

const loadTamperedHp = gm.loadGame(1);
assert(loadTamperedHp === false, 'loadGame(1) strictly REJECTS tampered HP payload');

// Attack 4.2: Direct modification of Soul Crystal fragments
console.log('Testing Attack 4.2: Modified soul fragments tampering');
const tamperedPayloadFrag = envelope.payload.replace('"slime":{"fragments":0', '"slime":{"fragments":255');
const tamperedEnvelopeFrag: SaveEnvelope = {
    ...envelope,
    payload: tamperedPayloadFrag
};
(globalThis as any).localStorage.setItem('swiftsouls_save_1', JSON.stringify(tamperedEnvelopeFrag));

const previewTamperedFrag = gm.getSlotPreview(1);
assert(previewTamperedFrag?.isTampered === true, 'getSlotPreview(1) flags isTampered=true for altered fragment count');
const loadTamperedFrag = gm.loadGame(1);
assert(loadTamperedFrag === false, 'loadGame(1) strictly REJECTS tampered fragment payload');

// Attack 4.3: Cross-slot replay attack (copy slot 1 save into slot 2)
console.log('Testing Attack 4.3: Cross-slot replay attack');
(globalThis as any).localStorage.setItem('swiftsouls_save_2', JSON.stringify(envelope)); // Has slot: 1 inside envelope

const previewReplay = gm.getSlotPreview(2);
assert(previewReplay?.isTampered === true, 'getSlotPreview(2) detects slot mismatch and flags isTampered=true');
const loadReplay = gm.loadGame(2);
assert(loadReplay === false, 'loadGame(2) strictly REJECTS cross-slot replay attack');

// Attack 4.4: Forged random signature
console.log('Testing Attack 4.4: Forged signature tampering');
const forgedEnvelope: SaveEnvelope = {
    ...envelope,
    signature: 'a'.repeat(64)
};
(globalThis as any).localStorage.setItem('swiftsouls_save_1', JSON.stringify(forgedEnvelope));
assert(gm.loadGame(1) === false, 'loadGame(1) strictly REJECTS forged signature');

// 5. Legacy Save Migration (Sprint 1-16)
console.log('\n--- 5. Legacy Save Migration (Sprint 1-16 Format) ---');
// Construct raw un-enveloped legacy state (Sprint 1-16 format)
const legacyRawState = {
    party: [
        {
            name: 'LegacyHero',
            level: 3,
            hp: 45,
            maxHp: 45,
            sp: 20,
            maxSp: 20,
            strength: 15,
            defense: 10,
            agility: 12
        }
    ],
    inventory: [{ itemId: 'potion_hp', quantity: 5 }],
    quests: { dungeon_gate_unlocked: 'completed' },
    currentScene: 'OverworldScene',
    currentMapId: 'town_oakhaven',
    spawnPoint: { x: 320, y: 400 },
    soulCrystals: {
        goblin: { fragments: 50, isExtinct: false },
        snake: { fragments: 30, isExtinct: false },
        slime: { fragments: 20, isExtinct: false },
        bat: { fragments: 10, isExtinct: false },
        skeleton: { fragments: 5, isExtinct: false },
        phoenix: { fragments: 0, isExtinct: false }
    },
    equippedCrystals: {
        sword: 'goblin',
        shield: 'snake',
        armor: null,
        helmet: null,
        ring1: null,
        ring2: null,
        amulet: null
    },
    forgeRefinements: {
        sword: 2,
        shield: 1,
        armor: 0,
        helmet: 0,
        ring1: 0,
        ring2: 0,
        amulet: 0
    },
    bossMelds: []
};

// Store raw legacy state in slot 4
(globalThis as any).localStorage.setItem('swiftsouls_save_4', JSON.stringify(legacyRawState));

const legacyPreview = gm.getSlotPreview(4);
assert(!!legacyPreview && legacyPreview.isLegacy === true, 'getSlotPreview(4) detects legacy save and flags isLegacy=true');
assert(legacyPreview?.name === 'LegacyHero', 'Preview correctly displays LegacyHero');
assert(legacyPreview?.isTampered !== true, 'Legacy save is not flagged as tampered');

// Load legacy save
const legacyLoadResult = gm.loadGame(4);
assert(legacyLoadResult === true, 'loadGame(4) successfully loads legacy save');
assert(gm.getState().party[0].name === 'LegacyHero', 'Hero state correctly restored from legacy save');

// Verify that loading automatically upgraded slot 4 to a signed Version 2 envelope
const upgradedRaw = (globalThis as any).localStorage.getItem('swiftsouls_save_4');
assert(!!upgradedRaw, 'Upgraded save exists in storage');
const upgradedEnvelope: SaveEnvelope = JSON.parse(upgradedRaw);
assert(upgradedEnvelope.version === 2, 'Legacy save was transparently upgraded to Version 2');
assert(typeof upgradedEnvelope.signature === 'string' && upgradedEnvelope.signature.length === 64, 'Upgraded save contains valid 64-char HMAC signature');

const isUpgradedValid = CryptoChecksum.verifySignature(4, upgradedEnvelope.timestamp, upgradedEnvelope.payload, upgradedEnvelope.signature);
assert(isUpgradedValid === true, 'Cryptographic signature of upgraded save validates as 100% authentic');

// 6. Export & Import Cryptographic Tamper-Proofing
console.log('\n--- 6. Export & Import Cryptographic Tamper-Proofing ---');
(gm as any).saveTimestamps = [];
const exported = gm.exportSavePayload();
assert(typeof exported === 'string', 'exportSavePayload() returns signed string payload');
const parsedExport: SaveEnvelope = JSON.parse(exported!);
assert(parsedExport.version === 2, 'Exported payload is a valid Version 2 envelope');

// Import into slot 5
const importSuccess = gm.importSavePayload(exported!, 5);
assert(importSuccess.success === true, 'importSavePayload into slot 5 succeeds with valid signature');

const previewSlot5 = gm.getSlotPreview(5);
assert(!!previewSlot5 && previewSlot5.isTampered === false, 'Slot 5 preview validates clean after import');

// Import tampered string into slot 6
const tamperedExport = exported!.replace('party', 'tampered_party');
const importTampered = gm.importSavePayload(tamperedExport, 6);
assert(importTampered.success === false, 'importSavePayload strictly REJECTS tampered import string');

// 7. Protagonist 8 Equipment Slots & Payload Budget
console.log('\n--- 7. Protagonist 8 Equipment Slots & Payload Budget ---');
const state = gm.getState();
const requiredSlots = ['sword', 'shield', 'armor', 'helmet', 'ring1', 'ring2', 'amulet', 'earrings'];
const crystalKeys = Object.keys(state.equippedCrystals);
const forgeKeys = Object.keys(state.forgeRefinements);

assert(crystalKeys.length === 8, `Protagonist equippedCrystals has exactly 8 slots (found ${crystalKeys.length})`);
assert(forgeKeys.length === 8, `Protagonist forgeRefinements has exactly 8 slots (found ${forgeKeys.length})`);
for (const slot of requiredSlots) {
    assert(slot in state.equippedCrystals, `Required slot '${slot}' in equippedCrystals`);
    assert(slot in state.forgeRefinements, `Required slot '${slot}' in forgeRefinements`);
}

const envelopeSize = Buffer.byteLength(upgradedRaw, 'utf8');
const envelopeKB = (envelopeSize / 1024).toFixed(2);
console.log(`Signed SaveEnvelope Size: ${envelopeKB} KB (${envelopeSize} bytes)`);
assert(envelopeSize < 25000, `Envelope size (${envelopeKB} KB) is well within 25KB budget`);
assert(envelopeSize < 5 * 1024 * 1024, 'Envelope size is well under 5MB hard limit');

// Throttle test
let saveAttemptCount = 0;
for (let i = 0; i < 5; i++) {
    if (gm.saveGame()) {
        saveAttemptCount++;
    }
}
assert(saveAttemptCount <= 3, `Save throttling active: At most 3 saves allowed per second (got ${saveAttemptCount})`);

console.log('\n🎉 ALL SPRINT 17 VALIDATIONS PASSED!');
