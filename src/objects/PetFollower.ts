import Phaser from 'phaser';
import { GameManager } from '../systems/GameManager';
import type { PetCompanionState } from '../systems/GameManager';
import type { ElementType } from '../systems/ElementSystem';
import { SoundSynth } from '../systems/SoundSynth';
import { PetFollowerMath } from '../systems/PetFollowerMath';

export class PetFollower extends Phaser.GameObjects.Container {
    private trailHistory: { x: number; y: number }[] = [];
    private maxHistoryLength: number = 30;
    private followDelayFrames: number = 16;
    private snapDistanceThreshold: number = 380;
    private idleFollowDistance: number = 42;

    private shadowGfx: Phaser.GameObjects.Graphics;
    private auraGfx: Phaser.GameObjects.Graphics;
    private petVisual: Phaser.GameObjects.Text;
    private nameTag: Phaser.GameObjects.Text;

    private currentSpeciesId: string = '';
    private bobbingOffset: number = 0;
    private isReacting: boolean = false;

    public static computeTrailTarget = PetFollowerMath.computeTrailTarget;
    public static shouldSnap = PetFollowerMath.shouldSnap;
    public static interpolatePosition = PetFollowerMath.interpolatePosition;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        scene.add.existing(this);
        this.setDepth(9); // Just under or alongside player depth (10)

        // 1. Shadow beneath pet
        this.shadowGfx = scene.add.graphics();
        this.shadowGfx.fillStyle(0x000000, 0.4);
        this.shadowGfx.fillEllipse(0, 16, 28, 12);
        this.add(this.shadowGfx);

        // 2. Elemental Aura ring
        this.auraGfx = scene.add.graphics();
        this.add(this.auraGfx);

        // 3. Pet Visual (Charming iconic pet representation)
        this.petVisual = scene.add.text(0, 0, '🐾', {
            fontSize: '26px',
            align: 'center'
        });
        this.petVisual.setOrigin(0.5, 0.5);
        this.add(this.petVisual);

        // 4. Floating Companion Name Tag
        this.nameTag = scene.add.text(0, -22, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '11px',
            color: '#00f0ff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        this.nameTag.setOrigin(0.5, 0.5);
        this.add(this.nameTag);

        // Pre-fill history with spawn coordinate
        for (let i = 0; i < this.maxHistoryLength; i++) {
            this.trailHistory.push({ x, y });
        }

        this.refreshPetVisuals();
    }

    /**
     * Updates pet position, idle bobbing, and animation trail relative to player.
     */
    public updateFollow(
        time: number,
        _delta: number,
        playerX: number,
        playerY: number,
        wrapWidth: number = 0,
        wrapHeight: number = 0
    ) {
        const pet = GameManager.instance.getState().petCompanion;

        // If no pet equipped or pet is defeated, hide completely
        if (!pet || pet.isDefeated) {
            if (this.visible) this.setVisible(false);
            return;
        }

        if (!this.visible) {
            this.setVisible(true);
            this.setPosition(playerX - 32, playerY);
            this.trailHistory = [];
            for (let i = 0; i < this.maxHistoryLength; i++) {
                this.trailHistory.push({ x: playerX, y: playerY });
            }
        }

        // Species change check
        if (pet.speciesId !== this.currentSpeciesId) {
            this.refreshPetVisuals(pet);
        }

        // 1. Record player's current coordinate into trail history
        const lastEntry = this.trailHistory[this.trailHistory.length - 1];
        const distFromLast = lastEntry ? PetFollowerMath.computeDistance(playerX, playerY, lastEntry.x, lastEntry.y, wrapWidth, wrapHeight) : 999;
        if (!lastEntry || distFromLast > 2) {
            this.trailHistory.push({ x: playerX, y: playerY });
            if (this.trailHistory.length > this.maxHistoryLength) {
                this.trailHistory.shift();
            }
        }

        // 2. Compute distance from pet to player
        const distToPlayer = PetFollowerMath.computeDistance(playerX, playerY, this.x, this.y, wrapWidth, wrapHeight);

        // 3. Teleport/Snap if too far (e.g. portal warp or map transition)
        if (PetFollower.shouldSnap(distToPlayer, this.snapDistanceThreshold)) {
            this.setPosition(playerX - 28, playerY);
            this.trailHistory = [];
            for (let i = 0; i < this.maxHistoryLength; i++) {
                this.trailHistory.push({ x: playerX, y: playerY });
            }
            return;
        }

        // 4. Movement or Idle Bobbing
        if (distToPlayer > this.idleFollowDistance) {
            // Target coordinate from trail history
            const targetPos = PetFollower.computeTrailTarget(this.trailHistory, this.followDelayFrames);
            const nextPos = PetFollower.interpolatePosition(
                { x: this.x, y: this.y },
                targetPos,
                0.14,
                wrapWidth,
                wrapHeight
            );
            this.setPosition(nextPos.x, nextPos.y);

            // Flip X based on movement
            const dx = targetPos.x - this.x;
            if (dx < -1) {
                this.petVisual.setScale(-1, 1);
            } else if (dx > 1) {
                this.petVisual.setScale(1, 1);
            }
            this.bobbingOffset = 0;
            this.petVisual.setY(0);
        } else {
            // Idle bobbing sine wave (gentle floating effect)
            this.bobbingOffset = Math.sin(time * 0.005) * 5;
            this.petVisual.setY(this.bobbingOffset);
        }

        // Pulsing elemental aura
        this.updateAuraPulse(time, pet.signatureSkill?.element);
    }

    public refreshPetVisuals(overridePet?: PetCompanionState) {
        const pet = overridePet || GameManager.instance.getState().petCompanion;
        if (!pet) return;

        this.currentSpeciesId = pet.speciesId;
        this.nameTag.setText(`Lv.${pet.level} ${pet.name}`);

        // Custom icon mapping based on monster species
        let icon = '🐾';
        switch (pet.speciesId) {
            case 'keenkat': icon = '🐱'; break;
            case 'goblin': icon = '👺'; break;
            case 'snake': icon = '🐍'; break;
            case 'slime': icon = '💧'; break;
            case 'bat': icon = '🦇'; break;
            case 'skeleton': icon = '💀'; break;
            case 'phoenix': icon = '🔥'; break;
            case 'wolf':
            case 'direwolf': icon = '🐺'; break;
            case 'golem':
            case 'stone_golem': icon = '🗿'; break;
            case 'basilisk': icon = '🦎'; break;
            default: icon = '✨'; break;
        }
        this.petVisual.setText(icon);
    }

    private updateAuraPulse(time: number, element: ElementType = 'physical') {
        this.auraGfx.clear();
        
        let color = 0x00f0ff;
        switch (element) {
            case 'fire': color = 0xff4400; break;
            case 'water': color = 0x00aaff; break;
            case 'earth': color = 0x88bb44; break;
            case 'lightning': color = 0xffcc00; break;
            case 'cold': color = 0x99eeff; break;
            case 'poison': color = 0x33dd55; break;
            case 'dark': color = 0xaa44ff; break;
            case 'light': color = 0xffffaa; break;
        }

        const alpha = 0.35 + Math.sin(time * 0.004) * 0.15;
        const radius = 16 + Math.sin(time * 0.003) * 2;
        this.auraGfx.lineStyle(2, color, alpha);
        this.auraGfx.strokeCircle(0, 4, radius);
    }

    /**
     * Sprint 34: Interactive Petting Reaction with Hop Tween and Emote Balloons.
     */
    public playPettingReaction(): string {
        if (this.isReacting) return '';
        this.isReacting = true;

        const pet = GameManager.instance.getState().petCompanion;
        const petName = pet ? pet.name : 'Companion';

        // 1. Play happy sound chime
        SoundSynth.playPetChime();

        // 2. Play energetic hop animation
        this.scene.tweens.add({
            targets: this.petVisual,
            y: '-=18',
            duration: 160,
            yoyo: true,
            ease: 'Back.easeOut',
            repeat: 1,
            onComplete: () => {
                this.isReacting = false;
            }
        });

        // 3. Spawn floating Emote Balloon above pet
        const emoteList = ['❤️', '💖', '✨', '🐾', '🎶', '⭐'];
        const chosenEmote = emoteList[Phaser.Math.Between(0, emoteList.length - 1)];

        const balloonContainer = this.scene.add.container(this.x, this.y - 36);
        balloonContainer.setDepth(this.depth + 10);

        // Bubble background
        const bubbleBg = this.scene.add.graphics();
        bubbleBg.fillStyle(0xffffff, 0.95);
        bubbleBg.fillRoundedRect(-18, -18, 36, 30, 8);
        bubbleBg.lineStyle(2, 0x0f172a, 1);
        bubbleBg.strokeRoundedRect(-18, -18, 36, 30, 8);

        // Bubble tail pointing down to pet
        bubbleBg.fillStyle(0xffffff, 0.95);
        bubbleBg.fillTriangle(-4, 12, 4, 12, 0, 18);
        bubbleBg.lineStyle(2, 0x0f172a, 1);
        bubbleBg.lineBetween(-4, 12, 0, 18);
        bubbleBg.lineBetween(4, 12, 0, 18);
        balloonContainer.add(bubbleBg);

        const emoteText = this.scene.add.text(0, -4, chosenEmote, {
            fontSize: '18px',
            align: 'center'
        }).setOrigin(0.5, 0.5);
        balloonContainer.add(emoteText);

        balloonContainer.setScale(0.3);
        this.scene.tweens.add({
            targets: balloonContainer,
            scaleX: 1.15,
            scaleY: 1.15,
            y: this.y - 48,
            duration: 200,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: balloonContainer,
                    y: this.y - 75,
                    alpha: 0,
                    duration: 700,
                    ease: 'Power2',
                    onComplete: () => balloonContainer.destroy()
                });
            }
        });

        // 4. Return companion reaction flavor dialogue
        const reactions = [
            `${petName} chirps with joy and nuzzles warmly!`,
            `${petName} bounds happily, eyes gleaming with affection!`,
            `${petName} purrs softly in response to thy gentle touch!`,
            `${petName} leaps excitedly, ready for adventure at thy side!`
        ];
        return reactions[Phaser.Math.Between(0, reactions.length - 1)];
    }
}
