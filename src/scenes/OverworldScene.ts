import Phaser from 'phaser';
import { GameManager } from '../systems/GameManager';
import { MapRegistry } from '../systems/MapRegistry';
import type { MapData, NpcConfig } from '../systems/MapRegistry';
import { Player } from '../objects/Player';
import { PetFollower } from '../objects/PetFollower';
import { MonsterDatabase, rollEncounter, getAlphaBoss, getSpecialBoss, getGlobalEcosystemStatus } from '../systems/MonsterDatabase';
import type { MonsterStats } from '../systems/MonsterDatabase';
import { SoundSynth } from '../systems/SoundSynth';
import { LicenseManager } from '../systems/LicenseManager';
import { TouchControls } from '../systems/TouchControls';
import { GamepadManager } from '../systems/GamepadManager';
import { AccessibilityManager } from '../systems/AccessibilityManager';
import { ToroidalEngine } from '../systems/ToroidalEngine';

export class OverworldScene extends Phaser.Scene {
    private player!: Player;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private walls!: Phaser.Physics.Arcade.StaticGroup;
    private tilesGroup!: Phaser.GameObjects.Group;
    private npcsGroup!: Phaser.Physics.Arcade.StaticGroup;
    private petFollower: PetFollower | null = null;
    
    // Catacomb shortcut gate collision & sprite reference
    private dungeonGateWall: Phaser.Physics.Arcade.Image | null = null;
    private dungeonGateSprite: Phaser.Physics.Arcade.Sprite | null = null;
    
    private currentMapId: string = 'world_map';
    private currentMap!: MapData;

    // Sprint 29: Toroidal Chunk Management
    private isToroidalMap: boolean = false;
    private readonly CHUNK_SIZE: number = 10;
    private loadedMinChunkX: number = 9999;
    private loadedMaxChunkX: number = -9999;
    private loadedMinChunkY: number = 9999;
    private loadedMaxChunkY: number = -9999;
    private activeChunkKeys: Set<string> = new Set();
    private chunkTilesMap: Map<string, Phaser.GameObjects.Image[]> = new Map();
    private chunkWallsMap: Map<string, Phaser.Physics.Arcade.Image[]> = new Map();
    private chunkTweensMap: Map<string, Phaser.Tweens.Tween[]> = new Map();
    
    private hudText!: Phaser.GameObjects.Text;
    private instructionText!: Phaser.GameObjects.Text;
    private demoTimerText!: Phaser.GameObjects.Text;
    private celebrationUnsubscribe?: () => void;
    
    // Dialogue System state
    private isDialogueActive: boolean = false;
    private dialogueNpc: NpcConfig | null = null;
    private dialogueIndex: number = 0;
    private dialogueBox: Phaser.GameObjects.Graphics | null = null;
    private dialogueText: Phaser.GameObjects.Text | null = null;
    private dialogueNameText: Phaser.GameObjects.Text | null = null;
    private dialoguePromptText: Phaser.GameObjects.Text | null = null;
    
    // Prevent double triggers on portals and battle transitions
    private isTransitioning: boolean = false;
    
    private interactionBubble!: Phaser.GameObjects.Container;
    private interactionBubbleTween: Phaser.Tweens.Tween | null = null;

    // Endangered Alpha Boss Tracking
    private alphaBossSprites: Phaser.GameObjects.Sprite[] = [];
    private alphaBossTweens: Phaser.Tweens.Tween[] = [];

    // Sprint 25: Special Quest & Crater Boss Tracking
    private specialBossSprites: Phaser.GameObjects.Sprite[] = [];
    private specialBossTweens: Phaser.Tweens.Tween[] = [];

    // Cataclysm World-Boss (spawns at 80% extinction)
    private cataclysmBossSprite: Phaser.GameObjects.Sprite | null = null;
    private cataclysmBossTween: Phaser.Tweens.Tween | null = null;

    // Town Evolution Props & Tweens
    private townEvolutionSprites: Phaser.GameObjects.Sprite[] = [];
    private townEvolutionTweens: Phaser.Tweens.Tween[] = [];

    // Encounter Step System
    private lastGridX: number = -1;
    private lastGridY: number = -1;
    private encounterStepsRemaining: number = 8;
    private readonly minEncounterSteps: number = 5;
    private readonly maxEncounterSteps: number = 10;
    private encounterGraceSteps: number = 0;

    // Sprint 34: Ambient Environmental Particles & Living World Details
    private ambientMotes: { gfx: Phaser.GameObjects.Graphics; vx: number; vy: number; baseAlpha: number }[] = [];
    private stepParticleTimer: number = 0;

    // Tap-to-Move & Tap-to-Target Animated Waypoint Reticle
    private waypointReticle: Phaser.GameObjects.Graphics | null = null;
    private waypointTween: Phaser.Tweens.Tween | null = null;

    constructor() {
        super('OverworldScene');
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.encounterStepsRemaining = Phaser.Math.Between(this.minEncounterSteps, this.maxEncounterSteps);

        // Initialize groups
        this.walls = this.physics.add.staticGroup();
        this.tilesGroup = this.add.group();
        this.npcsGroup = this.physics.add.staticGroup();

        // 1. Add Player Sprite (generated in BootScene)
        const savedState = GameManager.instance.getState();
        this.currentMapId = savedState.currentMapId || 'world_map';
        
        // Spawn player
        this.player = new Player(this, savedState.spawnPoint.x, savedState.spawnPoint.y);

        // Spawn pet companion follower
        this.petFollower = new PetFollower(this, savedState.spawnPoint.x - 32, savedState.spawnPoint.y);

        // Sprint 34: Initialize ambient environmental particle pool
        this.initAmbientParticles();



        // 2. Load the initial map
        this.loadMap(this.currentMapId, false, undefined, undefined, false);
        SoundSynth.playBgm(SoundSynth.getTrackForMap(this.currentMapId));

        // 3. Keyboard Input controls
        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            
            // Interaction key listener
            this.input.keyboard.on('keydown-SPACE', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (this.isDialogueActive) {
                    this.advanceDialogue();
                } else {
                    this.tryInteract();
                }
            });

            this.input.keyboard.on('keydown-ENTER', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (this.isDialogueActive) {
                    this.advanceDialogue();
                } else {
                    this.tryInteract();
                }
            });

            // Global canvas click & touch handler for Tap-to-Move / Tap-to-Target & Dialogue
            this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (this.isDialogueActive) {
                    this.advanceDialogue();
                    return;
                }
                this.handlePointerMapTap(pointer, true);
            });

            this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (pointer.isDown && !this.isDialogueActive && !this.isTransitioning) {
                    this.handlePointerMapTap(pointer, false);
                }
            });

            // Menu toggle keys
            this.input.keyboard.on('keydown-ESC', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.openMenu();
                }
            });
            this.input.keyboard.on('keydown-M', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.openMenu();
                }
            });

            // Debug Battle Warp Key
            this.input.keyboard.on('keydown-B', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.openBattleScene();
                }
            });

            // Gamepad interaction controller support
            if (this.input.gamepad) {
                this.input.gamepad.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
                    if (!this.scene.isActive() || this.scene.isPaused()) return;
                    if (button.index === 0) { // A button (Confirm/Interact)
                        if (this.isDialogueActive) {
                            this.advanceDialogue();
                        } else {
                            this.tryInteract();
                        }
                    } else if (button.index === 9) { // Start/Menu Button
                        if (!this.isDialogueActive && !this.isTransitioning) {
                            this.openMenu();
                        }
                    } else if (button.index === 8) { // Select Button (Debug Battle Warp)
                        if (!this.isDialogueActive && !this.isTransitioning) {
                            this.openBattleScene();
                        }
                    }
                });
            }

            // Debug Teleportation Keys for quick testing of maps
            this.input.keyboard.on('keydown-ONE', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('world_map', false, undefined, undefined, false);
                }
            });
            this.input.keyboard.on('keydown-TWO', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('meteor_pod', false, undefined, undefined, false);
                }
            });
            this.input.keyboard.on('keydown-THREE', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('dungeon_map', false, undefined, undefined, false);
                }
            });
            this.input.keyboard.on('keydown-FOUR', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('town_oakhaven', false, undefined, undefined, false);
                }
            });
            this.input.keyboard.on('keydown-FIVE', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('town_aetheria', false, undefined, undefined, false);
                }
            });
            this.input.keyboard.on('keydown-SIX', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('town_ironspire', false, undefined, undefined, false);
                }
            });
            this.input.keyboard.on('keydown-SEVEN', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('world_map', false, undefined, undefined, false);
                    this.player.setPosition(45 * 64 + 32, 46 * 64 + 32);
                }
            });
            this.input.keyboard.on('keydown-EIGHT', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('world_map', false, undefined, undefined, false);
                    this.player.setPosition(60 * 64 + 32, 49 * 64 + 32);
                }
            });
            this.input.keyboard.on('keydown-NINE', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('dungeon_floor2', false, undefined, undefined, false);
                }
            });
            this.input.keyboard.on('keydown-ZERO', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('castle_interior', false, undefined, undefined, false);
                    this.player.setPosition(10 * 64 + 32, 10 * 64 + 32);
                }
            });
            this.input.keyboard.on('keydown-P', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('castle_exterior', false, undefined, undefined, false);
                    this.player.setPosition(10 * 64 + 32, 10 * 64 + 32);
                }
            });
            this.input.keyboard.on('keydown-O', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('world_map', false, undefined, undefined, false);
                    this.player.setPosition(50 * 64 + 32, 89 * 64 + 32);
                }
            });

            // Debug key to cycle simulated Soul Level (0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 0)
            this.input.keyboard.on('keydown-L', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    const currentSoulLevel = GameManager.instance.getSoulLevel();
                    const nextSoulLevel = (currentSoulLevel + 1) % 7;
                    GameManager.instance.setDebugSoulLevel(nextSoulLevel);
                    this.updateHUD();

                    const currentTownName = ['town_oakhaven', 'town_aetheria', 'town_ironspire', 'town_map'].includes(this.currentMapId)
                        ? MapRegistry.getTownName(this.currentMapId, nextSoulLevel)
                        : `Soul Level: ${nextSoulLevel}`;

                    // Show visual notification banner
                    const notif = this.add.text(
                        this.cameras.main.width / 2,
                        90,
                        `[DEBUG] Soul Level Set to ${nextSoulLevel}\n${currentTownName}`,
                        {
                            fontFamily: '"Courier New", Courier, monospace',
                            fontSize: '22px',
                            color: '#00ffff',
                            backgroundColor: '#000000dd',
                            padding: { x: 16, y: 8 },
                            align: 'center'
                        }
                    );
                    notif.setOrigin(0.5, 0.5);
                    notif.setScrollFactor(0);
                    notif.setDepth(200);

                    this.tweens.add({
                        targets: notif,
                        alpha: 0,
                        y: 60,
                        duration: 2500,
                        onComplete: () => notif.destroy()
                    });

                    // If currently on any town map, re-load town evolutions immediately
                    if (['town_oakhaven', 'town_aetheria', 'town_ironspire', 'town_map'].includes(this.currentMapId)) {
                        this.loadMap(this.currentMapId, false, undefined, undefined, false);
                    }
                }
            });

            // Debug key K to cycle simulated Species Extinctions (0 -> 1 -> 3 -> 5 -> 6 -> 0)
            this.input.keyboard.on('keydown-K', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    const currentExtinct = GameManager.instance.getExtinctSpeciesCount();
                    const tiers = [0, 1, 3, 5, 6];
                    const curIdx = tiers.indexOf(currentExtinct);
                    const nextExtinct = tiers[(curIdx + 1) % tiers.length];
                    GameManager.instance.setDebugExtinctionCount(nextExtinct);
                    this.updateHUD();

                    const notif = this.add.text(
                        this.cameras.main.width / 2,
                        130,
                        `[DEBUG] Extinct Species: ${nextExtinct}/6\nDialogue Reactivity Updated!`,
                        {
                            fontFamily: '"Courier New", Courier, monospace',
                            fontSize: '20px',
                            color: '#ffcc00',
                            backgroundColor: '#000000dd',
                            padding: { x: 16, y: 8 },
                            align: 'center'
                        }
                    );
                    notif.setOrigin(0.5, 0.5);
                    notif.setScrollFactor(0);
                    notif.setDepth(200);

                    this.tweens.add({
                        targets: notif,
                        alpha: 0,
                        y: 100,
                        duration: 2500,
                        onComplete: () => notif.destroy()
                    });

                    this.spawnEndangeredAlphaBosses();
                }
            });

            // Debug key I to teleport directly in front of Phoenix Peak on world_map (12, 2)
            this.input.keyboard.on('keydown-I', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    this.loadMap('world_map', false, undefined, undefined, false);
                    this.player.setPosition(12 * 64 + 32, 2 * 64 + 32);
                }
            });

            // Debug key J to set Phoenix species to Endangered (254 fragments) and trigger Alpha Boss spawning
            this.input.keyboard.on('keydown-J', () => {
                if (!this.scene.isActive() || this.scene.isPaused()) return;
                if (!this.isDialogueActive && !this.isTransitioning) {
                    GameManager.instance.setDebugSpeciesEndangered('phoenix');
                    this.updateHUD();

                    const notif = this.add.text(
                        this.cameras.main.width / 2,
                        130,
                        `[DEBUG] Phoenix Endangered (254 frags)!\nAlpha Sovereign Spawned!`,
                        {
                            fontFamily: '"Courier New", Courier, monospace',
                            fontSize: '20px',
                            color: '#ff6600',
                            backgroundColor: '#000000dd',
                            padding: { x: 16, y: 8 },
                            align: 'center'
                        }
                    );
                    notif.setOrigin(0.5, 0.5);
                    notif.setScrollFactor(0);
                    notif.setDepth(200);

                    this.tweens.add({
                        targets: notif,
                        alpha: 0,
                        y: 100,
                        duration: 2500,
                        onComplete: () => notif.destroy()
                    });

                    this.spawnEndangeredAlphaBosses();
                }
            });
        }

        // 4. UI Layer (HUD text locked to screen)
        this.hudText = this.add.text(30, 30, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#00ffcc',
            backgroundColor: '#0f0f1bcc',
            padding: { x: 15, y: 8 }
        });
        this.hudText.setScrollFactor(0);
        this.hudText.setDepth(100);
        this.updateHUD();

        // Evaluation Demo Timer HUD (Top-Right)
        this.demoTimerText = this.add.text(width - 30, 30, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#00ffcc',
            backgroundColor: '#0f0f1bcc',
            padding: { x: 14, y: 8 }
        });
        this.demoTimerText.setOrigin(1, 0);
        this.demoTimerText.setScrollFactor(0);
        this.demoTimerText.setDepth(100);
        this.demoTimerText.setVisible(false); // Demo timer removed
        this.updateDemoTimerHUD();

        // 1-Second Ticker for Evaluation Playtime
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                if (!this.scene.isActive() || this.scene.isPaused() || this.isDialogueActive || this.isTransitioning) {
                    return;
                }
                const justExpired = LicenseManager.instance.tickActiveSecond(1);
                this.updateDemoTimerHUD();
                // Demo expiry removed — justExpired is always false but kept for safety
                void justExpired;
            }
        });

        // Listen for Commercial upgrade fanfare celebration
        this.celebrationUnsubscribe = LicenseManager.instance.onCelebration(() => {
            this.triggerCommercialCelebration();
        });

        // Proximity helper overlay
        this.instructionText = this.add.text(width / 2, height - 50, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 15, y: 8 }
        });
        this.instructionText.setOrigin(0.5, 0.5);
        this.instructionText.setScrollFactor(0);
        this.instructionText.setDepth(100);

        // Auto-save player location periodically (every 2 seconds)
        this.time.addEvent({
            delay: 2000,
            callback: () => {
                if (this.player && !this.isTransitioning) {
                    GameManager.instance.updatePlayerLocation('OverworldScene', this.currentMapId, this.player.x, this.player.y);
                }
            },
            loop: true
        });

        // Create the interaction speech bubble (hidden by default)
        this.createInteractionBubble();

        // Listen for resume from MenuScene and BattleScene
        this.events.on('resume', (_scene: Phaser.Scene, data?: any) => {
            LicenseManager.instance.resumeTimer();
            this.updateHUD();
            this.updateDemoTimerHUD();
            this.cameras.main.fadeIn(350, 0, 0, 0);
            this.isTransitioning = false;
            this.encounterGraceSteps = 3; // 3-step grace period
            SoundSynth.playBgm(SoundSynth.getTrackForMap(this.currentMapId));
            if (this.input.keyboard) {
                this.input.keyboard.resetKeys();
            }

            if (data && data.respawnAtPod) {
                SoundSynth.playAlarm();
                this.loadMap('world_map', false, undefined, undefined, false);
                this.player.setPosition(45 * 64 + 32, 46 * 64 + 32);
                this.cameras.main.startFollow(this.player, false);
                this.time.delayedCall(250, () => {
                    this.isTransitioning = false;
                    this.startDialogue({
                        id: 'bio_pod',
                        name: 'Meteor Bio-Pod',
                        spriteKey: 'npc',
                        gridX: 45,
                        gridY: 46,
                        dialogue: [
                            '[EMERGENCY BIO-RECONSTRUCTION]',
                            'Fatal vitals detected in field combat.',
                            'Automated pod telemetry recalled Unit Swift to Crater Basin landing point.',
                            'Health and Spirit reserves have been fully restored to 100% capacity.'
                        ]
                    });
                });
            } else {
                // Handle Cataclysm boss defeat signal from BattleScene
                if (data && data.bossDefeated === 'cataclysm') {
                    GameManager.instance.recordCataclysmBossDefeated();
                    if (this.cataclysmBossSprite) {
                        if (this.cataclysmBossTween) { this.cataclysmBossTween.destroy(); this.cataclysmBossTween = null; }
                        this.cataclysmBossSprite.destroy();
                        this.cataclysmBossSprite = null;
                    }
                    // Show vanquished fanfare dialogue
                    this.time.delayedCall(400, () => {
                        const isFinalGame = LicenseManager.instance.isCommercial();
                        const dialogue = [
                            '[EXTINCTION ENGINE: EQUILIBRIUM REACHED]',
                            'The Cataclysm has been vanquished. Its essence dissolves into the void.',
                            'The planetary ecosystem has stabilized from the brink of total collapse.'
                        ];
                        if (isFinalGame) {
                            dialogue.push('Continue hunting all remaining species to extinction to trigger the true ending.');
                        }
                        this.startDialogue({
                            id: 'cataclysm_vanquished',
                            name: '\u2694\ufe0f CATACLYSM VANQUISHED',
                            spriteKey: 'phoenix',
                            gridX: 50, gridY: 50,
                            dialogue
                        });
                    });
                }
                this.spawnEndangeredAlphaBosses();
                this.spawnSpecialQuestBosses();
                this.spawnCataclysmBoss();
            }
        });

        // 4. Setup TouchControls Overlay
        TouchControls.instance.createOverlay(this);
        TouchControls.instance.setActionCallback(() => {
            if (!this.scene.isActive() || this.scene.isPaused()) return;
            if (this.isDialogueActive) {
                this.advanceDialogue();
            } else {
                this.tryInteract();
            }
        });
        TouchControls.instance.setMenuCallback(() => {
            if (!this.scene.isActive() || this.scene.isPaused()) return;
            if (!this.isDialogueActive && !this.isTransitioning) {
                this.openMenu();
            }
        });

        // 5. GamepadManager Connection Notification Listener
        GamepadManager.instance.onConnect((pad) => {
            if (!this.scene.isActive()) return;
            const padName = pad.id.length > 24 ? `${pad.id.substring(0, 24)}...` : pad.id;
            const toast = this.add.text(
                this.cameras.main.width / 2,
                110,
                `🎮 Controller Connected: ${padName}`,
                {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '20px',
                    color: '#38bdf8',
                    backgroundColor: '#0f172add',
                    padding: { x: 16, y: 8 },
                    align: 'center'
                }
            );
            toast.setOrigin(0.5, 0.5);
            toast.setScrollFactor(0);
            toast.setDepth(1500);

            this.tweens.add({
                targets: toast,
                alpha: 0,
                y: 80,
                duration: 2500,
                onComplete: () => toast.destroy()
            });
        });

        this.events.on('resume', () => {
            if (this.input.keyboard) {
                this.input.keyboard.resetKeys();
            }
            if (this.cursors) {
                this.cursors.left?.reset();
                this.cursors.right?.reset();
                this.cursors.up?.reset();
                this.cursors.down?.reset();
                this.cursors.space?.reset();
                this.cursors.shift?.reset();
            }
            TouchControls.instance.reset();
            TouchControls.instance.refreshVisibility();
            if (this.player) {
                this.player.resetInput();
                this.player.refreshLayers();
            }
            if (this.petFollower) {
                this.petFollower.refreshPetVisuals();
            }
        });

        this.events.once('shutdown', () => {
            if (this.celebrationUnsubscribe) {
                this.celebrationUnsubscribe();
            }
            TouchControls.instance.destroyOverlay();
        });
    }

    update(_time: number, delta: number) {
        if (delta > 0) {
            GameManager.instance.updateTimePlayed(delta / 1000);
        }

        if (!this.player || !this.cursors || this.isTransitioning) return;

        // If dialogue is active, block keyboard movement
        if (this.isDialogueActive) {
            this.player.setVelocity(0);
            return;
        }

        // Delegate movement input to Player class
        this.player.updateMove(this.cursors);

        // Clear waypoint reticle if destination reached or cancelled by manual control
        if (!this.player.hasMoveTarget() && this.waypointReticle && this.waypointReticle.visible) {
            this.hideWaypointReticle();
        }

        // Sprint 29: Toroidal Coordinate Wrapping & Dynamic Chunk Viewport Management
        if (this.isToroidalMap) {
            const mapPixelWidth = 100 * 64;
            const mapPixelHeight = 100 * 64;

            const prevPlayerX = this.player.x;
            const prevPlayerY = this.player.y;

            const wrappedX = ToroidalEngine.wrapCoordinate(this.player.x, mapPixelWidth);
            const wrappedY = ToroidalEngine.wrapCoordinate(this.player.y, mapPixelHeight);

            if (wrappedX !== this.player.x || wrappedY !== this.player.y) {
                const dxWrap = wrappedX - prevPlayerX;
                const dyWrap = wrappedY - prevPlayerY;
                this.player.setPosition(wrappedX, wrappedY);
                // Shift camera scroll by the exact wrap delta so the viewport doesn't whip or jump
                this.cameras.main.scrollX += dxWrap;
                this.cameras.main.scrollY += dyWrap;
            }

            // Smooth camera tracking using shortest toroidal delta
            const camCenterX = this.cameras.main.scrollX + this.cameras.main.width / 2;
            const camCenterY = this.cameras.main.scrollY + this.cameras.main.height / 2;
            const deltaCamX = ToroidalEngine.toroidalDelta(camCenterX, this.player.x, mapPixelWidth);
            const deltaCamY = ToroidalEngine.toroidalDelta(camCenterY, this.player.y, mapPixelHeight);

            // Subpixel smooth camera interpolation
            const lerp = 0.14;
            this.cameras.main.scrollX += deltaCamX * lerp;
            this.cameras.main.scrollY += deltaCamY * lerp;

            // Update Overworld Pet Companion follower with toroidal shortest-path delta
            if (this.petFollower && this.player) {
                this.petFollower.updateFollow(_time, delta, this.player.x, this.player.y, mapPixelWidth, mapPixelHeight);
            }

            // Dynamic viewport chunk tracking with extra 2 tiles buffer in all 4 directions
            this.updateActiveChunks();
        } else {
            // Non-toroidal maps (interior/dungeon/towns)
            if (this.petFollower && this.player) {
                this.petFollower.updateFollow(_time, delta, this.player.x, this.player.y);
            }
        }

        // Check for portal triggers
        this.checkPortals();

        // Check for NPC proximity to update helper text
        this.checkNPCProximity();

        // Check for Endangered Alpha Boss proximity
        this.checkAlphaBossProximity();

        // Check for Special Quest Boss proximity (Astral Scavenger)
        this.checkSpecialBossProximity();

        // Check for Cataclysm World-Boss proximity
        this.checkCataclysmBossProximity();

        // Check for random encounters on tall grass / cave floors
        this.checkRandomEncounters();

        // Sprint 34: Update ambient environmental particles & living world details
        this.updateAmbientParticles(_time, delta);
        this.updateLivingWorldDetails(_time, delta);
    }

    private clearActiveChunks() {
        this.chunkTilesMap.forEach(images => {
            images.forEach(img => img.destroy());
        });
        this.chunkTilesMap.clear();

        this.chunkWallsMap.forEach(walls => {
            walls.forEach(w => {
                this.walls.remove(w, true, true);
            });
        });
        this.chunkWallsMap.clear();

        this.chunkTweensMap.forEach(tweens => {
            tweens.forEach(t => t.destroy());
        });
        this.chunkTweensMap.clear();

        this.activeChunkKeys.clear();

        this.loadedMinChunkX = 9999;
        this.loadedMaxChunkX = -9999;
        this.loadedMinChunkY = 9999;
        this.loadedMaxChunkY = -9999;
    }

    private renderChunk(relChunkX: number, relChunkY: number) {
        const chunkKey = `${relChunkX},${relChunkY}`;
        if (this.chunkTilesMap.has(chunkKey)) return;

        const chunkData = MapRegistry.getChunkData('world_map', relChunkX, relChunkY, this.CHUNK_SIZE);
        const chunkTiles: Phaser.GameObjects.Image[] = [];
        const chunkWalls: Phaser.Physics.Arcade.Image[] = [];
        const chunkTweens: Phaser.Tweens.Tween[] = [];
        const tileSize = 64;

        for (let lr = 0; lr < chunkData.height; lr++) {
            for (let lc = 0; lc < chunkData.width; lc++) {
                const visualWorldR = relChunkY * this.CHUNK_SIZE + lr;
                const visualWorldC = relChunkX * this.CHUNK_SIZE + lc;
                const logicalR = ((visualWorldR % 100) + 100) % 100;
                const logicalC = ((visualWorldC % 100) + 100) % 100;

                const tileType = chunkData.grid[lr][lc];
                const x = visualWorldC * tileSize + tileSize / 2;
                const y = visualWorldR * tileSize + tileSize / 2;

                // Base floor selection based on logical world coordinates & biomes
                let bgKey = 'grass_tile';
                if (tileType === 3) {
                    // Path / Causeway / Bridge
                    if (logicalC >= 85 || logicalR <= 15) {
                        bgKey = 'cobblestone_bridge_tile';
                    } else if (logicalR >= 80 || logicalC <= 15) {
                        bgKey = 'sandbar_tile';
                    } else {
                        bgKey = 'path_tile';
                    }
                } else if (logicalR >= 38 && logicalR <= 54 && logicalC >= 38 && logicalC <= 54) {
                    // Crater Basin area
                    bgKey = 'crater_basalt_tile';
                } else if (logicalR >= 75 || logicalC >= 80) {
                    bgKey = 'sandbar_tile';
                }

                const bgTile = this.add.image(x, y, bgKey);
                bgTile.setDepth(0);
                chunkTiles.push(bgTile);
                this.tilesGroup.add(bgTile);

                // Flora flower embellishments in Verdant Valley (logicalR 40..60, logicalC 55..75)
                if (tileType === 0 && logicalR >= 42 && logicalR <= 58 && logicalC >= 58 && logicalC <= 74 && (logicalR + logicalC) % 7 === 0) {
                    const flower = this.add.image(x, y, 'flora_flower_tile');
                    flower.setDepth(1);
                    chunkTiles.push(flower);
                    this.tilesGroup.add(flower);

                    const swayTween = this.tweens.add({
                        targets: flower,
                        angle: { from: -4, to: 4 },
                        duration: 1800 + ((logicalR * 11 + logicalC * 7) % 600),
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    chunkTweens.push(swayTween);
                }

                // Shimmering water along causeway boundaries
                if ((logicalC === 0 || logicalC === 99 || logicalR === 0 || logicalR === 99) && tileType === 3 && (logicalR + logicalC) % 3 === 0) {
                    const shimmer = this.add.image(x, y, 'water_shimmer_tile');
                    shimmer.setDepth(1);
                    shimmer.setAlpha(0.6);
                    chunkTiles.push(shimmer);
                    this.tilesGroup.add(shimmer);

                    const shimmerTween = this.tweens.add({
                        targets: shimmer,
                        alpha: { from: 0.3, to: 0.8 },
                        duration: 1200 + ((logicalR + logicalC) % 500),
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    chunkTweens.push(shimmerTween);
                }

                // Portals & Landmarks in world_map
                if (logicalC === 45 && logicalR === 45) {
                    const meteorPortalSprite = this.add.image(x, y, 'meteor_open');
                    meteorPortalSprite.setDepth(2);
                    chunkTiles.push(meteorPortalSprite);
                    this.tilesGroup.add(meteorPortalSprite);
                } else if (logicalC === 55 && logicalR === 20) {
                    const cavePortalSprite = this.add.image(x, y, 'cave_entrance');
                    cavePortalSprite.setDepth(2);
                    chunkTiles.push(cavePortalSprite);
                    this.tilesGroup.add(cavePortalSprite);
                } else if (logicalC === 60 && logicalR === 48) {
                    const signpost = this.add.image(x, y, 'portal_signpost');
                    signpost.setDepth(2);
                    chunkTiles.push(signpost);
                    this.tilesGroup.add(signpost);
                } else if (logicalC === 65 && logicalR === 82) {
                    const runeArch = this.add.image(x, y, 'portal_rune_arch');
                    runeArch.setDepth(2);
                    chunkTiles.push(runeArch);
                    this.tilesGroup.add(runeArch);
                } else if (logicalC === 88 && logicalR === 35) {
                    const stoneGate = this.add.image(x, y, 'portal_stone_gate');
                    stoneGate.setDepth(2);
                    chunkTiles.push(stoneGate);
                    this.tilesGroup.add(stoneGate);
                } else if (logicalC === 50 && logicalR === 88) {
                    const castleGate = this.add.image(x, y, 'portal_castle_gate');
                    castleGate.setDepth(2);
                    chunkTiles.push(castleGate);
                    this.tilesGroup.add(castleGate);
                }

                // Solid obstacles & Walls
                if (tileType === 1 || tileType === 5 || tileType === 6 || tileType === 8) {
                    let textureKey = 'mountain_tile';
                    if (tileType === 5) {
                        textureKey = 'forest_tile';
                    } else if (tileType === 6) {
                        textureKey = 'hill_tile';
                    } else if (tileType === 8) {
                        textureKey = 'magma_fissure_tile';
                    }

                    // Dynamic 2D drop shadow under trees and mountains
                    const shadow = this.add.image(x + 4, y + 10, 'drop_shadow');
                    shadow.setAlpha(0.45);
                    shadow.setDepth(1);
                    chunkTiles.push(shadow);
                    this.tilesGroup.add(shadow);

                    const wall = this.physics.add.staticImage(x, y, textureKey);
                    wall.setDepth(3);
                    this.walls.add(wall);
                    chunkWalls.push(wall);

                    // Procedural foliage sway on forest canopy tiles
                    if (tileType === 5 && (logicalR + logicalC) % 4 === 0) {
                        const swayTween = this.tweens.add({
                            targets: wall,
                            scaleX: { from: 0.97, to: 1.03 },
                            duration: 2000 + ((logicalR * 7 + logicalC * 13) % 800),
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                        chunkTweens.push(swayTween);
                    }
                } else if (tileType === 2) {
                    // Tall grass with drop shadow and breeze sway
                    const shadow = this.add.image(x + 2, y + 8, 'drop_shadow');
                    shadow.setAlpha(0.35);
                    shadow.setScale(0.85);
                    shadow.setDepth(1);
                    chunkTiles.push(shadow);
                    this.tilesGroup.add(shadow);

                    const grassKey = this.textures.exists('grass_patch') ? 'grass_patch' : 'tall_grass_tile';
                    const tallGrass = this.add.image(x, y, grassKey);
                    tallGrass.setDepth(2);
                    chunkTiles.push(tallGrass);
                    this.tilesGroup.add(tallGrass);

                    if ((logicalR + logicalC) % 3 === 0) {
                        const grassSway = this.tweens.add({
                            targets: tallGrass,
                            angle: { from: -2.5, to: 2.5 },
                            duration: 1500 + ((logicalR * 9 + logicalC * 5) % 700),
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                        chunkTweens.push(grassSway);
                    }
                }
            }
        }

        this.chunkTilesMap.set(chunkKey, chunkTiles);
        this.chunkWallsMap.set(chunkKey, chunkWalls);
        this.chunkTweensMap.set(chunkKey, chunkTweens);
    }

    private updateActiveChunks() {
        if (!this.cameras.main) return;

        const cam = this.cameras.main;
        const tileSize = 64;
        // User requirement: Load an extra 2 tiles in all 4 directions beyond visible viewport
        const BUFFER_TILES = 2;

        const minLoadTileX = Math.floor(cam.scrollX / tileSize) - BUFFER_TILES;
        const maxLoadTileX = Math.ceil((cam.scrollX + cam.width) / tileSize) + BUFFER_TILES;
        const minLoadTileY = Math.floor(cam.scrollY / tileSize) - BUFFER_TILES;
        const maxLoadTileY = Math.ceil((cam.scrollY + cam.height) / tileSize) + BUFFER_TILES;

        const minChunkX = Math.floor(minLoadTileX / this.CHUNK_SIZE);
        const maxChunkX = Math.floor(maxLoadTileX / this.CHUNK_SIZE);
        const minChunkY = Math.floor(minLoadTileY / this.CHUNK_SIZE);
        const maxChunkY = Math.floor(maxLoadTileY / this.CHUNK_SIZE);

        if (
            minChunkX === this.loadedMinChunkX &&
            maxChunkX === this.loadedMaxChunkX &&
            minChunkY === this.loadedMinChunkY &&
            maxChunkY === this.loadedMaxChunkY
        ) {
            return;
        }

        this.loadedMinChunkX = minChunkX;
        this.loadedMaxChunkX = maxChunkX;
        this.loadedMinChunkY = minChunkY;
        this.loadedMaxChunkY = maxChunkY;

        const newActiveKeys = new Set<string>();
        const neededChunks: { relChunkX: number; relChunkY: number; key: string }[] = [];

        for (let cy = minChunkY; cy <= maxChunkY; cy++) {
            for (let cx = minChunkX; cx <= maxChunkX; cx++) {
                const key = `${cx},${cy}`;
                neededChunks.push({ relChunkX: cx, relChunkY: cy, key });
                newActiveKeys.add(key);
            }
        }

        // 1. Cull old chunks outside the viewport + 2-tile buffer
        for (const oldKey of this.activeChunkKeys) {
            if (!newActiveKeys.has(oldKey)) {
                const tiles = this.chunkTilesMap.get(oldKey) || [];
                tiles.forEach(t => t.destroy());
                this.chunkTilesMap.delete(oldKey);

                const walls = this.chunkWallsMap.get(oldKey) || [];
                walls.forEach(w => this.walls.remove(w, true, true));
                this.chunkWallsMap.delete(oldKey);

                const tweens = this.chunkTweensMap.get(oldKey) || [];
                tweens.forEach(t => t.destroy());
                this.chunkTweensMap.delete(oldKey);
            }
        }

        // 2. Render new active chunks
        for (const chunk of neededChunks) {
            if (!this.chunkTilesMap.has(chunk.key)) {
                this.renderChunk(chunk.relChunkX, chunk.relChunkY);
            }
        }

        this.activeChunkKeys = newActiveKeys;
    }

    private loadMap(
        mapId: string, 
        spawnAtPortalCoords: boolean = true, 
        portalTargetGridX?: number, 
        portalTargetGridY?: number,
        requireInteract: boolean = true
    ) {
        this.isTransitioning = true;
        if (this.interactionBubble) {
            this.hideInteractionBubble();
            this.interactionBubble.setVisible(false);
            this.interactionBubble.setAlpha(0);
        }
        if (this.player) {
            this.player.setVelocity(0);
        }
        
        // Flash camera for screen transition
        AccessibilityManager.flashCamera(this.cameras.main, 200, 0, 0, 0);

        // Clear existing map elements
        this.walls.clear(true, true);
        this.tilesGroup.clear(true, true);
        this.npcsGroup.clear(true, true);
        this.dungeonGateWall = null;
        this.dungeonGateSprite = null;
        this.townEvolutionSprites.forEach(s => s.destroy());
        this.townEvolutionSprites = [];
        this.townEvolutionTweens.forEach(t => t.destroy());
        this.townEvolutionTweens = [];

        this.clearActiveChunks();

        this.currentMapId = mapId;
        this.isToroidalMap = (mapId === 'world_map');
        this.currentMap = MapRegistry.getMap(mapId);
        if (['town_oakhaven', 'town_aetheria', 'town_ironspire', 'town_map', 'meteor_pod'].includes(mapId)) {
            this.currentMap.name = MapRegistry.getTownName(mapId, GameManager.instance.getSoulLevel());
        }
        SoundSynth.playBgm(SoundSynth.getTrackForMap(mapId));

        const tileSize = 64;

        // Set physics and camera boundaries
        const mapPixelWidth = this.currentMap.width * tileSize;
        const mapPixelHeight = this.currentMap.height * tileSize;
        this.physics.world.setBounds(0, 0, mapPixelWidth, mapPixelHeight);

        if (this.isToroidalMap) {
            this.cameras.main.removeBounds();
            this.cameras.main.stopFollow();
            this.cameras.main.centerOn(this.player.x, this.player.y);
        } else {
            this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
            this.cameras.main.startFollow(this.player, false, 0.12, 0.12);
        }

        // Position player first to compute active chunks correctly
        if (spawnAtPortalCoords && portalTargetGridX !== undefined && portalTargetGridY !== undefined) {
            this.player.setPosition(
                portalTargetGridX * tileSize + tileSize / 2,
                portalTargetGridY * tileSize + tileSize / 2
            );
        } else {
            // Check if saved map matches current map, otherwise spawn near center/default
            const savedState = GameManager.instance.getState();
            if (savedState.currentMapId === mapId) {
                this.player.setPosition(savedState.spawnPoint.x, savedState.spawnPoint.y);
            } else if (this.isToroidalMap) {
                // Default start in Crater Basin
                this.player.setPosition(45 * tileSize + tileSize / 2, 46 * tileSize + tileSize / 2);
            } else {
                // Default fallback spawn
                const screenWidth = this.cameras.main.width;
                const screenHeight = this.cameras.main.height;
                this.player.setPosition(screenWidth / 2, screenHeight / 2);
            }
        }

        if (this.isToroidalMap) {
            // World boundary collisions disabled on continuous toroidal map
            this.player.setCollideWorldBounds(false);

            this.updateActiveChunks();
        } else {
            // Interior/dungeon/towns use bounded physics
            this.player.setCollideWorldBounds(true);

            // Draw static background grid for interior maps
            for (let r = 0; r < this.currentMap.height; r++) {
                for (let c = 0; c < this.currentMap.width; c++) {
                    const tileType = this.currentMap.grid[r][c];
                    const x = c * tileSize + tileSize / 2;
                    const y = r * tileSize + tileSize / 2;

                    // Base floor under everything
                    let bgKey = 'grass_tile';
                    if (mapId === 'dungeon_map' || mapId === 'dungeon_floor2' || mapId === 'meteor_pod' || tileType === 4) {
                        bgKey = 'stone_tile';
                    } else if (mapId === 'castle_interior') {
                        bgKey = (tileType === 3) ? 'castle_floor_tile' : 'stone_tile';
                    } else if (mapId === 'castle_exterior') {
                        bgKey = (tileType === 3) ? 'path_tile' : 'grass_tile';
                    } else if (tileType === 3) {
                        bgKey = 'path_tile';
                    }

                    const bgTile = this.add.image(x, y, bgKey);
                    this.tilesGroup.add(bgTile);

                    if (mapId === 'dungeon_map') {
                        if (c === 22 && r === 16) {
                            const stairsDown = this.add.image(x, y, 'dungeon_stairs_down');
                            stairsDown.setDepth(2);
                            this.tilesGroup.add(stairsDown);
                        }
                    } else if (mapId === 'dungeon_floor2') {
                        if (c === 4 && r === 16) {
                            const stairsUp = this.add.image(x, y, 'dungeon_stairs_up');
                            stairsUp.setDepth(2);
                            this.tilesGroup.add(stairsUp);
                        } else if (c === 12 && r === 2) {
                            const stairsToCastle = this.add.image(x, y, 'dungeon_stairs_up');
                            stairsToCastle.setDepth(2);
                            this.tilesGroup.add(stairsToCastle);
                        }
                    } else if (mapId === 'castle_exterior') {
                        if (c === 10 && r === 2) {
                            const keepGate = this.add.image(x, y, 'portal_castle_gate');
                            keepGate.setDepth(2);
                            this.tilesGroup.add(keepGate);
                        } else if (c === 10 && r === 15) {
                            const exitGate = this.add.image(x, y, 'portal_castle_gate');
                            exitGate.setDepth(2);
                            this.tilesGroup.add(exitGate);
                        }
                    } else if (mapId === 'castle_interior') {
                        if (c === 10 && r === 3) {
                            const throne = this.add.image(x, y, 'royal_throne');
                            throne.setDepth(2);
                            this.tilesGroup.add(throne);
                        } else if (c === 18 && r === 3) {
                            const secretStairs = this.add.image(x, y, 'dungeon_stairs_down');
                            secretStairs.setDepth(2);
                            this.tilesGroup.add(secretStairs);
                        }
                    }

                    if (tileType === 1 || tileType === 5 || tileType === 6) {
                        let textureKey = 'wall_tile';
                        if (mapId === 'castle_interior' || mapId === 'castle_exterior') {
                            textureKey = 'castle_wall_tile';
                        }
                        const wall = this.physics.add.staticImage(x, y, textureKey);
                        this.walls.add(wall);
                    } else if (tileType === 2) {
                        const grassKey = this.textures.exists('grass_patch') ? 'grass_patch' : 'tall_grass_tile';
                        const tallGrass = this.add.image(x, y, grassKey);
                        this.tilesGroup.add(tallGrass);
                    }
                }
            }
        }

        // Solid wall collider for locked shortcut gate in dungeon_floor2 at (12, 4)
        if (mapId === 'dungeon_floor2' && GameManager.instance.getQuestState('dungeon_gate_unlocked') !== 'completed') {
            this.dungeonGateWall = this.physics.add.staticImage(12 * tileSize + tileSize / 2, 4 * tileSize + tileSize / 2, 'wall_tile');
            this.dungeonGateWall.setVisible(false);
            this.walls.add(this.dungeonGateWall);
        }

        // Set colliders
        this.physics.add.collider(this.player, this.walls);

        // Spawn NPCs
        const npcsList = [...this.currentMap.npcs];
        const soulLevel = GameManager.instance.getSoulLevel();

        npcsList.forEach(npc => {
            let spriteKey = npc.spriteKey;
            if (npc.id === 'dungeon_gate_npc') {
                const isGateUnlocked = GameManager.instance.getQuestState('dungeon_gate_unlocked') === 'completed';
                spriteKey = isGateUnlocked ? 'unlocked_dungeon_door' : 'locked_dungeon_door';
            }

            const npcSprite = this.npcsGroup.create(
                npc.gridX * tileSize + tileSize / 2,
                npc.gridY * tileSize + tileSize / 2,
                spriteKey
            );
            npcSprite.setImmovable(true);
            npcSprite.setData('config', npc);
            npcSprite.setDepth(5);

            if (npc.id === 'dungeon_gate_npc') {
                this.dungeonGateSprite = npcSprite;
            }
        });

        // Spawn Town Evolutions if on any regional town map
        if (['town_oakhaven', 'town_aetheria', 'town_ironspire', 'town_map'].includes(mapId)) {
            this.spawnTownEvolutions(soulLevel);
        }

        // Spawn Endangered Alpha Bosses if criteria met (Sprint 10)
        this.spawnEndangeredAlphaBosses();

        // Spawn Special Quest Bosses (Astral Scavenger, etc.)
        this.spawnSpecialQuestBosses();

        // Spawn Cataclysm World-Boss if 80% extinction climax triggered
        this.spawnCataclysmBoss();

        if (!this.isToroidalMap) {
            // Set camera follow with butter-smooth subpixel tracking (roundPixels: false)
            this.cameras.main.startFollow(this.player, false, 0.12, 0.12);
        } else {
            this.cameras.main.stopFollow();
            this.cameras.main.centerOn(this.player.x, this.player.y);
        }

        // Snap pet companion follower to player spawn point
        if (this.petFollower && this.player) {
            this.petFollower.setPosition(this.player.x - 28, this.player.y);
            this.petFollower.refreshPetVisuals();
        }

        // Save position and map state
        GameManager.instance.updatePlayerLocation('OverworldScene', this.currentMapId, this.player.x, this.player.y);

        this.time.delayedCall(200, () => {
            this.isTransitioning = false;
            if (requireInteract) {
                const areaName = ['town_oakhaven', 'town_aetheria', 'town_ironspire', 'town_map'].includes(this.currentMapId)
                    ? MapRegistry.getTownName(this.currentMapId, GameManager.instance.getSoulLevel())
                    : this.currentMap.name;
                const locationNpc: NpcConfig = {
                    id: 'location_notice',
                    name: 'Area Entered',
                    spriteKey: '',
                    gridX: 0,
                    gridY: 0,
                    dialogue: [
                        `You have entered: ${areaName}`
                    ]
                };
                this.startDialogue(locationNpc);
            }
        });
    }

    private checkPortals() {
        if (this.isTransitioning) return;

        const tileSize = 64;
        let playerGridX = Math.floor(this.player.x / tileSize);
        let playerGridY = Math.floor(this.player.y / tileSize);

        if (this.isToroidalMap) {
            playerGridX = ((playerGridX % 100) + 100) % 100;
            playerGridY = ((playerGridY % 100) + 100) % 100;
        }

        const portal = this.currentMap.portals.find(
            p => p.gridX === playerGridX && p.gridY === playerGridY
        );

        if (portal) {
            if (portal.targetMapId === 'dungeon_map' && GameManager.instance.getQuestState('dungeon_unlocked') !== 'completed') {
                // Block transition, push player down 1 tile so they aren't stuck on the portal
                this.player.setPosition(this.player.x, this.player.y + 64);
                
                // Show dialog box
                const barrierNpc: NpcConfig = {
                    id: 'barrier_seal',
                    name: 'Cave Barrier',
                    spriteKey: '',
                    gridX: playerGridX,
                    gridY: playerGridY,
                    dialogue: [
                        "The cave portal is sealed by a glowing electromagnetic barrier.",
                        "Seek guidance from the Hologram Guide inside the Meteor Pod."
                    ]
                };
                this.startDialogue(barrierNpc);
                return;
            }


            // Sprint 21: Evaluation / Demo Boundary Barrier Gate
            if (!LicenseManager.instance.isMapAllowed(portal.targetMapId)) {
                this.player.setPosition(this.player.x, this.player.y + 64);
                const barrierNpc: NpcConfig = {
                    id: 'demo_boundary_gate',
                    name: 'Dimensional Barrier',
                    spriteKey: '',
                    gridX: playerGridX,
                    gridY: playerGridY,
                    dialogue: [
                        "[DEMO EVALUATION TIER BARRIER]",
                        "A dense atmospheric vortex shimmers across the entrance.",
                        "Access to the Catacombs and Obsidian Castle requires the Commercial Edition ($12.99 / 650 Stars).",
                        "Upgrade via the pause menu [ESC] or Title screen to collapse this barrier!"
                    ]
                };
                this.startDialogue(barrierNpc);
                return;
            }

            this.loadMap(portal.targetMapId, true, portal.targetGridX, portal.targetGridY);
        }
    }

    private checkNPCProximity() {
        if (this.isDialogueActive) {
            this.instructionText.setText('');
            if (this.interactionBubble && this.interactionBubble.visible) {
                this.hideInteractionBubble();
            }
            return;
        }

        let nearNpc: NpcConfig | null = null;
        let nearNpcSprite: Phaser.GameObjects.Sprite | null = null;
        const tileSize = 64;

        this.npcsGroup.getChildren().forEach(child => {
            const sprite = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
            const npcConfig = sprite.getData('config') as NpcConfig;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);

            if (dist < tileSize * 1.5) {
                nearNpc = npcConfig;
                nearNpcSprite = sprite;
            }
        });

        if (nearNpc && nearNpcSprite) {
            const npc = nearNpc as NpcConfig;
            this.instructionText.setText(`Press SPACE to talk to ${npc.name}`);
            this.showInteractionBubble(nearNpcSprite);

            // Context-sensitive dynamic action button
            if (['settler_herbalist', 'soul_altar', 'castle_soul_altar', 'save_console'].includes(npc.id)) {
                TouchControls.instance.setActionButtonContext({
                    label: 'REST',
                    icon: '✨',
                    fillColor: 0x0d9488,
                    strokeColor: 0x2dd4bf,
                    pulse: true
                });
            } else if (npc.id === 'settler_blacksmith') {
                TouchControls.instance.setActionButtonContext({
                    label: 'FORGE',
                    icon: '🔨',
                    fillColor: 0xd97706,
                    strokeColor: 0xfbbf24,
                    pulse: true
                });
            } else if (npc.id === 'aetheria_archmage') {
                TouchControls.instance.setActionButtonContext({
                    label: 'MELD',
                    icon: '🔮',
                    fillColor: 0x7e22ce,
                    strokeColor: 0xc084fc,
                    pulse: true
                });
            } else if (npc.id === 'dungeon_chest') {
                const isFound = GameManager.instance.getQuestState('dungeon_key_found') === 'completed';
                TouchControls.instance.setActionButtonContext({
                    label: isFound ? 'EMPTY' : 'OPEN',
                    icon: '📦',
                    fillColor: 0xb45309,
                    strokeColor: 0xfcd34d,
                    pulse: !isFound
                });
            } else if (npc.id === 'dungeon_gate_npc') {
                const isUnlocked = GameManager.instance.getQuestState('dungeon_gate_unlocked') === 'completed';
                const hasKey = GameManager.instance.hasItem('dungeon_key');
                TouchControls.instance.setActionButtonContext({
                    label: isUnlocked ? 'PASS' : (hasKey ? 'UNLOCK' : 'LOCKED'),
                    icon: hasKey || isUnlocked ? '🔓' : '🔒',
                    fillColor: 0xc2410c,
                    strokeColor: 0xfb923c,
                    pulse: hasKey && !isUnlocked
                });
            } else {
                TouchControls.instance.setActionButtonContext({
                    label: 'TALK',
                    icon: '💬',
                    fillColor: 0x059669,
                    strokeColor: 0x34d399,
                    pulse: true
                });
            }
        } else if (this.petFollower && this.petFollower.visible && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.petFollower.x, this.petFollower.y) < 75) {
            this.instructionText.setText('Press SPACE to interact with Companion');
            TouchControls.instance.setActionButtonContext({
                label: 'PET',
                icon: '🐾',
                fillColor: 0xbe123c,
                strokeColor: 0xfb7185,
                pulse: true
            });
            if (this.interactionBubble && this.interactionBubble.visible) {
                this.hideInteractionBubble();
            }
        } else {
            // Check if standing near portal
            let playerGridX = Math.floor(this.player.x / tileSize);
            let playerGridY = Math.floor(this.player.y / tileSize);
            if (this.isToroidalMap) {
                playerGridX = ((playerGridX % 100) + 100) % 100;
                playerGridY = ((playerGridY % 100) + 100) % 100;
            }
            const portal = this.currentMap?.portals?.find(p => Math.abs(p.gridX - playerGridX) <= 1 && Math.abs(p.gridY - playerGridY) <= 1);
            if (portal) {
                this.instructionText.setText('Step on doorway or stairs to enter');
                TouchControls.instance.setActionButtonContext({
                    label: 'ENTER',
                    icon: '🚪',
                    fillColor: 0x4338ca,
                    strokeColor: 0x818cf8,
                    pulse: true
                });
            } else {
                this.instructionText.setText('Tap map to walk/interact | ARROWS/WASD/Gamepad to move');
                TouchControls.instance.setActionButtonContext({
                    label: 'ACTION',
                    icon: '⚔️',
                    fillColor: 0x0f172a,
                    strokeColor: 0x38bdf8,
                    pulse: false
                });
            }

            if (this.interactionBubble && this.interactionBubble.visible) {
                this.hideInteractionBubble();
            }
        }
    }

    private tryInteract() {
        const tileSize = 64;
        let targetNpc: NpcConfig | null = null;

        this.npcsGroup.getChildren().forEach(child => {
            const sprite = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
            const npcConfig = sprite.getData('config') as NpcConfig;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y);

            if (dist < tileSize * 1.5) {
                targetNpc = npcConfig;
            }
        });

        if (targetNpc) {
            this.startDialogue(targetNpc);
        } else if (this.petFollower && this.petFollower.visible) {
            const petDist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.petFollower.x, this.petFollower.y);
            if (petDist < 75) {
                const reactionMsg = this.petFollower.playPettingReaction();
                if (reactionMsg) {
                    const pet = GameManager.instance.getState().petCompanion;
                    const petName = pet ? pet.name : 'Companion';
                    this.startDialogue({
                        id: 'pet_interaction',
                        name: `🐾 ${petName}`,
                        spriteKey: 'pet',
                        gridX: 0,
                        gridY: 0,
                        dialogue: [
                            `[PET COMPANION]`,
                            reactionMsg
                        ]
                    });
                }
            }
        }
    }

    private startDialogue(npc: NpcConfig) {
        // Destroy existing dialogue instances to avoid overlap
        this.dialogueBox?.destroy();
        this.dialogueText?.destroy();
        this.dialogueNameText?.destroy();
        this.dialoguePromptText?.destroy();

        this.isDialogueActive = true;
        this.dialogueNpc = npc;
        this.dialogueIndex = 0;
        SoundSynth.playMenuSelect();

        // Dim menu button during dialogue
        TouchControls.instance.setMenuDimmed(true);

        // Update action button context for dialogue navigation
        if (npc.dialogue.length > 1) {
            TouchControls.instance.setActionButtonContext({
                label: 'NEXT',
                icon: '▶',
                fillColor: 0x0284c7,
                strokeColor: 0x38bdf8,
                pulse: true
            });
        } else {
            TouchControls.instance.setActionButtonContext({
                label: 'CLOSE',
                icon: '✓',
                fillColor: 0x059669,
                strokeColor: 0x34d399,
                pulse: true
            });
        }

        if (this.player) {
            this.player.setVelocity(0);
        }

        // Draw Dialog Box Graphic Overlay
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.dialogueBox = this.add.graphics();
        this.dialogueBox.fillStyle(0x0f0f1b, 0.95);
        this.dialogueBox.lineStyle(4, 0x00ffcc, 1);
        this.dialogueBox.fillRoundedRect(80, height - 260, width - 160, 200, 12);
        this.dialogueBox.strokeRoundedRect(80, height - 260, width - 160, 200, 12);
        this.dialogueBox.setScrollFactor(0);
        this.dialogueBox.setDepth(150);

        // Make box interactive for pointer click
        this.dialogueBox.setInteractive(new Phaser.Geom.Rectangle(80, height - 260, width - 160, 200), Phaser.Geom.Rectangle.Contains);
        this.dialogueBox.on('pointerdown', () => {
            if (this.isDialogueActive) {
                this.advanceDialogue();
            }
        });

        // NPC Name Header
        this.dialogueNameText = this.add.text(120, height - 240, npc.name, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.dialogueNameText.setScrollFactor(0);
        this.dialogueNameText.setDepth(151);

        // Dialogue body text
        this.dialogueText = this.add.text(120, height - 190, this.getFormattedDialogueLine(npc.dialogue[0]), {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#ffffff',
            wordWrap: { width: width - 240 }
        });
        this.dialogueText.setScrollFactor(0);
        this.dialogueText.setDepth(151);

        // Continue prompt
        this.dialoguePromptText = this.add.text(width - 420, height - 100, 'SPACE / ENTER / CLICK to continue', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#8899b3'
        });
        this.dialoguePromptText.setScrollFactor(0);
        this.dialoguePromptText.setDepth(151);
    }

    private getFormattedDialogueLine(text: string): string {
        const heroName = GameManager.instance.getHeroCalculatedStats().name;
        let formatted = text.replace(/Swift/g, heroName);
        const extinctCount = GameManager.instance.getExtinctSpeciesCount();

        const ecosystem = getGlobalEcosystemStatus();

        if (this.dialogueNpc?.id === 'red_mage_npc') {
            formatted += `\n[EXTINCTION TELEMETRY: ${extinctCount}/6 species eradicated]`;
            if (ecosystem.isUnderMigration && ecosystem.activeSpecies.length > 0) {
                formatted += `\n[MIGRATION TELEMETRY: Cleared biome niches occupied by surviving species: ${ecosystem.activeSpecies.join(', ').toUpperCase()}]`;
            }
            if (extinctCount === 6) {
                formatted += `\n[CRITICAL DIRECTIVE COMPLETE: All native bio-threats eliminated. Planetary stabilization reached!]`;
            }
        } else if (this.dialogueNpc?.id === 'settler_scout') {
            if (extinctCount >= 6) {
                formatted += `\n[Kira]: "It's miraculous... our scouting parties report zero monster threats anywhere in the realm!"`;
            } else if (ecosystem.isUnderMigration && ecosystem.activeSpecies.length > 0) {
                formatted += `\n[Kira]: "With native monsters thinned out, we're seeing other beasts migrate across the valley!"`;
            } else if (extinctCount >= 3) {
                formatted += `\n[Kira]: "The beast numbers are dropping fast. Three whole species have vanished from the plains!"`;
            } else if (extinctCount >= 1) {
                formatted += `\n[Kira]: "The wild outskirts feel quieter now that an apex species has been wiped out."`;
            }
        } else if (this.dialogueNpc?.id === 'settler_mystic') {
            const soulLevel = GameManager.instance.getSoulLevel();
            const totalFrags = GameManager.instance.getTotalFragmentsCollected();
            const nextProgress = GameManager.instance.getNextLevelProgress();
            formatted += `\n[SOUL RESONANCE: Level ${soulLevel} (${totalFrags} Frags)]`;
            if (nextProgress.fragmentsNeeded > 0) {
                formatted += `\n[Cynthia]: "Gather ${nextProgress.fragmentsNeeded} more monster fragments to ascend to Soul Level ${soulLevel + 1}!"`;
            } else {
                formatted += `\n[Cynthia]: "Thy soul harmonics resonate at peak planetary capacity!"`;
            }
            if (extinctCount >= 6) {
                formatted += `\n[Cynthia]: "Total stellar harmonic convergence! The planetary ley-lines sing in absolute perfection!"`;
            } else if (extinctCount >= 4) {
                formatted += `\n[Cynthia]: "The astral frequencies are singing at peak resonance as major species leave this plane."`;
            } else if (extinctCount >= 2) {
                formatted += `\n[Cynthia]: "The starlight constellations are visibly shifting in your wake, Unit ${heroName}."`;
            }
        } else if (this.dialogueNpc?.id === 'ironspire_surveyor') {
            if (extinctCount >= 4) {
                formatted += `\n[Dane]: "The subterranean shafts are completely safe! We are unearthing pure mythril veins!"`;
            } else if (extinctCount >= 2) {
                formatted += `\n[Dane]: "Our quarry teams can push deeper into the northern peaks without monster ambushes."`;
            }
        } else if (this.dialogueNpc?.id === 'settler_herbalist') {
            if (extinctCount >= 3) {
                formatted += `\n[Mira]: "The valley soil is purified! Without monster corruption, rare starlight flora are blooming."`;
            }
        } else if (this.dialogueNpc?.id === 'king_aurelius') {
            formatted += `\n[ROYAL DISPATCH: ${extinctCount}/6 Species Extinct]`;
            if (extinctCount >= 6) {
                formatted += `\n[Aurelius]: "By the heavens, you have delivered our continent into everlasting peace! The Royal Crown salutes you!"`;
            } else if (extinctCount >= 3) {
                formatted += `\n[Aurelius]: "Word reaches the capital of your valiant crusade. Half of the realm's monsters are now extinct!"`;
            }
        } else if (this.dialogueNpc?.id === 'dungeon_gate_npc') {
            if (GameManager.instance.getQuestState('dungeon_gate_unlocked') === 'completed') {
                formatted = "The massive iron portcullis stands raised! The shortcut between the Royal Keep and the Catacombs is clear.";
            } else if (GameManager.instance.hasItem('dungeon_key')) {
                formatted += "\n[ACTION]: The Iron Skeleton Key fits the ancient skull lock! Press SPACE to unlock and raise the gate.";
            } else {
                formatted += "\n[LOCKED]: A heavy skeleton padlock seals the gate. You need the Iron Skeleton Key from the catacomb coffer to open this shortcut.";
            }
        } else if (this.dialogueNpc?.id === 'dungeon_chest') {
            if (GameManager.instance.getQuestState('dungeon_key_found') === 'completed') {
                formatted = "The ancient iron coffer stands open and empty.";
            }
        }
        return formatted;
    }

    private advanceDialogue() {
        if (!this.dialogueNpc) return;

        this.dialogueIndex++;

        if (this.dialogueIndex < this.dialogueNpc.dialogue.length) {
            SoundSynth.playMenuBlip();
            this.dialogueText?.setText(this.getFormattedDialogueLine(this.dialogueNpc.dialogue[this.dialogueIndex]));

            // Update dynamic Action button: NEXT vs CLOSE on last line
            if (this.dialogueIndex < this.dialogueNpc.dialogue.length - 1) {
                TouchControls.instance.setActionButtonContext({
                    label: 'NEXT',
                    icon: '▶',
                    fillColor: 0x0284c7,
                    strokeColor: 0x38bdf8,
                    pulse: true
                });
            } else {
                TouchControls.instance.setActionButtonContext({
                    label: 'CLOSE',
                    icon: '✓',
                    fillColor: 0x059669,
                    strokeColor: 0x34d399,
                    pulse: true
                });
            }
        } else {
            // Dialogue complete!
            this.endDialogue();
        }
    }

    private endDialogue() {
        this.isDialogueActive = false;

        // Perform dialog rewards/actions
        if (this.dialogueNpc?.id === 'red_mage_npc') {
            // Unlock dungeon if quest is inactive
            if (GameManager.instance.getQuestState('dungeon_unlocked') !== 'completed') {
                GameManager.instance.setQuestState('dungeon_unlocked', 'completed');
                this.updateHUD();

                // Quick bounce animation overlay
                const bounceText = this.add.text(this.player.x, this.player.y - 40, 'Cave Unlocked!', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '24px',
                    color: '#00ffcc',
                    fontStyle: 'bold'
                });
                bounceText.setOrigin(0.5, 0.5);
                this.tweens.add({
                    targets: bounceText,
                    y: bounceText.y - 60,
                    alpha: 0,
                    duration: 2000,
                    onComplete: () => bounceText.destroy()
                });
            }
        }

        if (this.dialogueNpc?.id === 'goblin_npc') {
            if (GameManager.instance.getQuestState('goblin_met') !== 'completed') {
                GameManager.instance.setQuestState('goblin_met', 'completed');
                
                // Show quest complete bounce text
                const bounceText = this.add.text(this.player.x, this.player.y - 40, 'Quest Complete: Find the Goblin!', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '24px',
                    color: '#00ffcc',
                    fontStyle: 'bold'
                });
                bounceText.setOrigin(0.5, 0.5);
                this.tweens.add({
                    targets: bounceText,
                    y: bounceText.y - 60,
                    alpha: 0,
                    duration: 2000,
                    onComplete: () => bounceText.destroy()
                });
            }
        }

        // Sprint 24: Town Healing Stations Network & Sanctuary Attunement
        let healingStationId: string | null = null;
        if (this.dialogueNpc?.id === 'settler_herbalist') {
            healingStationId = 'station_oakhaven';
        } else if (this.dialogueNpc?.id === 'soul_altar') {
            healingStationId = 'station_aetheria';
        } else if (this.dialogueNpc?.id === 'castle_soul_altar') {
            healingStationId = 'station_royal_keep';
        } else if (this.dialogueNpc?.id === 'save_console') {
            healingStationId = (this.currentMapId === 'ironspire_bastion' || this.currentMapId === 'ironspire')
                ? 'station_ironspire'
                : 'station_meteor_pod';
        }

        if (healingStationId) {
            const restResult = GameManager.instance.attuneAndRestAtHealingStation(healingStationId);
            this.updateHUD();

            if (restResult.success) {
                SoundSynth.playSpellCast('heal');
                AccessibilityManager.flashCamera(this.cameras.main, 350, 40, 255, 120);

                const stationName = restResult.station?.name || 'Sanctuary';
                const healText = this.add.text(
                    this.player.x, 
                    this.player.y - 45, 
                    `✨ ATTUNED: ${stationName.toUpperCase()} ✨\n+ALL HP & SP RESTORED • SAVED`, 
                    {
                        fontFamily: '"Courier New", Courier, monospace',
                        fontSize: '20px',
                        color: '#00ffcc',
                        fontStyle: 'bold',
                        stroke: '#002233',
                        strokeThickness: 4,
                        align: 'center'
                    }
                );
                healText.setOrigin(0.5, 0.5);
                healText.setDepth(200);

                this.tweens.add({
                    targets: healText,
                    y: healText.y - 65,
                    alpha: 0,
                    duration: 2500,
                    onComplete: () => healText.destroy()
                });
            } else {
                SoundSynth.playMenuCancel();
                const warnText = this.add.text(
                    this.player.x, 
                    this.player.y - 45, 
                    `🔒 ${restResult.message}`, 
                    {
                        fontFamily: '"Courier New", Courier, monospace',
                        fontSize: '18px',
                        color: '#ff5566',
                        fontStyle: 'bold',
                        stroke: '#330011',
                        strokeThickness: 4,
                        align: 'center'
                    }
                );
                warnText.setOrigin(0.5, 0.5);
                warnText.setDepth(200);

                this.tweens.add({
                    targets: warnText,
                    y: warnText.y - 60,
                    alpha: 0,
                    duration: 2500,
                    onComplete: () => warnText.destroy()
                });
            }
        }

        // Dungeon Chest Key Acquisition
        if (this.dialogueNpc?.id === 'dungeon_chest') {
            if (GameManager.instance.getQuestState('dungeon_key_found') !== 'completed') {
                GameManager.instance.addItem('dungeon_key', 1);
                GameManager.instance.setQuestState('dungeon_key_found', 'completed');
                SoundSynth.playVictory();
                AccessibilityManager.flashCamera(this.cameras.main, 350, 255, 215, 0);

                const keyText = this.add.text(
                    this.player.x,
                    this.player.y - 45,
                    '+OBTAINED: IRON SKELETON KEY!',
                    {
                        fontFamily: '"Courier New", Courier, monospace',
                        fontSize: '22px',
                        color: '#ffd700',
                        fontStyle: 'bold',
                        stroke: '#331a00',
                        strokeThickness: 4
                    }
                );
                keyText.setOrigin(0.5, 0.5);
                keyText.setDepth(200);

                this.tweens.add({
                    targets: keyText,
                    y: keyText.y - 65,
                    alpha: 0,
                    duration: 2500,
                    onComplete: () => keyText.destroy()
                });
            }
        }

        // Dungeon Gate Unlocking
        if (this.dialogueNpc?.id === 'dungeon_gate_npc') {
            if (GameManager.instance.getQuestState('dungeon_gate_unlocked') !== 'completed') {
                if (GameManager.instance.hasItem('dungeon_key')) {
                    GameManager.instance.removeItem('dungeon_key', 1);
                    GameManager.instance.setQuestState('dungeon_gate_unlocked', 'completed');

                    // Remove solid collision wall so player can walk freely through the gate
                    if (this.dungeonGateWall) {
                        this.walls.remove(this.dungeonGateWall, true, true);
                        this.dungeonGateWall = null;
                    }

                    // Update sprite texture to open / raised portcullis with dynamic lift animation
                    if (this.dungeonGateSprite) {
                        this.dungeonGateSprite.setTexture('unlocked_dungeon_door');
                        this.tweens.add({
                            targets: this.dungeonGateSprite,
                            scaleY: { from: 1, to: 0.92 },
                            duration: 350,
                            yoyo: true
                        });
                    }

                    SoundSynth.playFanfare();
                    AccessibilityManager.flashCamera(this.cameras.main, 450, 255, 215, 0);
                    AccessibilityManager.shakeCamera(this.cameras.main, 350, 0.015);

                    const gateText = this.add.text(
                        this.player.x,
                        this.player.y - 45,
                        '>> ANCIENT PORTCULLIS UNLOCKED! <<',
                        {
                            fontFamily: '"Courier New", Courier, monospace',
                            fontSize: '22px',
                            color: '#00ffcc',
                            fontStyle: 'bold',
                            stroke: '#002233',
                            strokeThickness: 4
                        }
                    );
                    gateText.setOrigin(0.5, 0.5);
                    gateText.setDepth(200);

                    this.tweens.add({
                        targets: gateText,
                        y: gateText.y - 65,
                        alpha: 0,
                        duration: 2500,
                        onComplete: () => gateText.destroy()
                    });
                }
            }
        }

        // Master Blacksmith Thorgan Forge Refinement (Ironspire)
        if (this.dialogueNpc?.id === 'settler_blacksmith') {
            const soulLevel = GameManager.instance.getSoulLevel();
            if (soulLevel >= 4) {
                const slots: ('sword' | 'shield' | 'armor' | 'helmet' | 'ring1' | 'ring2' | 'amulet')[] = [
                    'sword', 'shield', 'armor', 'helmet', 'ring1', 'ring2', 'amulet'
                ];
                const refinements = GameManager.instance.getForgeRefinements();
                const eligibleSlot = slots.find(s => (refinements[s] || 0) < 5);
                if (eligibleSlot) {
                    const res = GameManager.instance.refineEquipmentSlot(eligibleSlot);
                    if (res.success) {
                        AccessibilityManager.flashCamera(this.cameras.main, 350, 255, 215, 0);
                        AccessibilityManager.shakeCamera(this.cameras.main, 250, 0.012);
                        this.updateHUD();

                        const forgeText = this.add.text(
                            this.player.x,
                            this.player.y - 45,
                            `+FORGED: ${eligibleSlot.toUpperCase()} (T${res.newTier})!`,
                            {
                                fontFamily: '"Courier New", Courier, monospace',
                                fontSize: '24px',
                                color: '#ffd700',
                                fontStyle: 'bold',
                                stroke: '#331a00',
                                strokeThickness: 4
                            }
                        );
                        forgeText.setOrigin(0.5, 0.5);
                        forgeText.setDepth(200);

                        this.tweens.add({
                            targets: forgeText,
                            y: forgeText.y - 65,
                            alpha: 0,
                            duration: 2500,
                            onComplete: () => forgeText.destroy()
                        });
                    }
                }
            }
        }

        // Arch-Mage Eldrin Boss Soulmeld Ritual (Aetheria)
        if (this.dialogueNpc?.id === 'aetheria_archmage') {
            const soulLevel = GameManager.instance.getSoulLevel();
            if (soulLevel >= 5) {
                const species = ['slime', 'snake', 'bat', 'goblin', 'skeleton', 'phoenix'];
                const melds = GameManager.instance.getBossMelds();
                const eligibleSpecies = species.find(s => GameManager.instance.isSpeciesExtinct(s) && !melds.includes(s));
                if (eligibleSpecies) {
                    const res = GameManager.instance.meldBossSoul(eligibleSpecies);
                    if (res.success) {
                        AccessibilityManager.flashCamera(this.cameras.main, 450, 0, 229, 255);
                        AccessibilityManager.shakeCamera(this.cameras.main, 300, 0.009);
                        this.updateHUD();

                        const meldText = this.add.text(
                            this.player.x,
                            this.player.y - 45,
                            `+BOSS SOUL MELDED: ${eligibleSpecies.toUpperCase()}!`,
                            {
                                fontFamily: '"Courier New", Courier, monospace',
                                fontSize: '22px',
                                color: '#00ffff',
                                fontStyle: 'bold',
                                stroke: '#002233',
                                strokeThickness: 4
                            }
                        );
                        meldText.setOrigin(0.5, 0.5);
                        meldText.setDepth(200);

                        this.tweens.add({
                            targets: meldText,
                            y: meldText.y - 65,
                            alpha: 0,
                            duration: 2500,
                            onComplete: () => meldText.destroy()
                        });
                    }
                }
            }
        }

        // Farmer Bran Harvest Feast (Oakhaven)
        if (this.dialogueNpc?.id === 'oakhaven_farmer') {
            GameManager.instance.fullHealParty();
            this.updateHUD();
            AccessibilityManager.flashCamera(this.cameras.main, 300, 50, 255, 100);

            const feastText = this.add.text(
                this.player.x,
                this.player.y - 45,
                '+HARVEST FEAST: VITALS 100%!',
                {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '22px',
                    color: '#55ff55',
                    fontStyle: 'bold',
                    stroke: '#003311',
                    strokeThickness: 4
                }
            );
            feastText.setOrigin(0.5, 0.5);
            feastText.setDepth(200);

            this.tweens.add({
                targets: feastText,
                y: feastText.y - 65,
                alpha: 0,
                duration: 2200,
                onComplete: () => feastText.destroy()
            });
        }

        // Merchant Lin Trade Goods (Oakhaven)
        if (this.dialogueNpc?.id === 'oakhaven_merchant') {
            GameManager.instance.addItem('potion_hp', 1);
            this.updateHUD();
            AccessibilityManager.flashCamera(this.cameras.main, 250, 255, 220, 100);

            const tradeText = this.add.text(
                this.player.x,
                this.player.y - 45,
                '+TRADE POTION RECEIVED!',
                {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '22px',
                    color: '#ffcc00',
                    fontStyle: 'bold',
                    stroke: '#332200',
                    strokeThickness: 4
                }
            );
            tradeText.setOrigin(0.5, 0.5);
            tradeText.setDepth(200);

            this.tweens.add({
                targets: tradeText,
                y: tradeText.y - 65,
                alpha: 0,
                duration: 2200,
                onComplete: () => tradeText.destroy()
            });
        }

        // Clean up UI objects
        this.dialogueBox?.destroy();
        this.dialogueText?.destroy();
        this.dialogueNameText?.destroy();
        this.dialoguePromptText?.destroy();

        this.dialogueNpc = null;

        // Restore menu button visibility
        TouchControls.instance.setMenuDimmed(false);

        // Re-evaluate immediate surroundings for dynamic touch button context
        this.checkNPCProximity();

        // Reset keys so they don't immediately slide if they were holding them
        if (this.input.keyboard) {
            this.input.keyboard.resetKeys();
        }
    }

    private updateHUD() {
        const calculated = GameManager.instance.getHeroCalculatedStats();
        this.hudText.setText(
            `Hero: ${calculated.name} | Soul LV: ${calculated.level} | HP: ${calculated.hp}/${calculated.maxHp} | SP: ${calculated.sp}/${calculated.maxSp}`
        );
    }

    private openMenu() {
        if (this.player && this.player.body) {
            this.player.setVelocity(0);
        }
        LicenseManager.instance.pauseTimer();
        this.scene.pause('OverworldScene');
        this.scene.launch('MenuScene');
    }

    private updateDemoTimerHUD() {
        if (!this.demoTimerText) return;
        if (LicenseManager.instance.isCommercial()) {
            this.demoTimerText.setText('\u{1F451} COMMERCIAL');
            this.demoTimerText.setColor('#ffd700');
            this.demoTimerText.setVisible(true);
        } else {
            // Demo timer removed — keep element hidden
            this.demoTimerText.setVisible(false);
        }
    }



    private triggerCommercialCelebration() {
        SoundSynth.playFanfare();
        AccessibilityManager.flashCamera(this.cameras.main, 600, 255, 215, 0);
        this.updateDemoTimerHUD();

        const banner = this.add.text(
            this.cameras.main.width / 2,
            120,
            '✨ COMMERCIAL EDITION UNLOCKED! ✨\nDimensional barriers collapsed. Soul harvesting uncapped!',
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '22px',
                color: '#ffd700',
                backgroundColor: '#0a0a16ee',
                padding: { x: 24, y: 12 },
                align: 'center',
                lineSpacing: 8
            }
        );
        banner.setOrigin(0.5, 0.5);
        banner.setScrollFactor(0);
        banner.setDepth(250);

        this.tweens.add({
            targets: banner,
            alpha: 0,
            y: 80,
            delay: 4500,
            duration: 1500,
            onComplete: () => banner.destroy()
        });
    }

    private openBattleScene() {
        const monster = rollEncounter(this.currentMapId) || MonsterDatabase['slime'];
        this.startBattleEncounter(monster);
    }

    private checkRandomEncounters() {
        if (!this.player || !this.currentMap || this.isTransitioning || this.isDialogueActive) return;

        let currentGridX = Math.floor(this.player.x / 64);
        let currentGridY = Math.floor(this.player.y / 64);

        if (this.isToroidalMap) {
            currentGridX = ((currentGridX % 100) + 100) % 100;
            currentGridY = ((currentGridY % 100) + 100) % 100;
        }

        if (currentGridX !== this.lastGridX || currentGridY !== this.lastGridY) {
            this.lastGridX = currentGridX;
            this.lastGridY = currentGridY;

            // Bounds check
            if (
                currentGridY >= 0 && 
                currentGridY < this.currentMap.grid.length && 
                currentGridX >= 0 && 
                currentGridX < this.currentMap.grid[0].length
            ) {
                const tileType = this.currentMap.grid[currentGridY][currentGridX];

                // Determine encounter zone type:
                // - 'tallgrass': Tile 2 on world_map — full encounter table (5–10 steps)
                // - 'lowgrass':  Tile 0 on world_map — starter-only table, slime+snake only (10–18 steps)
                // - 'dungeon':   Tile 4 on dungeon maps — dungeon encounter table (5–10 steps)
                // - 'none':      All other tiles (paths, walls, town floors, etc.)
                let encounterZone: 'tallgrass' | 'lowgrass' | 'dungeon' | 'none' = 'none';

                if (this.currentMapId === 'world_map') {
                    if (tileType === 2) {
                        encounterZone = 'tallgrass';
                    } else if (tileType === 0) {
                        // Plain grass — gentle beginner encounters (Slime & Heal Snake only)
                        encounterZone = 'lowgrass';
                    }
                } else if (
                    (this.currentMapId === 'dungeon_map' || this.currentMapId === 'dungeon_floor2') &&
                    tileType === 4
                ) {
                    encounterZone = 'dungeon';
                }

                if (encounterZone !== 'none') {
                    if (this.encounterGraceSteps > 0) {
                        this.encounterGraceSteps--;
                        return;
                    }

                    this.encounterStepsRemaining--;

                    if (this.encounterStepsRemaining <= 0) {
                        if (encounterZone === 'lowgrass') {
                            // Low grass: same cadence as tall grass — only Slime & Heal Snake (starter-friendly)
                            this.encounterStepsRemaining = Phaser.Math.Between(this.minEncounterSteps, this.maxEncounterSteps);
                            const monster = rollEncounter('world_map_lowgrass');
                            if (monster) {
                                this.startBattleEncounter(monster);
                            }
                        } else {
                            // Tall grass / dungeon: normal cadence (5–10 steps)
                            this.encounterStepsRemaining = Phaser.Math.Between(this.minEncounterSteps, this.maxEncounterSteps);
                            const mapKey = (encounterZone === 'tallgrass') ? this.currentMapId : this.currentMapId;
                            const monster = rollEncounter(mapKey);
                            if (monster) {
                                this.startBattleEncounter(monster);
                            }
                        }
                    }
                }
            }
        }
    }


    private startBattleEncounter(monster: MonsterStats, isBoss: boolean = false) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        SoundSynth.stopBgm(300);

        if (this.player) {
            this.player.setVelocity(0);
        }

        // 1. Camera Shake and Flash FX (Accessibility-aware)
        AccessibilityManager.shakeCamera(this.cameras.main, 300, isBoss ? 0.04 : 0.025);
        AccessibilityManager.flashCamera(this.cameras.main, 300, isBoss ? 255 : 255, isBoss ? 50 : 255, isBoss ? 50 : 255);

        // 2. Fade to black and launch BattleScene
        this.time.delayedCall(300, () => {
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.isTransitioning = false;
                this.scene.pause('OverworldScene');
                this.scene.launch('BattleScene', { monster, isBoss });
            });
        });
    }

    private spawnEndangeredAlphaBosses() {
        // Clear previous bosses
        this.alphaBossSprites.forEach(s => s.destroy());
        this.alphaBossSprites = [];
        this.alphaBossTweens.forEach(t => t.destroy());
        this.alphaBossTweens = [];

        const state = GameManager.instance.getState();
        const tileSize = 64;

        // Species habitat definitions for Alpha Bosses across the 100x100 world
        const worldMapBosses = [
            { speciesId: 'keenkat', gridX: 52, gridY: 48, spriteKey: 'keenkat' },
            { speciesId: 'slime', gridX: 68, gridY: 52, spriteKey: 'slime' },
            { speciesId: 'snake', gridX: 70, gridY: 44, spriteKey: 'snake' },
            { speciesId: 'bat', gridX: 55, gridY: 24, spriteKey: 'bat' },
            { speciesId: 'phoenix', gridX: 58, gridY: 11, spriteKey: 'phoenix' }
        ];

        const dungeonMapBosses = [
            { speciesId: 'goblin', gridX: 15, gridY: 8, spriteKey: 'goblin' },
            { speciesId: 'skeleton', gridX: 19, gridY: 4, spriteKey: 'skeleton' }
        ];

        const relevantBosses = this.currentMapId === 'world_map' ? worldMapBosses : (this.currentMapId === 'dungeon_map' ? dungeonMapBosses : []);

        relevantBosses.forEach(b => {
            const crystalState = state.soulCrystals[b.speciesId];
            if (crystalState && crystalState.fragments >= 254 && !crystalState.isExtinct) {
                const bossSprite = this.physics.add.sprite(
                    b.gridX * tileSize + tileSize / 2,
                    b.gridY * tileSize + tileSize / 2,
                    b.spriteKey
                );
                bossSprite.setScale(1.6);
                bossSprite.setTint(0xff3366);
                bossSprite.setDepth(6);
                bossSprite.setData('speciesId', b.speciesId);

                // Pulsing glow animation
                const tween = this.tweens.add({
                    targets: bossSprite,
                    scale: 1.85,
                    duration: 550,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                this.alphaBossSprites.push(bossSprite);
                this.alphaBossTweens.push(tween);
            }
        });
    }

    private checkAlphaBossProximity() {
        if (!this.player || this.alphaBossSprites.length === 0 || this.isTransitioning || this.isDialogueActive) return;

        for (const boss of this.alphaBossSprites) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y);
            if (dist < 72) {
                const speciesId = boss.getData('speciesId');
                const bossData = getAlphaBoss(speciesId);
                SoundSynth.playBossRoar();
                
                this.startDialogue({
                    id: `alpha_boss_${speciesId}`,
                    name: `★ ${bossData.name.toUpperCase()}`,
                    spriteKey: bossData.spriteKey,
                    gridX: Math.floor(boss.x / 64),
                    gridY: Math.floor(boss.y / 64),
                    dialogue: [
                        `[ENDANGERED ALPHA SPECIES DETECTED]`,
                        `The last remaining Alpha ${bossData.name} roars with desperate fury!`,
                        `Defeat this Alpha specimen to certify complete extinction!`
                    ]
                });

                // When dialogue finishes, launch boss combat
                this.time.delayedCall(800, () => {
                    this.startBattleEncounter(bossData, true);
                });
                break;
            }
        }
    }

    private spawnSpecialQuestBosses() {
        this.specialBossSprites.forEach(s => s.destroy());
        this.specialBossSprites = [];
        this.specialBossTweens.forEach(t => t.destroy());
        this.specialBossTweens = [];

        const tileSize = 64;

        // Astral Scavenger Prologue Crater Boss (Sprint 25 / Sprint 29)
        if (this.currentMapId === 'world_map' && !GameManager.instance.hasEarringsUnlocked()) {
            const scavengerSprite = this.physics.add.sprite(
                48 * tileSize + tileSize / 2,
                44 * tileSize + tileSize / 2,
                'bat'
            );
            scavengerSprite.setScale(1.75);
            scavengerSprite.setTint(0x8a2be2); // Cosmic void violet
            scavengerSprite.setDepth(6);
            scavengerSprite.setData('bossId', 'astral_scavenger');

            const pulseTween = this.tweens.add({
                targets: scavengerSprite,
                scale: 1.95,
                duration: 650,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            this.specialBossSprites.push(scavengerSprite);
            this.specialBossTweens.push(pulseTween);
        }
    }

    private checkSpecialBossProximity() {
        if (!this.player || this.specialBossSprites.length === 0 || this.isTransitioning || this.isDialogueActive) return;

        for (const boss of this.specialBossSprites) {
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, boss.x, boss.y);
            if (dist < 72) {
                const bossId = boss.getData('bossId');
                if (bossId === 'astral_scavenger') {
                    const bossData = getSpecialBoss('astral_scavenger');
                    SoundSynth.playBossRoar();

                    this.startDialogue({
                        id: 'boss_astral_scavenger',
                        name: '★ ASTRAL SCAVENGER',
                        spriteKey: 'bat',
                        gridX: 48,
                        gridY: 44,
                        dialogue: [
                            '[CRATER RIM: HOSTILE DETECTED]',
                            'An eldritch cosmic scavenger perches upon the crater ridge, clutching your lost Astral Earrings!',
                            'Defeat the beast to recover the 8th equipment slot and awaken your Pet Conduit!'
                        ]
                    });

                    this.time.delayedCall(800, () => {
                        this.startBattleEncounter(bossData, true);
                    });
                }
                break;
            }
        }
    }

    private spawnCataclysmBoss() {
        // Destroy previous sprite/tween if present (e.g. map reload)
        if (this.cataclysmBossSprite) {
            if (this.cataclysmBossTween) { this.cataclysmBossTween.destroy(); this.cataclysmBossTween = null; }
            this.cataclysmBossSprite.destroy();
            this.cataclysmBossSprite = null;
        }

        // Only spawn on world_map, only when climax triggered AND boss not yet defeated
        if (
            this.currentMapId !== 'world_map' ||
            !GameManager.instance.isFinalBossUnlocked() ||
            GameManager.instance.isCataclysmBossDefeated()
        ) return;

        const tileSize = 64;
        // Epicenter of the world — tile (50, 50)
        const sprite = this.physics.add.sprite(
            50 * tileSize + tileSize / 2,
            50 * tileSize + tileSize / 2,
            'phoenix'
        );
        sprite.setScale(2.5);
        sprite.setTint(0xff0055); // Blood crimson
        sprite.setDepth(7); // Above alpha bosses (depth 6)
        sprite.setData('bossId', 'cataclysm');

        // Dramatic slow pulse — more ominous than alpha bosses
        const tween = this.tweens.add({
            targets: sprite,
            scale: 3.1,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.cataclysmBossSprite = sprite;
        this.cataclysmBossTween = tween;
    }

    private checkCataclysmBossProximity() {
        if (
            !this.player ||
            !this.cataclysmBossSprite ||
            this.isTransitioning ||
            this.isDialogueActive
        ) return;

        const dist = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            this.cataclysmBossSprite.x, this.cataclysmBossSprite.y
        );

        if (dist < 96) {
            SoundSynth.playBossRoar();

            this.startDialogue({
                id: 'boss_cataclysm',
                name: '\u2620 CATACLYSM',
                spriteKey: 'phoenix',
                gridX: 50,
                gridY: 50,
                dialogue: [
                    '[EXTINCTION ENGINE DETECTED — SINGULARITY THRESHOLD]',
                    'The accumulated extinction energy has coalesced into a terrifying sentient force.',
                    'This is Cataclysm — a perfect mirror of your power forged from every soul you have destroyed.',
                    'Its strength equals yours at maximum extinction. Only your infused gear gives you the edge.',
                    'Defeat it before the last species vanish, or it will consume everything that remains.'
                ]
            });

            this.time.delayedCall(800, () => {
                const bossData = GameManager.computeCataclysmBossStats();
                this.startBattleEncounter(bossData, true);
            });
        }
    }

    private createInteractionBubble() {
        const width = 100;
        const height = 32;
        
        // 1. Graphics for bubble background and tail
        const graphics = this.add.graphics();
        graphics.fillStyle(0x0f0f1b, 0.95);
        graphics.lineStyle(2, 0x00ffcc, 1);
        
        // Rounded rect for bubble
        graphics.fillRoundedRect(-width / 2, -height / 2 - 5, width, height, 8);
        graphics.strokeRoundedRect(-width / 2, -height / 2 - 5, width, height, 8);
        
        // Triangular pointer/tail pointing down
        graphics.fillStyle(0x0f0f1b, 0.95);
        graphics.beginPath();
        graphics.moveTo(-8, -5);
        graphics.lineTo(8, -5);
        graphics.lineTo(0, 5);
        graphics.closePath();
        graphics.fill();
        graphics.strokePath();

        // 2. Text label
        const text = this.add.text(0, -height / 2 + 11, '💬 SPACE', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        text.setOrigin(0.5, 0.5);

        // 3. Container
        this.interactionBubble = this.add.container(0, 0, [graphics, text]);
        this.interactionBubble.setDepth(12);
        this.interactionBubble.setAlpha(0);
        this.interactionBubble.setVisible(false);
    }

    private showInteractionBubble(targetSprite: Phaser.GameObjects.Sprite) {
        const targetX = targetSprite.x;
        const targetY = targetSprite.y - 56; // Position above NPC head

        if (this.interactionBubble.visible && this.interactionBubble.getData('target') === targetSprite) {
            // Keep updating coordinates in case NPC moved (though NPCs are static)
            this.interactionBubble.setPosition(targetX, targetY + (this.interactionBubble.y - targetY));
            return;
        }

        this.interactionBubble.setData('target', targetSprite);
        this.interactionBubble.setPosition(targetX, targetY);
        this.interactionBubble.setVisible(true);

        // Stop any running tweens
        if (this.interactionBubbleTween) {
            this.interactionBubbleTween.destroy();
        }

        // Fade in
        this.tweens.add({
            targets: this.interactionBubble,
            alpha: 1,
            duration: 200,
            ease: 'Power1'
        });

        // Bobbing animation
        this.interactionBubbleTween = this.tweens.add({
            targets: this.interactionBubble,
            y: targetY - 8,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    private hideInteractionBubble() {
        if (this.interactionBubbleTween) {
            this.interactionBubbleTween.destroy();
            this.interactionBubbleTween = null;
        }

        this.interactionBubble.setData('target', null);
        
        // Fade out then hide
        this.tweens.add({
            targets: this.interactionBubble,
            alpha: 0,
            duration: 200,
            ease: 'Power1',
            onComplete: () => {
                this.interactionBubble.setVisible(false);
            }
        });
    }

    private spawnTownEvolutions(soulLevel: number) {
        if (this.currentMapId === 'town_oakhaven' || this.currentMapId === 'town_map') {
            this.spawnOakhavenEvolutions(soulLevel);
        } else if (this.currentMapId === 'town_aetheria') {
            this.spawnAetheriaEvolutions(soulLevel);
        } else if (this.currentMapId === 'town_ironspire') {
            this.spawnIronspireEvolutions(soulLevel);
        }
    }

    private spawnOakhavenEvolutions(soulLevel: number) {
        const tileSize = 64;

        // Level 1+: Scout Kira, Loyal Hound, Street Lanterns
        if (soulLevel >= 1) {
            // Scout Kira at (14, 5)
            const scoutSprite = this.npcsGroup.create(
                14 * tileSize + tileSize / 2,
                5 * tileSize + tileSize / 2,
                'settler_scout'
            );
            scoutSprite.setImmovable(true);
            scoutSprite.setDepth(5);
            scoutSprite.setData('config', {
                id: 'settler_scout',
                name: 'Scout Kira',
                spriteKey: 'settler_scout',
                gridX: 14,
                gridY: 5,
                dialogue: [
                    'Greetings, hunter! Welcome to Oakhaven.',
                    'With the first apex beasts quelled, settlers are arriving in the valley from across the plains.',
                    'We are laying the roots of a permanent home here while you hunt down the remaining predators!'
                ]
            } as NpcConfig);

            // Loyal Hound at (16, 5)
            const dogSprite = this.npcsGroup.create(
                16 * tileSize + tileSize / 2,
                5 * tileSize + tileSize / 2,
                'animal_dog'
            );
            dogSprite.setImmovable(true);
            dogSprite.setDepth(5);
            dogSprite.setData('config', {
                id: 'animal_dog',
                name: 'Loyal Hound',
                spriteKey: 'animal_dog',
                gridX: 16,
                gridY: 5,
                dialogue: [
                    'Woof! *pant pant*',
                    'The hound nudges your hand affectionally, tail wagging with boundless enthusiasm!'
                ]
            } as NpcConfig);

            const dogTween = this.tweens.add({
                targets: dogSprite,
                angle: 4,
                yoyo: true,
                repeat: -1,
                duration: 400
            });
            this.townEvolutionTweens.push(dogTween);

            // Street Lanterns at (9, 5), (16, 4), (13, 8)
            const lanternPositions = [{ x: 9, y: 5 }, { x: 16, y: 4 }, { x: 13, y: 8 }];
            lanternPositions.forEach(pos => {
                const lantern = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_lantern'
                );
                lantern.setImmovable(true);
                lantern.setDepth(4);
                lantern.setData('config', {
                    id: `oakhaven_lantern_${pos.x}_${pos.y}`,
                    name: 'Street Lantern',
                    spriteKey: 'town_lantern',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['A warm amber street lantern casting a cozy, safe glow across Oakhaven.']
                } as NpcConfig);

                const glowTween = this.tweens.add({
                    targets: lantern,
                    alpha: 0.82,
                    yoyo: true,
                    repeat: -1,
                    duration: 1100 + Math.random() * 400
                });
                this.townEvolutionTweens.push(glowTween);
            });
        }

        // Level 2+: Herbalist Mira (Full HP/SP Healing), Calico Cat, Crates, Flowers
        if (soulLevel >= 2) {
            // Herbalist Mira at (7, 13)
            const herbalistSprite = this.npcsGroup.create(
                7 * tileSize + tileSize / 2,
                13 * tileSize + tileSize / 2,
                'settler_herbalist'
            );
            herbalistSprite.setImmovable(true);
            herbalistSprite.setDepth(5);
            herbalistSprite.setData('config', {
                id: 'settler_herbalist',
                name: 'Herbalist Mira',
                spriteKey: 'settler_herbalist',
                gridX: 7,
                gridY: 13,
                dialogue: [
                    'Welcome to the Oakhaven Apothecary, traveler!',
                    'As wild predators retreat, restorative starlight blossoms are blooming all across our southern meadow.',
                    'Drink this fresh herbal tonic—it will completely soothe your wounds and revitalize your spirit!',
                    'Your health and mana reserves have been fully restored!'
                ]
            } as NpcConfig);

            // Calico Cat at (8, 14)
            const catSprite = this.npcsGroup.create(
                8 * tileSize + tileSize / 2,
                14 * tileSize + tileSize / 2,
                'animal_cat'
            );
            catSprite.setImmovable(true);
            catSprite.setDepth(5);
            catSprite.setData('config', {
                id: 'animal_cat',
                name: 'Calico Cat',
                spriteKey: 'animal_cat',
                gridX: 8,
                gridY: 14,
                dialogue: ['Purrrrr... *curls lazily in the sunshine* The cat purrs deeply as you stroke its ears.']
            } as NpcConfig);

            const catTween = this.tweens.add({
                targets: catSprite,
                scaleY: 0.93,
                yoyo: true,
                repeat: -1,
                duration: 900
            });
            this.townEvolutionTweens.push(catTween);

            // Provisions Crates
            [{ x: 5, y: 13 }, { x: 6, y: 13 }, { x: 9, y: 14 }].forEach(pos => {
                const crate = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_crate'
                );
                crate.setImmovable(true);
                crate.setDepth(4);
                crate.setData('config', {
                    id: `oakhaven_crate_${pos.x}_${pos.y}`,
                    name: 'Farm Provisions',
                    spriteKey: 'town_crate',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['Harvest baskets, grain sacks, and farming implements brought in by local homesteaders.']
                } as NpcConfig);
            });

            // Flowerbeds
            [{ x: 6, y: 14 }, { x: 8, y: 13 }, { x: 10, y: 14 }].forEach(pos => {
                const flower = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_flowers'
                );
                flower.setImmovable(true);
                flower.setDepth(3);
                flower.setData('config', {
                    id: `oakhaven_flower_${pos.x}_${pos.y}`,
                    name: 'Starlight Wildflowers',
                    spriteKey: 'town_flowers',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['Sweet-scented starlight flora blooming freely in the safe soils of Oakhaven.']
                } as NpcConfig);

                const flowerTween = this.tweens.add({
                    targets: flower,
                    alpha: 0.85,
                    yoyo: true,
                    repeat: -1,
                    duration: 1400 + Math.random() * 600
                });
                this.townEvolutionTweens.push(flowerTween);
            });
        }

        // Level 3+: Meadow Sheep & Pasture Paddock
        if (soulLevel >= 3) {
            // Meadow Sheep at (18, 14)
            const sheepSprite = this.npcsGroup.create(
                18 * tileSize + tileSize / 2,
                14 * tileSize + tileSize / 2,
                'animal_sheep'
            );
            sheepSprite.setImmovable(true);
            sheepSprite.setDepth(5);
            sheepSprite.setData('config', {
                id: 'animal_sheep',
                name: 'Meadow Sheep',
                spriteKey: 'animal_sheep',
                gridX: 18,
                gridY: 14,
                dialogue: ['Baaaa! *chews happily* The fluffy sheep grazes peaceably inside its wooden pasture paddock.']
            } as NpcConfig);

            const sheepTween = this.tweens.add({
                targets: sheepSprite,
                scaleX: 1.05,
                yoyo: true,
                repeat: -1,
                duration: 1100
            });
            this.townEvolutionTweens.push(sheepTween);

            // Paddock Fences (gate open at 16, 14)
            const fencePositions = [
                { x: 16, y: 13 }, { x: 17, y: 13 }, { x: 18, y: 13 }, { x: 19, y: 13 }, { x: 20, y: 13 },
                { x: 20, y: 14 }, { x: 20, y: 15 }, { x: 19, y: 15 }, { x: 18, y: 15 }, { x: 17, y: 15 }, { x: 16, y: 15 }
            ];
            fencePositions.forEach(pos => {
                const fence = this.physics.add.staticImage(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_fence'
                );
                fence.setDepth(4);
                this.walls.add(fence);
            });
        }

        // Level 4+: Farmer Bran & Harvest Trade Cart
        if (soulLevel >= 4) {
            // Farmer Bran at (10, 14)
            const farmerSprite = this.npcsGroup.create(
                10 * tileSize + tileSize / 2,
                14 * tileSize + tileSize / 2,
                'settler_farmer'
            );
            farmerSprite.setImmovable(true);
            farmerSprite.setDepth(5);
            farmerSprite.setData('config', {
                id: 'oakhaven_farmer',
                name: 'Farmer Bran',
                spriteKey: 'settler_farmer',
                gridX: 10,
                gridY: 14,
                dialogue: [
                    'Howdy, Unit Swift! The southern fields are safer than ever.',
                    'With the monster species thinning out, our granaries are brimming with golden wheat and sun-berries!',
                    'Eat your fill of our farm harvest—full vitals replenished!'
                ]
            } as NpcConfig);

            // Harvest Cart at (12, 14)
            const cart = this.npcsGroup.create(
                12 * tileSize + tileSize / 2,
                14 * tileSize + tileSize / 2,
                'town_cart'
            );
            cart.setImmovable(true);
            cart.setDepth(4);
            cart.setData('config', {
                id: 'oakhaven_cart',
                name: 'Harvest Provisions Cart',
                spriteKey: 'town_cart',
                gridX: 12,
                gridY: 14,
                dialogue: ['A sturdy wagon loaded with fresh crops, sun-berries, and grain sacks from the valley fields.']
            } as NpcConfig);
        }

        // Level 5+: Merchant Lin & Trade Outpost
        if (soulLevel >= 5) {
            // Merchant Lin at (16, 8)
            const merchantSprite = this.npcsGroup.create(
                16 * tileSize + tileSize / 2,
                8 * tileSize + tileSize / 2,
                'settler_merchant'
            );
            merchantSprite.setImmovable(true);
            merchantSprite.setDepth(5);
            merchantSprite.setData('config', {
                id: 'oakhaven_merchant',
                name: 'Merchant Lin',
                spriteKey: 'settler_merchant',
                gridX: 16,
                gridY: 8,
                dialogue: [
                    'Greetings, heroic traveler! I am Lin, trade envoy from the southern merchant guild.',
                    'The highways between Oakhaven, Aetheria, and Ironspire are secure at last thanks to your tireless vanguard.',
                    'Take this revitalizing trade potion for your journey!'
                ]
            } as NpcConfig);

            // Trade Crate at (17, 8)
            const tradeCrate = this.npcsGroup.create(
                17 * tileSize + tileSize / 2,
                8 * tileSize + tileSize / 2,
                'town_crate'
            );
            tradeCrate.setImmovable(true);
            tradeCrate.setDepth(4);
            tradeCrate.setData('config', {
                id: 'oakhaven_trade_crate',
                name: 'Silk & Trade Wares',
                spriteKey: 'town_crate',
                gridX: 17,
                gridY: 8,
                dialogue: ['Imported silks, exotic perfumes, and trade draughts brought in by Merchant Lin.']
            } as NpcConfig);
        }

        // Level 6: Sanctuary Bell Tower & Continental Liberation
        if (soulLevel >= 6) {
            // Sanctuary Bell Tower at (9, 4)
            const bellTower = this.npcsGroup.create(
                9 * tileSize + tileSize / 2,
                4 * tileSize + tileSize / 2,
                'town_bell_tower'
            );
            bellTower.setImmovable(true);
            bellTower.setDepth(5);
            bellTower.setData('config', {
                id: 'oakhaven_belfry',
                name: 'Sanctuary Bell Tower',
                spriteKey: 'town_bell_tower',
                gridX: 9,
                gridY: 4,
                dialogue: [
                    'Toll the golden bells of Oakhaven!',
                    'The planet-wide blight has been completely eradicated by Unit Swift.',
                    'A monumental tower erected in eternal gratitude by the liberated citizens of the valley.'
                ]
            } as NpcConfig);

            const bellTween = this.tweens.add({
                targets: bellTower,
                scale: 1.03,
                yoyo: true,
                repeat: -1,
                duration: 2000
            });
            this.townEvolutionTweens.push(bellTween);
        }
    }

    private spawnAetheriaEvolutions(soulLevel: number) {
        const tileSize = 64;

        // Level 1+: Soul Altar, Astrologer Cynthia, Lanterns
        if (soulLevel >= 1) {
            // Soul Altar at (10, 6)
            const altarSprite = this.npcsGroup.create(
                10 * tileSize + tileSize / 2,
                6 * tileSize + tileSize / 2,
                'soul_altar'
            );
            altarSprite.setImmovable(true);
            altarSprite.setDepth(5);
            altarSprite.setData('config', {
                id: 'soul_altar',
                name: 'Aetherian Soul Altar',
                spriteKey: 'soul_altar',
                gridX: 10,
                gridY: 6,
                dialogue: [
                    '[AETHERIAN SOUL MONOLITH]',
                    'The altar resonates in perfect harmony with your captured monster souls.',
                    'The localized ecosystem frequency has been permanently etched into the stone.'
                ]
            } as NpcConfig);

            const altarTween = this.tweens.add({
                targets: altarSprite,
                alpha: 0.85,
                yoyo: true,
                repeat: -1,
                duration: 1200
            });
            this.townEvolutionTweens.push(altarTween);

            // Astrologer Cynthia at (12, 6)
            const mysticSprite = this.npcsGroup.create(
                12 * tileSize + tileSize / 2,
                6 * tileSize + tileSize / 2,
                'settler_mystic'
            );
            mysticSprite.setImmovable(true);
            mysticSprite.setDepth(5);
            mysticSprite.setData('config', {
                id: 'settler_mystic',
                name: 'Astrologer Cynthia',
                spriteKey: 'settler_mystic',
                gridX: 12,
                gridY: 6,
                dialogue: [
                    'Greetings, bearer of celestial fragments. Welcome to Aetheria.',
                    'I track the constellation shifts caused by your hunt. With each apex predator culled, ancient ley lines awaken.',
                    'This sacred grove serves as a nexus of crystal resonance. Commune with the Soul Altar whenever you seek sanctuary!'
                ]
            } as NpcConfig);

            // Aether Lanterns at (7, 5), (13, 5), (10, 9)
            [{ x: 7, y: 5 }, { x: 13, y: 5 }, { x: 10, y: 9 }].forEach(pos => {
                const lantern = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_lantern'
                );
                lantern.setImmovable(true);
                lantern.setDepth(4);
                lantern.setData('config', {
                    id: `aetheria_lantern_${pos.x}_${pos.y}`,
                    name: 'Starlight Lantern',
                    spriteKey: 'town_lantern',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['An enchanted sylvan lamp radiating pure starlight essence.']
                } as NpcConfig);

                const glowTween = this.tweens.add({
                    targets: lantern,
                    alpha: 0.8,
                    yoyo: true,
                    repeat: -1,
                    duration: 1300 + Math.random() * 500
                });
                this.townEvolutionTweens.push(glowTween);
            });
        }

        // Level 2+: Starlight Alchemist, Pulsing Aether Crystals, Familiar, Flowers
        if (soulLevel >= 2) {
            // Starlight Alchemist at (6, 8)
            const alchemistSprite = this.npcsGroup.create(
                6 * tileSize + tileSize / 2,
                8 * tileSize + tileSize / 2,
                'settler_herbalist'
            );
            alchemistSprite.setImmovable(true);
            alchemistSprite.setDepth(5);
            alchemistSprite.setData('config', {
                id: 'aetheria_alchemist',
                name: 'Alchemist Vesper',
                spriteKey: 'settler_herbalist',
                gridX: 6,
                gridY: 8,
                dialogue: [
                    'The ether here is intoxicating! Pure celestial mana flows through the soil.',
                    'I am distilling pure monster essences into crystalline draughts.',
                    'Soon our arcane laboratory will unlock permanent stat augmentations for your journey!'
                ]
            } as NpcConfig);

            // 3 Pulsing Aether Crystals at (6, 4), (14, 4), (10, 10)
            [{ x: 6, y: 4 }, { x: 14, y: 4 }, { x: 10, y: 10 }].forEach(pos => {
                const crystal = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_crystal'
                );
                crystal.setImmovable(true);
                crystal.setDepth(4);
                crystal.setData('config', {
                    id: `aether_crystal_${pos.x}_${pos.y}`,
                    name: 'Resonating Aether Crystal',
                    spriteKey: 'town_crystal',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['A cluster of luminescent crystals vibrating in sympathy with your collected soul fragments.']
                } as NpcConfig);

                const crystalTween = this.tweens.add({
                    targets: crystal,
                    scale: 1.1,
                    alpha: 0.9,
                    yoyo: true,
                    repeat: -1,
                    duration: 1500 + Math.random() * 500
                });
                this.townEvolutionTweens.push(crystalTween);
            });

            // Spirit Cat Familiar at (13, 8)
            const catSprite = this.npcsGroup.create(
                13 * tileSize + tileSize / 2,
                8 * tileSize + tileSize / 2,
                'animal_cat'
            );
            catSprite.setImmovable(true);
            catSprite.setDepth(5);
            catSprite.setData('config', {
                id: 'aetheria_cat',
                name: 'Spirit Familiar',
                spriteKey: 'animal_cat',
                gridX: 13,
                gridY: 8,
                dialogue: ['Mewww... *eyes shimmer with faint starlight* The familiar nuzzles you with warm arcane energy.']
            } as NpcConfig);

            // Starlight Flowers at (7, 7), (13, 7), (10, 5)
            [{ x: 7, y: 7 }, { x: 13, y: 7 }, { x: 10, y: 5 }].forEach(pos => {
                const flower = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_flowers'
                );
                flower.setImmovable(true);
                flower.setDepth(3);
                flower.setData('config', {
                    id: `aetheria_flower_${pos.x}_${pos.y}`,
                    name: 'Mana Blossom',
                    spriteKey: 'town_flowers',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['Enchanted blossoms drinking arcane energy directly from the Aetherian grove.']
                } as NpcConfig);
            });
        }

        // Level 3+: Arch-Mage & Mana Ward Barriers
        if (soulLevel >= 3) {
            // Arch-Mage at (10, 3)
            const mageSprite = this.npcsGroup.create(
                10 * tileSize + tileSize / 2,
                3 * tileSize + tileSize / 2,
                'settler_mystic'
            );
            mageSprite.setImmovable(true);
            mageSprite.setDepth(5);
            mageSprite.setData('config', {
                id: 'aetheria_archmage',
                name: 'Arch-Mage Eldrin',
                spriteKey: 'settler_mystic',
                gridX: 10,
                gridY: 3,
                dialogue: soulLevel >= 5 ? [
                    'Greetings, sovereign Hunt Unit Swift! The Grand Arcane Nexus has awakened.',
                    'Bring me the extinct core of any Alpha Boss, and my ritual will meld its celestial matrix directly into your 7 equipment artifacts!',
                    'Witness the harmonic convergence of bio-mechanics and cosmic starlight!'
                ] : [
                    'Magnificent work, Hunt Unit Swift! Multiple apex monster species have been suppressed.',
                    'The cosmic resonance across Aetheria is growing in power. Our ward barriers protect the grove against any bio-escape.',
                    'At Soul Level 5, my research will grant you the power to meld apex boss souls directly into your 7 equipment artifacts!'
                ]
            } as NpcConfig);

            // Mana Ward Barrier Posts along northern sanctum
            [{ x: 6, y: 3 }, { x: 7, y: 3 }, { x: 13, y: 3 }, { x: 14, y: 3 }].forEach(pos => {
                const ward = this.physics.add.staticImage(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_fence'
                );
                ward.setDepth(4);
                this.walls.add(ward);
            });
        }

        // Level 4+: Grand Arcane Nexus Crystal
        if (soulLevel >= 4) {
            // Grand Nexus at (10, 5)
            const nexus = this.npcsGroup.create(
                10 * tileSize + tileSize / 2,
                5 * tileSize + tileSize / 2,
                'town_nexus_crystal'
            );
            nexus.setImmovable(true);
            nexus.setDepth(5);
            nexus.setData('config', {
                id: 'aetheria_nexus',
                name: 'Grand Arcane Nexus',
                spriteKey: 'town_nexus_crystal',
                gridX: 10,
                gridY: 5,
                dialogue: [
                    '[GRAND ARCANE NEXUS CRUCIBLE]',
                    'A monumental prismatic crystal resonating with continental ley-lines.',
                    'The starlight matrix hums with infinite cosmic energy.'
                ]
            } as NpcConfig);

            const nexusTween = this.tweens.add({
                targets: nexus,
                scale: 1.08,
                alpha: 0.92,
                yoyo: true,
                repeat: -1,
                duration: 1600
            });
            this.townEvolutionTweens.push(nexusTween);
        }

        // Level 5+: Arch-Mage Eldrin Boss Soulmeld Ritual & Resonator Pylons
        if (soulLevel >= 5) {
            // Starlight Ward Pylons at (8, 3) and (12, 3) flanking Eldrin
            [{ x: 8, y: 3 }, { x: 12, y: 3 }].forEach(pos => {
                const crystal = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_crystal'
                );
                crystal.setImmovable(true);
                crystal.setDepth(4);
                crystal.setData('config', {
                    id: `aetheria_pylon_${pos.x}_${pos.y}`,
                    name: 'Starlight Resonator Pylon',
                    spriteKey: 'town_crystal',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['A focused pylon channeling cosmic mana into Arch-Mage Eldrin\'s melding circle.']
                } as NpcConfig);
            });
        }

        // Level 6: Astral Ley-line Gateway (Pillars & Cosmic Prophecy)
        if (soulLevel >= 6) {
            // Cosmic Pillars at (9, 2) and (11, 2)
            [{ x: 9, y: 2 }, { x: 11, y: 2 }].forEach(pos => {
                const arch = this.physics.add.staticImage(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'portal_rune_arch'
                );
                arch.setDepth(4);
                this.walls.add(arch);
            });
        }
    }

    private spawnIronspireEvolutions(soulLevel: number) {
        const tileSize = 64;

        // Level 1+: Mountain Surveyor, Roaring Braziers, Crates, Guard Hound
        if (soulLevel >= 1) {
            // Mountain Surveyor at (12, 6)
            const surveyorSprite = this.npcsGroup.create(
                12 * tileSize + tileSize / 2,
                6 * tileSize + tileSize / 2,
                'settler_scout'
            );
            surveyorSprite.setImmovable(true);
            surveyorSprite.setDepth(5);
            surveyorSprite.setData('config', {
                id: 'ironspire_surveyor',
                name: 'Surveyor Dane',
                spriteKey: 'settler_scout',
                gridX: 12,
                gridY: 6,
                dialogue: [
                    'Watch your footing, warrior! Welcome to the Ironspire mountain outpost.',
                    'These peaks are loaded with high-density iron ore and volcanic slate.',
                    'With the first species culled, our quarry teams can finally tap these rich mineral veins in safety!'
                ]
            } as NpcConfig);

            // Guard Hound at (13, 7)
            const houndSprite = this.npcsGroup.create(
                13 * tileSize + tileSize / 2,
                7 * tileSize + tileSize / 2,
                'animal_dog'
            );
            houndSprite.setImmovable(true);
            houndSprite.setDepth(5);
            houndSprite.setData('config', {
                id: 'ironspire_hound',
                name: 'Quarry Guard Dog',
                spriteKey: 'animal_dog',
                gridX: 13,
                gridY: 7,
                dialogue: ['Woof! *sniffs alertly* The guard dog stands proudly vigilant over the mountain quarry.']
            } as NpcConfig);

            // 3 Roaring Braziers at (7, 5), (13, 5), (10, 9)
            [{ x: 7, y: 5 }, { x: 13, y: 5 }, { x: 10, y: 9 }].forEach(pos => {
                const brazier = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_brazier'
                );
                brazier.setImmovable(true);
                brazier.setDepth(4);
                brazier.setData('config', {
                    id: `ironspire_brazier_${pos.x}_${pos.y}`,
                    name: 'Roaring Brazier',
                    spriteKey: 'town_brazier',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['A blazing mountain brazier keeping the cold alpine winds at bay.']
                } as NpcConfig);

                const flameTween = this.tweens.add({
                    targets: brazier,
                    alpha: 0.85,
                    yoyo: true,
                    repeat: -1,
                    duration: 800 + Math.random() * 400
                });
                this.townEvolutionTweens.push(flameTween);
            });

            // Heavy Freight Crates at (6, 6), (14, 6)
            [{ x: 6, y: 6 }, { x: 14, y: 6 }].forEach(pos => {
                const crate = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_crate'
                );
                crate.setImmovable(true);
                crate.setDepth(4);
                crate.setData('config', {
                    id: `ironspire_crate_${pos.x}_${pos.y}`,
                    name: 'Ore Crates',
                    spriteKey: 'town_crate',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['Reinforced iron crates packed with pickaxes, dynamite charges, and refined ore ingots.']
                } as NpcConfig);
            });
        }

        // Level 2+: Architect Bowen, Masonry Crates, Fortress Walls
        if (soulLevel >= 2) {
            // Architect Bowen at (12, 7)
            const architectSprite = this.npcsGroup.create(
                12 * tileSize + tileSize / 2,
                7 * tileSize + tileSize / 2,
                'settler_architect'
            );
            architectSprite.setImmovable(true);
            architectSprite.setDepth(5);
            architectSprite.setData('config', {
                id: 'settler_architect',
                name: 'Architect Bowen',
                spriteKey: 'settler_architect',
                gridX: 12,
                gridY: 7,
                dialogue: [
                    'Magnificent timing, Unit Swift! The quarry stone is of peerless quality.',
                    'I am drafting masterwork blueprints for the Grand Forge and Vulcan Bastion.',
                    'The defensive palisades are erected. Soon the blast furnace will ignite!'
                ]
            } as NpcConfig);

            // Masonry stone blocks at (7, 8), (8, 8), (12, 8)
            [{ x: 7, y: 8 }, { x: 8, y: 8 }, { x: 12, y: 8 }].forEach(pos => {
                const crate = this.npcsGroup.create(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_crate'
                );
                crate.setImmovable(true);
                crate.setDepth(4);
                crate.setData('config', {
                    id: `ironspire_masonry_${pos.x}_${pos.y}`,
                    name: 'Chiseled Stone Blocks',
                    spriteKey: 'town_crate',
                    gridX: pos.x,
                    gridY: pos.y,
                    dialogue: ['Carefully cut masonry blocks destined for the Ironspire citadel towers.']
                } as NpcConfig);
            });
        }

        // Level 3+: Master Blacksmith Thorgan, Masterwork Anvil & Forge Perimeter
        if (soulLevel >= 3) {
            // Master Blacksmith Thorgan at (8, 6)
            const smithSprite = this.npcsGroup.create(
                8 * tileSize + tileSize / 2,
                6 * tileSize + tileSize / 2,
                'settler_blacksmith'
            );
            smithSprite.setImmovable(true);
            smithSprite.setDepth(5);
            smithSprite.setData('config', {
                id: 'settler_blacksmith',
                name: 'Master Blacksmith Thorgan',
                spriteKey: 'settler_blacksmith',
                gridX: 8,
                gridY: 6,
                dialogue: soulLevel >= 4 ? [
                    'HA! Welcome to the Grand Forge, warrior! Can you feel that roaring volcanic heat?!',
                    'The blast furnace is blazing and my masterwork hammer is ready to temper your 7 equipment slots with extinction alloys!',
                    'Let me hammer your gear to perfection—feel the true might of Ironspire!'
                ] : [
                    'HA! Welcome to the Grand Forge, warrior! Can you feel that roaring volcanic heat?!',
                    'With monster species suppressed, we have secured high-grade raw metals and soul heat.',
                    'At Soul Level 4, our blast furnace will ignite and I will forge masterwork legendary arms for you!'
                ]
            } as NpcConfig);

            // Masterwork Anvil at (9, 6)
            const anvil = this.npcsGroup.create(
                9 * tileSize + tileSize / 2,
                6 * tileSize + tileSize / 2,
                'town_anvil'
            );
            anvil.setImmovable(true);
            anvil.setDepth(5);
            anvil.setData('config', {
                id: 'ironspire_anvil',
                name: 'Masterwork Anvil',
                spriteKey: 'town_anvil',
                gridX: 9,
                gridY: 6,
                dialogue: [
                    'A massive steel anvil glowing with residual heat from the smelting coals.',
                    'The heart of Ironspire\'s industrial might, waiting for Master Blacksmith Thorgan\'s hammer.'
                ]
            } as NpcConfig);

            // Heavy Iron Fence barricade around the smithy zone (gate open at 7, 6)
            const fencePositions = [
                { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 },
                { x: 10, y: 6 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }, { x: 7, y: 7 }
            ];
            fencePositions.forEach(pos => {
                const fence = this.physics.add.staticImage(
                    pos.x * tileSize + tileSize / 2,
                    pos.y * tileSize + tileSize / 2,
                    'town_fence'
                );
                fence.setDepth(4);
                this.walls.add(fence);
            });
        }

        // Level 4+: Roaring Blast Furnace & Smelting Ore Cart
        if (soulLevel >= 4) {
            // Roaring Blast Furnace at (6, 4)
            const furnace = this.npcsGroup.create(
                6 * tileSize + tileSize / 2,
                4 * tileSize + tileSize / 2,
                'town_furnace'
            );
            furnace.setImmovable(true);
            furnace.setDepth(5);
            furnace.setData('config', {
                id: 'ironspire_furnace',
                name: 'The Grand Blast Furnace',
                spriteKey: 'town_furnace',
                gridX: 6,
                gridY: 4,
                dialogue: [
                    '[THE GRAND BLAST FURNACE]',
                    'Roaring with volcanic heat and smelting high-grade mineral alloys.',
                    'The heart of Ironspire\'s metallurgical supremacy.'
                ]
            } as NpcConfig);

            const furnaceTween = this.tweens.add({
                targets: furnace,
                alpha: 0.88,
                yoyo: true,
                repeat: -1,
                duration: 700
            });
            this.townEvolutionTweens.push(furnaceTween);

            // Smelting Ingot Ore Cart at (5, 6)
            const oreCart = this.npcsGroup.create(
                5 * tileSize + tileSize / 2,
                6 * tileSize + tileSize / 2,
                'town_cart'
            );
            oreCart.setImmovable(true);
            oreCart.setDepth(4);
            oreCart.setData('config', {
                id: 'ironspire_cart',
                name: 'Smelted Ingot Freight Cart',
                spriteKey: 'town_cart',
                gridX: 5,
                gridY: 6,
                dialogue: ['A freight cart loaded with incandescent steel and mythril ingots ready for Master Blacksmith Thorgan.']
            } as NpcConfig);
        }

        // Level 5+: Tempered Weapon Racks & Armory
        if (soulLevel >= 5) {
            const rack = this.npcsGroup.create(
                11 * tileSize + tileSize / 2,
                6 * tileSize + tileSize / 2,
                'town_crate'
            );
            rack.setImmovable(true);
            rack.setDepth(4);
            rack.setData('config', {
                id: 'ironspire_rack',
                name: 'Tempered Weapon Rack',
                spriteKey: 'town_crate',
                gridX: 11,
                gridY: 6,
                dialogue: ['Racks of razor-sharp swords, heavy tower shields, and enchanted plate armor forged with extinction alloys.']
            } as NpcConfig);
        }

        // Level 6: Imperial Fortress Citadel & Warmaster
        if (soulLevel >= 6) {
            const warmaster = this.npcsGroup.create(
                13 * tileSize + tileSize / 2,
                5 * tileSize + tileSize / 2,
                'settler_scout'
            );
            warmaster.setImmovable(true);
            warmaster.setDepth(5);
            warmaster.setData('config', {
                id: 'ironspire_warmaster',
                name: 'Warmaster Kaelen',
                spriteKey: 'settler_scout',
                gridX: 13,
                gridY: 5,
                dialogue: [
                    'SALUTE THE SUPREME WARMASTER! Unit Swift has purified the entire continental landmass!',
                    'Ironspire stands as the undisputed bastion of this world.',
                    'The Grand Forge shall burn eternally in honor of your conquest!'
                ]
            } as NpcConfig);
        }
    }

    /**
     * Sprint 34: Ambient Biome-Specific Environmental Particles.
     */
    private initAmbientParticles() {
        this.ambientMotes = [];
        const count = 28;
        for (let i = 0; i < count; i++) {
            const gfx = this.add.graphics();
            gfx.setDepth(15);
            this.ambientMotes.push({
                gfx,
                vx: Phaser.Math.FloatBetween(-0.4, 0.4),
                vy: Phaser.Math.FloatBetween(-0.6, -0.2),
                baseAlpha: Phaser.Math.FloatBetween(0.3, 0.75)
            });
        }
    }

    private updateAmbientParticles(time: number, _delta: number) {
        if (!this.player || this.ambientMotes.length === 0) return;

        const pGridX = Math.floor(this.player.x / 64);
        const pGridY = Math.floor(this.player.y / 64);
        const cam = this.cameras.main;

        // Biome Palette Selection
        let primaryColor = 0x4ade80; // Green spores (Forest)
        let secondaryColor = 0xfef08a; // Golden pollen
        let isVolcanic = false;
        let isSnowy = false;
        let isAquatic = false;

        if (pGridX >= 38 && pGridX <= 54 && pGridY >= 38 && pGridY <= 54) {
            // Crater Basin: Volcanic embers & rising ash motes
            primaryColor = 0xff4500;
            secondaryColor = 0xfbbf24;
            isVolcanic = true;
        } else if (pGridX >= 45 && pGridX <= 68 && pGridY >= 10 && pGridY <= 38) {
            // Northern Ridge / Catacombs: Highland snow flurries & wind streaks
            primaryColor = 0xe2e8f0;
            secondaryColor = 0x93c5fd;
            isSnowy = true;
        } else if (pGridX >= 30 && pGridX <= 90 && pGridY >= 68 && pGridY <= 99) {
            // Southern Archipelago: Sea breeze mist & aquatic shimmer motes
            primaryColor = 0x38bdf8;
            secondaryColor = 0x67e8f9;
            isAquatic = true;
        }

        const viewLeft = cam.worldView.x - 40;
        const viewRight = cam.worldView.x + cam.worldView.width + 40;
        const viewTop = cam.worldView.y - 40;
        const viewBottom = cam.worldView.y + cam.worldView.height + 40;

        this.ambientMotes.forEach((mote, idx) => {
            let x = mote.gfx.x;
            let y = mote.gfx.y;

            if (x < viewLeft || x > viewRight || y < viewTop || y > viewBottom) {
                // Respawn mote randomly within camera view
                x = Phaser.Math.Between(viewLeft, viewRight);
                y = isVolcanic ? viewBottom - Phaser.Math.Between(0, 80) : Phaser.Math.Between(viewTop, viewBottom);
                mote.gfx.setPosition(x, y);

                mote.vx = isSnowy ? Phaser.Math.FloatBetween(-0.9, -0.3) : Phaser.Math.FloatBetween(-0.5, 0.5);
                mote.vy = isVolcanic ? Phaser.Math.FloatBetween(-1.2, -0.4) : isSnowy ? Phaser.Math.FloatBetween(0.4, 1.0) : Phaser.Math.FloatBetween(-0.4, 0.4);

                mote.gfx.clear();
                const col = idx % 2 === 0 ? primaryColor : secondaryColor;
                mote.gfx.fillStyle(col, mote.baseAlpha);
                if (isSnowy) {
                    mote.gfx.fillCircle(0, 0, Phaser.Math.Between(1.5, 3));
                } else if (isVolcanic) {
                    mote.gfx.fillCircle(0, 0, Phaser.Math.Between(2, 4));
                } else if (isAquatic) {
                    mote.gfx.strokeCircle(0, 0, Phaser.Math.Between(2, 5));
                } else {
                    mote.gfx.fillEllipse(0, 0, 4, 2);
                }
            } else {
                const sway = Math.sin(time * 0.003 + idx) * 0.4;
                mote.gfx.setPosition(x + mote.vx + sway, y + mote.vy);
            }
        });
    }

    /**
     * Sprint 34: Living World Micro-Details (Tall grass rustling & water ripples).
     */
    private updateLivingWorldDetails(_time: number, delta: number) {
        if (!this.player || !this.currentMap) return;

        this.stepParticleTimer += delta;
        if (this.stepParticleTimer < 180) return;
        this.stepParticleTimer = 0;

        const pGridX = Math.floor(this.player.x / 64);
        const pGridY = Math.floor(this.player.y / 64);
        if (pGridX < 0 || pGridX >= this.currentMap.width || pGridY < 0 || pGridY >= this.currentMap.height) return;

        const currentTile = this.currentMap.grid[pGridY] ? this.currentMap.grid[pGridY][pGridX] : 0;

        // 1. Tall Grass (Tile 2) / Flower Meadow (Tile 11) Sway Rustle
        if (currentTile === 2 || currentTile === 11) {
            for (let i = 0; i < 3; i++) {
                const blade = this.add.graphics();
                blade.setDepth(8);
                const col = currentTile === 11 ? 0xfacc15 : 0x22c55e;
                blade.fillStyle(col, 0.8);
                blade.fillCircle(0, 0, Phaser.Math.Between(2, 4));
                blade.setPosition(this.player.x + Phaser.Math.Between(-16, 16), this.player.y + 12);

                this.tweens.add({
                    targets: blade,
                    y: blade.y - Phaser.Math.Between(10, 24),
                    x: blade.x + Phaser.Math.Between(-12, 12),
                    alpha: 0,
                    scaleX: 0.3,
                    scaleY: 0.3,
                    duration: 350,
                    ease: 'Power1',
                    onComplete: () => blade.destroy()
                });
            }
        }

        // 2. Bridges & Sandbars (Tiles 9, 10, 12) Water Ripple
        if (currentTile === 9 || currentTile === 10 || currentTile === 12) {
            const ripple = this.add.graphics();
            ripple.setDepth(7);
            ripple.lineStyle(1.5, 0x38bdf8, 0.65);
            ripple.strokeCircle(this.player.x, this.player.y + 16, 4);

            this.tweens.add({
                targets: ripple,
                scaleX: 2.6,
                scaleY: 2.6,
                alpha: 0,
                x: this.player.x * (1 - 2.6),
                y: (this.player.y + 16) * (1 - 2.6),
                duration: 500,
                ease: 'Quad.easeOut',
                onComplete: () => ripple.destroy()
            });
        }
    }

    /**
     * Tap-to-Move & Tap-to-Target Animated Waypoint Reticle
     */
    private showWaypointReticle(worldX: number, worldY: number, isInteractable: boolean = false) {
        if (!this.waypointReticle) {
            this.waypointReticle = this.add.graphics();
            this.waypointReticle.setDepth(15);
        }
        if (this.waypointTween) {
            this.waypointTween.stop();
            this.waypointTween = null;
        }

        this.waypointReticle.clear();
        this.waypointReticle.setPosition(worldX, worldY);
        this.waypointReticle.setScale(0.5);
        this.waypointReticle.setAlpha(1.0);
        this.waypointReticle.setVisible(true);

        const color = isInteractable ? 0xffcc00 : 0x00ffcc;
        const ringColor = isInteractable ? 0xffaa00 : 0x38bdf8;

        // Concentric glowing target diamond and ring
        this.waypointReticle.lineStyle(2, ringColor, 0.85);
        this.waypointReticle.strokeCircle(0, 0, 18);
        this.waypointReticle.lineStyle(1.5, color, 1.0);
        this.waypointReticle.beginPath();
        this.waypointReticle.moveTo(0, -12);
        this.waypointReticle.lineTo(12, 0);
        this.waypointReticle.lineTo(0, 12);
        this.waypointReticle.lineTo(-12, 0);
        this.waypointReticle.closePath();
        this.waypointReticle.stroke();

        this.waypointReticle.fillStyle(color, 0.65);
        this.waypointReticle.fillCircle(0, 0, 4);

        // Pulsing animation
        this.waypointTween = this.tweens.add({
            targets: this.waypointReticle,
            scale: { from: 0.6, to: 1.15 },
            alpha: { from: 1.0, to: 0.35 },
            duration: 550,
            repeat: -1,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
    }

    private hideWaypointReticle() {
        if (this.waypointTween) {
            this.waypointTween.stop();
            this.waypointTween = null;
        }
        if (this.waypointReticle) {
            this.waypointReticle.setVisible(false);
            this.waypointReticle.clear();
        }
    }

    /**
     * Handles Touch and Click on the Overworld Map (Tap-to-Move & Tap-to-Target)
     */
    private handlePointerMapTap(pointer: Phaser.Input.Pointer, isNewTap: boolean = true) {
        if (!this.player || !this.scene.isActive() || this.scene.isPaused()) return;
        if (this.isDialogueActive || this.isTransitioning) return;
        if (this.scene.isActive('MenuScene') || this.scene.isActive('BattleScene')) return;

        // Prevent map movement if clicking the top-right HUD area (e.g. Menu icon, Touch Toggle)
        const screenX = pointer.position.x;
        const screenY = pointer.position.y;
        const width = this.cameras.main.width;
        if (screenX >= width - 180 && screenY <= 90) {
            return;
        }

        const worldX = pointer.worldX;
        const worldY = pointer.worldY;

        // Check if user tapped directly on or near an NPC / Chest / Interactable
        let targetNpcSprite: Phaser.GameObjects.Sprite | null = null;
        const tileSize = 64;

        this.npcsGroup.getChildren().forEach(child => {
            const sprite = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
            const dist = Phaser.Math.Distance.Between(worldX, worldY, sprite.x, sprite.y);
            if (dist <= tileSize * 1.1) {
                targetNpcSprite = sprite;
            }
        });

        if (targetNpcSprite && isNewTap) {
            const npc = targetNpcSprite as Phaser.GameObjects.Sprite;
            // Tap-to-Target: Move adjacent to the NPC and automatically trigger interaction upon arrival
            this.showWaypointReticle(npc.x, npc.y, true);
            this.player.setMoveTarget(npc.x, npc.y, () => {
                this.hideWaypointReticle();
                this.tryInteract();
            }, true);
        } else {
            // Tap-to-Move: Path directly to the tapped coordinate
            this.showWaypointReticle(worldX, worldY, false);
            this.player.setMoveTarget(worldX, worldY, () => {
                this.hideWaypointReticle();
            }, false);
        }
    }
}
