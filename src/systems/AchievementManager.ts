import { GameManager } from './GameManager.ts';
import { SoundSynth } from './SoundSynth.ts';

export type AchievementCategory = 'story' | 'extinction' | 'combat' | 'crafting' | 'companion' | 'exploration';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface AchievementDefinition {
    id: string;
    steamId: string;
    googlePlayId: string;
    title: string;
    description: string;
    category: AchievementCategory;
    icon: string;
    isHidden: boolean;
    rarity: AchievementRarity;
}

export interface AchievementPlatformBridge {
    name: string;
    isAvailable(): boolean;
    unlock(id: string, definition: AchievementDefinition): Promise<boolean> | boolean;
}

export interface ExtinctionCheckResult {
    extinctCount: number;
    totalCount: number;
    ratio: number;
    unlockedAchievements: string[];
    cataclysmTriggered: boolean;
}

/**
 * Universal Cross-Platform Achievement Manager for Project SwiftSouls.
 *
 * Supports:
 * - Native Web / Local storage in GameState.achievements
 * - Cross-slot universal player profile persistence in localStorage
 * - Steamworks API bridge (Desktop / Tauri / Electron)
 * - Google Play Games Services bridge (Android Mobile)
 * - Custom platform bridge extensibility
 * - 16-Bit Retro Phaser 3 HUD Toast Notification with queued display
 * - 80% Extinction Climax Event trigger ("The Apex Awakens") & Final Boss hook
 */
export class AchievementManager {
    private static _instance: AchievementManager;

    public static readonly CATALOG: AchievementDefinition[] = [
        // --- Story & Lore Milestones ---
        {
            id: 'ACH_STARFALL_ARRIVAL',
            steamId: 'ACH_STARFALL_ARRIVAL',
            googlePlayId: 'CgkI_starfall_arrival',
            title: 'Starfall Arrival',
            description: 'Witness the meteor pod crash and step into the shattered realm of SwiftSouls.',
            category: 'story',
            icon: '☄️',
            isHidden: false,
            rarity: 'common'
        },
        {
            id: 'ACH_FIRST_INFUSION',
            steamId: 'ACH_FIRST_INFUSION',
            googlePlayId: 'CgkI_first_infusion',
            title: 'Essence Awakened',
            description: 'Socket your first captured monster essence into any of the 7 equipment items.',
            category: 'crafting',
            icon: '💎',
            isHidden: false,
            rarity: 'common'
        },
        {
            id: 'ACH_FULL_INFUSION',
            steamId: 'ACH_FULL_INFUSION',
            googlePlayId: 'CgkI_full_infusion',
            title: 'Soul-Bound Armament',
            description: 'Equip monster soul crystals into all 7 equipment slots simultaneously.',
            category: 'crafting',
            icon: '🛡️',
            isHidden: false,
            rarity: 'uncommon'
        },
        {
            id: 'ACH_DUAL_AFFINITY',
            steamId: 'ACH_DUAL_AFFINITY',
            googlePlayId: 'CgkI_dual_affinity',
            title: 'Dual Resonance',
            description: 'Socket two distinct monster essences into dual-socketed masterwork gear.',
            category: 'crafting',
            icon: '⚔️',
            isHidden: false,
            rarity: 'rare'
        },
        {
            id: 'ACH_MASTER_FORGE',
            steamId: 'ACH_MASTER_FORGE',
            googlePlayId: 'CgkI_master_forge',
            title: 'Apex Blacksmith',
            description: 'Refine any equipment slot to Masterwork Tier 5 at the Forge.',
            category: 'crafting',
            icon: '🔨',
            isHidden: false,
            rarity: 'rare'
        },
        {
            id: 'ACH_ALPHA_PREDATOR',
            steamId: 'ACH_ALPHA_PREDATOR',
            googlePlayId: 'CgkI_alpha_predator',
            title: 'Alpha Melder',
            description: 'Vanquish an Alpha Boss and meld its primal essence into your equipment.',
            category: 'combat',
            icon: '👑',
            isHidden: false,
            rarity: 'rare'
        },
        {
            id: 'ACH_FAMILIAR_BOND',
            steamId: 'ACH_FAMILIAR_BOND',
            googlePlayId: 'CgkI_familiar_bond',
            title: 'Loyal Companion',
            description: 'Awaken and bond with your first pet familiar to fight alongside you.',
            category: 'companion',
            icon: '🐾',
            isHidden: false,
            rarity: 'uncommon'
        },
        {
            id: 'ACH_ASTRAL_EARRINGS',
            steamId: 'ACH_ASTRAL_EARRINGS',
            googlePlayId: 'CgkI_astral_earrings',
            title: 'Lost in the Stars',
            description: 'Defeat the Crater Astral Scavenger and recover the lost 8th item: Astral Earrings.',
            category: 'companion',
            icon: '✨',
            isHidden: false,
            rarity: 'uncommon'
        },
        {
            id: 'ACH_BOSS_SOULMELDER',
            steamId: 'ACH_BOSS_SOULMELDER',
            googlePlayId: 'CgkI_boss_soulmelder',
            title: 'Soulmeld Confluence',
            description: 'Unlock a second essence socket on an equipment piece through Boss Soulmelding.',
            category: 'crafting',
            icon: '🔮',
            isHidden: false,
            rarity: 'rare'
        },
        {
            id: 'ACH_PET_AUGMENTED',
            steamId: 'ACH_PET_AUGMENTED',
            googlePlayId: 'CgkI_pet_augmented',
            title: 'Primal Catalyst',
            description: 'Augment your pet companion with a secondary essence catalyst in the Earrings slot.',
            category: 'companion',
            icon: '⚡',
            isHidden: false,
            rarity: 'rare'
        },
        {
            id: 'ACH_TOROIDAL_WRAP',
            steamId: 'ACH_TOROIDAL_WRAP',
            googlePlayId: 'CgkI_toroidal_wrap',
            title: 'Around the World',
            description: 'Cross the continental seam and wrap around the seamless toroidal world.',
            category: 'exploration',
            icon: '🌐',
            isHidden: false,
            rarity: 'uncommon'
        },
        {
            id: 'ACH_SANCTUARY_REST',
            steamId: 'ACH_SANCTUARY_REST',
            googlePlayId: 'CgkI_sanctuary_rest',
            title: 'Restored Flame',
            description: 'Rest at a Healing Station to recover vital health and revive your companion.',
            category: 'exploration',
            icon: '🔥',
            isHidden: false,
            rarity: 'common'
        },

        // --- Extinction Milestones & Climax Event ---
        {
            id: 'ACH_EXTINCTION_FIRST',
            steamId: 'ACH_EXTINCTION_FIRST',
            googlePlayId: 'CgkI_extinction_first',
            title: 'First Blood',
            description: 'Drive your first monster species to absolute extinction (255 fragments captured).',
            category: 'extinction',
            icon: '💀',
            isHidden: false,
            rarity: 'common'
        },
        {
            id: 'ACH_EXTINCTION_25_PERCENT',
            steamId: 'ACH_EXTINCTION_25_PERCENT',
            googlePlayId: 'CgkI_extinction_25',
            title: 'Ecological Tremor',
            description: 'Drive 25% of all monster species on the planet to complete extinction.',
            category: 'extinction',
            icon: '⚡',
            isHidden: false,
            rarity: 'uncommon'
        },
        {
            id: 'ACH_EXTINCTION_50_PERCENT',
            steamId: 'ACH_EXTINCTION_50_PERCENT',
            googlePlayId: 'CgkI_extinction_50',
            title: 'Halfway to Silence',
            description: 'Drive 50% of all monster species to complete extinction.',
            category: 'extinction',
            icon: '🌑',
            isHidden: false,
            rarity: 'rare'
        },
        {
            id: 'ACH_EXTINCTION_80_PERCENT',
            steamId: 'ACH_EXTINCTION_80_PERCENT',
            googlePlayId: 'CgkI_extinction_80',
            title: 'The Apex Awakens',
            description: 'Drive 80% of all monster species to extinction, unleashing the Cataclysmic Climax Event and awakening the Final Boss.',
            category: 'extinction',
            icon: '👁️',
            isHidden: true,
            rarity: 'epic'
        },
        {
            id: 'ACH_EXTINCTION_FINAL_BOSS',
            steamId: 'ACH_EXTINCTION_FINAL_BOSS',
            googlePlayId: 'CgkI_extinction_final_boss',
            title: 'Bane of the Apex',
            description: 'Vanquish the Awakened Final Boss in the core of the Cataclysm.',
            category: 'combat',
            icon: '🏆',
            isHidden: true,
            rarity: 'epic'
        },
        {
            id: 'ACH_EXTINCTION_100_PERCENT',
            steamId: 'ACH_EXTINCTION_100_PERCENT',
            googlePlayId: 'CgkI_extinction_100',
            title: 'Total Silence',
            description: 'Drive 100% of all monster species to absolute extinction. The planet is silent... and the sequel beckons.',
            category: 'extinction',
            icon: '🌌',
            isHidden: true,
            rarity: 'legendary'
        },

        // --- Combat Mastery ---
        {
            id: 'ACH_OVER_ABSORB',
            steamId: 'ACH_OVER_ABSORB',
            googlePlayId: 'CgkI_over_absorb',
            title: 'Elemental Transmutation',
            description: 'Absorb an incoming elemental attack with >100% resistance to convert damage into health.',
            category: 'combat',
            icon: '✨',
            isHidden: false,
            rarity: 'uncommon'
        },
        {
            id: 'ACH_CRITICAL_DECIMATION',
            steamId: 'ACH_CRITICAL_DECIMATION',
            googlePlayId: 'CgkI_critical_decimation',
            title: 'Shattering Impact',
            description: 'Deliver a devastating critical strike exceeding 500 damage in combat.',
            category: 'combat',
            icon: '💥',
            isHidden: false,
            rarity: 'rare'
        },
        {
            id: 'ACH_STATUS_MASTER',
            steamId: 'ACH_STATUS_MASTER',
            googlePlayId: 'CgkI_status_master',
            title: 'Affliction Maestro',
            description: 'Inflict Burn, Freeze, Stun, Poison, Bleed, and Silence across your battles.',
            category: 'combat',
            icon: '🧪',
            isHidden: false,
            rarity: 'rare'
        },
        {
            id: 'ACH_FLAWLESS_VICTORY',
            steamId: 'ACH_FLAWLESS_VICTORY',
            googlePlayId: 'CgkI_flawless_victory',
            title: 'Untouchable',
            description: 'Vanquish any boss without suffering a single point of damage.',
            category: 'combat',
            icon: '🎖️',
            isHidden: false,
            rarity: 'epic'
        },
        {
            id: 'ACH_COMMUNITY_CHALLENGER',
            steamId: 'ACH_COMMUNITY_CHALLENGER',
            googlePlayId: 'CgkI_community_challenger',
            title: 'Secret Seeker',
            description: 'Discover and encounter one of the 50 hidden Community Challenge species.',
            category: 'exploration',
            icon: '🔑',
            isHidden: true,
            rarity: 'rare'
        }
    ];

    private platformBridges: AchievementPlatformBridge[] = [];
    private toastQueue: { def: AchievementDefinition; scene?: any }[] = [];
    private isToastShowing: boolean = false;
    private customCataclysmListeners: ((extinctCount: number, totalCount: number) => void)[] = [];

    private constructor() {
        this.initBridges();
    }

    public static get instance(): AchievementManager {
        if (!AchievementManager._instance) {
            AchievementManager._instance = new AchievementManager();
        }
        return AchievementManager._instance;
    }

    /**
     * Initializes default cross-platform bridges (Steamworks, Google Play, Web/Local).
     */
    private initBridges() {
        // 1. Steamworks Desktop Bridge (Greenworks, Steamworks.js, Tauri, Electron)
        this.registerPlatformBridge({
            name: 'Steamworks',
            isAvailable: () => {
                if (typeof window === 'undefined') return false;
                const win = window as any;
                return !!(win.steamworks?.achievement || win.SteamAPI || win.__TAURI__ || win.electronAPI?.steamUnlockAchievement);
            },
            unlock: async (_id, def) => {
                try {
                    const win = window as any;
                    if (win.steamworks?.achievement?.activate) {
                        win.steamworks.achievement.activate(def.steamId);
                        console.info(`[AchievementManager][Steamworks] Activated: ${def.steamId}`);
                        return true;
                    }
                    if (win.SteamAPI?.setAchievement) {
                        win.SteamAPI.setAchievement(def.steamId);
                        console.info(`[AchievementManager][SteamAPI] Set: ${def.steamId}`);
                        return true;
                    }
                    if (win.electronAPI?.steamUnlockAchievement) {
                        win.electronAPI.steamUnlockAchievement(def.steamId);
                        console.info(`[AchievementManager][Electron] Unlocked: ${def.steamId}`);
                        return true;
                    }
                    if (win.__TAURI__?.core?.invoke) {
                        await win.__TAURI__.core.invoke('plugin:steam|set_achievement', { name: def.steamId });
                        console.info(`[AchievementManager][Tauri] Activated: ${def.steamId}`);
                        return true;
                    }
                } catch (e) {
                    console.warn(`[AchievementManager][Steamworks] Failed to unlock ${def.steamId}:`, e);
                }
                return false;
            }
        });

        // 2. Google Play Games Services Bridge (Cordova, Capacitor, Mobile Native)
        this.registerPlatformBridge({
            name: 'GooglePlayGames',
            isAvailable: () => {
                if (typeof window === 'undefined') return false;
                const win = window as any;
                return !!(win.PlayGames || win.plugins?.playGamesServices);
            },
            unlock: async (_id, def) => {
                try {
                    const win = window as any;
                    if (win.PlayGames?.unlockAchievement) {
                        win.PlayGames.unlockAchievement(def.googlePlayId);
                        console.info(`[AchievementManager][GooglePlay] Unlocked: ${def.googlePlayId}`);
                        return true;
                    }
                    if (win.plugins?.playGamesServices?.unlockAchievement) {
                        win.plugins.playGamesServices.unlockAchievement({ achievementId: def.googlePlayId });
                        console.info(`[AchievementManager][CordovaPlay] Unlocked: ${def.googlePlayId}`);
                        return true;
                    }
                } catch (e) {
                    console.warn(`[AchievementManager][GooglePlay] Failed to unlock ${def.googlePlayId}:`, e);
                }
                return false;
            }
        });
    }

    /**
     * Registers a custom platform bridge.
     */
    public registerPlatformBridge(bridge: AchievementPlatformBridge) {
        this.platformBridges.push(bridge);
    }

    /**
     * Retrieves definition for an achievement ID.
     */
    public getDefinition(id: string): AchievementDefinition | undefined {
        return AchievementManager.CATALOG.find(a => a.id === id);
    }

    /**
     * Returns all available achievement definitions.
     */
    public getAllDefinitions(): AchievementDefinition[] {
        return [...AchievementManager.CATALOG];
    }

    /**
     * Checks if an achievement is unlocked in current game state.
     */
    public isUnlocked(id: string): boolean {
        try {
            const gm = GameManager.instance;
            if (gm.hasAchievement(id)) return true;

            // Also check universal profile in localStorage
            if (typeof window !== 'undefined' && window.localStorage) {
                const raw = window.localStorage.getItem('swiftsouls_universal_achievements');
                if (raw) {
                    const list: string[] = JSON.parse(raw);
                    if (Array.isArray(list) && list.includes(id)) return true;
                }
            }
        } catch {
            // Node / mock safe
        }
        return false;
    }

    /**
     * Unlocks an achievement.
     * Returns true if newly unlocked, false if already unlocked or definition not found.
     */
    public unlock(id: string, scene?: any): boolean {
        const def = this.getDefinition(id);
        if (!def) {
            console.warn(`[AchievementManager] Attempted to unlock unknown achievement ID: ${id}`);
            return false;
        }

        if (this.isUnlocked(id)) {
            return false;
        }

        // 1. Record in GameState
        try {
            GameManager.instance.recordAchievement(id);
        } catch (e) {
            console.warn('[AchievementManager] GameManager state recording deferred:', e);
        }

        // 2. Record in cross-slot universal profile
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const raw = window.localStorage.getItem('swiftsouls_universal_achievements');
                const list: string[] = raw ? JSON.parse(raw) : [];
                if (!list.includes(id)) {
                    list.push(id);
                    window.localStorage.setItem('swiftsouls_universal_achievements', JSON.stringify(list));
                }
            }
        } catch {}

        // 3. Dispatch to available platform bridges (Steam, Google Play, etc.)
        for (const bridge of this.platformBridges) {
            try {
                if (bridge.isAvailable()) {
                    bridge.unlock(id, def);
                }
            } catch (err) {
                console.warn(`[AchievementManager] Error in bridge ${bridge.name}:`, err);
            }
        }

        // 4. Play triumph fanfare
        try {
            SoundSynth.playFanfare();
        } catch {}

        // 5. Fire global browser event if in DOM
        try {
            if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('swiftsouls:achievement', { detail: { id, definition: def } }));
            }
        } catch {}

        console.info(`[AchievementManager] 🏆 UNLOCKED: [${def.title}] - ${def.description}`);

        // 6. Enqueue visual toast notification
        this.enqueueToast(def, scene);

        return true;
    }

    /**
     * Enqueues an achievement toast to display smoothly in sequence.
     */
    private enqueueToast(def: AchievementDefinition, scene?: any) {
        this.toastQueue.push({ def, scene });
        if (!this.isToastShowing) {
            this.processNextToast();
        }
    }

    /**
     * Processes next toast in queue.
     */
    private processNextToast() {
        if (this.toastQueue.length === 0) {
            this.isToastShowing = false;
            return;
        }

        const item = this.toastQueue.shift();
        if (!item) return;

        this.isToastShowing = true;
        const targetScene = item.scene || this.findActivePhaserScene();

        if (!targetScene || !targetScene.add || !targetScene.tweens) {
            // Headless or scene not available; briefly hold and drain queue
            setTimeout(() => {
                this.processNextToast();
            }, 50);
            return;
        }

        this.renderPhaserToast(item.def, targetScene);
    }

    /**
     * Attempts to find an active Phaser Scene from window or game instances.
     */
    private findActivePhaserScene(): any {
        try {
            if (typeof window !== 'undefined') {
                const game = (window as any).__SWIFTSOULS_GAME__;
                if (game && game.scene) {
                    const scenes = game.scene.getScenes(true);
                    if (scenes && scenes.length > 0) {
                        return scenes[0];
                    }
                }
            }
        } catch {}
        return null;
    }

    /**
     * Renders a 16-bit retro HUD toast card at top of canvas.
     */
    private renderPhaserToast(def: AchievementDefinition, scene: any) {
        try {
            const camW = scene.cameras?.main?.width || 800;
            const bannerW = 380;
            const bannerH = 68;
            const startY = -bannerH - 10;
            const targetY = 44;

            const container = scene.add.container(camW / 2, startY);
            container.setDepth(9999);
            container.setScrollFactor(0);

            // Retro obsidian plate
            const bg = scene.add.graphics();
            bg.fillStyle(0x0a0a1a, 0.95);
            bg.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 10);

            // Gold and bronze layered pixel borders
            bg.lineStyle(2, 0xd4af37, 1); // Gold outer
            bg.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 10);
            bg.lineStyle(1, 0x5a4520, 0.8); // Inset bronze trim
            bg.strokeRoundedRect(-bannerW / 2 + 3, -bannerH / 2 + 3, bannerW - 6, bannerH - 6, 8);
            container.add(bg);

            // Small header tag
            const tag = scene.add.text(0, -bannerH / 2 + 12, '★ ACHIEVEMENT UNLOCKED ★', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '10px',
                color: '#ffd700',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(tag);

            // Icon + Title
            const title = scene.add.text(0, -bannerH / 2 + 28, `${def.icon} ${def.title}`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(title);

            // Short Description
            const desc = scene.add.text(0, -bannerH / 2 + 47, def.description, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '10px',
                color: '#a0a0b8',
                align: 'center',
                wordWrap: { width: bannerW - 24 }
            }).setOrigin(0.5);
            container.add(desc);

            // Tween slide down, hold, slide up
            scene.tweens.add({
                targets: container,
                y: targetY,
                duration: 350,
                ease: 'Back.easeOut',
                onComplete: () => {
                    scene.time.delayedCall(3500, () => {
                        scene.tweens.add({
                            targets: container,
                            y: startY,
                            duration: 350,
                            ease: 'Cubic.easeIn',
                            onComplete: () => {
                                container.destroy();
                                this.processNextToast();
                            }
                        });
                    });
                }
            });
        } catch (e) {
            console.warn('[AchievementManager] Toast rendering fallback:', e);
            this.processNextToast();
        }
    }

    /**
     * Checks global monster extinction status against all milestone thresholds:
     * - 1 extinct: ACH_EXTINCTION_FIRST ("First Blood")
     * - 25% extinct: ACH_EXTINCTION_25_PERCENT ("Ecological Tremor")
     * - 50% extinct: ACH_EXTINCTION_50_PERCENT ("Halfway to Silence")
     * - 80% extinct: ACH_EXTINCTION_80_PERCENT ("The Apex Awakens") -> TRIGGERS CATACLYSM CLIMAX EVENT & FINAL BOSS
     * - 100% extinct: ACH_EXTINCTION_100_PERCENT ("Total Silence") -> Triggers true ending / sequel beacon
     */
    public checkExtinctionProgress(
        extinctCountOverride?: number,
        totalSpeciesOverride?: number,
        scene?: any
    ): ExtinctionCheckResult {
        const gm = GameManager.instance;
        const extinctCount = typeof extinctCountOverride === 'number'
            ? extinctCountOverride
            : gm.getExtinctSpeciesCount();

        // Target: In full release (Sprint 28-35) total is 150 (200 if media challenge met); in early prototype it scales to active species count
        const activeCrystalCount = Object.keys(gm.getState().soulCrystals || {}).length;
        const totalCount = typeof totalSpeciesOverride === 'number' && totalSpeciesOverride > 0
            ? totalSpeciesOverride
            : Math.max(activeCrystalCount, 6);

        const ratio = totalCount > 0 ? (extinctCount / totalCount) : 0;
        const unlockedAchievements: string[] = [];
        let cataclysmTriggered = false;

        // 1. First Extinction Milestone
        if (extinctCount >= 1) {
            if (this.unlock('ACH_EXTINCTION_FIRST', scene)) {
                unlockedAchievements.push('ACH_EXTINCTION_FIRST');
            }
        }

        // 2. 25% Extinction Milestone
        if (ratio >= 0.25) {
            if (this.unlock('ACH_EXTINCTION_25_PERCENT', scene)) {
                unlockedAchievements.push('ACH_EXTINCTION_25_PERCENT');
            }
        }

        // 3. 50% Extinction Milestone
        if (ratio >= 0.50) {
            if (this.unlock('ACH_EXTINCTION_50_PERCENT', scene)) {
                unlockedAchievements.push('ACH_EXTINCTION_50_PERCENT');
            }
        }

        // 4. 80% Extinction Climax Event Milestone ("The Apex Awakens")
        if (ratio >= 0.80) {
            if (this.unlock('ACH_EXTINCTION_80_PERCENT', scene)) {
                unlockedAchievements.push('ACH_EXTINCTION_80_PERCENT');
            }

            // Trigger the Cataclysmic Climax Event & Final Boss if not already active!
            if (!gm.isCataclysmEventTriggered()) {
                gm.triggerCataclysmClimaxEvent(scene);
                cataclysmTriggered = true;

                // Notify custom listeners
                for (const listener of this.customCataclysmListeners) {
                    try {
                        listener(extinctCount, totalCount);
                    } catch (e) {
                        console.error('[AchievementManager] Cataclysm listener error:', e);
                    }
                }
            }
        }

        // 5. 100% Total Extinction (All monsters extinct)
        if (ratio >= 1.0 || (extinctCount >= totalCount && totalCount > 0)) {
            if (this.unlock('ACH_EXTINCTION_100_PERCENT', scene)) {
                unlockedAchievements.push('ACH_EXTINCTION_100_PERCENT');
            }
        }

        return {
            extinctCount,
            totalCount,
            ratio,
            unlockedAchievements,
            cataclysmTriggered
        };
    }

    /**
     * Subscribes a listener to the 80% extinction Cataclysm Climax Event.
     */
    public onCataclysmClimaxEvent(listener: (extinctCount: number, totalCount: number) => void) {
        this.customCataclysmListeners.push(listener);
    }

    /**
     * Returns progress summary.
     */
    public getProgress(): { unlockedCount: number; totalCount: number; percentage: number } {
        const total = AchievementManager.CATALOG.length;
        let unlocked = 0;
        for (const def of AchievementManager.CATALOG) {
            if (this.isUnlocked(def.id)) {
                unlocked++;
            }
        }
        return {
            unlockedCount: unlocked,
            totalCount: total,
            percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0
        };
    }

    /**
     * Resets all achievements (for debug or testing purposes).
     */
    public resetAll(slotOnly: boolean = false) {
        try {
            const state = GameManager.instance.getState();
            state.achievements = {};
            state.extinctionEventTriggered = false;
            state.finalBossUnlocked = false;
            GameManager.instance.saveGame();

            if (!slotOnly && typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem('swiftsouls_universal_achievements');
            }
        } catch {}
    }
}
