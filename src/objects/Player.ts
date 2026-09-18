import Phaser from 'phaser';
import { TouchControls } from '../systems/TouchControls';
import { GameManager } from '../systems/GameManager';
import { CharacterLayerCompositor } from '../systems/CharacterLayerCompositor';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private wasdKeys!: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    };

    // Sprint 27: Dynamic Equipment Infusion & Cape Layers
    private capeSprite: Phaser.GameObjects.Sprite | null = null;
    private armorSprite: Phaser.GameObjects.Sprite | null = null;
    private helmetSprite: Phaser.GameObjects.Sprite | null = null;
    private shieldSprite: Phaser.GameObjects.Sprite | null = null;
    private weaponSprite: Phaser.GameObjects.Sprite | null = null;

    private elapsedAnimationTime: number = 0;
    private isMoving: boolean = false;
    private facingDirection: 'down' | 'left' | 'right' | 'up' = 'down';
    private lastEquippedCrystals: Record<string, string | null> = {};

    // Tap-to-Move / Click-to-Move Waypoint Target State
    private moveTarget: { x: number; y: number; onArrive?: () => void; isInteractable?: boolean } | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Sprint 28: 4-Directional walking spritesheets for Valen ('player_walk') & Cora ('player_female_walk')
        const gender = GameManager.instance.getPlayerGender();
        let baseTexture = 'player';
        if (gender === 'female') {
            if (scene.textures.exists('player_female_walk')) {
                baseTexture = 'player_female_walk';
            } else if (scene.textures.exists('player_female')) {
                baseTexture = 'player_female';
            }
        } else {
            if (scene.textures.exists('player_walk')) {
                baseTexture = 'player_walk';
            } else if (scene.textures.exists('player')) {
                baseTexture = 'player';
            }
        }

        super(scene, x, y, baseTexture, 0);
        
        // Add to scene and enable physics
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Visual scale: Increase hero map sprite size by 35% (from 64px to ~86.4px)
        this.setScale(1.35);

        // Phaser Arcade physics body scales with sprite scale (body.width = sourceWidth * scale).
        this.setCollideWorldBounds(true);
        this.setBodySize(32, 32, true);
        this.setDepth(10);

        // Setup WASD keys
        if (scene.input.keyboard) {
            this.wasdKeys = scene.input.keyboard.addKeys({
                W: Phaser.Input.Keyboard.KeyCodes.W,
                A: Phaser.Input.Keyboard.KeyCodes.A,
                S: Phaser.Input.Keyboard.KeyCodes.S,
                D: Phaser.Input.Keyboard.KeyCodes.D
            }) as any;
        }

        // Initialize Sprint 27 visual equipment infusion & flowing cape layers
        this.initVisualLayers();
    }

    /**
     * Initializes visual overlay sprites for cape, armor, circlet, shield, and weapon.
     */
    public initVisualLayers() {
        if (!this.scene) return;

        // Clean up any existing overlay layers
        this.destroyVisualLayers();

        // 1. Flowing Cape (Melodie's player.png already includes her hand-drawn cloak; hidden to prevent visual conflict)
        const capeTexture = this.scene.textures.exists('cape_flowing_0') ? 'cape_flowing_0' : 'spark_particle';
        this.capeSprite = this.scene.add.sprite(this.x, this.y, capeTexture);
        this.capeSprite.setScale(1.35);
        this.capeSprite.setDepth(this.depth - 1);
        this.capeSprite.setVisible(false);

        // 2. Armor Overlay (depth + 1)
        // Use the same gender-specific walk spritesheet as the base sprite so frame indices
        // match exactly in every direction. ADD blend mode: infusion color glows additively
        // on top of Melodie's art without washing out hair or skin tones.
        const gender = GameManager.instance.getPlayerGender();
        let armorBaseTexture = 'player';
        if (gender === 'female') {
            if (this.scene.textures.exists('player_female_walk')) armorBaseTexture = 'player_female_walk';
            else if (this.scene.textures.exists('player_female')) armorBaseTexture = 'player_female';
        } else {
            if (this.scene.textures.exists('player_walk')) armorBaseTexture = 'player_walk';
        }
        this.armorSprite = this.scene.add.sprite(this.x, this.y, armorBaseTexture);
        this.armorSprite.setScale(1.35);
        this.armorSprite.setAlpha(0);
        this.armorSprite.setBlendMode(Phaser.BlendModes.ADD);
        this.armorSprite.setDepth(this.depth + 1);

        // 3. Circlet Headwear (depth + 2, sleek browband sitting directly across hero forehead)
        const circletTexture = this.scene.textures.exists('helmet_circlet_silver') ? 'helmet_circlet_silver' : 'player';
        this.helmetSprite = this.scene.add.sprite(this.x, this.y - 12, circletTexture);
        this.helmetSprite.setScale(1.2);
        this.helmetSprite.setDepth(this.depth + 2);

        // 4. Off-Hand Shield (depth + 3, default shield visible)
        const shieldTexture = this.scene.textures.exists('shield_silver') ? 'shield_silver' : 'player';
        this.shieldSprite = this.scene.add.sprite(this.x - 16, this.y + 4, shieldTexture);
        this.shieldSprite.setScale(0.85);
        this.shieldSprite.setDepth(this.depth + 3);

        // 5. Main-Hand Weapon (depth + 4, anchored precisely at hero's hand grip and angled naturally)
        const swordCrystal = GameManager.instance.getState().equippedCrystals.sword;
        let defaultTexture = 'sword_bronze';
        if (swordCrystal === 'bat') {
            defaultTexture = 'sword_winged';
        } else if (swordCrystal) {
            defaultTexture = 'sword_silver';
        }
        const weaponTexture = this.scene.textures.exists(defaultTexture) ? defaultTexture : 'sword_bronze';
        this.weaponSprite = this.scene.add.sprite(this.x + 11, this.y + 10, weaponTexture);
        this.weaponSprite.setScale(0.68);
        this.weaponSprite.setOrigin(0.5, 0.20);
        this.weaponSprite.setRotation(0.52);
        this.weaponSprite.setDepth(this.depth + 4);

        // Apply infusion tints and texture keys from GameManager state
        this.refreshLayers();
        this.syncLayerPositions();
    }

    /**
     * Refreshes layer textures and infusion tints matching current equipped crystals.
     */
    public refreshLayers() {
        const state = GameManager.instance.getState();
        const crystals = state.equippedCrystals;
        this.lastEquippedCrystals = { ...crystals };

        // Cape tint (matches armor essence; keep hidden to preserve Melodie's drawn cloak)
        if (this.capeSprite) {
            const capeTint = CharacterLayerCompositor.getInfusionTint(crystals.armor);
            this.capeSprite.setTint(capeTint);
            this.capeSprite.setVisible(false);
        }

        // Armor overlay: additive glow using the player silhouette tinted by infusion color.
        // ADD blend ensures the glow is clearly visible regardless of background color.
        if (this.armorSprite) {
            if (crystals.armor) {
                const armorTint = CharacterLayerCompositor.getInfusionTint(crystals.armor);
                this.armorSprite.setTint(armorTint);
                this.armorSprite.setAlpha(0.5);
                this.armorSprite.setBlendMode(Phaser.BlendModes.ADD);
                this.armorSprite.setVisible(true);
            } else {
                this.armorSprite.setAlpha(0);
                this.armorSprite.setVisible(false);
            }
        }

        // Circlet headwear and tint (only visible when an infused helmet is equipped)
        if (this.helmetSprite) {
            if (crystals.helmet) {
                const rawCirclet = `helmet_circlet_${crystals.helmet}`;
                const sanitizedCirclet = CharacterLayerCompositor.validateAndSanitizeHeadwear(rawCirclet);
                if (this.scene.textures.exists(sanitizedCirclet)) {
                    this.helmetSprite.setTexture(sanitizedCirclet);
                }
                const helmetTint = CharacterLayerCompositor.getInfusionTint(crystals.helmet);
                this.helmetSprite.setTint(helmetTint);
                this.helmetSprite.setVisible(true);
            } else {
                this.helmetSprite.setVisible(false);
            }
        }

        // Shield overlay, texture, and tint (Default shield is always equipped and visible)
        if (this.shieldSprite) {
            let shieldTex = 'shield_silver';
            if (crystals.shield === 'bat') {
                shieldTex = 'shield_winged';
            }
            if (this.scene.textures.exists(shieldTex)) {
                this.shieldSprite.setTexture(shieldTex);
            }
            const shieldTint = CharacterLayerCompositor.getInfusionTint(crystals.shield);
            this.shieldSprite.setTint(shieldTint);
            this.shieldSprite.setVisible(true);
        }

        // Weapon overlay, texture, and tint (Dynamically updates to sword_winged for bat, sword_bronze for uninfused)
        if (this.weaponSprite) {
            let swordTex = 'sword_bronze';
            if (crystals.sword === 'bat') {
                swordTex = 'sword_winged';
            } else if (crystals.sword === 'phoenix' && this.scene.textures.exists('sword_flame')) {
                swordTex = 'sword_flame';
            } else if (crystals.sword) {
                swordTex = 'sword_silver';
            }
            if (this.scene.textures.exists(swordTex)) {
                this.weaponSprite.setTexture(swordTex);
            }
            const swordTint = CharacterLayerCompositor.getInfusionTint(crystals.sword);
            this.weaponSprite.setTint(swordTint);
            this.weaponSprite.setVisible(true);
        }
    }

    /**
     * Synchronizes all layer sprite positions, depths, and facing with player transform and direction.
     */
    public syncLayerPositions() {
        const dir = this.facingDirection;
        const state = GameManager.instance.getState();
        const crystals = state.equippedCrystals;

        if (this.capeSprite) {
            this.capeSprite.setPosition(this.x, this.y);
            this.capeSprite.setDepth(this.depth - 1);
            this.capeSprite.setVisible(false);
        }

        if (this.armorSprite && this.armorSprite.visible) {
            this.armorSprite.setPosition(this.x, this.y);
            this.armorSprite.setDepth(this.depth + 1);
            if (this.anims.isPlaying && this.anims.currentAnim) {
                if (this.armorSprite.anims && this.armorSprite.anims.currentAnim?.key !== this.anims.currentAnim.key) {
                    this.armorSprite.anims.play(this.anims.currentAnim.key, true);
                }
            } else if (this.frame) {
                this.armorSprite.anims.stop();
                this.armorSprite.setFrame(this.frame.name);
            }
        }

        if (this.helmetSprite) {
            if (!crystals.helmet) {
                this.helmetSprite.setVisible(false);
            } else {
                this.helmetSprite.setVisible(true);
                if (dir === 'down') {
                    this.helmetSprite.setPosition(this.x, this.y - 12);
                    this.helmetSprite.setScale(1.2);
                    this.helmetSprite.setDepth(this.depth + 2);
                } else if (dir === 'left') {
                    this.helmetSprite.setPosition(this.x - 3, this.y - 12);
                    this.helmetSprite.setScale(1.1, 1.2);
                    this.helmetSprite.setDepth(this.depth + 2);
                } else if (dir === 'right') {
                    this.helmetSprite.setPosition(this.x + 3, this.y - 12);
                    this.helmetSprite.setScale(1.1, 1.2);
                    this.helmetSprite.setDepth(this.depth + 2);
                } else if (dir === 'up') {
                    this.helmetSprite.setPosition(this.x, this.y - 12);
                    this.helmetSprite.setScale(1.1, 1.2);
                    this.helmetSprite.setDepth(this.depth + 2);
                }
            }
        }

        if (this.shieldSprite) {
            if (dir === 'down') {
                this.shieldSprite.setPosition(this.x - 10, this.y + 6);
                this.shieldSprite.setScale(0.65);
                this.shieldSprite.setDepth(this.depth + 3);
            } else if (dir === 'left') {
                this.shieldSprite.setPosition(this.x - 8, this.y + 6);
                this.shieldSprite.setScale(0.60, 0.65);
                this.shieldSprite.setDepth(this.depth + 3);
            } else if (dir === 'right') {
                this.shieldSprite.setPosition(this.x - 4, this.y + 6);
                this.shieldSprite.setScale(0.50, 0.65);
                this.shieldSprite.setDepth(this.depth - 1);
            } else if (dir === 'up') {
                this.shieldSprite.setPosition(this.x - 8, this.y + 4);
                this.shieldSprite.setScale(0.55, 0.65);
                this.shieldSprite.setDepth(this.depth - 1);
            }
        }

        if (this.weaponSprite) {
            if (dir === 'down') {
                this.weaponSprite.setPosition(this.x + 9, this.y + 8);
                this.weaponSprite.setOrigin(0.5, 0.20);
                this.weaponSprite.setScale(0.58);
                this.weaponSprite.setRotation(0.45);
                this.weaponSprite.setDepth(this.depth + 4);
            } else if (dir === 'right') {
                this.weaponSprite.setPosition(this.x + 8, this.y + 6);
                this.weaponSprite.setOrigin(0.5, 0.20);
                this.weaponSprite.setScale(0.58);
                this.weaponSprite.setRotation(0.40);
                this.weaponSprite.setDepth(this.depth + 4);
            } else if (dir === 'left') {
                this.weaponSprite.setPosition(this.x + 4, this.y + 6);
                this.weaponSprite.setOrigin(0.5, 0.20);
                this.weaponSprite.setScale(0.52);
                this.weaponSprite.setRotation(-0.35);
                this.weaponSprite.setDepth(this.depth - 1);
            } else if (dir === 'up') {
                this.weaponSprite.setPosition(this.x + 8, this.y + 3);
                this.weaponSprite.setOrigin(0.5, 0.20);
                this.weaponSprite.setScale(0.52);
                this.weaponSprite.setRotation(0.20);
                this.weaponSprite.setDepth(this.depth - 1);
            }
        }
    }

    /**
     * Override setPosition to keep all child overlays in instant lock-step.
     */
    public setPosition(x?: number, y?: number, z?: number, w?: number): this {
        super.setPosition(x, y, z, w);
        this.syncLayerPositions();
        return this;
    }

    public setMoveTarget(x: number, y: number, onArrive?: () => void, isInteractable: boolean = false) {
        this.moveTarget = { x, y, onArrive, isInteractable };
    }

    public clearMoveTarget() {
        this.moveTarget = null;
    }

    public hasMoveTarget(): boolean {
        return this.moveTarget !== null;
    }

    public getMoveTarget(): { x: number; y: number } | null {
        return this.moveTarget ? { x: this.moveTarget.x, y: this.moveTarget.y } : null;
    }

    public resetInput() {
        if (this.body) {
            this.setVelocity(0);
        }
        this.isMoving = false;
        this.moveTarget = null;
        if (this.wasdKeys) {
            this.wasdKeys.W.reset();
            this.wasdKeys.A.reset();
            this.wasdKeys.S.reset();
            this.wasdKeys.D.reset();
        }
        this.syncLayerPositions();
    }

    public updateMove(cursors: Phaser.Types.Input.Keyboard.CursorKeys, speed: number = 200, delta: number = 16) {
        if (!this.body) return;

        // Detect dynamic crystal changes in real-time
        const currentCrystals = GameManager.instance.getState().equippedCrystals;
        if (
            currentCrystals.sword !== this.lastEquippedCrystals.sword ||
            currentCrystals.shield !== this.lastEquippedCrystals.shield ||
            currentCrystals.armor !== this.lastEquippedCrystals.armor ||
            currentCrystals.helmet !== this.lastEquippedCrystals.helmet
        ) {
            this.refreshLayers();
        }

        // Advance animation timer
        this.elapsedAnimationTime += delta;

        // Reset velocity
        this.setVelocity(0);

        // Check Keyboard inputs (Arrows or WASD)
        let moveLeft = cursors.left?.isDown || this.wasdKeys?.A?.isDown;
        let moveRight = cursors.right?.isDown || this.wasdKeys?.D?.isDown;
        let moveUp = cursors.up?.isDown || this.wasdKeys?.W?.isDown;
        let moveDown = cursors.down?.isDown || this.wasdKeys?.S?.isDown;

        // Check Gamepad inputs (Xbox Controller D-pad or Analogs)
        const gamepadPlugin = this.scene.input.gamepad;
        const pad = (gamepadPlugin && gamepadPlugin.total > 0) ? gamepadPlugin.getPad(0) : null;
        if (pad) {
            if (pad.left) moveLeft = true;
            if (pad.right) moveRight = true;
            if (pad.up) moveUp = true;
            if (pad.down) moveDown = true;

            const stickX = (pad.axes && pad.axes[0]) ? pad.axes[0].value : 0;
            const stickY = (pad.axes && pad.axes[1]) ? pad.axes[1].value : 0;
            if (stickX < -0.3) moveLeft = true;
            if (stickX > 0.3) moveRight = true;
            if (stickY < -0.3) moveUp = true;
            if (stickY > 0.3) moveDown = true;
        }

        // Check Touch Controls (Virtual D-Pad if enabled)
        const touch = TouchControls.instance.getState();
        if (touch.left) moveLeft = true;
        if (touch.right) moveRight = true;
        if (touch.up) moveUp = true;
        if (touch.down) moveDown = true;

        const manualInput = moveLeft || moveRight || moveUp || moveDown;
        if (manualInput) {
            // Manual keyboard/gamepad/dpad input instantly clears any tap-to-move target
            this.moveTarget = null;
        }

        // Check Sprint boost
        let effectiveSpeed = speed;
        const isGamepadSprinting = pad ? (pad.buttons && pad.buttons[1] && (typeof pad.buttons[1] === 'object' ? pad.buttons[1].pressed : pad.buttons[1] === 1.0)) : false;
        if (touch.isSprinting || isGamepadSprinting) {
            effectiveSpeed = Math.round(speed * 1.5); // 200 -> 300
        }

        let vx = 0;
        let vy = 0;

        if (manualInput) {
            if (moveLeft) vx -= 1;
            if (moveRight) vx += 1;
            if (moveUp) vy -= 1;
            if (moveDown) vy += 1;

            this.isMoving = (vx !== 0 || vy !== 0);

            if (vx !== 0 && vy !== 0) {
                const diagSpeed = effectiveSpeed * 0.70710678;
                this.setVelocity(vx * diagSpeed, vy * diagSpeed);
            } else {
                this.setVelocity(vx * effectiveSpeed, vy * effectiveSpeed);
            }

            // Update facing direction (cardinal priority)
            if (moveDown) {
                this.facingDirection = 'down';
            } else if (moveUp) {
                this.facingDirection = 'up';
            } else if (moveLeft) {
                this.facingDirection = 'left';
            } else if (moveRight) {
                this.facingDirection = 'right';
            }
        } else if (this.moveTarget) {
            // Process Tap-to-Move / Tap-to-Target navigation
            const dx = this.moveTarget.x - this.x;
            const dy = this.moveTarget.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const arriveThreshold = this.moveTarget.isInteractable ? 38 : 8;

            if (dist <= arriveThreshold) {
                // Arrived at destination waypoint
                this.setVelocity(0, 0);
                this.isMoving = false;
                const onArrive = this.moveTarget.onArrive;
                this.moveTarget = null;
                if (onArrive) {
                    onArrive();
                }
            } else {
                // Steer towards target waypoint
                this.isMoving = true;
                const ratio = effectiveSpeed / dist;
                vx = dx * ratio;
                vy = dy * ratio;
                this.setVelocity(vx, vy);

                // Set facing direction towards primary axis of travel
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.facingDirection = dx > 0 ? 'right' : 'left';
                } else {
                    this.facingDirection = dy > 0 ? 'down' : 'up';
                }
            }
        } else {
            this.isMoving = false;
            this.setVelocity(0, 0);
        }

        this.setFlipX(false);

        // Update 4-directional walk animations
        const gender = GameManager.instance.getPlayerGender();
        const prefix = gender === 'female' ? 'cora' : 'valen';

        if (this.isMoving) {
            const targetAnim = `${prefix}_walk_${this.facingDirection}`;
            if (this.scene.anims.exists(targetAnim)) {
                if (this.anims.currentAnim?.key !== targetAnim || !this.anims.isPlaying) {
                    this.anims.play(targetAnim, true);
                }
            }
        } else {
            const targetIdle = `${prefix}_idle_${this.facingDirection}`;
            if (this.scene.anims.exists(targetIdle)) {
                if (this.anims.currentAnim?.key !== targetIdle || !this.anims.isPlaying) {
                    this.anims.play(targetIdle, true);
                }
            } else {
                this.anims.stop();
                const frameMap: Record<string, number> = { down: 4, left: 12, right: 20, up: 28 };
                const targetFrame = frameMap[this.facingDirection] ?? 4;
                this.setFrame(targetFrame);
            }
        }

        // Update Flowing Cape 4-frame retro animation
        if (this.capeSprite) {
            const capeFrame = CharacterLayerCompositor.getCapeFrame(this.elapsedAnimationTime, this.isMoving);
            const targetCapeKey = `cape_flowing_${capeFrame}`;
            if (this.scene.textures.exists(targetCapeKey)) {
                this.capeSprite.setTexture(targetCapeKey);
            }
        }

        // Sync all layer positions to player transform
        this.syncLayerPositions();
    }

    /**
     * Cleanly destroy all overlay layers upon player removal or scene switch.
     */
    private destroyVisualLayers() {
        if (this.capeSprite) {
            this.capeSprite.destroy();
            this.capeSprite = null;
        }
        if (this.armorSprite) {
            this.armorSprite.destroy();
            this.armorSprite = null;
        }
        if (this.helmetSprite) {
            this.helmetSprite.destroy();
            this.helmetSprite = null;
        }
        if (this.shieldSprite) {
            this.shieldSprite.destroy();
            this.shieldSprite = null;
        }
        if (this.weaponSprite) {
            this.weaponSprite.destroy();
            this.weaponSprite = null;
        }
    }

    /**
     * Sprint 28: Dynamically switch the player sprite to male or female art.
     */
    public setGender(gender: 'male' | 'female') {
        let targetKey = 'player';
        if (gender === 'female') {
            if (this.scene.textures.exists('player_female_walk')) {
                targetKey = 'player_female_walk';
            } else if (this.scene.textures.exists('player_female')) {
                targetKey = 'player_female';
            }
        } else {
            if (this.scene.textures.exists('player_walk')) {
                targetKey = 'player_walk';
            } else if (this.scene.textures.exists('player')) {
                targetKey = 'player';
            }
        }
        this.setTexture(targetKey);
        // Armor overlay mirrors base texture
        if (this.armorSprite) {
            this.armorSprite.setTexture(targetKey);
        }
        const prefix = gender === 'female' ? 'cora' : 'valen';
        const targetAnim = this.isMoving ? `${prefix}_walk_${this.facingDirection}` : `${prefix}_idle_${this.facingDirection}`;
        if (this.scene.anims.exists(targetAnim)) {
            this.anims.play(targetAnim, true);
        }
    }

    public destroy(fromScene?: boolean) {
        this.destroyVisualLayers();
        super.destroy(fromScene);
    }
}
