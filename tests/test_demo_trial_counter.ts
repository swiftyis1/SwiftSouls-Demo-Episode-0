import { GameManager } from '../src/systems/GameManager.ts';
import fs from 'fs';
import path from 'path';

// Mock localStorage for test environment
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => { mockStorage[key] = value; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

let postMessagePayload: any = null;
(globalThis as any).window = {
    parent: {
        postMessage: (data: any) => { postMessagePayload = data; }
    }
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
    if (condition) {
        console.log(`  [PASS] ${msg}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${msg}`);
        failed++;
    }
}

console.log('====================================================');
console.log('   RUNNING 5-MINUTE DEMO TRIAL & COUNTER TEST SUITE');
console.log('====================================================\n');

// -------------------------------------------------------------
// 1. Time Tracking & 5-Minute Invariant
// -------------------------------------------------------------
console.log('--- 1. Time Tracking & 5-Minute Invariant ---');
const gm = GameManager.instance;
gm.resetGame();

assert(gm.getTimePlayedSeconds() === 0, 'Initial playtime starts at 0 seconds');

// Play for 100 seconds
gm.updateTimePlayed(100);
assert(gm.getTimePlayedSeconds() === 100, 'Playtime advances to 100 seconds');
assert(mockStorage[GameManager.DEMO_TRIAL_5MIN_STORAGE_KEY] === undefined, 'Trial is NOT reported at 100 seconds (< 300s / 5 mins)');

// Play for 199 seconds (total 299s)
gm.updateTimePlayed(199);
assert(gm.getTimePlayedSeconds() === 299, 'Playtime advances to 299 seconds');
assert(mockStorage[GameManager.DEMO_TRIAL_5MIN_STORAGE_KEY] === undefined, 'Trial is NOT reported at 299 seconds (under 5 mins)');

// Advance past 300 seconds (5 minutes milestone)
gm.updateTimePlayed(2); // total 301s
assert(gm.getTimePlayedSeconds() === 301, 'Playtime reaches 301 seconds (5+ minutes)');
assert(mockStorage[GameManager.DEMO_TRIAL_5MIN_STORAGE_KEY] === 'true', 'Trial completion flag is stored in localStorage at 5 minutes');
assert(postMessagePayload !== null && postMessagePayload.type === 'SWIFTSOULS_DEMO_5MIN_TRIAL', 'Iframe postMessage SWIFTSOULS_DEMO_5MIN_TRIAL dispatched to parent window');

// Reset postMessage payload and advance time further to verify NO double reporting
postMessagePayload = null;
gm.updateTimePlayed(60);
assert(gm.getTimePlayedSeconds() === 361, 'Playtime advances to 361 seconds');
assert(postMessagePayload === null, 'Trial completion is NOT double-reported after reaching 5 minutes');

// -------------------------------------------------------------
// 2. Demo Stats Persistence & JSON Structure
// -------------------------------------------------------------
console.log('\n--- 2. Demo Stats File & API Invariant ---');
const projectRoot = path.resolve(process.cwd(), '..');
const demoStatsPath = path.resolve(projectRoot, 'website/demo_stats.json');
assert(fs.existsSync(demoStatsPath), 'website/demo_stats.json exists');

const statsContent = JSON.parse(fs.readFileSync(demoStatsPath, 'utf-8'));
assert(typeof statsContent.totalPlayersTried === 'number', 'totalPlayersTried is a valid number');
assert(statsContent.totalPlayersTried >= 0, `totalPlayersTried is non-negative (${statsContent.totalPlayersTried})`);
assert(Array.isArray(statsContent.recentTrials), 'recentTrials is an array');

// -------------------------------------------------------------
// 3. Demo Release Metadata & Snapshot Isolation
// -------------------------------------------------------------
console.log('\n--- 3. Demo Release Metadata & Snapshot Isolation ---');
const metaPath = path.resolve(projectRoot, 'DEMO_RELEASE_METADATA.md');
assert(fs.existsSync(metaPath), 'DEMO_RELEASE_METADATA.md exists in root workspace');

const snapshotDir = path.resolve(projectRoot, 'snapshots/Sprint28_Prototype_Demo_2026-09-11');
assert(fs.existsSync(snapshotDir), 'Snapshot directory exists for Sprint 28 demo clone');
assert(fs.existsSync(path.join(snapshotDir, 'phaser-game')), 'Snapshot contains phaser-game clone');
assert(fs.existsSync(path.join(snapshotDir, 'website')), 'Snapshot contains website clone');
assert(fs.existsSync(path.join(snapshotDir, 'DEMO_RELEASE_METADATA.md')), 'Snapshot contains DEMO_RELEASE_METADATA.md');

// -------------------------------------------------------------
// 4. Website Play Bundle Verification
// -------------------------------------------------------------
console.log('\n--- 4. Website Play Bundle Verification ---');
const websitePlayHtml = path.resolve(projectRoot, 'website/play/index.html');
assert(fs.existsSync(websitePlayHtml), 'website/play/index.html exists');
const playHtmlContent = fs.readFileSync(websitePlayHtml, 'utf-8');
assert(playHtmlContent.includes('src="./assets/index-'), 'website/play/index.html links to relative production bundle');

console.log('\n====================================================');
console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
    process.exit(1);
}
