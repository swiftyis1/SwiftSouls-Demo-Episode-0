export interface AudioSettings {
    volume: number;
    isMuted: boolean;
}

export type BgmTrackId =
    | 'overworld'
    | 'oakhaven'
    | 'aetheria'
    | 'ironspire'
    | 'meteor_pod'
    | 'dungeon'
    | 'castle'
    | 'battle'
    | 'boss';

export interface BgmTrackPattern {
    bpm: number;
    bass: string[];
    arp: string[];
    lead: string[];
    drums: (string | null)[];
    leadWave?: OscillatorType;
    leadFilter?: number;
}

export class SoundSynth {
    private static ctx: AudioContext | null = null;
    private static masterGain: GainNode | null = null;
    private static volume: number = 0.8;
    private static isMutedState: boolean = false;
    private static isInitialized: boolean = false;

    // Procedural BGM Sequencer State
    private static bgmGain: GainNode | null = null;
    private static bgmVolumeRatio: number = 0.35;
    private static currentBgmTrack: BgmTrackId | null = null;
    private static bgmTimer: any = null;
    private static bgmNextStepTime: number = 0;
    private static bgmStepIndex: number = 0;
    private static isBgmPaused: boolean = false;
    private static readonly BGM_LOOKAHEAD_INTERVAL_MS: number = 35;
    private static readonly BGM_SCHEDULE_AHEAD_SEC: number = 0.12;

    private static initSettings() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const saved = window.localStorage.getItem('swiftsouls_audio_settings');
                if (saved) {
                    const parsed = JSON.parse(saved) as AudioSettings;
                    if (typeof parsed.volume === 'number') this.volume = Math.max(0, Math.min(1, parsed.volume));
                    if (typeof parsed.isMuted === 'boolean') this.isMutedState = parsed.isMuted;
                }
            }
        } catch {
            // LocalStorage inaccessible or blocked
        }
    }

    private static saveSettings() {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const settings: AudioSettings = {
                    volume: this.volume,
                    isMuted: this.isMutedState
                };
                window.localStorage.setItem('swiftsouls_audio_settings', JSON.stringify(settings));
            }
        } catch {
            // Storage quota or sandboxed
        }
    }

    private static getContext(): AudioContext {
        this.initSettings();
        if (!this.ctx) {
            if (typeof window !== 'undefined') {
                // @ts-ignore
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            }
            if (!this.ctx) {
                // Fallback mock AudioContext for Node.js test environment
                this.ctx = this.createMockAudioContext();
            }
        }

        // Resume if suspended (browser autoplay policy)
        if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
            this.ctx.resume();
        }

        return this.ctx!;
    }

    private static getMasterOutput(): AudioNode {
        const ctx = this.getContext();
        if (!this.masterGain) {
            try {
                this.masterGain = ctx.createGain();
                this.masterGain.gain.setValueAtTime(this.isMutedState ? 0 : this.volume, ctx.currentTime);
                this.masterGain.connect(ctx.destination);
            } catch {
                // Mock node fallback
                this.masterGain = {
                    gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
                    connect: () => {}
                } as any;
            }
        }
        return this.masterGain!;
    }

    private static createMockAudioContext(): AudioContext {
        const dummyNode = {
            connect: () => {},
            disconnect: () => {},
            start: () => {},
            stop: () => {},
            gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
            frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
            Q: { setValueAtTime: () => {} }
        };

        return {
            currentTime: 0,
            sampleRate: 44100,
            state: 'running',
            destination: dummyNode,
            createGain: () => Object.create(dummyNode),
            createOscillator: () => Object.create(dummyNode),
            createBiquadFilter: () => Object.create(dummyNode),
            createBuffer: () => ({
                getChannelData: () => new Float32Array(100)
            }),
            createBufferSource: () => Object.create(dummyNode),
            resume: async () => {}
        } as unknown as AudioContext;
    }

    // ==========================================
    // Master Volume & Audio Settings Controls
    // ==========================================

    public static getVolume(): number {
        this.initSettings();
        return this.volume;
    }

    public static setVolume(val: number) {
        this.initSettings();
        this.volume = Math.max(0, Math.min(1, val));
        if (this.masterGain && this.ctx) {
            const targetGain = this.isMutedState ? 0 : this.volume;
            try {
                this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
            } catch {
                (this.masterGain.gain as any).value = targetGain;
            }
        }
        this.saveSettings();
    }

    public static isMuted(): boolean {
        this.initSettings();
        return this.isMutedState;
    }

    public static setMuted(muted: boolean) {
        this.initSettings();
        this.isMutedState = muted;
        if (this.masterGain && this.ctx) {
            const targetGain = this.isMutedState ? 0 : this.volume;
            try {
                this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
            } catch {
                (this.masterGain.gain as any).value = targetGain;
            }
        }
        this.saveSettings();
    }

    public static toggleMute(): boolean {
        this.setMuted(!this.isMuted());
        return this.isMuted();
    }

    // ==========================================
    // Procedural Synthesized Sound Effects
    // ==========================================

    /**
     * Crisp 8-bit UI navigation blip (880Hz square wave).
     */
    public static playMenuBlip() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(880, now);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

            osc.connect(gain);
            gain.connect(this.getMasterOutput());

            osc.start(now);
            osc.stop(now + 0.04);
        } catch (e) {
            // Silently handle headless or audio block
        }
    }

    /**
     * Ascending two-tone confirm chime (587Hz -> 880Hz).
     */
    public static playMenuSelect() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(587.33, now); // D5
            osc.frequency.setValueAtTime(880, now + 0.04); // A5

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.setValueAtTime(0.18, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.getMasterOutput());

            osc.start(now);
            osc.stop(now + 0.13);
        } catch (e) {}
    }

    /**
     * Descending two-tone cancellation / back tick (440Hz -> 220Hz).
     */
    public static playMenuCancel() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(220, now + 0.04);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

            osc.connect(gain);
            gain.connect(this.getMasterOutput());

            osc.start(now);
            osc.stop(now + 0.11);
        } catch (e) {}
    }

    /**
     * Retro sword slash impact (white noise burst + rapid pitch drop).
     */
    public static playAttackHit() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            // 1. Tonal pitch drop (metallic strike)
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.09);

            oscGain.gain.setValueAtTime(0.25, now);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc.connect(oscGain);
            oscGain.connect(this.getMasterOutput());

            osc.start(now);
            osc.stop(now + 0.1);

            // 2. Punch noise crackle
            const bufferSize = Math.floor(ctx.sampleRate * 0.05);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(1200, now);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.3, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.getMasterOutput());

            noise.start(now);
        } catch (e) {}
    }

    /**
     * Alias for retro sword slash impact.
     */
    public static playSlash() {
        this.playAttackHit();
    }

    /**
     * Heavy critical strike impact (double resonance crunchy slash with sub-bass punch).
     */
    public static playCritHit() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            // 1. Dual detuned oscillators for crunchy distortion
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sawtooth';
            osc2.type = 'square';
            osc1.frequency.setValueAtTime(750, now);
            osc1.frequency.exponentialRampToValueAtTime(35, now + 0.22);
            osc2.frequency.setValueAtTime(740, now);
            osc2.frequency.exponentialRampToValueAtTime(32, now + 0.22);

            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.getMasterOutput());

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.25);
            osc2.stop(now + 0.25);

            // 2. Sub-bass punch impact
            const sub = ctx.createOscillator();
            const subGain = ctx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(140, now);
            sub.frequency.exponentialRampToValueAtTime(30, now + 0.18);
            subGain.gain.setValueAtTime(0.6, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            sub.connect(subGain);
            subGain.connect(this.getMasterOutput());
            sub.start(now);
            sub.stop(now + 0.22);

            // 3. Resonant noise blast
            const bufferSize = Math.floor(ctx.sampleRate * 0.12);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(2200, now);
            filter.Q.setValueAtTime(5, now);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.45, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.getMasterOutput());

            noise.start(now);
        } catch (e) {}
    }

    /**
     * Synthesizes tailored super-effective elemental strike impacts:
     * - 'fire': explosive combustion blast with flame sizzle.
     * - 'ice'/'cold': crystalline shatter & ice dispersal.
     * - 'lightning'/'electric': high-voltage jagged arc zap.
     * - 'dark'/'void': imploding gravity pulse and deep void rumble.
     * - 'poison'/'acid': corrosive sizzle splatter.
     */
    public static playElementalWeakness(element?: string) {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            if (element === 'fire') {
                // Fire Combust: Boom + Sizzle
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(45, now + 0.28);
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.connect(gain);
                gain.connect(this.getMasterOutput());
                osc.start(now);
                osc.stop(now + 0.32);

                const bufferSize = Math.floor(ctx.sampleRate * 0.2);
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1400, now);
                filter.frequency.exponentialRampToValueAtTime(200, now + 0.2);
                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(0.4, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                noise.connect(filter);
                filter.connect(noiseGain);
                noiseGain.connect(this.getMasterOutput());
                noise.start(now);
            } else if (element === 'ice' || element === 'cold') {
                // Frost Shatter: High sharp crystal shatter
                const notes = [2093.00, 2637.02, 3135.96, 4186.01]; // C7, E7, G7, C8
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const t = now + idx * 0.02;
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, t);
                    gain.gain.setValueAtTime(0.18, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                    osc.connect(gain);
                    gain.connect(this.getMasterOutput());
                    osc.start(t);
                    osc.stop(t + 0.22);
                });
            } else if (element === 'lightning' || element === 'electric') {
                // Lightning Arc Zap: Double frequency zaps
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(1760, now + 0.04);
                osc.frequency.setValueAtTime(440, now + 0.08);
                osc.frequency.setValueAtTime(2200, now + 0.12);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.connect(gain);
                gain.connect(this.getMasterOutput());
                osc.start(now);
                osc.stop(now + 0.24);
            } else if (element === 'dark' || element === 'void') {
                // Dark Void Pulse: Inverted gravity suck & sub-bass drop
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(65, now);
                osc.frequency.linearRampToValueAtTime(220, now + 0.08);
                osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
                gain.gain.setValueAtTime(0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
                osc.connect(gain);
                gain.connect(this.getMasterOutput());
                osc.start(now);
                osc.stop(now + 0.34);
            } else {
                // Default punchy weakness crunch
                SoundSynth.playCritHit();
            }
        } catch (e) {}
    }

    /**
     * Joyful companion pet chime (warm 3-note ascending chime: E5, G#5, B5).
     */
    public static playPetChime() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            const chords = [659.25, 830.61, 987.77]; // E5, G#5, B5
            chords.forEach((freq, idx) => {
                const noteTime = now + idx * 0.06;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, noteTime);
                gain.gain.setValueAtTime(0.01, noteTime);
                gain.gain.linearRampToValueAtTime(0.2, noteTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);
                osc.connect(gain);
                gain.connect(this.getMasterOutput());
                osc.start(noteTime);
                osc.stop(noteTime + 0.28);
            });
        } catch (e) {}
    }

    /**
     * Spell casting audio synthesis:
     * - 'heal': crystalline ascending 4-note chime (C5, E5, G5, C6).
     * - 'fire'/'damage'/'magic': resonant white noise burst + frequency sizzle.
     * - default/'buff': ascending shimmer tone.
     */
    public static playSpellCast(effectType?: string) {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            if (effectType === 'heal') {
                // Ascending arpeggio chords
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const noteTime = now + idx * 0.07;

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, noteTime);

                    gain.gain.setValueAtTime(0, noteTime);
                    gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

                    osc.connect(gain);
                    gain.connect(this.getMasterOutput());

                    osc.start(noteTime);
                    osc.stop(noteTime + 0.3);
                });
            } else if (effectType === 'magic' || effectType === 'elemental' || effectType === 'physical') {
                // Elemental sizzle swoosh
                const bufferSize = Math.floor(ctx.sampleRate * 0.35);
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

                const noise = ctx.createBufferSource();
                noise.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(600, now);
                filter.frequency.exponentialRampToValueAtTime(2800, now + 0.2);
                filter.frequency.exponentialRampToValueAtTime(300, now + 0.35);
                filter.Q.setValueAtTime(3, now);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.getMasterOutput());

                noise.start(now);
            } else {
                // Buff / General shimmer
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(330, now);
                osc.frequency.exponentialRampToValueAtTime(990, now + 0.25);

                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

                osc.connect(gain);
                gain.connect(this.getMasterOutput());

                osc.start(now);
                osc.stop(now + 0.3);
            }
        } catch (e) {}
    }

    /**
     * Resonant crystalline vortex absorption SFX (Over-100% absorption healing).
     */
    public static playAbsorb() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            // 1. Vortex suction sweep (sine 420Hz -> 180Hz)
            const oscVortex = ctx.createOscillator();
            const gainVortex = ctx.createGain();
            oscVortex.type = 'sine';
            oscVortex.frequency.setValueAtTime(420, now);
            oscVortex.frequency.exponentialRampToValueAtTime(180, now + 0.22);

            gainVortex.gain.setValueAtTime(0.01, now);
            gainVortex.gain.linearRampToValueAtTime(0.25, now + 0.08);
            gainVortex.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            oscVortex.connect(gainVortex);
            gainVortex.connect(this.getMasterOutput());
            oscVortex.start(now);
            oscVortex.stop(now + 0.26);

            // 2. Ascending crystal recovery chime (C5 -> G5 -> C6)
            const chords = [523.25, 783.99, 1046.50];
            chords.forEach((freq, idx) => {
                const noteTime = now + 0.08 + idx * 0.06;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, noteTime);

                gain.gain.setValueAtTime(0.01, noteTime);
                gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);

                osc.connect(gain);
                gain.connect(this.getMasterOutput());
                osc.start(noteTime);
                osc.stop(noteTime + 0.24);
            });
        } catch (e) {}
    }

    /**
     * Fiery flame sizzle and crackle SFX (Burn ailment).
     */
    public static playBurn() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            // Low warmth rumble
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(65, now + 0.28);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
            osc.connect(gain);
            gain.connect(this.getMasterOutput());
            osc.start(now);
            osc.stop(now + 0.3);

            // Resonant crackle noise sweep
            const bufferSize = Math.floor(ctx.sampleRate * 0.25);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1600, now);
            filter.frequency.exponentialRampToValueAtTime(600, now + 0.25);
            filter.Q.setValueAtTime(5, now);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.28, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.getMasterOutput());
            noise.start(now);
        } catch (e) {}
    }

    /**
     * Crystalline frost ping and ice resonance SFX (Freeze ailment).
     */
    public static playFreeze() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            // High sharp crystalline glass chime (A6 & D7)
            const freqs = [1760.00, 2349.32];
            freqs.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.03);

                gain.gain.setValueAtTime(0.15, now + idx * 0.03);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 + idx * 0.03);

                osc.connect(gain);
                gain.connect(this.getMasterOutput());
                osc.start(now + idx * 0.03);
                osc.stop(now + 0.28 + idx * 0.03);
            });
        } catch (e) {}
    }

    /**
     * Low bubbling pitch-modulated warble SFX (Poison ailment).
     */
    public static playPoison() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.linearRampToValueAtTime(140, now + 0.12);
            osc.frequency.linearRampToValueAtTime(260, now + 0.22);
            osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(gain);
            gain.connect(this.getMasterOutput());
            osc.start(now);
            osc.stop(now + 0.36);
        } catch (e) {}
    }

    /**
     * 5-note retro victory brass fanfare (C5, G5, C6, E6, G6).
     */
    public static playVictory() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            const fanfare = [
                { f: 523.25, t: 0.00, d: 0.10 }, // C5
                { f: 783.99, t: 0.10, d: 0.10 }, // G5
                { f: 1046.50, t: 0.20, d: 0.10 }, // C6
                { f: 1318.51, t: 0.30, d: 0.12 }, // E6
                { f: 1567.98, t: 0.42, d: 0.45 }  // G6 sustained
            ];

            fanfare.forEach(n => {
                const noteTime = now + n.t;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(n.f, noteTime);

                gain.gain.setValueAtTime(0.01, noteTime);
                gain.gain.linearRampToValueAtTime(0.18, noteTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + n.d);

                osc.connect(gain);
                gain.connect(this.getMasterOutput());

                osc.start(noteTime);
                osc.stop(noteTime + n.d + 0.02);
            });
        } catch (e) {}
    }

    /**
     * Public alias for playVictory() for celebration moments.
     */
    public static playFanfare() {
        SoundSynth.playVictory();
    }

    /**
     * Low-frequency growl with rapid LFO pitch modulation and low-pass sweep.
     */
    public static playBossRoar() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            const duration = 0.8;

            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.linearRampToValueAtTime(55, now + duration);

            // Vibrato LFO for roaring growl
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.setValueAtTime(16, now); // 16Hz flutter
            lfoGain.gain.setValueAtTime(25, now);
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            filter.frequency.exponentialRampToValueAtTime(150, now + duration);

            oscGain.gain.setValueAtTime(0.01, now);
            oscGain.gain.linearRampToValueAtTime(0.4, now + 0.15);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            osc.connect(filter);
            filter.connect(oscGain);
            oscGain.connect(this.getMasterOutput());

            lfo.start(now);
            osc.start(now);
            lfo.stop(now + duration);
            osc.stop(now + duration);
        } catch (e) {}
    }

    /**
     * Alternating dual-tone sci-fi emergency beacon alarm (750Hz <-> 950Hz).
     */
    public static playAlarm() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            const duration = 0.6;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';

            // Siren warble pattern
            osc.frequency.setValueAtTime(750, now);
            osc.frequency.setValueAtTime(950, now + 0.15);
            osc.frequency.setValueAtTime(750, now + 0.30);
            osc.frequency.setValueAtTime(950, now + 0.45);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            osc.connect(gain);
            gain.connect(this.getMasterOutput());

            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {}
    }

    /**
     * Rapid downward chromatic slide (600Hz -> 100Hz).
     */
    public static playFlee() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            const duration = 0.28;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + duration);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            osc.connect(gain);
            gain.connect(this.getMasterOutput());

            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {}
    }

    /**
     * Synthesizes a heavy retro explosion/rumble sound (low-pass white noise with exponential decay).
     */
    public static playExplosion() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            
            const duration = 4.5;
            const bufferSize = Math.floor(ctx.sampleRate * duration);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.setValueAtTime(600, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(30, now + duration);
            
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.5, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            
            const lfo = ctx.createOscillator();
            lfo.frequency.setValueAtTime(8, now);
            
            const lfoGain = ctx.createGain();
            lfoGain.gain.setValueAtTime(0.2, now);
            
            lfo.connect(lfoGain);
            lfoGain.connect(noiseGain.gain);
            
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.getMasterOutput());
            
            const subOsc = ctx.createOscillator();
            subOsc.type = 'triangle';
            subOsc.frequency.setValueAtTime(65, now);
            subOsc.frequency.linearRampToValueAtTime(25, now + duration);
            
            const subLfoGain = ctx.createGain();
            subLfoGain.gain.setValueAtTime(10, now);
            lfo.connect(subLfoGain);
            subLfoGain.connect(subOsc.frequency);
            
            const subGain = ctx.createGain();
            subGain.gain.setValueAtTime(0.5, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + duration - 0.5);
            
            subOsc.connect(subGain);
            subGain.connect(this.getMasterOutput());
            
            noise.start(now);
            subOsc.start(now);
            lfo.start(now);
            
            subOsc.stop(now + duration);
            lfo.stop(now + duration);
        } catch (e) {
            console.error('Failed to play explosion sound effect:', e);
        }
    }

    /**
     * Synthesizes a sci-fi door opening sweep/woosh sound (sweeping bandpass white noise).
     */
    public static playWoosh() {
        try {
            const ctx = this.getContext();
            const now = ctx.currentTime;
            
            const bufferSize = Math.floor(ctx.sampleRate * 0.5);
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.setValueAtTime(5, now);
            filter.frequency.setValueAtTime(250, now);
            filter.frequency.exponentialRampToValueAtTime(2200, now + 0.4);
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.01, now);
            gain.gain.linearRampToValueAtTime(0.25, now + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.getMasterOutput());
            
            noise.start(now);
        } catch (e) {
            console.error('Failed to play woosh sound effect:', e);
        }
    }

    // ==========================================
    // Procedural Multi-Track BGM Synthesizer
    // ==========================================

    private static getBgmOutput(): GainNode {
        const ctx = this.getContext();
        if (!this.bgmGain) {
            try {
                this.bgmGain = ctx.createGain();
                this.bgmGain.gain.setValueAtTime(this.bgmVolumeRatio, ctx.currentTime);
                this.bgmGain.connect(this.getMasterOutput());
            } catch {
                this.bgmGain = {
                    gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
                    connect: () => {}
                } as any;
            }
        }
        return this.bgmGain!;
    }

    /**
     * Converts note names (e.g., 'C4', 'D#3', 'Bb2') to musical frequency in Hertz.
     */
    public static noteFreq(note: string): number {
        if (!note || note === '-' || note === ' ') return 0;
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const flats: { [k: string]: string } = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
        
        let name = note.slice(0, -1);
        const oct = parseInt(note.slice(-1), 10);
        if (flats[name]) name = flats[name];
        const semitone = notes.indexOf(name);
        if (semitone === -1 || isNaN(oct)) return 0;
        const midi = (oct + 1) * 12 + semitone;
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    // 9 Distinct Thematic Musical Compositions (32 steps each)
    public static readonly TRACK_PATTERNS: { [track in BgmTrackId]: BgmTrackPattern } = {
        overworld: {
            bpm: 104,
            leadWave: 'triangle',
            leadFilter: 2200,
            bass: [
                'D2', '-', 'A2', '-', 'F2', '-', 'C3', '-', 'G2', '-', 'D3', '-', 'Bb2', '-', 'C3', '-',
                'D2', '-', 'A2', '-', 'F2', '-', 'C3', '-', 'G2', '-', 'Bb2', '-', 'C3', '-', 'D2', '-'
            ],
            arp: [
                'D3', 'F3', 'A3', 'D4', 'F3', 'A3', 'D4', 'F4', 'C3', 'E3', 'G3', 'C4', 'G2', 'B2', 'D3', 'G3',
                'Bb2', 'D3', 'F3', 'Bb3', 'C3', 'E3', 'G3', 'C4', 'D3', 'F3', 'A3', 'D4', 'C3', 'E3', 'G3', 'C4'
            ],
            lead: [
                'D4', '-', 'F4', '-', 'E4', '-', 'C4', '-', 'D4', '-', '-', 'A4', 'G4', '-', 'F4', '-',
                'E4', '-', 'G4', '-', 'F4', '-', 'D4', '-', 'E4', '-', 'F4', '-', 'D4', '-', '-', '-'
            ],
            drums: [
                'kick', 'hat', 'snare', 'hat', 'kick', 'hat', 'snare', 'hat',
                'kick', 'hat', 'snare', 'hat', 'kick', 'kick', 'snare', 'hat',
                'kick', 'hat', 'snare', 'hat', 'kick', 'hat', 'snare', 'hat',
                'kick', 'hat', 'snare', 'hat', 'kick', 'kick', 'snare', 'hat'
            ]
        },
        oakhaven: {
            bpm: 92,
            leadWave: 'sine',
            leadFilter: 1800,
            bass: [
                'G2', '-', 'D3', '-', 'C2', '-', 'G2', '-', 'D2', '-', 'A2', '-', 'G2', '-', 'D3', '-',
                'E2', '-', 'B2', '-', 'C2', '-', 'G2', '-', 'D2', '-', 'A2', '-', 'G2', '-', '-', '-'
            ],
            arp: [
                'G3', 'B3', 'D4', 'G4', 'C3', 'E3', 'G3', 'C4', 'D3', 'F#3', 'A3', 'D4', 'G3', 'B3', 'D4', 'G4',
                'E3', 'G3', 'B3', 'E4', 'C3', 'E3', 'G3', 'C4', 'D3', 'F#3', 'A3', 'D4', 'G3', 'B3', 'D4', 'G4'
            ],
            lead: [
                'B4', '-', 'D5', '-', 'C5', '-', 'B4', '-', 'A4', '-', 'G4', '-', 'A4', '-', 'B4', '-',
                'G4', '-', 'B4', '-', 'A4', '-', 'G4', '-', 'E4', '-', 'D4', '-', 'G4', '-', '-', '-'
            ],
            drums: [
                'hat', null, 'hat', null, 'hat', null, 'hat', null,
                'hat', null, 'hat', null, 'hat', null, 'hat', null,
                'hat', null, 'hat', null, 'hat', null, 'hat', null,
                'hat', null, 'hat', null, 'hat', null, 'hat', null
            ]
        },
        aetheria: {
            bpm: 96,
            leadWave: 'sine',
            leadFilter: 3200,
            bass: [
                'A1', '-', 'E2', '-', 'F1', '-', 'C2', '-', 'G1', '-', 'D2', '-', 'E1', '-', 'B1', '-',
                'A1', '-', 'E2', '-', 'F1', '-', 'C2', '-', 'G1', '-', 'D2', '-', 'A1', '-', '-', '-'
            ],
            arp: [
                'A4', 'C5', 'E5', 'A5', 'F4', 'A4', 'C5', 'F5', 'G4', 'B4', 'D5', 'G5', 'E4', 'G4', 'B4', 'E5',
                'A4', 'C5', 'E5', 'A5', 'F4', 'A4', 'C5', 'F5', 'G4', 'B4', 'D5', 'G5', 'A4', 'C5', 'E5', 'A5'
            ],
            lead: [
                'E5', '-', '-', 'D5', 'C5', '-', '-', 'B4', 'A4', '-', '-', 'B4', 'C5', '-', 'D5', '-',
                'E5', '-', '-', 'G5', 'F5', '-', '-', 'E5', 'D5', '-', '-', 'C5', 'A4', '-', '-', '-'
            ],
            drums: [
                null, 'hat', null, 'hat', null, 'hat', null, 'hat',
                null, 'hat', null, 'hat', null, 'hat', null, 'hat',
                null, 'hat', null, 'hat', null, 'hat', null, 'hat',
                null, 'hat', null, 'hat', null, 'hat', null, 'hat'
            ]
        },
        ironspire: {
            bpm: 112,
            leadWave: 'sawtooth',
            leadFilter: 1600,
            bass: [
                'E1', 'E1', 'B1', 'E1', 'G1', 'E1', 'B1', 'E1', 'D1', 'D1', 'A1', 'D1', 'E1', 'E1', 'B1', 'E1',
                'C1', 'C1', 'G1', 'C1', 'D1', 'D1', 'A1', 'D1', 'E1', 'E1', 'B1', 'E1', 'B0', 'B0', 'F#1', 'B0'
            ],
            arp: [
                'E3', 'G3', 'B3', 'E4', 'G3', 'B3', 'E4', 'G4', 'D3', 'F#3', 'A3', 'D4', 'E3', 'G3', 'B3', 'E4',
                'C3', 'E3', 'G3', 'C4', 'D3', 'F#3', 'A3', 'D4', 'E3', 'G3', 'B3', 'E4', 'B2', 'D#3', 'F#3', 'B3'
            ],
            lead: [
                'E4', '-', '-', 'E4', 'G4', '-', 'F#4', '-', 'E4', '-', '-', 'D4', 'E4', '-', '-', '-',
                'G4', '-', '-', 'G4', 'A4', '-', 'G4', '-', 'F#4', '-', '-', 'D4', 'E4', '-', '-', '-'
            ],
            drums: [
                'kick', 'hat', 'snare', 'kick', 'kick', 'hat', 'snare', 'hat',
                'kick', 'hat', 'snare', 'kick', 'kick', 'hat', 'snare', 'hat',
                'kick', 'hat', 'snare', 'kick', 'kick', 'hat', 'snare', 'hat',
                'kick', 'hat', 'snare', 'kick', 'kick', 'kick', 'snare', 'snare'
            ]
        },
        meteor_pod: {
            bpm: 80,
            leadWave: 'triangle',
            leadFilter: 1500,
            bass: [
                'B0', '-', '-', '-', 'F#1', '-', '-', '-', 'G0', '-', '-', '-', 'E1', '-', '-', '-',
                'B0', '-', '-', '-', 'D1', '-', '-', '-', 'E1', '-', '-', '-', 'F#1', '-', '-', '-'
            ],
            arp: [
                'B3', 'D4', 'F#4', 'B4', 'A3', 'C#4', 'E4', 'A4', 'G3', 'B3', 'D4', 'G4', 'F#3', 'A#3', 'C#4', 'F#4',
                'B3', 'D4', 'F#4', 'B4', 'A3', 'C#4', 'E4', 'A4', 'G3', 'B3', 'D4', 'G4', 'F#3', 'A#3', 'C#4', 'F#4'
            ],
            lead: [
                'F#4', '-', '-', '-', 'E4', '-', 'D4', '-', 'C#4', '-', '-', '-', 'B3', '-', '-', '-',
                'D4', '-', '-', '-', 'C#4', '-', 'B3', '-', 'A#3', '-', '-', '-', 'B3', '-', '-', '-'
            ],
            drums: [
                'hat', null, null, null, 'hat', null, null, null,
                'hat', null, null, null, 'hat', null, null, null,
                'hat', null, null, null, 'hat', null, null, null,
                'hat', null, null, null, 'hat', null, null, null
            ]
        },
        dungeon: {
            bpm: 88,
            leadWave: 'square',
            leadFilter: 1400,
            bass: [
                'C1', '-', '-', '-', 'Eb1', '-', '-', '-', 'G1', '-', '-', '-', 'Ab1', '-', 'G1', '-',
                'C1', '-', '-', '-', 'Eb1', '-', '-', '-', 'F1', '-', '-', '-', 'G1', '-', '-', '-'
            ],
            arp: [
                'C3', 'Eb3', 'G3', '-', 'Eb3', 'G3', 'C4', '-', 'Ab2', 'C3', 'Eb3', '-', 'G2', 'B2', 'D3', '-',
                'C3', 'Eb3', 'G3', '-', 'Eb3', 'G3', 'C4', '-', 'F2', 'Ab2', 'C3', '-', 'G2', 'B2', 'D3', '-'
            ],
            lead: [
                'G4', '-', '-', 'F#4', 'G4', '-', 'Eb4', '-', 'D4', '-', '-', 'C4', 'B3', '-', 'C4', '-',
                'C5', '-', '-', 'B4', 'C5', '-', 'Ab4', '-', 'G4', '-', '-', 'Eb4', 'D4', '-', 'C4', '-'
            ],
            drums: [
                'kick', null, 'hat', null, null, null, 'hat', null,
                'kick', null, 'hat', null, null, null, 'hat', null,
                'kick', null, 'hat', null, null, null, 'hat', null,
                'kick', null, 'hat', null, null, null, 'hat', null
            ]
        },
        castle: {
            bpm: 108,
            leadWave: 'sawtooth',
            leadFilter: 2600,
            bass: [
                'F1', '-', 'C2', 'F1', 'Ab1', '-', 'Eb2', 'Ab1', 'Bb1', '-', 'F2', 'Bb1', 'C2', '-', 'G2', 'C2',
                'F1', '-', 'C2', 'F1', 'Db1', '-', 'Ab1', 'Db1', 'Eb1', '-', 'Bb1', 'Eb1', 'F1', '-', 'C2', 'F1'
            ],
            arp: [
                'F3', 'Ab3', 'C4', 'F4', 'Ab3', 'C4', 'Eb4', 'Ab4', 'Bb3', 'Db4', 'F4', 'Bb4', 'C4', 'E4', 'G4', 'C5',
                'F3', 'Ab3', 'C4', 'F4', 'Db3', 'F3', 'Ab3', 'Db4', 'Eb3', 'G3', 'Bb3', 'Eb4', 'F3', 'Ab3', 'C4', 'F4'
            ],
            lead: [
                'F4', '-', 'F4', 'Ab4', 'G4', '-', 'F4', 'Eb4', 'F4', '-', '-', 'C5', 'Bb4', '-', 'Ab4', 'G4',
                'F4', '-', 'F4', 'C5', 'Db5', '-', 'C5', 'Bb4', 'C5', '-', '-', 'G4', 'F4', '-', '-', '-'
            ],
            drums: [
                'kick', 'hat', 'snare', 'hat', 'kick', 'hat', 'snare', 'hat',
                'kick', 'hat', 'snare', 'hat', 'kick', 'hat', 'snare', 'snare',
                'kick', 'hat', 'snare', 'hat', 'kick', 'hat', 'snare', 'hat',
                'kick', 'hat', 'snare', 'hat', 'kick', 'kick', 'snare', 'hat'
            ]
        },
        battle: {
            bpm: 136,
            leadWave: 'square',
            leadFilter: 2800,
            bass: [
                'A1', 'A1', 'A2', 'A1', 'F1', 'F1', 'F2', 'F1', 'G1', 'G1', 'G2', 'G1', 'E1', 'E1', 'E2', 'E1',
                'A1', 'A1', 'A2', 'A1', 'D1', 'D1', 'D2', 'D1', 'F1', 'F1', 'F2', 'F1', 'E1', 'E1', 'E2', 'E1'
            ],
            arp: [
                'A3', 'C4', 'E4', 'A4', 'F3', 'A3', 'C4', 'F4', 'G3', 'B3', 'D4', 'G4', 'E3', 'G3', 'B3', 'E4',
                'A3', 'C4', 'E4', 'A4', 'D3', 'F3', 'A3', 'D4', 'F3', 'A3', 'C4', 'F4', 'E3', 'G#3', 'B3', 'E4'
            ],
            lead: [
                'A4', '-', 'C5', '-', 'B4', '-', 'G4', '-', 'A4', '-', '-', 'E5', 'D5', '-', 'C5', 'B4',
                'A4', '-', 'C5', '-', 'D5', '-', 'F5', '-', 'E5', '-', '-', 'B4', 'A4', '-', '-', '-'
            ],
            drums: [
                'kick', 'hat', 'snare', 'hat', 'kick', 'hat', 'snare', 'hat',
                'kick', 'hat', 'snare', 'hat', 'kick', 'kick', 'snare', 'hat',
                'kick', 'hat', 'snare', 'hat', 'kick', 'hat', 'snare', 'hat',
                'kick', 'hat', 'snare', 'hat', 'kick', 'snare', 'kick', 'snare'
            ]
        },
        boss: {
            bpm: 144,
            leadWave: 'sawtooth',
            leadFilter: 3400,
            bass: [
                'C1', 'C1', '-', 'C1', 'Eb1', '-', 'C1', '-', 'F#1', '-', 'F1', '-', 'Eb1', '-', 'D1', '-',
                'C1', 'C1', '-', 'C1', 'Ab1', '-', 'G1', '-', 'F#1', '-', 'G1', '-', 'C1', '-', '-', '-'
            ],
            arp: [
                'C4', 'Eb4', 'F#4', 'A4', 'C4', 'Eb4', 'F#4', 'A4', 'B3', 'D4', 'F4', 'Ab4', 'B3', 'D4', 'F4', 'Ab4',
                'C4', 'Eb4', 'G4', 'C5', 'Ab3', 'C4', 'Eb4', 'Ab4', 'F#3', 'A3', 'C4', 'F#4', 'G3', 'B3', 'D4', 'G4'
            ],
            lead: [
                'C5', '-', '-', 'Eb5', 'D5', '-', 'C5', 'B4', 'C5', '-', '-', 'F#5', 'F5', '-', 'Eb5', 'D5',
                'C5', '-', '-', 'G5', 'Ab5', '-', 'G5', 'F#5', 'G5', '-', '-', 'D5', 'C5', '-', '-', '-'
            ],
            drums: [
                'kick', 'snare', 'kick', 'snare', 'kick', 'kick', 'snare', 'hat',
                'kick', 'snare', 'kick', 'snare', 'kick', 'kick', 'snare', 'snare',
                'kick', 'snare', 'kick', 'snare', 'kick', 'kick', 'snare', 'hat',
                'kick', 'snare', 'kick', 'snare', 'kick', 'snare', 'kick', 'snare'
            ]
        }
    };

    private static triggerSynthNote(
        time: number,
        freq: number,
        type: OscillatorType,
        duration: number,
        vol: number,
        filterCutoff?: number
    ) {
        if (freq <= 0) return;
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, time);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(vol, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            if (filterCutoff && filterCutoff > 0) {
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(filterCutoff, time);
                osc.connect(filter);
                filter.connect(gain);
            } else {
                osc.connect(gain);
            }

            gain.connect(this.getBgmOutput());
            osc.start(time);
            osc.stop(time + duration + 0.05);
        } catch {}
    }

    private static triggerDrum(time: number, drum: string) {
        try {
            const ctx = this.getContext();
            if (drum === 'kick') {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(140, time);
                osc.frequency.exponentialRampToValueAtTime(32, time + 0.08);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.35, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

                osc.connect(gain);
                gain.connect(this.getBgmOutput());
                osc.start(time);
                osc.stop(time + 0.1);
            } else if (drum === 'snare') {
                const bufferSize = Math.floor(ctx.sampleRate * 0.08);
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = ctx.createBiquadFilter();
                filter.type = 'highpass';
                filter.frequency.setValueAtTime(800, time);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.22, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.getBgmOutput());
                noise.start(time);
            } else if (drum === 'hat') {
                const bufferSize = Math.floor(ctx.sampleRate * 0.03);
                const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                const noise = ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(7500, time);
                filter.Q.setValueAtTime(3, time);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0.12, time);
                gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.getBgmOutput());
                noise.start(time);
            }
        } catch {}
    }

    private static stopBgmTimer() {
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
    }

    private static onBgmTick() {
        if (!this.currentBgmTrack || this.isBgmPaused) return;
        const track = this.TRACK_PATTERNS[this.currentBgmTrack];
        if (!track) return;

        const ctx = this.getContext();
        const stepDuration = (60 / track.bpm) / 2; // 8th note steps
        let safetyCount = 0;

        while (this.bgmNextStepTime < ctx.currentTime + this.BGM_SCHEDULE_AHEAD_SEC && safetyCount++ < 32) {
            const step = this.bgmStepIndex;
            const time = Math.max(ctx.currentTime, this.bgmNextStepTime);

            // 1. Bassline
            const bassNote = track.bass[step % track.bass.length];
            if (bassNote) {
                const freq = this.noteFreq(bassNote);
                this.triggerSynthNote(time, freq, 'triangle', stepDuration * 0.85, 0.28, 450);
            }

            // 2. Arpeggio / Chords
            const arpNote = track.arp[step % track.arp.length];
            if (arpNote) {
                const freq = this.noteFreq(arpNote);
                this.triggerSynthNote(time, freq, 'square', stepDuration * 0.65, 0.14, 1200);
            }

            // 3. Lead Melody
            const leadNote = track.lead[step % track.lead.length];
            if (leadNote) {
                const freq = this.noteFreq(leadNote);
                this.triggerSynthNote(time, freq, track.leadWave || 'triangle', stepDuration * 1.2, 0.22, track.leadFilter || 2200);
            }

            // 4. Drums
            const drum = track.drums[step % track.drums.length];
            if (drum) {
                this.triggerDrum(time, drum);
            }

            this.bgmStepIndex = (this.bgmStepIndex + 1) % 32;
            this.bgmNextStepTime += stepDuration;

            // Prevent infinite loop in Node.js headless environment where currentTime is static 0
            if (ctx.currentTime === 0) break;
        }
    }

    /**
     * Starts playing a procedural background music track.
     * Smoothly crossfades if another track is already active.
     */
    public static playBgm(trackId: BgmTrackId, crossfadeDurationMs: number = 200) {
        this.initSettings();
        if (this.currentBgmTrack === trackId && !this.isBgmPaused) {
            return; // Already playing this track
        }

        const ctx = this.getContext();
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
            ctx.resume().catch(() => {});
        }

        // Fade out previous track if playing
        if (this.currentBgmTrack && this.bgmGain) {
            try {
                this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, ctx.currentTime);
                this.bgmGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + (crossfadeDurationMs / 1000));
            } catch {}
        }

        this.stopBgmTimer();
        this.currentBgmTrack = trackId;
        this.isBgmPaused = false;
        this.bgmStepIndex = 0;
        this.bgmNextStepTime = ctx.currentTime + 0.05;

        // Fade in new track
        const bgmGain = this.getBgmOutput();
        try {
            bgmGain.gain.setValueAtTime(0.001, ctx.currentTime);
            bgmGain.gain.linearRampToValueAtTime(this.bgmVolumeRatio, ctx.currentTime + (crossfadeDurationMs / 1000));
        } catch {}

        this.bgmTimer = setInterval(() => this.onBgmTick(), this.BGM_LOOKAHEAD_INTERVAL_MS);
        this.onBgmTick();
    }

    /**
     * Stops current procedural background music with optional fade-out.
     */
    public static stopBgm(fadeDurationMs: number = 200) {
        if (!this.currentBgmTrack) return;
        const ctx = this.getContext();
        if (this.bgmGain && fadeDurationMs > 0) {
            try {
                this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, ctx.currentTime);
                this.bgmGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + (fadeDurationMs / 1000));
            } catch {}
        }
        this.stopBgmTimer();
        this.currentBgmTrack = null;
        this.isBgmPaused = false;
    }

    public static pauseBgm() {
        this.isBgmPaused = true;
    }

    public static resumeBgm() {
        if (this.currentBgmTrack && this.isBgmPaused) {
            this.isBgmPaused = false;
            this.bgmNextStepTime = this.getContext().currentTime + 0.05;
        }
    }

    public static getCurrentBgm(): BgmTrackId | null {
        return this.currentBgmTrack;
    }

    /**
     * Maps map IDs to their thematic procedural score.
     */
    public static getTrackForMap(mapId: string): BgmTrackId {
        switch (mapId) {
            case 'world_map':
                return 'overworld';
            case 'town_oakhaven':
            case 'town_map':
                return 'oakhaven';
            case 'town_aetheria':
                return 'aetheria';
            case 'town_ironspire':
                return 'ironspire';
            case 'meteor_pod':
                return 'meteor_pod';
            case 'dungeon_map':
            case 'dungeon_floor2':
                return 'dungeon';
            case 'castle_exterior':
            case 'castle_interior':
                return 'castle';
            default:
                return 'overworld';
        }
    }

    public static setBgmRelativeVolume(vol: number) {
        this.bgmVolumeRatio = Math.max(0, Math.min(1, vol));
        if (this.bgmGain && this.ctx) {
            try {
                this.bgmGain.gain.setValueAtTime(this.bgmVolumeRatio, this.ctx.currentTime);
            } catch {}
        }
    }
}

export const noteFreq = (note: string): number => SoundSynth.noteFreq(note);
export const TRACK_PATTERNS = SoundSynth.TRACK_PATTERNS;
