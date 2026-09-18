import Phaser from 'phaser';
import type { EquipmentSlot } from './GameManager';
import { CharacterLayerCompositor } from './CharacterLayerCompositor';
import type { LayerDescriptor } from './CharacterLayerCompositor';

export interface LayeredRendererOptions {
    equippedCrystals?: Partial<Record<EquipmentSlot, string | null>>;
    selectedVariants?: Partial<Record<EquipmentSlot, string>>;
    scale?: number;
    animateCape?: boolean;
    isMoving?: boolean;
    depth?: number;
    // Sprint 28: Hero gender for base sprite selection
    gender?: 'male' | 'female';
}

/**
 * LayeredCharacterRenderer: Phaser 3 display container rendering the protagonist
 * with modular equipment infusion layers, circlet headwear, and 4-frame retro flowing cape.
 * Used for TitleScene save slot previews, MenuScene inspection, and player showcases.
 */
export class LayeredCharacterRenderer extends Phaser.GameObjects.Container {
    private options: LayeredRendererOptions;
    private layerSprites: Map<string, Phaser.GameObjects.Sprite | Phaser.GameObjects.Image> = new Map();
    private capeAnimTimer: Phaser.Time.TimerEvent | null = null;
    private elapsedMs: number = 0;
    private isMovingState: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number, options: LayeredRendererOptions = {}) {
        super(scene, x, y);
        this.options = {
            scale: 1.0,
            animateCape: true,
            isMoving: false,
            depth: 10,
            ...options
        };

        this.setScale(this.options.scale || 1.0);
        this.setDepth(this.options.depth || 10);
        this.isMovingState = !!this.options.isMoving;

        scene.add.existing(this);
        this.buildLayers();

        if (this.options.animateCape) {
            this.startCapeAnimation();
        }
    }

    /**
     * Builds and attaches all composited visual layers to this container.
     */
    public buildLayers() {
        // Clean up previous child sprites
        this.layerSprites.forEach(sprite => sprite.destroy());
        this.layerSprites.clear();
        this.removeAll(true);

        const descriptors = CharacterLayerCompositor.getCompositedLayers({
            equippedCrystals: this.options.equippedCrystals,
            selectedVariants: this.options.selectedVariants,
            isMoving: this.isMovingState,
            elapsedMs: this.elapsedMs,
            flipX: false,
            gender: this.options.gender || 'male'
        });

        // Sort descriptors by depthOffset so cape (-1) stays underneath, followed by base (0), armor (1), etc.
        descriptors.sort((a, b) => a.depthOffset - b.depthOffset);

        descriptors.forEach(desc => {
            const textureKey = this.scene.textures.exists(desc.assetKey) ? desc.assetKey : this.getFallbackTexture(desc);
            const sprite = this.scene.add.sprite(desc.offsetX, desc.offsetY, textureKey);
            if (desc.originX !== undefined && desc.originY !== undefined) {
                sprite.setOrigin(desc.originX, desc.originY);
            }
            if (desc.rotation !== undefined) {
                sprite.setRotation(desc.rotation);
            }
            sprite.setTint(desc.tint);
            sprite.setAlpha(desc.alpha);
            sprite.setScale(desc.scaleX, desc.scaleY);

            // Melodie already drew the hero's cape directly on the base sprite; hide duplicate overlay
            if (desc.type === 'cape') {
                sprite.setVisible(false);
            }

            this.add(sprite);
            this.layerSprites.set(desc.type, sprite);
        });
    }

    /**
     * Fallback texture lookup if a specific artwork texture is not yet loaded into cache.
     */
    private getFallbackTexture(desc: LayerDescriptor): string {
        switch (desc.type) {
            case 'cape':
                return 'spark_particle';
            case 'base':
                // Sprint 28: female protagonist uses player_female, male uses player
                return (this.options.gender === 'female' && this.scene.textures.exists('player_female'))
                    ? 'player_female' : 'player';
            case 'helmet':
                return 'helmet_circlet_silver';
            case 'armor':
                return 'armor_royal_plate';
            case 'shield':
                return 'shield_silver';
            case 'sword':
                return 'sword_winged';
            default:
                return 'player';
        }
    }

    /**
     * Starts the 4-frame flowing cape retro animation loop.
     */
    private startCapeAnimation() {
        if (this.capeAnimTimer) {
            this.capeAnimTimer.remove();
        }

        this.capeAnimTimer = this.scene.time.addEvent({
            delay: 150,
            loop: true,
            callback: () => {
                this.elapsedMs += 150;
                const capeFrame = CharacterLayerCompositor.getCapeFrame(this.elapsedMs, this.isMovingState);
                const capeSprite = this.layerSprites.get('cape') as Phaser.GameObjects.Sprite;
                const targetKey = `cape_flowing_${capeFrame}`;

                if (capeSprite && this.scene && this.scene.textures.exists(targetKey)) {
                    capeSprite.setTexture(targetKey);
                }
            }
        });
    }

    /**
     * Updates equipped infusion crystals or artwork variants dynamically.
     */
    public updateLayers(
        equippedCrystals?: Partial<Record<EquipmentSlot, string | null>>,
        gender?: 'male' | 'female',
        selectedVariants?: Partial<Record<EquipmentSlot, string>>,
        isMoving?: boolean
    ) {
        if (equippedCrystals !== undefined) {
            this.options.equippedCrystals = { ...equippedCrystals };
        }
        if (gender !== undefined) {
            this.options.gender = gender;
        }
        if (selectedVariants !== undefined) {
            this.options.selectedVariants = { ...selectedVariants };
        }
        if (isMoving !== undefined) {
            this.isMovingState = isMoving;
        }

        this.buildLayers();
    }

    /**
     * Flips character facing direction (left / right).
     */
    public setFacing(flipX: boolean) {
        this.layerSprites.forEach(sprite => {
            const currentScaleX = Math.abs(sprite.scaleX);
            sprite.setScale(flipX ? -currentScaleX : currentScaleX, sprite.scaleY);
        });
    }

    /**
     * Clean destruction of all attached timers, tweens, and child objects.
     */
    public destroy(fromScene?: boolean) {
        if (this.capeAnimTimer) {
            this.capeAnimTimer.remove();
            this.capeAnimTimer = null;
        }
        this.layerSprites.forEach(sprite => sprite.destroy());
        this.layerSprites.clear();
        super.destroy(fromScene);
    }
}
