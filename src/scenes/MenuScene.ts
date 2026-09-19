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

        // Main Menu container (Full-screen viewport edge-to-edge)
        this.container = this.add.container(width / 2, height / 2);
        this.container.setDepth(200);

        // Full Screen Dimensions
        const cardWidth = width;
        const cardHeight = height;
        
        this.backgroundGraphics = this.add.graphics();
        
        // Solid high-contrast deep cyber-navy backdrop
        this.backgroundGraphics.fillStyle(0x070b16, 0.97);
        this.backgroundGraphics.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
        
        // Outer edge border
        this.backgroundGraphics.lineStyle(3, 0x00ffcc, 0.9);
        this.backgroundGraphics.strokeRect(-cardWidth / 2 + 1, -cardHeight / 2 + 1, cardWidth - 2, cardHeight - 2);
        
        // Inner divider between sidebar and detail panel
        const dividerX = -cardWidth / 2 + 340;
        this.backgroundGraphics.lineStyle(2, 0x1e293b, 1);
        this.backgroundGraphics.beginPath();
        this.backgroundGraphics.moveTo(dividerX, -cardHeight / 2 + 16);
        this.backgroundGraphics.lineTo(dividerX, cardHeight / 2 - 40);
        this.backgroundGraphics.stroke();

        this.container.add(this.backgroundGraphics);

        // Menu Header Title
        const headerTitle = this.add.text(-cardWidth / 2 + 32, -cardHeight / 2 + 24, 'SYSTEM INTEGRATION', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.container.add(headerTitle);

        // Top-Right Close [X] Button (Prominent for touch/mouse)
        const closeBtnBg = this.add.graphics();
        const closeBtnX = cardWidth / 2 - 170;
        const closeBtnY = -cardHeight / 2 + 18;
        closeBtnBg.fillStyle(0xff0055, 0.25);
        closeBtnBg.fillRoundedRect(closeBtnX, closeBtnY, 140, 42, 8);
        closeBtnBg.lineStyle(2, 0xff0055, 0.9);
        closeBtnBg.strokeRoundedRect(closeBtnX, closeBtnY, 140, 42, 8);
        this.container.add(closeBtnBg);

        const closeBtnTxt = this.add.text(closeBtnX + 70, closeBtnY + 21, '✕ CLOSE', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#ff3366',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        this.container.add(closeBtnTxt);

        const closeZone = this.add.zone(closeBtnX + 70, closeBtnY + 21, 150, 48);
        closeZone.setInteractive({ useHandCursor: true });
        closeZone.on('pointerdown', () => {
            this.closeMenu();
        });
        closeZone.on('pointerover', () => {
            closeBtnTxt.setColor('#ffffff');
            closeBtnBg.clear();
            closeBtnBg.fillStyle(0xff0055, 0.65);
            closeBtnBg.fillRoundedRect(closeBtnX, closeBtnY, 140, 42, 8);
            closeBtnBg.lineStyle(2, 0xff5588, 1);
            closeBtnBg.strokeRoundedRect(closeBtnX, closeBtnY, 140, 42, 8);
        });
        closeZone.on('pointerout', () => {
            closeBtnTxt.setColor('#ff3366');
            closeBtnBg.clear();
            closeBtnBg.fillStyle(0xff0055, 0.25);
            closeBtnBg.fillRoundedRect(closeBtnX, closeBtnY, 140, 42, 8);
            closeBtnBg.lineStyle(2, 0xff0055, 0.9);
            closeBtnBg.strokeRoundedRect(closeBtnX, closeBtnY, 140, 42, 8);
        });
        this.container.add(closeZone);

        // Initialize sidebar selections (12 Options spanning full height)
        const sidebarStartY = -cardHeight / 2 + 84;
        const sidebarPitch = 68;

        this.sidebarOptions.forEach((option, index) => {
            const itemCenterY = sidebarStartY + index * sidebarPitch + 16;

            // Full width hit zone for reliable mobile tap response
            const hitZone = this.add.zone(-cardWidth / 2 + 165, itemCenterY, 310, 58);
            hitZone.setInteractive({ useHandCursor: true });
            
            const txt = this.add.text(-cardWidth / 2 + 32, sidebarStartY + index * sidebarPitch + 4, option.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '19px',
                color: '#ffffff',
                fontStyle: 'bold'
            });

            const onSelect = () => {
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
            };

            hitZone.on('pointerdown', onSelect);
            txt.setInteractive({ useHandCursor: true });
            txt.on('pointerdown', onSelect);

            this.container.add(hitZone);
            this.container.add(txt);
            this.sidebarTexts.push(txt);
        });

        // Initialize detail panel container (Spacious 930x860 layout)
        this.detailPanel = this.add.container(-cardWidth / 2 + 370, -cardHeight / 2 + 80);
        this.container.add(this.detailPanel);

        // Initial UI Render
        this.updateSidebarUI();
        this.refreshDetails();

        // Footer Help & Tap-to-Close
        const helpText = this.add.text(0, cardHeight / 2 - 22, 'ARROWS / TOUCH: Navigate | ENTER / TAP: Action | [ ✕ TAP TO CLOSE / ESC ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#8899b3',
            fontStyle: 'bold'
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
        const heroAvatar = this.add.image(840, 24, 'player');
        heroAvatar.setScale(1.8);
        this.detailPanel.add(heroAvatar);

        // 3 Glassmorphic Overview Cards at top (Spacious 270px width each)
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
            const cardX = idx * 275;
            const cardY = 48;

            const bg = this.add.graphics();
            bg.fillStyle(0x0f172a, 0.9);
            bg.fillRoundedRect(cardX, cardY, 260, 85, 8);
            bg.lineStyle(1.5, c.borderColor, 0.8);
            bg.strokeRoundedRect(cardX, cardY, 260, 85, 8);
            this.detailPanel.add(bg);

            const title = this.add.text(cardX + 14, cardY + 10, c.title, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#8899b3',
                fontStyle: 'bold'
            });
            this.detailPanel.add(title);

            const val = this.add.text(cardX + 14, cardY + 30, c.val, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '24px',
                color: c.color,
                fontStyle: 'bold'
            });
            this.detailPanel.add(val);

            const sub = this.add.text(cardX + 14, cardY + 60, c.sub, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: '#ffffff'
            });
            this.detailPanel.add(sub);
        });

        // Section Title: Combat Attributes
        const attrHeader = this.add.text(0, 150, 'COMBAT ATTRIBUTES & RATINGS (BASE vs. AFTER)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
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

        const rowHeight = 44;
        const startY = 185;

        // Render Column 1 (Width 440px)
        col1Stats.forEach((stat, i) => {
            const y = startY + i * rowHeight;
            const bg = this.add.graphics();
            bg.fillStyle(i % 2 === 0 ? 0x141a36 : 0x0f142b, 0.7);
            bg.fillRoundedRect(0, y - 2, 440, 38, 6);
            this.detailPanel.add(bg);

            const name = this.add.text(12, y + 6, stat.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '17px',
                color: '#ffffff'
            });
            this.detailPanel.add(name);

            const val = this.add.text(160, y + 6, stat.val, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: '#00ffcc',
                fontStyle: 'bold'
            });
            this.detailPanel.add(val);

            const baseTxt = this.add.text(310, y + 7, stat.base, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#8899b3'
            });
            this.detailPanel.add(baseTxt);
        });

        // Render Column 2 (Width 440px at X: 465)
        col2Stats.forEach((stat, i) => {
            const y = startY + i * rowHeight;
            const bg = this.add.graphics();
            bg.fillStyle(i % 2 === 0 ? 0x141a36 : 0x0f142b, 0.7);
            bg.fillRoundedRect(465, y - 2, 440, 38, 6);
            this.detailPanel.add(bg);

            const name = this.add.text(477, y + 6, stat.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '17px',
                color: '#ffffff'
            });
            this.detailPanel.add(name);

            const val = this.add.text(625, y + 6, stat.val, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: '#ffcc00',
                fontStyle: 'bold'
            });
            this.detailPanel.add(val);

            const baseTxt = this.add.text(775, y + 7, stat.base, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#8899b3'
            });
            this.detailPanel.add(baseTxt);
        });

        // Luck Tier & Bonus Banner (Width 905px)
        const luckTier = Math.floor(calculated.luck / 100);
        const luckBonus = luckTier * 0.5;
        const luckBanner = this.add.graphics();
        luckBanner.fillStyle(0x1f1b0a, 0.9);
        luckBanner.fillRoundedRect(0, startY + 7 * rowHeight + 10, 905, 42, 6);
        luckBanner.lineStyle(1.5, 0xffcc00, 0.85);
        luckBanner.strokeRoundedRect(0, startY + 7 * rowHeight + 10, 905, 42, 6);
        this.detailPanel.add(luckBanner);

        const luckBannerTxt = this.add.text(14, startY + 7 * rowHeight + 20,
            `✦ LUCK SCALING: Tier ${luckTier} (${calculated.luck} Luck) ➔ +${luckBonus.toFixed(1)} to all attributes & ratings!`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ffcc00',
            fontStyle: 'bold',
            wordWrap: { width: 880 }
        });
        this.detailPanel.add(luckBannerTxt);

        // Clean bottom navigation helper
        const tipBox = this.add.graphics();
        tipBox.fillStyle(0x101b2f, 0.8);
        tipBox.fillRoundedRect(0, startY + 7 * rowHeight + 62, 905, 44, 6);
        tipBox.lineStyle(1, 0x00ffcc, 0.6);
        tipBox.strokeRoundedRect(0, startY + 7 * rowHeight + 62, 905, 44, 6);
        this.detailPanel.add(tipBox);

        const tipText = this.add.text(14, startY + 7 * rowHeight + 74, '💡 Infuse Soul Crystals into equipment slots to enhance attributes & unlock active skills.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#00ffcc',
            wordWrap: { width: 880 }
        });
        this.detailPanel.add(tipText);
    }

    private renderInfusedPowersView() {
        // Header
        const header = this.add.text(0, 0, 'INFUSED POWERS & COMBAT PASSIVES', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.detailPanel.add(header);

        const subtext = this.add.text(0, 36, 'Active spells, passives, and pet conduit granted by equipped Soul Crystals.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#cbd5e1'
        });
        this.detailPanel.add(subtext);

        const state = GameManager.instance.getState();
        const passives = GameManager.instance.getActivePassives();
        const spells = GameManager.instance.getActiveSpells();

        // 1. Left Section: PASSIVE MODIFIERS (Sword, Shield, Armor, Helmet)
        const passiveHeader = this.add.text(0, 72, '🛡️ COMBAT PASSIVES (GEAR)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.detailPanel.add(passiveHeader);

        const passiveSlots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'helmet'];
        passiveSlots.forEach((slot, idx) => {
            const cardY = 100 + idx * 86;
            const bg = this.add.graphics();
            bg.fillStyle(0x0f172a, 0.92);
            bg.fillRoundedRect(0, cardY, 440, 76, 8);
            bg.lineStyle(1.5, 0x334155, 1);
            bg.strokeRoundedRect(0, cardY, 440, 76, 8);
            this.detailPanel.add(bg);

            const crystalId = state.equippedCrystals[slot];
            const slotName = this.add.text(14, cardY + 10, `[${slot.toUpperCase()}]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '17px',
                color: '#ffd700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            this.detailPanel.add(slotName);

            let title = 'EMPTY SOCKET';
            let desc = 'No passive effect active.';
            let titleColor = '#94a3b8';

            if (crystalId) {
                const config = SoulCrystalDatabase[crystalId];
                if (config) {
                    title = config.name;
                    titleColor = '#00ffcc';
                    const effect = GameManager.instance.getScaledSlotEffect(crystalId, slot);
                    desc = `⚡ ${effect.description}`;
                }
            }

            const titleText = this.add.text(120, cardY + 10, title, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '17px',
                color: titleColor,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            this.detailPanel.add(titleText);

            const descText = this.add.text(14, cardY + 38, desc, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2,
                wordWrap: { width: 415 }
            });
            this.detailPanel.add(descText);
        });

        // 2. Right Section: ACTIVE SPELLS & PET CONDUIT (Ring 1, Ring 2, Amulet, Earrings)
        const spellHeader = this.add.text(465, 72, '✨ SPELLS & PET CONDUIT', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#f472b6',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.detailPanel.add(spellHeader);

        const spellSlots: EquipmentSlot[] = ['ring1', 'ring2', 'amulet'];
        spellSlots.forEach((slot, idx) => {
            const cardY = 100 + idx * 86;
            const bg = this.add.graphics();
            bg.fillStyle(0x0f172a, 0.92);
            bg.fillRoundedRect(465, cardY, 440, 76, 8);
            bg.lineStyle(1.5, 0x334155, 1);
            bg.strokeRoundedRect(465, cardY, 440, 76, 8);
            this.detailPanel.add(bg);

            const crystalId = state.equippedCrystals[slot];
            const slotName = this.add.text(479, cardY + 10, `[${slot.toUpperCase()}]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '17px',
                color: '#ffd700',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            this.detailPanel.add(slotName);

            let title = 'EMPTY SOCKET';
            let desc = 'No active spell unlocked.';
            let titleColor = '#94a3b8';

            if (crystalId) {
                const config = SoulCrystalDatabase[crystalId];
                if (config) {
                    title = config.name;
                    titleColor = '#38bdf8';
                    const effect = GameManager.instance.getScaledSlotEffect(crystalId, slot);
                    desc = `✨ ${effect.description}`;
                }
            }

            const titleText = this.add.text(585, cardY + 10, title, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '17px',
                color: titleColor,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            this.detailPanel.add(titleText);

            const descText = this.add.text(479, cardY + 38, desc, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2,
                wordWrap: { width: 415 }
            });
            this.detailPanel.add(descText);
        });

        // 4th Card in Right Section: EARRINGS (Pet Companion Conduit)
        const earringY = 100 + 3 * 86;
        const earringBg = this.add.graphics();
        earringBg.fillStyle(0x0f172a, 0.92);
        earringBg.fillRoundedRect(465, earringY, 440, 76, 8);
        earringBg.lineStyle(1.5, 0x334155, 1);
        earringBg.strokeRoundedRect(465, earringY, 440, 76, 8);
        this.detailPanel.add(earringBg);

        const hasEarrings = GameManager.instance.hasEarringsUnlocked();
        const earringCrystalId = state.equippedCrystals.earrings;

        const earringSlotName = this.add.text(479, earringY + 10, '[EARRINGS]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: hasEarrings ? '#ffd700' : '#64748b',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.detailPanel.add(earringSlotName);

        let earringTitle = 'LOCKED RELIC';
        let earringDesc = 'Lost in crater. Defeat boss to awaken pet companion.';
        let earringColor = '#64748b';

        if (hasEarrings) {
            if (earringCrystalId) {
                const config = SoulCrystalDatabase[earringCrystalId];
                if (config) {
                    earringTitle = `PET: ${config.name.toUpperCase()}`;
                    earringColor = '#ffd700';
                    const pet = state.petCompanion;
                    if (pet?.augmentation) {
                        earringDesc = `🐾 Augmented: ${pet.augmentation.name} (+${pet.augmentation.bonusSkill})`;
                    } else {
                        earringDesc = '🐾 Follows in overworld & fights autonomously in combat.';
                    }
                }
            } else {
                earringTitle = 'EMPTY CONDUIT';
                earringDesc = 'Socket monster essence to awaken pet companion.';
                earringColor = '#94a3b8';
            }
        }

        const earringTitleText = this.add.text(585, earringY + 10, earringTitle, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: earringColor,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.detailPanel.add(earringTitleText);

        const earringDescText = this.add.text(479, earringY + 38, earringDesc, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
            wordWrap: { width: 415 }
        });
        this.detailPanel.add(earringDescText);

        // 3. Combined Battle Telemetry Status Box at Bottom (Width 905px)
        const summaryBox = this.add.graphics();
        summaryBox.fillStyle(0x0f172a, 0.95);
        summaryBox.fillRoundedRect(0, 460, 905, 155, 8);
        summaryBox.lineStyle(2, 0x00ffcc, 0.9);
        summaryBox.strokeRoundedRect(0, 460, 905, 155, 8);
        this.detailPanel.add(summaryBox);

        const summaryTitle = this.add.text(18, 472, 'COMBINED BATTLE TELEMETRY MODIFIERS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.detailPanel.add(summaryTitle);

        const petSummary = state.petCompanion 
            ? `${state.petCompanion.name}${state.petCompanion.augmentation ? ` [${state.petCompanion.augmentation.bonusSkill}]` : ''}` 
            : (hasEarrings ? 'No Pet Summoned' : 'Conduit Lost');

        const passiveLines = [
            `• Lifesteal: +${passives.lifestealPercent}%   • Critical Strike: +${passives.critChance}%`,
            `• HP Regen: +${passives.hpRegen}/Turn     • SP Regen: +${passives.spRegen}/Turn`,
            `• Evasion: +${passives.evasionPercent}%     • Counter Rate: +${passives.counterPercent}%`,
            `• Spells: ${spells.length} Active     • Pet Conduit: ${petSummary}`
        ];

        passiveLines.forEach((line, idx) => {
            const lineTxt = this.add.text(18, 502 + idx * 25, line, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#f8fafc',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2,
                wordWrap: { width: 870 }
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
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.detailPanel.add(header);

        const subtext = this.add.text(0, 36, 'Socket captured monster essences into your 8 equipment slots.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#cbd5e1'
        });
        this.detailPanel.add(subtext);

        const state = GameManager.instance.getState();
        const slots: EquipmentSlot[] = ALL_EQUIPMENT_SLOTS;

        slots.forEach((slot, index) => {
            const slotY = 74 + index * 92;
            const isFocused = index === this.activeEquipSlotIdx;
            const isDualUnlocked = GameManager.instance.isDualSocketUnlocked(slot);
            const isEarrings = slot === 'earrings';
            const isUnlocked = !isEarrings || GameManager.instance.hasEarringsUnlocked();

            // Glassmorphic Row Card Background (Width 910px, Height 82px)
            const rowCard = this.add.graphics();
            if (isFocused) {
                rowCard.fillStyle(0x1a223f, 0.95);
                rowCard.fillRoundedRect(-10, slotY - 4, 910, 82, 8);
                rowCard.lineStyle(2, 0x00ffcc, 1);
                rowCard.strokeRoundedRect(-10, slotY - 4, 910, 82, 8);
                rowCard.lineStyle(1, 0xff00ff, 0.4);
                rowCard.strokeRoundedRect(-8, slotY - 2, 906, 78, 6);
            } else {
                rowCard.fillStyle(0x0d1326, 0.8);
                rowCard.fillRoundedRect(-10, slotY - 4, 910, 82, 8);
                rowCard.lineStyle(1.5, 0x242e4c, 0.9);
                rowCard.strokeRoundedRect(-10, slotY - 4, 910, 82, 8);
            }
            this.detailPanel.add(rowCard);

            // Interactive Row Click / Touch Hit Zone for Equipment Infusion
            const rowZone = this.add.zone(445, slotY + 37, 910, 82);
            rowZone.setInteractive({ useHandCursor: true });
            rowZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                if (!isUnlocked) {
                    SoundSynth.playMenuCancel();
                    return;
                }
                // Calculate local X within detailPanel to detect click on S1 vs S2
                const localX = pointer.x - this.detailPanel.x - this.container.x;
                if (isDualUnlocked && localX >= 450) {
                    this.activeEquipSlotIdx = index;
                    this.activeSocketIndex = 1;
                } else {
                    this.activeEquipSlotIdx = index;
                    this.activeSocketIndex = 0;
                }
                this.executeSelection();
            });
            rowZone.on('pointerover', () => {
                if (this.activeEquipSlotIdx !== index) {
                    this.activeEquipSlotIdx = index;
                    this.activeSocketIndex = 0;
                    this.refreshDetails();
                }
            });
            this.detailPanel.add(rowZone);

            // Slot Name & Focus Indicator
            const focusArrow = isFocused ? '▶ ' : '  ';
            const slotLabel = isEarrings ? (isUnlocked ? 'EARRINGS' : 'LOCKED') : slot.toUpperCase();
            const slotColor = isUnlocked ? (isFocused ? '#ffd700' : '#00ffcc') : '#64748b';
            const slotName = this.add.text(0, slotY + 4, `${focusArrow}[${slotLabel}]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: slotColor,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            this.detailPanel.add(slotName);

            // Melodie's Artwork Icon across all 8 equipment slots
            if (isUnlocked) {
                const variantId = this.selectedArtworkVariants[slot];
                const variant = CharacterLayerCompositor.getArtworkVariant(slot, variantId);
                const iconKey = this.textures.exists(variant.assetKey) ? variant.assetKey : this.getDefaultSlotIconKey(slot);
                const slotIcon = this.add.image(140, slotY + 22, iconKey);
                slotIcon.setScale(0.52);
                slotIcon.setDepth(2);
                slotIcon.setInteractive({ useHandCursor: true });
                slotIcon.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                    pointer.event?.stopPropagation?.();
                    this.openArtworkInspectModal(slot);
                });
                slotIcon.on('pointerover', () => {
                    slotIcon.setScale(0.58);
                });
                slotIcon.on('pointerout', () => {
                    slotIcon.setScale(0.52);
                });
                this.detailPanel.add(slotIcon);
            }

            if (!isUnlocked) {
                const lockedBadge = this.add.text(175, slotY + 4, '🔒 [CRATER BOSS CONDUIT]', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '18px',
                    color: '#ff3366',
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3
                });
                this.detailPanel.add(lockedBadge);

                const lockedDesc = this.add.text(175, slotY + 38, 'Defeat Astral Scavenger at crater rim to recover conduit & summon pet.', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '16px',
                    color: '#cbd5e1',
                    wordWrap: { width: 710 }
                });
                this.detailPanel.add(lockedDesc);
                return;
            }

            // Primary socket crystal (S1)
            const crystalId = state.equippedCrystals[slot];
            let s1Label = '[S1: EMPTY]';
            let s1Color = '#94a3b8';

            if (crystalId) {
                const config = SoulCrystalDatabase[crystalId];
                if (config) {
                    if (isEarrings) {
                        s1Label = `[🐾 PET: ${config.name.toUpperCase()}]`;
                    } else {
                        s1Label = `[S1: ${config.name}]`;
                    }
                    s1Color = isFocused && this.activeSocketIndex === 0 ? '#00ffcc' : '#38bdf8';
                }
            } else if (isFocused && this.activeSocketIndex === 0) {
                s1Label = '[S1: SELECT]';
                s1Color = '#00ffcc';
            }

            const s1Text = this.add.text(175, slotY + 4, s1Label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: s1Color,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            this.detailPanel.add(s1Text);

            // Secondary socket crystal (S2 Soulmeld or Pet Catalyst)
            const secCrystalId = GameManager.instance.getSecondaryEquippedCrystal(slot);
            if (isDualUnlocked) {
                let s2Label = isEarrings ? '[+ CATALYST: NONE]' : '[S2: EMPTY]';
                let s2Color = '#94a3b8';

                if (secCrystalId) {
                    const secConfig = SoulCrystalDatabase[secCrystalId];
                    if (isEarrings) {
                        const aug = GameManager.instance.getPetAugmentation(crystalId || 'goblin', secCrystalId);
                        s2Label = `[+ 🔮 ${aug.name}]`;
                        s2Color = isFocused && this.activeSocketIndex === 1 ? '#ffd700' : '#fde047';
                    } else {
                        s2Label = `[S2: 💠 ${secConfig?.name || secCrystalId}]`;
                        s2Color = isFocused && this.activeSocketIndex === 1 ? '#ffd700' : '#fde047';
                    }
                } else if (isFocused && this.activeSocketIndex === 1) {
                    s2Label = isEarrings ? '[+ CATALYST: SELECT]' : '[S2: SELECT]';
                    s2Color = '#ffd700';
                }

                const s2Text = this.add.text(480, slotY + 4, s2Label, {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '18px',
                    color: s2Color,
                    fontStyle: 'bold',
                    stroke: '#000000',
                    strokeThickness: 3
                });
                this.detailPanel.add(s2Text);
            }

            // Effect description (Line 2 spanning wide)
            let effectDesc = '';
            let effectColor = '#ffffff';
            if (isEarrings) {
                if (crystalId) {
                    const pet = state.petCompanion;
                    if (pet?.augmentation) {
                        effectDesc = `🐾 Companion: ${pet.name} [Augmented: +${pet.augmentation.bonusSkill}]`;
                        effectColor = '#ffd700';
                    } else {
                        effectDesc = `🐾 Companion: ${pet?.name || 'Ally'} (Autonomous combat fighter & follower)`;
                        effectColor = '#38bdf8';
                    }
                } else {
                    effectDesc = 'Socket monster essence to awaken and summon pet companion.';
                    effectColor = '#cbd5e1';
                }
            } else {
                if (crystalId) {
                    const effect = GameManager.instance.getScaledSlotEffect(crystalId, slot);
                    effectDesc = `⚡ ${effect.description}`;
                    if (secCrystalId) {
                        const secEffect = GameManager.instance.getScaledSlotEffect(secCrystalId, slot);
                        effectDesc += ` | 💠 Dual: ${secEffect.description}`;
                    }
                    effectColor = '#f8fafc';
                } else {
                    effectDesc = 'No passive effect active. Tap to socket essence crystal.';
                    effectColor = '#94a3b8';
                }
            }

            const effectText = this.add.text(175, slotY + 38, effectDesc, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: effectColor,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2,
                wordWrap: { width: 710 }
            });
            this.detailPanel.add(effectText);
        });

        // Instructions Footer
        const actionHelp = this.add.text(0, 820, 'TAP ROW: Socket Crystal | [I]/TAP ICON: Inspect Art | ◀/▶: Switch S1/S2 | ESC: Back', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#00ffcc',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
            wordWrap: { width: 910 }
        });
        this.detailPanel.add(actionHelp);
    }

    private renderCrystalSelectionView() {
        const slotKey = this.getEquipSlotKeyFromIndex(this.activeEquipSlotIdx);
        const isSecondary = this.activeSocketIndex === 1 && GameManager.instance.isDualSocketUnlocked(slotKey);
        const socketTitle = isSecondary 
            ? (slotKey === 'earrings' ? 'PET CATALYST AUGMENTATION' : 'SECONDARY SOULMELD (S2)') 
            : (slotKey === 'earrings' ? 'PET COMPANION CONDUIT' : 'PRIMARY ESSENCE (S1)');

        const header = this.add.text(0, 0, `SELECT ${socketTitle}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: isSecondary ? '#ffd700' : '#00ffcc',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.detailPanel.add(header);

        const subDesc = slotKey === 'earrings'
            ? (isSecondary 
                ? 'Select a secondary monster catalyst to augment your pet companion with synergy & auras.'
                : 'Select monster essence to summon your loyal overworld follower & autonomous combat ally.')
            : (isSecondary
                ? `Choose a secondary soul crystal to meld into ${slotKey.toUpperCase()} (Boss Soulmeld).`
                : `Choose an essence to socket into ${slotKey.toUpperCase()}. Power scales with fragment count.`);

        const subtext = this.add.text(0, 36, subDesc, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#cbd5e1',
            wordWrap: { width: 900 }
        });
        this.detailPanel.add(subtext);

        if (this.availableCrystalsForSocketing.length === 1 && this.availableCrystalsForSocketing[0] === 'none') {
            const emptyNotice = this.add.text(0, 160, 'You have not captured any monster souls yet.\nDefeat monsters in the wild to collect soul crystals.', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '22px',
                color: '#ff3366',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            });
            this.detailPanel.add(emptyNotice);
            return;
        }

        // List available crystals (Up to 8 items, 910px wide)
        this.availableCrystalsForSocketing.forEach((crystalId, index) => {
            const itemY = 80 + index * 80;
            const isFocused = index === this.activeCrystalSelectIdx;

            // Card background
            const cardBg = this.add.graphics();
            if (isFocused) {
                cardBg.fillStyle(0x1e293b, 0.95);
                cardBg.fillRoundedRect(-10, itemY - 4, 910, 70, 8);
                cardBg.lineStyle(2, isSecondary ? 0xffd700 : 0x00ffcc, 1);
                cardBg.strokeRoundedRect(-10, itemY - 4, 910, 70, 8);
            } else {
                cardBg.fillStyle(crystalId === 'none' ? 0x221118 : 0x0f172a, 0.85);
                cardBg.fillRoundedRect(-10, itemY - 4, 910, 70, 8);
                cardBg.lineStyle(1.5, crystalId === 'none' ? 0x662233 : 0x334155, 0.9);
                cardBg.strokeRoundedRect(-10, itemY - 4, 910, 70, 8);
            }
            this.detailPanel.add(cardBg);

            // Interactive Row Click / Touch Hit Zone for Crystal Selection
            const crystalZone = this.add.zone(445, itemY + 31, 910, 70);
            crystalZone.setInteractive({ useHandCursor: true });
            crystalZone.on('pointerdown', () => {
                this.activeCrystalSelectIdx = index;
                this.executeSelection();
            });
            crystalZone.on('pointerover', () => {
                if (this.activeCrystalSelectIdx !== index) {
                    this.activeCrystalSelectIdx = index;
                    this.refreshDetails();
                }
            });
            this.detailPanel.add(crystalZone);

            // Crystal Item Title & Details
            let label = isSecondary ? '✕ REMOVE CATALYST' : '✕ UNSOCKET CRYSTAL';
            let detail = isSecondary ? 'Removes secondary soulmeld from slot' : 'Restores slot to base state';
            let labelColor = '#ff4d6d';
            let detailColor = '#fca5a5';

            if (crystalId !== 'none') {
                const config = SoulCrystalDatabase[crystalId];
                const crystalState = GameManager.instance.getState().soulCrystals[crystalId];
                if (config && crystalState) {
                    const tier = Math.floor(crystalState.fragments / 5);
                    label = `${config.name} (Tier ${tier})`;
                    labelColor = isFocused ? '#ffd700' : '#ffffff';
                    
                    if (slotKey === 'earrings') {
                        if (isSecondary) {
                            const primaryId = GameManager.instance.getState().equippedCrystals.earrings;
                            if (primaryId) {
                                const aug = GameManager.instance.getPetAugmentation(primaryId, crystalId);
                                detail = `🔮 ${aug.name} (+${aug.bonusSkill}, ${aug.passiveDescription})`;
                            } else {
                                detail = '🔮 Catalyst Augmentation (Requires primary pet)';
                            }
                        } else {
                            const effect = GameManager.instance.getScaledSlotEffect(crystalId, slotKey);
                            detail = `🐾 ${effect.description}`;
                        }
                    } else {
                        const effect = GameManager.instance.getScaledSlotEffect(crystalId, slotKey);
                        detail = isSecondary ? `💠 Soulmeld: ${effect.description}` : `⚡ ${effect.description}`;
                    }
                    detailColor = '#a7f3d0';
                }
            }

            const focusPrefix = isFocused ? '▶ ' : '  ';
            const labelText = this.add.text(0, itemY + 6, `${focusPrefix}${label}`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: labelColor,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            this.detailPanel.add(labelText);

            // Fragments badge if monster crystal
            if (crystalId !== 'none') {
                const crystalState = GameManager.instance.getState().soulCrystals[crystalId];
                if (crystalState) {
                    const fragsText = this.add.text(290, itemY + 7, `[${crystalState.fragments}/255]`, {
                        fontFamily: '"Courier New", Courier, monospace',
                        fontSize: '16px',
                        color: crystalState.isExtinct ? '#ffd700' : '#38bdf8',
                        fontStyle: 'bold',
                        stroke: '#000000',
                        strokeThickness: 2
                    });
                    this.detailPanel.add(fragsText);
                }
            }

            const detailText = this.add.text(420, itemY + 7, detail, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: detailColor,
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2,
                wordWrap: { width: 480 }
            });
            this.detailPanel.add(detailText);
        });

        // Interactive Cancel / Back button
        const cancelBox = this.add.graphics();
        cancelBox.fillStyle(0x004433, 0.9);
        cancelBox.fillRoundedRect(-10, 745, 450, 52, 8);
        cancelBox.lineStyle(2, 0x00ffcc, 1);
        cancelBox.strokeRoundedRect(-10, 745, 450, 52, 8);
        this.detailPanel.add(cancelBox);

        const cancelBtn = this.add.text(215, 771, '◀ BACK TO SLOTS (ESC)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0.5);
        this.detailPanel.add(cancelBtn);

        const cancelZone = this.add.zone(215, 771, 450, 52);
        cancelZone.setInteractive({ useHandCursor: true });
        cancelZone.on('pointerdown', () => {
            SoundSynth.playMenuCancel();
            this.isSelectingCrystal = false;
            this.refreshDetails();
        });
        cancelZone.on('pointerover', () => {
            cancelBtn.setColor('#ffffff');
            cancelBox.clear();
            cancelBox.fillStyle(0x006655, 1);
            cancelBox.fillRoundedRect(-10, 745, 450, 52, 8);
            cancelBox.lineStyle(2, 0x00ffcc, 1);
            cancelBox.strokeRoundedRect(-10, 745, 450, 52, 8);
        });
        cancelZone.on('pointerout', () => {
            cancelBtn.setColor('#00ffcc');
            cancelBox.clear();
            cancelBox.fillStyle(0x004433, 0.9);
            cancelBox.fillRoundedRect(-10, 745, 450, 52, 8);
            cancelBox.lineStyle(2, 0x00ffcc, 1);
            cancelBox.strokeRoundedRect(-10, 745, 450, 52, 8);
        });
        this.detailPanel.add(cancelZone);
    }

    private renderCrystalsView() {
        const header = this.add.text(0, 0, 'SOUL CRYSTAL INVENTORY', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.detailPanel.add(header);

        const subtext = this.add.text(0, 34, 'Fragments collected from defeated monsters. Max fragments is 255.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#cbd5e1'
        });
        this.detailPanel.add(subtext);

        const state = GameManager.instance.getState();
        const speciesList = ALL_MONSTER_SPECIES;

        speciesList.forEach((speciesId, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            
            const gridX = col * 465;
            const gridY = 70 + row * 135;

            const crystalState = state.soulCrystals[speciesId] || { fragments: 0, isExtinct: false };
            const config = SoulCrystalDatabase[speciesId];
            
            if (!config) return;

            // Box backing
            const box = this.add.graphics();
            box.fillStyle(0x0f172a, 0.92);
            box.lineStyle(1.5, crystalState.isExtinct ? 0xd4af37 : 0x334155, 1);
            box.fillRoundedRect(gridX, gridY, 440, 122, 8);
            box.strokeRoundedRect(gridX, gridY, 440, 122, 8);
            this.detailPanel.add(box);

            // Title
            const title = this.add.text(gridX + 16, gridY + 10, config.name, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '20px',
                color: crystalState.fragments > 0 ? '#ffffff' : '#64748b',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 3
            });
            this.detailPanel.add(title);

            // Extinction badge
            if (crystalState.isExtinct) {
                const extBadge = this.add.text(gridX + 310, gridY + 10, 'EXTINCT', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '13px',
                    color: '#000000',
                    fontStyle: 'bold',
                    backgroundColor: '#d4af37',
                    padding: { x: 6, y: 2 }
                });
                this.detailPanel.add(extBadge);
            } else if (crystalState.fragments === 254) {
                const endBadge = this.add.text(gridX + 285, gridY + 10, 'ENDANGERED', {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '13px',
                    color: '#000000',
                    fontStyle: 'bold',
                    backgroundColor: '#ff3366',
                    padding: { x: 6, y: 2 }
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

            const detailsText = this.add.text(gridX + 16, gridY + 38, detailsStr, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#38bdf8',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2,
                wordWrap: { width: 410 }
            });
            this.detailPanel.add(detailsText);

            // Progress Bar (Width 410px)
            const barBg = this.add.graphics();
            barBg.fillStyle(0x1e293b, 1);
            barBg.fillRect(gridX + 16, gridY + 96, 410, 14);
            this.detailPanel.add(barBg);

            if (crystalState.fragments > 0) {
                const barFill = this.add.graphics();
                barFill.fillStyle(crystalState.isExtinct ? 0xd4af37 : 0x00ffcc, 1);
                barFill.fillRect(gridX + 16, gridY + 96, 410 * (crystalState.fragments / 255), 14);
                this.detailPanel.add(barFill);
            }

            const fragsText = this.add.text(gridX + 16, gridY + 72, `Fragments: ${crystalState.fragments}/255`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            });
            this.detailPanel.add(fragsText);
        });

        // Slot 8: Cataclysm Singularity World Boss (Climax Bestiary Entry)
        const catCol = 1;
        const catRow = 3;
        const catGridX = catCol * 465;
        const catGridY = 70 + catRow * 135;

        const cataclysmDefeated = GameManager.instance.isCataclysmBossDefeated();
        const cataclysmTriggered = GameManager.instance.isCataclysmEventTriggered();

        // Box backing
        const catBox = this.add.graphics();
        catBox.fillStyle(0x0f172a, 0.92);
        const catBorderColor = cataclysmDefeated ? 0xd4af37 : (cataclysmTriggered ? 0xff0055 : 0x334155);
        catBox.lineStyle(1.5, catBorderColor, 1);
        catBox.fillRoundedRect(catGridX, catGridY, 440, 122, 8);
        catBox.strokeRoundedRect(catGridX, catGridY, 440, 122, 8);
        this.detailPanel.add(catBox);

        // Title
        const catTitleStr = (cataclysmTriggered || cataclysmDefeated) ? 'Cataclysm Singularity' : '??? (Extinction Anomaly)';
        const catTitle = this.add.text(catGridX + 16, catGridY + 10, catTitleStr, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: cataclysmDefeated ? '#ffd700' : (cataclysmTriggered ? '#ff0055' : '#64748b'),
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.detailPanel.add(catTitle);

        // Extinction/Singularity badge
        let catBadgeLabel = 'DORMANT';
        let catBadgeBg = '#333355';
        let catBadgeColor = '#8888aa';
        let catBadgeX = catGridX + 310;
        if (cataclysmDefeated) {
            catBadgeLabel = 'VANQUISHED';
            catBadgeBg = '#d4af37';
            catBadgeColor = '#000000';
            catBadgeX = catGridX + 285;
        } else if (cataclysmTriggered) {
            catBadgeLabel = 'AWAKENED';
            catBadgeBg = '#ff0055';
            catBadgeColor = '#ffffff';
            catBadgeX = catGridX + 295;
        }
        const catBadge = this.add.text(catBadgeX, catGridY + 10, catBadgeLabel, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: catBadgeColor,
            fontStyle: 'bold',
            backgroundColor: catBadgeBg,
            padding: { x: 6, y: 2 }
        });
        this.detailPanel.add(catBadge);

        // Details string
        let catDetailsStr = 'Awakens when 80% of species reach extinction.';
        if (cataclysmDefeated) {
            catDetailsStr = 'Extinction engine broken. World saved.';
        } else if (cataclysmTriggered) {
            catDetailsStr = 'World Boss active at World Map (50, 50).';
        }
        const catDetailsText = this.add.text(catGridX + 16, catGridY + 38, catDetailsStr, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: cataclysmDefeated ? '#00ffcc' : (cataclysmTriggered ? '#ff5588' : '#cbd5e1'),
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
            wordWrap: { width: 410 }
        });
        this.detailPanel.add(catDetailsText);

        // Progress Bar
        const catBarBg = this.add.graphics();
        catBarBg.fillStyle(0x1e293b, 1);
        catBarBg.fillRect(catGridX + 16, catGridY + 96, 410, 14);
        this.detailPanel.add(catBarBg);

        const extinctCount = speciesList.filter(s => state.soulCrystals[s]?.isExtinct).length;
        const targetCount = 6; // 80% of 7 species = 5.6 -> 6 species
        const catProgressRatio = cataclysmDefeated ? 1.0 : Math.min(1.0, extinctCount / targetCount);
        if (catProgressRatio > 0) {
            const catBarFill = this.add.graphics();
            catBarFill.fillStyle(cataclysmDefeated ? 0xd4af37 : (cataclysmTriggered ? 0xff0055 : 0x663399), 1);
            catBarFill.fillRect(catGridX + 16, catGridY + 96, 410 * catProgressRatio, 14);
            this.detailPanel.add(catBarFill);
        }

        const catFragsText = this.add.text(
            catGridX + 16,
            catGridY + 72,
            cataclysmDefeated
                ? 'Status: Extinction Singularity Cleared'
                : (cataclysmTriggered
                    ? 'Status: Apex Threat Active'
                    : `Extinction Progress: ${extinctCount}/${targetCount} (80% Trigger)`),
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#ffffff',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }
        );
        this.detailPanel.add(catFragsText);
    }

    private renderCloseNotice() {
        const title = this.add.text(0, 40, 'EXIT MENU & RESUME GAME', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '26px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(title);

        const sub = this.add.text(0, 85, 'Press ENTER / SPACE or click the button below to return to the world.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#8899b3'
        });
        this.detailPanel.add(sub);

        const resumeBtnBg = this.add.graphics();
        resumeBtnBg.fillStyle(0x00ffcc, 0.25);
        resumeBtnBg.fillRoundedRect(0, 150, 320, 56, 8);
        resumeBtnBg.lineStyle(2, 0x00ffcc, 1);
        resumeBtnBg.strokeRoundedRect(0, 150, 320, 56, 8);
        this.detailPanel.add(resumeBtnBg);

        const resumeBtnTxt = this.add.text(160, 178, '▶ RESUME GAME (ESC)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        this.detailPanel.add(resumeBtnTxt);

        const resumeZone = this.add.zone(160, 178, 320, 56);
        resumeZone.setInteractive({ useHandCursor: true });
        resumeZone.on('pointerdown', () => {
            this.closeMenu();
        });
        resumeZone.on('pointerover', () => {
            resumeBtnTxt.setColor('#ffffff');
            resumeBtnBg.clear();
            resumeBtnBg.fillStyle(0x00ffcc, 0.55);
            resumeBtnBg.fillRoundedRect(0, 150, 320, 56, 8);
            resumeBtnBg.lineStyle(2, 0x88ffee, 1);
            resumeBtnBg.strokeRoundedRect(0, 150, 320, 56, 8);
        });
        resumeZone.on('pointerout', () => {
            resumeBtnTxt.setColor('#00ffcc');
            resumeBtnBg.clear();
            resumeBtnBg.fillStyle(0x00ffcc, 0.25);
            resumeBtnBg.fillRoundedRect(0, 150, 320, 56, 8);
            resumeBtnBg.lineStyle(2, 0x00ffcc, 1);
            resumeBtnBg.strokeRoundedRect(0, 150, 320, 56, 8);
        });
        this.detailPanel.add(resumeZone);
    }

    private renderAudioSettingsView() {
        const header = this.add.text(0, 0, 'AUDIO & MUSIC SETTINGS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        // Current status variables
        const vol = Math.round(SoundSynth.getVolume() * 100);
        const muted = SoundSynth.isMuted();
        const currentBgm = SoundSynth.getCurrentBgm();

        // 1. Volume & Mute Row
        const volLabel = this.add.text(0, 40, `VOLUME: ${vol}%`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ffffff'
        });
        this.detailPanel.add(volLabel);

        const barLength = 14;
        const filled = Math.round((vol / 100) * barLength);
        const empty = barLength - filled;
        const gaugeBar = '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';

        const gaugeText = this.add.text(160, 40, gaugeBar, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: muted ? '#666666' : '#00ffcc'
        });
        this.detailPanel.add(gaugeText);

        const decBtn = this.add.text(340, 35, '[-]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ffcc00',
            backgroundColor: '#1f293d',
            padding: { x: 10, y: 5 }
        });
        decBtn.setInteractive({ useHandCursor: true });
        decBtn.on('pointerdown', () => {
            const newVol = Math.max(0, SoundSynth.getVolume() - 0.1);
            SoundSynth.setVolume(newVol);
            SoundSynth.playMenuBlip();
            this.refreshDetails();
        });
        this.detailPanel.add(decBtn);

        const incBtn = this.add.text(395, 35, '[+]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ffcc00',
            backgroundColor: '#1f293d',
            padding: { x: 10, y: 5 }
        });
        incBtn.setInteractive({ useHandCursor: true });
        incBtn.on('pointerdown', () => {
            const newVol = Math.min(1, SoundSynth.getVolume() + 0.1);
            SoundSynth.setVolume(newVol);
            SoundSynth.playMenuBlip();
            this.refreshDetails();
        });
        this.detailPanel.add(incBtn);

        const muteToggleBtn = this.add.text(460, 35, muted ? '[ 🔊 UNMUTE ]' : '[ 🔇 MUTE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: muted ? '#3d1f1f' : '#2d3748',
            padding: { x: 12, y: 6 }
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
        const bgmLabel = this.add.text(0, 88, `NOW PLAYING: [ ${bgmStatus} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: currentBgm ? '#00ffcc' : '#8899b3',
            fontStyle: 'bold'
        });
        this.detailPanel.add(bgmLabel);

        // 2. Procedural BGM Jukebox Section
        const jukeHeader = this.add.text(0, 125, '🎶 PROCEDURAL BGM JUKEBOX (9 REGIONAL THEMES)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(jukeHeader);

        const bgmTracks: { id: BgmTrackId; label: string; x: number; y: number }[] = [
            { id: 'overworld', label: '🌲 OVERWORLD', x: 0, y: 160 },
            { id: 'oakhaven', label: '🌾 OAKHAVEN', x: 200, y: 160 },
            { id: 'aetheria', label: '🌌 AETHERIA', x: 400, y: 160 },
            { id: 'ironspire', label: '⚙️ IRONSPIRE', x: 600, y: 160 },
            { id: 'meteor_pod', label: '🛸 METEOR POD', x: 0, y: 205 },
            { id: 'dungeon', label: '🦇 DUNGEON', x: 200, y: 205 },
            { id: 'castle', label: '🏰 CASTLE', x: 400, y: 205 },
            { id: 'battle', label: '⚔️ BATTLE', x: 600, y: 205 },
            { id: 'boss', label: '👑 BOSS', x: 0, y: 250 },
        ];

        bgmTracks.forEach(t => {
            const isPlaying = currentBgm === t.id;
            const btn = this.add.text(t.x, t.y, t.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: isPlaying ? '#00ffcc' : '#ffffff',
                backgroundColor: isPlaying ? '#1e3a5f' : '#1a2332',
                padding: { x: 12, y: 8 }
            });
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => {
                SoundSynth.playBgm(t.id, 150);
                this.refreshDetails();
            });
            this.detailPanel.add(btn);
        });

        const stopBtn = this.add.text(200, 250, '⏹️ STOP BGM', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ff6666',
            backgroundColor: '#331a1a',
            padding: { x: 12, y: 8 }
        });
        stopBtn.setInteractive({ useHandCursor: true });
        stopBtn.on('pointerdown', () => {
            SoundSynth.stopBgm(200);
            this.refreshDetails();
        });
        this.detailPanel.add(stopBtn);

        // 3. Procedural SFX Preview Bench
        const sfxHeader = this.add.text(0, 310, '🔊 PROCEDURAL SFX PREVIEW BENCH', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(sfxHeader);

        const sfxButtons = [
            { label: '[ ⚔️ SLASH ]', color: '#00ffcc', x: 0, fn: () => SoundSynth.playAttackHit() },
            { label: '[ 💥 CRIT ]', color: '#ff6600', x: 150, fn: () => SoundSynth.playCritHit() },
            { label: '[ ✨ HEAL ]', color: '#00ff88', x: 290, fn: () => SoundSynth.playSpellCast('heal') },
            { label: '[ 🏆 FANFARE ]', color: '#ffcc00', x: 430, fn: () => SoundSynth.playVictory() },
            { label: '[ 🦖 ROAR ]', color: '#ff3366', x: 590, fn: () => SoundSynth.playBossRoar() }
        ];

        sfxButtons.forEach(s => {
            const btn = this.add.text(s.x, 345, s.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: s.color,
                backgroundColor: '#1a2332',
                padding: { x: 12, y: 8 }
            });
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', s.fn);
            this.detailPanel.add(btn);
        });

        // 4. Artist Credits & Legal Attributions Box (Width 905px)
        const creditsBox = this.add.graphics();
        creditsBox.fillStyle(0x0a1020, 0.95);
        creditsBox.lineStyle(1.5, 0xffcc00, 0.7);
        creditsBox.fillRoundedRect(0, 410, 905, 230, 8);
        creditsBox.strokeRoundedRect(0, 410, 905, 230, 8);
        this.detailPanel.add(creditsBox);

        const creditsTitle = this.add.text(18, 424, '🎼 MUSIC & ASSET ATTRIBUTIONS (SEE CREDITS.MD)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(creditsTitle);

        const creditsText = this.add.text(18, 455,
            `• Music Composition : Matthew Pablo ("Soliloquy" - CC-BY 3.0)\n` +
            `• Web Audio Engine   : 100% Procedural 16-Bit Polyphonic Synthesis\n` +
            `• Regional Themes    : 9 Unique Adaptive Compositions (32 Steps/Track)\n` +
            `• Sound FX Matrix    : Pure Real-Time Math/Oscillator Waveforms\n` +
            `• Open Source Assets : Kenney & OpenGameArt CC-BY / CC0 Visuals\n` +
            `• Complete licensing & artist attribution terms documented in CREDITS.md`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#94a3b8',
                lineSpacing: 6
            }
        );
        this.detailPanel.add(creditsText);
    }

    private renderControlsAndInputView() {
        const header = this.add.text(0, 0, 'CONTROLS & INPUT SETTINGS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        // 1. Touch Controls Mode Section
        const touchMode = TouchControls.instance.getMode();
        const isTouchActive = TouchControls.instance.isTouchActive();
        const touchTitle = this.add.text(0, 42, `TOUCH OVERLAY MODE: [ ${touchMode.toUpperCase()} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(touchTitle);

        const touchDesc = this.add.text(0, 70, isTouchActive 
            ? 'Virtual 4-Way D-Pad & Action buttons are currently ACTIVE.' 
            : 'Virtual 4-Way D-Pad & Action buttons are currently HIDDEN.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
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
            const btnX = idx * 240;
            const isSelected = touchMode === m.mode;
            const btn = this.add.text(btnX, 98, `[ ${m.label} ]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: isSelected ? '#000000' : '#ffffff',
                backgroundColor: isSelected ? '#00ffcc' : '#1f293d',
                padding: { x: 12, y: 8 }
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
        const hapticTitle = this.add.text(0, 160, `HAPTIC FEEDBACK (RUMBLE): [ ${hapticsEnabled ? 'ENABLED' : 'DISABLED'} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(hapticTitle);

        const hapticToggleBtn = this.add.text(0, 192, hapticsEnabled ? '[ 📳 DISABLE HAPTICS ]' : '[ 📳 ENABLE HAPTICS ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: hapticsEnabled ? '#3d1f1f' : '#1f3d29',
            padding: { x: 14, y: 8 }
        });
        hapticToggleBtn.setInteractive({ useHandCursor: true });
        hapticToggleBtn.on('pointerdown', () => {
            TouchControls.instance.setHapticsEnabled(!hapticsEnabled);
            SoundSynth.playMenuSelect();
            this.refreshDetails();
        });
        this.detailPanel.add(hapticToggleBtn);

        const testRumbleBtn = this.add.text(260, 192, '[ TEST RUMBLE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#2d3748',
            padding: { x: 14, y: 8 }
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
        const padTitle = this.add.text(0, 260, `GAMEPAD / CONTROLLER: [ ${isPadConnected ? 'CONNECTED' : 'DISCONNECTED'} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: isPadConnected ? '#00ffcc' : '#8899b3',
            fontStyle: 'bold'
        });
        this.detailPanel.add(padTitle);

        const padInfo = this.add.text(0, 292, isPadConnected 
            ? `Device: ${padName || 'Standard Gamepad'}\n• Button 0 (A): Action/Confirm  • Button 1 (B): Sprint/Cancel\n• Left Stick / D-Pad: Movement  • Button 9: Menu`
            : 'Plug in or connect any Bluetooth/USB Gamepad (Xbox, PlayStation, or Switch)\nfor automatic plug-and-play controller support.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            lineSpacing: 5
        });
        this.detailPanel.add(padInfo);

        // 4. Keyboard Controls Reference
        const kbTitle = this.add.text(0, 385, 'KEYBOARD & DESKTOP CONTROLS:', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(kbTitle);

        const kbRef = this.add.text(0, 415, 
            '• Movement:           W, A, S, D  or  Arrow Keys\n' +
            '• Action / Interact:  SPACE  or  ENTER\n' +
            '• Menu Toggle:        ESC  or  M\n' +
            '• Quick Touch Toggle: [📱] Icon in Top-Right HUD\n' +
            '• Warps / Battle:     1-6 (Teleport), B (Instant Battle)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#e2e8f0',
            lineSpacing: 5,
            wordWrap: { width: 890 }
        });
        this.detailPanel.add(kbRef);
    }

    private renderAccessibilityView() {
        const header = this.add.text(0, 0, 'ACCESSIBILITY & VISUAL COMFORT', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        const subheader = this.add.text(0, 34, 'Customize gameplay motion and visual effects for your comfort.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#8899b3'
        });
        this.detailPanel.add(subheader);

        // 1. Screen Shake Setting
        const isShakeEnabled = AccessibilityManager.isScreenShakeEnabled();
        const shakeTitle = this.add.text(0, 80, `CAMERA SCREEN SHAKE: [ ${isShakeEnabled ? 'ENABLED' : 'DISABLED'} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: isShakeEnabled ? '#00ffcc' : '#ffaa00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(shakeTitle);

        const shakeDesc = this.add.text(0, 110, 
            'Applies dynamic camera shaking during critical strikes, heavy impacts, and earth tremors.\n' +
            'Disable if you experience motion sensitivity or eye fatigue.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#cbd5e1',
            lineSpacing: 4
        });
        this.detailPanel.add(shakeDesc);

        const shakeToggleBtn = this.add.text(0, 168, isShakeEnabled ? '[ 📳 DISABLE SHAKE ]' : '[ 📳 ENABLE SHAKE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: isShakeEnabled ? '#4a1d24' : '#14532d',
            padding: { x: 14, y: 8 }
        });
        shakeToggleBtn.setInteractive({ useHandCursor: true });
        shakeToggleBtn.on('pointerdown', () => {
            AccessibilityManager.toggleScreenShake();
            SoundSynth.playMenuSelect();
            this.refreshDetails();
        });
        this.detailPanel.add(shakeToggleBtn);

        const testShakeBtn = this.add.text(260, 168, '[ TEST SHAKE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#1e293b',
            padding: { x: 14, y: 8 }
        });
        testShakeBtn.setInteractive({ useHandCursor: true });
        testShakeBtn.on('pointerdown', () => {
            AccessibilityManager.shakeCamera(this.cameras.main, 250, 0.015);
            SoundSynth.playMenuBlip();
        });
        this.detailPanel.add(testShakeBtn);

        // 2. Combat Flashes Setting
        const isFlashesEnabled = AccessibilityManager.isCombatFlashesEnabled();
        const flashTitle = this.add.text(0, 240, `COMBAT LIGHT FLASHES: [ ${isFlashesEnabled ? 'ENABLED' : 'DISABLED'} ]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: isFlashesEnabled ? '#00ffcc' : '#ffaa00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(flashTitle);

        const flashDesc = this.add.text(0, 270, 
            'Applies rapid high-contrast light flashes during spellcasts, weaknesses, and boss melds.\n' +
            'Disable for photosensitivity comfort or low-light play sessions.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#cbd5e1',
            lineSpacing: 4
        });
        this.detailPanel.add(flashDesc);

        const flashToggleBtn = this.add.text(0, 328, isFlashesEnabled ? '[ ⚡ DISABLE FLASHES ]' : '[ ⚡ ENABLE FLASHES ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: isFlashesEnabled ? '#4a1d24' : '#14532d',
            padding: { x: 14, y: 8 }
        });
        flashToggleBtn.setInteractive({ useHandCursor: true });
        flashToggleBtn.on('pointerdown', () => {
            AccessibilityManager.toggleCombatFlashes();
            SoundSynth.playMenuSelect();
            this.refreshDetails();
        });
        this.detailPanel.add(flashToggleBtn);

        const testFlashBtn = this.add.text(260, 328, '[ TEST FLASH ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#1e293b',
            padding: { x: 14, y: 8 }
        });
        testFlashBtn.setInteractive({ useHandCursor: true });
        testFlashBtn.on('pointerdown', () => {
            AccessibilityManager.flashCamera(this.cameras.main, 250, 0, 255, 200, false);
            SoundSynth.playMenuBlip();
        });
        this.detailPanel.add(testFlashBtn);

        // 3. Reset Defaults Button
        const resetBtn = this.add.text(0, 415, '[ 🔄 RESET ACCESSIBILITY TO DEFAULTS ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#ffd700',
            backgroundColor: '#0f172a',
            padding: { x: 16, y: 10 }
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

        // 2. Status Telemetry Card (Width 905px)
        const statusBox = this.add.graphics();
        statusBox.fillStyle(0x0f172a, 0.88);
        statusBox.lineStyle(1.5, 0x00ffcc, 0.6);
        statusBox.fillRoundedRect(0, 45, 905, 155, 8);
        statusBox.strokeRoundedRect(0, 45, 905, 155, 8);
        this.detailPanel.add(statusBox);

        const userTag = tgUser
            ? `TELEGRAM AUTH : @${tgUser.username || tgUser.first_name} (ID: ${tgUser.id})`
            : `PLAYER PROFILE: GUEST (Local Browser Session)`;

        const statusText = this.add.text(18, 60,
            `CONNECTION STATUS: [ ${status} ]\n` +
            `NETWORK PROFILE  : ${isOff ? 'OFFLINE SIMULATION' : 'ONLINE (REST / MOCK CLOUD)'}\n` +
            `${userTag}\n` +
            `ACTIVE SAVE SLOT : Slot ${currentSlot} of 16\n` +
            `OFFLINE QUEUE    : ${pendingCount} pending save(s)`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#e2e8f0',
                lineSpacing: 6
            }
        );
        this.detailPanel.add(statusText);

        // 3. Interactive Action Buttons
        const syncBtn = this.add.text(0, 225, '[ 🔄 SYNC ACTIVE SLOT NOW ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            backgroundColor: '#1e293b',
            padding: { x: 16, y: 10 }
        });
        syncBtn.setInteractive({ useHandCursor: true });
        syncBtn.on('pointerdown', async () => {
            SoundSynth.playMenuSelect();
            syncBtn.setText('[ ⏳ SYNCING... ]');
            await GameManager.instance.syncWithCloud();
            this.refreshDetails();
        });
        this.detailPanel.add(syncBtn);

        const toggleOfflineBtn = this.add.text(350, 225, isOff ? '[ 🌐 SWITCH TO ONLINE ]' : '[ 📴 SIMULATE OFFLINE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: isOff ? '#00ff88' : '#ffaa00',
            backgroundColor: '#1e293b',
            padding: { x: 16, y: 10 }
        });
        toggleOfflineBtn.setInteractive({ useHandCursor: true });
        toggleOfflineBtn.on('pointerdown', () => {
            client.setOfflineMode(!isOff);
            SoundSynth.playMenuBlip();
            this.refreshDetails();
        });
        this.detailPanel.add(toggleOfflineBtn);

        const clearCloudBtn = this.add.text(0, 285, '[ 🧹 RESET SIMULATED CLOUD ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#f87171',
            backgroundColor: '#2d1515',
            padding: { x: 14, y: 8 }
        });
        clearCloudBtn.setInteractive({ useHandCursor: true });
        clearCloudBtn.on('pointerdown', () => {
            client.clearCloudStorage();
            SoundSynth.playMenuCancel();
            this.refreshDetails();
        });
        this.detailPanel.add(clearCloudBtn);

        // 4. Governance & Architecture Rules Card (Width 905px)
        const ruleBox = this.add.graphics();
        ruleBox.fillStyle(0x0a101f, 0.92);
        ruleBox.lineStyle(1.5, 0x3b82f6, 0.5);
        ruleBox.fillRoundedRect(0, 350, 905, 220, 8);
        ruleBox.strokeRoundedRect(0, 350, 905, 220, 8);
        this.detailPanel.add(ruleBox);

        const ruleTitle = this.add.text(18, 364, 'SECURITY & GOVERNANCE SPECIFICATION', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#60a5fa',
            fontStyle: 'bold'
        });
        this.detailPanel.add(ruleTitle);

        const ruleText = this.add.text(18, 395,
            `• Payload Ceiling  : Hard limit of 5MB enforced on upload and download.\n` +
            `• Client Throttling: Max 3 save transmissions / sec prevents flooding.\n` +
            `• Checksum Security: HMAC-SHA256 FIPS 180-4 / RFC 2104 signatures.\n` +
            `• Conflict Policy  : Safe merge prioritizes Extinct Species (0-6)\n` +
            `                    and Soul Level over timestamps (Zero Rollbacks).\n` +
            `• Telegram Mini App: Cryptographic validation of initData signature\n` +
            `                    via HMAC-SHA256("WebAppData", botToken).`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#94a3b8',
                lineSpacing: 5
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

        // 1. Account Section Card (Width 905px)
        const accBox = this.add.graphics();
        accBox.fillStyle(0x0e1728, 0.92);
        accBox.lineStyle(1.5, 0x00ffcc, 0.7);
        accBox.fillRoundedRect(0, 0, 905, 160, 10);
        accBox.strokeRoundedRect(0, 0, 905, 160, 10);
        this.detailPanel.add(accBox);

        const accTitle = this.add.text(20, 16, 'PLAYER IDENTITY & ACCOUNT BONDING', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '19px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(accTitle);

        const accDetails = this.add.text(20, 48, 
            `• Linked Account  : ${bondedEmail}\n` +
            `• Auth Provider   : ${profile.authProvider.toUpperCase()}  [${profile.verified ? 'VERIFIED' : 'UNVERIFIED'}]\n` +
            `• Admin Authority : ${profile.isAdmin ? 'AUTHORIZED (PRIMARY)' : 'STANDARD PLAYER'}\n` +
            `• Commercial Bond : ${tier === 'commercial' ? `Bonded to ${bondedEmail}` : 'None'}`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#ffffff',
                lineSpacing: 6
            }
        );
        this.detailPanel.add(accDetails);

        // 2. License Status Card (Width 905px)
        const licBox = this.add.graphics();
        licBox.fillStyle(0x12101e, 0.92);
        licBox.lineStyle(1.5, tier === 'commercial' ? 0xffd700 : 0xffaa00, 0.85);
        licBox.fillRoundedRect(0, 175, 905, 175, 10);
        licBox.strokeRoundedRect(0, 175, 905, 175, 10);
        this.detailPanel.add(licBox);

        const licTitle = this.add.text(20, 190, 'DUAL-TIER LICENSE & ENTITLEMENTS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '19px',
            color: tier === 'commercial' ? '#ffd700' : '#ffcc00',
            fontStyle: 'bold'
        });
        this.detailPanel.add(licTitle);

        const licDetails = this.add.text(20, 222,
            `• Current License : ${tier.toUpperCase()} EDITION\n` +
            `• Preorder Perk   : 🌟 PLAY 30 ENTIRE DAYS BEFORE PLATFORM LAUNCH!\n` +
            `• Active Playtime : ${Math.floor(LicenseManager.instance.getActivePlaytimeSeconds() / 60)} mins active\n` +
            `• Offline Token   : ${token}\n` +
            `• Price / Rails   : $12.99 USD (Stripe) / 650 Telegram Stars`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#ffffff',
                lineSpacing: 6
            }
        );
        this.detailPanel.add(licDetails);

        // Action Buttons:
        // Preorder / Buy button
        const buyBtn = this.add.text(0, 370, tier === 'commercial' ? '[ 👑 COMMERCIAL ACTIVE ]' : '[ ⚡ PREORDER FULL - $12.99 / ⭐️ 650 ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: tier === 'commercial' ? '#ffd700' : '#ffffff',
            backgroundColor: tier === 'commercial' ? '#2e2508' : '#006655',
            padding: { x: 12, y: 8 }
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
        const redeemBtn = this.add.text(420, 370, '[ 🔑 REDEEM TOKEN ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#00ffcc',
            backgroundColor: '#182438',
            padding: { x: 12, y: 8 }
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
        const creditsBtn = this.add.text(0, 425, '[ 📜 VIEW CREDITS ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffd700',
            backgroundColor: '#1f1b0a',
            padding: { x: 12, y: 8 }
        });
        creditsBtn.setInteractive({ useHandCursor: true });
        creditsBtn.on('pointerdown', () => {
            SoundSynth.playMenuSelect();
            this.scene.stop('MenuScene');
            this.scene.start('CreditsScene', { returnScene: 'OverworldScene' });
        });
        this.detailPanel.add(creditsBtn);

        // Disconnect / Reset button
        const dcBtn = this.add.text(420, 425, '[ 🚪 GUEST MODE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ff6666',
            backgroundColor: '#261218',
            padding: { x: 12, y: 8 }
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
            fontSize: '16px',
            color: '#ffffff',
            align: 'center',
            padding: { x: 22, y: 14 }
        }).setOrigin(0.5, 0.5);

        const textWidth = Math.max(320, txt.width + 44);
        const textHeight = Math.max(48, txt.height + 22);

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
        box.fillRoundedRect(0, 0, 905, 240, 10);
        box.strokeRoundedRect(0, 0, 905, 240, 10);
        this.detailPanel.add(box);

        const title = this.add.text(20, 16, '💬 BETA TESTER FEEDBACK & BUG REPORT', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '19px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(title);

        const privacyNotice = this.add.text(20, 50,
            `🛡️ Privacy Guarantee:\n` +
            `• 100% Private: Zero personal files, device IDs, or passwords accessed.\n` +
            `• Safe Diagnostics: Only quest coordinates and notes are saved locally.\n` +
            `• Google Play Beta Ready: Helps tune balance before Play Store release.\n\n` +
            `• Current Zone: ${mapId}  (Grid: ${Math.floor(coords.x / 64)}, ${Math.floor(coords.y / 64)}) | Hero: LV ${calculated.level}`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#8899b3',
                lineSpacing: 5
            }
        );
        this.detailPanel.add(privacyNotice);

        const selectLabel = this.add.text(0, 260, 'SELECT FEEDBACK TOPIC TO SUBMIT (1-CLICK):', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
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
            const btn = this.add.text(0, 295 + idx * 46, `[ ${t.label} ]`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#ffffff',
                backgroundColor: '#182845',
                padding: { x: 14, y: 8 }
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
        const countText = this.add.text(0, 495, `Saved Beta Feedback Reports: ${recentCount}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
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

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Semi-transparent backdrop overlay preventing clicking through
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x04050d, 0.92);
        backdrop.fillRect(-width / 2, -height / 2, width, height);
        backdrop.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);
        backdrop.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const localX = pointer.x - width / 2;
            const localY = pointer.y - height / 2;
            if (Math.abs(localX) > 420 || Math.abs(localY) > 280) {
                this.closeArtworkInspectModal();
            }
        });
        modal.add(backdrop);

        // Modal Frame Card (Spacious 840x560)
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x0e1124, 0.98);
        cardBg.fillRoundedRect(-420, -280, 840, 560, 14);
        cardBg.lineStyle(3, 0xffcc00, 1);
        cardBg.strokeRoundedRect(-420, -280, 840, 560, 14);
        cardBg.lineStyle(1.5, 0x00ffcc, 0.6);
        cardBg.strokeRoundedRect(-424, -284, 848, 568, 18);
        modal.add(cardBg);

        // Header Title
        const header = this.add.text(0, -245, '★ MELODIE SWIFT ORIGINAL ARTWORK ARCHIVE ★', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        modal.add(header);

        // Slot Subheading
        const slotData = MELODIE_ARTWORK_CATALOG[slot];
        const subheader = this.add.text(0, -215, `Slot: ${slot.toUpperCase()} - ${slotData ? slotData.slotTitle : ''}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#8899b3'
        }).setOrigin(0.5, 0.5);
        modal.add(subheader);

        // Art Frame Box (Left side)
        const artFrame = this.add.graphics();
        artFrame.fillStyle(0x161a33, 1);
        artFrame.fillRoundedRect(-380, -180, 220, 220, 12);
        artFrame.lineStyle(2, 0x00ffcc, 0.8);
        artFrame.strokeRoundedRect(-380, -180, 220, 220, 12);
        modal.add(artFrame);

        // Artwork Image
        const initialVariant = CharacterLayerCompositor.getArtworkVariant(slot, this.selectedArtworkVariants[slot]);
        const initialKey = this.textures.exists(initialVariant.assetKey) ? initialVariant.assetKey : this.getDefaultSlotIconKey(slot);
        this.inspectArtworkImage = this.add.image(-270, -70, initialKey);
        this.inspectArtworkImage.setScale(2.2);
        modal.add(this.inspectArtworkImage);

        // Info details (Right side)
        this.inspectNameText = this.add.text(-130, -180, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#ffd700',
            fontStyle: 'bold',
            wordWrap: { width: 510 }
        });
        modal.add(this.inspectNameText);

        this.inspectDescText = this.add.text(-130, -135, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            wordWrap: { width: 510 }
        });
        modal.add(this.inspectDescText);

        this.inspectLoreText = this.add.text(-130, -75, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#e6ccff',
            fontStyle: 'italic',
            wordWrap: { width: 510 }
        });
        modal.add(this.inspectLoreText);

        this.inspectBonusText = this.add.text(-130, 0, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#00ffcc',
            fontStyle: 'bold',
            wordWrap: { width: 510 }
        });
        modal.add(this.inspectBonusText);

        // Counter text
        this.inspectCounterText = this.add.text(0, 110, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#8899b3'
        }).setOrigin(0.5, 0.5);
        modal.add(this.inspectCounterText);

        // Cycle Button
        const cycleBtn = this.add.text(-140, 175, '▶ NEXT VARIANT (SPACE)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#ffffff',
            backgroundColor: '#224488',
            padding: { x: 16, y: 10 }
        }).setOrigin(0.5, 0.5);
        cycleBtn.setInteractive({ useHandCursor: true });
        cycleBtn.on('pointerdown', () => this.cycleCurrentArtworkVariant());
        cycleBtn.on('pointerover', () => cycleBtn.setStyle({ backgroundColor: '#3366cc' }));
        cycleBtn.on('pointerout', () => cycleBtn.setStyle({ backgroundColor: '#224488' }));
        modal.add(cycleBtn);

        // Close Button
        const closeBtn = this.add.text(140, 175, '✖ CLOSE (ESC)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#ffffff',
            backgroundColor: '#661122',
            padding: { x: 16, y: 10 }
        }).setOrigin(0.5, 0.5);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.closeArtworkInspectModal());
        closeBtn.on('pointerover', () => closeBtn.setStyle({ backgroundColor: '#992233' }));
        closeBtn.on('pointerout', () => closeBtn.setStyle({ backgroundColor: '#661122' }));
        modal.add(closeBtn);

        // Help hint
        const hint = this.add.text(0, 230, 'Hint: Variant artwork dynamically persists onto player sprite in real-time.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
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
            fontSize: '28px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(header);

        const subtext = this.add.text(0, 34, 'Real-time cartographic scanner & toroidal navigation telemetry', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
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

        // 1. Draw World Radar Map (450x450)
        const mapOffsetX = 0;
        const mapOffsetY = 65;
        const tileSize = 4.5; // 100 * 4.5 = 450px

        const radarGfx = this.add.graphics();
        
        // Map Background Backing
        radarGfx.fillStyle(0x050510, 0.95);
        radarGfx.fillRect(mapOffsetX, mapOffsetY, 450, 450);

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
            radarGfx.lineTo(mapOffsetX + q * tileSize, mapOffsetY + 450);
            radarGfx.moveTo(mapOffsetX, mapOffsetY + q * tileSize);
            radarGfx.lineTo(mapOffsetX + 450, mapOffsetY + q * tileSize);
            radarGfx.stroke();
        });

        // Glowing Outer Bezel Frame
        radarGfx.lineStyle(2, 0x00ffcc, 0.85);
        radarGfx.strokeRect(mapOffsetX - 1, mapOffsetY - 1, 452, 452);
        
        // Cybernetic Corner Brackets
        radarGfx.lineStyle(3, 0xff00ff, 0.9);
        const bracketLen = 14;
        // Top-Left
        radarGfx.beginPath();
        radarGfx.moveTo(mapOffsetX - 4, mapOffsetY + bracketLen);
        radarGfx.lineTo(mapOffsetX - 4, mapOffsetY - 4);
        radarGfx.lineTo(mapOffsetX + bracketLen, mapOffsetY - 4);
        // Top-Right
        radarGfx.moveTo(mapOffsetX + 454 - bracketLen, mapOffsetY - 4);
        radarGfx.lineTo(mapOffsetX + 454, mapOffsetY - 4);
        radarGfx.lineTo(mapOffsetX + 454, mapOffsetY + bracketLen);
        // Bottom-Left
        radarGfx.moveTo(mapOffsetX - 4, mapOffsetY + 454 - bracketLen);
        radarGfx.lineTo(mapOffsetX - 4, mapOffsetY + 454);
        radarGfx.lineTo(mapOffsetX + bracketLen, mapOffsetY + 454);
        // Bottom-Right
        radarGfx.moveTo(mapOffsetX + 454 - bracketLen, mapOffsetY + 454);
        radarGfx.lineTo(mapOffsetX + 454, mapOffsetY + 454);
        radarGfx.lineTo(mapOffsetX + 454, mapOffsetY + 454 - bracketLen);
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
            fontSize: '12px',
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

        // 4. Right Side Telemetry & Landmark Panel (X: 475 to 905)
        const panelX = 475;

        // Telemetry Card
        const telemetryBox = this.add.graphics();
        telemetryBox.fillStyle(0x0f172a, 0.88);
        telemetryBox.fillRoundedRect(panelX, mapOffsetY, 430, 140, 8);
        telemetryBox.lineStyle(1.5, 0x38bdf8, 0.7);
        telemetryBox.strokeRoundedRect(panelX, mapOffsetY, 430, 140, 8);
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

        const telemetryText = this.add.text(panelX + 16, mapOffsetY + 12, 
            `📡 TELEMETRY SENSORS\n` +
            `Sector : [X: ${pGridX}, Y: ${pGridY}]\n` +
            `Region : ${regionName}\n` +
            `Map    : ${currentMapId === 'world_map' ? 'Toroidal Overworld' : currentMapId.toUpperCase()}\n` +
            `Anchor : Crater Basin (45, 46)\n` +
            `Hunt   : ${extinctCount}/${totalSpecies} Extinct (${extinctPercent}%)`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#e2e8f0',
            lineSpacing: 5
        });
        this.detailPanel.add(telemetryText);

        // Landmarks Card
        const landmarksBox = this.add.graphics();
        landmarksBox.fillStyle(0x0f172a, 0.88);
        landmarksBox.fillRoundedRect(panelX, mapOffsetY + 152, 430, 150, 8);
        landmarksBox.lineStyle(1.5, 0x00ffcc, 0.6);
        landmarksBox.strokeRoundedRect(panelX, mapOffsetY + 152, 430, 150, 8);
        this.detailPanel.add(landmarksBox);

        const landmarksTitle = this.add.text(panelX + 16, mapOffsetY + 162, '📍 CONTINENTAL LANDMARKS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.detailPanel.add(landmarksTitle);

        const landmarksList = this.add.text(panelX + 16, mapOffsetY + 188,
            `🚀 (45, 45) Crater Drop Pod (Spawn)\n` +
            `🏡 (60, 48) Oakhaven Valley Hub\n` +
            `⛰️ (55, 20) Ancient Catacombs\n` +
            `🔮 (65, 82) Port Aetheria Spire\n` +
            `⚒️ (88, 35) Ironspire Bastion\n` +
            `🏰 (50, 88) Obsidian Castle Keep`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#cbd5e1',
            lineSpacing: 4
        });
        this.detailPanel.add(landmarksList);

        // Radar Biome Legend Card
        const legendBox = this.add.graphics();
        legendBox.fillStyle(0x0f172a, 0.88);
        legendBox.fillRoundedRect(panelX, mapOffsetY + 314, 430, 136, 8);
        legendBox.lineStyle(1.5, 0xa855f7, 0.6);
        legendBox.strokeRoundedRect(panelX, mapOffsetY + 314, 430, 136, 8);
        this.detailPanel.add(legendBox);

        const legendTitle = this.add.text(panelX + 16, mapOffsetY + 324, '🗺️ RADAR BIOME LEGEND', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#a855f7',
            fontStyle: 'bold'
        });
        this.detailPanel.add(legendTitle);

        const legendText = this.add.text(panelX + 16, mapOffsetY + 350,
            `🟩 Plains / Forest / Meadows\n` +
            `⬜ Paved Causeways & Roads\n` +
            `⬛ Basalt Floor / Magma Rims\n` +
            `🟦 Oceans, Rivers & Bridges\n` +
            `🟨 Sandbars & Coastal Shallows`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#94a3b8',
            lineSpacing: 3
        });
        this.detailPanel.add(legendText);

        // Bottom Invariant Tip Banner (Width 905px)
        const tipBox = this.add.graphics();
        tipBox.fillStyle(0x1a1a3a, 0.7);
        tipBox.fillRoundedRect(0, 530, 905, 50, 6);
        tipBox.lineStyle(1, 0x24244c, 0.9);
        tipBox.strokeRoundedRect(0, 530, 905, 50, 6);
        this.detailPanel.add(tipBox);

        const tipText = this.add.text(14, 538, 
            '🌐 Toroidal Topology: Traveling across any world border wraps seamlessly to opposite edge.\n' +
            '🚀 Crater Basin features open causeways in all 4 cardinal directions connecting all continents.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
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
