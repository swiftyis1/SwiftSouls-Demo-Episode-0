import Phaser from 'phaser';

export class SplashScene extends Phaser.Scene {
    private stage: number = 0;
    
    // UI Elements
    private bgTile!: Phaser.GameObjects.TileSprite;
    private contentContainer!: Phaser.GameObjects.Container;
    private particlesEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor() {
        super('SplashScene');
    }

    create() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // 1. Static Retro Grid Background
        this.bgTile = this.add.tileSprite(0, 0, width, height, 'splash_bg_tile');
        this.bgTile.setOrigin(0, 0);

        // 2. Main Content Container for fading items
        this.contentContainer = this.add.container(width / 2, height / 2);

        // 3. Ambient Particle Emitter (Purple/White rising embers)
        // We create small square particles rising upwards
        this.particlesEmitter = this.add.particles(0, 0, 'spark_particle', {
            x: { min: 0, max: width },
            y: height + 10,
            speedY: { min: -60, max: -120 },
            speedX: { min: -15, max: 15 },
            scale: { start: 2, end: 0.2 },
            alpha: { start: 0.8, end: 0 },
            lifespan: { min: 3000, max: 5000 },
            frequency: 120,
            tint: [0xffffff, 0x9900ff, 0xdd33ff],
            emitting: false // Will start emitting in Phase 3
        });

        // 4. Click/Press to skip splash screen
        this.input.on('pointerdown', () => this.skipSplash());
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown', () => this.skipSplash());
        }

        // Play title music (Soliloquy) at the start of the splash sequence
        if (!this.sound.get('title_music')) {
            this.sound.play('title_music', { loop: true, volume: 0.4 });
        } else if (!this.sound.get('title_music').isPlaying) {
            const musicInstance = this.sound.get('title_music');
            if (musicInstance && 'play' in musicInstance) {
                (musicInstance as Phaser.Sound.BaseSound).play();
            }
        }

        // Start Splash Progression sequence
        this.runNextPhase();
    }

    private runNextPhase() {
        this.stage++;
        this.contentContainer.removeAll(true);
        this.contentContainer.setAlpha(0);

        if (this.stage === 1) {
            // Phase 1: Swift Software Studio Logo Box (Total = 800 + 3400 + 800 = 5000ms)
            this.createStudioLogo();
            this.tweens.add({
                targets: this.contentContainer,
                alpha: 1,
                duration: 800,
                yoyo: true,
                hold: 3400,
                onComplete: () => this.runNextPhase()
            });

        } else if (this.stage === 2) {
            // Phase 2: Game Title Reveal "SWIFT SOULS" (Total = 800 + 3400 + 800 = 5000ms)
            this.createTitleReveal();
            
            // Start the rising particles
            this.particlesEmitter.start();

            // Fade in the title
            this.tweens.add({
                targets: this.contentContainer,
                alpha: 1,
                duration: 800,
                onComplete: () => {
                    // Stay on title for a bit, then move to TitleScene
                    this.time.delayedCall(3400, () => {
                        this.tweens.add({
                            targets: [this.contentContainer, this.particlesEmitter],
                            alpha: 0,
                            duration: 800,
                            onComplete: () => this.scene.start('TitleScene')
                        });
                    });
                }
            });
        }
    }

    private createStudioLogo() {
        const rectWidth = 1300;
        const rectHeight = 650;

        // Dark blue/indigo rectangle container
        const rect = this.add.graphics();
        rect.fillStyle(0x0f0f35, 1);
        rect.lineStyle(12, 0x00ffff, 1); // Thick cyan border
        rect.fillRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
        rect.strokeRect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
        this.contentContainer.add(rect);

        const textStyle = {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '110px',
            color: '#00ffff',
            fontStyle: 'bold'
        };

        // Swift (Cyan)
        const line1 = this.add.text(0, -170, 'SWIFT', textStyle);
        line1.setOrigin(0.5, 0.5);

        // Software (Cyan)
        const line2 = this.add.text(0, 0, 'SOFTWARE', textStyle);
        line2.setOrigin(0.5, 0.5);

        // Studio (Orange/Amber)
        const line3 = this.add.text(0, 170, 'STUDIO', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '110px',
            color: '#ffaa00',
            fontStyle: 'bold'
        });
        line3.setOrigin(0.5, 0.5);

        this.contentContainer.add([line1, line2, line3]);
    }

    private createTitleReveal() {
        const fontStyle = {
            fontFamily: 'Georgia, "Times New Roman", Times, serif',
            fontSize: '96px',
            color: '#ffffff',
            fontStyle: 'bold italic'
        };

        // Draw SWIF
        const text1 = this.add.text(0, 0, 'SWIF', fontStyle);
        text1.setOrigin(0, 0.5);
        text1.setShadow(5, 5, '#660011', 6, true, true);
        text1.setStroke('#111111', 6);

        // Draw Sword 'T' (scaled)
        const sword = this.add.image(0, 0, 'sword_t');
        sword.setScale(96 / 64 * 1.15); // Scale it slightly taller than the font size
        sword.setOrigin(0.5, 0.5);

        // Draw SOULS (with leading space)
        const text2 = this.add.text(0, 0, ' SOULS', fontStyle);
        text2.setOrigin(0, 0.5);
        text2.setShadow(5, 5, '#660011', 6, true, true);
        text2.setStroke('#111111', 6);

        // Measure widths to center the composite layout
        const w1 = text1.width;
        const swordSpacing = 56; // Horizontal gap allocated for Melodie's winged sword
        const w2 = text2.width;
        
        const totalWidth = w1 + swordSpacing + w2;
        const startX = -totalWidth / 2;
        
        text1.setX(startX);
        sword.setX(startX + w1 + 24);
        sword.setY(8); // Shift down slightly so the crossguard aligns with the text cap height
        
        text2.setX(startX + w1 + swordSpacing);

        this.contentContainer.add([text1, sword, text2]);
    }

    private skipSplash() {
        // Instantly transition to the Title Menu
        this.scene.start('TitleScene');
    }
}
