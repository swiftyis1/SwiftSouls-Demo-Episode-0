import Phaser from 'phaser';
import { GameManager } from '../systems/GameManager';
import { SoundSynth } from '../systems/SoundSynth';
import { CloudSyncClient } from '../systems/CloudSyncClient';
import { UserAuthManager } from '../systems/UserAuthManager';
import { LicenseManager } from '../systems/LicenseManager';
import { LiveOpsManager } from '../systems/LiveOpsManager';
import { AccessibilityManager } from '../systems/AccessibilityManager';
import { LayeredCharacterRenderer } from '../systems/LayeredCharacterRenderer';

export class TitleScene extends Phaser.Scene {
    private selectedOption: number = 0;
    private menuOptions: string[] = ['New Game', 'Load Game', 'Credits'];
    private optionTexts: Phaser.GameObjects.Text[] = [];
    private returnToSlotsOnInit: boolean = false;
    private keys!: {
        UP: Phaser.Input.Keyboard.Key;
        DOWN: Phaser.Input.Keyboard.Key;
        LEFT: Phaser.Input.Keyboard.Key;
        RIGHT: Phaser.Input.Keyboard.Key;
        ENTER: Phaser.Input.Keyboard.Key;
        SPACE: Phaser.Input.Keyboard.Key;
        ESC: Phaser.Input.Keyboard.Key;
    };
    private hasSave: boolean = false;

    // Custom in-app hero naming state
    private isNaming: boolean = false;
    private namingInput: string = 'Swift';
    private namingContainer!: Phaser.GameObjects.Container;
    private namingText!: Phaser.GameObjects.Text;
    private namingGenderSubtitle!: Phaser.GameObjects.Text;
    private mobileInputEl: HTMLInputElement | null = null;
    private randomNameIdx: number = 0;
    private readonly MALE_NAMES = ['Swift', 'Valen', 'Zephyr', 'Ignis', 'Kaelen', 'Orion', 'Rowan', 'Darius', 'Altair', 'Caelum'];
    private readonly FEMALE_NAMES = ['Cora', 'Aria', 'Lyra', 'Selene', 'Elysia', 'Astrid', 'Nova', 'Vespera', 'Kallisto', 'Seraphina'];

    // 16 Save Slots UI state
    private isSelectingSlot: boolean = false;
    private slotSelectMode: 'new' | 'load' = 'new';
    private activeSlotIdx: number = 0;
    private slotContainer!: Phaser.GameObjects.Container;
    private slotCardTexts: Phaser.GameObjects.Container[] = [];

    // Sprint 24: Safe Save Deletion Modal state
    private isDeletingSlot: boolean = false;
    private deletingSlotNum: number = 1;
    private deleteInput: string = '';
    private deleteModalContainer?: Phaser.GameObjects.Container;
    private deleteInputText?: Phaser.GameObjects.Text;

    // Sprint 28: Gender Selection Modal state
    private isSelectingGender: boolean = false;
    private selectedGenderIdx: number = 0; // 0 = male (Valen), 1 = female (Cora)
    private genderModalContainer?: Phaser.GameObjects.Container;

    // Cloud Sync telemetry UI
    private cloudBadgeContainer!: Phaser.GameObjects.Container;
    private cloudStatusText!: Phaser.GameObjects.Text;
    private cloudSubText!: Phaser.GameObjects.Text;
    private cloudUnsubscribe?: () => void;

    // Sprint 21: Auth, Licensing & Admin UI state
    private authBadgeContainer!: Phaser.GameObjects.Container;
    private licenseBadgeContainer!: Phaser.GameObjects.Container;
    private adminBadgeContainer!: Phaser.GameObjects.Container;
    private activeModalContainer?: Phaser.GameObjects.Container;
    private toastContainer: Phaser.GameObjects.Container | null = null;
    private authUnsubscribe?: () => void;
    private tierUnsubscribe?: () => void;

    constructor() {
        super('TitleScene');
    }

    init(data?: { returnToSlots?: boolean }) {
        this.returnToSlotsOnInit = data?.returnToSlots || false;
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // One-time cleanup: Purge legacy pre-seeded mock saves (Swift, Melodie, Antigravity) from early dev
        if (typeof localStorage !== 'undefined' && !localStorage.getItem('swiftsouls_mock_saves_purged')) {
            localStorage.setItem('swiftsouls_mock_saves_purged', 'true');
            for (let i = 1; i <= 3; i++) {
                const raw = localStorage.getItem('swiftsouls_save_' + i);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        const payload = parsed.payload ? JSON.parse(parsed.payload) : parsed;
                        const heroName = payload.party?.[0]?.name;
                        if (heroName === 'Swift' || heroName === 'Melodie' || heroName === 'Antigravity') {
                            localStorage.removeItem('swiftsouls_save_' + i);
                            localStorage.removeItem('swiftsouls_cloud_save_' + i);
                        }
                    } catch {}
                }
            }
        }
        this.hasSave = GameManager.instance.hasAnySave();

        // 1. Draw procedural background gradient
        const bgGraphics = this.add.graphics();
        bgGraphics.fillGradientStyle(0x0f0f1b, 0x0f0f1b, 0x1a1a3a, 0x1a1a3a, 1);
        bgGraphics.fillRect(0, 0, width, height);

        // Subtle glowing particles in the background
        const particles = this.add.graphics();
        for (let i = 0; i < 40; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const radius = Phaser.Math.FloatBetween(1, 3);
            particles.fillStyle(0x00ffcc, Phaser.Math.FloatBetween(0.2, 0.6));
            particles.fillCircle(x, y, radius);
        }

        // 2. Game Title (Composite layout replacing 'T' with Melodie's handcrafted swords)
        const titleStyle = {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '90px',
            color: '#00ffcc',
            fontStyle: 'bold'
        };

        const text1 = this.add.text(0, 0, 'SWIF', titleStyle);
        text1.setOrigin(0, 0.5);

        // Melodie's 3 swords: Winged Demonic, Silver Knight, Bronze Adventurer
        const swordKeys = ['sword_winged', 'sword_silver', 'sword_bronze'];
        let currentSwordIndex = 0;

        const sword = this.add.image(0, 0, swordKeys[currentSwordIndex]);
        sword.setScale(90 / 64 * 1.15);
        sword.setOrigin(0.5, 0.5);
        sword.setInteractive({ useHandCursor: true });

        // Hover & click interaction to cycle through Melodie's swords
        sword.on('pointerover', () => {
            sword.setScale((90 / 64 * 1.15) * 1.12);
        });
        sword.on('pointerout', () => {
            sword.setScale(90 / 64 * 1.15);
        });
        sword.on('pointerdown', () => {
            currentSwordIndex = (currentSwordIndex + 1) % swordKeys.length;
            sword.setTexture(swordKeys[currentSwordIndex]);
            SoundSynth.playSlash();
            this.tweens.add({
                targets: sword,
                scaleX: (90 / 64 * 1.15) * 1.3,
                scaleY: (90 / 64 * 1.15) * 1.3,
                duration: 120,
                yoyo: true,
                ease: 'Back.easeOut'
            });
        });

        const text2 = this.add.text(0, 0, ' SOULS', titleStyle);
        text2.setOrigin(0, 0.5);

        // Compute layout dimensions for centering
        const w1 = text1.width;
        const swordSpacing = 56;
        const w2 = text2.width;
        
        const totalWidth = w1 + swordSpacing + w2;
        const startX = -totalWidth / 2;

        text1.setX(startX);
        sword.setX(startX + w1 + 22);
        sword.setY(8); // Offset to align crossguard
        text2.setX(startX + w1 + swordSpacing);

        const titleContainer = this.add.container(width / 2, height / 3);
        titleContainer.add([text1, sword, text2]);
        
        // Add a subtle title pulse animation to the entire container
        this.tweens.add({
            targets: titleContainer,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Melodie's Hero Map Sprite Showcase standing proudly on title screen
        const heroShowcase = this.add.sprite(width / 2 - 280, height / 2 + 140, 'player');
        heroShowcase.setScale(2.2);
        heroShowcase.setDepth(5);
        this.tweens.add({
            targets: heroShowcase,
            y: heroShowcase.y - 10,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const subtitleText = this.add.text(width / 2, height / 3 + 100, 'A Web Phaser JRPG', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '32px',
            color: '#8899b3',
            align: 'center'
        });
        subtitleText.setOrigin(0.5, 0.5);

        // 3. Menu Options
        const startY = height / 2 + 80;
        this.menuOptions.forEach((option, index) => {
            const isLoad = index === 1;
            const isCredits = index === 2;
            const disabled = isLoad && !this.hasSave;
            const color = disabled ? '#555555' : (isCredits ? '#e0c068' : '#ffffff');
            
            const text = this.add.text(width / 2, startY + index * 68, option, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '38px',
                color: color
            });
            text.setOrigin(0.5, 0.5);
            text.setInteractive({ useHandCursor: !disabled });
            
            text.on('pointerover', () => {
                if (!disabled) {
                    this.selectOption(index);
                }
            });

            text.on('pointerdown', () => {
                if (!disabled) {
                    this.selectOption(index);
                    this.executeSelection();
                }
            });

            this.optionTexts.push(text);
        });

        // Keyboard inputs
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

        // Initialize selection visual state
        this.selectOption(0);

        // Help text at bottom
        const helpText = this.add.text(width / 2, height - 50, 'ARROWS: select  •  ENTER: confirm  •  [C] Credits  •  [G] Sign In  •  [U] Upgrade  •  [L] License', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#556688'
        });
        helpText.setOrigin(0.5, 0.5);

        // Play title music (Soliloquy)
        if (!this.sound.get('title_music')) {
            this.sound.play('title_music', { loop: true, volume: 0.4 });
        } else if (!this.sound.get('title_music').isPlaying) {
            const musicInstance = this.sound.get('title_music');
            if (musicInstance && 'play' in musicInstance) {
                (musicInstance as Phaser.Sound.BaseSound).play();
            }
        }

        // Initialize custom in-app naming UI
        this.createNamingUI(width, height);

        // Initialize 16 save slots selection UI
        this.createSlotSelectionUI(width, height);

        // Sprint 24: Initialize Safe Save Deletion Modal
        this.createDeleteConfirmationModal(width, height);

        // Initialize Cloud Sync status badge
        this.createCloudBadge(width);

        // Initialize Account, License & Admin badges
        this.createAuthAndLicenseBadges(width);

        // Clean up mobile input on scene shutdown
        this.events.on('shutdown', () => {
            if (this.mobileInputEl && this.mobileInputEl.parentNode) {
                this.mobileInputEl.parentNode.removeChild(this.mobileInputEl);
                this.mobileInputEl = null;
            }
        });

        // Check if launched with direct save slot or load query parameter
        if (typeof window !== 'undefined') {
            const search = window.location.search;
            const params = new URLSearchParams(search);
            if (params.get('load') || params.get('slots') || params.get('saves') || params.get('new')) {
                const isNewMode = params.get('new') !== null;
                this.time.delayedCall(120, () => {
                    this.isSelectingSlot = true;
                    this.slotSelectMode = isNewMode ? 'new' : 'load';
                    this.activeSlotIdx = 0;
                    this.refreshSlotPreviews();
                    this.slotContainer.setVisible(true);
                    this.optionTexts.forEach(t => t.disableInteractive());
                });
            }
        }

        // Naming input handler and WASD menu navigation
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
                if (this.isDeletingSlot) {
                    this.handleDeleteModalInput(event);
                    return;
                }
                if (this.isNaming) {
                    this.handleNamingInput(event);
                    return;
                }
            });

            // Delete key to trigger safe slot deletion
            this.input.keyboard.on('keydown-DELETE', () => {
                if (this.isNaming || this.isDeletingSlot) return;
                if (this.isSelectingSlot) {
                    const slotNum = this.activeSlotIdx + 1;
                    const preview = GameManager.instance.getSlotPreview(slotNum);
                    if (preview) {
                        this.openDeleteSlotConfirmation(slotNum);
                    }
                }
            });

            // WASD alternative controls
            this.input.keyboard.on('keydown-W', () => {
                if (this.isNaming) return;
                if (this.isSelectingSlot) {
                    this.navigateSlots(0, -1);
                } else {
                    this.navigateMenu(-1);
                }
            });
            this.input.keyboard.on('keydown-S', () => {
                if (this.isNaming) return;
                if (this.isSelectingSlot) {
                    this.navigateSlots(0, 1);
                } else {
                    this.navigateMenu(1);
                }
            });
            this.input.keyboard.on('keydown-A', () => {
                if (!this.isNaming && this.isSelectingSlot) {
                    this.navigateSlots(-1, 0);
                }
            });
            this.input.keyboard.on('keydown-D', () => {
                if (!this.isNaming && this.isSelectingSlot) {
                    this.navigateSlots(1, 0);
                }
            });

            // Shortcut 'C': View Credits Crawl
            this.input.keyboard.on('keydown-C', () => {
                if (this.isNaming || this.activeModalContainer) return;
                this.openCredits(this.isSelectingSlot);
            });

            // Shortcut 'G': Account / Sign In Modal
            this.input.keyboard.on('keydown-G', () => {
                if (this.isNaming || this.activeModalContainer) return;
                this.openAuthModal(width, height);
            });

            // Shortcut 'U': Commercial Upgrade Modal
            this.input.keyboard.on('keydown-U', () => {
                if (this.isNaming || this.activeModalContainer) return;
                this.openUpgradeModal(width, height);
            });

            // Shortcut 'L': EULA & License Viewer Modal
            this.input.keyboard.on('keydown-L', () => {
                if (this.isNaming || this.activeModalContainer) return;
                this.openEulaModal(width, height);
            });

            // Shortcut 'Ctrl+Shift+A': Admin Dashboard
            this.input.keyboard.on('keydown-A', (event: KeyboardEvent) => {
                if (this.isNaming) return;
                if (event.ctrlKey && event.shiftKey) {
                    this.openAdminDashboard();
                }
            });
        }

        // Gamepad controller support for Title screen
        if (this.input.gamepad) {
            this.input.gamepad.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
                if (this.isNaming) {
                    if (button.index === 0) { // A button to confirm name
                        let inputVal = this.namingText.text;
                        if (inputVal.endsWith('_')) {
                            inputVal = inputVal.slice(0, -1);
                        }
                        this.confirmNaming(inputVal);
                    }
                    return;
                }
                
                if (this.isSelectingSlot) {
                    if (button.index === 12 || button.index === 11) { // D-pad Up or left stick Y up
                        this.navigateSlots(0, -1);
                    } else if (button.index === 13 || button.index === 10) { // D-pad Down or left stick Y down
                        this.navigateSlots(0, 1);
                    } else if (button.index === 14) { // D-pad Left or left stick X left
                        this.navigateSlots(-1, 0);
                    } else if (button.index === 15) { // D-pad Right or left stick X right
                        this.navigateSlots(1, 0);
                    } else if (button.index === 0) { // A button (Confirm slot)
                        this.executeSlotSelection();
                    } else if (button.index === 1) { // B button (Cancel)
                        this.cancelSlotSelection();
                    }
                    return;
                }

                // D-pad Up/Down or Left Stick Y axis Up/Down (indexes 12 and 13 respectively)
                if (button.index === 12 || button.index === 11) { // D-pad Up or left stick Y up
                    this.navigateMenu(-1);
                } else if (button.index === 13 || button.index === 10) { // D-pad Down or left stick Y down
                    this.navigateMenu(1);
                } else if (button.index === 0) { // A button
                    this.executeSelection();
                }
            });
        }

        // Re-open slot selection if returning from Credits
        if (this.returnToSlotsOnInit) {
            this.isSelectingSlot = true;
            this.slotSelectMode = 'load';
            this.activeSlotIdx = 0;
            this.refreshSlotPreviews();
            this.slotContainer.setVisible(true);
            this.optionTexts.forEach(t => t.disableInteractive());
            this.returnToSlotsOnInit = false;
        }
    }

    private setupMobileInput() {
        if (typeof document === 'undefined') return;
        if (this.mobileInputEl) return;

        const el = document.createElement('input');
        el.type = 'text';
        el.id = 'swiftsouls-hero-name-input';
        el.maxLength = 12;
        el.autocomplete = 'off';
        el.setAttribute('autocorrect', 'off');
        el.setAttribute('autocapitalize', 'words');
        el.spellcheck = false;
        
        // Position transparently in DOM so mobile browser OS keyboard opens smoothly
        Object.assign(el.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '280px',
            height: '48px',
            opacity: '0.01',
            zIndex: '99999',
            fontSize: '16px',
            display: 'none',
            pointerEvents: 'auto'
        });

        el.addEventListener('input', () => {
            if (!this.isNaming) return;
            const filtered = el.value.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 12);
            this.namingInput = filtered;
            this.updateNamingText();
        });

        el.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!this.isNaming) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                this.confirmNaming(this.namingInput);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelNaming();
            }
        });

        document.body.appendChild(el);
        this.mobileInputEl = el;
    }

    private openNamingPrompt(gender: 'male' | 'female') {
        this.isNaming = true;
        this.namingInput = gender === 'female' ? 'Cora' : 'Swift';
        this.randomNameIdx = 0;

        if (this.namingGenderSubtitle) {
            const isFemale = gender === 'female';
            this.namingGenderSubtitle.setText(isFemale ? '👑 CORA SWIFT — Female Protagonist' : '⚔️ VALEN SWIFT — Male Protagonist');
            this.namingGenderSubtitle.setColor(isFemale ? '#ffaadd' : '#88ccff');
        }

        this.updateNamingText();
        this.namingContainer.setVisible(true);

        this.setupMobileInput();
        if (this.mobileInputEl) {
            this.mobileInputEl.value = this.namingInput;
            this.mobileInputEl.style.display = 'block';
            setTimeout(() => {
                try {
                    this.mobileInputEl?.focus();
                } catch {}
            }, 60);
        }
    }

    private cycleRandomName() {
        const gender = GameManager.instance.getPlayerGender();
        const pool = gender === 'female' ? this.FEMALE_NAMES : this.MALE_NAMES;
        this.randomNameIdx = (this.randomNameIdx + 1) % pool.length;
        this.namingInput = pool[this.randomNameIdx];
        this.updateNamingText();
        SoundSynth.playMenuBlip();
        if (this.mobileInputEl) {
            this.mobileInputEl.value = this.namingInput;
        }
    }

    private resetDefaultName() {
        const gender = GameManager.instance.getPlayerGender();
        this.namingInput = gender === 'female' ? 'Cora' : 'Swift';
        this.updateNamingText();
        SoundSynth.playMenuBlip();
        if (this.mobileInputEl) {
            this.mobileInputEl.value = this.namingInput;
        }
    }

    private createNamingUI(width: number, height: number) {
        this.namingContainer = this.add.container(width / 2, height / 2);
        this.namingContainer.setDepth(400);
        this.namingContainer.setVisible(false);

        // Dark modal backdrop
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.75);
        overlay.fillRect(-width / 2, -height / 2, width, height);
        overlay.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);

        // Card background graphics
        const cardWidth = 740;
        const cardHeight = 420;
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x0a0c1a, 0.98);
        cardBg.lineStyle(4, 0x00f0ff, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        cardBg.lineStyle(1.5, 0xffcc00, 0.7);
        cardBg.strokeRoundedRect(-cardWidth / 2 - 4, -cardHeight / 2 - 4, cardWidth + 8, cardHeight + 8, 20);

        // Naming prompt title
        const promptTitle = this.add.text(0, -cardHeight / 2 + 38, 'NAME THY HERO', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '34px',
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        // Gender Subtitle Header
        this.namingGenderSubtitle = this.add.text(0, -cardHeight / 2 + 76, '⚔️ VALEN SWIFT — Male Protagonist', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#88ccff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        // Text box container & interactive touch trigger
        const textBoxWidth = 360;
        const textBoxHeight = 58;
        const textBoxX = -130;
        const textBoxY = -48;

        const textBoxBg = this.add.graphics();
        textBoxBg.fillStyle(0x050612, 1);
        textBoxBg.lineStyle(2.5, 0x00f0ff, 1);
        textBoxBg.fillRoundedRect(textBoxX - textBoxWidth / 2, textBoxY - textBoxHeight / 2, textBoxWidth, textBoxHeight, 8);
        textBoxBg.strokeRoundedRect(textBoxX - textBoxWidth / 2, textBoxY - textBoxHeight / 2, textBoxWidth, textBoxHeight, 8);

        // Text entry display
        this.namingText = this.add.text(textBoxX, textBoxY, 'Swift_', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '32px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        // Touch zone for text box to summon mobile keyboard
        const textBoxTouchZone = this.add.zone(textBoxX, textBoxY, textBoxWidth, textBoxHeight);
        textBoxTouchZone.setInteractive({ useHandCursor: true });
        textBoxTouchZone.on('pointerdown', () => {
            SoundSynth.playMenuBlip();
            if (this.mobileInputEl) {
                this.mobileInputEl.value = this.namingInput;
                this.mobileInputEl.style.display = 'block';
                this.mobileInputEl.focus();
            }
        });

        // ⌫ Backspace Button (Touch Friendly)
        const delBtn = this.createModalButton(110, textBoxY, '⌫ DEL', 0x221833, () => {
            if (this.namingInput.length > 0) {
                this.namingInput = this.namingInput.slice(0, -1);
                this.updateNamingText();
                SoundSynth.playMenuBlip();
                if (this.mobileInputEl) this.mobileInputEl.value = this.namingInput;
            }
        }, 90, 56, '#cc99ff', 0x8844cc);

        // ✕ Clear Button (Touch Friendly)
        const clrBtn = this.createModalButton(210, textBoxY, '✕ CLR', 0x331822, () => {
            this.namingInput = '';
            this.updateNamingText();
            SoundSynth.playMenuBlip();
            if (this.mobileInputEl) this.mobileInputEl.value = '';
        }, 90, 56, '#ff8899', 0xcc4466);

        // Row 2: Name Preset Buttons
        // 🎲 Random Name
        const randomBtn = this.createModalButton(-130, 24, '🎲 RANDOM NAME', 0x142036, () => {
            this.cycleRandomName();
        }, 220, 44, '#66ccff', 0x2277bb);

        // ↺ Default Name
        const defaultBtn = this.createModalButton(130, 24, '↺ DEFAULT NAME', 0x182420, () => {
            this.resetDefaultName();
        }, 220, 44, '#66ffaa', 0x229966);

        // Row 3: Primary Action Buttons
        // ← Back Button
        const backBtn = this.createModalButton(-200, 102, '← BACK', 0x24141c, () => {
            this.cancelNaming();
        }, 160, 52, '#ff99aa', 0xaa3344);

        // ⚔️ Start Adventure Button (Touch / Click to Start!)
        const startBtn = this.createModalButton(100, 102, '⚔️ START ADVENTURE', 0x0c3826, () => {
            this.confirmNaming(this.namingInput);
        }, 380, 52, '#00ffcc', 0x00cc88, '18px');

        // Footer Help Text
        const promptHelp = this.add.text(0, cardHeight / 2 - 25, '📱 Tap box or type  •  ENTER / [A] to Confirm  •  ESC / [B] to Cancel', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#6688aa'
        }).setOrigin(0.5, 0.5);

        this.namingContainer.add([
            overlay,
            cardBg,
            promptTitle,
            this.namingGenderSubtitle,
            textBoxBg,
            this.namingText,
            textBoxTouchZone,
            delBtn,
            clrBtn,
            randomBtn,
            defaultBtn,
            backBtn,
            startBtn,
            promptHelp
        ]);

        // Blinking cursor event loop
        this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                if (this.isNaming) {
                    const currentText = this.namingText.text;
                    if (currentText.endsWith('_')) {
                        this.namingText.setText(currentText.slice(0, -1));
                    } else {
                        this.namingText.setText(currentText + '_');
                    }
                }
            }
        });
    }

    private handleNamingInput(event: KeyboardEvent) {
        // Strip trailing blink character before processing
        let inputVal = this.namingText.text;
        if (inputVal.endsWith('_')) {
            inputVal = inputVal.slice(0, -1);
        }

        if (event.key === 'Enter') {
            this.confirmNaming(inputVal);
        } else if (event.key === 'Escape') {
            this.cancelNaming();
        } else if (event.key === 'Backspace') {
            this.namingInput = this.namingInput.slice(0, -1);
            this.updateNamingText();
            if (this.mobileInputEl) this.mobileInputEl.value = this.namingInput;
        } else if (event.key.length === 1 && /^[a-zA-Z0-9 ]$/.test(event.key)) {
            if (this.namingInput.length < 12) {
                this.namingInput += event.key;
                this.updateNamingText();
                if (this.mobileInputEl) this.mobileInputEl.value = this.namingInput;
            }
        }
    }

    private updateNamingText() {
        this.namingText.setText(this.namingInput + '_');
    }

    private confirmNaming(name: string) {
        if (this.mobileInputEl) {
            this.mobileInputEl.blur();
            this.mobileInputEl.style.display = 'none';
        }
        const chosenGender = GameManager.instance.getPlayerGender();
        const defaultName = chosenGender === 'female' ? 'Cora' : 'Swift';
        const finalName = name.trim() || defaultName;
        SoundSynth.playMenuSelect();

        // Stop title music
        const music = this.sound.get('title_music');
        if (music) {
            music.stop();
        }

        // Sprint 28: Capture gender BEFORE resetGame() wipes state, then restore it immediately after.
        // resetGame() rebuilds this.state from scratch (defaulting to 'male'), so without this capture
        // Cora Swift would always start the game with Valen's male sprite.
        GameManager.instance.resetGame();
        GameManager.instance.setPlayerGender(chosenGender);
        GameManager.instance.setHeroName(finalName);
        this.scene.start('IntroScene');
    }

    private cancelNaming() {
        if (this.mobileInputEl) {
            this.mobileInputEl.blur();
            this.mobileInputEl.style.display = 'none';
        }
        SoundSynth.playMenuCancel();
        this.isNaming = false;
        this.namingContainer.setVisible(false);
        
        // Return to gender modal if available, or slot selection
        if (this.genderModalContainer) {
            this.isSelectingGender = true;
            this.genderModalContainer.setVisible(true);
            this.refreshGenderHighlight();
        } else {
            this.slotContainer.setVisible(true);
        }
    }

    private navigateMenu(direction: number) {
        let next = this.selectedOption + direction;
        if (next < 0) next = this.menuOptions.length - 1;
        if (next >= this.menuOptions.length) next = 0;
        
        // Skip load game if there's no save
        if (next === 1 && !this.hasSave) {
            next = 0;
        }
        SoundSynth.playMenuBlip();
        this.selectOption(next);
    }

    update() {
        if (this.isNaming) return;
        if (!this.keys) return;

        // Sprint 28: Gender selection keyboard nav
        if (this.isSelectingGender) {
            if (Phaser.Input.Keyboard.JustDown(this.keys.LEFT)) {
                this.selectedGenderIdx = 0;
                this.refreshGenderHighlight();
                SoundSynth.playMenuBlip();
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.RIGHT)) {
                this.selectedGenderIdx = 1;
                this.refreshGenderHighlight();
                SoundSynth.playMenuBlip();
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
                this.confirmGenderSelection();
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
                this.cancelGenderSelection();
            }
            return;
        }

        if (this.isSelectingSlot) {
            if (Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
                this.navigateSlots(0, -1);
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
                this.navigateSlots(0, 1);
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.LEFT)) {
                this.navigateSlots(-1, 0);
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.RIGHT)) {
                this.navigateSlots(1, 0);
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
                this.executeSlotSelection();
            } else if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
                this.cancelSlotSelection();
            }
            return;
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.UP)) {
            this.navigateMenu(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keys.DOWN)) {
            this.navigateMenu(1);
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
            this.executeSelection();
        }
    }

    private selectOption(index: number) {
        this.selectedOption = index;
        this.optionTexts.forEach((text, idx) => {
            const isLoad = idx === 1;
            const isCredits = idx === 2;
            const disabled = isLoad && !this.hasSave;
            if (idx === index) {
                text.setColor(isCredits ? '#ffd700' : '#00ffcc');
                text.setText(`> ${this.menuOptions[idx]} <`);
            } else {
                text.setColor(disabled ? '#555555' : (isCredits ? '#e0c068' : '#ffffff'));
                text.setText(this.menuOptions[idx]);
            }
        });
    }

    private executeSelection() {
        SoundSynth.playMenuSelect();
        if (this.selectedOption === 0) {
            // Open Slot Selection overlay in 'new' mode
            this.isSelectingSlot = true;
            this.slotSelectMode = 'new';
            this.activeSlotIdx = 0;
            this.refreshSlotPreviews();
            this.slotContainer.setVisible(true);
            this.optionTexts.forEach(t => t.disableInteractive());
        } else if (this.selectedOption === 1 && this.hasSave) {
            // Open Slot Selection overlay in 'load' mode
            this.isSelectingSlot = true;
            this.slotSelectMode = 'load';
            this.activeSlotIdx = 0;
            this.refreshSlotPreviews();
            this.slotContainer.setVisible(true);
            this.optionTexts.forEach(t => t.disableInteractive());
        } else if (this.selectedOption === 2) {
            // Open Credits Crawl Scene
            this.openCredits(false);
        }
    }

    private openCredits(fromSlots: boolean = false) {
        SoundSynth.playMenuSelect();
        this.scene.start('CreditsScene', { returnScene: 'TitleScene', returnToSlots: fromSlots });
    }

    private createSlotSelectionUI(width: number, height: number) {
        this.slotContainer = this.add.container(width / 2, height / 2);
        this.slotContainer.setDepth(300);
        this.slotContainer.setVisible(false);

        // Draw translucent backing card
        const cardWidth = 980;
        const cardHeight = 620;
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x0a0a16, 0.96);
        cardBg.lineStyle(4, 0xff00ff, 1); // Neon magenta border
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
        cardBg.lineStyle(1.5, 0x00ffcc, 0.6);
        cardBg.strokeRoundedRect(-cardWidth / 2 - 6, -cardHeight / 2 - 6, cardWidth + 12, cardHeight + 12, 22);

        // Title text
        const titleText = this.add.text(0, -cardHeight / 2 + 40, 'SELECT SAVE SLOT', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '36px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        this.slotContainer.add([cardBg, titleText]);

        // Draw 4x4 Grid of slots
        const startX = -cardWidth / 2 + 75;
        const startY = -cardHeight / 2 + 100;
        const colSpacing = 215;
        const rowSpacing = 115;

        this.slotCardTexts = [];

        for (let i = 0; i < 16; i++) {
            const row = Math.floor(i / 4);
            const col = i % 4;
            const x = startX + col * colSpacing;
            const y = startY + row * rowSpacing;

            const slotNum = i + 1;
            const preview = GameManager.instance.getSlotPreview(slotNum);

            // Container for individual slot
            const slotBox = this.add.container(x, y);

            // Box Graphics
            const boxG = this.add.graphics();
            boxG.fillStyle(0x111126, 0.9);
            boxG.lineStyle(2, 0x333366, 1);
            boxG.fillRoundedRect(0, 0, 195, 95, 8);
            boxG.strokeRoundedRect(0, 0, 195, 95, 8);
            slotBox.add(boxG);

            // Text info
            let infoText = '';
            let textColor = '#556688';
            if (preview) {
                if (preview.isTampered) {
                    infoText = `Slot ${slotNum}  [BLOCKED]\n[TAMPERED DATA]\nBAD SIGNATURE`;
                    textColor = '#ff3344';
                } else {
                    let mapName = (preview.mapId || 'meteor_pod').replace('_', ' ').toUpperCase();
                    if (mapName.length > 11) mapName = mapName.substring(0, 10) + '…';
                    const timeStr = GameManager.instance.getFormattedTimePlayed(preview.timePlayedSeconds || 0);
                    const frags = preview.totalFragments || 0;
                    infoText = `Slot ${slotNum}  ${preview.name}\nLv.${preview.level} ${mapName}\n⏱ ${timeStr}\n🔮 ${frags}/1530`;
                    textColor = '#ffffff';
                }
            } else {
                infoText = `Slot ${slotNum}\n[EMPTY SLOT]\nReady for Hero`;
            }

            const txt = this.add.text(10, 8, infoText, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '13px',
                color: textColor,
                lineSpacing: 3
            });
            slotBox.add(txt);

            // Delete button on slot card (top-right)
            const delBtn = this.add.container(174, 16);
            const delBg = this.add.graphics();
            delBg.fillStyle(0x331118, 0.9);
            delBg.lineStyle(1, 0xff3344, 0.8);
            delBg.fillCircle(0, 0, 10);
            delBg.strokeCircle(0, 0, 10);
            const delLabel = this.add.text(0, 0, '✕', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '12px',
                color: '#ff6677',
                fontStyle: 'bold'
            }).setOrigin(0.5, 0.5);
            delBtn.add([delBg, delLabel]);
            delBtn.setSize(20, 20);
            delBtn.setInteractive(new Phaser.Geom.Circle(0, 0, 10), Phaser.Geom.Circle.Contains);
            delBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                if (pointer && pointer.event) pointer.event.stopPropagation();
                this.openDeleteSlotConfirmation(slotNum);
            });
            delBtn.setVisible(preview !== null);
            slotBox.add(delBtn);

            // Layered Character Preview Sprite (Miniature Hero Display on right side of card)
            const layeredRenderer = new LayeredCharacterRenderer(this, 155, 55, {
                scale: 0.42,
                animateCape: true,
                equippedCrystals: preview && !preview.isTampered ? preview.equippedCrystals : {}
            });
            layeredRenderer.setVisible(preview !== null && !preview.isTampered);
            slotBox.add(layeredRenderer);

            // Make slotBox clickable for mouse/touch navigation
            slotBox.setSize(195, 95);
            slotBox.setInteractive(new Phaser.Geom.Rectangle(0, 0, 195, 95), Phaser.Geom.Rectangle.Contains);
            slotBox.on('pointerdown', () => {
                this.activeSlotIdx = i;
                this.updateSlotSelectionVisuals();
                this.executeSlotSelection();
            });

            this.slotContainer.add(slotBox);
            
            (slotBox as any).boxG = boxG;
            (slotBox as any).preview = preview;
            (slotBox as any).delBtn = delBtn;
            (slotBox as any).layeredRenderer = layeredRenderer;
            this.slotCardTexts.push(slotBox as any);
        }

        // Help footer
        const helpText = this.add.text(-80, cardHeight / 2 - 30, 'ARROWS: Navigate | ENTER / CLICK: Confirm | DEL: Delete Slot | ESC: Cancel', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#8899b3'
        }).setOrigin(0.5, 0.5);
        this.slotContainer.add(helpText);

        // Credits button at bottom right of slot menu
        const creditsBtn = this.add.container(cardWidth / 2 - 130, cardHeight / 2 - 30);
        const credBg = this.add.graphics();
        credBg.fillStyle(0x1a2238, 0.95);
        credBg.lineStyle(1.5, 0xffd700, 0.8);
        credBg.fillRoundedRect(-80, -18, 160, 36, 8);
        credBg.strokeRoundedRect(-80, -18, 160, 36, 8);
        creditsBtn.add(credBg);

        const credLabel = this.add.text(0, 0, '📜 CREDITS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        creditsBtn.add(credLabel);

        creditsBtn.setInteractive(new Phaser.Geom.Rectangle(-80, -18, 160, 36), Phaser.Geom.Rectangle.Contains);
        creditsBtn.on('pointerover', () => {
            credBg.clear();
            credBg.fillStyle(0xffd700, 0.25);
            credBg.lineStyle(2, 0xffd700, 1);
            credBg.fillRoundedRect(-80, -18, 160, 36, 8);
            credBg.strokeRoundedRect(-80, -18, 160, 36, 8);
            credLabel.setColor('#ffffff');
        });
        creditsBtn.on('pointerout', () => {
            credBg.clear();
            credBg.fillStyle(0x1a2238, 0.95);
            credBg.lineStyle(1.5, 0xffd700, 0.8);
            credBg.fillRoundedRect(-80, -18, 160, 36, 8);
            credBg.strokeRoundedRect(-80, -18, 160, 36, 8);
            credLabel.setColor('#ffd700');
        });
        creditsBtn.on('pointerdown', () => {
            this.openCredits(true);
        });
        this.slotContainer.add(creditsBtn);
    }

    private navigateSlots(dirX: number, dirY: number) {
        let current = this.activeSlotIdx;
        let col = current % 4;
        let row = Math.floor(current / 4);

        col = (col + dirX + 4) % 4;
        row = (row + dirY + 4) % 4;

        this.activeSlotIdx = row * 4 + col;
        SoundSynth.playMenuBlip();
        this.updateSlotSelectionVisuals();
    }

    private refreshSlotPreviews() {
        this.slotCardTexts.forEach((slotBox: any, i) => {
            const slotNum = i + 1;
            const preview = GameManager.instance.getSlotPreview(slotNum);
            slotBox.preview = preview;
            const txt = slotBox.list.find((obj: any) => obj.type === 'Text') as Phaser.GameObjects.Text;
            if (txt) {
                let infoText = '';
                let textColor = '#556688';
                if (preview) {
                    if (preview.isTampered) {
                        infoText = `Slot ${slotNum}  [BLOCKED]\n[TAMPERED DATA]\nBAD SIGNATURE`;
                        textColor = '#ff3344';
                    } else {
                        let mapName = (preview.mapId || 'meteor_pod').replace('_', ' ').toUpperCase();
                        if (mapName.length > 11) mapName = mapName.substring(0, 10) + '…';
                        const timeStr = GameManager.instance.getFormattedTimePlayed(preview.timePlayedSeconds || 0);
                        const frags = preview.totalFragments || 0;
                        // Sprint 28: Gender icon ♂ / ♀
                        const genderIcon = preview.playerGender === 'female' ? '♀ Cora' : '♂ Valen';
                        infoText = `Slot ${slotNum}  ${preview.name}\n${genderIcon}  Lv.${preview.level} ${mapName}\n⏱ ${timeStr}\n🔮 ${frags}/1530`;
                        textColor = '#ffffff';
                    }
                } else {
                    infoText = `Slot ${slotNum}\n[EMPTY SLOT]\nReady for Hero`;
                }
                txt.setText(infoText);
                txt.setColor(textColor);
            }
            if (slotBox.delBtn) {
                slotBox.delBtn.setVisible(preview !== null);
            }
            if (slotBox.layeredRenderer) {
                if (preview && !preview.isTampered) {
                    // Sprint 28: Pass gender so save card renders correct hero sprite
                    slotBox.layeredRenderer.updateLayers(preview.equippedCrystals || {}, preview.playerGender || 'male');
                    slotBox.layeredRenderer.setVisible(true);
                } else {
                    slotBox.layeredRenderer.setVisible(false);
                }
            }
        });
        this.updateSlotSelectionVisuals();
    }

    private updateSlotSelectionVisuals() {
        this.slotCardTexts.forEach((slotBox: any, idx) => {
            const boxG = slotBox.boxG as Phaser.GameObjects.Graphics;
            boxG.clear();
            
            const isFocused = idx === this.activeSlotIdx;
            const preview = slotBox.preview;
            const hasSave = preview !== null;
            const isTampered = preview && preview.isTampered;

            let strokeColor = 0x333366;
            if (isTampered) {
                strokeColor = 0xff2244; // Warning crimson
            } else if (isFocused) {
                strokeColor = 0x00ffcc; // Cyan focus
            } else if (hasSave) {
                strokeColor = 0xff00ff; // Magenta save
            }

            boxG.fillStyle(isFocused ? (isTampered ? 0x2b0d14 : 0x1a1a3a) : (isTampered ? 0x1c080d : 0x111126), 0.9);
            boxG.lineStyle(2, strokeColor, 1);
            boxG.fillRoundedRect(0, 0, 195, 95, 8);
            boxG.strokeRoundedRect(0, 0, 195, 95, 8);
        });
    }

    private cancelSlotSelection() {
        SoundSynth.playMenuCancel();
        this.isSelectingSlot = false;
        this.slotContainer.setVisible(false);
        
        // Re-enable Title option click interactivity
        this.optionTexts.forEach((text, index) => {
            const isLoad = index === 1;
            text.setInteractive({ useHandCursor: !(isLoad && !this.hasSave) });
        });
    }

    private executeSlotSelection() {
        const selectedSlot = this.activeSlotIdx + 1;
        
        if (this.slotSelectMode === 'load') {
            const preview = GameManager.instance.getSlotPreview(selectedSlot);
            if (!preview) {
                SoundSynth.playMenuCancel();
                // Shake camera for visual error feedback if slot is empty
                AccessibilityManager.shakeCamera(this.cameras.main, 200, 0.015);
                return;
            }
            if (preview.isTampered) {
                SoundSynth.playMenuCancel();
                AccessibilityManager.shakeCamera(this.cameras.main, 350, 0.025);
                return;
            }
            
            // Set current slot and load
            GameManager.instance.setCurrentSaveSlot(selectedSlot);
            const loadSuccess = GameManager.instance.loadGame();
            if (!loadSuccess) {
                SoundSynth.playMenuCancel();
                AccessibilityManager.shakeCamera(this.cameras.main, 350, 0.025);
                return;
            }

            SoundSynth.playMenuSelect();
            
            // Stop title music
            const music = this.sound.get('title_music');
            if (music) music.stop();
            
            const state = GameManager.instance.getState();
            this.scene.start(state.currentScene);
        } else {
            SoundSynth.playMenuSelect();
            // Mode is 'new': set slot, then show Gender Selection Modal (Sprint 28)
            GameManager.instance.setCurrentSaveSlot(selectedSlot);
            this.slotContainer.setVisible(false);

            // Show gender selection before naming
            this.openGenderModal();
        }
    }

    // ==========================================
    // SPRINT 28: GENDER SELECTION MODAL
    // ==========================================

    private openGenderModal() {
        this.isSelectingGender = true;
        this.selectedGenderIdx = 0;
        if (this.genderModalContainer) {
            this.genderModalContainer.setVisible(true);
            this.refreshGenderHighlight();
            return;
        }
        this.createGenderModal();
    }

    private createGenderModal() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const modal = this.add.container(width / 2, height / 2);
        modal.setDepth(300);
        this.genderModalContainer = modal;

        // Dim overlay
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.82);
        overlay.fillRect(-width / 2, -height / 2, width, height);
        overlay.setInteractive(
            new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
            Phaser.Geom.Rectangle.Contains
        );
        modal.add(overlay);

        // Card panel
        const cardW = 580;
        const cardH = 360;
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x0d1a2e, 0.98);
        cardBg.lineStyle(2, 0x00d4ff, 1);
        cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
        cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
        modal.add(cardBg);

        // Title
        const title = this.add.text(0, -cardH / 2 + 28, 'Choose Your Hero', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#00d4ff',
            align: 'center'
        }).setOrigin(0.5);
        modal.add(title);

        const subtitle = this.add.text(0, -cardH / 2 + 58, "Melodie's hand-drawn protagonists", {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#88aacc',
            align: 'center'
        }).setOrigin(0.5);
        modal.add(subtitle);

        // Hero data
        const heroes = [
            { name: 'Valen Swift', sub: 'Male Protagonist', key: 'player', color: 0x3377ff, borderColor: '#3377ff', labelColor: '#88ccff', gender: 'male' as const },
            { name: 'Cora Swift',  sub: 'Female Protagonist', key: 'player_female', color: 0xcc44aa, borderColor: '#cc44aa', labelColor: '#ffaadd', gender: 'female' as const }
        ];

        const cardSpacing = 250;
        const startX = -cardSpacing / 2 - 10;

        heroes.forEach((hero, i) => {
            const cx = startX + i * (cardSpacing + 20);
            const cy = 10;

            // Hero card bg
            const heroCard = this.add.graphics();
            heroCard.fillStyle(0x111c2e, 0.95);
            heroCard.lineStyle(2, hero.color, 1);
            heroCard.fillRoundedRect(cx - 100, cy - 110, 200, 220, 10);
            heroCard.strokeRoundedRect(cx - 100, cy - 110, 200, 220, 10);
            modal.add(heroCard);

            // Sprite preview
            const spriteKey = this.textures.exists(hero.key) ? hero.key : 'player';
            const sprite = this.add.image(cx, cy - 38, spriteKey);
            sprite.setScale(2.0);
            modal.add(sprite);

            // Hero name
            const nameText = this.add.text(cx, cy + 60, hero.name, {
                fontFamily: '"Press Start 2P", monospace',
                fontSize: '9px',
                color: hero.labelColor,
                align: 'center'
            }).setOrigin(0.5);
            modal.add(nameText);

            // Sub-label
            const subText = this.add.text(cx, cy + 82, hero.sub, {
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#88aacc',
                align: 'center'
            }).setOrigin(0.5);
            modal.add(subText);

            // Selection indicator (hidden by default)
            const selector = this.add.graphics();
            selector.lineStyle(3, hero.color, 1);
            selector.strokeRoundedRect(cx - 104, cy - 114, 208, 228, 12);
            selector.setName(`gender_selector_${i}`);
            selector.setVisible(i === 0);
            modal.add(selector);

            // Click handler
            const hitZone = this.add.zone(cx, cy, 208, 228);
            hitZone.setInteractive({ useHandCursor: true });
            hitZone.on('pointerdown', () => {
                this.selectedGenderIdx = i;
                this.refreshGenderHighlight();
                this.confirmGenderSelection();
            });
            hitZone.on('pointerover', () => {
                this.selectedGenderIdx = i;
                this.refreshGenderHighlight();
            });
            modal.add(hitZone);
        });

        // Bottom hint
        const hint = this.add.text(0, cardH / 2 - 28, '← → Navigate    ENTER Confirm    ESC Back', {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#557799',
            align: 'center'
        }).setOrigin(0.5);
        modal.add(hint);

        this.refreshGenderHighlight();
    }

    private refreshGenderHighlight() {
        if (!this.genderModalContainer) return;
        [0, 1].forEach(i => {
            const sel = this.genderModalContainer!.getByName(`gender_selector_${i}`) as Phaser.GameObjects.Graphics | null;
            if (sel) sel.setVisible(i === this.selectedGenderIdx);
        });
    }

    private confirmGenderSelection() {
        const gender = this.selectedGenderIdx === 1 ? 'female' : 'male';
        GameManager.instance.setPlayerGender(gender);
        SoundSynth.playMenuSelect();

        if (this.genderModalContainer) {
            this.genderModalContainer.setVisible(false);
        }
        this.isSelectingGender = false;

        // Proceed to hero naming with mobile touch support
        this.openNamingPrompt(gender);
    }

    private cancelGenderSelection() {
        SoundSynth.playMenuCancel();
        this.isSelectingGender = false;
        if (this.genderModalContainer) {
            this.genderModalContainer.setVisible(false);
        }
        // Return to slot selection
        this.slotContainer.setVisible(true);
    }

    // ==========================================
    // SPRINT 24: SAFE SAVE DELETION MODAL ENGINE
    // ==========================================

    private createDeleteConfirmationModal(width: number, height: number) {
        this.deleteModalContainer = this.add.container(width / 2, height / 2);
        this.deleteModalContainer.setDepth(600);
        this.deleteModalContainer.setVisible(false);

        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.85);
        overlay.fillRect(-width / 2, -height / 2, width, height);
        overlay.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);

        const cardWidth = 580;
        const cardHeight = 320;
        const cardBg = this.add.graphics();
        cardBg.fillStyle(0x180a12, 0.98);
        cardBg.lineStyle(3, 0xff2244, 1);
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14);
        cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14);

        const titleText = this.add.text(0, -cardHeight / 2 + 35, '⚠️ PERMANENT SAVE DELETION', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#ff3344',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        const descText = this.add.text(0, -45, 'This action CANNOT be undone.\nTo permanently delete this save, type DELETE below:', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#e0e0e0',
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5, 0.5);

        // Input display box
        const inputBg = this.add.graphics();
        inputBg.fillStyle(0x0a0408, 0.9);
        inputBg.lineStyle(2, 0xff5566, 0.8);
        inputBg.fillRoundedRect(-160, 5, 320, 44, 8);
        inputBg.strokeRoundedRect(-160, 5, 320, 44, 8);

        this.deleteInputText = this.add.text(0, 27, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        // Cancel Button
        const cancelBtn = this.add.container(-100, 105);
        const cancelBg = this.add.graphics();
        cancelBg.fillStyle(0x1a2238, 1);
        cancelBg.lineStyle(2, 0x8899b3, 1);
        cancelBg.fillRoundedRect(-85, -20, 170, 40, 8);
        cancelBg.strokeRoundedRect(-85, -20, 170, 40, 8);
        const cancelLabel = this.add.text(0, 0, 'CANCEL (ESC)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#8899b3',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        cancelBtn.add([cancelBg, cancelLabel]);
        cancelBtn.setSize(170, 40);
        cancelBtn.setInteractive(new Phaser.Geom.Rectangle(-85, -20, 170, 40), Phaser.Geom.Rectangle.Contains);
        cancelBtn.on('pointerdown', () => {
            this.closeDeleteConfirmationModal();
        });

        // Confirm Button
        const confirmBtn = this.add.container(100, 105);
        const confirmBg = this.add.graphics();
        confirmBg.fillStyle(0x441122, 1);
        confirmBg.lineStyle(2, 0xff2244, 1);
        confirmBg.fillRoundedRect(-85, -20, 170, 40, 8);
        confirmBg.strokeRoundedRect(-85, -20, 170, 40, 8);
        const confirmLabel = this.add.text(0, 0, 'CONFIRM DELETE', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#ff8899',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        confirmBtn.add([confirmBg, confirmLabel]);
        confirmBtn.setSize(170, 40);
        confirmBtn.setInteractive(new Phaser.Geom.Rectangle(-85, -20, 170, 40), Phaser.Geom.Rectangle.Contains);
        confirmBtn.on('pointerdown', () => {
            this.executeDeleteSlot();
        });

        this.deleteModalContainer.add([overlay, cardBg, titleText, descText, inputBg, this.deleteInputText, cancelBtn, confirmBtn]);
    }

    private openDeleteSlotConfirmation(slotNum: number) {
        SoundSynth.playMenuBlip();
        this.isDeletingSlot = true;
        this.deletingSlotNum = slotNum;
        this.deleteInput = '';
        this.updateDeleteModalVisuals();
        if (this.deleteModalContainer) {
            this.deleteModalContainer.setVisible(true);
        }
    }

    private closeDeleteConfirmationModal() {
        SoundSynth.playMenuCancel();
        this.isDeletingSlot = false;
        this.deleteInput = '';
        if (this.deleteModalContainer) {
            this.deleteModalContainer.setVisible(false);
        }
    }

    private updateDeleteModalVisuals() {
        if (this.deleteInputText) {
            this.deleteInputText.setText(this.deleteInput.toUpperCase() + '_');
            const isValid = this.deleteInput.trim().toUpperCase() === 'DELETE';
            this.deleteInputText.setColor(isValid ? '#00ffcc' : '#ffffff');
        }
    }

    private handleDeleteModalInput(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.closeDeleteConfirmationModal();
            return;
        }
        if (event.key === 'Enter') {
            this.executeDeleteSlot();
            return;
        }
        if (event.key === 'Backspace') {
            if (this.deleteInput.length > 0) {
                this.deleteInput = this.deleteInput.slice(0, -1);
                SoundSynth.playMenuBlip();
                this.updateDeleteModalVisuals();
            }
            return;
        }
        if (event.key.length === 1 && this.deleteInput.length < 10) {
            this.deleteInput += event.key;
            SoundSynth.playMenuBlip();
            this.updateDeleteModalVisuals();
        }
    }

    private executeDeleteSlot() {
        const success = GameManager.instance.deleteSaveSlotWithConfirmation(this.deletingSlotNum, this.deleteInput);
        if (success) {
            SoundSynth.playSlash();
            this.closeDeleteConfirmationModal();
            this.hasSave = GameManager.instance.hasAnySave();
            this.refreshSlotPreviews();
        } else {
            SoundSynth.playMenuCancel();
            AccessibilityManager.shakeCamera(this.cameras.main, 200, 0.015);
        }
    }

    private createCloudBadge(width: number) {
        this.cloudBadgeContainer = this.add.container(width - 20, 20);
        this.cloudBadgeContainer.setDepth(100);

        const cardWidth = 260;
        const cardHeight = 60;

        const bg = this.add.graphics();
        bg.fillStyle(0x0a101f, 0.85);
        bg.lineStyle(1, 0x00ffcc, 0.6);
        bg.fillRoundedRect(-cardWidth, 0, cardWidth, cardHeight, 8);
        bg.strokeRoundedRect(-cardWidth, 0, cardWidth, cardHeight, 8);
        this.cloudBadgeContainer.add(bg);

        this.cloudStatusText = this.add.text(-cardWidth + 12, 10, '☁️ CLOUD: SYNCED', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.cloudBadgeContainer.add(this.cloudStatusText);

        const tgUser = GameManager.instance.getTelegramUser();
        const userLabel = tgUser ? `👤 @${tgUser.username || tgUser.first_name}` : '👤 GUEST (LOCAL)';
        this.cloudSubText = this.add.text(-cardWidth + 12, 34, `${userLabel} | [C] Sync`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '12px',
            color: '#8899b3'
        });
        this.cloudBadgeContainer.add(this.cloudSubText);

        // Click on badge to trigger sync
        const hitArea = new Phaser.Geom.Rectangle(-cardWidth, 0, cardWidth, cardHeight);
        this.cloudBadgeContainer.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        this.cloudBadgeContainer.on('pointerdown', async () => {
            SoundSynth.playMenuSelect();
            await GameManager.instance.syncWithCloud();
            this.refreshSlotPreviews();
        });

        // Subscribe to CloudSyncClient state updates
        this.cloudUnsubscribe = CloudSyncClient.instance.onStatusChange((status) => {
            let color = '#00ffcc';
            let label = `☁️ CLOUD: ${status}`;
            if (status === 'OFFLINE') color = '#ffaa00';
            else if (status === 'SYNCING') color = '#3399ff';
            else if (status === 'CONFLICT') color = '#ff3344';
            else if (status === 'ERROR') color = '#ff2244';

            this.cloudStatusText.setText(label);
            this.cloudStatusText.setColor(color);
        });

        this.events.once('shutdown', () => {
            if (this.cloudUnsubscribe) {
                this.cloudUnsubscribe();
            }
            if (this.authUnsubscribe) {
                this.authUnsubscribe();
            }
            if (this.tierUnsubscribe) {
                this.tierUnsubscribe();
            }
        });
    }

    // ==========================================
    // SPRINT 21: AUTH & LICENSE BADGES & MODALS
    // ==========================================

    private createAuthAndLicenseBadges(width: number) {
        // 1. Account / Auth Badge (Top-Left)
        this.authBadgeContainer = this.add.container(30, 25);
        this.authBadgeContainer.setDepth(150);

        const authBg = this.add.graphics();
        authBg.fillStyle(0x0a101f, 0.88);
        authBg.lineStyle(1.5, 0x00ffcc, 0.8);
        authBg.fillRoundedRect(0, 0, 360, 38, 8);
        authBg.strokeRoundedRect(0, 0, 360, 38, 8);
        this.authBadgeContainer.add(authBg);

        const authText = this.add.text(12, 10, '👤 [SIGN IN WITH GOOGLE / EMAIL]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.authBadgeContainer.add(authText);

        this.authBadgeContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, 360, 38), Phaser.Geom.Rectangle.Contains);
        this.authBadgeContainer.on('pointerdown', () => {
            SoundSynth.playMenuSelect();
            this.openAuthModal(width, this.scale.height);
        });

        // 2. License Tier Badge (Below Auth Badge)
        this.licenseBadgeContainer = this.add.container(30, 68);
        this.licenseBadgeContainer.setDepth(150);

        const licBg = this.add.graphics();
        licBg.fillStyle(0x0a101f, 0.88);
        licBg.lineStyle(1.5, 0xffaa00, 0.8);
        licBg.fillRoundedRect(0, 0, 360, 36, 8);
        licBg.strokeRoundedRect(0, 0, 360, 36, 8);
        this.licenseBadgeContainer.add(licBg);

        const licText = this.add.text(12, 10, '⭐ DEMO TIER - 30M LIMIT [UPGRADE]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.licenseBadgeContainer.add(licText);

        this.licenseBadgeContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, 360, 36), Phaser.Geom.Rectangle.Contains);
        this.licenseBadgeContainer.on('pointerdown', () => {
            SoundSynth.playMenuSelect();
            this.openUpgradeModal(width, this.scale.height);
        });

        // 3. Admin Dashboard Shortcut Button (Below License Badge)
        this.adminBadgeContainer = this.add.container(30, 110);
        this.adminBadgeContainer.setDepth(150);

        const adminBg = this.add.graphics();
        adminBg.fillStyle(0x1a0a14, 0.9);
        adminBg.lineStyle(1.5, 0xff3344, 0.8);
        adminBg.fillRoundedRect(0, 0, 240, 32, 6);
        adminBg.strokeRoundedRect(0, 0, 240, 32, 6);
        this.adminBadgeContainer.add(adminBg);

        const adminText = this.add.text(12, 8, '⚡ ADMIN DASHBOARD', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#ff4455',
            fontStyle: 'bold'
        });
        this.adminBadgeContainer.add(adminText);

        this.adminBadgeContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, 240, 32), Phaser.Geom.Rectangle.Contains);
        this.adminBadgeContainer.on('pointerdown', () => {
            this.openAdminDashboard();
        });

        // Subscribe to auth updates
        this.authUnsubscribe = UserAuthManager.instance.onAuthStateChange(profile => {
            if (profile.authProvider === 'guest') {
                authText.setText('👤 [SIGN IN WITH GOOGLE / EMAIL]');
                authText.setColor('#00ffcc');
            } else {
                const adminSuffix = profile.isAdmin ? ' [ADMIN]' : '';
                const emailStr = profile.email ? profile.email.substring(0, 22) : 'Verified';
                authText.setText(`👤 ${emailStr}${adminSuffix}`);
                authText.setColor(profile.isAdmin ? '#ffd700' : '#ffffff');
            }
            this.adminBadgeContainer.setVisible(LiveOpsManager.instance.isAuthorizedAdmin());
        });

        // Subscribe to tier updates
        this.tierUnsubscribe = LicenseManager.instance.onTierChange(tier => {
            if (tier === 'commercial') {
                licBg.clear();
                licBg.fillStyle(0x1a1608, 0.9);
                licBg.lineStyle(1.5, 0xffd700, 1);
                licBg.fillRoundedRect(0, 0, 360, 36, 8);
                licBg.strokeRoundedRect(0, 0, 360, 36, 8);
                licText.setText('👑 COMMERCIAL EDITION [UNLOCKED]');
                licText.setColor('#ffd700');
            } else {
                licBg.clear();
                licBg.fillStyle(0x0a101f, 0.88);
                licBg.lineStyle(1.5, 0xffaa00, 0.8);
                licBg.fillRoundedRect(0, 0, 360, 36, 8);
                licBg.strokeRoundedRect(0, 0, 360, 36, 8);
                licText.setText('⭐ DEMO TIER - 30M LIMIT [UPGRADE]');
                licText.setColor('#ffcc00');
            }
        });
    }

    public openAuthModal(width: number, height: number) {
        if (this.activeModalContainer) this.activeModalContainer.destroy();

        const container = this.add.container(width / 2, height / 2);
        container.setDepth(400);
        this.activeModalContainer = container;

        const cardW = 740;
        const cardH = 460;
        const bg = this.add.graphics();
        bg.fillStyle(0x0a0f1e, 0.97);
        bg.lineStyle(4, 0x00ffcc, 1);
        bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
        bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);

        const title = this.add.text(0, -cardH / 2 + 36, 'GOOGLE PLAY CLOSED BETA & ACCOUNTS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        const profile = UserAuthManager.instance.getProfile();
        const currentEmail = profile.email || 'Guest Local Session (100% Offline)';
        const info = this.add.text(0, -cardH / 2 + 88, 
            `Active Session: ${currentEmail}\n` +
            `SwiftSouls runs 100% locally in your browser with zero tracking.\n` +
            `To join our Google Play beta group (20 verified testers needed for launch)\n` +
            `or manage offline guest access, select an option below:`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#8899b3',
                align: 'center',
                lineSpacing: 5
            }
        ).setOrigin(0.5, 0.5);

        container.add([bg, title, info]);

        // Button 1: Play in Offline Guest Mode
        const btnGuest = this.createModalButton(0, -10, '👤 PLAY AS GUEST (100% OFFLINE LOCAL SAVES)', 0x182845, () => {
            UserAuthManager.instance.disconnectAccount();
            this.showToast('Playing in Guest Mode. 100% offline local storage.');
            container.destroy();
            this.activeModalContainer = undefined;
        });

        // Button 2: Join Google Play Beta on Official Website
        const btnWeb = this.createModalButton(0, 55, '🌐 JOIN GOOGLE PLAY TESTERS (SWIFTSOULS.COM)', 0x006655, () => {
            if (typeof window !== 'undefined') {
                window.open('https://swiftsouls.com#vip-waitlist', '_blank', 'noopener,noreferrer');
            }
            this.showToast('Opened official tester sign-up on SwiftSouls.com!');
        });

        // Button 3: Unlock via Evaluation / Recovery Code
        const btnToken = this.createModalButton(0, 120, '🔑 UNLOCK EVALUATION / COMMERCIAL TIER', 0x2e2508, () => {
            const token = LicenseManager.instance.getRecoveryToken() || LicenseManager.instance.generateRecoveryToken();
            LicenseManager.instance.redeemRecoveryToken(token);
            SoundSynth.playFanfare();
            this.showToast('🎉 Commercial tier unlocked via token!');
            container.destroy();
            this.activeModalContainer = undefined;
        });

        // Button 4: Close
        const btnClose = this.createModalButton(0, 185, '[ ✕ CLOSE ]', 0x101420, () => {
            container.destroy();
            this.activeModalContainer = undefined;
        });

        container.add([btnGuest, btnWeb, btnToken, btnClose]);
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

    public checkSmartSlotAllocation(width: number, height: number) {
        const alloc = UserAuthManager.instance.getSlotAllocationStatus();
        if (!alloc.hasOpenSlot) {
            this.openOverwriteModal(width, height, alloc);
        } else {
            console.log(`[SmartSlot] Next open slot available: Slot ${alloc.nextOpenSlot}. Guest session safely mapped.`);
        }
    }

    public openOverwriteModal(width: number, height: number, alloc: any) {
        if (this.activeModalContainer) this.activeModalContainer.destroy();

        const container = this.add.container(width / 2, height / 2);
        container.setDepth(450);
        this.activeModalContainer = container;

        const cardW = 760;
        const cardH = 460;
        const bg = this.add.graphics();
        bg.fillStyle(0x180a14, 0.98);
        bg.lineStyle(4, 0xffaa00, 1);
        bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
        bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);

        const title = this.add.text(0, -cardH / 2 + 36, 'ALL 3 SAVE SLOTS OCCUPIED', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#ffcc00',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        const desc = this.add.text(0, -cardH / 2 + 90, 
            `STRICT INVARIANT: Saves are NEVER merged or blended to protect fragment counts.\n` +
            `Please select which slot to overwrite with your current Guest session:`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 6
            }
        ).setOrigin(0.5, 0.5);

        container.add([bg, title, desc]);

        alloc.occupiedSlots.forEach((slotInfo: any, idx: number) => {
            const btnY = -40 + idx * 65;
            const btn = this.createModalButton(0, btnY, `OVERWRITE SLOT ${slotInfo.slot}: ${slotInfo.name} (LVL ${slotInfo.level})`, 0x331a26, () => {
                GameManager.instance.setCurrentSaveSlot(slotInfo.slot);
                GameManager.instance.saveGame();
                this.showToast(`Saved to Slot ${slotInfo.slot}!`);
                container.destroy();
                this.activeModalContainer = undefined;
                this.refreshSlotPreviews();
            });
            container.add(btn);
        });

        const cancelBtn = this.createModalButton(0, 170, '[ CANCEL ALLOCATION ]', 0x1a1a25, () => {
            container.destroy();
            this.activeModalContainer = undefined;
        });
        container.add(cancelBtn);
    }

    public openUpgradeModal(width: number, height: number) {
        if (this.activeModalContainer) this.activeModalContainer.destroy();

        const container = this.add.container(width / 2, height / 2);
        container.setDepth(400);
        this.activeModalContainer = container;

        const cardW = 760;
        const cardH = 480;
        const bg = this.add.graphics();
        bg.fillStyle(0x0f0e1a, 0.98);
        bg.lineStyle(4, 0xffd700, 1);
        bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
        bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);

        const title = this.add.text(0, -cardH / 2 + 36, 'UPGRADE TO COMMERCIAL EDITION', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '26px',
            color: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        const features = this.add.text(0, -cardH / 2 + 130, 
            `⚡ UNIFIED COMMERCIAL LICENSE — $12.99 USD / ⭐️ 650 STARS\n\n` +
            `• 🔥 PLAY 30 ENTIRE DAYS before it's available anywhere else!\n` +
            `• Full 150 Species (200 with challenge) & 100× Toroidal Open World.\n` +
            `• Unlock Ancient Catacombs, Obsidian Castle, and Boss Soulmelding.\n` +
            `• Complete the Species Extinction Questline & link directly to Sequel.\n` +
            `• Permanent cross-device recovery token (SWIFT-XXXX-XXXX) in Vault.`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 6
            }
        ).setOrigin(0.5, 0.5);

        container.add([bg, title, features]);

        // Purchase / Preorder Button
        const buyBtn = this.createModalButton(0, 50, '⚡ PREORDER FULL GAME - $12.99 / ⭐️ 650 STARS', 0x2e2508, () => {
            const purchase = LicenseManager.instance.initiatePurchase();
            if (purchase.rail === 'stripe' && purchase.checkoutUrl) {
                if (typeof window !== 'undefined') {
                    window.open(purchase.checkoutUrl, '_blank');
                }
                this.showToast('Redirecting to secure $12.99 Stripe checkout...');
            }
            container.destroy();
            this.activeModalContainer = undefined;
        });

        // Recovery Token Button
        const tokenBtn = this.createModalButton(0, 120, '🔑 RESTORE VIA RECOVERY TOKEN', 0x182438, () => {
            const token = LicenseManager.instance.getRecoveryToken() || LicenseManager.instance.generateRecoveryToken();
            const res = LicenseManager.instance.redeemRecoveryToken(token);
            if (res.success) {
                SoundSynth.playFanfare();
                this.showToast('🎉 Commercial tier unlocked via token!');
                container.destroy();
                this.activeModalContainer = undefined;
            } else {
                this.showToast(res.message);
            }
        });

        // Close Button
        const closeBtn = this.createModalButton(0, 185, '[ ✕ CLOSE ]', 0x101420, () => {
            container.destroy();
            this.activeModalContainer = undefined;
        });

        container.add([buyBtn, tokenBtn, closeBtn]);
    }

    public openEulaModal(width: number, height: number) {
        if (this.activeModalContainer) this.activeModalContainer.destroy();

        const container = this.add.container(width / 2, height / 2);
        container.setDepth(400);
        this.activeModalContainer = container;

        const cardW = 760;
        const cardH = 460;
        const bg = this.add.graphics();
        bg.fillStyle(0x0a101f, 0.98);
        bg.lineStyle(4, 0x00ffcc, 1);
        bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
        bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);

        const title = this.add.text(0, -cardH / 2 + 36, 'END USER LICENSE AGREEMENT & TERMS', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        const text = this.add.text(0, -20, 
            `Project SwiftSouls is proprietary software operated by David Swift.\n\n` +
            `• Evaluation Tier: Free 60-min evaluation, capped at 200 fragments.\n` +
            `• Commercial Tier: $12.99 USD / 650 Stars. Perpetual full access.\n` +
            `• Strict Zero-Save Merging Invariant preserves all player kills.\n` +
            `• Complete terms documented in EULA.md and TERMS_OF_SERVICE.md.\n` +
            `• Zero MIT License grant. Anti-circumvention protections apply.`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center',
                lineSpacing: 8
            }
        ).setOrigin(0.5, 0.5);

        const closeBtn = this.createModalButton(0, 160, '[ ✕ CLOSE & AGREE ]', 0x182845, () => {
            container.destroy();
            this.activeModalContainer = undefined;
        });

        container.add([bg, title, text, closeBtn]);
    }

    private openAdminDashboard() {
        SoundSynth.playMenuSelect();
        this.scene.start('AdminDashboardScene', { returnScene: 'TitleScene' });
    }

    private createModalButton(
        x: number,
        y: number,
        text: string,
        fillColor: number,
        onClick: () => void,
        w: number = 560,
        h: number = 48,
        textColor: string = '#ffffff',
        borderColor: number = 0x00ffcc,
        fontSize: string = '16px'
    ): Phaser.GameObjects.Container {
        const bg = this.add.graphics();
        bg.fillStyle(fillColor, 1);
        bg.lineStyle(1.5, borderColor, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

        const label = this.add.text(0, 0, text, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: fontSize,
            color: textColor,
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        const btn = this.add.container(x, y, [bg, label]);
        btn.setSize(w, h);
        btn.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);

        btn.on('pointerover', () => {
            btn.setScale(1.04);
            label.setColor('#00ffcc');
        });
        btn.on('pointerout', () => {
            btn.setScale(1.0);
            label.setColor(textColor);
        });
        btn.on('pointerdown', () => {
            btn.setScale(0.96);
            SoundSynth.playMenuSelect();
            onClick();
        });
        btn.on('pointerup', () => {
            btn.setScale(1.04);
        });

        return btn;
    }
}
