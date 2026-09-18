import Phaser from 'phaser';
import { AssetPipeline } from '../systems/AssetPipeline';
import { SoundSynth } from '../systems/SoundSynth';

interface CreditCard {
    role: string;
    roleColor?: string;
    names: string[];
    subtitle?: string;
    sprites: string[]; // 2 to 3 texture keys to display floating
    specialBadge?: string;
}

export class CreditsScene extends Phaser.Scene {
    private returnScene: string = 'TitleScene';
    private returnToSlots: boolean = false;
    
    private currentCardIndex: number = 0;
    private cardTimer?: Phaser.Time.TimerEvent;
    private isPaused: boolean = false;
    
    // UI Containers
    private cardContainer!: Phaser.GameObjects.Container;
    private cardBg!: Phaser.GameObjects.Graphics;
    private roleText!: Phaser.GameObjects.Text;
    private nameTexts: Phaser.GameObjects.Text[] = [];
    private subtitleText!: Phaser.GameObjects.Text;
    private badgeText!: Phaser.GameObjects.Text;
    private progressText!: Phaser.GameObjects.Text;
    private spriteObjects: Phaser.GameObjects.Sprite[] = [];
    private activeTweens: Phaser.Tweens.Tween[] = [];

    // Background starfield
    private stars: { sprite: Phaser.GameObjects.Graphics; speed: number; baseAlpha: number }[] = [];

    private readonly creditCards: CreditCard[] = [
        {
            role: 'EXECUTIVE PRODUCER & GAME DIRECTOR',
            roleColor: '#ffd700', // Radiant Gold
            names: ['David Swift'],
            subtitle: 'Conception, World Architecture & Game Vision',
            sprites: ['player', 'meteor'],
            specialBadge: 'PROJECT SWIFTSOULS'
        },
        {
            role: 'LEAD CHARACTER & CREATURE ARTIST',
            roleColor: '#00ffcc', // Vibrant Cyan Glow
            names: ['Melodie Swift'],
            subtitle: 'Hero & Monster Pixel Artworks, Visual Character Concepts',
            sprites: ['player', 'slime', 'phoenix'],
            specialBadge: '★ ARTIST SPOTLIGHT ★'
        },
        {
            role: 'FINANCIAL & OPERATIONS MANAGEMENT\n& MARKETING DIRECTOR',
            roleColor: '#ffd700', // Radiant Gold
            names: ['Trisha Swift'],
            subtitle: 'Financial Strategy, Operations Management & Marketing Direction',
            sprites: ['town_nexus_crystal', 'castle_herald', 'town_lantern'],
            specialBadge: '★ OPERATIONS & MARKETING ★'
        },
        {
            role: 'AI SYSTEMS ARCHITECT & PAIR PROGRAMMER',
            roleColor: '#70a5ff', // DeepMind Indigo/Blue
            names: ['Antigravity AI'],
            subtitle: 'Google DeepMind Advanced Agentic Coding Systems',
            sprites: ['town_nexus_crystal', 'spark_particle', 'save_altar'],
            specialBadge: 'RESPONSIBLE AI COLLABORATION'
        },
        {
            role: 'LEAD GAMEPLAY & SYSTEMS PROGRAMMING',
            roleColor: '#ffd700',
            names: ['David Swift', 'Antigravity AI'],
            subtitle: 'State Machines, Save Cryptography & Extinction Mechanics',
            sprites: ['sword_t', 'meteor_open', 'town_anvil']
        },
        {
            role: 'AUDIO SYNTHESIZER & PROCEDURAL CHIPTUNE',
            roleColor: '#00ffcc',
            names: ['David Swift', 'Antigravity AI'],
            subtitle: 'Zero-Asset Web Audio Synthesizer & Procedural Sound FX',
            sprites: ['town_bell_tower', 'animal_cat', 'town_brazier']
        },
        {
            role: 'TITLE THEME MUSIC COMPOSITION',
            roleColor: '#ffaa44',
            names: ['Matthew Pablo'],
            subtitle: '"Soliloquy" — Licensed under CC-BY 3.0',
            sprites: ['snake', 'bat']
        },
        {
            role: 'COMBAT FORMULA & BESTIARY DESIGN',
            roleColor: '#ffd700',
            names: ['David Swift'],
            subtitle: '8-Element Matrix, Soul Infusions & 255 Extinction Thresholds',
            sprites: ['goblin', 'skeleton', 'phoenix']
        },
        {
            role: 'QUALITY ASSURANCE & PLAYTEST LEADS',
            roleColor: '#70a5ff',
            names: ['Playtester 1', 'Playtester 2', 'Playtester 3', 'Playtester 4'],
            subtitle: 'Telemetry, Balance Certification & Exploits Discovery',
            sprites: ['settler_scout', 'settler_blacksmith']
        },
        {
            role: 'COMMUNITY & LOCALIZATION LEADS',
            roleColor: '#00ffcc',
            names: ['Community Lead 1, Community Lead 2', 'Translator 1, Translator 2'],
            subtitle: 'Global Player Experience & Telegram Community Bridge',
            sprites: ['settler_herbalist', 'castle_herald']
        },
        {
            role: 'DEDICATION TO MY STUDENTS',
            roleColor: '#00ffcc',
            names: ['To All My Students', 'Current & Former'],
            subtitle: '"I hope I inspired you as much as you all inspire me."',
            sprites: ['town_nexus_crystal', 'spark_particle', 'save_altar'],
            specialBadge: '★ WITH DEEPEST GRATITUDE ★'
        },
        {
            role: 'SPECIAL THANKS & DEDICATION',
            roleColor: '#ffffff',
            names: [
                'The Swift Family, Friends & Supporters',
                'OpenGameArt.org Community & Kenney',
                'Photon Storm (Phaser 3 Engine)'
            ],
            subtitle: 'For Continuous Encouragement, Love & Inspiration',
            sprites: ['animal_dog', 'town_flowers', 'animal_sheep'],
            specialBadge: 'FAMILY & FRIENDS'
        },
        {
            role: 'A SWIFT FAMILY & ANTIGRAVITY PRODUCTION',
            roleColor: '#ffd700',
            names: ['Project SwiftSouls'],
            subtitle: 'All species must be hunted to extinction. The sequel awaits...',
            sprites: ['player', 'meteor_open', 'phoenix'],
            specialBadge: '★ THANK YOU FOR PLAYING ★'
        }
    ];

    constructor() {
        super('CreditsScene');
    }

    init(data: { returnScene?: string; returnToSlots?: boolean }) {
        this.returnScene = data?.returnScene || 'TitleScene';
        this.returnToSlots = data?.returnToSlots || false;
        this.currentCardIndex = 0;
        this.isPaused = false;
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 1. Ensure Title Music continues to play smoothly
        if (!this.sound.get('title_music')) {
            this.sound.play('title_music', { loop: true, volume: 0.4 });
        } else if (!this.sound.get('title_music').isPlaying) {
            const musicInstance = this.sound.get('title_music');
            if (musicInstance && 'play' in musicInstance) {
                (musicInstance as Phaser.Sound.BaseSound).play();
            }
        }

        // 2. Cosmic Indigo Starfield Background
        this.createCosmicBackground(width, height);

        // 3. Central Glassmorphic Credit Card Container
        this.createCreditCardUI(width, height);

        // 4. Header & Footer Navigation Bars
        this.createNavigationHUD(width, height);

        // 5. Input Listeners: Keyboard & Gamepad
        this.setupInputHandlers();

        // 6. Display First Card and Start 3-Second Pacing Timer
        this.showCard(0, false);
    }

    private createCosmicBackground(width: number, height: number) {
        // Deep cosmic vertical gradient
        const bgG = this.add.graphics();
        bgG.fillGradientStyle(0x06060f, 0x06060f, 0x101428, 0x080816, 1);
        bgG.fillRect(0, 0, width, height);

        // Ambient Nebula Cloud Glows
        const nebula1 = this.add.graphics();
        nebula1.fillStyle(0x00ffcc, 0.04);
        nebula1.fillCircle(width * 0.25, height * 0.35, 320);

        const nebula2 = this.add.graphics();
        nebula2.fillStyle(0x7040ff, 0.04);
        nebula2.fillCircle(width * 0.75, height * 0.65, 380);

        // Drifting twinkling starfield (50 stars)
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            const starG = this.add.graphics();
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(1, 2.8);
            const baseAlpha = Phaser.Math.FloatBetween(0.2, 0.9);
            const speed = Phaser.Math.FloatBetween(0.2, 0.7);

            starG.fillStyle(0xffffff, baseAlpha);
            starG.fillCircle(0, 0, size);
            starG.setPosition(x, y);

            this.stars.push({ sprite: starG, speed, baseAlpha });
        }

        // Cinematic dark vignette border
        const vignette = this.add.graphics();
        vignette.lineStyle(40, 0x000000, 0.6);
        vignette.strokeRect(0, 0, width, height);
        vignette.lineStyle(16, 0x000000, 0.9);
        vignette.strokeRect(0, 0, width, height);
    }

    private createCreditCardUI(width: number, height: number) {
        this.cardContainer = this.add.container(width / 2, height / 2);
        this.cardContainer.setDepth(50);

        const cardW = 920;
        const cardH = 540;

        // Card backing graphics
        this.cardBg = this.add.graphics();
        this.drawCardBackground(cardW, cardH, 0x00ffcc);
        this.cardContainer.add(this.cardBg);

        // Special Badge (e.g., ★ ARTIST SPOTLIGHT ★)
        this.badgeText = this.add.text(0, -cardH / 2 + 45, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        this.cardContainer.add(this.badgeText);

        // Role Title
        this.roleText = this.add.text(0, -cardH / 2 + 95, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#00ffcc',
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5, 0.5);
        this.cardContainer.add(this.roleText);

        // Decorative horizontal gold line
        const lineG = this.add.graphics();
        lineG.lineStyle(2, 0xffd700, 0.6);
        lineG.lineBetween(-280, -cardH / 2 + 130, 280, -cardH / 2 + 130);
        this.cardContainer.add(lineG);

        // Contributor Names container (populated in showCard)
        this.nameTexts = [];

        // Subtitle / Description Text
        this.subtitleText = this.add.text(0, cardH / 2 - 80, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#8899b3',
            align: 'center',
            wordWrap: { width: 780 }
        }).setOrigin(0.5, 0.5);
        this.cardContainer.add(this.subtitleText);

        // Card progress index (e.g., "02 / 11")
        this.progressText = this.add.text(0, cardH / 2 - 30, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: '#446688',
            align: 'center'
        }).setOrigin(0.5, 0.5);
        this.cardContainer.add(this.progressText);
    }

    private drawCardBackground(w: number, h: number, glowColor: number = 0x00ffcc) {
        this.cardBg.clear();
        
        // Translucent dark glass fill
        this.cardBg.fillStyle(0x0a0f20, 0.88);
        this.cardBg.fillRoundedRect(-w / 2, -h / 2, w, h, 20);

        // Outer soft glow border
        this.cardBg.lineStyle(3, glowColor, 0.8);
        this.cardBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 20);

        // Inner subtle neon rim
        this.cardBg.lineStyle(1, 0xffffff, 0.2);
        this.cardBg.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 16);
    }

    private createNavigationHUD(width: number, height: number) {
        // Top Title Bar
        this.add.text(width / 2, 40, '✦ PROJECT SWIFTSOULS ✦ CREDITS ✦', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        // Bottom Navigation Instructions
        this.add.text(width / 2, height - 35, '[SPACE / TAP] Next Card   •   [LEFT / RIGHT] Prev/Next   •   [ESC] Return to Menu', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#667799'
        }).setOrigin(0.5, 0.5);

        // Top-Right [SKIP / RETURN] Interactive Button
        const skipBtn = this.add.container(width - 120, 40);
        skipBtn.setDepth(100);

        const skipBg = this.add.graphics();
        skipBg.fillStyle(0x1a2035, 0.9);
        skipBg.lineStyle(1.5, 0x00ffcc, 0.8);
        skipBg.fillRoundedRect(-70, -18, 140, 36, 8);
        skipBg.strokeRoundedRect(-70, -18, 140, 36, 8);
        skipBtn.add(skipBg);

        const skipLabel = this.add.text(0, 0, '✕ RETURN', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);
        skipBtn.add(skipLabel);

        skipBtn.setInteractive(new Phaser.Geom.Rectangle(-70, -18, 140, 36), Phaser.Geom.Rectangle.Contains);
        skipBtn.on('pointerover', () => {
            skipBg.clear();
            skipBg.fillStyle(0x00ffcc, 0.25);
            skipBg.lineStyle(2, 0x00ffcc, 1);
            skipBg.fillRoundedRect(-70, -18, 140, 36, 8);
            skipBg.strokeRoundedRect(-70, -18, 140, 36, 8);
            skipLabel.setColor('#00ffcc');
        });
        skipBtn.on('pointerout', () => {
            skipBg.clear();
            skipBg.fillStyle(0x1a2035, 0.9);
            skipBg.lineStyle(1.5, 0x00ffcc, 0.8);
            skipBg.fillRoundedRect(-70, -18, 140, 36, 8);
            skipBg.strokeRoundedRect(-70, -18, 140, 36, 8);
            skipLabel.setColor('#ffffff');
        });
        skipBtn.on('pointerdown', () => {
            this.exitCredits();
        });

        // Left [< PREV] Floating Button
        const prevBtn = this.add.text(50, height / 2, '◀ PREV', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#446688',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
        prevBtn.on('pointerover', () => prevBtn.setColor('#00ffcc'));
        prevBtn.on('pointerout', () => prevBtn.setColor('#446688'));
        prevBtn.on('pointerdown', () => this.prevCard());

        // Right [NEXT >] Floating Button
        const nextBtn = this.add.text(width - 50, height / 2, 'NEXT ▶', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#446688',
            fontStyle: 'bold'
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
        nextBtn.on('pointerover', () => nextBtn.setColor('#00ffcc'));
        nextBtn.on('pointerout', () => nextBtn.setColor('#446688'));
        nextBtn.on('pointerdown', () => this.nextCard());
    }

    private setupInputHandlers() {
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown-ESC', () => this.exitCredits());
            this.input.keyboard.on('keydown-SPACE', () => this.nextCard());
            this.input.keyboard.on('keydown-RIGHT', () => this.nextCard());
            this.input.keyboard.on('keydown-ENTER', () => this.nextCard());
            this.input.keyboard.on('keydown-LEFT', () => this.prevCard());
            this.input.keyboard.on('keydown-P', () => {
                this.isPaused = !this.isPaused;
                if (this.cardTimer) this.cardTimer.paused = this.isPaused;
            });

            // Number keys 1-9 and 0 to jump directly to cards
            const numKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
            numKeys.forEach((k, idx) => {
                this.input.keyboard?.on(`keydown-${k}`, () => {
                    this.showCard(idx, true);
                });
            });
            this.input.keyboard?.on('keydown-ZERO', () => {
                this.showCard(9, true);
            });

            // Character & family quick hotkeys
            this.input.keyboard?.on('keydown-D', () => this.showCard(0, true)); // David Swift (Director)
            this.input.keyboard?.on('keydown-M', () => this.showCard(1, true)); // Melodie Swift (Artist)
            this.input.keyboard?.on('keydown-T', () => this.showCard(2, true)); // Trisha Swift (Operations & Marketing)
            this.input.keyboard?.on('keydown-S', () => this.showCard(10, true)); // Dedication to Students
            this.input.keyboard?.on('keydown-F', () => this.showCard(11, true)); // Family & Friends
        }

        // Screen tap advances cards
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // Ignore clicks on header / footer controls
            if (pointer.y > 70 && pointer.y < this.cameras.main.height - 70) {
                if (pointer.x < 150) {
                    this.prevCard();
                } else {
                    this.nextCard();
                }
            }
        });

        // Gamepad navigation support
        if (this.input.gamepad) {
            this.input.gamepad.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
                if (button.index === 0 || button.index === 15) { // A button or D-pad Right
                    this.nextCard();
                } else if (button.index === 14) { // D-pad Left
                    this.prevCard();
                } else if (button.index === 1 || button.index === 9) { // B or Start
                    this.exitCredits();
                }
            });
        }
    }

    public showCard(index: number, playBlip: boolean = true) {
        if (playBlip) {
            SoundSynth.playMenuBlip();
        }

        // Wrap card index around
        if (index >= this.creditCards.length) {
            index = 0;
        } else if (index < 0) {
            index = this.creditCards.length - 1;
        }
        this.currentCardIndex = index;

        const card = this.creditCards[index];

        // 1. Clean up old sprites and tweens
        this.activeTweens.forEach(t => t.stop());
        this.activeTweens = [];
        this.spriteObjects.forEach(s => s.destroy());
        this.spriteObjects = [];
        this.nameTexts.forEach(t => t.destroy());
        this.nameTexts = [];

        // 2. Smooth cross-fade animation on container
        this.cardContainer.setAlpha(0);
        this.tweens.add({
            targets: this.cardContainer,
            alpha: 1,
            duration: 350,
            ease: 'Power2'
        });

        // 3. Update Badge
        if (card.specialBadge) {
            this.badgeText.setText(card.specialBadge);
            this.badgeText.setVisible(true);
        } else {
            this.badgeText.setVisible(false);
        }

        // 4. Update Role Title
        const isMultiLineRole = card.role.includes('\n');
        this.roleText.setText(card.role);
        this.roleText.setFontSize(isMultiLineRole ? '22px' : '28px');
        this.roleText.setLineSpacing(4);
        this.roleText.setColor(card.roleColor || '#00ffcc');
        this.roleText.setY(isMultiLineRole ? -540 / 2 + 82 : -540 / 2 + 95);

        // Dynamic border color based on role
        const glowColor = card.roleColor === '#ffd700' ? 0xffd700 : (card.roleColor === '#ffffff' ? 0xffffff : 0x00ffcc);
        this.drawCardBackground(920, 540, glowColor);

        // 5. Populate Contributor Names
        const namesStartY = isMultiLineRole ? -45 : -70;
        const nameSpacing = card.names.length > 2 ? 45 : 60;
        const fontSize = card.names.length > 2 ? '28px' : '36px';

        card.names.forEach((name, i) => {
            const nameY = namesStartY + i * nameSpacing;
            const isHighlighted = name === 'Melodie Swift' || name === 'David Swift' || name === 'Trisha Swift';
            const nameTxt = this.add.text(0, nameY, name, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: isHighlighted ? '38px' : fontSize,
                color: isHighlighted ? '#ffffff' : '#e0e8f5',
                fontStyle: 'bold',
                align: 'center',
                stroke: isHighlighted ? '#003344' : '#000000',
                strokeThickness: isHighlighted ? 4 : 2
            }).setOrigin(0.5, 0.5);

            this.cardContainer.add(nameTxt);
            this.nameTexts.push(nameTxt);
        });

        // 6. Update Subtitle
        this.subtitleText.setText(card.subtitle || '');

        // 7. Update Progress Text (e.g. "CARD 02 OF 13")
        const cardNumStr = String(index + 1).padStart(2, '0');
        const totalStr = String(this.creditCards.length).padStart(2, '0');
        this.progressText.setText(`CARD ${cardNumStr} OF ${totalStr}`);

        // 8. Render Animated Sprites via AssetPipeline
        this.renderCardSprites(card.sprites);

        // 9. Reset 10-Second Auto-Advance Timer
        if (this.cardTimer) {
            this.cardTimer.remove(false);
        }
        this.cardTimer = this.time.delayedCall(10000, () => {
            if (!this.isPaused) {
                this.nextCard(false);
            }
        });
    }

    private renderCardSprites(sprites: string[]) {
        const pipeline = AssetPipeline.getInstance();
        const cardW = 920;

        // Determine positions for 2 or 3 sprites
        // Left flank, Right flank, and optional Center bottom
        const positions = sprites.length === 3
            ? [
                { x: -cardW / 2 + 100, y: 15, scale: 2.2 },
                { x: cardW / 2 - 100, y: 15, scale: 2.2 },
                { x: 0, y: 120, scale: 1.8 }
            ]
            : [
                { x: -cardW / 2 + 110, y: 10, scale: 2.4 },
                { x: cardW / 2 - 110, y: 10, scale: 2.4 }
            ];

        sprites.forEach((spriteKey, idx) => {
            const effectiveKey = pipeline.getTextureKey(spriteKey);
            const pos = positions[idx] || positions[0];

            if (this.textures.exists(effectiveKey) || this.textures.exists(spriteKey)) {
                const finalKey = this.textures.exists(effectiveKey) ? effectiveKey : spriteKey;
                const spr = this.add.sprite(pos.x, pos.y, finalKey);
                spr.setScale(pos.scale);
                spr.setDepth(60);

                // Add gentle floating bob tween
                const bobTween = this.tweens.add({
                    targets: spr,
                    y: pos.y - 12,
                    duration: 1200 + idx * 250,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                // Add subtle scale pulse
                const pulseTween = this.tweens.add({
                    targets: spr,
                    scaleX: pos.scale * 1.06,
                    scaleY: pos.scale * 1.06,
                    duration: 1600 + idx * 300,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                this.cardContainer.add(spr);
                this.spriteObjects.push(spr);
                this.activeTweens.push(bobTween, pulseTween);
            }
        });
    }

    public nextCard(playBlip: boolean = true) {
        this.showCard(this.currentCardIndex + 1, playBlip);
    }

    public prevCard() {
        this.showCard(this.currentCardIndex - 1, true);
    }

    public exitCredits() {
        SoundSynth.playMenuCancel();
        if (this.cardTimer) {
            this.cardTimer.remove(false);
        }

        // Return smoothly to the origin scene
        if (this.returnScene === 'TitleScene') {
            this.scene.start('TitleScene', { returnToSlots: this.returnToSlots });
        } else {
            this.scene.start(this.returnScene);
        }
    }

    update(_time: number, delta: number) {
        // Slowly drift stars downward for cosmic parallax motion
        for (const star of this.stars) {
            star.sprite.y += star.speed * (delta / 16);
            if (star.sprite.y > this.cameras.main.height) {
                star.sprite.y = 0;
                star.sprite.x = Phaser.Math.Between(0, this.cameras.main.width);
            }
        }
    }
}
