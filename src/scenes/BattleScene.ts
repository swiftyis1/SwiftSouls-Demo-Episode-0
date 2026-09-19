import Phaser from 'phaser';
import { GameManager } from '../systems/GameManager';
import type { ActiveSpell, CharacterStats, CombatPassives } from '../systems/GameManager';
import { MonsterDatabase, type MonsterStats } from '../systems/MonsterDatabase';
import { SoundSynth } from '../systems/SoundSynth';
import { AccessibilityManager } from '../systems/AccessibilityManager';
import { PetBattleAI } from '../systems/PetBattleAI';
import { LicenseManager } from '../systems/LicenseManager';
import { TouchControls } from '../systems/TouchControls';
import {
    type ElementType,
    type StatusAilmentType,
    type ActiveStatusAilment,
    calculateDamage,
    getAilmentBadge,
    applyAilment,
    removeAilment,
    tickAilmentDurations,
    hasAilment,
    getBurnStrengthPenalty
} from '../systems/ElementSystem';

export interface BattleInitData {
    monster?: MonsterStats;
    isBoss?: boolean;
}

export type CombatState = 'PLAYER_INPUT' | 'SKILL_MENU' | 'PLAYER_ANIMATING' | 'PET_TURN' | 'ENEMY_TURN' | 'VICTORY' | 'DEFEAT';

export class BattleScene extends Phaser.Scene {
    private combatState: CombatState = 'PLAYER_INPUT';
    private isBossBattle: boolean = false;
    private activeCommandIdx: number = 0; // 0: Attack, 1: Skills, 2: Run
    private commandButtons: Phaser.GameObjects.Container[] = [];
    private commandBgs: Phaser.GameObjects.Graphics[] = [];
    private commandTexts: Phaser.GameObjects.Text[] = [];
    private commandIcons: Phaser.GameObjects.Text[] = [];
    private commands: { key: string; label: string; icon: string; accentColor: number; textColor: string }[] = [
        { key: 'attack', label: 'ATTACK', icon: '⚔️', accentColor: 0x00ffcc, textColor: '#00ffcc' },
        { key: 'skills', label: 'SKILLS', icon: '✨', accentColor: 0xff00ff, textColor: '#ff00ff' },
        { key: 'run', label: 'RUN', icon: '🏃', accentColor: 0xffaa00, textColor: '#ffaa00' }
    ];

    // Battle-Scoped Status Ailments (Strictly Non-Persistent)
    private heroAilments: ActiveStatusAilment[] = [];
    private enemyAilments: ActiveStatusAilment[] = [];
    private heroAilmentText!: Phaser.GameObjects.Text;
    private enemyAilmentText!: Phaser.GameObjects.Text;

    // Card Layout Dimensions
    private readonly playerCardX: number = 80;
    private readonly playerCardY: number = 120;
    private enemyCardX: number = 0;
    private readonly enemyCardY: number = 120;
    private readonly cardWidth: number = 530;
    private readonly cardHeight: number = 360;

    // Pet Companion Card Dimensions (Sprint 26)
    private readonly petCardX: number = 80;
    private readonly petCardY: number = 495;
    private readonly petCardWidth: number = 530;
    private readonly petCardHeight: number = 160;

    // Command Box Dimensions (Spacious Mobile-Optimized 540x270 Layout)
    private cmdX: number = 0;
    private cmdY: number = 0;
    private readonly cmdWidth: number = 540;
    private readonly cmdHeight: number = 270;
    private lastTouchNavTime: number = 0;

    // Visual GameObjects
    private playerContainer!: Phaser.GameObjects.Container;
    private enemyContainer!: Phaser.GameObjects.Container;
    private playerCardBg!: Phaser.GameObjects.Graphics;
    private enemyCardBg!: Phaser.GameObjects.Graphics;
    private dialogueLogText!: Phaser.GameObjects.Text;
    private playerHpText!: Phaser.GameObjects.Text;
    private playerSpText!: Phaser.GameObjects.Text;
    private enemyHpText!: Phaser.GameObjects.Text;

    private playerHpBar!: Phaser.GameObjects.Graphics;
    private playerSpBar!: Phaser.GameObjects.Graphics;
    private enemyHpBar!: Phaser.GameObjects.Graphics;

    // Pet Companion GameObjects (Sprint 26)
    private petContainer: Phaser.GameObjects.Container | null = null;
    private petCardBg!: Phaser.GameObjects.Graphics;
    private petHpBar!: Phaser.GameObjects.Graphics;
    private petSpBar!: Phaser.GameObjects.Graphics;
    private petNameText!: Phaser.GameObjects.Text;
    private petHpText!: Phaser.GameObjects.Text;
    private petSpText!: Phaser.GameObjects.Text;
    private petSkillText!: Phaser.GameObjects.Text;
    private petStatusBadge!: Phaser.GameObjects.Text;

    // Skills Sub-Menu Overlay
    private skillContainer: Phaser.GameObjects.Container | null = null;
    private activeSkills: ActiveSpell[] = [];
    private activeSkillIdx: number = 0;
    private skillTexts: Phaser.GameObjects.Text[] = [];
    private skillBgs: Phaser.GameObjects.Graphics[] = [];

    // Victory Reward Modal
    private rewardContainer: Phaser.GameObjects.Container | null = null;

    // Buffs & Passives
    private rageTurnsRemaining: number = 0;
    private rageMultiplier: number = 1.0;
    private passives: CombatPassives = {
        lifestealPercent: 0,
        hpRegen: 0,
        spRegen: 0,
        evasionPercent: 0,
        counterPercent: 0,
        spAbsorbChance: 0,
        critChance: 0,
        critDamageBonus: 0,
        accuracyBonus: 0,
        physicalPenetration: 0,
        magicPenetration: 0,
        spCostReduction: 0,
        magicBonus: 0,
        magicDefenseBonus: 0,
        luckBonus: 0,
        elementalResistances: {}
    };

    private keys!: {
        UP: Phaser.Input.Keyboard.Key;
        DOWN: Phaser.Input.Keyboard.Key;
        LEFT: Phaser.Input.Keyboard.Key;
        RIGHT: Phaser.Input.Keyboard.Key;
        ENTER: Phaser.Input.Keyboard.Key;
        SPACE: Phaser.Input.Keyboard.Key;
        ESC: Phaser.Input.Keyboard.Key;
    };

    // Hero Active Combat Vitals
    private heroVitals: CharacterStats = {
        name: 'Swift',
        level: 1,
        hp: 15,
        maxHp: 15,
        sp: 8,
        maxSp: 8,
        strength: 4,
        defense: 2,
        agility: 3,
        magic: 5,
        magicDefense: 3,
        accuracy: 95,
        evasion: 5,
        critChance: 5,
        critDamage: 1.5,
        luck: 10,
        physicalPenetration: 0,
        magicPenetration: 0,
        spCostReduction: 0
    };

    // Enemy Active Combat Vitals
    private enemyVitals: MonsterStats = {
        speciesId: 'slime',
        name: 'Acid Slime',
        level: 1,
        hp: 15,
        maxHp: 15,
        strength: 4,
        defense: 2,
        agility: 3,
        magic: 6,
        magicDefense: 4,
        accuracy: 90,
        evasion: 2,
        critChance: 3,
        critDamage: 1.3,
        luck: 20,
        physicalPenetration: 0,
        magicPenetration: 10,
        spriteKey: 'slime',
        color: 0x00ff88
    };

    constructor() {
        super('BattleScene');
    }

    init(data?: BattleInitData) {
        this.combatState = 'PLAYER_INPUT';
        this.activeCommandIdx = 0;
        this.rageTurnsRemaining = 0;
        this.rageMultiplier = 1.0;
        this.isBossBattle = data?.isBoss || false;

        // Guaranteed battle-scope isolation: purge all status ailments
        this.heroAilments = [];
        this.enemyAilments = [];

        // Fetch live hero stats and passives from GameManager
        const calculated = GameManager.instance.getHeroCalculatedStats();
        this.heroVitals = { ...calculated };

        this.passives = GameManager.instance.getActivePassives();

        if (data && data.monster) {
            this.enemyVitals = { ...data.monster, hp: data.monster.maxHp };
        } else {
            this.enemyVitals = {
                ...MonsterDatabase['slime'],
                hp: MonsterDatabase['slime'].maxHp
            };
        }
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        this.enemyCardX = width - this.cardWidth - 80;
        this.cmdX = width - this.cmdWidth - 50;
        this.cmdY = height - this.cmdHeight - 45;

        this.cameras.main.fadeIn(350, 0, 0, 0);

        this.commandButtons = [];
        this.commandBgs = [];
        this.commandTexts = [];
        this.commandIcons = [];

        // 1. Procedural Background Gradient
        const bg = this.add.graphics();
        if (this.isBossBattle) {
            bg.fillGradientStyle(0x25050e, 0x25050e, 0x180414, 0x180414, 1);
        } else {
            bg.fillGradientStyle(0x0a0a16, 0x0a0a16, 0x14142c, 0x14142c, 1);
        }
        bg.fillRect(0, 0, width, height);

        // Draw glowing particles in background
        const pColor = this.isBossBattle ? 0xff3366 : 0x00ffcc;
        for (let i = 0; i < 25; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height - 300);
            const radius = Phaser.Math.FloatBetween(1, 2.5);
            const graphics = this.add.graphics();
            graphics.fillStyle(pColor, Phaser.Math.FloatBetween(0.15, 0.4));
            graphics.fillCircle(x, y, radius);
        }

        // 2. Draw Player Frame (Left Panel Container)
        this.playerContainer = this.add.container(this.playerCardX, this.playerCardY);

        this.playerCardBg = this.add.graphics();
        this.playerCardBg.fillStyle(0x0f0f23, 0.88);
        this.playerCardBg.fillRoundedRect(0, 0, this.cardWidth, this.cardHeight, 16);
        this.playerCardBg.lineStyle(4, 0x00ffcc, 1);
        this.playerCardBg.strokeRoundedRect(0, 0, this.cardWidth, this.cardHeight, 16);
        this.playerCardBg.lineStyle(1.5, 0xff00ff, 0.4);
        this.playerCardBg.strokeRoundedRect(-6, -6, this.cardWidth + 12, this.cardHeight + 12, 22);
        this.playerContainer.add(this.playerCardBg);

        // Player Name & Level
        const pNameText = this.add.text(40, 40, `${this.heroVitals.name.toUpperCase()}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '36px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        const pLevelText = this.add.text(40, 90, `Soul Level: ${this.heroVitals.level}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#8899b3'
        });
        this.playerContainer.add([pNameText, pLevelText]);

        // Player HP Bar setup
        const pHpLabel = this.add.text(40, 160, 'HP', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.playerHpBar = this.add.graphics();
        this.playerHpText = this.add.text(40, 225, ``, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#00ffcc'
        });
        this.playerContainer.add([pHpLabel, this.playerHpBar, this.playerHpText]);

        // Player SP Bar setup
        const pSpLabel = this.add.text(40, 255, 'SP', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.playerSpBar = this.add.graphics();
        this.playerSpText = this.add.text(40, 315, ``, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ff00ff'
        });
        this.playerContainer.add([pSpLabel, this.playerSpBar, this.playerSpText]);

        // Player Status Ailments Text
        this.heroAilmentText = this.add.text(40, 342, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.playerContainer.add(this.heroAilmentText);

        this.drawPlayerVitals();

        // 3. Draw Enemy Frame (Right Panel Container)
        this.enemyContainer = this.add.container(this.enemyCardX, this.enemyCardY);

        this.enemyCardBg = this.add.graphics();
        this.enemyCardBg.fillStyle(0x0f0f23, 0.88);
        this.enemyCardBg.fillRoundedRect(0, 0, this.cardWidth, this.cardHeight, 16);
        
        const enemyBorderColor = this.isBossBattle ? 0xffcc00 : 0xff00ff;
        this.enemyCardBg.lineStyle(4, enemyBorderColor, 1);
        this.enemyCardBg.strokeRoundedRect(0, 0, this.cardWidth, this.cardHeight, 16);
        this.enemyCardBg.lineStyle(1.5, this.isBossBattle ? 0xff3300 : 0x00ffcc, 0.4);
        this.enemyCardBg.strokeRoundedRect(-6, -6, this.cardWidth + 12, this.cardHeight + 12, 22);
        this.enemyContainer.add(this.enemyCardBg);

        // Enemy Name & Level
        const bossPrefix = this.isBossBattle ? '★ ' : '';
        const eNameText = this.add.text(40, 40, `${bossPrefix}${this.enemyVitals.name.toUpperCase()}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: this.enemyVitals.name.length > 18 ? '26px' : '34px',
            color: this.isBossBattle ? '#ffcc00' : '#ff00ff',
            fontStyle: 'bold'
        });
        const eLevelText = this.add.text(40, 90, `${this.isBossBattle ? 'ALPHA BOSS' : 'Wild'} LV: ${this.enemyVitals.level}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: this.isBossBattle ? '#ff8800' : '#8899b3',
            fontStyle: this.isBossBattle ? 'bold' : 'normal'
        });
        this.enemyContainer.add([eNameText, eLevelText]);

        // Enemy HP Bar Setup
        const eHpLabel = this.add.text(40, 160, 'HP', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.enemyHpBar = this.add.graphics();
        this.enemyHpText = this.add.text(40, 225, ``, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ff00ff'
        });
        this.enemyContainer.add([eHpLabel, this.enemyHpBar, this.enemyHpText]);

        // Enemy Element & Status Ailments Text
        this.enemyAilmentText = this.add.text(40, 260, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.enemyContainer.add(this.enemyAilmentText);

        this.drawEnemyVitals();
        this.updateAilmentBadges();
        this.setupPetCard();

        // 4. Draw Dialogue/Log Frame (Bottom Left)
        const logX = 50;
        const logY = this.cmdY;
        const logWidth = this.cmdX - logX - 25;
        const logHeight = this.cmdHeight;

        const logCard = this.add.graphics();
        logCard.fillStyle(0x050510, 0.94);
        logCard.lineStyle(3, 0x24244c, 1);
        logCard.fillRoundedRect(logX, logY, logWidth, logHeight, 14);
        logCard.strokeRoundedRect(logX, logY, logWidth, logHeight, 14);

        const introPrompt = this.isBossBattle
            ? `The Endangered ${this.enemyVitals.name} roars in final defiance!\nDefeat it to certify species extinction!`
            : `A wild ${this.enemyVitals.name} blockaded thy path!\nWhat action will ${this.heroVitals.name} initiate?`;

        if (this.isBossBattle) {
            SoundSynth.playBossRoar();
        }
        SoundSynth.playBgm(this.isBossBattle ? 'boss' : 'battle');

        this.dialogueLogText = this.add.text(logX + 35, logY + 30, this.getFormattedText(introPrompt), {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#ffffff',
            lineSpacing: 10,
            wordWrap: { width: logWidth - 70 }
        });

        // 5. Draw Commands Menu Frame (Bottom Right - 540x270px)
        const cmdCard = this.add.graphics();
        cmdCard.fillStyle(0x0a0d18, 0.95);
        cmdCard.lineStyle(3, 0x00ffcc, 0.85);
        cmdCard.fillRoundedRect(this.cmdX, this.cmdY, this.cmdWidth, this.cmdHeight, 14);
        cmdCard.strokeRoundedRect(this.cmdX, this.cmdY, this.cmdWidth, this.cmdHeight, 14);
        cmdCard.lineStyle(1.5, 0x00ffcc, 0.25);
        cmdCard.strokeRoundedRect(this.cmdX - 3, this.cmdY - 3, this.cmdWidth + 6, this.cmdHeight + 6, 17);

        // Setup 3 Extra-Large Mobile-Friendly Button Cards
        // Top: ATTACK (Full width 512x112), Bottom: SKILLS (248x118) & RUN (248x118)
        const btnDefs = [
            { x: this.cmdX + 14, y: this.cmdY + 14, w: 512, h: 112, iconSize: '36px', fontSize: '28px', iconY: 36, textY: 78 },  // Attack
            { x: this.cmdX + 14, y: this.cmdY + 138, w: 248, h: 118, iconSize: '34px', fontSize: '24px', iconY: 38, textY: 82 }, // Skills
            { x: this.cmdX + 278, y: this.cmdY + 138, w: 248, h: 118, iconSize: '34px', fontSize: '24px', iconY: 38, textY: 82 } // Run
        ];

        this.commands.forEach((cmd, idx) => {
            const def = btnDefs[idx];
            const btnContainer = this.add.container(def.x, def.y);
            btnContainer.setSize(def.w, def.h);
            (btnContainer as any).btnWidth = def.w;
            (btnContainer as any).btnHeight = def.h;

            const btnBg = this.add.graphics();
            btnContainer.add(btnBg);
            this.commandBgs.push(btnBg);

            const iconTxt = this.add.text(def.w / 2, def.iconY, cmd.icon, {
                fontSize: def.iconSize
            }).setOrigin(0.5, 0.5);
            btnContainer.add(iconTxt);
            this.commandIcons.push(iconTxt);

            const labelTxt = this.add.text(def.w / 2, def.textY, cmd.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: def.fontSize,
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5, 0.5);
            btnContainer.add(labelTxt);
            this.commandTexts.push(labelTxt);

            // Dedicated full-size interactive hit zone for flawless mobile touch response
            const hitZone = this.add.zone(def.x + def.w / 2, def.y + def.h / 2, def.w, def.h);
            hitZone.setInteractive({ useHandCursor: true });

            const onBtnSelect = () => {
                if (this.combatState !== 'PLAYER_INPUT') return;
                TouchControls.instance.triggerHaptic(25);
                this.tweens.add({
                    targets: btnContainer,
                    scaleX: 0.94,
                    scaleY: 0.94,
                    duration: 60,
                    yoyo: true,
                    ease: 'Quad.easeInOut'
                });
                this.activeCommandIdx = idx;
                this.updateCommandVisuals();
                this.executeAction();
            };

            hitZone.on('pointerdown', onBtnSelect);
            hitZone.on('pointerover', () => {
                if (this.combatState !== 'PLAYER_INPUT') return;
                this.activeCommandIdx = idx;
                this.updateCommandVisuals();
            });

            btnContainer.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, def.w, def.h),
                Phaser.Geom.Rectangle.Contains
            );
            if (btnContainer.input) btnContainer.input.cursor = 'pointer';
            btnContainer.on('pointerdown', onBtnSelect);
            btnContainer.on('pointerover', () => {
                if (this.combatState !== 'PLAYER_INPUT') return;
                this.activeCommandIdx = idx;
                this.updateCommandVisuals();
            });

            this.commandButtons.push(btnContainer);
        });

        this.updateCommandVisuals();

        // Global screen-space pointer listener for seamless mobile tap mapping
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.combatState === 'VICTORY') {
                this.dismissVictoryModal();
                return;
            }
            if (this.combatState !== 'PLAYER_INPUT') return;
            const px = pointer.x;
            const py = pointer.y;

            // Attack button bounds: [cmdX + 10, cmdX + 530] x [cmdY + 10, cmdY + 130]
            if (px >= this.cmdX + 10 && px <= this.cmdX + 530 && py >= this.cmdY + 10 && py <= this.cmdY + 130) {
                TouchControls.instance.triggerHaptic(25);
                this.activeCommandIdx = 0;
                this.updateCommandVisuals();
                this.executeAction();
                return;
            }

            // Skills button bounds: [cmdX + 10, cmdX + 270] x [cmdY + 130, cmdY + 265]
            if (px >= this.cmdX + 10 && px <= this.cmdX + 270 && py >= this.cmdY + 130 && py <= this.cmdY + 265) {
                TouchControls.instance.triggerHaptic(25);
                this.activeCommandIdx = 1;
                this.updateCommandVisuals();
                this.executeAction();
                return;
            }

            // Run button bounds: [cmdX + 270, cmdX + 530] x [cmdY + 130, cmdY + 265]
            if (px >= this.cmdX + 270 && px <= this.cmdX + 530 && py >= this.cmdY + 130 && py <= this.cmdY + 265) {
                TouchControls.instance.triggerHaptic(25);
                this.activeCommandIdx = 2;
                this.updateCommandVisuals();
                this.executeAction();
                return;
            }
        });

        // Wire TouchControls callbacks for battle
        TouchControls.instance.setActionCallback(() => {
            if (this.combatState === 'PLAYER_INPUT') {
                this.executeAction();
            } else if (this.combatState === 'SKILL_MENU') {
                this.confirmSkillSelection();
            } else if (this.combatState === 'VICTORY') {
                this.dismissVictoryModal();
            }
        });
        TouchControls.instance.setMenuCallback(() => {
            if (this.combatState === 'SKILL_MENU') {
                this.closeSkillsMenu();
            }
        });

        // Initialize Keyboard Inputs
        if (this.input.keyboard) {
            this.keys = this.input.keyboard.addKeys({
                UP: Phaser.Input.Keyboard.KeyCodes.UP,
                DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
                LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
                RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
                ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER,
                SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
                ESC: Phaser.Input.Keyboard.KeyCodes.ESC
            }) as any;
        }

        // Gamepad inputs support inside Battle
        if (this.input.gamepad) {
            this.input.gamepad.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
                if (this.combatState === 'PLAYER_INPUT') {
                    if (button.index === 12 || button.index === 11) { // Up
                        this.navigateCommand(0, -1);
                    } else if (button.index === 13 || button.index === 10) { // Down
                        this.navigateCommand(0, 1);
                    } else if (button.index === 14) { // Left
                        this.navigateCommand(-1, 0);
                    } else if (button.index === 15) { // Right
                        this.navigateCommand(1, 0);
                    } else if (button.index === 0) { // A
                        this.executeAction();
                    }
                } else if (this.combatState === 'SKILL_MENU') {
                    if (button.index === 12 || button.index === 11) { // Up
                        this.navigateSkills(-1);
                    } else if (button.index === 13 || button.index === 10) { // Down
                        this.navigateSkills(1);
                    } else if (button.index === 0) { // A
                        this.confirmSkillSelection();
                    } else if (button.index === 1) { // B
                        this.closeSkillsMenu();
                    }
                } else if (this.combatState === 'VICTORY' && button.index === 0) {
                    this.dismissVictoryModal();
                }
            });
        }

        this.updateCommandVisuals();
    }

    private setupPetCard() {
        const pet = GameManager.instance.getPetCompanion();
        if (!pet) return;

        this.petContainer = this.add.container(this.petCardX, this.petCardY);

        this.petCardBg = this.add.graphics();
        this.petContainer.add(this.petCardBg);

        // Pet Name & LV
        const augPrefix = pet.augmentation ? '★ ' : '🐾 ';
        this.petNameText = this.add.text(20, 16, `${augPrefix}${pet.name.toUpperCase()} (LV ${pet.level})`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: pet.augmentation ? '#ffcc00' : '#00ffcc',
            fontStyle: 'bold'
        });
        this.petContainer.add(this.petNameText);

        // Status Badge: [READY] or [FALLEN]
        this.petStatusBadge = this.add.text(370, 16, pet.isDefeated ? '[FALLEN]' : '[READY]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: pet.isDefeated ? '#ff3366' : '#00ff88',
            fontStyle: 'bold'
        });
        this.petContainer.add(this.petStatusBadge);

        // HP Label & Bar
        const hpLabel = this.add.text(20, 52, 'HP', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.petContainer.add(hpLabel);

        this.petHpBar = this.add.graphics();
        this.petContainer.add(this.petHpBar);

        this.petHpText = this.add.text(20, 80, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#00ffcc'
        });
        this.petContainer.add(this.petHpText);

        // SP Label & Bar
        const spLabel = this.add.text(260, 52, 'SP', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        this.petContainer.add(spLabel);

        this.petSpBar = this.add.graphics();
        this.petContainer.add(this.petSpBar);

        this.petSpText = this.add.text(260, 80, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ff00ff'
        });
        this.petContainer.add(this.petSpText);

        // Signature Skill Line
        const skillDesc = pet.signatureSkill
            ? `Skill: ${pet.signatureSkill.name} (${pet.signatureSkill.spCost} SP)`
            : 'Basic Attack Only';
        this.petSkillText = this.add.text(20, 115, skillDesc, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffcc00'
        });
        this.petContainer.add(this.petSkillText);

        this.drawPetVitals();
    }

    private drawPetVitals() {
        const pet = GameManager.instance.getPetCompanion();
        if (!pet || !this.petContainer) return;

        this.petCardBg.clear();
        this.petCardBg.fillStyle(0x0a0a1f, 0.90);
        this.petCardBg.fillRoundedRect(0, 0, this.petCardWidth, this.petCardHeight, 12);

        const borderColor = pet.isDefeated ? 0x661122 : (pet.augmentation ? 0xffcc00 : 0x00ffcc);
        this.petCardBg.lineStyle(2.5, borderColor, 0.9);
        this.petCardBg.strokeRoundedRect(0, 0, this.petCardWidth, this.petCardHeight, 12);

        this.petStatusBadge.setText(pet.isDefeated ? '[FALLEN]' : '[READY]');
        this.petStatusBadge.setColor(pet.isDefeated ? '#ff3366' : '#00ff88');

        // Draw HP Bar
        const hpBarW = 190;
        this.petHpBar.clear();
        this.petHpBar.fillStyle(0x1a242c, 1);
        this.petHpBar.fillRect(52, 54, hpBarW, 14);

        const hpRatio = Phaser.Math.Clamp(pet.hp / pet.maxHp, 0, 1);
        this.petHpBar.fillStyle(pet.isDefeated ? 0x555555 : 0x00ffcc, 1);
        this.petHpBar.fillRect(52, 54, hpBarW * hpRatio, 14);

        this.petHpText.setText(`${pet.hp}/${pet.maxHp}`);

        // Draw SP Bar
        const spBarW = 190;
        this.petSpBar.clear();
        this.petSpBar.fillStyle(0x1a242c, 1);
        this.petSpBar.fillRect(292, 54, spBarW, 14);

        const spRatio = Phaser.Math.Clamp(pet.sp / pet.maxSp, 0, 1);
        this.petSpBar.fillStyle(pet.isDefeated ? 0x555555 : 0xff00ff, 1);
        this.petSpBar.fillRect(292, 54, spBarW * spRatio, 14);

        this.petSpText.setText(`${pet.sp}/${pet.maxSp}`);

        if (pet.signatureSkill) {
            const spColor = pet.sp >= pet.signatureSkill.spCost ? '#ffcc00' : '#8899a6';
            this.petSkillText.setColor(spColor);
            this.petSkillText.setText(`Skill: ${pet.signatureSkill.name} (${pet.signatureSkill.spCost} SP)`);
        }
    }

    private drawPlayerVitals() {
        const barWidth = 450;
        this.playerHpBar.clear();
        this.playerHpBar.fillStyle(0x1a242c, 1);
        this.playerHpBar.fillRect(40, 195, barWidth, 20);

        const hpRatio = Phaser.Math.Clamp(this.heroVitals.hp / this.heroVitals.maxHp, 0, 1);
        this.playerHpBar.fillStyle(0x00ffcc, 1);
        this.playerHpBar.fillRect(40, 195, barWidth * hpRatio, 20);

        this.playerHpText.setText(`${this.heroVitals.hp}/${this.heroVitals.maxHp}`);

        // SP Bar Fill
        this.playerSpBar.clear();
        this.playerSpBar.fillStyle(0x1a242c, 1);
        this.playerSpBar.fillRect(40, 285, barWidth, 15);

        const spRatio = Phaser.Math.Clamp(this.heroVitals.sp / this.heroVitals.maxSp, 0, 1);
        this.playerSpBar.fillStyle(0xff00ff, 1);
        this.playerSpBar.fillRect(40, 285, barWidth * spRatio, 15);

        this.playerSpText.setText(`${this.heroVitals.sp}/${this.heroVitals.maxSp}`);
    }

    private drawEnemyVitals() {
        const barWidth = 450;
        this.enemyHpBar.clear();
        this.enemyHpBar.fillStyle(0x1a242c, 1);
        this.enemyHpBar.fillRect(40, 195, barWidth, 20);

        const hpRatio = Phaser.Math.Clamp(this.enemyVitals.hp / this.enemyVitals.maxHp, 0, 1);
        this.enemyHpBar.fillStyle(this.isBossBattle ? 0xffcc00 : 0xff0088, 1);
        this.enemyHpBar.fillRect(40, 195, barWidth * hpRatio, 20);

        this.enemyHpText.setText(`${this.enemyVitals.hp}/${this.enemyVitals.maxHp}`);
    }

    private navigateCommand(dirX: number, dirY: number) {
        if (this.combatState !== 'PLAYER_INPUT') return;
        SoundSynth.playMenuBlip();

        if (dirY !== 0) {
            if (dirY > 0) {
                // Moving down
                if (this.activeCommandIdx === 0) {
                    this.activeCommandIdx = 1; // ATTACK -> SKILLS
                } else {
                    this.activeCommandIdx = 0; // Wrap SKILLS/RUN -> ATTACK
                }
            } else {
                // Moving up
                if (this.activeCommandIdx === 0) {
                    this.activeCommandIdx = 1; // Wrap ATTACK -> SKILLS
                } else {
                    this.activeCommandIdx = 0; // SKILLS/RUN -> ATTACK
                }
            }
        }

        if (dirX !== 0) {
            if (dirX > 0) {
                // Moving right
                if (this.activeCommandIdx === 1) {
                    this.activeCommandIdx = 2; // SKILLS -> RUN
                } else if (this.activeCommandIdx === 2) {
                    this.activeCommandIdx = 1; // Wrap RUN -> SKILLS
                } else {
                    this.activeCommandIdx = 2; // ATTACK -> RUN
                }
            } else {
                // Moving left
                if (this.activeCommandIdx === 2) {
                    this.activeCommandIdx = 1; // RUN -> SKILLS
                } else if (this.activeCommandIdx === 1) {
                    this.activeCommandIdx = 2; // Wrap SKILLS -> RUN
                } else {
                    this.activeCommandIdx = 1; // ATTACK -> SKILLS
                }
            }
        }

        this.updateCommandVisuals();
    }

    private updateCommandVisuals() {
        this.commands.forEach((cmd, idx) => {
            const bg = this.commandBgs[idx];
            const txt = this.commandTexts[idx];
            const icon = this.commandIcons[idx];
            const btnContainer = this.commandButtons[idx];
            if (!bg || !txt || !icon || !btnContainer) return;

            const btnW = (btnContainer as any).btnWidth || 220;
            const btnH = (btnContainer as any).btnHeight || 96;

            bg.clear();

            if (this.combatState !== 'PLAYER_INPUT') {
                // Disabled / Animating state
                bg.fillStyle(0x0c0f18, 0.7);
                bg.fillRoundedRect(0, 0, btnW, btnH, 12);
                bg.lineStyle(1.5, 0x1f2638, 0.6);
                bg.strokeRoundedRect(0, 0, btnW, btnH, 12);
                txt.setColor('#556677');
                txt.setText(cmd.label);
                icon.setAlpha(0.35);
            } else if (idx === this.activeCommandIdx) {
                // Active / Selected state: Luminous card with high-contrast glowing outline
                bg.fillStyle(0x182438, 1.0);
                bg.fillRoundedRect(0, 0, btnW, btnH, 12);
                bg.lineStyle(3.5, cmd.accentColor, 1.0);
                bg.strokeRoundedRect(0, 0, btnW, btnH, 12);
                bg.lineStyle(1.5, cmd.accentColor, 0.45);
                bg.strokeRoundedRect(-2, -2, btnW + 4, btnH + 4, 14);
                txt.setColor(cmd.textColor);
                txt.setText(`▶ ${cmd.label}`);
                icon.setAlpha(1.0);
            } else {
                // Idle interactive button: Defined dark card with crisp border outline
                bg.fillStyle(0x121728, 0.95);
                bg.fillRoundedRect(0, 0, btnW, btnH, 12);
                bg.lineStyle(2, 0x2e3c5a, 0.95);
                bg.strokeRoundedRect(0, 0, btnW, btnH, 12);
                txt.setColor('#ffffff');
                txt.setText(cmd.label);
                icon.setAlpha(0.85);
            }
        });

        // Synchronize virtual Action button with current battle state
        if (this.combatState === 'PLAYER_INPUT') {
            const activeCmd = this.commands[this.activeCommandIdx];
            TouchControls.instance.setActionButtonContext({
                label: activeCmd.label,
                icon: activeCmd.icon,
                fillColor: activeCmd.accentColor,
                strokeColor: activeCmd.accentColor,
                textColor: activeCmd.key === 'attack' ? '#002218' : (activeCmd.key === 'run' ? '#221100' : '#ffffff')
            });
        } else if (this.combatState === 'SKILL_MENU') {
            TouchControls.instance.setActionButtonContext({
                label: 'CAST',
                icon: '✨',
                fillColor: 0xff00ff,
                strokeColor: 0xcc00cc,
                textColor: '#ffffff'
            });
        } else if (this.combatState === 'VICTORY') {
            TouchControls.instance.setActionButtonContext({
                label: 'CLAIM',
                icon: '🏆',
                fillColor: 0xffcc00,
                strokeColor: 0xffaa00,
                textColor: '#1a1000'
            });
        }
    }

    private getFormattedText(text: string): string {
        return text.replace(/Swift/g, this.heroVitals.name);
    }

    private showFloatingDamage(x: number, y: number, amount: number | string, color: string, prefix: string = '-') {
        const textContent = typeof amount === 'string' ? amount : (amount === 0 ? '0' : `${prefix}${amount}`);
        const dmgText = this.add.text(x, y, textContent, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '32px',
            color: color,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(400);

        this.tweens.add({
            targets: dmgText,
            y: y - 45,
            alpha: 0,
            duration: 750,
            ease: 'Power2',
            onComplete: () => dmgText.destroy()
        });
    }

    private updateAilmentBadges() {
        if (!this.heroAilmentText || !this.enemyAilmentText) return;
        const heroBadges = this.heroAilments.map(a => getAilmentBadge(a)).join(' ');
        this.heroAilmentText.setText(heroBadges);

        const enemyElem = this.enemyVitals.element ? `[${this.enemyVitals.element.toUpperCase()}] ` : '';
        const enemyBadges = this.enemyAilments.map(a => getAilmentBadge(a)).join(' ');
        this.enemyAilmentText.setText(`${enemyElem}${enemyBadges}`.trim());
    }

    private shakeCamera(duration: number = 150, intensity: number = 0.006) {
        AccessibilityManager.shakeCamera(this.cameras.main, duration, intensity);
    }

    private flashCamera(duration: number = 250, red: number = 255, green: number = 255, blue: number = 255, force: boolean = false) {
        AccessibilityManager.flashCamera(this.cameras.main, duration, red, green, blue, force);
    }

    private checkHeroBleedOnAction(): boolean {
        if (hasAilment(this.heroAilments, 'bleed')) {
            const bleedDmg = Math.max(2, Math.trunc(this.heroVitals.maxHp * 0.06));
            this.heroVitals.hp = Math.max(0, this.heroVitals.hp - bleedDmg);
            GameManager.instance.setHeroHp(this.heroVitals.hp);
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, bleedDmg, '#cc0033', '-BLEED ');
            this.drawPlayerVitals();
            this.shakeCamera(100, 0.005);
            if (this.heroVitals.hp <= 0) {
                this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name}'s wounds ruptured with bleeding!\nFatal haemorrhage!`));
                this.time.delayedCall(900, () => this.handleDefeat());
                return true;
            }
        }
        return false;
    }

    private tickHeroAilments() {
        tickAilmentDurations(this.heroAilments);
        this.updateAilmentBadges();
        this.drawPlayerVitals();
    }

    private tickTurnEndAilments() {
        let tickLog = '';

        // 1. Hero Poison Tick (8% Max HP)
        if (hasAilment(this.heroAilments, 'poison') && this.heroVitals.hp > 0) {
            const psnDmg = Math.max(1, Math.trunc(this.heroVitals.maxHp * 0.08));
            this.heroVitals.hp = Math.max(0, this.heroVitals.hp - psnDmg);
            GameManager.instance.setHeroHp(this.heroVitals.hp);
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, psnDmg, '#33ff33', '-PSN ');
            tickLog += `\n${this.heroVitals.name} suffered ${psnDmg} poison damage!`;
        }

        // 2. Hero Burn Tick (6% Max HP)
        if (hasAilment(this.heroAilments, 'burn') && this.heroVitals.hp > 0) {
            const brnDmg = Math.max(1, Math.trunc(this.heroVitals.maxHp * 0.06));
            this.heroVitals.hp = Math.max(0, this.heroVitals.hp - brnDmg);
            GameManager.instance.setHeroHp(this.heroVitals.hp);
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, brnDmg, '#ff6600', '-BRN ');
            tickLog += `\n${this.heroVitals.name} burned for ${brnDmg} fire damage!`;
        }

        // 3. Enemy Poison Tick (8% Max HP)
        if (hasAilment(this.enemyAilments, 'poison') && this.enemyVitals.hp > 0) {
            const psnDmg = Math.max(1, Math.trunc(this.enemyVitals.maxHp * 0.08));
            this.enemyVitals.hp = Math.max(0, this.enemyVitals.hp - psnDmg);
            this.showFloatingDamage(this.enemyCardX + this.cardWidth / 2, this.enemyCardY + 140, psnDmg, '#33ff33', '-PSN ');
            tickLog += `\n${this.enemyVitals.name} suffered ${psnDmg} poison damage!`;
        }

        // 4. Enemy Burn Tick (6% Max HP)
        if (hasAilment(this.enemyAilments, 'burn') && this.enemyVitals.hp > 0) {
            const brnDmg = Math.max(1, Math.trunc(this.enemyVitals.maxHp * 0.06));
            this.enemyVitals.hp = Math.max(0, this.enemyVitals.hp - brnDmg);
            this.showFloatingDamage(this.enemyCardX + this.cardWidth / 2, this.enemyCardY + 140, brnDmg, '#ff6600', '-BRN ');
            tickLog += `\n${this.enemyVitals.name} burned for ${brnDmg} fire damage!`;
        }

        // Tick durations down
        tickAilmentDurations(this.heroAilments);
        tickAilmentDurations(this.enemyAilments);
        this.updateAilmentBadges();
        this.drawPlayerVitals();
        this.drawEnemyVitals();

        if (tickLog) {
            this.dialogueLogText.setText(this.getFormattedText(this.dialogueLogText.text + tickLog));
        }

        // Check unit survival after ticks
        if (this.heroVitals.hp <= 0) {
            this.time.delayedCall(900, () => this.handleDefeat());
        } else if (this.enemyVitals.hp <= 0) {
            this.time.delayedCall(800, () => this.handleVictory());
        } else {
            this.time.delayedCall(900, () => {
                this.applyTurnPassives();
                this.combatState = 'PLAYER_INPUT';
                this.updateCommandVisuals();
                this.dialogueLogText.setText(this.getFormattedText(`What action will ${this.heroVitals.name} initiate?`));
            });
        }
    }

    private applyTurnPassives() {
        // HP Regen
        if (this.passives.hpRegen > 0 && this.heroVitals.hp < this.heroVitals.maxHp) {
            const regenAmount = Math.min(this.heroVitals.maxHp - this.heroVitals.hp, this.passives.hpRegen);
            this.heroVitals.hp += regenAmount;
            GameManager.instance.setHeroHp(this.heroVitals.hp);
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, regenAmount, '#00ff88', '+');
        }

        // SP Regen
        if (this.passives.spRegen > 0 && this.heroVitals.sp < this.heroVitals.maxSp) {
            const spAmount = Math.min(this.heroVitals.maxSp - this.heroVitals.sp, this.passives.spRegen);
            this.heroVitals.sp += spAmount;
            GameManager.instance.setHeroSp(this.heroVitals.sp);
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 165, spAmount, '#ff00ff', '+SP');
        }

        this.drawPlayerVitals();
    }

    private executeAction() {
        if (this.combatState !== 'PLAYER_INPUT') return;

        // Turn-start Ailment Checks (Freeze & Stun)
        if (hasAilment(this.heroAilments, 'freeze')) {
            SoundSynth.playFreeze();
            this.combatState = 'PLAYER_ANIMATING';
            this.updateCommandVisuals();
            this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} is frozen solid in deep frost!\nTurn is skipped!`));
            this.flashCamera(200, 0, 200, 255, false);
            this.time.delayedCall(1200, () => {
                this.tickHeroAilments();
                this.postPlayerActionTransition();
            });
            return;
        }

        if (hasAilment(this.heroAilments, 'stun')) {
            SoundSynth.playMenuCancel();
            this.combatState = 'PLAYER_ANIMATING';
            this.updateCommandVisuals();
            this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} is STUNNED and paralyzed!\nTurn is skipped!`));
            this.shakeCamera(150, 0.006);
            this.time.delayedCall(1200, () => {
                this.tickHeroAilments();
                this.postPlayerActionTransition();
            });
            return;
        }

        const cmdKey = this.commands[this.activeCommandIdx].key;

        if (cmdKey === 'run') {
            if (this.isBossBattle) {
                SoundSynth.playMenuCancel();
                this.dialogueLogText.setText(this.getFormattedText(`Cannot escape from an Alpha Boss battle!`));
                this.shakeCamera(100, 0.005);
                return;
            }

            // Agility-scaled Fleeing with Luck Tier bonus
            const luckTier = Math.floor((this.heroVitals.luck || 0) / 100);
            const fleeChance = Phaser.Math.Clamp(
                Math.round(50 + (this.heroVitals.agility - this.enemyVitals.agility) * 4 + luckTier * 2),
                25,
                95
            );

            const fleeRoll = Phaser.Math.Between(1, 100);
            if (fleeRoll <= fleeChance) {
                SoundSynth.playFlee();
                SoundSynth.stopBgm(400);
                this.heroAilments = [];
                this.enemyAilments = [];
                this.combatState = 'PLAYER_ANIMATING';
                this.updateCommandVisuals();
                this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} successfully escaped! (${fleeChance}% chance)\nFleeing back to Overworld.`));
                this.cameras.main.fadeOut(800, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.stop('BattleScene');
                    this.scene.resume('OverworldScene');
                });
            } else {
                // Intercepted / Failed flee!
                SoundSynth.playMenuCancel();
                this.combatState = 'PLAYER_ANIMATING';
                this.updateCommandVisuals();
                this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} failed to escape! (${fleeChance}% chance)\n${this.enemyVitals.name} cut off the retreat!`));
                this.shakeCamera(150, 0.006);
                this.time.delayedCall(1200, () => this.postPlayerActionTransition());
            }
        } else if (cmdKey === 'attack') {
            SoundSynth.playMenuSelect();
            this.executePlayerAttack();
        } else if (cmdKey === 'skills') {
            SoundSynth.playMenuSelect();
            this.openSkillsMenu();
        }
    }

    private openSkillsMenu() {
        if (hasAilment(this.heroAilments, 'silence')) {
            SoundSynth.playMenuCancel();
            this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} is SILENCED!\nCannot cast spells or invoke mystic arts!`));
            this.shakeCamera(120, 0.006);
            return;
        }

        this.activeSkills = GameManager.instance.getActiveSpells();

        if (this.activeSkills.length === 0) {
            this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} has no spells equipped!\nSocket Soul Crystals into Ring or Amulet slots in the menu.`));
            return;
        }

        this.combatState = 'SKILL_MENU';
        this.activeSkillIdx = 0;
        this.updateCommandVisuals();

        if (this.skillContainer) {
            this.skillContainer.destroy();
        }

        this.skillContainer = this.add.container(this.cmdX, this.cmdY);
        this.skillTexts = [];
        this.skillBgs = [];

        // Semi-transparent overlay box covering the command area
        const bg = this.add.graphics();
        bg.fillStyle(0x0a0a1f, 0.96);
        bg.fillRoundedRect(0, 0, this.cmdWidth, this.cmdHeight, 14);
        bg.lineStyle(3, 0xff00ff, 1);
        bg.strokeRoundedRect(0, 0, this.cmdWidth, this.cmdHeight, 14);
        this.skillContainer.add(bg);

        // Header Title
        const title = this.add.text(20, 12, 'SELECT SKILL / SPELL', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ff00ff',
            fontStyle: 'bold'
        });
        this.skillContainer.add(title);

        const cardW = this.cmdWidth - 28;
        const cardH = 50;
        const startX = 14;
        const startY = 40;

        // Render each active skill as a distinct button card
        this.activeSkills.forEach((skill, idx) => {
            const spReduction = this.heroVitals.spCostReduction || 0;
            const actualSpCost = Math.max(1, Math.round(skill.spCost * (1 - spReduction / 100)));
            const cardY = startY + idx * 54;

            const btnContainer = this.add.container(startX, cardY);
            btnContainer.setSize(cardW, cardH);

            const cardBg = this.add.graphics();
            btnContainer.add(cardBg);
            this.skillBgs.push(cardBg);

            const nameTxt = this.add.text(14, cardH / 2, `${skill.name}`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '19px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0, 0.5);
            btnContainer.add(nameTxt);
            this.skillTexts.push(nameTxt);

            const costTxt = this.add.text(cardW - 14, cardH / 2, `[ ${actualSpCost} SP ]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#00ffcc',
                fontStyle: 'bold'
            }).setOrigin(1, 0.5);
            btnContainer.add(costTxt);

            btnContainer.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, cardW, cardH),
                Phaser.Geom.Rectangle.Contains
            );
            if (btnContainer.input) btnContainer.input.cursor = 'pointer';

            btnContainer.on('pointerdown', () => {
                TouchControls.instance.triggerHaptic(20);
                this.tweens.add({ targets: btnContainer, scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true });
                this.activeSkillIdx = idx;
                this.updateSkillVisuals();
                this.confirmSkillSelection();
            });
            btnContainer.on('pointerover', () => {
                this.activeSkillIdx = idx;
                this.updateSkillVisuals();
            });

            this.skillContainer!.add(btnContainer);
        });

        // Cancel Button Card
        const cancelIdx = this.activeSkills.length;
        const cancelY = startY + cancelIdx * 54;
        const cancelContainer = this.add.container(startX, cancelY);
        cancelContainer.setSize(cardW, cardH);

        const cancelBg = this.add.graphics();
        cancelContainer.add(cancelBg);
        this.skillBgs.push(cancelBg);

        const cancelTxt = this.add.text(cardW / 2, cardH / 2, '↩️ CANCEL', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#8899b3',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        cancelContainer.add(cancelTxt);
        this.skillTexts.push(cancelTxt);

        cancelContainer.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, cardW, cardH),
            Phaser.Geom.Rectangle.Contains
        );
        if (cancelContainer.input) cancelContainer.input.cursor = 'pointer';

        cancelContainer.on('pointerdown', () => {
            this.closeSkillsMenu();
        });
        cancelContainer.on('pointerover', () => {
            this.activeSkillIdx = cancelIdx;
            this.updateSkillVisuals();
        });

        this.skillContainer.add(cancelContainer);

        this.updateSkillVisuals();
    }

    private navigateSkills(delta: number) {
        if (this.combatState !== 'SKILL_MENU' || this.skillTexts.length === 0) return;
        SoundSynth.playMenuBlip();
        const total = this.activeSkills.length + 1; // +1 for Cancel
        this.activeSkillIdx = (this.activeSkillIdx + delta + total) % total;
        this.updateSkillVisuals();
    }

    private updateSkillVisuals() {
        const cardW = this.cmdWidth - 28;
        const cardH = 50;

        this.skillTexts.forEach((txt, idx) => {
            const bg = this.skillBgs[idx];
            if (bg) bg.clear();

            if (idx === this.activeSkillIdx) {
                if (bg) {
                    bg.fillStyle(0x1a2642, 1.0);
                    bg.fillRoundedRect(0, 0, cardW, cardH, 8);
                    bg.lineStyle(2.5, 0x00ffcc, 1.0);
                    bg.strokeRoundedRect(0, 0, cardW, cardH, 8);
                }
                txt.setColor('#00ffcc');
                if (idx < this.activeSkills.length) {
                    const skill = this.activeSkills[idx];
                    txt.setText(`▶ ${skill.name}`);
                    this.dialogueLogText.setText(this.getFormattedText(`[${skill.slotLabel}] ${skill.description}`));
                } else {
                    txt.setText(`▶ ↩️ CANCEL`);
                    this.dialogueLogText.setText('Return to command menu.');
                }
            } else {
                if (bg) {
                    bg.fillStyle(0x0e1424, 0.85);
                    bg.fillRoundedRect(0, 0, cardW, cardH, 8);
                    bg.lineStyle(1.5, 0x242e48, 0.9);
                    bg.strokeRoundedRect(0, 0, cardW, cardH, 8);
                }
                txt.setColor(idx < this.activeSkills.length ? '#ffffff' : '#8899b3');
                if (idx < this.activeSkills.length) {
                    const skill = this.activeSkills[idx];
                    txt.setText(`${skill.name}`);
                } else {
                    txt.setText(`↩️ CANCEL`);
                }
            }
        });
    }

    private closeSkillsMenu() {
        SoundSynth.playMenuCancel();
        if (this.skillContainer) {
            this.skillContainer.destroy();
            this.skillContainer = null;
        }
        this.combatState = 'PLAYER_INPUT';
        this.updateCommandVisuals();
        this.dialogueLogText.setText(this.getFormattedText(`What action will ${this.heroVitals.name} initiate?`));
    }

    private confirmSkillSelection() {
        if (this.combatState !== 'SKILL_MENU') return;

        if (this.activeSkillIdx >= this.activeSkills.length) {
            // Cancel selected
            this.closeSkillsMenu();
            return;
        }

        // Check hero bleed penalty before acting
        if (this.checkHeroBleedOnAction()) {
            if (this.skillContainer) {
                this.skillContainer.destroy();
                this.skillContainer = null;
            }
            return;
        }

        const skill = this.activeSkills[this.activeSkillIdx];
        const spReduction = this.heroVitals.spCostReduction || 0;
        const actualSpCost = Math.max(1, Math.round(skill.spCost * (1 - spReduction / 100)));

        // Check SP
        if (this.heroVitals.sp < actualSpCost) {
            SoundSynth.playMenuCancel();
            this.dialogueLogText.setText(this.getFormattedText(`Not enough SP for ${skill.name}!\nRequired: ${actualSpCost} SP | Current: ${this.heroVitals.sp} SP`));
            this.shakeCamera(100, 0.005);
            return;
        }

        // Deduct SP
        this.heroVitals.sp -= actualSpCost;
        GameManager.instance.setHeroSp(this.heroVitals.sp);
        this.drawPlayerVitals();

        // Close skills menu and transition to animating
        if (this.skillContainer) {
            this.skillContainer.destroy();
            this.skillContainer = null;
        }

        SoundSynth.playMenuSelect();
        this.executePlayerSkill(skill);
    }

    /**
     * Sprint 34: 16-Bit Wind-Up Anticipation & Forward Lunge Attack Animation.
     */
    private playAttackWindup(onStrike: () => void) {
        this.tweens.add({
            targets: this.playerContainer,
            x: this.playerCardX - 24,
            duration: 85,
            ease: 'Back.easeIn',
            onComplete: () => {
                this.tweens.add({
                    targets: this.playerContainer,
                    x: this.playerCardX + 50,
                    duration: 65,
                    ease: 'Power3',
                    onComplete: () => {
                        onStrike();
                        this.tweens.add({
                            targets: this.playerContainer,
                            x: this.playerCardX,
                            duration: 130,
                            ease: 'Back.easeOut'
                        });
                    }
                });
            }
        });
    }

    /**
     * Sprint 34: 16-Bit Luminous Curved Weapon Slash Arc.
     */
    private playSlashArc(targetX: number, targetY: number, color: number = 0x00ffcc, isCrit: boolean = false) {
        const slashGfx = this.add.graphics();
        slashGfx.setDepth(500);

        const arcColor = isCrit ? 0xffd700 : color;
        const width = isCrit ? 6 : 3.5;

        slashGfx.lineStyle(width + 4, arcColor, 0.4);
        slashGfx.beginPath();
        slashGfx.arc(targetX, targetY, 65, Phaser.Math.DegToRad(-45), Phaser.Math.DegToRad(75), false);
        slashGfx.strokePath();

        slashGfx.lineStyle(width, 0xffffff, 1);
        slashGfx.beginPath();
        slashGfx.arc(targetX, targetY, 65, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(70), false);
        slashGfx.strokePath();

        this.tweens.add({
            targets: slashGfx,
            alpha: 0,
            scaleX: isCrit ? 1.6 : 1.3,
            scaleY: isCrit ? 1.6 : 1.3,
            x: targetX * (1 - (isCrit ? 1.6 : 1.3)),
            y: targetY * (1 - (isCrit ? 1.6 : 1.3)),
            duration: isCrit ? 220 : 160,
            ease: 'Power2',
            onComplete: () => slashGfx.destroy()
        });
    }

    /**
     * Sprint 34: Radial Spark Burst Particles.
     */
    private playRadialSparkBurst(x: number, y: number, color: number = 0xffd700, count: number = 14) {
        for (let i = 0; i < count; i++) {
            const spark = this.add.graphics();
            spark.setDepth(505);
            spark.fillStyle(i % 2 === 0 ? 0xffffff : color, 1);
            spark.fillCircle(0, 0, Phaser.Math.Between(2, 4));
            spark.setPosition(x, y);

            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const dist = Phaser.Math.Between(35, 95);
            const targetX = x + Math.cos(angle) * dist;
            const targetY = y + Math.sin(angle) * dist;

            this.tweens.add({
                targets: spark,
                x: targetX,
                y: targetY,
                alpha: 0,
                scaleX: 0.2,
                scaleY: 0.2,
                duration: Phaser.Math.Between(200, 320),
                ease: 'Power2',
                onComplete: () => spark.destroy()
            });
        }
    }

    /**
     * Sprint 34: Critical Hit Impact Punch ("Juice").
     */
    private playCriticalHitPunch(targetX: number, targetY: number) {
        // 1. Golden Slash Screen Flash (respects accessibility)
        this.flashCamera(160, 255, 230, 80, false);

        // 2. Heavy Directional Screen Shake (respects accessibility)
        this.shakeCamera(220, 0.014);

        // 3. Double Radial Spark Burst
        this.playRadialSparkBurst(targetX, targetY, 0xffd700, 18);
        this.playRadialSparkBurst(targetX, targetY, 0xffffff, 8);

        // 4. Animated Neon "CRITICAL!" Text Popup
        const critText = this.add.text(targetX, targetY - 45, '💥 CRITICAL! 💥', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '34px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(600);

        critText.setScale(0.5);
        this.tweens.add({
            targets: critText,
            scaleX: 1.25,
            scaleY: 1.25,
            y: targetY - 75,
            duration: 180,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: critText,
                    y: targetY - 105,
                    alpha: 0,
                    scaleX: 1.4,
                    scaleY: 1.4,
                    duration: 650,
                    ease: 'Power2',
                    onComplete: () => critText.destroy()
                });
            }
        });
    }

    /**
     * Sprint 34: Super-Effective Elemental Weakness Burst FX.
     */
    private playSuperEffectiveBurst(targetX: number, targetY: number, element: ElementType) {
        // Audio Weakness Impact
        SoundSynth.playElementalWeakness(element);

        // Weakness floating banner
        const weakBanner = this.add.text(targetX, targetY - 35, '⚡ WEAKNESS! ⚡', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#ffdd00',
            stroke: '#000000',
            strokeThickness: 5,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(600);

        weakBanner.setScale(0.6);
        this.tweens.add({
            targets: weakBanner,
            scaleX: 1.1,
            scaleY: 1.1,
            y: targetY - 60,
            duration: 200,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: weakBanner,
                    y: targetY - 90,
                    alpha: 0,
                    duration: 600,
                    ease: 'Power2',
                    onComplete: () => weakBanner.destroy()
                });
            }
        });

        if (element === 'fire') {
            this.flashCamera(220, 255, 90, 0, false);
            this.shakeCamera(180, 0.010);
            for (let i = 0; i < 16; i++) {
                const flame = this.add.graphics().setDepth(520);
                flame.fillStyle(i % 2 === 0 ? 0xff4500 : 0xfbbf24, 1);
                flame.fillCircle(0, 0, Phaser.Math.Between(3, 7));
                flame.setPosition(targetX + Phaser.Math.Between(-20, 20), targetY + Phaser.Math.Between(-10, 20));
                this.tweens.add({
                    targets: flame,
                    x: targetX + Phaser.Math.Between(-60, 60),
                    y: targetY - Phaser.Math.Between(40, 110),
                    alpha: 0,
                    scaleX: 0.3,
                    scaleY: 0.3,
                    duration: Phaser.Math.Between(300, 500),
                    ease: 'Power2',
                    onComplete: () => flame.destroy()
                });
            }
        } else if (element === 'cold') {
            this.flashCamera(200, 100, 220, 255, false);
            this.shakeCamera(160, 0.008);
            for (let i = 0; i < 14; i++) {
                const shard = this.add.graphics().setDepth(520);
                shard.fillStyle(i % 2 === 0 ? 0x38bdf8 : 0xffffff, 0.9);
                shard.fillTriangle(0, -6, 4, 6, -4, 6);
                shard.setPosition(targetX, targetY);
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const dist = Phaser.Math.Between(40, 90);
                this.tweens.add({
                    targets: shard,
                    x: targetX + Math.cos(angle) * dist,
                    y: targetY + Math.sin(angle) * dist,
                    rotation: Phaser.Math.FloatBetween(-3, 3),
                    alpha: 0,
                    duration: 380,
                    ease: 'Power2',
                    onComplete: () => shard.destroy()
                });
            }
        } else if (element === 'lightning') {
            this.flashCamera(180, 255, 255, 120, false);
            this.shakeCamera(180, 0.012);
            for (let b = 0; b < 3; b++) {
                const boltGfx = this.add.graphics().setDepth(520);
                boltGfx.lineStyle(3, b === 0 ? 0xffffff : 0xfacc15, 1);
                boltGfx.beginPath();
                let curX = targetX - 50 + b * 20;
                let curY = targetY - 60;
                boltGfx.moveTo(curX, curY);
                for (let seg = 0; seg < 4; seg++) {
                    curX += Phaser.Math.Between(-25, 25);
                    curY += Phaser.Math.Between(20, 35);
                    boltGfx.lineTo(curX, curY);
                }
                boltGfx.strokePath();
                this.tweens.add({
                    targets: boltGfx,
                    alpha: 0,
                    duration: 220,
                    onComplete: () => boltGfx.destroy()
                });
            }
        } else if (element === 'dark') {
            this.flashCamera(220, 140, 20, 240, false);
            this.shakeCamera(180, 0.011);
            const voidRing = this.add.graphics().setDepth(520);
            voidRing.lineStyle(6, 0xa855f7, 0.9);
            voidRing.strokeCircle(targetX, targetY, 20);
            voidRing.lineStyle(3, 0x1e1b4b, 1);
            voidRing.strokeCircle(targetX, targetY, 15);

            this.tweens.add({
                targets: voidRing,
                scaleX: 2.5,
                scaleY: 2.5,
                alpha: 0,
                x: targetX * (1 - 2.5),
                y: targetY * (1 - 2.5),
                duration: 400,
                ease: 'Cubic.easeOut',
                onComplete: () => voidRing.destroy()
            });
        } else if (element === 'poison') {
            this.flashCamera(180, 40, 255, 60, false);
            this.shakeCamera(140, 0.007);
            for (let i = 0; i < 12; i++) {
                const bubble = this.add.graphics().setDepth(520);
                bubble.fillStyle(i % 2 === 0 ? 0x22c55e : 0xa3e635, 0.85);
                bubble.fillCircle(0, 0, Phaser.Math.Between(3, 6));
                bubble.setPosition(targetX + Phaser.Math.Between(-25, 25), targetY + Phaser.Math.Between(-20, 10));
                this.tweens.add({
                    targets: bubble,
                    x: bubble.x + Phaser.Math.Between(-40, 40),
                    y: bubble.y + Phaser.Math.Between(30, 70),
                    alpha: 0,
                    duration: 420,
                    ease: 'Quad.easeIn',
                    onComplete: () => bubble.destroy()
                });
            }
        }
    }

    private executePlayerSkill(skill: ActiveSpell) {
        SoundSynth.playSpellCast(skill.effect);
        this.combatState = 'PLAYER_ANIMATING';
        this.updateCommandVisuals();

        const heroMag = this.heroVitals.magic || 5;
        const magPen = (this.heroVitals.magicPenetration || 0) / 100;

        if (skill.effect === 'heal') {
            const scaledPower = Math.trunc(skill.power + heroMag * 1.2);
            const healAmount = Math.min(this.heroVitals.maxHp - this.heroVitals.hp, scaledPower);
            this.heroVitals.hp = Math.min(this.heroVitals.maxHp, this.heroVitals.hp + scaledPower);
            GameManager.instance.setHeroHp(this.heroVitals.hp);

            this.flashCamera(250, 0, 255, 128, false);
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, healAmount, '#00ff88', '+');
            this.drawPlayerVitals();

            this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} casts ${skill.name}!\nRecovered +${healAmount} HP!`));
            this.time.delayedCall(1000, () => this.postPlayerActionTransition());
            return;
        }

        if (skill.effect === 'rage') {
            this.rageTurnsRemaining = 3;
            this.rageMultiplier = skill.power;

            this.flashCamera(250, 255, 200, 0, false);
            this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} empowers with ${skill.name}!\nStrength surged for 3 turns!`));
            this.time.delayedCall(1000, () => this.postPlayerActionTransition());
            return;
        }

        // Offensive Skills: determine attack element
        const spellElement: ElementType = skill.element || (
            skill.effect === 'fire' || skill.effect === 'phoenix_flare' ? 'fire' :
            skill.effect === 'acid' ? 'poison' :
            skill.effect === 'drain' ? 'dark' : 'physical'
        );

        let basePower = skill.power;
        if (skill.effect === 'drain') basePower = Math.round(skill.power + heroMag * 1.0);
        else if (skill.effect === 'acid') basePower = Math.round(skill.power + heroMag * 1.1);
        else if (skill.effect === 'fire' || skill.effect === 'phoenix_flare') basePower = Math.round(skill.power + heroMag * 1.5);
        else if (skill.effect === 'physical') basePower = skill.power;

        const variance = Phaser.Math.Between(-1, 2);
        const dmgResult = calculateDamage({
            basePower: Math.max(1, basePower + variance),
            attackerMag: heroMag,
            attackerPenetration: magPen,
            defenderDef: this.enemyVitals.defense,
            defenderMDef: this.enemyVitals.magicDefense || 0,
            attackElement: spellElement,
            defenderElement: this.enemyVitals.element,
            defenderResistances: this.enemyVitals.elementalResistances
        });

        const targetX = this.enemyCardX + this.cardWidth / 2;
        const targetY = this.enemyCardY + 140;

        // 1. Check Over-100% Elemental Absorption
        if (dmgResult.isAbsorbed) {
            SoundSynth.playAbsorb();
            const healAmount = dmgResult.absorbedHealing;
            this.enemyVitals.hp = Math.min(this.enemyVitals.maxHp, this.enemyVitals.hp + healAmount);
            this.showFloatingDamage(targetX, targetY, `+${healAmount} HP`, '#00ff88', 'ABSORBED ');
            this.drawEnemyVitals();

            if (skill.effect === 'phoenix_flare') {
                const heroHeal = Math.min(this.heroVitals.maxHp - this.heroVitals.hp, 20);
                this.heroVitals.hp = Math.min(this.heroVitals.maxHp, this.heroVitals.hp + heroHeal);
                GameManager.instance.setHeroHp(this.heroVitals.hp);
                this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, heroHeal, '#00ff88', '+');
                this.drawPlayerVitals();
            }

            this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} casts ${skill.name}!\n${this.enemyVitals.name} ABSORBS the ${spellElement.toUpperCase()} element (+${healAmount} HP)!`));
            this.time.delayedCall(1000, () => this.postPlayerActionTransition());
            return;
        }

        // 2. Normal / Weakness / Resisted Damage
        const damage = dmgResult.damage;
        this.enemyVitals.hp = Math.max(0, this.enemyVitals.hp - damage);

        // Visual flash & FX
        if (dmgResult.multiplier >= 1.5) {
            this.playSuperEffectiveBurst(targetX, targetY, spellElement);
        } else {
            this.playRadialSparkBurst(targetX, targetY, spellElement === 'fire' ? 0xff4500 : spellElement === 'poison' ? 0x22c55e : spellElement === 'dark' ? 0xa855f7 : 0x00ffcc, 10);
            if (spellElement === 'fire') {
                this.flashCamera(220, 255, 80, 0, false);
                this.shakeCamera(140, 0.008);
            } else if (spellElement === 'poison') {
                this.flashCamera(180, 50, 255, 50, false);
            } else if (spellElement === 'dark') {
                this.flashCamera(180, 150, 50, 255, false);
            } else {
                this.shakeCamera(120, 0.006);
            }
        }

        this.tweens.add({ targets: this.enemyContainer, x: '+=10', yoyo: true, duration: 60, repeat: 2 });

        // Floating Damage Label
        if (dmgResult.multiplier >= 1.5) {
            this.showFloatingDamage(targetX, targetY, damage, '#ffcc00', 'WEAKNESS! -');
        } else if (dmgResult.multiplier <= 0.6) {
            this.showFloatingDamage(targetX, targetY, damage, '#8899b3', 'RESIST -');
        } else {
            const color = spellElement === 'fire' ? '#ff3300' : spellElement === 'poison' ? '#33ff33' : spellElement === 'dark' ? '#9933ff' : '#ffffff';
            this.showFloatingDamage(targetX, targetY, damage, color);
        }

        // Secondary Drain / Heal effects
        if (skill.effect === 'drain') {
            const healAmount = Math.min(this.heroVitals.maxHp - this.heroVitals.hp, damage);
            this.heroVitals.hp = Math.min(this.heroVitals.maxHp, this.heroVitals.hp + healAmount);
            GameManager.instance.setHeroHp(this.heroVitals.hp);
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, healAmount, '#00ff88', '+');
        } else if (skill.effect === 'phoenix_flare') {
            const healAmount = Math.min(this.heroVitals.maxHp - this.heroVitals.hp, 20);
            this.heroVitals.hp = Math.min(this.heroVitals.maxHp, this.heroVitals.hp + healAmount);
            GameManager.instance.setHeroHp(this.heroVitals.hp);
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, healAmount, '#00ff88', '+');
        }

        // Thaw Freeze condition
        let thawMsg = '';
        if (spellElement === 'fire' && hasAilment(this.enemyAilments, 'freeze')) {
            removeAilment(this.enemyAilments, 'freeze');
            thawMsg = `\nThe intense flames THAWED the ice!`;
        }

        // Ailment Infliction Roll
        let ailmentMsg = '';
        if (skill.ailmentChance && this.enemyVitals.hp > 0) {
            const roll = Phaser.Math.Between(1, 100);
            if (roll <= Math.round(skill.ailmentChance.chance * 100)) {
                applyAilment(this.enemyAilments, skill.ailmentChance.type, skill.ailmentChance.duration);
                if (skill.ailmentChance.type === 'burn') SoundSynth.playBurn();
                else if (skill.ailmentChance.type === 'freeze') SoundSynth.playFreeze();
                else if (skill.ailmentChance.type === 'poison') SoundSynth.playPoison();
                ailmentMsg = `\nInflicted [${skill.ailmentChance.type.toUpperCase()}] for ${skill.ailmentChance.duration} turns!`;
            }
        }

        this.drawEnemyVitals();
        this.drawPlayerVitals();
        this.updateAilmentBadges();

        const multPrefix = dmgResult.multiplier >= 1.5 ? 'FATAL WEAKNESS! ' : dmgResult.multiplier <= 0.6 ? 'RESISTED! ' : '';
        this.dialogueLogText.setText(this.getFormattedText(`${multPrefix}${this.heroVitals.name} casts ${skill.name}!\nDeals ${damage} ${spellElement.toUpperCase()} damage!${thawMsg}${ailmentMsg}`));

        if (this.enemyVitals.hp <= 0) {
            this.time.delayedCall(800, () => this.handleVictory());
        } else {
            this.time.delayedCall(1000, () => this.postPlayerActionTransition());
        }
    }

    private executePlayerAttack() {
        this.combatState = 'PLAYER_ANIMATING';
        this.updateCommandVisuals();

        // Check hero bleed penalty before physical action
        if (this.checkHeroBleedOnAction()) return;

        // 1. Accuracy vs Evasion Check
        const hitChance = Phaser.Math.Clamp(
            Math.round(this.heroVitals.accuracy - this.enemyVitals.evasion),
            15,
            100
        );
        const hitRoll = Phaser.Math.Between(1, 100);

        if (hitRoll > hitChance) {
            // Enemy smoothly evaded!
            SoundSynth.playMenuCancel();
            this.tweens.add({
                targets: this.enemyContainer,
                y: '-=15',
                yoyo: true,
                duration: 100
            });
            this.showFloatingDamage(this.enemyCardX + this.cardWidth / 2, this.enemyCardY + 140, 'EVADE', '#8899b3');
            this.dialogueLogText.setText(this.getFormattedText(`${this.enemyVitals.name} smoothly EVADED ${this.heroVitals.name}'s attack!`));
            this.time.delayedCall(1000, () => this.postPlayerActionTransition());
            return;
        }

        // 2. Physical damage calculation
        const burnStrPenalty = getBurnStrengthPenalty(this.heroAilments);
        let effectiveStr = Math.round(this.heroVitals.strength * (1 - burnStrPenalty));
        if (this.rageTurnsRemaining > 0) {
            effectiveStr = Math.floor(effectiveStr * this.rageMultiplier);
            this.rageTurnsRemaining--;
        }

        const physPen = (this.heroVitals.physicalPenetration || 0) / 100;
        const baseDamage = Math.max(1, Math.floor(effectiveStr * 1.5));
        const variance = Phaser.Math.Between(-1, 2);

        const dmgResult = calculateDamage({
            basePower: Math.max(1, baseDamage + variance),
            attackerMag: this.heroVitals.magic || 5,
            attackerPenetration: physPen,
            defenderDef: this.enemyVitals.defense,
            defenderMDef: this.enemyVitals.magicDefense || 0,
            attackElement: 'physical',
            defenderElement: this.enemyVitals.element,
            defenderResistances: this.enemyVitals.elementalResistances
        });

        const targetX = this.enemyCardX + this.cardWidth / 2;
        const targetY = this.enemyCardY + 140;

        // Check absorption
        if (dmgResult.isAbsorbed) {
            SoundSynth.playAbsorb();
            const healAmt = dmgResult.absorbedHealing;
            this.enemyVitals.hp = Math.min(this.enemyVitals.maxHp, this.enemyVitals.hp + healAmt);
            this.showFloatingDamage(targetX, targetY, `+${healAmt} HP`, '#00ff88', 'ABSORBED ');
            this.drawEnemyVitals();
            this.dialogueLogText.setText(this.getFormattedText(`${this.enemyVitals.name} absorbed the physical impact!\nRecovered +${healAmt} HP!`));
            this.time.delayedCall(1000, () => this.postPlayerActionTransition());
            return;
        }

        let finalDamage = dmgResult.damage;

        // 3. Check Critical Hit (Crit Chance & Crit Damage Multiplier)
        let isCrit = false;
        if (this.heroVitals.critChance > 0) {
            if (Phaser.Math.Between(1, 100) <= this.heroVitals.critChance) {
                isCrit = true;
                finalDamage = Math.max(1, Math.floor(finalDamage * this.heroVitals.critDamage));
            }
        }

        // 4. Play 16-Bit Wind-up, Curved Slash Arc & Impact Punch
        this.playAttackWindup(() => {
            // Draw 16-bit luminous curved slash arc
            this.playSlashArc(targetX, targetY, isCrit ? 0xffd700 : 0x00ffcc, isCrit);

            // Apply Damage to Enemy
            this.enemyVitals.hp = Math.max(0, this.enemyVitals.hp - finalDamage);

            // Impact Sound & Visual Punch Feedback
            if (isCrit) {
                SoundSynth.playCritHit();
                this.playCriticalHitPunch(targetX, targetY);
            } else {
                SoundSynth.playAttackHit();
                this.shakeCamera(120, 0.006);
                this.playRadialSparkBurst(targetX, targetY, 0x00ffcc, 8);
            }

            // Recoil shake on enemy
            this.tweens.add({
                targets: this.enemyContainer,
                x: '+=14',
                yoyo: true,
                duration: 55,
                repeat: isCrit ? 4 : 2
            });

            if (dmgResult.multiplier >= 1.5) {
                this.playSuperEffectiveBurst(targetX, targetY, 'physical');
                this.showFloatingDamage(targetX, targetY, finalDamage, '#ffcc00', 'WEAKNESS! -');
            } else if (dmgResult.multiplier <= 0.6) {
                this.showFloatingDamage(targetX, targetY, finalDamage, '#8899b3', 'RESIST -');
            } else {
                const dmgColor = isCrit ? '#ffcc00' : '#ff3366';
                this.showFloatingDamage(targetX, targetY, finalDamage, dmgColor);
            }
            this.drawEnemyVitals();

            // Check Lifesteal Passive
            let lifestealMsg = '';
            if (this.passives.lifestealPercent > 0 && this.heroVitals.hp < this.heroVitals.maxHp) {
                const healAmount = Math.max(1, Math.floor(finalDamage * (this.passives.lifestealPercent / 100)));
                this.heroVitals.hp = Math.min(this.heroVitals.maxHp, this.heroVitals.hp + healAmount);
                GameManager.instance.setHeroHp(this.heroVitals.hp);
                this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, healAmount, '#00ff88', '+');
                this.drawPlayerVitals();
                lifestealMsg = `\nLeeched +${healAmount} HP!`;
            }

            const critPrefix = isCrit ? 'CRITICAL STRIKE! ' : '';
            this.dialogueLogText.setText(this.getFormattedText(`${critPrefix}${this.heroVitals.name} strikes ${this.enemyVitals.name} for ${finalDamage} damage!${lifestealMsg}`));

            // 60ms Hit-Pause frame freeze on criticals for heavy punch weight
            const postDelay = isCrit ? 1100 : 1000;
            if (this.enemyVitals.hp <= 0) {
                this.time.delayedCall(800, () => this.handleVictory());
            } else {
                this.time.delayedCall(postDelay, () => this.postPlayerActionTransition());
            }
        });
    }

    private postPlayerActionTransition() {
        if (this.enemyVitals.hp <= 0) {
            this.time.delayedCall(800, () => this.handleVictory());
            return;
        }

        const pet = GameManager.instance.getPetCompanion();
        if (pet && !pet.isDefeated && pet.hp > 0) {
            this.time.delayedCall(800, () => this.executePetTurn());
        } else {
            this.time.delayedCall(800, () => this.executeEnemyTurn());
        }
    }

    private executePetTurn() {
        if (this.combatState === 'VICTORY' || this.combatState === 'DEFEAT') return;

        const pet = GameManager.instance.getPetCompanion();
        if (!pet || pet.isDefeated || pet.hp <= 0) {
            this.executeEnemyTurn();
            return;
        }

        this.combatState = 'PET_TURN';
        this.updateCommandVisuals();

        const decision = PetBattleAI.evaluateTurn(
            pet,
            this.heroVitals,
            this.enemyVitals.hp,
            this.enemyVitals.maxHp,
            this.enemyVitals.element || 'physical'
        );

        // Deduct SP if skill was used
        if (decision.spCost > 0) {
            GameManager.instance.setPetCompanionSp(pet.sp - decision.spCost);
        }

        // Animate pet card forward
        if (this.petContainer) {
            this.tweens.add({
                targets: this.petContainer,
                x: this.petCardX + 16,
                yoyo: true,
                duration: 100,
                repeat: 1
            });
        }

        if (decision.actionType === 'HEAL') {
            SoundSynth.playSpellCast('heal');
            this.flashCamera(200, 0, 255, 150, false);
            if (decision.target === 'PLAYER') {
                const healAmt = Math.min(this.heroVitals.maxHp - this.heroVitals.hp, decision.rawAmount);
                this.heroVitals.hp = Math.min(this.heroVitals.maxHp, this.heroVitals.hp + healAmt);
                GameManager.instance.setHeroHp(this.heroVitals.hp);
                this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, healAmt, '#00ff88', '+');
                this.drawPlayerVitals();
            } else {
                const healAmt = Math.min(pet.maxHp - pet.hp, decision.rawAmount);
                GameManager.instance.setPetCompanionHp(pet.hp + healAmt);
                this.showFloatingDamage(this.petCardX + this.petCardWidth / 2, this.petCardY + 60, healAmt, '#00ff88', '+');
            }
            this.drawPetVitals();
        } else if (decision.actionType === 'SKILL' || decision.actionType === 'ATTACK') {
            const isSkill = decision.actionType === 'SKILL';
            if (isSkill) {
                SoundSynth.playSpellCast(decision.element === 'fire' ? 'fire' : 'physical');
                this.flashCamera(200, decision.element === 'fire' ? 255 : 0, 200, 255, false);
            } else {
                SoundSynth.playAttackHit();
            }
            this.shakeCamera(120, 0.006);

            this.enemyVitals.hp = Math.max(0, this.enemyVitals.hp - decision.rawAmount);
            this.tweens.add({
                targets: this.enemyContainer,
                x: '+=10',
                yoyo: true,
                duration: 60,
                repeat: 2
            });

            const dmgColor = decision.element === 'fire' ? '#ff6600' : (decision.element === 'poison' ? '#33ff33' : '#00ffcc');
            this.showFloatingDamage(this.enemyCardX + this.cardWidth / 2, this.enemyCardY + 140, decision.rawAmount, dmgColor, '-');
            this.drawEnemyVitals();
            this.drawPetVitals();
        }

        this.dialogueLogText.setText(this.getFormattedText(decision.message));

        if (this.enemyVitals.hp <= 0) {
            this.time.delayedCall(800, () => this.handleVictory());
        } else {
            this.time.delayedCall(1200, () => this.executeEnemyTurn());
        }
    }

    private executeEnemyTurn() {
        this.combatState = 'ENEMY_TURN';
        this.updateCommandVisuals();

        // 1. Turn-start Ailment Checks for Enemy (Freeze & Stun)
        if (hasAilment(this.enemyAilments, 'freeze')) {
            SoundSynth.playFreeze();
            this.dialogueLogText.setText(this.getFormattedText(`${this.enemyVitals.name} is encased in solid frost!\nTurn is skipped!`));
            this.flashCamera(200, 0, 200, 255, false);
            this.time.delayedCall(1200, () => {
                this.tickTurnEndAilments();
            });
            return;
        }

        if (hasAilment(this.enemyAilments, 'stun')) {
            SoundSynth.playMenuCancel();
            this.dialogueLogText.setText(this.getFormattedText(`${this.enemyVitals.name} is STUNNED and reeling!\nTurn is skipped!`));
            this.time.delayedCall(1200, () => {
                this.tickTurnEndAilments();
            });
            return;
        }

        // Check Enemy Bleed on action
        if (hasAilment(this.enemyAilments, 'bleed')) {
            const bleedDmg = Math.max(2, Math.trunc(this.enemyVitals.maxHp * 0.06));
            this.enemyVitals.hp = Math.max(0, this.enemyVitals.hp - bleedDmg);
            this.showFloatingDamage(this.enemyCardX + this.cardWidth / 2, this.enemyCardY + 140, bleedDmg, '#cc0033', '-BLEED ');
            this.drawEnemyVitals();
            if (this.enemyVitals.hp <= 0) {
                this.dialogueLogText.setText(this.getFormattedText(`${this.enemyVitals.name} collapsed from arterial bleeding!`));
                this.time.delayedCall(800, () => this.handleVictory());
                return;
            }
        }

        // 2. Autonomous Enemy Targeting: 75% Hero, 25% Pet
        const pet = GameManager.instance.getPetCompanion();
        const enemyTarget = PetBattleAI.evaluateEnemyTarget(pet);

        if (enemyTarget === 'PET' && pet && !pet.isDefeated && pet.hp > 0) {
            const petEvasion = 5;
            const hitChance = Phaser.Math.Clamp(
                Math.round(this.enemyVitals.accuracy - petEvasion),
                15,
                100
            );
            const hitRoll = Phaser.Math.Between(1, 100);

            if (hitRoll > hitChance) {
                this.dialogueLogText.setText(this.getFormattedText(`${pet.name} swiftly EVADED ${this.enemyVitals.name}'s attack!`));
                this.showFloatingDamage(this.petCardX + this.petCardWidth / 2, this.petCardY + 60, 'EVADE', '#00ffcc');
                this.time.delayedCall(1000, () => this.tickTurnEndAilments());
                return;
            }

            const petDef = Math.round(4 + pet.level * 1.5);
            const burnStrPenalty = getBurnStrengthPenalty(this.enemyAilments);
            const effectiveEnemyStr = Math.round(this.enemyVitals.strength * (1 - burnStrPenalty));
            const baseDmg = Math.max(1, Math.floor(effectiveEnemyStr * 1.2) - petDef + Phaser.Math.Between(-1, 1));

            const petDmgResult = PetBattleAI.applyDamageToPet(pet, baseDmg);
            GameManager.instance.setPetCompanionHp(pet.hp);

            SoundSynth.playAttackHit();
            this.shakeCamera(140, 0.007);
            if (this.petContainer) {
                this.tweens.add({
                    targets: this.petContainer,
                    x: this.petCardX - 10,
                    yoyo: true,
                    duration: 60,
                    repeat: 2
                });
            }
            this.showFloatingDamage(this.petCardX + this.petCardWidth / 2, this.petCardY + 60, petDmgResult.actualDamage, '#ff3366', '-');
            this.drawPetVitals();
            this.dialogueLogText.setText(this.getFormattedText(`${this.enemyVitals.name} targets ${pet.name}!\n${petDmgResult.message}`));

            this.time.delayedCall(1200, () => this.tickTurnEndAilments());
            return;
        }

        // 3. Accuracy vs Evasion Check for Hero
        const hitChance = Phaser.Math.Clamp(
            Math.round(this.enemyVitals.accuracy - this.heroVitals.evasion),
            15,
            100
        );
        const hitRoll = Phaser.Math.Between(1, 100);

        if (hitRoll > hitChance) {
            // Hero smoothly evaded!
            this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} smoothly EVADED ${this.enemyVitals.name}'s attack!`));
            this.tweens.add({
                targets: this.playerContainer,
                y: '-=15',
                yoyo: true,
                duration: 100
            });
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, 'EVADE', '#00ffcc');

            this.time.delayedCall(1000, () => {
                this.tickTurnEndAilments();
            });
            return;
        }

        // 3. Enemy damage calculation: Enemy Strength vs. Hero Defense / MDef + Elemental Resistances
        const enemyElement: ElementType = this.enemyVitals.element || 'physical';
        const enemyPhysPen = (this.enemyVitals.physicalPenetration || 0) / 100;
        const enemyMagPen = (this.enemyVitals.magicPenetration || 0) / 100;
        const burnStrPenalty = getBurnStrengthPenalty(this.enemyAilments);
        const effectiveEnemyStr = Math.round(this.enemyVitals.strength * (1 - burnStrPenalty));
        const baseDamage = Math.max(1, Math.floor(effectiveEnemyStr * 1.2));
        const variance = Phaser.Math.Between(-1, 1);

        const dmgResult = calculateDamage({
            basePower: Math.max(1, baseDamage + variance),
            attackerMag: this.enemyVitals.magic || 5,
            attackerPenetration: enemyElement === 'physical' ? enemyPhysPen : enemyMagPen,
            defenderDef: this.heroVitals.defense,
            defenderMDef: this.heroVitals.magicDefense || 3,
            attackElement: enemyElement,
            defenderElement: 'physical',
            defenderResistances: this.passives.elementalResistances
        });

        // 4. Check Hero Over-100% Elemental Absorption
        if (dmgResult.isAbsorbed) {
            SoundSynth.playAbsorb();
            const healAmt = dmgResult.absorbedHealing;
            this.heroVitals.hp = Math.min(this.heroVitals.maxHp, this.heroVitals.hp + healAmt);
            GameManager.instance.setHeroHp(this.heroVitals.hp);
            this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, `+${healAmt} HP`, '#00ff88', 'ABSORBED ');
            this.drawPlayerVitals();
            this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} absorbed the ${enemyElement.toUpperCase()} energy!\nRecovered +${healAmt} HP!`));
            this.time.delayedCall(1000, () => this.tickTurnEndAilments());
            return;
        }

        let finalDamage = dmgResult.damage;

        // Enemy Critical Strike check
        let isCrit = false;
        if (this.enemyVitals.critChance > 0) {
            if (Phaser.Math.Between(1, 100) <= this.enemyVitals.critChance) {
                isCrit = true;
                finalDamage = Math.max(1, Math.floor(finalDamage * (this.enemyVitals.critDamage || 1.5)));
            }
        }

        // Apply Damage to Hero
        this.heroVitals.hp = Math.max(0, this.heroVitals.hp - finalDamage);
        GameManager.instance.setHeroHp(this.heroVitals.hp);

        // Visual Impact Feedback
        this.flashCamera(isCrit ? 250 : 180, 255, isCrit ? 20 : 50, 50, false);
        this.tweens.add({
            targets: this.playerContainer,
            x: isCrit ? '-=15' : '-=10',
            yoyo: true,
            duration: 60,
            repeat: isCrit ? 3 : 2
        });

        const dmgColor = isCrit ? '#ff9900' : '#ff0055';
        this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 140, finalDamage, dmgColor);
        this.drawPlayerVitals();

        // Check Counter-attack Passive (e.g. Goblin Armor spikes)
        let counterMsg = '';
        if (this.passives.counterPercent > 0) {
            const counterDmg = Math.max(1, Math.floor(finalDamage * (this.passives.counterPercent / 100)));
            this.enemyVitals.hp = Math.max(0, this.enemyVitals.hp - counterDmg);
            this.showFloatingDamage(this.enemyCardX + this.cardWidth / 2, this.enemyCardY + 140, counterDmg, '#ff9900');
            this.drawEnemyVitals();
            counterMsg = `\nReflected ${counterDmg} counter-damage!`;
        }

        // Check SP Absorb (e.g. Slime Helmet)
        if (this.passives.spAbsorbChance > 0) {
            if (Phaser.Math.Between(1, 100) <= this.passives.spAbsorbChance && this.heroVitals.sp < this.heroVitals.maxSp) {
                this.heroVitals.sp = Math.min(this.heroVitals.maxSp, this.heroVitals.sp + 2);
                GameManager.instance.setHeroSp(this.heroVitals.sp);
                this.showFloatingDamage(this.playerCardX + this.cardWidth / 2, this.playerCardY + 165, 2, '#ff00ff', '+SP');
                this.drawPlayerVitals();
            }
        }

        // Enemy Infliction Roll on Hero
        let ailmentMsg = '';
        if (this.heroVitals.hp > 0) {
            let infType: StatusAilmentType | null = null;
            let infChance = this.isBossBattle ? 45 : 30;
            let infDur = 3;

            if (this.enemyVitals.speciesId === 'slime') {
                infType = 'poison';
            } else if (this.enemyVitals.speciesId === 'phoenix') {
                infType = 'burn';
            } else if (this.enemyVitals.speciesId === 'bat') {
                infType = 'silence';
                infDur = 2;
            } else if (this.enemyVitals.speciesId === 'skeleton') {
                infType = 'bleed';
            }

            if (infType && Phaser.Math.Between(1, 100) <= infChance) {
                applyAilment(this.heroAilments, infType, infDur);
                if (infType === 'burn') SoundSynth.playBurn();
                else if (infType === 'poison') SoundSynth.playPoison();
                this.updateAilmentBadges();
                ailmentMsg = `\nInflicted [${infType.toUpperCase()}] on ${this.heroVitals.name}!`;
            }
        }

        const critPrefix = isCrit ? 'CRITICAL STRIKE! ' : '';
        this.dialogueLogText.setText(this.getFormattedText(`${critPrefix}${this.enemyVitals.name} attacks dealing ${finalDamage} damage!${counterMsg}${ailmentMsg}`));

        // Check if Hero is Defeated
        if (this.heroVitals.hp <= 0) {
            this.time.delayedCall(900, () => this.handleDefeat());
        } else if (this.enemyVitals.hp <= 0) {
            this.time.delayedCall(800, () => this.handleVictory());
        } else {
            this.time.delayedCall(1000, () => {
                this.tickTurnEndAilments();
            });
        }
    }

    private handleVictory() {
        // Guaranteed battle-scope isolation: purge all status ailments
        this.heroAilments = [];
        this.enemyAilments = [];
        this.combatState = 'VICTORY';
        this.updateCommandVisuals();

        // Award Soul Fragment / Extinction Check (Sprint 8 / 10 / 11 / 25)
        let fragResult = { added: 0, total: 0, endangeredTriggered: false, extinctTriggered: false };
        if (this.enemyVitals.speciesId === 'astral_scavenger') {
            GameManager.instance.unlockEarringsSlot();
        } else if (this.enemyVitals.speciesId !== 'cataclysm') {
            // Cataclysm is not a harvestable species — no fragment is awarded
            fragResult = GameManager.instance.addSoulFragments(this.enemyVitals.speciesId, 1);
        }
        const heroStats = GameManager.instance.getHeroCalculatedStats();

        // Render Glassmorphic Victory Rewards Modal
        this.showVictoryRewardsModal(fragResult, heroStats.level);
    }

    private showVictoryRewardsModal(
        fragResult: { added: number; total: number; endangeredTriggered: boolean; extinctTriggered: boolean },
        soulLevel: number
    ) {
        SoundSynth.stopBgm(100);
        SoundSynth.playVictory();
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.rewardContainer = this.add.container(width / 2, height / 2);
        this.rewardContainer.setDepth(500);

        const modalW = 680;
        // Boss battles get a taller modal to fit the pre-order banner
        const isCataclysm = this.enemyVitals.speciesId === 'cataclysm';
        const isSpecialRelic = this.enemyVitals.speciesId === 'astral_scavenger';
        const showPreorder = this.isBossBattle || isCataclysm;
        const modalH = showPreorder ? 480 : 360;

        const bg = this.add.graphics();
        bg.fillStyle(0x0a0a1f, 0.96);
        bg.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);

        const borderColor = isCataclysm ? 0xff0055 : (isSpecialRelic ? 0xffcc00 : (fragResult.extinctTriggered ? 0xffcc00 : (this.isBossBattle ? 0xff3366 : 0x00ffcc)));
        bg.lineStyle(4, borderColor, 1);
        bg.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);
        this.rewardContainer.add(bg);

        // Modal Title
        let headerText = 'VICTORY ACHIEVED!';
        let headerColor = '#00ffcc';
        if (isCataclysm) {
            headerText = '\u2694\ufe0f CATACLYSM VANQUISHED! \u2694\ufe0f';
            headerColor = '#ff0055';
            this.flashCamera(600, 255, 0, 80, false);
        } else if (isSpecialRelic) {
            headerText = '\u2605 COSMIC RELIC RECOVERED! \u2605';
            headerColor = '#ffcc00';
            this.flashCamera(400, 200, 100, 255, false);
        } else if (fragResult.extinctTriggered) {
            headerText = '\u2605 SPECIES EXTINCTION CERTIFIED! \u2605';
            headerColor = '#ffcc00';
            this.flashCamera(400, 255, 200, 0, false);
        } else if (this.isBossBattle) {
            headerText = 'ALPHA BOSS VANQUISHED!';
            headerColor = '#ff3366';
        }

        const title = this.add.text(0, -modalH / 2 + 35, headerText, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: headerColor,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.rewardContainer.add(title);

        // Reward Lines
        const lines: string[] = [];
        if (isCataclysm) {
            lines.push(`Entity Vanquished:  CATACLYSM (Extinction Engine Singularity)`);
            lines.push(`Soul Level:         LV ${soulLevel} (Ecosystem Fragments Absorbed)`);
            lines.push(`>> EXTINCTION ENGINE EQUILIBRIUM REACHED <<`);
            if (LicenseManager.instance.isCommercial()) {
                lines.push(`>> The remaining species will now push toward total silence. <<`);
            } else {
                lines.push(`>> The planetary ecosystem has stabilized! <<`);
            }
        } else if (isSpecialRelic) {
            lines.push(`Relic Recovered:   Astral Earrings (8th Equipment Slot)`);
            lines.push(`Pet Conduit:       Active (Equip crystal to summon companion)`);
            lines.push(`Soul Level:        LV ${soulLevel} (Unique Species Crystals)`);
            lines.push(`>> RELIC RESTORED: Astral Earrings unlocked in Menu! <<`);
            lines.push(`>> Infuse monster soul into Earrings to summon loyal pet companion! <<`);
        } else {
            lines.push(`Essence Captured:  +${fragResult.added} ${this.enemyVitals.name} Soul Fragment`);
            lines.push(`Total Resonance:   ${fragResult.total}/255 Fragments Collected`);
            lines.push(`Soul Level:        LV ${soulLevel} (Unique Species Crystals)`);

            if (fragResult.extinctTriggered) {
                lines.push(`>> EXTINCTION COMPLETE: Double Stat Multipliers & Mastery Unlocked! <<`);
            } else if (fragResult.endangeredTriggered) {
                lines.push(`>> CRITICAL: ${this.enemyVitals.name} is ENDANGERED! Alpha Boss surfaced! <<`);
            } else {
                lines.push(`>> Equipment Infusion Potency Increased! <<`);
            }
        }

        let offsetY = -modalH / 2 + 100;
        lines.forEach(l => {
            const isHighlight = l.startsWith('>>');
            const txt = this.add.text(0, offsetY, l, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: isHighlight ? '20px' : '22px',
                color: isHighlight ? '#ffcc00' : '#ffffff',
                fontStyle: isHighlight ? 'bold' : 'normal'
            }).setOrigin(0.5);
            this.rewardContainer!.add(txt);
            offsetY += 40;
        });

        // ── Pre-Order Banner (Boss fights only) ───────────────────────────────
        if (showPreorder) {
            const bannerY = modalH / 2 - 145;

            // Separator line
            const sep = this.add.graphics();
            sep.lineStyle(1, isCataclysm ? 0xff0055 : 0x00ffcc, 0.5);
            sep.lineBetween(-modalW / 2 + 24, bannerY, modalW / 2 - 24, bannerY);
            this.rewardContainer.add(sep);

            // Crown / icon header
            const bannerTitle = this.add.text(0, bannerY + 14,
                isCataclysm
                    ? '\u26A1  PRE-ORDER NOW \u2014 PLAY 30 ENTIRE DAYS BEFORE ANYWHERE ELSE!  \u26A1'
                    : '\u{1F451}  PRE-ORDER: PLAY 30 ENTIRE DAYS BEFORE ANYWHERE ELSE!  \u{1F451}',
                {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '16px',
                    color: '#ffd700',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);
            this.rewardContainer.add(bannerTitle);

            // Pitch line
            const pitchLine = this.add.text(0, bannerY + 38,
                '150 Species (200 if media challenge met)  \u2022  100\u00d7100 Open World  \u2022  All Alpha Bosses  \u2022  True Ending',
                {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '15px',
                    color: '#cccccc'
                }
            ).setOrigin(0.5);
            this.rewardContainer.add(pitchLine);

            // Price + platforms
            const priceLine = this.add.text(0, bannerY + 60,
                '$12.99 USD  \u2022  30-Day Early Launch Exclusivity  \u2022  Direct Web / Stripe / Stars',
                {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '15px',
                    color: '#00ffcc'
                }
            ).setOrigin(0.5);
            this.rewardContainer.add(priceLine);

            // Clickable URL button
            const urlBg = this.add.graphics();
            urlBg.fillStyle(isCataclysm ? 0xff0055 : 0x00aa88, 0.3);
            urlBg.lineStyle(1.5, isCataclysm ? 0xff0055 : 0x00ffcc, 0.9);
            urlBg.fillRoundedRect(-160, bannerY + 78, 320, 36, 8);
            urlBg.strokeRoundedRect(-160, bannerY + 78, 320, 36, 8);
            this.rewardContainer.add(urlBg);

            const urlText = this.add.text(0, bannerY + 96, '⚡ Preorder Full Game ($12.99) \u2192 Get Commercial Edition',
                {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '16px',
                    color: '#ffffff',
                    fontStyle: 'bold'
                }
            ).setOrigin(0.5);
            urlText.setInteractive({ useHandCursor: true });
            urlText.on('pointerover', () => urlText.setColor('#ffcc00'));
            urlText.on('pointerout', () => urlText.setColor('#ffffff'));
            urlText.on('pointerdown', () => {
                const purchase = LicenseManager.instance.initiatePurchase();
                if (purchase.rail === 'stripe' && purchase.checkoutUrl) {
                    window.open(purchase.checkoutUrl, '_blank');
                } else {
                    window.open('https://swiftsouls.com', '_blank');
                }
            });
            this.rewardContainer.add(urlText);
        }

        // Prompt to return
        const prompt = this.add.text(0, modalH / 2 - 40, '[ Press SPACE / ENTER or Click to Return ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.rewardContainer.add(prompt);

        // Click to dismiss
        bg.setInteractive(new Phaser.Geom.Rectangle(-modalW / 2, -modalH / 2, modalW, modalH), Phaser.Geom.Rectangle.Contains);
        bg.on('pointerdown', () => this.dismissVictoryModal());
    }

    private dismissVictoryModal() {
        SoundSynth.stopBgm(200);
        this.heroAilments = [];
        this.enemyAilments = [];
        if (this.rewardContainer) {
            this.rewardContainer.destroy();
            this.rewardContainer = null;
        }

        GameManager.instance.saveGame();

        this.cameras.main.fadeOut(700, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.stop('BattleScene');
            this.scene.resume('OverworldScene', { bossDefeated: this.isBossBattle ? this.enemyVitals.speciesId : undefined });
        });
    }

    private handleDefeat() {
        this.heroAilments = [];
        this.enemyAilments = [];
        this.combatState = 'DEFEAT';
        this.updateCommandVisuals();
        SoundSynth.stopBgm(400);

        // Restore HP/SP and revive pet for soft respawn
        GameManager.instance.handlePlayerDeath();

        this.dialogueLogText.setText(this.getFormattedText(`${this.heroVitals.name} collapsed in battle...\nEmergency bio-reconstruction initiated.`));

        this.time.delayedCall(1200, () => {
            this.cameras.main.fadeOut(1200, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.stop('BattleScene');
                this.scene.resume('OverworldScene', { respawnAtPod: true });
            });
        });
    }

    update(time?: number, delta?: number) {
        if (delta && delta > 0) {
            GameManager.instance.updateTimePlayed(delta / 1000);
        }

        // Virtual D-pad navigation support for TouchControls
        const now = time || Date.now();
        if (now - this.lastTouchNavTime > 220) {
            const touchState = TouchControls.instance.getState();
            if (touchState.up) {
                if (this.combatState === 'PLAYER_INPUT') this.navigateCommand(0, -1);
                else if (this.combatState === 'SKILL_MENU') this.navigateSkills(-1);
                this.lastTouchNavTime = now;
            } else if (touchState.down) {
                if (this.combatState === 'PLAYER_INPUT') this.navigateCommand(0, 1);
                else if (this.combatState === 'SKILL_MENU') this.navigateSkills(1);
                this.lastTouchNavTime = now;
            } else if (touchState.left) {
                if (this.combatState === 'PLAYER_INPUT') this.navigateCommand(-1, 0);
                this.lastTouchNavTime = now;
            } else if (touchState.right) {
                if (this.combatState === 'PLAYER_INPUT') this.navigateCommand(1, 0);
                this.lastTouchNavTime = now;
            }
        }

        if (!this.keys) return;

        if (this.combatState === 'PLAYER_INPUT') {
            if (Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
                this.navigateCommand(0, -1);
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
                this.navigateCommand(0, 1);
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.LEFT)) {
                this.navigateCommand(-1, 0);
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.RIGHT)) {
                this.navigateCommand(1, 0);
            }

            if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
                this.executeAction();
            }
        } else if (this.combatState === 'SKILL_MENU') {
            if (Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
                this.navigateSkills(-1);
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
                this.navigateSkills(1);
            }

            if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
                this.confirmSkillSelection();
            }

            if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
                this.closeSkillsMenu();
            }
        } else if (this.combatState === 'VICTORY') {
            if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
                this.dismissVictoryModal();
            }
        }
    }
}
