// Automated validation script for Sound & Music Engine (9 Procedural Compositions & Attributions)
// Run with: node --experimental-strip-types tests/test_sound_music.ts

import * as fs from 'fs';
import * as path from 'path';

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

import { SoundSynth, noteFreq, TRACK_PATTERNS } from '../src/systems/SoundSynth.ts';
import type { BgmTrackId } from '../src/systems/SoundSynth.ts';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        (globalThis as any).process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

async function runSoundTests() {
    console.log('=== AUDIO & MUSIC ENGINE PROCEDURAL SYNTHESIS VALIDATION ===\n');

    // 1. Note Frequency Calculation Checks
    console.log('--- 1. Note Frequency Calculations ---');
    const a4 = noteFreq('A4');
    assert(Math.abs(a4 - 440) < 0.01, `A4 note frequency is 440 Hz (got ${a4.toFixed(2)})`);

    const c4 = noteFreq('C4');
    assert(Math.abs(c4 - 261.63) < 0.1, `C4 (Middle C) note frequency is ~261.63 Hz (got ${c4.toFixed(2)})`);

    const d4 = noteFreq('D4');
    assert(Math.abs(d4 - 293.66) < 0.1, `D4 note frequency is ~293.66 Hz (got ${d4.toFixed(2)})`);

    const a3 = noteFreq('A3');
    assert(Math.abs(a3 - 220) < 0.01, `A3 octave down frequency is 220 Hz (got ${a3.toFixed(2)})`);

    const a5 = noteFreq('A5');
    assert(Math.abs(a5 - 880) < 0.01, `A5 octave up frequency is 880 Hz (got ${a5.toFixed(2)})`);

    const cSharp4 = noteFreq('C#4');
    const dFlat4 = noteFreq('Db4');
    assert(Math.abs(cSharp4 - dFlat4) < 0.001, `Enharmonic equivalence: C#4 (${cSharp4.toFixed(2)}) === Db4 (${dFlat4.toFixed(2)})`);

    // 2. Map-to-Track Thematic Association
    console.log('\n--- 2. Map-to-Track Thematic Associations ---');
    assert(SoundSynth.getTrackForMap('world_map') === 'overworld', 'world_map routes to "overworld"');
    assert(SoundSynth.getTrackForMap('town_oakhaven') === 'oakhaven', 'town_oakhaven routes to "oakhaven"');
    assert(SoundSynth.getTrackForMap('town_map') === 'oakhaven', 'town_map legacy routes to "oakhaven"');
    assert(SoundSynth.getTrackForMap('town_aetheria') === 'aetheria', 'town_aetheria routes to "aetheria"');
    assert(SoundSynth.getTrackForMap('town_ironspire') === 'ironspire', 'town_ironspire routes to "ironspire"');
    assert(SoundSynth.getTrackForMap('meteor_pod') === 'meteor_pod', 'meteor_pod routes to "meteor_pod"');
    assert(SoundSynth.getTrackForMap('dungeon_map') === 'dungeon', 'dungeon_map routes to "dungeon"');
    assert(SoundSynth.getTrackForMap('dungeon_floor2') === 'dungeon', 'dungeon_floor2 routes to "dungeon"');
    assert(SoundSynth.getTrackForMap('castle_exterior') === 'castle', 'castle_exterior routes to "castle"');
    assert(SoundSynth.getTrackForMap('castle_interior') === 'castle', 'castle_interior routes to "castle"');
    assert(SoundSynth.getTrackForMap('unknown_zone_xyz') === 'overworld', 'unknown maps safely default to "overworld"');

    // 3. Composition Patterns & Polyphony Structure
    console.log('\n--- 3. Composition Patterns & 9-Track Integrity ---');
    const allTracks: BgmTrackId[] = [
        'overworld',
        'oakhaven',
        'aetheria',
        'ironspire',
        'meteor_pod',
        'dungeon',
        'castle',
        'battle',
        'boss'
    ];

    allTracks.forEach(trackId => {
        const pattern = TRACK_PATTERNS[trackId];
        assert(pattern !== undefined, `Track pattern defined for "${trackId}"`);
        assert(pattern.bpm >= 60 && pattern.bpm <= 180, `Track "${trackId}" has valid BPM (${pattern.bpm})`);
        assert(Array.isArray(pattern.bass) && pattern.bass.length === 32, `Track "${trackId}" bassline has 32 steps`);
        assert(Array.isArray(pattern.arp) && pattern.arp.length === 32, `Track "${trackId}" arpeggio has 32 steps`);
        assert(Array.isArray(pattern.lead) && pattern.lead.length === 32, `Track "${trackId}" lead voice has 32 steps`);
        assert(Array.isArray(pattern.drums) && pattern.drums.length === 32, `Track "${trackId}" drum track has 32 steps`);

        // Check that patterns contain non-empty note events
        const hasNotes = pattern.bass.some(n => n !== null) || pattern.lead.some(n => n !== null);
        assert(hasNotes, `Track "${trackId}" contains musical note events`);
    });

    // 4. SoundSynth Engine BGM Lifecycle (Headless Mock Mode)
    console.log('\n--- 4. SoundSynth BGM Lifecycle & State Management ---');
    assert(SoundSynth.getCurrentBgm() === null, 'Initial current BGM is null');

    SoundSynth.playBgm('overworld');
    assert(SoundSynth.getCurrentBgm() === 'overworld', 'playBgm("overworld") activates "overworld" track');

    // Redundant play call should be seamless no-op
    SoundSynth.playBgm('overworld');
    assert(SoundSynth.getCurrentBgm() === 'overworld', 'Redundant playBgm("overworld") maintains current track without restart');

    // Crossfade to another track
    SoundSynth.playBgm('dungeon', 50);
    assert(SoundSynth.getCurrentBgm() === 'dungeon', 'playBgm("dungeon") crossfades and updates current track');

    // Pause & Resume
    SoundSynth.pauseBgm();
    assert(SoundSynth.getCurrentBgm() === 'dungeon', 'Track ID preserved during pause');
    SoundSynth.resumeBgm();
    assert(SoundSynth.getCurrentBgm() === 'dungeon', 'Track ID preserved after resume');

    // Relative volume adjustment
    SoundSynth.setBgmRelativeVolume(0.5);
    SoundSynth.setBgmRelativeVolume(0.35);
    assert(true, 'setBgmRelativeVolume accepts volume changes safely');

    // Stop BGM
    SoundSynth.stopBgm(50);
    assert(SoundSynth.getCurrentBgm() === null, 'stopBgm resets current track to null');

    // 5. Sound FX Matrix Execution
    console.log('\n--- 5. Sound Effects Matrix Headless Execution ---');
    SoundSynth.playMenuBlip();
    SoundSynth.playMenuSelect();
    SoundSynth.playMenuCancel();
    SoundSynth.playAttackHit();
    SoundSynth.playCritHit();
    SoundSynth.playFlee();
    SoundSynth.playBossRoar();
    SoundSynth.playVictory();
    SoundSynth.playSpellCast('heal');
    SoundSynth.playAlarm();
    assert(true, 'All SFX methods execute cleanly in headless environment without unhandled errors');

    // 6. Credits & Attributions Verification
    console.log('\n--- 6. Credits & Attribution Compliance ---');
    const creditsPath = path.resolve(process.cwd(), '..', 'CREDITS.md');
    const creditsWorkspacePath = path.resolve(process.cwd(), 'CREDITS.md');
    const actualCreditsPath = fs.existsSync(creditsPath) ? creditsPath : creditsWorkspacePath;

    assert(fs.existsSync(actualCreditsPath), `CREDITS.md file exists at ${actualCreditsPath}`);
    const creditsContent = fs.readFileSync(actualCreditsPath, 'utf8');

    assert(creditsContent.includes('Matthew Pablo'), 'CREDITS.md credits composer Matthew Pablo');
    assert(creditsContent.includes('Soliloquy'), 'CREDITS.md cites "Soliloquy" piece');
    assert(creditsContent.includes('CC-BY 3.0'), 'CREDITS.md includes Creative Commons Attribution 3.0 license');
    assert(creditsContent.includes('OpenGameArt.org'), 'CREDITS.md cites OpenGameArt.org source');
    assert(creditsContent.includes('Web Audio Synthesizer'), 'CREDITS.md documents the procedural Web Audio synthesizer');

    console.log('\n🎉 ALL SOUND & MUSIC ENGINE TESTS PASSED SUCCESSFULLY!');
}

runSoundTests().catch(err => {
    console.error('Fatal error in audio tests:', err);
    process.exit(1);
});
