import Phaser from 'phaser';
import { SoundSynth } from '../systems/SoundSynth';

export class IntroScene extends Phaser.Scene {
    private meteor!: Phaser.GameObjects.Sprite;
    private player!: Phaser.GameObjects.Sprite;
    private planetBg!: Phaser.GameObjects.Image;
    private spaceMeteor!: Phaser.GameObjects.Sprite;
    private spaceParticles!: any;
    
    // Dialogue UI elements
    private dialogueBox: Phaser.GameObjects.Graphics | null = null;
    private dialogueText: Phaser.GameObjects.Text | null = null;
    private dialogueTitle: Phaser.GameObjects.Text | null = null;
    private dialoguePrompt: Phaser.GameObjects.Text | null = null;
    
    private narrationPages: string[] = [];
    private currentPageIndex: number = 0;
    private isNarrationActive: boolean = false;

    constructor() {
        super('IntroScene');
    }

    create() {
        this.currentPageIndex = 0;
        this.isNarrationActive = false;

        // 1. Setup skip key / advance narration controls
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown-SPACE', () => {
                if (this.isNarrationActive) {
                    this.advanceNarration();
                }
            });
        }

        // Mouse click advances too
        this.input.on('pointerdown', () => {
            if (this.isNarrationActive) {
                this.advanceNarration();
            }
        });

        // Gamepad controller support to advance narration
        if (this.input.gamepad) {
            this.input.gamepad.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
                if (button.index === 0) { // A button
                    if (this.isNarrationActive) {
                        this.advanceNarration();
                    }
                }
            });
        }

        // 2. Start Phase 1: Space Strike scene
        this.startSpaceStrike();
    }

    private startSpaceStrike() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Create the space planet background
        this.planetBg = this.add.image(width / 2, height / 2, 'planet');
        this.planetBg.setDisplaySize(width, height);
        this.planetBg.setDepth(1);

        // Create space meteor (scaled down for space flight distance)
        // Spawns off-screen top-left
        this.spaceMeteor = this.add.sprite(-50, -50, 'meteor');
        this.spaceMeteor.setScale(0.8);
        this.spaceMeteor.setDepth(3);

        // Fiery space tail
        this.spaceParticles = this.add.particles(0, 0, 'spark_particle', {
            speed: { min: 20, max: 100 },
            scale: { start: 1.5, end: 0 },
            lifespan: 500,
            blendMode: 'ADD',
            tint: [0xff3300, 0xffaa00, 0xffcc00],
            follow: this.spaceMeteor
        });
        this.spaceParticles.setDepth(2);

        // Animate the space meteor descending diagonally towards the planet center
        this.time.delayedCall(800, () => {
            this.tweens.add({
                targets: this.spaceMeteor,
                x: width / 2 + 100,
                y: height / 2 + 50,
                scale: 0.1, // Shrink as it hits the surface
                duration: 2500,
                ease: 'Cubic.easeIn',
                onComplete: () => this.handleSpaceImpact()
            });
        });
    }

    private handleSpaceImpact() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Initial impact screen shake
        this.cameras.main.shake(400, 0.015);
        SoundSynth.playExplosion();

        // Fire spark burst at planet impact coordinates
        const impactX = this.spaceMeteor.x;
        const impactY = this.spaceMeteor.y;

        const impactEmitter = this.add.particles(impactX, impactY, 'spark_particle', {
            speed: { min: 100, max: 300 },
            angle: { min: 0, max: 360 },
            scale: { start: 2.5, end: 0 },
            lifespan: 800,
            quantity: 30,
            tint: [0xff3300, 0xffaa00, 0xffcc00],
            emitting: false
        });
        impactEmitter.setDepth(4);
        impactEmitter.explode();

        // Destroy space meteor objects
        this.spaceMeteor.destroy();
        this.spaceParticles.destroy();

        // 3. White screen flash transition overlay
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 1);
        flash.fillRect(0, 0, width, height);
        flash.setDepth(100);
        flash.alpha = 0;

        // Fade in flash
        this.tweens.add({
            targets: flash,
            alpha: 1,
            duration: 300,
            onComplete: () => {
                // Remove planet space view
                this.planetBg.destroy();

                // Setup the grassy crash landing site surface
                this.setupSurfaceScene();

                // Fade out flash
                this.tweens.add({
                    targets: flash,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => {
                        flash.destroy();
                        impactEmitter.destroy();
                        
                        // Drop the meteor capsule onto the grassy ground
                        this.animateMeteorLanding();
                    }
                });
            }
        });
    }

    private setupSurfaceScene() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Fill background with grassy surface tiles (replacing navy grid)
        const cols = Math.ceil(width / 64);
        const rows = Math.ceil(height / 64);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                this.add.image(c * 64 + 32, r * 64 + 32, 'grass_tile');
            }
        }

        // Draw charred dirt impact crater at landing center
        const crater = this.add.graphics();
        crater.fillStyle(0x3a2512, 0.7); // Dark carbonized earth
        crater.fillCircle(width / 2, height / 2 + 30, 96);
        crater.lineStyle(6, 0x1f1207, 0.9); // Hard crust edge
        crater.strokeCircle(width / 2, height / 2 + 30, 96);
        crater.setDepth(1);
    }

    private animateMeteorLanding() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Spawn meteor capsule off-screen top
        this.meteor = this.add.sprite(width / 2, -100, 'meteor');
        this.meteor.setScale(2); // Scale up meteor capsule
        this.meteor.setDepth(5);

        // Falling trailing smoke particles
        const fallSmoke = this.add.particles(0, 0, 'spark_particle', {
            speed: { min: 20, max: 60 },
            angle: { min: 80, max: 100 }, // Drag smoke upwards
            scale: { start: 2, end: 0 },
            lifespan: 600,
            tint: 0x888888,
            follow: this.meteor
        });
        fallSmoke.setDepth(4);

        // Animate vertical fall onto landing crater
        this.tweens.add({
            targets: this.meteor,
            y: height / 2 + 20,
            duration: 1000,
            ease: 'Quad.easeIn',
            onComplete: () => {
                fallSmoke.destroy();
                this.handleMeteorImpact();
            }
        });
    }

    private handleMeteorImpact() {
        // Hard ground impact screen shake
        this.cameras.main.shake(500, 0.02);
        SoundSynth.playExplosion();

        // Particle sparks explosion on impact
        const emitter = this.add.particles(this.meteor.x, this.meteor.y, 'spark_particle', {
            speed: { min: 150, max: 400 },
            angle: { min: 0, max: 360 },
            scale: { start: 2, end: 0 },
            lifespan: 1000,
            quantity: 40,
            tint: [0xff3300, 0xffaa00, 0xffcc00],
            emitting: false
        });
        emitter.setDepth(6);
        emitter.explode();

        // Persistent rising grey smoke from the crashed pod
        const risingSmoke = this.add.particles(this.meteor.x, this.meteor.y, 'spark_particle', {
            speed: { min: 15, max: 45 },
            angle: { min: 240, max: 300 }, // Floating upwards
            scale: { start: 2, end: 0 },
            lifespan: 1500,
            quantity: 1,
            tint: 0x555555,
            frequency: 80
        });
        risingSmoke.setDepth(4);

        // Delay 3 seconds, then open hatch and player steps out
        this.time.delayedCall(3000, () => {
            // Play woosh sound
            SoundSynth.playWoosh();

            // Set meteor texture to open hatch immediately
            this.meteor.setTexture('meteor_open');
            
            // Spawn the temporary closed door panel sprite directly over the black opening
            const hatchDoor = this.add.sprite(this.meteor.x, this.meteor.y, 'meteor_hatch');
            hatchDoor.setScale(2);
            hatchDoor.setDepth(7);

            // Spawn player sprite inside capsule hatch (at scale 0, behind door)
            this.player = this.add.sprite(this.meteor.x, this.meteor.y, 'player');
            this.player.setScale(0);
            this.player.setDepth(6);

            // Animate door opening (sliding left and shrinking in width)
            this.tweens.add({
                targets: hatchDoor,
                x: this.meteor.x - 32, // Slide to the left (aligned with final open door panel position)
                scaleX: 0.8,            // Shrink width to simulate rotation/swing
                duration: 600,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    // Destroy the temporary door sprite, revealing the static background open door
                    hatchDoor.destroy();

                    // Step out of meteor capsule (scaled to 1.35 matching overworld hero scale)
                    this.tweens.add({
                        targets: this.player,
                        scale: 1.35,
                        y: this.meteor.y + 70,
                        duration: 1000,
                        ease: 'Power1',
                        onComplete: () => this.startNarration()
                    });
                }
            });
        });
    }

    private startNarration() {
        this.narrationPages = [
            "A small pod-like meteor crashes violently onto the surface of this forgotten land.",
            "The hatch swings open... and you step out, clutching your basic equipment.",
            "You carry only 7 items: a Sword, Shield, Armor, Helmet, 2 Rings, and an Amulet.",
            "The world is overrun with monsters. Defeating them will capture their essence to infuse and empower your gear.",
            "Your mission is absolute: hunt every species of monster to complete extinction, to provide souls and make room for new life forms.",
            "Use the ARROW keys to move, and SPACE to interact. The hunt begins now!"
        ];

        this.currentPageIndex = 0;
        this.isNarrationActive = true;

        this.drawDialogueBox();
        this.showPage(0);
    }

    private drawDialogueBox() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        this.dialogueBox = this.add.graphics();
        this.dialogueBox.fillStyle(0x0f0f1b, 0.95);
        this.dialogueBox.lineStyle(4, 0x00ffcc, 1);
        this.dialogueBox.fillRoundedRect(80, height - 260, width - 160, 200, 12);
        this.dialogueBox.strokeRoundedRect(80, height - 260, width - 160, 200, 12);
        this.dialogueBox.setDepth(100);

        this.dialogueTitle = this.add.text(120, height - 240, 'Introduction', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '28px',
            color: '#ffcc00',
            fontStyle: 'bold'
        });
        this.dialogueTitle.setDepth(101);

        this.dialogueText = this.add.text(120, height - 190, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#ffffff',
            wordWrap: { width: width - 240 }
        });
        this.dialogueText.setDepth(101);

        this.dialoguePrompt = this.add.text(width - 320, height - 100, 'SPACE to continue', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#8899b3'
        });
        this.dialoguePrompt.setDepth(101);
    }

    private showPage(index: number) {
        if (this.dialogueText) {
            this.dialogueText.setText(this.narrationPages[index]);
        }
    }

    private advanceNarration() {
        this.currentPageIndex++;

        if (this.currentPageIndex < this.narrationPages.length) {
            this.showPage(this.currentPageIndex);
        } else {
            this.endIntro();
        }
    }

    private endIntro() {
        this.isNarrationActive = false;

        // Destroy UI elements
        this.dialogueBox?.destroy();
        this.dialogueText?.destroy();
        this.dialogueTitle?.destroy();
        this.dialoguePrompt?.destroy();

        // Fade out screen
        this.cameras.main.fadeOut(800, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('OverworldScene');
        });
    }
}
