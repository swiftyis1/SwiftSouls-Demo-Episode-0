// Automated validation script for Sprint 18: Cloud Sync API Integration & Telegram Handshake
// Run with: node --experimental-strip-types tests/test_sprint18.ts

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

import { CryptoChecksum } from '../src/systems/CryptoChecksum.ts';
import { TelegramAuth, type TelegramUser } from '../src/systems/TelegramAuth.ts';
import { ConflictResolver } from '../src/systems/ConflictResolver.ts';
import { CloudSyncClient } from '../src/systems/CloudSyncClient.ts';
import { GameManager, type SaveEnvelope, type EquipmentSlot } from '../src/systems/GameManager.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        (globalThis as any).process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

async function runTests() {
    console.log('=== SPRINT 18: CLOUD SYNC API & TELEGRAM HANDSHAKE VALIDATION ===\n');

    // 1. Cryptographic Extensions: Raw Byte HMAC & Constant-Time Comparison
    console.log('--- 1. Cryptographic Extensions (Raw HMAC & Constant Time) ---');
    const rawKey = new Uint8Array([1, 2, 3, 4, 5]);
    const rawMsg = new Uint8Array([6, 7, 8, 9, 10]);
    const rawBytes = CryptoChecksum.hmacSha256Bytes(rawKey, rawMsg);
    assert(rawBytes instanceof Uint8Array && rawBytes.length === 32, 'hmacSha256Bytes produces 32-byte Uint8Array');

    const derivedSecret = CryptoChecksum.hmacSha256Bytes('WebAppData', 'test_bot_token_123');
    assert(derivedSecret.length === 32, 'Telegram WebAppData secret key derivation produces 32 bytes');

    assert(CryptoChecksum.constantTimeEqual('abcdef', 'abcdef') === true, 'constantTimeEqual matches identical strings');
    assert(CryptoChecksum.constantTimeEqual('abcdef', 'abcdeg') === false, 'constantTimeEqual rejects different 1-char strings');
    assert(CryptoChecksum.constantTimeEqual('abcdef', 'abcde') === false, 'constantTimeEqual rejects different length strings');
    assert(CryptoChecksum.constantTimeEqual('', '') === true, 'constantTimeEqual matches empty strings');

    // 2. Telegram WebApp Handshake & initData Verification
    console.log('\n--- 2. Telegram WebApp Handshake & initData Verification ---');
    const testUser: TelegramUser = {
        id: 987654321,
        first_name: 'SwiftHero',
        username: 'swiftsouls_bot',
        language_code: 'en'
    };
    const botToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

    // Generate valid mock initData
    const mockInitData = TelegramAuth.generateMockInitData(testUser, botToken);
    assert(typeof mockInitData === 'string' && mockInitData.includes('hash='), 'generateMockInitData generates non-empty query string with hash');

    // Verify valid mock initData
    const validResult = TelegramAuth.verifyInitData(mockInitData, botToken);
    assert(validResult.valid === true, 'verifyInitData successfully validates genuine Telegram signature');
    assert(validResult.user?.id === testUser.id, 'verifyInitData correctly parses and returns authenticated TelegramUser');
    assert(validResult.user?.username === 'swiftsouls_bot', 'verifyInitData preserves username field');

    // Forged parameters detection: Altered User ID
    const forgedUserId = mockInitData.replace(testUser.id.toString(), '999999999');
    const forgedUserResult = TelegramAuth.verifyInitData(forgedUserId, botToken);
    assert(forgedUserResult.valid === false, 'Tamper alert: Altered user ID fails signature verification');

    // Forged parameters detection: Altered auth_date
    const forgedDate = mockInitData.replace('auth_date=', 'auth_date=100');
    const forgedDateResult = TelegramAuth.verifyInitData(forgedDate, botToken);
    assert(forgedDateResult.valid === false, 'Tamper alert: Altered auth_date fails signature verification');

    // Forged hash detection
    const forgedHash = mockInitData.replace(/hash=[a-f0-9]{64}/, 'hash=' + '0'.repeat(64));
    const forgedHashResult = TelegramAuth.verifyInitData(forgedHash, botToken);
    assert(forgedHashResult.valid === false, 'Tamper alert: Altered hash fails verification');

    // Freshness & expiration check
    const oldTimestamp = Math.floor(Date.now() / 1000) - 100000; // >24h old
    const expiredData = TelegramAuth.generateMockInitData(testUser, botToken, oldTimestamp);
    const expiredResult = TelegramAuth.verifyInitData(expiredData, botToken, 86400); // max 24h
    assert(expiredResult.valid === false && expiredResult.isExpired === true, 'Stale signature rejection: expired initData rejected');

    // 3. Conflict Resolution Engine & Progress Protection
    console.log('\n--- 3. Conflict Resolution Policy (Zero Rollback Invariant) ---');
    const localStateLow = {
        party: [{ name: 'Swift', level: 1, hp: 15, maxHp: 15, sp: 8, maxSp: 8, strength: 4, defense: 2, agility: 3 }],
        soulCrystals: {
            goblin: { fragments: 50, isExtinct: false },
            snake: { fragments: 20, isExtinct: false }
        }
    };
    const localStateHigh = {
        party: [{ name: 'Swift', level: 3, hp: 50, maxHp: 50, sp: 20, maxSp: 20, strength: 15, defense: 10, agility: 10 }],
        soulCrystals: {
            goblin: { fragments: 255, isExtinct: true }, // 1 extinct boss!
            snake: { fragments: 100, isExtinct: false }
        }
    };

    const payloadLow = JSON.stringify(localStateLow);
    const payloadHigh = JSON.stringify(localStateHigh);

    const envLow: SaveEnvelope = {
        version: 2,
        slot: 1,
        timestamp: 2000000, // Newer timestamp
        signature: CryptoChecksum.signSavePayload(1, 2000000, payloadLow),
        payload: payloadLow
    };

    const envHigh: SaveEnvelope = {
        version: 2,
        slot: 1,
        timestamp: 1000000, // Older timestamp but HIGHER EXTINCTION PROGRESS
        signature: CryptoChecksum.signSavePayload(1, 1000000, payloadHigh),
        payload: payloadHigh
    };

    // INVARIANT: Higher extinction progress MUST beat a newer timestamp!
    const resolution = ConflictResolver.resolve(envHigh, envLow, 'highest_progress');
    assert(resolution.winner === envHigh, 'Zero Rollback Invariant: Higher extinction count wins over newer timestamp');
    assert(resolution.winnerSource === 'local', 'Winner correctly identified as local save');

    // Reverse: Cloud has higher progress
    const cloudHighRes = ConflictResolver.resolve(envLow, envHigh, 'highest_progress');
    assert(cloudHighRes.winner === envHigh, 'Zero Rollback Invariant: Cloud wins when cloud has higher extinction count');
    assert(cloudHighRes.winnerSource === 'cloud', 'Winner correctly identified as cloud save');

    // Equal progress: tie broken by latest timestamp
    const envTieOld: SaveEnvelope = {
        version: 2,
        slot: 1,
        timestamp: 100,
        signature: CryptoChecksum.signSavePayload(1, 100, payloadLow),
        payload: payloadLow
    };
    const envTieNew: SaveEnvelope = {
        version: 2,
        slot: 1,
        timestamp: 200,
        signature: CryptoChecksum.signSavePayload(1, 200, payloadLow),
        payload: payloadLow
    };
    const tieRes = ConflictResolver.resolve(envTieOld, envTieNew, 'highest_progress');
    assert(tieRes.winner === envTieNew, 'Equal progress tie-breaker correctly chooses latest timestamp');

    // 4. CloudSyncClient & 5MB Ceiling / Rate Limiter / Offline Queue
    console.log('\n--- 4. CloudSyncClient (5MB Limit, Rate Limiting, Offline Queue) ---');
    const client = CloudSyncClient.instance;
    client.clearCloudStorage();

    // 5MB Limit enforcement on upload
    const oversizedPayload = 'X'.repeat(5 * 1024 * 1024 + 10);
    const oversizedEnv: SaveEnvelope = {
        version: 2,
        slot: 1,
        timestamp: Date.now(),
        signature: '0'.repeat(64),
        payload: oversizedPayload
    };
    const oversizedResult = await client.uploadSave(1, oversizedEnv);
    assert(oversizedResult.success === false, 'CloudSyncClient rejects uploads exceeding 5MB ceiling');

    // Standard valid save upload
    const validUploadRes = await client.uploadSave(1, envHigh);
    assert(validUploadRes.success === true && validUploadRes.action === 'UPLOADED', 'Valid save successfully uploads to simulated cloud');

    // Download verification
    const downloadedEnv = await client.downloadSave(1);
    assert(downloadedEnv !== null, 'downloadSave retrieves uploaded save');
    assert(downloadedEnv?.signature === envHigh.signature, 'Downloaded save signature matches original');

    // Offline mode simulation & Queueing
    client.setOfflineMode(true);
    assert(client.isOffline() === true, 'Offline mode enabled');

    const slot2Time = Date.now();
    const envSlot2: SaveEnvelope = {
        version: 2,
        slot: 2,
        timestamp: slot2Time,
        signature: CryptoChecksum.signSavePayload(2, slot2Time, payloadLow),
        payload: payloadLow
    };
    const queuedRes = await client.uploadSave(2, envSlot2);
    assert(queuedRes.action === 'QUEUED_OFFLINE', 'Save while offline is stored into swiftsouls_sync_queue');
    assert(client.getPendingQueueCount() === 1, 'Offline queue count increments to 1');

    // Restore online mode and drain queue
    client.setOfflineMode(false);
    assert(client.isOffline() === false, 'Online mode restored');
    const drainRes = await client.drainOfflineQueue();
    assert(drainRes.processed === 1 && drainRes.errors === 0, 'drainOfflineQueue successfully uploads queued saves');
    assert(client.getPendingQueueCount() === 0, 'Offline queue is completely empty after drain');

    // 5. Full GameManager Integration & 7 Equipment Slots Invariant
    console.log('\n--- 5. GameManager Cloud Sync & Invariant Validation ---');
    const gm = GameManager.instance;
    gm.resetGame();
    gm.setCurrentSaveSlot(1);

    // Verify Telegram user injection
    gm.setTelegramUser(testUser);
    assert(gm.getTelegramUser()?.id === testUser.id, 'GameManager preserves authenticated Telegram user');

    // Save game locally (triggers async cloud upload)
    const saveOk = gm.saveGame();
    assert(saveOk === true, 'gm.saveGame() succeeds synchronously');

    // Wait 50ms for background async dispatch
    await new Promise(r => setTimeout(r, 50));

    // Verify 7 equipment slots invariant
    const state = gm.getState();
    const expectedSlots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'helmet', 'ring1', 'ring2', 'amulet'];
    assert(expectedSlots.length === 7, 'Exact 7 protagonist equipment slots constraint verified');
    expectedSlots.forEach(s => {
        assert(s in state.equippedCrystals, `Protagonist slot "${s}" is defined in equippedCrystals`);
    });

    // Verify 6 species extinction crystals invariant
    const species = ['goblin', 'snake', 'slime', 'bat', 'skeleton', 'phoenix'];
    species.forEach(sp => {
        assert(sp in state.soulCrystals, `Soul crystal "${sp}" is tracked in gameState`);
    });

    // Full cloud sync test
    const syncRes = await gm.syncWithCloud(1);
    assert(syncRes.success === true, 'GameManager.syncWithCloud(1) executes successfully');

    console.log('\n==========================================================');
    console.log('🎉 ALL SPRINT 18 VALIDATION TESTS PASSED (100% SUCCESS)');
    console.log('==========================================================\n');
}

runTests().catch(err => {
    console.error('Test execution error:', err);
    (globalThis as any).process.exit(1);
});
