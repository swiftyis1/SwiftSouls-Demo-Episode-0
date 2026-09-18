// Automated validation script for Sprint 16: Art Assets Swapping Pipeline & Synthesis Sound SFX
// Run with: node --experimental-strip-types tests/test_sprint16.ts

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

import { SoundSynth } from '../src/systems/SoundSynth.ts';
import { AssetPipeline } from '../src/systems/AssetPipeline.ts';
import { GameManager } from '../src/systems/GameManager.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        (globalThis as any).process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log('=== SPRINT 16: ART ASSETS SWAPPING PIPELINE & SYNTHESIS SOUND SFX VALIDATION ===\n');

// 1. AudioSettings & Volume Control
console.log('--- 1. Audio Settings & Persistence ---');
SoundSynth.setVolume(0.5);
assert(Math.abs(SoundSynth.getVolume() - 0.5) < 0.001, 'Volume can be set to 0.5');

SoundSynth.setVolume(1.5);
assert(SoundSynth.getVolume() === 1.0, 'Volume is capped at 1.0 maximum');

SoundSynth.setVolume(-0.5);
assert(SoundSynth.getVolume() === 0.0, 'Volume is clamped at 0.0 minimum');

SoundSynth.setVolume(0.85);
assert(Math.abs(SoundSynth.getVolume() - 0.85) < 0.001, 'Volume restored to 0.85');

// Test Mute
SoundSynth.setMuted(false);
assert(!SoundSynth.isMuted(), 'Sound is unmuted initially');
SoundSynth.toggleMute();
assert(SoundSynth.isMuted(), 'toggleMute() muted the audio');
SoundSynth.toggleMute();
assert(!SoundSynth.isMuted(), 'toggleMute() unmuted the audio');

// Check localStorage persistence
const savedAudioRaw = (globalThis as any).localStorage.getItem('swiftsouls_audio_settings');
assert(!!savedAudioRaw, 'Audio settings persisted in localStorage under "swiftsouls_audio_settings"');
const savedAudio = JSON.parse(savedAudioRaw);
assert(Math.abs(savedAudio.volume - 0.85) < 0.001, `Persisted volume is 0.85 (got ${savedAudio.volume})`);
assert(savedAudio.isMuted === false, 'Persisted mute state is false');

// 2. Procedural Sound Effect Synthesizers Execution in Headless Environment
console.log('\n--- 2. Procedural Web Audio Synthesizer Execution ---');
let audioExecutionPassed = true;
try {
    SoundSynth.playMenuBlip();
    SoundSynth.playMenuSelect();
    SoundSynth.playMenuCancel();
    SoundSynth.playAttackHit();
    SoundSynth.playCritHit();
    SoundSynth.playSpellCast('fire');
    SoundSynth.playSpellCast('heal');
    SoundSynth.playSpellCast('lightning');
    SoundSynth.playSpellCast('earth');
    SoundSynth.playVictory();
    SoundSynth.playBossRoar();
    SoundSynth.playAlarm();
    SoundSynth.playFlee();
    SoundSynth.playExplosion();
    SoundSynth.playWoosh();
} catch (err) {
    console.error('Audio synthesizer execution error:', err);
    audioExecutionPassed = false;
}
assert(audioExecutionPassed, 'All 10+ synthesized procedural sound effects execute cleanly without throwing');

// 3. Asset Pipeline Registry & Fallback Pipeline
console.log('\n--- 3. Asset Pipeline Registry & Fallback Pipeline ---');
const pipeline = AssetPipeline.getInstance();
assert(pipeline !== null, 'AssetPipeline singleton instance exists');

// Register test asset
let mockGeneratorRan = false;
pipeline.registerAsset(
    'test_custom_sprite',
    (_scene: any) => { mockGeneratorRan = true; },
    'assets/sprites/test.png',
    32,
    32
);

assert(pipeline.getAllRegisteredKeys().includes('test_custom_sprite'), 'Registered "test_custom_sprite" in AssetPipeline registry');
assert(pipeline.getAssetStatus('test_custom_sprite') === 'procedural', 'Default render mode is procedural');
assert(!pipeline.isExternalEnabled(), 'External asset mode is disabled by default');

// Execute generator
pipeline.generateAllProcedural({} as any);
assert(mockGeneratorRan, 'generateAllProcedural executed procedural canvas generator');

// Toggle external asset mode
pipeline.setUseExternalAssets(true);
assert(pipeline.isExternalEnabled(), 'External asset mode can be enabled');
assert(pipeline.getTextureKey('test_custom_sprite') === 'test_custom_sprite', 'Texture key remains base key until external file is marked complete');

// Simulate successful external load
const def = (pipeline as any).registry.get('test_custom_sprite');
if (def) def.status = 'external';
assert(pipeline.getTextureKey('test_custom_sprite') === 'test_custom_sprite_external', 'Texture key routes to external texture when loaded');

// Simulate fallback on load error
if (def) def.status = 'fallback';
assert(pipeline.getTextureKey('test_custom_sprite') === 'test_custom_sprite', 'Texture key falls back to procedural base key when external asset fails');

// Reset to procedural
pipeline.setUseExternalAssets(false);
assert(!pipeline.isExternalEnabled(), 'External asset mode can be disabled');
assert(pipeline.getAssetStatus('test_custom_sprite') === 'procedural', 'Asset status reverts to procedural');

// 4. Protagonist 8 Equipment Slots Integrity
console.log('\n--- 4. Protagonist 8 Equipment Slots Integrity ---');
const gm = GameManager.instance;
const state = gm.getState();
const requiredSlots = ['sword', 'shield', 'armor', 'helmet', 'ring1', 'ring2', 'amulet', 'earrings'];
const crystalKeys = Object.keys(state.equippedCrystals);
const forgeKeys = Object.keys(state.forgeRefinements);

assert(crystalKeys.length === 8, `Protagonist equippedCrystals has exactly 8 slots (found ${crystalKeys.length})`);
assert(forgeKeys.length === 8, `Protagonist forgeRefinements has exactly 8 slots (found ${forgeKeys.length})`);
for (const slot of requiredSlots) {
    assert(slot in state.equippedCrystals, `Required equipment slot '${slot}' exists in equippedCrystals`);
    assert(slot in state.forgeRefinements, `Required equipment slot '${slot}' exists in forgeRefinements`);
}

// 5. Save System Payload Size & Throttling
console.log('\n--- 5. Save System Payload Size & Throttling ---');
const saveString = JSON.stringify(state);
const saveBytes = Buffer.byteLength(saveString, 'utf8');
const saveKB = (saveBytes / 1024).toFixed(2);
console.log(`Save Payload Size: ${saveKB} KB (${saveBytes} bytes)`);
assert(saveBytes < 25000, `Save payload (${saveKB} KB) is well within the 25KB budget`);

// Throttle test: Call saveGame() 5 times rapidly
let savedCount = 0;
for (let i = 0; i < 5; i++) {
    if (gm.saveGame()) {
        savedCount++;
    }
}
assert(savedCount <= 3, `Save throttling active: At most 3 saves allowed in rapid burst (got ${savedCount})`);

console.log('\n🎉 ALL SPRINT 16 VALIDATIONS PASSED!');
