import Phaser from 'phaser';
import { GameManager, SoulCrystalDatabase, ALL_EQUIPMENT_SLOTS, ALL_MONSTER_SPECIES } from '../systems/GameManager';
import type { EquipmentSlot } from '../systems/GameManager';
import { MapRegistry } from '../systems/MapRegistry';
import { SoundSynth } from '../systems/SoundSynth';
import type { BgmTrackId } from '../systems/SoundSynth';
import { CloudSyncClient } from '../systems/CloudSyncClient';
import { UserAuthManager } from '../systems/UserAuthManager';
import { LicenseManager } from '../systems/LicenseManager';
import { LiveOpsManager } from '../systems/LiveOpsManager';
import { TouchControls } from '../systems/TouchControls';
import { GamepadManager } from '../systems/GamepadManager';
import { AccessibilityManager } from '../systems/AccessibilityManager';
import { CharacterLayerCompositor, MELODIE_ARTWORK_CATALOG } from '../systems/CharacterLayerCompositor';

export class MenuScene extends Phaser.Scene {
    private selectedTab: 'stats' | 'equipment' | 'skills' | 'crystals' | 'world_map' | 'audio' | 'controls' | 'accessibility' | 'cloud' | 'account' | 'bug' | 'close' = 'stats';
    private sidebarOptions: { key: typeof MenuScene.prototype.selectedTab; label: string }[] = [
        { key: 'stats', label: 'CHARACTER STATS' },
        { key: 'equipment', label: 'EQUIP INFUSION' },
        { key: 'skills', label: 'INFUSED POWERS' },
        { key: 'crystals', label: 'SOUL CRYSTALS' },
        { key: 'world_map', label: 'WORLD MAP' },
        { key: 'audio', label: 'AUDIO SETTINGS' },
        { key: 'controls', label: 'CONTROLS & INPUT' },
        { key: 'accessibility', label: 'ACCESSIBILITY' },
        { key: 'cloud', label: 'CLOUD SYNC' },
        { key: 'account', label: 'ACCOUNT & LICENSE' },
        { key: 'bug', label: 'BETA FEEDBACK' },
        { key: 'close', label: 'CLOSE MENU' }
    ];
    private activeSidebarIdx: number = 0;
    
    // UI GameObjects
    private container!: Phaser.GameObjects.Container;
    private backgroundGraphics!: Phaser.GameObjects.Graphics;
    private toastContainer: Phaser.GameObjects.Container | null = null;
    
    private sidebarTexts: Phaser.GameObjects.Text[] = [];
    private detailPanel!: Phaser.GameObjects.Container;
    
    // Sub-menus
    private activeEquipSlotIdx: number = 0;
    private activeSocketIndex: number = 0; // 0: primary socket, 1: secondary soulmeld / pet catalyst socket
    private isSelectingCrystal: boolean = false;
    private activeCrystalSelectIdx: number = 0;
    private availableCrystalsForSocketing: string[] = [];
    
    // Sprint 27: 8-Slot Melodie Swift Artwork Inspect state
    private selectedArtworkVariants: Partial<Record<EquipmentSlot, string>> = {};
    private isInspectingArt: boolean = false;
    private activeInspectSlot: EquipmentSlot = 'sword';
    private inspectModalContainer: Phaser.GameObjects.Container | null = null;
    private inspectArtworkImage: Phaser.GameObjects.Image | null = null;
    private inspectNameText: Phaser.GameObjects.Text | null = null;
    private inspectDescText: Phaser.GameObjects.Text | null = null;
    private inspectLoreText: Phaser.GameObjects.Text | null = null;
    private inspectBonusText: Phaser.GameObjects.Text | null = null;
    private inspectCounterText: Phaser.GameObjects.Text | null = null;
    
    private keys!: {
        UP: Phaser.Input.Keyboard.Key;
        DOWN: Phaser.Input.Keyboard.Key;
        LEFT: Phaser.Input.Keyboard.Key;
        RIGHT: Phaser.Input.Keyboard.Key;
        ENTER: Phaser.Input.Keyboard.Key;
        SPACE: Phaser.Input.Keyboard.Key;
        ESC: Phaser.Input.Keyboard.Key;
        M: Phaser.Input.Keyboard.Key;
    };

    constructor() {
        super('MenuScene');
    }

    create() {
        LicenseManager.instance.pauseTimer();
        this.sidebarTexts = [];
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Initialize inputs
        if (this.input.keyboard) {
            this.keys = this.input.keyboard.addKeys({
                UP: Phaser.Input.Keyboard.KeyCodes.UP,
                DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
                LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
                RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
                ENTER: Phaser.Input.Keyboard.KeyCodes.ENTER,
                SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
                ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
                M: Phaser.Input.Keyboard.KeyCodes.M
            }) as any;

            // Esc / M closes the menu directly or cancels sub-selection
            this.input.keyboard.on('keydown-ESC', () => {
                if (this.isInspectingArt) {
                    this.closeArtworkInspectModal();
                } else if (this.isSelectingCrystal) {
                    SoundSynth.playMenuCancel();
                    this.isSelectingCrystal = false;
                    this.refreshDetails();
                } else {
                    this.closeMenu();
                }
            });
            this.input.keyboard.on('keydown-M', () => {
                if (this.isInspectingArt) {
                    this.closeArtworkInspectModal();
                }
                this.closeMenu();
            });

            // Sprint 27: Keydown 'I' inspects artwork for highlighted equipment slot
            this.input.keyboard.on('keydown-I', () => {
                if (this.selectedTab === 'equipment') {
                    const slot = ALL_EQUIPMENT_SLOTS[this.activeEquipSlotIdx];
                    if (this.isInspectingArt) {
                        this.cycleCurrentArtworkVariant();
                    } else {
                        this.openArtworkInspectModal(slot);
                    }
                }
            });

            // Space key cycles artwork variant while inspecting
            this.input.keyboard.on('keydown-SPACE', () => {
                if (this.isInspectingArt) {
                    this.cycleCurrentArtworkVariant();
                }
            });
        }

        // Gamepad inputs
        if (this.input.gamepad) {
            this.input.gamepad.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
                if (button.index === 9) { // Start/Menu
                    this.closeMenu();
                } else if (button.index === 1) { // B Button (Back)
                    if (this.isSelectingCrystal) {
                        this.isSelectingCrystal = false;
                        this.refreshDetails();
                    } else {
                        this.closeMenu();
                    }
                } else if (button.index === 12 || button.index === 11) { // Up
                    this.navigateMenu(-1);
                } else if (button.index === 13 || button.index === 10) { // Down
                    this.navigateMenu(1);
                } else if (button.index === 14) { // Left
                    this.navigateColumns(-1);
                } else if (button.index === 15) { // Right
                    this.navigateColumns(1);
                } else if (button.index === 0) { // A Confirm
                    this.executeSelection();
                }
            });
        }

        // Main Menu container
        this.container = this.add.container(width / 2, height / 2);
        this.container.setDepth(200);

        // Draw translucent backing card
        const cardWidth = 1100;
        const cardHeight = 750;
        
        this.backgroundGraphics = this.add.graphics();
        
        // Translucent background
        this.backgroundGraphics.fillStyle(0x0a0a16, 0.92);
        this.backgroundGraphics.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        
        // Glowing Double border
        this.backgroundGraphics.lineStyle(4, 0x00ffcc, 1);
        this.backgroundGraphics.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        this.backgroundGraphics.lineStyle(1.5, 0xff00ff, 0.6);
        this.backgroundGraphics.strokeRoundedRect(-cardWidth / 2 - 6, -cardHeight / 2 - 6, cardWidth + 12, cardHeight + 12, 22);
        
        // Inner divider
        this.backgroundGraphics.lineStyle(2, 0x24244c, 0.8);
        this.backgroundGraphics.beginPath();
        this.backgroundGraphics.moveTo(-cardWidth / 2 + 320, -cardHeight / 2 + 40);
        this.backgroundGraphics.lineTo(-cardWidth / 2 + 320, cardHeight / 2 - 40);
        this.backgroundGraphics.stroke();

        this.container.add(this.backgroundGraphics);

        // Menu Header Title
        const headerTitle = this.add.text(-cardWidth / 2 + 40, -cardHeight / 2 + 40, 'SYSTEM INTEGRATION', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '32px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.container.add(headerTitle);

        // Top-Right Close [X] Button (Prominent for touch/mouse)
        const closeBtnBg = this.add.graphics();
        const closeBtnX = cardWidth / 2 - 160;
        const closeBtnY = -cardHeight / 2 + 32;
        closeBtnBg.fillStyle(0xff0055, 0.25);
        closeBtnBg.fillRoundedRect(closeBtnX, closeBtnY, 120, 36, 6);
        closeBtnBg.lineStyle(2, 0xff0055, 0.9);
        closeBtnBg.strokeRoundedRect(closeBtnX, closeBtnY, 120, 36, 6);
        this.container.add(closeBtnBg);

        const closeBtnTxt = this.add.text(closeBtnX + 60, closeBtnY + 18, '✕ CLOSE', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ff3366',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        this.container.add(closeBtnTxt);

        const closeZone = this.add.zone(closeBtnX + 60, closeBtnY + 18, 130, 44);
        closeZone.setInteractive({ useHandCursor: true });
        closeZone.on('pointerdown', () => {
            this.closeMenu();
        });
        closeZone.on('pointerover', () => {
            closeBtnTxt.setColor('#ffffff');
            closeBtnBg.clear();
            closeBtnBg.fillStyle(0xff0055, 0.6);
            closeBtnBg.fillRoundedRect(closeBtnX, closeBtnY, 120, 36, 6);
            closeBtnBg.lineStyle(2, 0xff5588, 1);
            closeBtnBg.strokeRoundedRect(closeBtnX, closeBtnY, 120, 36, 6);
        });
        closeZone.on('pointerout', () => {
            closeBtnTxt.setColor('#ff3366');
            closeBtnBg.clear();
            closeBtnBg.fillStyle(0xff0055, 0.25);
            closeBtnBg.fillRoundedRect(closeBtnX, closeBtnY, 120, 36, 6);
            closeBtnBg.lineStyle(2, 0xff0055, 0.9);
            closeBtnBg.strokeRoundedRect(closeBtnX, closeBtnY, 120, 36, 6);
        });
        this.container.add(closeZone);

        // Initialize sidebar selections
        const sidebarStartY = -cardHeight / 2 + 88;
        this.sidebarOptions.forEach((option, index) => {
            const txt = this.add.text(-cardWidth / 2 + 36, sidebarStartY + index * 42, option.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '17px',
                color: '#ffffff'
            });
            txt.setInteractive({ useHandCursor: true });
            txt.on('pointerdown', () => {
                if (option.key === 'close') {
                    this.closeMenu();
                    return;
                }
                SoundSynth.playMenuBlip();
                if (this.isSelectingCrystal) this.isSelectingCrystal = false;
                this.activeSidebarIdx = index;
                this.selectedTab = option.key;
                this.updateSidebarUI();
                this.refreshDetails();
            });
            this.container.add(txt);
            this.sidebarTexts.push(txt);
        });

        // Initialize detail panel container
        this.detailPanel = this.add.container(-cardWidth / 2 + 360, -cardHeight / 2 + 120);
        this.container.add(this.detailPanel);

        // Initial UI Render
        this.updateSidebarUI();
        this.refreshDetails();

        // Footer Help & Tap-to-Close
        const helpText = this.add.text(0, cardHeight / 2 - 40, 'ARROWS: Navigate | ENTER/SPACE: Action | [ ✕ TAP TO CLOSE / ESC ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#8899b3'
        }).setOrigin(0.5, 0.5);
        helpText.setInteractive({ useHandCursor: true });
        helpText.on('pointerdown', () => {
            this.closeMenu();
        });
        helpText.on('pointerover', () => {
            helpText.setColor('#00ffcc');
        });
        helpText.on('pointerout', () => {
            helpText.setColor('#8899b3');
        });
        this.container.add(helpText);
    }

    update() {
        if (!this.keys) return;

        if (this.isInspectingArt) {
            if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.RIGHT)) {
                this.cycleCurrentArtworkVariant();
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.ESC) || Phaser.Input.Keyboard.JustDown(this.keys.M)) {
                this.closeArtworkInspectModal();
            }
            return;
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
            this.navigateMenu(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
            this.navigateMenu(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keys.LEFT)) {
            this.navigateColumns(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keys.RIGHT)) {
            this.navigateColumns(1);
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
            this.executeSelection();
        }
    }

    private navigateMenu(direction: number) {
        SoundSynth.playMenuBlip();
        if (this.isSelectingCrystal) {
            // Scroll down crystals list
            const maxIdx = this.availableCrystalsForSocketing.length - 1;
            let next = this.activeCrystalSelectIdx + direction;
            if (next < 0) next = maxIdx >= 0 ? maxIdx : 0;
            if (next > maxIdx) next = 0;
            this.activeCrystalSelectIdx = next;
            this.refreshDetails();
        } else if (this.selectedTab === 'equipment') {
            // Scroll down equipment slots (8 slots)
            const maxIdx = ALL_EQUIPMENT_SLOTS.length - 1;
            let next = this.activeEquipSlotIdx + direction;
            if (next < 0) next = maxIdx;
            if (next > maxIdx) next = 0;
            this.activeEquipSlotIdx = next;
            this.refreshDetails();
        } else {
            // Scroll down sidebar options
            let next = this.activeSidebarIdx + direction;
            if (next < 0) next = this.sidebarOptions.length - 1;
            if (next >= this.sidebarOptions.length) next = 0;
            this.activeSidebarIdx = next;
            this.selectedTab = this.sidebarOptions[next].key;
            this.updateSidebarUI();
            this.refreshDetails();
        }
    }

    private navigateColumns(direction: number) {
        if (this.isSelectingCrystal) {
            // Left exits crystal selection
            if (direction === -1) {
                SoundSynth.playMenuCancel();
                this.isSelectingCrystal = false;
                this.refreshDetails();
            }
        } else if (this.selectedTab === 'equipment') {
            // Toggle socket focus (primary vs secondary soulmeld/catalyst) if dual socket is unlocked
            const slotKey = this.getEquipSlotKeyFromIndex(this.activeEquipSlotIdx);
            if (GameManager.instance.isDualSocketUnlocked(slotKey)) {
                this.activeSocketIndex = this.activeSocketIndex === 0 ? 1 : 0;
                SoundSynth.playMenuBlip();
                this.refreshDetails();
            }
        } else if (this.selectedTab === 'audio') {
            if (direction === -1) {
                const newVol = Math.max(0, SoundSynth.getVolume() - 0.05);
                SoundSynth.setVolume(newVol);
                SoundSynth.playMenuBlip();
                this.refreshDetails();
            } else if (direction === 1) {
                const newVol = Math.min(1, SoundSynth.getVolume() + 0.05);
                SoundSynth.setVolume(newVol);
                SoundSynth.playMenuBlip();
                this.refreshDetails();
            }
        }
    }

    private executeSelection() {
        if (this.isSelectingCrystal) {
            // Confirm crystal socketing
            const selectedCrystalId = this.availableCrystalsForSocketing[this.activeCrystalSelectIdx];
            const slotKey = this.getEquipSlotKeyFromIndex(this.activeEquipSlotIdx);
            
            if (this.activeSocketIndex === 1 && GameManager.instance.isDualSocketUnlocked(slotKey)) {
                if (selectedCrystalId === 'none') {
                    GameManager.instance.unsocketSecondaryCrystal(slotKey);
                    SoundSynth.playMenuCancel();
                } else {
                    GameManager.instance.socketSecondaryCrystal(slotKey, selectedCrystalId);
                    SoundSynth.playMenuSelect();
                }
            } else {
                if (selectedCrystalId === 'none') {
                    GameManager.instance.unsocketCrystal(slotKey);
                    SoundSynth.playMenuCancel();
                } else {
                    GameManager.instance.socketCrystal(selectedCrystalId, slotKey);
                    SoundSynth.playMenuSelect();
                }
            }
            
            this.isSelectingCrystal = false;
            this.refreshDetails();
        } else if (this.selectedTab === 'equipment') {
            const slotKey = this.getEquipSlotKeyFromIndex(this.activeEquipSlotIdx);
            if (slotKey === 'earrings' && !GameManager.instance.hasEarringsUnlocked()) {
                SoundSynth.playMenuCancel();
                return;
            }

            SoundSynth.playMenuSelect();
            // Open crystal list for selection
            this.isSelectingCrystal = true;
            this.activeCrystalSelectIdx = 0;
            
            // Gather all unlocked crystals (fragments > 0)
            const state = GameManager.instance.getState();
            this.availableCrystalsForSocketing = ['none']; // 'none' is to clear socket
            for (const speciesId in state.soulCrystals) {
                if (state.soulCrystals[speciesId].fragments > 0) {
                    this.availableCrystalsForSocketing.push(speciesId);
                }
            }
            
            this.refreshDetails();
        } else if (this.selectedTab === 'audio') {
            SoundSynth.toggleMute();
            if (!SoundSynth.isMuted()) {
                SoundSynth.playMenuSelect();
            }
            this.refreshDetails();
        } else if (this.selectedTab === 'close') {
            this.closeMenu();
        }
    }

    private updateSidebarUI() {
        this.sidebarTexts.forEach((text, index) => {
            if (index === this.activeSidebarIdx) {
                text.setColor('#00ffcc');
                text.setText(`> ${this.sidebarOptions[index].label}`);
            } else {
                text.setColor('#ffffff');
                text.setText(`  ${this.sidebarOptions[index].label}`);
            }
        });
    }

    private refreshDetails() {
        this.detailPanel.removeAll(true);
        
        switch (this.selectedTab) {
            case 'stats':
                this.renderStatsView();
                break;
            case 'equipment':
                if (this.isSelectingCrystal) {
                    this.renderCrystalSelectionView();
                } else {
                    this.renderEquipmentView();
                }
                break;
            case 'skills':
                this.renderInfusedPowersView();
                break;
            case 'crystals':
                this.renderCrystalsView();
                break;
            case 'world_map':
                this.renderWorldMapView();
                break;
            case 'audio':
                this.renderAudioSettingsView();
                break;
            case 'controls':
                this.renderControlsAndInputView();
                break;
            case 'accessibility':
                this.renderAccessibilityView();
                break;
            case 'cloud':
                this.renderCloudSyncView();
                break;
            case 'account':
                this.renderAccountAndLicenseView();
                break;
            case 'bug':
                this.renderBugReportView();
                break;
            case 'close':
                this.renderCloseNotice();
                break;
        }
    }

    private renderStatsView() {
        const calculated = GameManager.instance.getHeroCalculatedStats();
        const base = GameManager.instance.getHeroBaseStats();
        const state = GameManager.instance.getState();

        // Calculate total fragments and extinction count
        let totalFragments = 0;
        let extinctCount = 0;
        for (const speciesId in state.soulCrystals) {
            totalFragments += state.soulCrystals[speciesId].fragments;
            if (state.soulCrystals[speciesId].isExtinct) {
                extinctCount++;
            }
        }

        // Header Title
        const header = this.add.text(0, 0, `HERO SPECS: ${calculated.name.toUpperCase()}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        // Melodie's Handcrafted Hero Avatar
        const heroAvatar = this.add.image(620, 16, 'player');
        heroAvatar.setScale(1.5);
        this.detailPanel.add(heroAvatar);

        // 3 Glassmorphic Overview Cards at top
        const overviewCards = [
            {
                title: 'TOTAL SHARDS',
                val: `${totalFragments} / 1785`,
                sub: 'Monster Essence Volume',
                color: '#00ffcc',
                borderColor: 0x00ffcc
            },
            {
                title: 'SOUL LEVEL',
                val: `LV ${calculated.level}`,
                sub: 'Town Evolution Milestone',
                color: '#ffcc00',
                borderColor: 0xffcc00
            },
            {
                title: 'EXTINCTION',
                val: `${extinctCount} / 7 Extinct`,
                sub: 'Biome Eradication Tier',
                color: '#ff3366',
                borderColor: 0xff3366
            }
        ];

        overviewCards.forEach((c, idx) => {
            const cardX = idx * 230;
            const cardY = 45;

            const bg = this.add.graphics();
            bg.fillStyle(0x0f0f2b, 0.85);
            bg.fillRoundedRect(cardX, cardY, 215, 75, 8);
            bg.lineStyle(1.5, c.borderColor, 0.7);
            bg.strokeRoundedRect(cardX, cardY, 215, 75, 8);
            this.detailPanel.add(bg);

            const title = this.add.text(cardX + 12, cardY + 8, c.title, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#8899b3',
                fontStyle: 'bold'
            });
            this.detailPanel.add(title);

            const val = this.add.text(cardX + 12, cardY + 26, c.val, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '20px',
                color: c.color,
                fontStyle: 'bold'
            });
            this.detailPanel.add(val);

            const sub = this.add.text(cardX + 12, cardY + 52, c.sub, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '11px',
                color: '#ffffff'
            });
            this.detailPanel.add(sub);
        });

        // Section Title: Combat Attributes
        const attrHeader = this.add.text(0, 135, 'COMBAT ATTRIBUTES & RATINGS (BASE vs. AFTER)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(attrHeader);

        // Column 1: Physical & Vitals
        const col1Stats = [
            { label: 'HP / Max', val: `${calculated.hp}/${calculated.maxHp}`, base: `Base: ${base.maxHp}` },
            { label: 'SP / Max', val: `${calculated.sp}/${calculated.maxSp}`, base: `Base: ${base.maxSp}` },
            { label: 'Strength', val: `${calculated.strength}`, base: `Base: ${base.strength}` },
            { label: 'Defense ', val: `${calculated.defense}`, base: `Base: ${base.defense}` },
            { label: 'Agility ', val: `${calculated.agility}`, base: `Base: ${base.agility}` },
            { label: 'Phys Pen', val: `${calculated.physicalPenetration}%`, base: `Base: ${base.physicalPenetration}%` },
            { label: 'SP Reduc', val: `${calculated.spCostReduction}%`, base: `Base: ${base.spCostReduction}%` }
        ];

        // Column 2: Arcane & Ratings
        const col2Stats = [
            { label: 'Magic   ', val: `${calculated.magic}`, base: `Base: ${base.magic}` },
            { label: 'MagicDef', val: `${calculated.magicDefense}`, base: `Base: ${base.magicDefense}` },
            { label: 'Accuracy', val: `${calculated.accuracy}%`, base: `Base: ${base.accuracy}%` },
            { label: 'Evasion ', val: `${calculated.evasion}%`, base: `Base: ${base.evasion}%` },
            { label: 'CritRate', val: `${calculated.critChance}%`, base: `Base: ${base.critChance}%` },
            { label: 'CritDmg ', val: `${calculated.critDamage}x`, base: `Base: ${base.critDamage}x` },
            { label: 'Luck    ', val: `${calculated.luck}`, base: `Base: ${base.luck}` }
        ];

        const rowHeight = 38;
        const startY = 165;

        // Render Column 1
        col1Stats.forEach((stat, i) => {
            const y = startY + i * rowHeight;
            const bg = this.add.graphics();
            bg.fillStyle(i % 2 === 0 ? 0x141432 : 0x0f0f26, 0.6);
            bg.fillRoundedRect(0, y - 2, 335, 34, 4);
            this.detailPanel.add(bg);

            const name = this.add.text(8, y + 4, stat.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#ffffff'
            });
            this.detailPanel.add(name);

            const val = this.add.text(125, y + 4, stat.val, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '17px',
                color: '#00ffcc',
                fontStyle: 'bold'
            });
            this.detailPanel.add(val);

            const baseTxt = this.add.text(230, y + 5, stat.base, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#8899b3'
            });
            this.detailPanel.add(baseTxt);
        });

        // Render Column 2
        col2Stats.forEach((stat, i) => {
            const y = startY + i * rowHeight;
            const bg = this.add.graphics();
            bg.fillStyle(i % 2 === 0 ? 0x141432 : 0x0f0f26, 0.6);
            bg.fillRoundedRect(350, y - 2, 335, 34, 4);
            this.detailPanel.add(bg);

            const name = this.add.text(358, y + 4, stat.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#ffffff'
            });
            this.detailPanel.add(name);

            const val = this.add.text(475, y + 4, stat.val, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '17px',
                color: '#ffcc00',
                fontStyle: 'bold'
            });
            this.detailPanel.add(val);

            const baseTxt = this.add.text(580, y + 5, stat.base, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#8899b3'
            });
            this.detailPanel.add(baseTxt);
        });

        // Luck Tier & Bonus Banner
        const luckTier = Math.floor(calculated.luck / 100);
        const luckBonus = luckTier * 0.5;
        const luckBanner = this.add.graphics();
        luckBanner.fillStyle(0x1f1b0a, 0.85);
        luckBanner.fillRoundedRect(0, startY + 7 * rowHeight + 4, 685, 36, 6);
        luckBanner.lineStyle(1.5, 0xffcc00, 0.8);
        luckBanner.strokeRoundedRect(0, startY + 7 * rowHeight + 4, 685, 36, 6);
        this.detailPanel.add(luckBanner);

        const luckBannerTxt = this.add.text(12, startY + 7 * rowHeight + 10,
            `✦ LUCK SCALING: Tier ${luckTier} (${calculated.luck} Luck) ➔ +${luckBonus.toFixed(1)} to all attributes & ratings!`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#ffcc00',
            fontStyle: 'bold',
            wordWrap: { width: 660 }
        });
        this.detailPanel.add(luckBannerTxt);

        // Clean bottom navigation helper
        const tipBox = this.add.graphics();
        tipBox.fillStyle(0x1a1a3a, 0.6);
        tipBox.fillRoundedRect(0, 492, 685, 38, 6);
        tipBox.lineStyle(1, 0x24244c, 0.8);
        tipBox.strokeRoundedRect(0, 492, 685, 38, 6);
        this.detailPanel.add(tipBox);

        const tipText = this.add.text(12, 502, '💡 Infuse Soul Crystals into equipment slots to enhance attributes & unlock active skills.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#00ffcc',
            wordWrap: { width: 660 }
        });
        this.detailPanel.add(tipText);
    }

    private renderInfusedPowersView() {
        // Header
        const header = this.add.text(0, 0, 'INFUSED POWERS & COMBAT PASSIVES', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '26px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        const subtext = this.add.text(0, 38, 'Active spells, passives, and pet conduit granted by equipped Soul Crystals.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#8899b3'
        });
        this.detailPanel.add(subtext);

        const state = GameManager.instance.getState();
        const passives = GameManager.instance.getActivePassives();
        const spells = GameManager.instance.getActiveSpells();

        // 1. Left Section: PASSIVE MODIFIERS (Sword, Shield, Armor, Helmet)
        const passiveHeader = this.add.text(0, 75, '🛡️ COMBAT PASSIVES (GEAR SLOTS)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(passiveHeader);

        const passiveSlots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'helmet'];
        passiveSlots.forEach((slot, idx) => {
            const cardY = 105 + idx * 72;
            const bg = this.add.graphics();
            bg.fillStyle(0x0f0f25, 0.9);
            bg.fillRoundedRect(0, cardY, 335, 62, 6);
            bg.lineStyle(1.5, 0x24244c, 1);
            bg.strokeRoundedRect(0, cardY, 335, 62, 6);
            this.detailPanel.add(bg);

            const crystalId = state.equippedCrystals[slot];
            const slotName = this.add.text(12, cardY + 8, `[${slot.toUpperCase()}]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#ffcc00',
                fontStyle: 'bold'
            });
            this.detailPanel.add(slotName);

            let title = 'EMPTY SOCKET';
            let desc = 'No passive effect active.';
            let titleColor = '#556688';

            if (crystalId) {
                const config = SoulCrystalDatabase[crystalId];
                if (config) {
                    title = config.name;
                    titleColor = '#ff00ff';
                    const effect = GameManager.instance.getScaledSlotEffect(crystalId, slot);
                    desc = effect.description;
                }
            }

            const titleText = this.add.text(90, cardY + 8, title, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: titleColor,
                fontStyle: 'bold'
            });
            this.detailPanel.add(titleText);

            const descText = this.add.text(12, cardY + 32, desc, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#ffffff',
                wordWrap: { width: 315 }
            });
            this.detailPanel.add(descText);
        });

        // 2. Right Section: ACTIVE SPELLS & PET CONDUIT (Ring 1, Ring 2, Amulet, Earrings)
        const spellHeader = this.add.text(355, 75, '✨ SPELLS & CONDUIT (JEWELRY & RELIC)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ff00ff',
            fontStyle: 'bold'
        });
        this.detailPanel.add(spellHeader);

        const spellSlots: EquipmentSlot[] = ['ring1', 'ring2', 'amulet'];
        spellSlots.forEach((slot, idx) => {
            const cardY = 105 + idx * 72;
            const bg = this.add.graphics();
            bg.fillStyle(0x0f0f25, 0.9);
            bg.fillRoundedRect(355, cardY, 330, 62, 6);
            bg.lineStyle(1.5, 0x24244c, 1);
            bg.strokeRoundedRect(355, cardY, 330, 62, 6);
            this.detailPanel.add(bg);

            const crystalId = state.equippedCrystals[slot];
            const slotName = this.add.text(367, cardY + 8, `[${slot.toUpperCase()}]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#ffcc00',
                fontStyle: 'bold'
            });
            this.detailPanel.add(slotName);

            let title = 'EMPTY SOCKET';
            let desc = 'No active spell unlocked.';
            let titleColor = '#556688';

            if (crystalId) {
                const config = SoulCrystalDatabase[crystalId];
                if (config) {
                    title = config.name;
                    titleColor = '#00ffcc';
                    const effect = GameManager.instance.getScaledSlotEffect(crystalId, slot);
                    desc = effect.description;
                }
            }

            const titleText = this.add.text(450, cardY + 8, title, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: titleColor,
                fontStyle: 'bold'
            });
            this.detailPanel.add(titleText);

            const descText = this.add.text(367, cardY + 32, desc, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#ffffff',
                wordWrap: { width: 310 }
            });
            this.detailPanel.add(descText);
        });

        // 4th Card in Right Section: EARRINGS (Pet Companion Conduit)
        const earringY = 105 + 3 * 72; // 321
        const earringBg = this.add.graphics();
        earringBg.fillStyle(0x0f0f25, 0.9);
        earringBg.fillRoundedRect(355, earringY, 330, 62, 6);
        earringBg.lineStyle(1.5, 0x24244c, 1);
        earringBg.strokeRoundedRect(355, earringY, 330, 62, 6);
        this.detailPanel.add(earringBg);

        const hasEarrings = GameManager.instance.hasEarringsUnlocked();
        const earringCrystalId = state.equippedCrystals.earrings;

        const earringSlotName = this.add.text(367, earringY + 8, '[EARRINGS]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: hasEarrings ? '#ffcc00' : '#666666',
            fontStyle: 'bold'
        });
        this.detailPanel.add(earringSlotName);

        let earringTitle = 'LOCKED RELIC';
        let earringDesc = 'Lost in meteor crater. Defeat Astral Scavenger to recover.';
        let earringColor = '#556688';

        if (hasEarrings) {
            if (earringCrystalId) {
                const config = SoulCrystalDatabase[earringCrystalId];
                if (config) {
                    earringTitle = `PET: ${config.name.toUpperCase()}`;
                    earringColor = '#ffd700';
                    const pet = state.petCompanion;
                    if (pet?.augmentation) {
                        earringDesc = `Augmented: ${pet.augmentation.name} (+${pet.augmentation.bonusSkill})`;
                    } else {
                        earringDesc = 'Active follower in overworld & autonomous ally in combat.';
                    }
                }
            } else {
                earringTitle = 'EMPTY CONDUIT';
                earringDesc = 'Socket monster essence to awaken pet companion.';
                earringColor = '#8899b3';
            }
        }

        const earringTitleText = this.add.text(460, earringY + 8, earringTitle, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: earringColor,
            fontStyle: 'bold'
        });
        this.detailPanel.add(earringTitleText);

        const earringDescText = this.add.text(367, earringY + 30, earringDesc, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '12px',
            color: '#ffffff',
            wordWrap: { width: 310 }
        });
        this.detailPanel.add(earringDescText);

        // 3. Combined Battle Telemetry Status Box at Bottom
        const summaryBox = this.add.graphics();
        summaryBox.fillStyle(0x121232, 0.95);
        summaryBox.fillRoundedRect(0, 410, 685, 120, 8);
        summaryBox.lineStyle(2, 0x00ffcc, 0.8);
        summaryBox.strokeRoundedRect(0, 410, 685, 120, 8);
        this.detailPanel.add(summaryBox);

        const summaryTitle = this.add.text(15, 420, 'COMBINED BATTLE TELEMETRY MODIFIERS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(summaryTitle);

        const petSummary = state.petCompanion 
            ? `${state.petCompanion.name}${state.petCompanion.augmentation ? ` [${state.petCompanion.augmentation.bonusSkill}]` : ''}` 
            : (hasEarrings ? 'No Pet Summoned' : 'Conduit Lost');

        const passiveLines = [
            `• Lifesteal: +${passives.lifestealPercent}%   • Critical Strike: +${passives.critChance}%`,
            `• HP Regen: +${passives.hpRegen}/Turn     • SP Regen: +${passives.spRegen}/Turn`,
            `• Evasion: +${passives.evasionPercent}%     • Counter Rate: +${passives.counterPercent}%`,
            `• Spells: ${spells.length} Unlocked   • Companion: ${petSummary}`
        ];

        passiveLines.forEach((line, idx) => {
            const lineTxt = this.add.text(15, 445 + idx * 20, line, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#ffffff',
                wordWrap: { width: 655 }
            });
            this.detailPanel.add(lineTxt);
        });
    }

    private renderEquipmentView() {
        // Header
        const header = this.add.text(0, 0, 'EQUIPMENT ESSENCE INFUSION', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        const subtext = this.add.text(0, 36, 'Socket captured monster essences into your 8 equipment slots.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#8899b3'
        });
        this.detailPanel.add(subtext);

        const state = GameManager.instance.getState();
        const slots: EquipmentSlot[] = ALL_EQUIPMENT_SLOTS;

        slots.forEach((slot, index) => {
            const slotY = 80 + index * 59;
            const isFocused = index === this.activeEquipSlotIdx;
            const isDualUnlocked = GameManager.instance.isDualSocketUnlocked(slot);
            const isEarrings = slot === 'earrings';
            const isUnlocked = !isEarrings || GameManager.instance.hasEarringsUnlocked();

            // Highlight bar for focus
            if (isFocused) {
                const focusBar = this.add.graphics();
                focusBar.fillStyle(0x1a1a3a, 0.7);
                focusBar.fillRoundedRect(-15, slotY - 4, 680, 52, 6);
                focusBar.lineStyle(1.5, 0x00ffcc, 0.8);
                focusBar.strokeRoundedRect(-15, slotY - 4, 680, 52, 6);
                this.detailPanel.add(focusBar);
            }

            // Slot Name
            const slotLabel = isEarrings ? (isUnlocked ? 'EARRINGS' : 'LOCKED') : slot.toUpperCase();
            const slotColor = isUnlocked ? (isFocused ? '#00ffcc' : '#8899b3') : '#555566';
            const slotName = this.add.text(0, slotY, slotLabel.padEnd(8), {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: slotColor,
                fontStyle: 'bold'
            });
            this.detailPanel.add(slotName);

            // Melodie's Artwork Icon across all 8 equipment slots
            if (isUnlocked) {
                const variantId = this.selectedArtworkVariants[slot];
                const variant = CharacterLayerCompositor.getArtworkVariant(slot, variantId);
                const iconKey = this.textures.exists(variant.assetKey) ? variant.assetKey : this.getDefaultSlotIconKey(slot);
                const slotIcon = this.add.image(105, slotY + 11, iconKey);
                slotIcon.setScale(0.38);
                slotIcon.setInteractive({ useHandCursor: true });
                slotIcon.on('pointerdown', () => {
                    this.openArtworkInspectModal(slot);
                });
                slotIcon.on('pointerover', () => {
                    slotIcon.setScale(0.44);
                });
                slotIcon.on('pointerout', () => {
                    slotIcon.setScale(0.38);
                });
                this.detailPanel.add(slotIcon);
            }

            if (!isUnlocked) {
                const lockedText = this.add.text(125, slotY, '[CRATER BOSS RELIC]', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '16px',
                    color: '#ff3366',
                    fontStyle: 'bold'
                });
                this.detailPanel.add(lockedText);

                const lockedDesc = this.add.text(320, slotY + 2, 'Defeat Astral Scavenger at crater rim to recover conduit.', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '13px',
                    color: '#777788',
                    wordWrap: { width: 350 }
                });
                this.detailPanel.add(lockedDesc);
                return;
            }

            // Primary socket crystal
            const crystalId = state.equippedCrystals[slot];
            let crystalLabel = '[EMPTY S1]';
            let labelColor = '#556688';

            if (crystalId) {
                const config = SoulCrystalDatabase[crystalId];
                if (config) {
                    if (isEarrings) {
                        crystalLabel = `🐾 ${config.name.split(' ')[0]}`;
                    } else {
                        crystalLabel = config.name;
                    }
                    labelColor = '#ff00ff';
                }
            }

            // Secondary socket crystal (Soulmeld or Pet Augmentation)
            const secCrystalId = GameManager.instance.getSecondaryEquippedCrystal(slot);
            let secLabel = '';
            let secColor = '#556688';
            if (isDualUnlocked) {
                if (secCrystalId) {
                    const secConfig = SoulCrystalDatabase[secCrystalId];
                    if (isEarrings) {
                        const aug = GameManager.instance.getPetAugmentation(crystalId || 'goblin', secCrystalId);
                        secLabel = `+ 🔮 ${aug.name}`;
                        secColor = '#ffd700';
                    } else {
                        secLabel = `+ 💠 ${secConfig?.name || secCrystalId}`;
                        secColor = '#00ffcc';
                    }
                } else {
                    secLabel = isEarrings ? '+ [NO CATALYST]' : '+ [EMPTY S2]';
                    secColor = '#445577';
                }
            }

            // Display Socket indicator
            const socketHighlight = isFocused && isDualUnlocked 
                ? (this.activeSocketIndex === 0 ? ' (S1 Active)' : ' (S2 Active)') 
                : '';
            
            const crystalText = this.add.text(125, slotY, `${crystalLabel} ${secLabel}${socketHighlight}`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: isFocused ? (this.activeSocketIndex === 1 && isDualUnlocked ? secColor : labelColor) : labelColor,
                fontStyle: 'bold'
            });
            this.detailPanel.add(crystalText);

            // Effect description
            let effectDesc = '';
            if (isEarrings) {
                if (crystalId) {
                    const pet = state.petCompanion;
                    if (pet?.augmentation) {
                        effectDesc = `Pet: ${pet.name} [${pet.augmentation.bonusSkill}]`;
                    } else {
                        effectDesc = `Pet: ${pet?.name || 'Companion'} (Follower & Battle Ally)`;
                    }
                } else {
                    effectDesc = 'Socket monster essence to summon pet companion.';
                }
            } else {
                if (crystalId) {
                    const effect = GameManager.instance.getScaledSlotEffect(crystalId, slot);
                    effectDesc = effect.description;
                    if (secCrystalId) {
                        const secEffect = GameManager.instance.getScaledSlotEffect(secCrystalId, slot);
                        effectDesc += ` | Dual: ${secEffect.description}`;
                    }
                } else {
                    effectDesc = 'No passive effect active.';
                }
            }

            const effectText = this.add.text(420, slotY + 2, effectDesc, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '12px',
                color: '#ffffff',
                wordWrap: { width: 255 }
            });
            this.detailPanel.add(effectText);
        });

        // Instructions
        const actionHelp = this.add.text(0, 560, 'ENTER: Socket | [I]/CLICK: Inspect Art | ◀/▶: Dual Socket | ESC: Back', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#8899b3',
            fontStyle: 'italic',
            wordWrap: { width: 670 }
        });
        this.detailPanel.add(actionHelp);
    }

    private renderCrystalSelectionView() {
        const slotKey = this.getEquipSlotKeyFromIndex(this.activeEquipSlotIdx);
        const isSecondary = this.activeSocketIndex === 1 && GameManager.instance.isDualSocketUnlocked(slotKey);
        const socketTitle = isSecondary 
            ? (slotKey === 'earrings' ? 'PET CATALYST' : 'SOULMELD (S2)') 
            : (slotKey === 'earrings' ? 'PET COMPANION' : 'PRIMARY ESSENCE (S1)');

        const header = this.add.text(0, 0, `SELECT ${socketTitle} FOR ${slotKey.toUpperCase()}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '26px',
            color: isSecondary ? '#ffd700' : '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        const subDesc = slotKey === 'earrings'
            ? (isSecondary 
                ? 'Select a secondary monster catalyst to augment your pet companion with synergy & auras.'
                : 'Select monster essence to summon your loyal overworld follower & autonomous combat ally.')
            : (isSecondary
                ? 'Select a secondary soul crystal to fuse into this item (Boss Soulmeld).'
                : 'Choose an essence to socket. Level/power scale by fragment count.');

        const subtext = this.add.text(0, 38, subDesc, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#8899b3',
            wordWrap: { width: 680 }
        });
        this.detailPanel.add(subtext);

        if (this.availableCrystalsForSocketing.length === 1 && this.availableCrystalsForSocketing[0] === 'none') {
            const emptyNotice = this.add.text(0, 150, 'You have not captured any monster souls yet.\nKill monsters in the wild to gather soul crystals.', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '22px',
                color: '#ff3366',
                align: 'center'
            });
            this.detailPanel.add(emptyNotice);
            return;
        }

        // List available crystals
        this.availableCrystalsForSocketing.forEach((crystalId, index) => {
            const itemY = 115 + index * 60;
            const isFocused = index === this.activeCrystalSelectIdx;

            // Highlight bar
            if (isFocused) {
                const focusBar = this.add.graphics();
                focusBar.fillStyle(0x1a1a3a, 0.7);
                focusBar.fillRoundedRect(-15, itemY - 6, 680, 48, 6);
                focusBar.lineStyle(1.5, isSecondary ? 0xffd700 : 0x00ffcc, 0.8);
                focusBar.strokeRoundedRect(-15, itemY - 6, 680, 48, 6);
                this.detailPanel.add(focusBar);
            }

            // Crystal Item Title
            let label = isSecondary ? 'REMOVE CATALYST (Unsocket)' : 'REMOVE CRYSTAL (Unsocket)';
            let detail = isSecondary ? 'Removes secondary soulmeld/catalyst from slot' : 'Restores slot to base state';
            let color = '#ff3366';

            if (crystalId !== 'none') {
                const config = SoulCrystalDatabase[crystalId];
                const state = GameManager.instance.getState().soulCrystals[crystalId];
                if (config && state) {
                    const tier = Math.floor(state.fragments / 5);
                    label = `${config.name} (Tier ${tier})`;
                    if (slotKey === 'earrings') {
                        if (isSecondary) {
                            const primaryId = GameManager.instance.getState().equippedCrystals.earrings;
                            if (primaryId) {
                                const aug = GameManager.instance.getPetAugmentation(primaryId, crystalId);
                                detail = `Catalyst: ${aug.name} (+${aug.bonusSkill}, ${aug.passiveDescription})`;
                            } else {
                                detail = 'Catalyst Augmentation (Requires primary pet)';
                            }
                        } else {
                            const effect = GameManager.instance.getScaledSlotEffect(crystalId, slotKey);
                            detail = effect.description;
                        }
                    } else {
                        const effect = GameManager.instance.getScaledSlotEffect(crystalId, slotKey);
                        detail = isSecondary ? `Soulmeld: ${effect.description}` : effect.description;
                    }
                    color = '#ffffff';
                }
            }

            const labelText = this.add.text(0, itemY, label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '19px',
                color: isFocused ? '#ffcc00' : color,
                fontStyle: 'bold'
            });
            this.detailPanel.add(labelText);

            const detailText = this.add.text(320, itemY, detail, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#8899b3',
                wordWrap: { width: 350 }
            });
            this.detailPanel.add(detailText);
        });

        const cancelText = this.add.text(0, 560, 'Press ESC/B to cancel and return to slots.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#8899b3',
            fontStyle: 'italic'
        });
        this.detailPanel.add(cancelText);
    }

    private renderCrystalsView() {
        const header = this.add.text(0, 0, 'SOUL CRYSTAL INVENTORY', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        const subtext = this.add.text(0, 34, 'Fragments collected from defeated monsters. Max fragments is 255.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#8899b3'
        });
        this.detailPanel.add(subtext);

        const state = GameManager.instance.getState();
        const speciesList = ALL_MONSTER_SPECIES;

        speciesList.forEach((speciesId, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            
            const gridX = col * 350;
            const gridY = 72 + row * 118;

            const crystalState = state.soulCrystals[speciesId] || { fragments: 0, isExtinct: false };
            const config = SoulCrystalDatabase[speciesId];
            
            if (!config) return;

            // Box backing
            const box = this.add.graphics();
            box.fillStyle(0x0f0f25, 0.85);
            box.lineStyle(1.5, crystalState.isExtinct ? 0xd4af37 : 0x24244c, 1);
            box.fillRoundedRect(gridX, gridY, 335, 110, 8);
            box.strokeRoundedRect(gridX, gridY, 335, 110, 8);
            this.detailPanel.add(box);

            // Title
            const title = this.add.text(gridX + 14, gridY + 12, config.name, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: crystalState.fragments > 0 ? '#ffffff' : '#555555',
                fontStyle: 'bold'
            });
            this.detailPanel.add(title);

            // Extinction badge
            if (crystalState.isExtinct) {
                const extBadge = this.add.text(gridX + 225, gridY + 12, 'EXTINCT', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '12px',
                    color: '#000000',
                    backgroundColor: '#d4af37',
                    padding: { x: 5, y: 2 }
                });
                this.detailPanel.add(extBadge);
            } else if (crystalState.fragments === 254) {
                const endBadge = this.add.text(gridX + 205, gridY + 12, 'ENDANGERED', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '12px',
                    color: '#000000',
                    backgroundColor: '#ff3366',
                    padding: { x: 5, y: 2 }
                });
                this.detailPanel.add(endBadge);
            }

            // Stats boost details
            let detailsStr = 'Locked (No kills)';
            if (crystalState.fragments > 0) {
                const boosts: string[] = [];
                if (crystalState.isExtinct) {
                    for (const stat in config.extinctionBonus) {
                        const typedStat = stat as 'maxHp' | 'maxSp' | 'strength' | 'defense' | 'agility' | 'critChance' | 'luck' | 'magic' | 'magicDefense';
                        const bonus = config.extinctionBonus[typedStat] || 0;
                        const unit = (stat === 'critChance' || stat === 'critDamage' || stat === 'evasion' || stat === 'accuracy') ? '%' : '';
                        boosts.push(`+${bonus}${unit} ${stat.toUpperCase()}`);
                    }
                } else {
                    for (const stat in config.statPerFragment) {
                        const typedStat = stat as 'maxHp' | 'maxSp' | 'strength' | 'defense' | 'agility' | 'critChance' | 'luck' | 'magic' | 'magicDefense';
                        const bonus = (config.statPerFragment[typedStat] || 0) * crystalState.fragments;
                        const unit = (stat === 'critChance' || stat === 'critDamage' || stat === 'evasion' || stat === 'accuracy') ? '%' : '';
                        boosts.push(`+${Math.trunc(bonus)}${unit} ${stat.toUpperCase()}`);
                    }
                }
                detailsStr = boosts.join(', ');
            }

            const detailsText = this.add.text(gridX + 14, gridY + 38, detailsStr, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#00ffcc',
                wordWrap: { width: 305 }
            });
            this.detailPanel.add(detailsText);

            // Progress Bar
            const barBg = this.add.graphics();
            barBg.fillStyle(0x1a1a3a, 1);
            barBg.fillRect(gridX + 14, gridY + 86, 305, 14);
            this.detailPanel.add(barBg);

            if (crystalState.fragments > 0) {
                const barFill = this.add.graphics();
                barFill.fillStyle(crystalState.isExtinct ? 0xd4af37 : 0xff00ff, 1);
                barFill.fillRect(gridX + 14, gridY + 86, 305 * (crystalState.fragments / 255), 14);
                this.detailPanel.add(barFill);
            }

            const fragsText = this.add.text(gridX + 14, gridY + 64, `Fragments: ${crystalState.fragments}/255`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#8899b3'
            });
            this.detailPanel.add(fragsText);
        });

        // Slot 8: Cataclysm Singularity World Boss (Climax Bestiary Entry)
        const catCol = 1;
        const catRow = 3;
        const catGridX = catCol * 350;
        const catGridY = 72 + catRow * 118;

        const cataclysmDefeated = GameManager.instance.isCataclysmBossDefeated();
        const cataclysmTriggered = GameManager.instance.isCataclysmEventTriggered();

        // Box backing
        const catBox = this.add.graphics();
        catBox.fillStyle(0x0f0f25, 0.85);
        const catBorderColor = cataclysmDefeated ? 0xd4af37 : (cataclysmTriggered ? 0xff0055 : 0x24244c);
        catBox.lineStyle(1.5, catBorderColor, 1);
        catBox.fillRoundedRect(catGridX, catGridY, 335, 110, 8);
        catBox.strokeRoundedRect(catGridX, catGridY, 335, 110, 8);
        this.detailPanel.add(catBox);

        // Title
        const catTitleStr = (cataclysmTriggered || cataclysmDefeated) ? 'Cataclysm Singularity' : '??? (Extinction Anomaly)';
        const catTitle = this.add.text(catGridX + 14, catGridY + 12, catTitleStr, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: cataclysmDefeated ? '#ffd700' : (cataclysmTriggered ? '#ff0055' : '#666688'),
            fontStyle: 'bold'
        });
        this.detailPanel.add(catTitle);

        // Extinction/Singularity badge
        let catBadgeLabel = 'DORMANT';
        let catBadgeBg = '#333355';
        let catBadgeColor = '#8888aa';
        let catBadgeX = catGridX + 225;
        if (cataclysmDefeated) {
            catBadgeLabel = 'VANQUISHED';
            catBadgeBg = '#d4af37';
            catBadgeColor = '#000000';
            catBadgeX = catGridX + 205;
        } else if (cataclysmTriggered) {
            catBadgeLabel = 'AWAKENED';
            catBadgeBg = '#ff0055';
            catBadgeColor = '#ffffff';
            catBadgeX = catGridX + 215;
        }
        const catBadge = this.add.text(catBadgeX, catGridY + 12, catBadgeLabel, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '12px',
            color: catBadgeColor,
            backgroundColor: catBadgeBg,
            padding: { x: 5, y: 2 }
        });
        this.detailPanel.add(catBadge);

        // Details string
        let catDetailsStr = 'Awakens when 80% of species reach extinction.';
        if (cataclysmDefeated) {
            catDetailsStr = 'Extinction engine broken. World saved.';
        } else if (cataclysmTriggered) {
            catDetailsStr = 'World Boss active at World Map (50, 50).';
        }
        const catDetailsText = this.add.text(catGridX + 14, catGridY + 38, catDetailsStr, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: cataclysmDefeated ? '#00ffcc' : (cataclysmTriggered ? '#ff5588' : '#667799'),
            wordWrap: { width: 305 }
        });
        this.detailPanel.add(catDetailsText);

        // Progress Bar
        const catBarBg = this.add.graphics();
        catBarBg.fillStyle(0x1a1a3a, 1);
        catBarBg.fillRect(catGridX + 14, catGridY + 86, 305, 14);
        this.detailPanel.add(catBarBg);

        const extinctCount = speciesList.filter(s => state.soulCrystals[s]?.isExtinct).length;
        const targetCount = 6; // 80% of 7 species = 5.6 -> 6 species
        const catProgressRatio = cataclysmDefeated ? 1.0 : Math.min(1.0, extinctCount / targetCount);
        if (catProgressRatio > 0) {
            const catBarFill = this.add.graphics();
            catBarFill.fillStyle(cataclysmDefeated ? 0xd4af37 : (cataclysmTriggered ? 0xff0055 : 0x663399), 1);
            catBarFill.fillRect(catGridX + 14, catGridY + 86, 305 * catProgressRatio, 14);
            this.detailPanel.add(catBarFill);
        }

        const catFragsText = this.add.text(
            catGridX + 14,
            catGridY + 64,
            cataclysmDefeated
                ? 'Status: Extinction Singularity Cleared'
                : (cataclysmTriggered
                    ? 'Status: Apex Threat Active'
                    : `Extinction Progress: ${extinctCount}/${targetCount} (80% Trigger)`),
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#8899b3'
            }
        );
        this.detailPanel.add(catFragsText);
    }

    private renderCloseNotice() {
        const title = this.add.text(0, 40, 'EXIT MENU & RESUME GAME', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(title);

        const sub = this.add.text(0, 80, 'Press ENTER / SPACE or click the button below to return to the world.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#8899b3'
        });
        this.detailPanel.add(sub);

        const resumeBtnBg = this.add.graphics();
        resumeBtnBg.fillStyle(0x00ffcc, 0.2);
        resumeBtnBg.fillRoundedRect(0, 140, 280, 50, 8);
        resumeBtnBg.lineStyle(2, 0x00ffcc, 1);
        resumeBtnBg.strokeRoundedRect(0, 140, 280, 50, 8);
        this.detailPanel.add(resumeBtnBg);

        const resumeBtnTxt = this.add.text(140, 165, '▶ RESUME GAME (ESC)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        this.detailPanel.add(resumeBtnTxt);

        const resumeZone = this.add.zone(140, 165, 280, 50);
        resumeZone.setInteractive({ useHandCursor: true });
        resumeZone.on('pointerdown', () => {
            this.closeMenu();
        });
        resumeZone.on('pointerover', () => {
            resumeBtnTxt.setColor('#ffffff');
            resumeBtnBg.clear();
            resumeBtnBg.fillStyle(0x00ffcc, 0.5);
            resumeBtnBg.fillRoundedRect(0, 140, 280, 50, 8);
            resumeBtnBg.lineStyle(2, 0x88ffee, 1);
            resumeBtnBg.strokeRoundedRect(0, 140, 280, 50, 8);
        });
        resumeZone.on('pointerout', () => {
            resumeBtnTxt.setColor('#00ffcc');
            resumeBtnBg.clear();
            resumeBtnBg.fillStyle(0x00ffcc, 0.2);
            resumeBtnBg.fillRoundedRect(0, 140, 280, 50, 8);
            resumeBtnBg.lineStyle(2, 0x00ffcc, 1);
            resumeBtnBg.strokeRoundedRect(0, 140, 280, 50, 8);
        });
        this.detailPanel.add(resumeZone);
    }

    private renderAudioSettingsView() {
        const header = this.add.text(0, 0, 'AUDIO & MUSIC SETTINGS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '26px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        // Current status variables
        const vol = Math.round(SoundSynth.getVolume() * 100);
        const muted = SoundSynth.isMuted();
        const currentBgm = SoundSynth.getCurrentBgm();

        // 1. Volume & Mute Row
        const volLabel = this.add.text(0, 38, `VOLUME: ${vol}%`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffffff'
        });
        this.detailPanel.add(volLabel);

        const barLength = 12;
        const filled = Math.round((vol / 100) * barLength);
        const empty = barLength - filled;
        const gaugeBar = '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';

        const gaugeText = this.add.text(140, 38, gaugeBar, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: muted ? '#666666' : '#00ffcc'
        });
        this.detailPanel.add(gaugeText);

        const decBtn = this.add.text(300, 34, '[-]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffcc00',
            backgroundColor: '#1f293d',
            padding: { x: 8, y: 4 }
        });
        decBtn.setInteractive({ useHandCursor: true });
        decBtn.on('pointerdown', () => {
            const newVol = Math.max(0, SoundSynth.getVolume() - 0.1);
            SoundSynth.setVolume(newVol);
            SoundSynth.playMenuBlip();
            this.refreshDetails();
        });
        this.detailPanel.add(decBtn);

        const incBtn = this.add.text(345, 34, '[+]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffcc00',
            backgroundColor: '#1f293d',
            padding: { x: 8, y: 4 }
        });
        incBtn.setInteractive({ useHandCursor: true });
        incBtn.on('pointerdown', () => {
            const newVol = Math.min(1, SoundSynth.getVolume() + 0.1);
            SoundSynth.setVolume(newVol);
            SoundSynth.playMenuBlip();
            this.refreshDetails();
        });
        this.detailPanel.add(incBtn);

        const muteToggleBtn = this.add.text(400, 34, muted ? '[ 🔊 UNMUTE ]' : '[ 🔇 MUTE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: muted ? '#3d1f1f' : '#2d3748',
            padding: { x: 10, y: 5 }
        });
        muteToggleBtn.setInteractive({ useHandCursor: true });
        muteToggleBtn.on('pointerdown', () => {
            SoundSynth.toggleMute();
            if (!SoundSynth.isMuted()) {
                SoundSynth.playMenuSelect();
            }
            this.refreshDetails();
        });
        this.detailPanel.add(muteToggleBtn);

        // BGM Status
        const bgmStatus = currentBgm ? currentBgm.toUpperCase() : 'STOPPED';
        const bgmLabel = this.add.text(0, 75, `NOW PLAYING: [ ${bgmStatus} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: currentBgm ? '#00ffcc' : '#8899b3',
            fontStyle: 'bold'
        });
        this.detailPanel.add(bgmLabel);

        // 2. Procedural BGM Jukebox Section
        const jukeHeader = this.add.text(0, 105, '🎶 PROCEDURAL BGM JUKEBOX (9 REGIONAL THEMES)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(jukeHeader);

        const bgmTracks: { id: BgmTrackId; label: string; x: number; y: number }[] = [
            { id: 'overworld', label: '🌲 OVERWORLD', x: 0, y: 135 },
            { id: 'oakhaven', label: '🌾 OAKHAVEN', x: 140, y: 135 },
            { id: 'aetheria', label: '🌌 AETHERIA', x: 280, y: 135 },
            { id: 'ironspire', label: '⚙️ IRONSPIRE', x: 420, y: 135 },
            { id: 'meteor_pod', label: '🛸 METEOR POD', x: 560, y: 135 },
            { id: 'dungeon', label: '🦇 DUNGEON', x: 0, y: 175 },
            { id: 'castle', label: '🏰 CASTLE', x: 140, y: 175 },
            { id: 'battle', label: '⚔️ BATTLE', x: 280, y: 175 },
            { id: 'boss', label: '👑 BOSS', x: 420, y: 175 },
        ];

        bgmTracks.forEach(t => {
            const isPlaying = currentBgm === t.id;
            const btn = this.add.text(t.x, t.y, t.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: isPlaying ? '#00ffcc' : '#ffffff',
                backgroundColor: isPlaying ? '#1e3a5f' : '#1a2332',
                padding: { x: 8, y: 6 }
            });
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                SoundSynth.playBgm(t.id, 150);
                this.refreshDetails();
            });
            this.detailPanel.add(btn);
        });

        const stopBtn = this.add.text(560, 175, '⏹️ STOP BGM', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#ff6666',
            backgroundColor: '#331a1a',
            padding: { x: 8, y: 6 }
        });
        stopBtn.setInteractive({ useHandCursor: true });
        stopBtn.on('pointerdown', () => {
            SoundSynth.stopBgm(200);
            this.refreshDetails();
        });
        this.detailPanel.add(stopBtn);

        // 3. Procedural SFX Preview Bench
        const sfxHeader = this.add.text(0, 225, '🔊 PROCEDURAL SFX PREVIEW BENCH', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(sfxHeader);

        const sfxButtons = [
            { label: '[ ⚔️ SLASH ]', color: '#00ffcc', x: 0, fn: () => SoundSynth.playAttackHit() },
            { label: '[ 💥 CRIT ]', color: '#ff6600', x: 130, fn: () => SoundSynth.playCritHit() },
            { label: '[ ✨ HEAL ]', color: '#00ff88', x: 250, fn: () => SoundSynth.playSpellCast('heal') },
            { label: '[ 🏆 FANFARE ]', color: '#ffcc00', x: 370, fn: () => SoundSynth.playVictory() },
            { label: '[ 🦖 ROAR ]', color: '#ff3366', x: 510, fn: () => SoundSynth.playBossRoar() }
        ];

        sfxButtons.forEach(s => {
            const btn = this.add.text(s.x, 255, s.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: s.color,
                backgroundColor: '#1a2332',
                padding: { x: 8, y: 6 }
            });
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', s.fn);
            this.detailPanel.add(btn);
        });

        // 4. Artist Credits & Legal Attributions Box
        const creditsBox = this.add.graphics();
        creditsBox.fillStyle(0x0a1020, 0.95);
        creditsBox.lineStyle(1.5, 0xffcc00, 0.7);
        creditsBox.fillRoundedRect(0, 310, 680, 210, 8);
        creditsBox.strokeRoundedRect(0, 310, 680, 210, 8);
        this.detailPanel.add(creditsBox);

        const creditsTitle = this.add.text(16, 322, '🎼 MUSIC & ASSET ATTRIBUTIONS (SEE CREDITS.MD)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(creditsTitle);

        const creditsText = this.add.text(16, 350,
            `• Music Composition : Matthew Pablo ("Soliloquy" - CC-BY 3.0)\n` +
            `• Web Audio Engine   : 100% Procedural 16-Bit Polyphonic Synthesis\n` +
            `• Regional Themes    : 9 Unique Adaptive Compositions (32 Steps/Track)\n` +
            `• Sound FX Matrix    : Pure Real-Time Math/Oscillator Waveforms\n` +
            `• Open Source Assets : Kenney & OpenGameArt CC-BY / CC0 Visuals\n` +
            `• Complete licensing & artist attribution terms documented in CREDITS.md`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#94a3b8',
                lineSpacing: 6
            }
        );
        this.detailPanel.add(creditsText);
    }

    private renderControlsAndInputView() {
        const header = this.add.text(0, 0, 'CONTROLS & INPUT SETTINGS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '26px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        // 1. Touch Controls Mode Section
        const touchMode = TouchControls.instance.getMode();
        const isTouchActive = TouchControls.instance.isTouchActive();
        const touchTitle = this.add.text(0, 42, `TOUCH OVERLAY MODE: [ ${touchMode.toUpperCase()} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '19px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(touchTitle);

        const touchDesc = this.add.text(0, 68, isTouchActive 
            ? 'Virtual 4-Way D-Pad & Action buttons are currently ACTIVE.' 
            : 'Virtual 4-Way D-Pad & Action buttons are currently HIDDEN.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#8899b3'
        });
        this.detailPanel.add(touchDesc);

        // Touch mode buttons
        const modes: Array<{ mode: 'auto' | 'on' | 'off'; label: string }> = [
            { mode: 'auto', label: 'AUTO-DETECT' },
            { mode: 'on', label: 'ALWAYS ON' },
            { mode: 'off', label: 'ALWAYS OFF' }
        ];

        modes.forEach((m, idx) => {
            const btnX = idx * 210;
            const isSelected = touchMode === m.mode;
            const btn = this.add.text(btnX, 94, `[ ${m.label} ]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: isSelected ? '#000000' : '#ffffff',
                backgroundColor: isSelected ? '#00ffcc' : '#1f293d',
                padding: { x: 10, y: 6 }
            });
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                TouchControls.instance.setMode(m.mode);
                SoundSynth.playMenuSelect();
                this.refreshDetails();
            });
            this.detailPanel.add(btn);
        });

        // 2. Haptic Feedback (Vibration & Rumble) Section
        const hapticsEnabled = TouchControls.instance.isHapticsEnabled();
        const hapticTitle = this.add.text(0, 150, `HAPTIC FEEDBACK (RUMBLE): [ ${hapticsEnabled ? 'ENABLED' : 'DISABLED'} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '19px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(hapticTitle);

        const hapticToggleBtn = this.add.text(0, 180, hapticsEnabled ? '[ 📳 DISABLE HAPTICS ]' : '[ 📳 ENABLE HAPTICS ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: hapticsEnabled ? '#3d1f1f' : '#1f3d29',
            padding: { x: 12, y: 6 }
        });
        hapticToggleBtn.setInteractive({ useHandCursor: true });
        hapticToggleBtn.on('pointerdown', () => {
            TouchControls.instance.setHapticsEnabled(!hapticsEnabled);
            SoundSynth.playMenuSelect();
            this.refreshDetails();
        });
        this.detailPanel.add(hapticToggleBtn);

        const testRumbleBtn = this.add.text(230, 180, '[ TEST RUMBLE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#2d3748',
            padding: { x: 12, y: 6 }
        });
        testRumbleBtn.setInteractive({ useHandCursor: true });
        testRumbleBtn.on('pointerdown', () => {
            TouchControls.instance.triggerHaptic(50);
            GamepadManager.instance.triggerRumble(0.5, 0.8, 200);
            SoundSynth.playMenuBlip();
        });
        this.detailPanel.add(testRumbleBtn);

        // 3. Hardware Gamepad Status Section
        const isPadConnected = GamepadManager.instance.isConnected();
        const padName = GamepadManager.instance.getPrimaryGamepadName();
        const padTitle = this.add.text(0, 240, `GAMEPAD / CONTROLLER: [ ${isPadConnected ? 'CONNECTED' : 'DISCONNECTED'} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '19px',
            color: isPadConnected ? '#00ffcc' : '#8899b3',
            fontStyle: 'bold'
        });
        this.detailPanel.add(padTitle);

        const padInfo = this.add.text(0, 268, isPadConnected 
            ? `Device: ${padName || 'Standard Gamepad'}\n• Button 0 (A): Action/Confirm  • Button 1 (B): Sprint/Cancel\n• Left Stick / D-Pad: Movement  • Button 9: Menu`
            : 'Plug in or connect any Bluetooth/USB Gamepad (Xbox, PlayStation, or Switch)\nfor automatic plug-and-play controller support.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ffffff',
            lineSpacing: 4
        });
        this.detailPanel.add(padInfo);

        // 4. Keyboard Controls Reference
        const kbTitle = this.add.text(0, 350, 'KEYBOARD & DESKTOP CONTROLS:', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(kbTitle);

        const kbRef = this.add.text(0, 375, 
            '• Movement:           W, A, S, D  or  Arrow Keys\n' +
            '• Action / Interact:  SPACE  or  ENTER\n' +
            '• Menu Toggle:        ESC  or  M\n' +
            '• Quick Touch Toggle: [📱] Icon in Top-Right HUD\n' +
            '• Warps / Battle:     1-6 (Teleport), B (Instant Battle)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#e2e8f0',
            lineSpacing: 4,
            wordWrap: { width: 670 }
        });
        this.detailPanel.add(kbRef);
    }

    private renderAccessibilityView() {
        const header = this.add.text(0, 0, 'ACCESSIBILITY & VISUAL COMFORT', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '26px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        const subheader = this.add.text(0, 32, 'Customize gameplay motion and visual effects for your comfort.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#8899b3'
        });
        this.detailPanel.add(subheader);

        // 1. Screen Shake Setting
        const isShakeEnabled = AccessibilityManager.isScreenShakeEnabled();
        const shakeTitle = this.add.text(0, 75, `CAMERA SCREEN SHAKE: [ ${isShakeEnabled ? 'ENABLED' : 'DISABLED'} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '19px',
            color: isShakeEnabled ? '#00ffcc' : '#ffaa00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(shakeTitle);

        const shakeDesc = this.add.text(0, 102, 
            'Applies dynamic camera shaking during critical strikes, heavy impacts, and earth tremors.\n' +
            'Disable if you experience motion sensitivity or eye fatigue.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#cbd5e1',
            lineSpacing: 4
        });
        this.detailPanel.add(shakeDesc);

        const shakeToggleBtn = this.add.text(0, 155, isShakeEnabled ? '[ 📳 DISABLE SHAKE ]' : '[ 📳 ENABLE SHAKE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: isShakeEnabled ? '#4a1d24' : '#14532d',
            padding: { x: 12, y: 6 }
        });
        shakeToggleBtn.setInteractive({ useHandCursor: true });
        shakeToggleBtn.on('pointerdown', () => {
            AccessibilityManager.toggleScreenShake();
            SoundSynth.playMenuSelect();
            this.refreshDetails();
        });
        this.detailPanel.add(shakeToggleBtn);

        const testShakeBtn = this.add.text(230, 155, '[ TEST SHAKE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#1e293b',
            padding: { x: 12, y: 6 }
        });
        testShakeBtn.setInteractive({ useHandCursor: true });
        testShakeBtn.on('pointerdown', () => {
            AccessibilityManager.shakeCamera(this.cameras.main, 250, 0.015);
            SoundSynth.playMenuBlip();
        });
        this.detailPanel.add(testShakeBtn);

        // 2. Combat Flashes Setting
        const isFlashesEnabled = AccessibilityManager.isCombatFlashesEnabled();
        const flashTitle = this.add.text(0, 220, `COMBAT LIGHT FLASHES: [ ${isFlashesEnabled ? 'ENABLED' : 'DISABLED'} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '19px',
            color: isFlashesEnabled ? '#00ffcc' : '#ffaa00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(flashTitle);

        const flashDesc = this.add.text(0, 247, 
            'Applies rapid high-contrast light flashes during spellcasts, weaknesses, and boss melds.\n' +
            'Disable for photosensitivity comfort or low-light play sessions.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#cbd5e1',
            lineSpacing: 4
        });
        this.detailPanel.add(flashDesc);

        const flashToggleBtn = this.add.text(0, 300, isFlashesEnabled ? '[ ⚡ DISABLE FLASHES ]' : '[ ⚡ ENABLE FLASHES ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: isFlashesEnabled ? '#4a1d24' : '#14532d',
            padding: { x: 12, y: 6 }
        });
        flashToggleBtn.setInteractive({ useHandCursor: true });
        flashToggleBtn.on('pointerdown', () => {
            AccessibilityManager.toggleCombatFlashes();
            SoundSynth.playMenuSelect();
            this.refreshDetails();
        });
        this.detailPanel.add(flashToggleBtn);

        const testFlashBtn = this.add.text(230, 300, '[ TEST FLASH ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#1e293b',
            padding: { x: 12, y: 6 }
        });
        testFlashBtn.setInteractive({ useHandCursor: true });
        testFlashBtn.on('pointerdown', () => {
            AccessibilityManager.flashCamera(this.cameras.main, 250, 0, 255, 200, false);
            SoundSynth.playMenuBlip();
        });
        this.detailPanel.add(testFlashBtn);

        // 3. Reset Defaults Button
        const resetBtn = this.add.text(0, 380, '[ 🔄 RESET ACCESSIBILITY TO DEFAULTS ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ffd700',
            backgroundColor: '#0f172a',
            padding: { x: 14, y: 8 }
        });
        resetBtn.setInteractive({ useHandCursor: true });
        resetBtn.on('pointerdown', () => {
            AccessibilityManager.resetDefaults();
            SoundSynth.playMenuSelect();
            this.refreshDetails();
        });
        this.detailPanel.add(resetBtn);
    }

    private renderCloudSyncView() {
        const client = CloudSyncClient.instance;
        const status = client.getStatus();
        const isOff = client.isOffline();
        const tgUser = GameManager.instance.getTelegramUser();
        const currentSlot = GameManager.instance.getCurrentSaveSlot();
        const pendingCount = client.getPendingQueueCount();

        // 1. Header Title
        const header = this.add.text(0, 0, 'CLOUD SAVE & TELEGRAM SYNC', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        // 2. Status Telemetry Card
        const statusBox = this.add.graphics();
        statusBox.fillStyle(0x0f172a, 0.85);
        statusBox.lineStyle(1, 0x00ffcc, 0.5);
        statusBox.fillRoundedRect(0, 45, 680, 140, 8);
        statusBox.strokeRoundedRect(0, 45, 680, 140, 8);
        this.detailPanel.add(statusBox);

        const userTag = tgUser
            ? `TELEGRAM AUTH : @${tgUser.username || tgUser.first_name} (ID: ${tgUser.id})`
            : `PLAYER PROFILE: GUEST (Local Browser Session)`;

        const statusText = this.add.text(18, 58,
            `CONNECTION STATUS: [ ${status} ]\n` +
            `NETWORK PROFILE  : ${isOff ? 'OFFLINE SIMULATION' : 'ONLINE (REST / MOCK CLOUD)'}\n` +
            `${userTag}\n` +
            `ACTIVE SAVE SLOT : Slot ${currentSlot} of 16\n` +
            `OFFLINE QUEUE    : ${pendingCount} pending save(s)`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#e2e8f0',
                lineSpacing: 5
            }
        );
        this.detailPanel.add(statusText);

        // 3. Interactive Action Buttons
        const syncBtn = this.add.text(0, 205, '[ 🔄 SYNC ACTIVE SLOT NOW ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            backgroundColor: '#1e293b',
            padding: { x: 14, y: 8 }
        });
        syncBtn.setInteractive({ useHandCursor: true });
        syncBtn.on('pointerdown', async () => {
            SoundSynth.playMenuSelect();
            syncBtn.setText('[ ⏳ SYNCING... ]');
            await GameManager.instance.syncWithCloud();
            this.refreshDetails();
        });
        this.detailPanel.add(syncBtn);

        const toggleOfflineBtn = this.add.text(320, 205, isOff ? '[ 🌐 SWITCH TO ONLINE ]' : '[ 📴 SIMULATE OFFLINE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: isOff ? '#00ff88' : '#ffaa00',
            backgroundColor: '#1e293b',
            padding: { x: 14, y: 8 }
        });
        toggleOfflineBtn.setInteractive({ useHandCursor: true });
        toggleOfflineBtn.on('pointerdown', () => {
            client.setOfflineMode(!isOff);
            SoundSynth.playMenuBlip();
            this.refreshDetails();
        });
        this.detailPanel.add(toggleOfflineBtn);

        const clearCloudBtn = this.add.text(0, 260, '[ 🧹 RESET SIMULATED CLOUD ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#f87171',
            backgroundColor: '#2d1515',
            padding: { x: 12, y: 6 }
        });
        clearCloudBtn.setInteractive({ useHandCursor: true });
        clearCloudBtn.on('pointerdown', () => {
            client.clearCloudStorage();
            SoundSynth.playMenuCancel();
            this.refreshDetails();
        });
        this.detailPanel.add(clearCloudBtn);

        // 4. Governance & Architecture Rules Card
        const ruleBox = this.add.graphics();
        ruleBox.fillStyle(0x0a101f, 0.9);
        ruleBox.lineStyle(1, 0x3b82f6, 0.4);
        ruleBox.fillRoundedRect(0, 320, 680, 200, 8);
        ruleBox.strokeRoundedRect(0, 320, 680, 200, 8);
        this.detailPanel.add(ruleBox);

        const ruleTitle = this.add.text(18, 332, 'SECURITY & GOVERNANCE SPECIFICATION', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#60a5fa',
            fontStyle: 'bold'
        });
        this.detailPanel.add(ruleTitle);

        const ruleText = this.add.text(18, 360,
            `• Payload Ceiling  : Hard limit of 5MB enforced on upload and download.\n` +
            `• Client Throttling: Max 3 save transmissions / sec prevents flooding.\n` +
            `• Checksum Security: HMAC-SHA256 FIPS 180-4 / RFC 2104 signatures.\n` +
            `• Conflict Policy  : Safe merge prioritizes Extinct Species (0-6)\n` +
            `                    and Soul Level over timestamps (Zero Rollbacks).\n` +
            `• Telegram Mini App: Cryptographic validation of initData signature\n` +
            `                    via HMAC-SHA256("WebAppData", botToken).`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#94a3b8',
                lineSpacing: 4
            }
        );
        this.detailPanel.add(ruleText);
    }

    private getEquipSlotKeyFromIndex(idx: number): EquipmentSlot {
        const slots: EquipmentSlot[] = ALL_EQUIPMENT_SLOTS;
        return slots[idx] ?? 'sword';
    }

    private renderAccountAndLicenseView() {
        const profile = UserAuthManager.instance.getProfile();
        const tier = LicenseManager.instance.getTier();
        const bondedEmail = profile.email || 'Unlinked (Local Guest)';
        const token = LicenseManager.instance.getRecoveryToken() || 'Not Generated (Demo Tier)';

        // 1. Account Section Card
        const accBox = this.add.graphics();
        accBox.fillStyle(0x0e1728, 0.9);
        accBox.lineStyle(1.5, 0x00ffcc, 0.7);
        accBox.fillRoundedRect(0, 0, 680, 150, 10);
        accBox.strokeRoundedRect(0, 0, 680, 150, 10);
        this.detailPanel.add(accBox);

        const accTitle = this.add.text(20, 14, 'PLAYER IDENTITY & ACCOUNT BONDING', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(accTitle);

        const accDetails = this.add.text(20, 44, 
            `• Linked Account  : ${bondedEmail}\n` +
            `• Auth Provider   : ${profile.authProvider.toUpperCase()}  [${profile.verified ? 'VERIFIED' : 'UNVERIFIED'}]\n` +
            `• Admin Authority : ${profile.isAdmin ? 'AUTHORIZED (PRIMARY)' : 'STANDARD PLAYER'}\n` +
            `• Commercial Bond : ${tier === 'commercial' ? `Bonded to ${bondedEmail}` : 'None'}`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#ffffff',
                lineSpacing: 5
            }
        );
        this.detailPanel.add(accDetails);

        // 2. License Status Card
        const licBox = this.add.graphics();
        licBox.fillStyle(0x12101e, 0.9);
        licBox.lineStyle(1.5, tier === 'commercial' ? 0xffd700 : 0xffaa00, 0.8);
        licBox.fillRoundedRect(0, 165, 680, 160, 10);
        licBox.strokeRoundedRect(0, 165, 680, 160, 10);
        this.detailPanel.add(licBox);

        const licTitle = this.add.text(20, 178, 'DUAL-TIER LICENSE & ENTITLEMENTS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: tier === 'commercial' ? '#ffd700' : '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(licTitle);

        const licDetails = this.add.text(20, 206,
            `• Current License : ${tier.toUpperCase()} EDITION\n` +
            `• Preorder Perk   : 🌟 PLAY 30 ENTIRE DAYS BEFORE PLATFORM LAUNCH!\n` +
            `• Active Playtime : ${Math.floor(LicenseManager.instance.getActivePlaytimeSeconds() / 60)} mins active\n` +
            `• Offline Token   : ${token}\n` +
            `• Price / Rails   : $12.99 USD (Stripe) / 650 Telegram Stars`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#ffffff',
                lineSpacing: 5
            }
        );
        this.detailPanel.add(licDetails);

        // Action Buttons:
        // Preorder / Buy button
        const buyBtn = this.add.text(0, 345, tier === 'commercial' ? '[ 👑 COMMERCIAL ACTIVE ]' : '[ ⚡ PREORDER FULL - $12.99 / ⭐️ 650 ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: tier === 'commercial' ? '#ffd700' : '#ffffff',
            backgroundColor: tier === 'commercial' ? '#2e2508' : '#006655',
            padding: { x: 10, y: 7 }
        });
        buyBtn.setInteractive({ useHandCursor: tier !== 'commercial' });
        buyBtn.on('pointerdown', () => {
            if (tier !== 'commercial') {
                const purchase = LicenseManager.instance.initiatePurchase();
                if (purchase.rail === 'stripe' && purchase.checkoutUrl) {
                    if (typeof window !== 'undefined') {
                        window.open(purchase.checkoutUrl, '_blank');
                    }
                    this.showToast('Redirecting to secure $12.99 Stripe checkout...');
                }
                this.refreshDetails();
            }
        });
        this.detailPanel.add(buyBtn);

        // Redeem Token button
        const redeemBtn = this.add.text(340, 345, '[ 🔑 REDEEM TOKEN ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#00ffcc',
            backgroundColor: '#182438',
            padding: { x: 10, y: 7 }
        });
        redeemBtn.setInteractive({ useHandCursor: true });
        redeemBtn.on('pointerdown', () => {
            const token = LicenseManager.instance.getRecoveryToken() || LicenseManager.instance.generateRecoveryToken();
            const res = LicenseManager.instance.redeemRecoveryToken(token);
            if (res.success) {
                SoundSynth.playFanfare();
                this.showToast('🎉 Commercial tier unlocked via token!');
                this.refreshDetails();
            } else {
                this.showToast(res.message);
            }
        });
        this.detailPanel.add(redeemBtn);

        // View Credits Crawl button
        const creditsBtn = this.add.text(0, 395, '[ 📜 VIEW CREDITS ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#ffd700',
            backgroundColor: '#1f1b0a',
            padding: { x: 10, y: 7 }
        });
        creditsBtn.setInteractive({ useHandCursor: true });
        creditsBtn.on('pointerdown', () => {
            SoundSynth.playMenuSelect();
            this.scene.stop('MenuScene');
            this.scene.start('CreditsScene', { returnScene: 'OverworldScene' });
        });
        this.detailPanel.add(creditsBtn);

        // Disconnect / Reset button
        const dcBtn = this.add.text(340, 395, '[ 🚪 GUEST MODE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#ff6666',
            backgroundColor: '#261218',
            padding: { x: 10, y: 7 }
        });
        dcBtn.setInteractive({ useHandCursor: true });
        dcBtn.on('pointerdown', () => {
            UserAuthManager.instance.disconnectAccount();
            SoundSynth.playMenuBlip();
            this.showToast('Reverted to Guest local session.');
            this.refreshDetails();
        });
        this.detailPanel.add(dcBtn);
    }

    public showToast(message: string, durationMs: number = 3500) {
        if (this.toastContainer) {
            this.toastContainer.destroy();
            this.toastContainer = null;
        }

        const width = this.cameras.main.width;
        const container = this.add.container(width / 2, 70);
        container.setDepth(600);
        this.toastContainer = container;

        const bg = this.add.graphics();
        bg.fillStyle(0x0e1424, 0.95);
        bg.lineStyle(2, 0x00ffcc, 1);

        const txt = this.add.text(0, 0, message, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ffffff',
            align: 'center',
            padding: { x: 20, y: 12 }
        }).setOrigin(0.5, 0.5);

        const textWidth = Math.max(300, txt.width + 40);
        const textHeight = Math.max(44, txt.height + 20);

        bg.fillRoundedRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight, 8);
        bg.strokeRoundedRect(-textWidth / 2, -textHeight / 2, textWidth, textHeight, 8);

        container.add([bg, txt]);

        container.setAlpha(0);
        this.tweens.add({
            targets: container,
            alpha: 1,
            y: 90,
            duration: 250,
            ease: 'Power2'
        });

        this.time.delayedCall(durationMs, () => {
            if (this.toastContainer === container) {
                this.tweens.add({
                    targets: container,
                    alpha: 0,
                    y: 70,
                    duration: 350,
                    ease: 'Power2',
                    onComplete: () => {
                        container.destroy();
                        if (this.toastContainer === container) {
                            this.toastContainer = null;
                        }
                    }
                });
            }
        });
    }

    private renderBugReportView() {
        const state = GameManager.instance.getState();
        const profile = UserAuthManager.instance.getProfile();
        const calculated = GameManager.instance.getHeroCalculatedStats();
        const mapId = state.currentMapId || 'world_map';
        const coords = state.spawnPoint || { x: 0, y: 0 };

        const box = this.add.graphics();
        box.fillStyle(0x0e1728, 0.92);
        box.lineStyle(1.5, 0x00ffcc, 0.8);
        box.fillRoundedRect(0, 0, 680, 230, 10);
        box.strokeRoundedRect(0, 0, 680, 230, 10);
        this.detailPanel.add(box);

        const title = this.add.text(20, 16, '💬 BETA TESTER FEEDBACK & BUG REPORT', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(title);

        const privacyNotice = this.add.text(20, 48,
            `🛡️ Privacy Guarantee:\n` +
            `• 100% Private: Zero personal files, device IDs, or passwords accessed.\n` +
            `• Safe Diagnostics: Only quest coordinates and notes are saved locally.\n` +
            `• Google Play Beta Ready: Helps tune balance before Play Store release.\n\n` +
            `• Current Zone: ${mapId}  (Grid: ${Math.floor(coords.x / 64)}, ${Math.floor(coords.y / 64)}) | Hero: LV ${calculated.level}`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#8899b3',
                lineSpacing: 4
            }
        );
        this.detailPanel.add(privacyNotice);

        const selectLabel = this.add.text(0, 250, 'SELECT FEEDBACK TOPIC TO SUBMIT (1-CLICK):', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#ffd700',
            fontStyle: 'bold'
        });
        this.detailPanel.add(selectLabel);

        const topics = [
            { label: '🗺️ Map / Wall Collision Glitch', note: 'Map / collision issue observed' },
            { label: '⚔️ Combat / Boss Balance Issue', note: 'Combat difficulty / balance feedback' },
            { label: '📱 Mobile Touch / Controls Feedback', note: 'Touch controls or movement feedback' },
            { label: '💡 General Feature / Polish Suggestion', note: 'Feature suggestion for dev team' }
        ];

        topics.forEach((t, idx) => {
            const btn = this.add.text(0, 280 + idx * 42, `[ ${t.label} ]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#182845',
                padding: { x: 12, y: 7 }
            });
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                const res = LiveOpsManager.instance.submitBugReport({
                    playerEmail: profile.email || 'Beta Tester',
                    mapId,
                    coordinates: coords,
                    soulLevel: calculated.level,
                    equipment: state.equippedCrystals,
                    description: `${t.note} at grid (${Math.floor(coords.x / 64)}, ${Math.floor(coords.y / 64)}) in ${mapId}`
                });
                SoundSynth.playMenuSelect();
                this.showToast(res.message);
                this.refreshDetails();
            });
            this.detailPanel.add(btn);
        });

        const recentCount = LiveOpsManager.instance.getBugReports().length;
        const countText = this.add.text(0, 460, `Saved Beta Feedback Reports: ${recentCount}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#556677'
        });
        this.detailPanel.add(countText);
    }

    private getDefaultSlotIconKey(slot: EquipmentSlot): string {
        switch (slot) {
            case 'sword': {
                const swordCrystal = GameManager.instance.getEquippedCrystal('sword');
                if (swordCrystal === 'bat') return 'sword_winged';
                if (swordCrystal === 'phoenix' && this.textures.exists('sword_flame')) return 'sword_flame';
                if (swordCrystal) return 'sword_silver';
                return 'sword_bronze';
            }
            case 'shield': return 'shield_silver';
            case 'armor': return 'armor_royal_plate';
            case 'helmet': return 'helmet_circlet_silver';
            case 'ring1': return 'ring_ruby';
            case 'ring2': return 'ring_sapphire';
            case 'amulet': return 'amulet_meteor_pendant';
            case 'earrings': return 'earrings_astral_pair';
            default: return 'sword_bronze';
        }
    }

    private openArtworkInspectModal(slot: EquipmentSlot): void {
        this.isInspectingArt = true;
        this.activeInspectSlot = slot;
        SoundSynth.playMenuSelect();

        // Default to infusion-matching variant if not manually cycled yet
        if (!this.selectedArtworkVariants[slot]) {
            if (slot === 'sword') {
                const swordCrystal = GameManager.instance.getEquippedCrystal('sword');
                if (swordCrystal === 'bat') {
                    this.selectedArtworkVariants.sword = 'sword_winged';
                } else if (swordCrystal === 'phoenix' && this.textures.exists('sword_flame')) {
                    this.selectedArtworkVariants.sword = 'sword_flame';
                } else if (swordCrystal) {
                    this.selectedArtworkVariants.sword = 'sword_silver';
                } else {
                    this.selectedArtworkVariants.sword = 'sword_bronze';
                }
            }
        }

        // Close any existing modal container
        if (this.inspectModalContainer) {
            this.inspectModalContainer.destroy();
            this.inspectModalContainer = null;
        }

        const modal = this.add.container(0, 0);
        modal.setDepth(300);

        // Semi-transparent backdrop overlay preventing clicking through
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x04050d, 0.88);
        backdrop.fillRect(-600, -400, 1200, 800);
        backdrop.setInteractive(new Phaser.Geom.Rectangle(-600, -400, 1200, 800), Phaser.Geom.Rectangle.Contains);
        backdrop.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const localX = pointer.x - this.cameras.main.width / 2;
            const localY = pointer.y - this.cameras.main.height / 2;
            if (Math.abs(localX) > 340 || Math.abs(localY) > 230) {
                this.closeArtworkInspectModal();
            }
        });
        modal.add(backdrop);

        // Modal Frame Card
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x0e1124, 0.98);
        cardBg.fillRoundedRect(-320, -210, 640, 420, 14);
        cardBg.lineStyle(3, 0xffcc00, 1);
        cardBg.strokeRoundedRect(-320, -210, 640, 420, 14);
        cardBg.lineStyle(1.5, 0x00ffcc, 0.6);
        cardBg.strokeRoundedRect(-324, -214, 648, 428, 18);
        modal.add(cardBg);

        // Header Title
        const header = this.add.text(0, -185, '★ MELODIE SWIFT ORIGINAL ARTWORK ARCHIVE ★', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        modal.add(header);

        // Slot Subheading
        const slotData = MELODIE_ARTWORK_CATALOG[slot];
        const subheader = this.add.text(0, -160, `Slot: ${slot.toUpperCase()} - ${slotData ? slotData.slotTitle : ''}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#8899b3'
        }).setOrigin(0.5, 0.5);
        modal.add(subheader);

        // Art Frame Box (Left side)
        const artFrame = this.add.graphics();
        artFrame.fillStyle(0x161a33, 1);
        artFrame.fillRoundedRect(-290, -135, 170, 170, 10);
        artFrame.lineStyle(2, 0x00ffcc, 0.8);
        artFrame.strokeRoundedRect(-290, -135, 170, 170, 10);
        modal.add(artFrame);

        // Artwork Image
        const initialVariant = CharacterLayerCompositor.getArtworkVariant(slot, this.selectedArtworkVariants[slot]);
        const initialKey = this.textures.exists(initialVariant.assetKey) ? initialVariant.assetKey : this.getDefaultSlotIconKey(slot);
        this.inspectArtworkImage = this.add.image(-205, -50, initialKey);
        this.inspectArtworkImage.setScale(1.8);
        modal.add(this.inspectArtworkImage);

        // Info details (Right side)
        this.inspectNameText = this.add.text(-95, -135, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '19px',
            color: '#ffd700',
            fontStyle: 'bold',
            wordWrap: { width: 370 }
        });
        modal.add(this.inspectNameText);

        this.inspectDescText = this.add.text(-95, -95, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#ffffff',
            wordWrap: { width: 370 }
        });
        modal.add(this.inspectDescText);

        this.inspectLoreText = this.add.text(-95, -45, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#e6ccff',
            fontStyle: 'italic',
            wordWrap: { width: 370 }
        });
        modal.add(this.inspectLoreText);

        this.inspectBonusText = this.add.text(-95, 15, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#00ffcc',
            fontStyle: 'bold',
            wordWrap: { width: 370 }
        });
        modal.add(this.inspectBonusText);

        // Counter text
        this.inspectCounterText = this.add.text(0, 85, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#8899b3'
        }).setOrigin(0.5, 0.5);
        modal.add(this.inspectCounterText);

        // Cycle Button
        const cycleBtn = this.add.text(-120, 135, '▶ NEXT VARIANT (SPACE)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ffffff',
            backgroundColor: '#224488',
            padding: { x: 14, y: 8 }
        }).setOrigin(0.5, 0.5);
        cycleBtn.setInteractive({ useHandCursor: true });
        cycleBtn.on('pointerdown', () => this.cycleCurrentArtworkVariant());
        cycleBtn.on('pointerover', () => cycleBtn.setStyle({ backgroundColor: '#3366cc' }));
        cycleBtn.on('pointerout', () => cycleBtn.setStyle({ backgroundColor: '#224488' }));
        modal.add(cycleBtn);

        // Close Button
        const closeBtn = this.add.text(120, 135, '✖ CLOSE (ESC)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ffffff',
            backgroundColor: '#661122',
            padding: { x: 14, y: 8 }
        }).setOrigin(0.5, 0.5);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.closeArtworkInspectModal());
        closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#992233' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#661122' }));
        modal.add(closeBtn);

        // Help hint
        const hint = this.add.text(0, 180, 'Hint: Variant artwork dynamically persists onto player sprite in real-time.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '12px',
            color: '#667799',
            fontStyle: 'italic'
        }).setOrigin(0.5, 0.5);
        modal.add(hint);

        this.container.add(modal);
        this.inspectModalContainer = modal;

        this.updateInspectModalDetails();
    }

    private getSlotNoun(slot: EquipmentSlot): { article: string; noun: string; verb: string } {
        switch (slot) {
            case 'sword':
                return { article: 'This', noun: 'sword', verb: 'is' };
            case 'shield':
                return { article: 'This', noun: 'shield', verb: 'is' };
            case 'armor':
                return { article: 'This', noun: 'armor', verb: 'is' };
            case 'helmet':
                return { article: 'This', noun: 'circlet', verb: 'is' };
            case 'ring1':
            case 'ring2':
                return { article: 'This', noun: 'ring', verb: 'is' };
            case 'amulet':
                return { article: 'This', noun: 'amulet', verb: 'is' };
            case 'earrings':
                return { article: 'These', noun: 'earrings', verb: 'are' };
        }
    }

    private updateInspectModalDetails(): void {
        const slot = this.activeInspectSlot;
        const slotData = MELODIE_ARTWORK_CATALOG[slot];
        if (!slotData) return;

        const currentVariantId = this.selectedArtworkVariants[slot];
        const variant = CharacterLayerCompositor.getArtworkVariant(slot, currentVariantId);
        const currentIndex = slotData.variants.findIndex(v => v.id === variant.id);
        const total = slotData.variants.length;

        if (this.inspectArtworkImage) {
            const texKey = this.textures.exists(variant.assetKey) ? variant.assetKey : this.getDefaultSlotIconKey(slot);
            this.inspectArtworkImage.setTexture(texKey);
        }

        if (this.inspectNameText) {
            let title = variant.name;
            if (slot === 'sword') {
                if (variant.id === 'sword_winged') {
                    title += ' (Bat Sword)';
                } else if (variant.id === 'sword_bronze') {
                    title += ' (Default Sword)';
                }
            }
            this.inspectNameText.setText(title);
        }

        const slotNoun = this.getSlotNoun(slot);
        const primaryCrystal = GameManager.instance.getEquippedCrystal(slot);
        const secondaryCrystal = GameManager.instance.getSecondaryEquippedCrystal(slot);

        if (this.inspectDescText) {
            if (primaryCrystal) {
                const config = SoulCrystalDatabase[primaryCrystal];
                const fragmentType = config ? config.name : `${primaryCrystal.toUpperCase()} Soul`;
                this.inspectDescText.setText(`${slotNoun.article} ${slotNoun.noun} ${slotNoun.verb} infused with ${fragmentType}.`);
            } else {
                this.inspectDescText.setText(`${slotNoun.article} ${slotNoun.noun} ${slotNoun.verb} not infused with any fragments.`);
            }
        }

        if (this.inspectLoreText) {
            if (primaryCrystal) {
                const scaled = GameManager.instance.getScaledSlotEffect(primaryCrystal, slot);
                this.inspectLoreText.setText(scaled ? `Infused Power: ${scaled.description}` : 'Equipped essence awakens active combat powers.');
            } else {
                this.inspectLoreText.setText('Socket monster soul crystals in the Equipment menu to awaken active spells and combat traits.');
            }
        }

        if (this.inspectBonusText) {
            if (primaryCrystal) {
                const element = CharacterLayerCompositor.SPECIES_AFFINITIES[primaryCrystal] || 'physical';
                const frags = GameManager.instance.getState().soulCrystals[primaryCrystal]?.fragments || 0;
                const isExtinct = GameManager.instance.getState().soulCrystals[primaryCrystal]?.isExtinct;
                const fragCount = isExtinct ? 'EXTINCT (Max Power)' : `${frags}/255 Fragments`;
                let line = `Element: ${element.toUpperCase()}  |  ${fragCount}`;
                if (secondaryCrystal) {
                    const secConfig = SoulCrystalDatabase[secondaryCrystal];
                    const secName = secConfig ? secConfig.name : secondaryCrystal;
                    line += `  |  Melded: ${secName}`;
                }
                this.inspectBonusText.setText(line);
            } else {
                this.inspectBonusText.setText('Element: NONE  |  No Fragments Socketed');
            }
        }

        if (this.inspectCounterText) {
            this.inspectCounterText.setText(`Artwork Card: ${currentIndex + 1} of ${total} | Hand-drawn by Melodie Swift (Click or [SPACE])`);
        }
    }

    private cycleCurrentArtworkVariant(): void {
        const slot = this.activeInspectSlot;
        const currentVariantId = this.selectedArtworkVariants[slot] || '';
        const nextVariant = CharacterLayerCompositor.cycleNextArtworkVariant(slot, currentVariantId);
        this.selectedArtworkVariants[slot] = nextVariant.id;
        SoundSynth.playMenuSelect();
        this.updateInspectModalDetails();
    }

    private closeArtworkInspectModal(): void {
        if (!this.isInspectingArt) return;
        this.isInspectingArt = false;
        SoundSynth.playMenuCancel();
        if (this.inspectModalContainer) {
            this.inspectModalContainer.destroy();
            this.inspectModalContainer = null;
        }
        this.refreshDetails();
    }

    private renderWorldMapView(): void {
        // Header Title & Subtext
        const header = this.add.text(0, 0, 'AETHERIA CONTINENTAL ATLAS (100x100)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        const subtext = this.add.text(0, 30, 'Real-time cartographic scanner & toroidal navigation telemetry', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#8899b3'
        });
        this.detailPanel.add(subtext);

        // Fetch Player Location & World State
        const overworld = this.scene.get('OverworldScene') as any;
        let pGridX = 45;
        let pGridY = 46;
        let currentMapId = 'world_map';
        if (overworld && overworld.player) {
            pGridX = Math.floor(overworld.player.x / 64);
            pGridY = Math.floor(overworld.player.y / 64);
            currentMapId = overworld.currentMapId || 'world_map';
        } else {
            const state = GameManager.instance.getState();
            if (state.spawnPoint) {
                pGridX = Math.floor(state.spawnPoint.x / 64);
                pGridY = Math.floor(state.spawnPoint.y / 64);
            }
        }

        // Clamp to 0..99
        pGridX = Math.min(99, Math.max(0, pGridX));
        pGridY = Math.min(99, Math.max(0, pGridY));

        // 1. Draw World Radar Map (400x400)
        const mapOffsetX = 0;
        const mapOffsetY = 56;
        const tileSize = 4; // 100 * 4 = 400px

        const radarGfx = this.add.graphics();
        
        // Map Background Backing
        radarGfx.fillStyle(0x050510, 0.95);
        radarGfx.fillRect(mapOffsetX, mapOffsetY, 400, 400);

        // Render World Grid Tiles
        const worldGrid = MapRegistry.buildToroidalWorldGrid();
        for (let y = 0; y < 100; y++) {
            for (let x = 0; x < 100; x++) {
                const tile = worldGrid[y][x];
                let color = 0x3f6212; // Grass default (0)
                switch (tile) {
                    case 12: // Water
                        color = 0x0284c7;
                        break;
                    case 0: // Plains grass
                        color = 0x365314;
                        break;
                    case 2: // Tall grass encounter
                        color = 0x16a34a;
                        break;
                    case 11: // Wildflowers
                        color = 0xeab308;
                        break;
                    case 5: // Forest
                        color = 0x14532d;
                        break;
                    case 6: // Hills
                        color = 0x65a30d;
                        break;
                    case 1: // Mountain
                        color = 0x475569;
                        break;
                    case 3: // Paved Causeway / Road
                        color = 0xf8fafc;
                        break;
                    case 4: // Stone floor
                        color = 0x94a3b8;
                        break;
                    case 9: // Bridge over ocean
                        color = 0x38bdf8;
                        break;
                    case 10: // Sandbar
                        color = 0xd97706;
                        break;
                    case 7: // Crater Basalt
                        color = 0x1c1917;
                        break;
                    case 8: // Magma Fissure
                        color = 0xef4444;
                        break;
                }
                radarGfx.fillStyle(color, 1);
                radarGfx.fillRect(mapOffsetX + x * tileSize, mapOffsetY + y * tileSize, tileSize, tileSize);
            }
        }

        // Subdivide Quadrants (faint grid lines at 25, 50, 75)
        radarGfx.lineStyle(1, 0x00ffcc, 0.15);
        [25, 50, 75].forEach(q => {
            radarGfx.beginPath();
            radarGfx.moveTo(mapOffsetX + q * tileSize, mapOffsetY);
            radarGfx.lineTo(mapOffsetX + q * tileSize, mapOffsetY + 400);
            radarGfx.moveTo(mapOffsetX, mapOffsetY + q * tileSize);
            radarGfx.lineTo(mapOffsetX + 400, mapOffsetY + q * tileSize);
            radarGfx.stroke();
        });

        // Glowing Outer Bezel Frame
        radarGfx.lineStyle(2, 0x00ffcc, 0.85);
        radarGfx.strokeRect(mapOffsetX - 1, mapOffsetY - 1, 402, 402);
        
        // Cybernetic Corner Brackets
        radarGfx.lineStyle(3, 0xff00ff, 0.9);
        const bracketLen = 12;
        // Top-Left
        radarGfx.beginPath();
        radarGfx.moveTo(mapOffsetX - 4, mapOffsetY + bracketLen);
        radarGfx.lineTo(mapOffsetX - 4, mapOffsetY - 4);
        radarGfx.lineTo(mapOffsetX + bracketLen, mapOffsetY - 4);
        // Top-Right
        radarGfx.moveTo(mapOffsetX + 404 - bracketLen, mapOffsetY - 4);
        radarGfx.lineTo(mapOffsetX + 404, mapOffsetY - 4);
        radarGfx.lineTo(mapOffsetX + 404, mapOffsetY + bracketLen);
        // Bottom-Left
        radarGfx.moveTo(mapOffsetX - 4, mapOffsetY + 404 - bracketLen);
        radarGfx.lineTo(mapOffsetX - 4, mapOffsetY + 404);
        radarGfx.lineTo(mapOffsetX + bracketLen, mapOffsetY + 404);
        // Bottom-Right
        radarGfx.moveTo(mapOffsetX + 404 - bracketLen, mapOffsetY + 404);
        radarGfx.lineTo(mapOffsetX + 404, mapOffsetY + 404);
        radarGfx.lineTo(mapOffsetX + 404, mapOffsetY + 404 - bracketLen);
        radarGfx.stroke();

        this.detailPanel.add(radarGfx);

        // 2. Draw Landmark Markers on Map
        const landmarks = [
            { name: 'Crater Drop Pod', x: 45, y: 45, color: 0x38bdf8 },
            { name: 'Oakhaven Village', x: 60, y: 48, color: 0x4ade80 },
            { name: 'Catacombs Crypt', x: 55, y: 20, color: 0xa855f7 },
            { name: 'Port Aetheria', x: 65, y: 82, color: 0x6366f1 },
            { name: 'Ironspire Bastion', x: 88, y: 35, color: 0xfbbf24 },
            { name: 'Obsidian Castle', x: 50, y: 88, color: 0xf43f5e }
        ];

        landmarks.forEach(lm => {
            const lx = mapOffsetX + lm.x * tileSize + 2;
            const ly = mapOffsetY + lm.y * tileSize + 2;

            const markerGfx = this.add.graphics();
            markerGfx.lineStyle(1.5, lm.color, 0.9);
            markerGfx.strokeCircle(lx, ly, 6);
            markerGfx.fillStyle(lm.color, 0.8);
            markerGfx.fillCircle(lx, ly, 2);
            this.detailPanel.add(markerGfx);
        });

        // 3. Draw Live Player Beacon (★ YOU)
        const bx = mapOffsetX + pGridX * tileSize + 2;
        const by = mapOffsetY + pGridY * tileSize + 2;

        const playerBeaconGfx = this.add.graphics();
        playerBeaconGfx.lineStyle(2, 0xff0055, 1);
        playerBeaconGfx.strokeCircle(bx, by, 8);
        playerBeaconGfx.fillStyle(0xffffff, 1);
        playerBeaconGfx.fillCircle(bx, by, 3);
        this.detailPanel.add(playerBeaconGfx);

        const playerTag = this.add.text(bx + 10, by - 8, '★ YOU', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '11px',
            color: '#ffffff',
            backgroundColor: '#ff0055ee',
            padding: { x: 4, y: 2 },
            fontStyle: 'bold'
        });
        playerTag.setDepth(10);
        this.detailPanel.add(playerTag);

        // Pulse tween for player beacon
        this.tweens.add({
            targets: playerBeaconGfx,
            alpha: 0.3,
            scaleX: 1.4,
            scaleY: 1.4,
            x: bx * (1 - 1.4),
            y: by * (1 - 1.4),
            yoyo: true,
            repeat: -1,
            duration: 600
        });

        // 4. Right Side Telemetry & Landmark Panel (X: 420 to 690)
        const panelX = 420;

        // Telemetry Card
        const telemetryBox = this.add.graphics();
        telemetryBox.fillStyle(0x0f172a, 0.85);
        telemetryBox.fillRoundedRect(panelX, mapOffsetY, 270, 130, 8);
        telemetryBox.lineStyle(1.5, 0x38bdf8, 0.7);
        telemetryBox.strokeRoundedRect(panelX, mapOffsetY, 270, 130, 8);
        this.detailPanel.add(telemetryBox);

        // Determine Region Name
        let regionName = 'Aetheria Frontier';
        if (pGridX >= 38 && pGridX <= 54 && pGridY >= 38 && pGridY <= 54) {
            regionName = 'Crater Basin (Landing Site)';
        } else if (pGridX >= 54 && pGridX <= 72 && pGridY >= 40 && pGridY <= 62) {
            regionName = 'Verdant Valley & Oakhaven';
        } else if (pGridX >= 45 && pGridX <= 68 && pGridY >= 10 && pGridY <= 38) {
            regionName = 'Catacombs Ridge & North';
        } else if (pGridX >= 72 && pGridX <= 99 && pGridY >= 20 && pGridY <= 65) {
            regionName = 'Eastern Steppes & Ironspire';
        } else if (pGridX >= 30 && pGridX <= 90 && pGridY >= 68 && pGridY <= 99) {
            regionName = 'Southern Sandbars & Aetheria';
        }

        const state = GameManager.instance.getState();
        let extinctCount = 0;
        const totalSpecies = ALL_MONSTER_SPECIES.length;
        for (const speciesId in state.soulCrystals) {
            if (state.soulCrystals[speciesId].isExtinct) {
                extinctCount++;
            }
        }
        const extinctPercent = Math.round((extinctCount / totalSpecies) * 100);

        const telemetryText = this.add.text(panelX + 12, mapOffsetY + 10, 
            `📡 TELEMETRY SENSORS\n` +
            `Sector : [X: ${pGridX}, Y: ${pGridY}]\n` +
            `Region : ${regionName}\n` +
            `Map    : ${currentMapId === 'world_map' ? 'Toroidal Overworld' : currentMapId.toUpperCase()}\n` +
            `Anchor : Crater Basin (45, 46)\n` +
            `Hunt   : ${extinctCount}/${totalSpecies} Extinct (${extinctPercent}%)`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '12.5px',
            color: '#e2e8f0',
            lineSpacing: 4
        });
        this.detailPanel.add(telemetryText);

        // Landmarks Card
        const landmarksBox = this.add.graphics();
        landmarksBox.fillStyle(0x0f172a, 0.85);
        landmarksBox.fillRoundedRect(panelX, mapOffsetY + 140, 270, 132, 8);
        landmarksBox.lineStyle(1.5, 0x00ffcc, 0.6);
        landmarksBox.strokeRoundedRect(panelX, mapOffsetY + 140, 270, 132, 8);
        this.detailPanel.add(landmarksBox);

        const landmarksTitle = this.add.text(panelX + 12, mapOffsetY + 148, '📍 CONTINENTAL LANDMARKS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(landmarksTitle);

        const landmarksList = this.add.text(panelX + 12, mapOffsetY + 172,
            `🚀 (45, 45) Crater Drop Pod (Spawn)\n` +
            `🏡 (60, 48) Oakhaven Valley Hub\n` +
            `⛰️ (55, 20) Ancient Catacombs\n` +
            `🔮 (65, 82) Port Aetheria Spire\n` +
            `⚒️ (88, 35) Ironspire Bastion\n` +
            `🏰 (50, 88) Obsidian Castle Keep`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '11px',
            color: '#cbd5e1',
            lineSpacing: 4
        });
        this.detailPanel.add(landmarksList);

        // Radar Biome Legend Card
        const legendBox = this.add.graphics();
        legendBox.fillStyle(0x0f172a, 0.85);
        legendBox.fillRoundedRect(panelX, mapOffsetY + 280, 270, 120, 8);
        legendBox.lineStyle(1.5, 0xa855f7, 0.6);
        legendBox.strokeRoundedRect(panelX, mapOffsetY + 280, 270, 120, 8);
        this.detailPanel.add(legendBox);

        const legendTitle = this.add.text(panelX + 12, mapOffsetY + 288, '🗺️ RADAR BIOME LEGEND', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#a855f7',
            fontStyle: 'bold'
        });
        this.detailPanel.add(legendTitle);

        const legendText = this.add.text(panelX + 12, mapOffsetY + 310,
            `🟩 Plains / Forest / Meadows\n` +
            `⬜ Paved Causeways & Roads\n` +
            `⬛ Basalt Floor / Magma Rims\n` +
            `🟦 Oceans, Rivers & Bridges\n` +
            `🟨 Sandbars & Coastal Shallows`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '11px',
            color: '#94a3b8',
            lineSpacing: 3
        });
        this.detailPanel.add(legendText);

        // Bottom Invariant Tip Banner
        const tipBox = this.add.graphics();
        tipBox.fillStyle(0x1a1a3a, 0.7);
        tipBox.fillRoundedRect(0, 466, 690, 44, 6);
        tipBox.lineStyle(1, 0x24244c, 0.9);
        tipBox.strokeRoundedRect(0, 466, 690, 44, 6);
        this.detailPanel.add(tipBox);

        const tipText = this.add.text(10, 472, 
            '🌐 Toroidal Topology: Traveling across any world border wraps seamlessly to opposite edge.\n' +
            '🚀 Crater Basin features open causeways in all 4 cardinal directions connecting all continents.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '11px',
            color: '#00ffcc'
        });
        this.detailPanel.add(tipText);
    }

    private closeMenu() {
        LicenseManager.instance.resumeTimer();
        SoundSynth.playMenuCancel();
        this.scene.stop('MenuScene');
        this.scene.resume('OverworldScene');
    }
}
