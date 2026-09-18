import Phaser from 'phaser';
import { AssetPipeline } from '../systems/AssetPipeline';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Create a visual loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
        
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: 'Loading Assets...',
            style: {
                font: '20px Arial',
                color: '#ffffff'
            }
        });
        loadingText.setOrigin(0.5, 0.5);

        this.load.on('progress', (value: number) => {
            progressBar.clear();
            progressBar.fillStyle(0x00ffcc, 1);
            progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
        });

        this.load.on('complete', () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            
            // Generate basic procedural textures for the JRPG prototype
            this.createProceduralTextures();
            this.createProtagonistAnimations();
            
            // Transition to the SplashScene
            this.scene.start('SplashScene');
        });

        // Initialize AssetPipeline registrations
        const pipeline = AssetPipeline.getInstance();

        // Preload 16-frame 4-directional protagonist spritesheets (64x64 px per frame)
        this.load.spritesheet('player_walk', 'assets/sprites/player_walk.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('player_female_walk', 'assets/sprites/player_female_walk.png', { frameWidth: 64, frameHeight: 64 });

        // 1. Handcrafted Sprite Assets (Exist on disk in assets/sprites/)
        const externalSprites: { key: string; path: string }[] = [
            { key: 'player', path: 'assets/sprites/player.png' },
            { key: 'player_female', path: 'assets/sprites/player_female.png' }, // Sprint 28: Cora Swift
            { key: 'sword_t', path: 'assets/sprites/sword_t.png' },
            { key: 'sword_winged', path: 'assets/sprites/sword_winged.png' },
            { key: 'sword_silver', path: 'assets/sprites/sword_silver.png' },
            { key: 'sword_bronze', path: 'assets/sprites/sword_bronze.png' },
            { key: 'grass_patch', path: 'assets/sprites/grass_patch.png' }     // Sprint 28: Grass Patch tile
        ];

        externalSprites.forEach(item => {
            pipeline.registerAsset(item.key, undefined, item.path);
            this.load.image(item.key, item.path);
        });

        // 2. Procedural Canvas Texture Keys (Generated in memory, zero HTTP 404s)
        const proceduralKeys = [
            'npc', 'enemy_goblin', 'grass_tile', 'wall_tile', 'goblin',
            'tall_grass_tile', 'path_tile', 'stone_tile', 'splash_bg_tile', 'spark_particle',
            'meteor', 'meteor_open', 'mountain_tile', 'forest_tile', 'hill_tile',
            'cave_entrance', 'meteor_hatch', 'save_altar', 'soul_altar', 'settler_scout',
            'settler_herbalist', 'settler_architect', 'animal_dog', 'animal_cat', 'animal_sheep',
            'town_lantern', 'town_crate', 'town_fence', 'town_flowers', 'settler_blacksmith',
            'settler_mystic', 'town_anvil', 'town_brazier', 'town_crystal', 'portal_signpost',
            'portal_rune_arch', 'portal_stone_gate', 'town_furnace', 'town_nexus_crystal',
            'town_bell_tower', 'settler_farmer', 'settler_merchant', 'town_cart',
            'portal_castle_gate', 'castle_wall_tile', 'castle_floor_tile', 'locked_dungeon_door',
            'dungeon_stairs_down', 'dungeon_stairs_up', 'dungeon_chest_closed', 'dungeon_chest_open',
            'castle_sentry', 'castle_herald', 'castle_valerie', 'castle_king',
            'slime', 'snake', 'bat', 'skeleton', 'phoenix'
        ];

        proceduralKeys.forEach(k => {
            pipeline.registerAsset(k);
        });

        pipeline.setUseExternalAssets(true);
        pipeline.loadExternalAssets(this);

        // Load planet image asset for intro
        this.load.image('planet', 'assets/planet.png');

        // Load Title Screen Music
        this.load.audio('title_music', 'assets/audio/soliloquy.mp3');

        // Add dummy asset loads so progress bar works
        // (In future we can load PNGs/audio here)
        for (let i = 0; i < 20; i++) {
            this.load.image('dummy_' + i, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
        }
    }

    private createProtagonistAnimations() {
        // Valen (Male Protagonist) Animations (8 frames per row, 4 rows = 32 frames)
        if (this.textures.exists('player_walk')) {
            // Row 0: Down
            if (!this.anims.exists('valen_walk_down')) {
                this.anims.create({
                    key: 'valen_walk_down',
                    frames: this.anims.generateFrameNumbers('player_walk', { start: 0, end: 3 }),
                    frameRate: 8,
                    repeat: -1
                });
            }
            if (!this.anims.exists('valen_idle_down')) {
                this.anims.create({
                    key: 'valen_idle_down',
                    frames: this.anims.generateFrameNumbers('player_walk', { start: 4, end: 7 }),
                    frameRate: 3,
                    repeat: -1
                });
            }
            // Row 1: Left
            if (!this.anims.exists('valen_walk_left')) {
                this.anims.create({
                    key: 'valen_walk_left',
                    frames: this.anims.generateFrameNumbers('player_walk', { start: 8, end: 11 }),
                    frameRate: 8,
                    repeat: -1
                });
            }
            if (!this.anims.exists('valen_idle_left')) {
                this.anims.create({
                    key: 'valen_idle_left',
                    frames: this.anims.generateFrameNumbers('player_walk', { start: 12, end: 15 }),
                    frameRate: 3,
                    repeat: -1
                });
            }
            // Row 2: Right
            if (!this.anims.exists('valen_walk_right')) {
                this.anims.create({
                    key: 'valen_walk_right',
                    frames: this.anims.generateFrameNumbers('player_walk', { start: 16, end: 19 }),
                    frameRate: 8,
                    repeat: -1
                });
            }
            if (!this.anims.exists('valen_idle_right')) {
                this.anims.create({
                    key: 'valen_idle_right',
                    frames: this.anims.generateFrameNumbers('player_walk', { start: 20, end: 23 }),
                    frameRate: 3,
                    repeat: -1
                });
            }
            // Row 3: Up
            if (!this.anims.exists('valen_walk_up')) {
                this.anims.create({
                    key: 'valen_walk_up',
                    frames: this.anims.generateFrameNumbers('player_walk', { start: 24, end: 27 }),
                    frameRate: 8,
                    repeat: -1
                });
            }
            if (!this.anims.exists('valen_idle_up')) {
                this.anims.create({
                    key: 'valen_idle_up',
                    frames: this.anims.generateFrameNumbers('player_walk', { start: 28, end: 31 }),
                    frameRate: 3,
                    repeat: -1
                });
            }
        }

        // Cora (Female Protagonist) Animations (8 frames per row, 4 rows = 32 frames)
        if (this.textures.exists('player_female_walk')) {
            // Row 0: Down
            if (!this.anims.exists('cora_walk_down')) {
                this.anims.create({
                    key: 'cora_walk_down',
                    frames: this.anims.generateFrameNumbers('player_female_walk', { start: 0, end: 3 }),
                    frameRate: 8,
                    repeat: -1
                });
            }
            if (!this.anims.exists('cora_idle_down')) {
                this.anims.create({
                    key: 'cora_idle_down',
                    frames: this.anims.generateFrameNumbers('player_female_walk', { start: 4, end: 7 }),
                    frameRate: 3,
                    repeat: -1
                });
            }
            // Row 1: Left
            if (!this.anims.exists('cora_walk_left')) {
                this.anims.create({
                    key: 'cora_walk_left',
                    frames: this.anims.generateFrameNumbers('player_female_walk', { start: 8, end: 11 }),
                    frameRate: 8,
                    repeat: -1
                });
            }
            if (!this.anims.exists('cora_idle_left')) {
                this.anims.create({
                    key: 'cora_idle_left',
                    frames: this.anims.generateFrameNumbers('player_female_walk', { start: 12, end: 15 }),
                    frameRate: 3,
                    repeat: -1
                });
            }
            // Row 2: Right
            if (!this.anims.exists('cora_walk_right')) {
                this.anims.create({
                    key: 'cora_walk_right',
                    frames: this.anims.generateFrameNumbers('player_female_walk', { start: 16, end: 19 }),
                    frameRate: 8,
                    repeat: -1
                });
            }
            if (!this.anims.exists('cora_idle_right')) {
                this.anims.create({
                    key: 'cora_idle_right',
                    frames: this.anims.generateFrameNumbers('player_female_walk', { start: 20, end: 23 }),
                    frameRate: 3,
                    repeat: -1
                });
            }
            // Row 3: Up
            if (!this.anims.exists('cora_walk_up')) {
                this.anims.create({
                    key: 'cora_walk_up',
                    frames: this.anims.generateFrameNumbers('player_female_walk', { start: 24, end: 27 }),
                    frameRate: 8,
                    repeat: -1
                });
            }
            if (!this.anims.exists('cora_idle_up')) {
                this.anims.create({
                    key: 'cora_idle_up',
                    frames: this.anims.generateFrameNumbers('player_female_walk', { start: 28, end: 31 }),
                    frameRate: 3,
                    repeat: -1
                });
            }
        }
    }

    private createProceduralTextures() {
        // 1. Create Player texture (procedural fallback if external sprite not loaded)
        if (!this.textures.exists('player')) {
            let canvas = this.textures.createCanvas('player', 64, 64);
            if (canvas) {
                let ctx = canvas.getContext();
                // Draw body (Blue Knight)
                ctx.fillStyle = '#3366ff';
                ctx.fillRect(8, 8, 48, 48);
                // Draw helmet visor
                ctx.fillStyle = '#333333';
                ctx.fillRect(16, 16, 32, 12);
                ctx.fillStyle = '#ffcc00'; // visor glow
                ctx.fillRect(24, 20, 16, 4);
                canvas.refresh();
            }
        }

        // Sprint 28: Female Protagonist fallback (Cora Swift — warm-toned silhouette)
        if (!this.textures.exists('player_female')) {
            const canvasF = this.textures.createCanvas('player_female', 64, 64);
            if (canvasF) {
                const ctxF = canvasF.getContext();
                // Body (traveling tunic with forest green cowl)
                ctxF.fillStyle = '#3a3438';
                ctxF.fillRect(16, 28, 32, 28);
                // Forest green cowl
                ctxF.fillStyle = '#658d3c';
                ctxF.fillRect(18, 26, 28, 10);
                // Gold brooch
                ctxF.fillStyle = '#ffd700';
                ctxF.fillRect(30, 29, 4, 4);
                // Head (Warm luminous peachy skin)
                ctxF.fillStyle = '#fce0d2';
                ctxF.beginPath();
                ctxF.arc(32, 16, 11, 0, Math.PI * 2);
                ctxF.fill();
                // Rosy blush cheeks
                ctxF.fillStyle = '#f09a9a';
                ctxF.fillRect(25, 18, 3, 2);
                ctxF.fillRect(36, 18, 3, 2);
                // Long flowing chestnut hair
                ctxF.fillStyle = '#7d4328';
                ctxF.fillRect(20, 8, 24, 8);
                ctxF.fillRect(18, 12, 6, 26);
                ctxF.fillRect(40, 12, 6, 26);
                // Hair caramel highlights
                ctxF.fillStyle = '#d9a788';
                ctxF.fillRect(24, 8, 16, 3);
                // Glowing golden amber eyes
                ctxF.fillStyle = '#ffcc00';
                ctxF.fillRect(27, 15, 3, 3);
                ctxF.fillRect(34, 15, 3, 3);
                canvasF.refresh();
            }
        }

        // Sprint 28: Grass Patch fallback (lush green blades)
        if (!this.textures.exists('grass_patch')) {
            const canvasG = this.textures.createCanvas('grass_patch', 64, 64);
            if (canvasG) {
                const ctxG = canvasG.getContext();
                // Base ground
                ctxG.fillStyle = '#2e7d32';
                ctxG.fillRect(0, 32, 64, 32);
                // Grass blades varied heights
                const blades = [
                    { x: 4, h: 22, c: '#4caf50' }, { x: 10, h: 18, c: '#388e3c' },
                    { x: 16, h: 26, c: '#66bb6a' }, { x: 22, h: 20, c: '#43a047' },
                    { x: 28, h: 24, c: '#4caf50' }, { x: 34, h: 16, c: '#81c784' },
                    { x: 40, h: 22, c: '#388e3c' }, { x: 46, h: 28, c: '#66bb6a' },
                    { x: 52, h: 18, c: '#4caf50' }, { x: 58, h: 22, c: '#43a047' },
                ];
                blades.forEach(b => {
                    ctxG.fillStyle = b.c;
                    ctxG.beginPath();
                    ctxG.moveTo(b.x, 32);
                    ctxG.lineTo(b.x + 3, 32 - b.h);
                    ctxG.lineTo(b.x + 6, 32);
                    ctxG.fill();
                });
                canvasG.refresh();
            }
        }


        // 2. Create NPC texture (Holographic Guide)
        let canvas = this.textures.createCanvas('npc', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Draw a glowing cyan translucent character body
            ctx.fillStyle = 'rgba(0, 255, 204, 0.4)';
            ctx.fillRect(12, 16, 40, 40);
            
            // Glowing cyan hood
            ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
            ctx.fillRect(16, 8, 32, 16);
            
            // Face glow
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(24, 14, 16, 6);
            
            // Add scanlines
            ctx.strokeStyle = 'rgba(0, 100, 150, 0.5)';
            ctx.lineWidth = 2;
            for (let y = 8; y < 56; y += 4) {
                ctx.beginPath();
                ctx.moveTo(8, y);
                ctx.lineTo(56, y);
                ctx.stroke();
            }
            
            // Outer borders
            ctx.strokeStyle = 'rgba(0, 255, 204, 0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(12, 16, 40, 40);
            ctx.strokeRect(16, 8, 32, 16);
            
            canvas.refresh();
        }

        // 3. Create Enemy texture (Goblin)
        canvas = this.textures.createCanvas('enemy_goblin', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#339933';
            ctx.fillRect(12, 12, 40, 40);
            // Red eyes
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(20, 20, 6, 6);
            ctx.fillRect(38, 20, 6, 6);
            // Sharp teeth
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(24, 36, 4, 4);
            ctx.fillRect(36, 36, 4, 4);
            canvas.refresh();
        }

        // 4. Tileset textures (Grass and Wall)
        canvas = this.textures.createCanvas('grass_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#557a2b';
            ctx.fillRect(0, 0, 64, 64);
            ctx.fillStyle = '#4d6e27'; // Dark spots
            ctx.fillRect(8, 8, 8, 8);
            ctx.fillRect(36, 24, 8, 8);
            ctx.fillRect(16, 44, 8, 8);
            canvas.refresh();
        }

        canvas = this.textures.createCanvas('wall_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#555555';
            ctx.fillRect(0, 0, 64, 64);
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, 64, 64);
            // Brick lines
            ctx.beginPath();
            ctx.moveTo(0, 32);
            ctx.lineTo(64, 32);
            ctx.moveTo(32, 0);
            ctx.lineTo(32, 32);
            ctx.moveTo(16, 32);
            ctx.lineTo(16, 64);
            ctx.moveTo(48, 32);
            ctx.lineTo(48, 64);
            ctx.stroke();
            canvas.refresh();
        }

        // 4b. Goblin texture (alias for overworld NPC compatibility)
        canvas = this.textures.createCanvas('goblin', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#339933';
            ctx.fillRect(12, 12, 40, 40);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(20, 20, 6, 6);
            ctx.fillRect(38, 20, 6, 6);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(24, 36, 4, 4);
            ctx.fillRect(36, 36, 4, 4);
            canvas.refresh();
        }

        // 4c. Tall Grass Tile
        canvas = this.textures.createCanvas('tall_grass_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#3f5d20'; // Darker green
            ctx.fillRect(0, 0, 64, 64);
            
            // Draw grass blades
            ctx.strokeStyle = '#273e13';
            ctx.lineWidth = 3;
            for (let i = 0; i < 4; i++) {
                let gx = 10 + i * 15;
                ctx.beginPath();
                ctx.moveTo(gx, 50);
                ctx.lineTo(gx + 5, 20);
                ctx.moveTo(gx + 5, 50);
                ctx.lineTo(gx - 5, 25);
                ctx.stroke();
            }
            canvas.refresh();
        }

        // 4d. Path Tile (Cobble brick texture)
        canvas = this.textures.createCanvas('path_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#7f8c8d'; // Slate grey
            ctx.fillRect(0, 0, 64, 64);
            
            ctx.strokeStyle = '#5d6d7e';
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                ctx.strokeRect(i * 16, 0, 16, 32);
                ctx.strokeRect((i * 16) - 8, 32, 16, 32);
            }
            canvas.refresh();
        }

        // 4e. Stone Tile (Dungeon floor)
        canvas = this.textures.createCanvas('stone_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#2c3e50'; // Deep blue slate
            ctx.fillRect(0, 0, 64, 64);
            
            ctx.strokeStyle = '#1a252f';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, 64, 64);
            
            // Cracks / texture detail
            ctx.strokeStyle = '#34495e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, 10);
            ctx.lineTo(25, 15);
            ctx.lineTo(30, 35);
            ctx.stroke();
            canvas.refresh();
        }

        // 5. Splash Background grid tile (64x64)
        canvas = this.textures.createCanvas('splash_bg_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Alternate tile pattern for grid look
            ctx.fillStyle = '#000000'; // Black
            ctx.fillRect(0, 0, 64, 64);
            
            // Navy Blue grid squares
            ctx.fillStyle = '#0a0a32'; 
            ctx.fillRect(0, 0, 32, 32);
            ctx.fillRect(32, 32, 32, 32);
            canvas.refresh();
        }

        // 6. Spark particle for splash screen title reveal (8x8)
        canvas = this.textures.createCanvas('spark_particle', 8, 8);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 8, 8);
            canvas.refresh();
        }

        // 7. Sword 'T' texture for the title logo (procedural fallback if external sprite not loaded)
        if (!this.textures.exists('sword_t')) {
            canvas = this.textures.createCanvas('sword_t', 64, 64);
            if (canvas) {
                let ctx = canvas.getContext();
                
                // Draw Blade (Steel Grey)
                ctx.fillStyle = '#b0b5bc';
                ctx.fillRect(29, 20, 6, 40);
                
                // Blade Tip
                ctx.beginPath();
                ctx.moveTo(29, 60);
                ctx.lineTo(35, 60);
                ctx.lineTo(32, 64);
                ctx.closePath();
                ctx.fillStyle = '#b0b5bc';
                ctx.fill();

                // Blade Central ridge line (Darker Steel Grey for 3D look)
                ctx.fillStyle = '#7a7e85';
                ctx.fillRect(32, 20, 3, 40);

                // Crossguard (Gold/Bronze) - The horizontal bar of the 'T'
                ctx.fillStyle = '#d4af37'; // Gold
                ctx.fillRect(12, 16, 40, 6);
                // Flanges on crossguard ends
                ctx.fillRect(10, 14, 2, 10);
                ctx.fillRect(52, 14, 2, 10);

                // Hilt Grip (Brown leather wrapping) - The top vertical stem of the 'T'
                ctx.fillStyle = '#8b5a2b'; // Brown
                ctx.fillRect(29, 4, 6, 12);
                // Grip ridges
                ctx.fillStyle = '#5c3a1a';
                ctx.fillRect(29, 7, 6, 2);
                ctx.fillRect(29, 11, 6, 2);

                // Pommel (Gold ring/circle at the top)
                ctx.beginPath();
                ctx.arc(32, 4, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#d4af37';
                ctx.fill();
                
                canvas.refresh();
            }
        }

        // 8. Meteor texture (Charcoal grey rock with magma fissures)
        canvas = this.textures.createCanvas('meteor', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            
            // Draw rock base (charcoal grey)
            ctx.beginPath();
            ctx.arc(32, 32, 24, 0, Math.PI * 2);
            ctx.fillStyle = '#3a3a3d';
            ctx.fill();
            ctx.strokeStyle = '#1e1e20';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Magma fissures (red/orange)
            ctx.strokeStyle = '#ff3300';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(18, 22);
            ctx.lineTo(32, 32);
            ctx.lineTo(46, 26);
            ctx.moveTo(32, 32);
            ctx.lineTo(28, 48);
            ctx.moveTo(32, 32);
            ctx.lineTo(44, 42);
            ctx.stroke();

            // Hot core center glow
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(30, 30, 4, 4);

            canvas.refresh();
        }

        // 9. Meteor Open texture (Hatch open)
        canvas = this.textures.createCanvas('meteor_open', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();

            // Draw rock base
            ctx.beginPath();
            ctx.arc(32, 32, 24, 0, Math.PI * 2);
            ctx.fillStyle = '#3a3a3d';
            ctx.fill();
            ctx.strokeStyle = '#1e1e20';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Dark open hatch doorway (pure black)
            ctx.fillStyle = '#050505';
            ctx.fillRect(22, 22, 20, 20);

            // Open metal door panel swinging to the left
            ctx.fillStyle = '#222224';
            ctx.fillRect(6, 22, 14, 20);
            ctx.strokeStyle = '#444446';
            ctx.lineWidth = 2;
            ctx.strokeRect(6, 22, 14, 20);

            // Magma cracks on the remaining rock surface
            ctx.strokeStyle = '#ff3300';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(18, 14);
            ctx.lineTo(24, 20);
            ctx.moveTo(44, 18);
            ctx.lineTo(40, 22);
            ctx.moveTo(32, 42);
            ctx.lineTo(30, 52);
            ctx.stroke();

            canvas.refresh();
        }

        // 10. Mountain texture (64x64)
        canvas = this.textures.createCanvas('mountain_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Grass base
            ctx.fillStyle = '#557a2b';
            ctx.fillRect(0, 0, 64, 64);
            
            // Draw mountain peak base (Grey rock)
            ctx.beginPath();
            ctx.moveTo(32, 8); // Peak
            ctx.lineTo(8, 56);  // Bottom-left
            ctx.lineTo(56, 56); // Bottom-right
            ctx.closePath();
            ctx.fillStyle = '#7a7f85';
            ctx.fill();
            
            // Draw mountain right side shadow (Darker grey)
            ctx.beginPath();
            ctx.moveTo(32, 8);
            ctx.lineTo(32, 56);
            ctx.lineTo(56, 56);
            ctx.closePath();
            ctx.fillStyle = '#585c61';
            ctx.fill();
            
            // Draw snow cap
            ctx.beginPath();
            ctx.moveTo(32, 8);
            ctx.lineTo(24, 24);
            ctx.lineTo(32, 28);
            ctx.lineTo(40, 24);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            // Draw rocky outlines
            ctx.strokeStyle = '#27292b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(32, 8);
            ctx.lineTo(8, 56);
            ctx.lineTo(56, 56);
            ctx.lineTo(32, 8);
            ctx.moveTo(32, 8);
            ctx.lineTo(32, 56);
            ctx.stroke();
            
            canvas.refresh();
        }

        // 11. Forest texture (64x64 overlapping trees)
        canvas = this.textures.createCanvas('forest_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Grass base
            ctx.fillStyle = '#557a2b';
            ctx.fillRect(0, 0, 64, 64);

            const drawTree = (tx: number, ty: number, scale: number) => {
                // Trunk
                ctx.fillStyle = '#5c3a1a';
                ctx.fillRect(tx - 3 * scale, ty + 10 * scale, 6 * scale, 10 * scale);
                
                // Leaf layers (Triangles)
                ctx.fillStyle = '#1b4314'; // Dark layer
                ctx.beginPath();
                ctx.moveTo(tx, ty - 10 * scale);
                ctx.lineTo(tx - 16 * scale, ty + 12 * scale);
                ctx.lineTo(tx + 16 * scale, ty + 12 * scale);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#225218'; // Medium layer
                ctx.beginPath();
                ctx.moveTo(tx, ty - 18 * scale);
                ctx.lineTo(tx - 12 * scale, ty + 2 * scale);
                ctx.lineTo(tx + 12 * scale, ty + 2 * scale);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = '#2d6a30'; // Highlight layer
                ctx.beginPath();
                ctx.moveTo(tx, ty - 26 * scale);
                ctx.lineTo(tx - 8 * scale, ty - 8 * scale);
                ctx.lineTo(tx + 8 * scale, ty - 8 * scale);
                ctx.closePath();
                ctx.fill();
                
                // Outline
                ctx.strokeStyle = '#0d1f0a';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(tx - 3 * scale, ty + 10 * scale, 6 * scale, 10 * scale);
                
                ctx.beginPath();
                ctx.moveTo(tx, ty - 26 * scale);
                ctx.lineTo(tx - 16 * scale, ty + 12 * scale);
                ctx.lineTo(tx + 16 * scale, ty + 12 * scale);
                ctx.closePath();
                ctx.stroke();
            };

            // Draw three trees: back-left, back-right, front-center
            drawTree(18, 30, 0.7);
            drawTree(46, 30, 0.7);
            drawTree(32, 42, 0.85);

            canvas.refresh();
        }

        // 12. Hill texture (64x64 rolling hills)
        canvas = this.textures.createCanvas('hill_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Grass base
            ctx.fillStyle = '#557a2b';
            ctx.fillRect(0, 0, 64, 64);

            // Draw back shadow hill (dark green)
            ctx.beginPath();
            ctx.arc(48, 64, 26, Math.PI, Math.PI * 2);
            ctx.fillStyle = '#4c6f28';
            ctx.fill();
            ctx.strokeStyle = '#273c13';
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            // Draw front main hill (lighter green)
            ctx.beginPath();
            ctx.arc(20, 64, 30, Math.PI, Math.PI * 2);
            ctx.fillStyle = '#658d3c';
            ctx.fill();
            ctx.stroke();
            
            // Accent grass tufts
            ctx.strokeStyle = '#273c13';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(14, 42); ctx.lineTo(12, 35);
            ctx.moveTo(14, 42); ctx.lineTo(17, 36);
            
            ctx.moveTo(44, 46); ctx.lineTo(42, 40);
            ctx.moveTo(44, 46); ctx.lineTo(46, 40);
            ctx.stroke();

            canvas.refresh();
        }

        // 13. Cave Entrance texture (64x64 mountain with cave opening)
        canvas = this.textures.createCanvas('cave_entrance', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Grass base
            ctx.fillStyle = '#557a2b';
            ctx.fillRect(0, 0, 64, 64);
            
            // Draw mountain peak base (Grey rock)
            ctx.beginPath();
            ctx.moveTo(32, 8); // Peak
            ctx.lineTo(8, 56);  // Bottom-left
            ctx.lineTo(56, 56); // Bottom-right
            ctx.closePath();
            ctx.fillStyle = '#7a7f85';
            ctx.fill();
            
            // Draw mountain right side shadow (Darker grey)
            ctx.beginPath();
            ctx.moveTo(32, 8);
            ctx.lineTo(32, 56);
            ctx.lineTo(56, 56);
            ctx.closePath();
            ctx.fillStyle = '#585c61';
            ctx.fill();
            
            // Draw snow cap
            ctx.beginPath();
            ctx.moveTo(32, 8);
            ctx.lineTo(24, 24);
            ctx.lineTo(32, 28);
            ctx.lineTo(40, 24);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // Cave opening (black arch at the bottom center)
            ctx.beginPath();
            ctx.moveTo(22, 56);
            ctx.lineTo(22, 44);
            ctx.arc(32, 44, 10, Math.PI, 0, false);
            ctx.lineTo(42, 56);
            ctx.closePath();
            ctx.fillStyle = '#111111';
            ctx.fill();
            
            // Draw rocky outlines
            ctx.strokeStyle = '#27292b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(32, 8);
            ctx.lineTo(8, 56);
            ctx.lineTo(56, 56);
            ctx.lineTo(32, 8);
            ctx.moveTo(32, 8);
            ctx.lineTo(32, 56);
            ctx.stroke();

            // Cave outline
            ctx.beginPath();
            ctx.moveTo(22, 56);
            ctx.lineTo(22, 44);
            ctx.arc(32, 44, 10, Math.PI, 0, false);
            ctx.lineTo(42, 56);
            ctx.stroke();
            
            canvas.refresh();
        }

        // 14. Meteor hatch door texture (20x20 metal cover panel)
        canvas = this.textures.createCanvas('meteor_hatch', 20, 20);
        if (canvas) {
            let ctx = canvas.getContext();
            // Solid metal grey panel
            ctx.fillStyle = '#3a3a3d';
            ctx.fillRect(0, 0, 20, 20);
            // Dark metal border outline
            ctx.strokeStyle = '#1e1e20';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, 20, 20);
            // Hot orange fissure accent line
            ctx.strokeStyle = '#ff3300';
            ctx.beginPath();
            ctx.moveTo(5, 5);
            ctx.lineTo(15, 15);
            ctx.stroke();
            canvas.refresh();
        }

        // 14b. Sprint 29: Crater Basalt Tile (Dark volcanic rock)
        canvas = this.textures.createCanvas('crater_basalt_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#1c1c24';
            ctx.fillRect(0, 0, 64, 64);
            // Jagged basalt polygons & cracks
            ctx.fillStyle = '#282834';
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(32, 8); ctx.lineTo(24, 36); ctx.lineTo(0, 28);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(32, 8); ctx.lineTo(64, 0); ctx.lineTo(64, 40); ctx.lineTo(38, 30);
            ctx.fill();
            ctx.strokeStyle = '#101015';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(12, 12); ctx.lineTo(28, 48); ctx.lineTo(54, 52);
            ctx.stroke();
            canvas.refresh();
        }

        // 14c. Sprint 29: Magma Fissure Tile (Cracked basalt with molten orange core)
        canvas = this.textures.createCanvas('magma_fissure_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#181820';
            ctx.fillRect(0, 0, 64, 64);
            // Glowing molten fissure
            ctx.strokeStyle = '#ff3300';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(0, 32); ctx.lineTo(20, 24); ctx.lineTo(44, 40); ctx.lineTo(64, 28);
            ctx.stroke();
            // Hot yellow inner core
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, 32); ctx.lineTo(20, 24); ctx.lineTo(44, 40); ctx.lineTo(64, 28);
            ctx.stroke();
            canvas.refresh();
        }

        // 14d. Sprint 29: Cobblestone Causeway Bridge Tile
        canvas = this.textures.createCanvas('cobblestone_bridge_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#64748b';
            ctx.fillRect(0, 0, 64, 64);
            // Stone cobble pattern
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 2;
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    ctx.strokeRect(c * 16 + (r % 2 === 0 ? 0 : 8), r * 16, 16, 16);
                }
            }
            // Wooden bridge railing borders on top & bottom
            ctx.fillStyle = '#451a03';
            ctx.fillRect(0, 0, 64, 4);
            ctx.fillRect(0, 60, 64, 4);
            canvas.refresh();
        }

        // 14e. Sprint 29: Sandbar Land Bridge Tile (Golden causeway)
        canvas = this.textures.createCanvas('sandbar_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#d97706';
            ctx.fillRect(0, 0, 64, 64);
            // Sand ripples
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(8, 12, 24, 4);
            ctx.fillRect(36, 32, 20, 4);
            ctx.fillRect(14, 48, 28, 4);
            canvas.refresh();
        }

        // 14f. Sprint 29: Floral Wildflower Field Tile
        canvas = this.textures.createCanvas('flora_flower_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#4d7c0f'; // Lush vibrant grass
            ctx.fillRect(0, 0, 64, 64);
            // Wildflower petals (Yellow, Cyan, Crimson, White)
            const flowers = [
                { x: 14, y: 18, c: '#facc15' },
                { x: 48, y: 16, c: '#38bdf8' },
                { x: 26, y: 44, c: '#f43f5e' },
                { x: 52, y: 48, c: '#ffffff' }
            ];
            flowers.forEach(f => {
                ctx.fillStyle = f.c;
                ctx.beginPath();
                ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#78350f';
                ctx.beginPath();
                ctx.arc(f.x, f.y, 1.5, 0, Math.PI * 2);
                ctx.fill();
            });
            canvas.refresh();
        }

        // 14g. Sprint 29: Water Shimmer Tile
        canvas = this.textures.createCanvas('water_shimmer_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = '#0369a1';
            ctx.fillRect(0, 0, 64, 64);
            // Water ripples
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(10, 20); ctx.lineTo(26, 20);
            ctx.moveTo(36, 44); ctx.lineTo(54, 44);
            ctx.stroke();
            canvas.refresh();
        }

        // 14h. Sprint 29: 2D Drop Shadow Texture (Soft Ambient Occlusion)
        canvas = this.textures.createCanvas('drop_shadow', 64, 32);
        if (canvas) {
            let ctx = canvas.getContext();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(32, 16, 28, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            canvas.refresh();
        }

        // 15. Save Altar / Data Console texture
        canvas = this.textures.createCanvas('save_altar', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Pedestal base
            ctx.fillStyle = '#1c1c28';
            ctx.fillRect(16, 28, 32, 36);
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 2;
            ctx.strokeRect(16, 28, 32, 36);
            
            // Slanted console screen
            ctx.fillStyle = '#00ffcc';
            ctx.beginPath();
            ctx.moveTo(12, 28);
            ctx.lineTo(52, 28);
            ctx.lineTo(46, 12);
            ctx.lineTo(18, 12);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            
            // Console screen details (data lines)
            ctx.fillStyle = '#000000';
            ctx.fillRect(20, 16, 24, 8);
            ctx.fillStyle = '#00ffcc';
            ctx.fillRect(22, 18, 12, 2);
            ctx.fillRect(22, 21, 6, 2);
            
            canvas.refresh();
        }

        // 16. Town Evolution: Soul Altar (64x64 stone plinth with glowing cyan runes and soul orb)
        canvas = this.textures.createCanvas('soul_altar', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Stepped obsidian / slate pedestal
            ctx.fillStyle = '#1b2631';
            ctx.fillRect(8, 48, 48, 12);
            ctx.fillStyle = '#212f3d';
            ctx.fillRect(14, 38, 36, 12);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(18, 30, 28, 10);

            // Runic inscriptions
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(22, 44);
            ctx.lineTo(26, 40);
            ctx.lineTo(30, 44);
            ctx.moveTo(34, 44);
            ctx.lineTo(38, 40);
            ctx.lineTo(42, 44);
            ctx.stroke();

            // Floating ethereal soul orb
            ctx.fillStyle = 'rgba(0, 255, 204, 0.3)';
            ctx.beginPath();
            ctx.arc(32, 18, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(32, 18, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(32, 16, 3, 0, Math.PI * 2);
            ctx.fill();

            canvas.refresh();
        }

        // 17. Town Settler: Scout Kira (64x64 hooded ranger with longbow)
        canvas = this.textures.createCanvas('settler_scout', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Forest cloak body
            ctx.fillStyle = '#1e3f1b';
            ctx.fillRect(16, 24, 32, 32);
            // Leather belt & buckle
            ctx.fillStyle = '#5c3a1a';
            ctx.fillRect(18, 38, 28, 5);
            ctx.fillStyle = '#d4af37';
            ctx.fillRect(30, 38, 4, 5);
            // Hood & cowl
            ctx.fillStyle = '#2d5a27';
            ctx.fillRect(20, 10, 24, 16);
            // Visor shadow & keen eyes
            ctx.fillStyle = '#0f1a0e';
            ctx.fillRect(24, 15, 16, 8);
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(26, 17, 3, 3);
            ctx.fillRect(35, 17, 3, 3);
            // Longbow slung on back
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(14, 32, 20, -Math.PI / 3, Math.PI / 3);
            ctx.stroke();
            // Arrow fletchings over shoulder
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(42, 12, 4, 10);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(43, 8, 2, 4);
            // Rugged travel boots
            ctx.fillStyle = '#3e2b17';
            ctx.fillRect(18, 54, 10, 8);
            ctx.fillRect(36, 54, 10, 8);

            canvas.refresh();
        }

        // 18. Town Settler: Herbalist Mira (64x64 emerald robes with potions & blossoms)
        canvas = this.textures.createCanvas('settler_herbalist', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Emerald and teal layered robes
            ctx.fillStyle = '#16a085';
            ctx.fillRect(16, 22, 32, 34);
            ctx.fillStyle = '#1abc9c';
            ctx.fillRect(22, 22, 20, 34);
            // Soft silver-lavender hair
            ctx.fillStyle = '#d5dbdb';
            ctx.fillRect(20, 8, 24, 18);
            // Kind face
            ctx.fillStyle = '#ffdbac';
            ctx.fillRect(24, 15, 16, 10);
            // Gentle eyes
            ctx.fillStyle = '#0e6655';
            ctx.fillRect(26, 18, 3, 3);
            ctx.fillRect(35, 18, 3, 3);
            // Starlight blossom garland in hair
            ctx.fillStyle = '#ff69b4';
            ctx.fillRect(18, 9, 5, 5);
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(41, 9, 5, 5);
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(30, 6, 4, 4);
            // Potion phials bandolier
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(18, 32, 28, 4);
            ctx.fillStyle = '#ff3366'; // Crimson healing elixir
            ctx.fillRect(22, 34, 5, 8);
            ctx.fillStyle = '#00ccff'; // Ethereal SP tonic
            ctx.fillRect(37, 34, 5, 8);
            // Robe hem / boots
            ctx.fillStyle = '#0e6655';
            ctx.fillRect(18, 54, 10, 8);
            ctx.fillRect(36, 54, 10, 8);

            canvas.refresh();
        }

        // 19. Town Settler: Architect Bowen (64x64 leather apron, drafting scroll & caliper)
        canvas = this.textures.createCanvas('settler_architect', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Rolled sleeves tunic
            ctx.fillStyle = '#e0dcd3';
            ctx.fillRect(14, 20, 36, 20);
            // Heavy leather craftsman apron
            ctx.fillStyle = '#a0522d';
            ctx.fillRect(20, 24, 24, 30);
            ctx.fillStyle = '#783f1d';
            ctx.fillRect(24, 18, 4, 10);
            ctx.fillRect(36, 18, 4, 10);
            // Rugged brown hair and beard
            ctx.fillStyle = '#4a2e18';
            ctx.fillRect(20, 8, 24, 18);
            ctx.fillStyle = '#ffdbac';
            ctx.fillRect(24, 14, 16, 10);
            ctx.fillStyle = '#4a2e18';
            ctx.fillRect(24, 20, 16, 6);
            // Focused eyes
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(26, 16, 3, 3);
            ctx.fillRect(35, 16, 3, 3);
            // Blueprint scroll rolled on back
            ctx.fillStyle = '#fdf2e9';
            ctx.fillRect(42, 14, 8, 26);
            ctx.fillStyle = '#2980b9';
            ctx.fillRect(43, 20, 6, 2);
            ctx.fillRect(43, 26, 6, 2);
            // Brass caliper / drafting compass in hand
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(14, 34);
            ctx.lineTo(18, 46);
            ctx.moveTo(14, 34);
            ctx.lineTo(10, 46);
            ctx.stroke();
            // Work boots
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(20, 54, 10, 8);
            ctx.fillRect(34, 54, 10, 8);

            canvas.refresh();
        }

        // 20. Domesticated Animal: Loyal Hound (64x64 golden coat, floppy ears, wagging tail)
        canvas = this.textures.createCanvas('animal_dog', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Warm golden-tan dog body
            ctx.fillStyle = '#d4a359';
            ctx.fillRect(18, 26, 28, 20);
            // Dog head
            ctx.fillStyle = '#d4a359';
            ctx.fillRect(36, 16, 18, 16);
            // Snout & black nose
            ctx.fillStyle = '#b8860b';
            ctx.fillRect(46, 22, 10, 10);
            ctx.fillStyle = '#111111';
            ctx.fillRect(52, 22, 4, 4);
            // Sparkly eye
            ctx.fillStyle = '#111111';
            ctx.fillRect(42, 18, 4, 4);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(43, 19, 2, 2);
            // Floppy ears
            ctx.fillStyle = '#8b5a17';
            ctx.fillRect(34, 16, 6, 12);
            // White chest fur
            ctx.fillStyle = '#fff8dc';
            ctx.fillRect(36, 30, 8, 12);
            // Red collar with gold bell tag
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(34, 28, 6, 4);
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(38, 30, 4, 4);
            // Four paws
            ctx.fillStyle = '#b8860b';
            ctx.fillRect(20, 46, 6, 12);
            ctx.fillRect(28, 46, 6, 12);
            ctx.fillRect(36, 46, 6, 12);
            ctx.fillRect(42, 46, 6, 12);
            // Happy wagging tail
            ctx.fillStyle = '#d4a359';
            ctx.beginPath();
            ctx.moveTo(18, 30);
            ctx.lineTo(8, 16);
            ctx.lineTo(12, 14);
            ctx.lineTo(20, 26);
            ctx.closePath();
            ctx.fill();

            canvas.refresh();
        }

        // 21. Domesticated Animal: Calico Cat (64x64 tri-colored coat with curled tail)
        canvas = this.textures.createCanvas('animal_cat', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // White base body
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(20, 32, 24, 18);
            // Ginger patch
            ctx.fillStyle = '#e67e22';
            ctx.fillRect(22, 32, 10, 10);
            // Charcoal black patch
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(32, 36, 10, 10);
            // Cat head
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(36, 22, 16, 14);
            // Ginger facial patch
            ctx.fillStyle = '#e67e22';
            ctx.fillRect(42, 22, 8, 8);
            // Pointed ears with pink inner
            ctx.fillStyle = '#e67e22';
            ctx.fillRect(36, 16, 6, 8);
            ctx.fillRect(46, 16, 6, 8);
            ctx.fillStyle = '#ffb6c1';
            ctx.fillRect(38, 18, 3, 5);
            ctx.fillRect(47, 18, 3, 5);
            // Vibrant emerald green eyes
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(42, 26, 3, 3);
            ctx.fillRect(48, 26, 3, 3);
            // Little paws
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(22, 48, 5, 8);
            ctx.fillRect(29, 48, 5, 8);
            ctx.fillRect(36, 48, 5, 8);
            ctx.fillRect(42, 48, 5, 8);
            // Arched curling tail
            ctx.strokeStyle = '#e67e22';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(20, 38);
            ctx.quadraticCurveTo(10, 36, 12, 22);
            ctx.stroke();

            canvas.refresh();
        }

        // 22. Domesticated Animal: Meadow Sheep (64x64 fluffy wool cloud, dark face & hooves)
        canvas = this.textures.createCanvas('animal_sheep', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Fluffy wool clusters
            ctx.fillStyle = '#f8f9f9';
            ctx.beginPath();
            ctx.arc(30, 34, 16, 0, Math.PI * 2);
            ctx.arc(20, 32, 12, 0, Math.PI * 2);
            ctx.arc(38, 32, 12, 0, Math.PI * 2);
            ctx.arc(28, 24, 12, 0, Math.PI * 2);
            ctx.fill();
            // Wool texture outline
            ctx.strokeStyle = '#d5d8dc';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Dark grey/black face
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(40, 24, 14, 14);
            // Wool tuft forehead
            ctx.fillStyle = '#f8f9f9';
            ctx.fillRect(38, 20, 14, 6);
            // Eyes
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(44, 26, 3, 3);
            ctx.fillStyle = '#000000';
            ctx.fillRect(45, 27, 2, 2);
            // Droopy ear
            ctx.fillStyle = '#1a252f';
            ctx.fillRect(36, 26, 4, 8);
            // Black hooves
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(20, 48, 5, 10);
            ctx.fillRect(28, 48, 5, 10);
            ctx.fillRect(34, 48, 5, 10);
            ctx.fillRect(40, 48, 5, 10);

            canvas.refresh();
        }

        // 23. Town Prop: Glowing Street Lantern (64x64 stone post with warm amber lantern)
        canvas = this.textures.createCanvas('town_lantern', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Base plinth
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(24, 52, 16, 10);
            ctx.fillRect(26, 46, 12, 6);
            // Post pillar
            ctx.fillStyle = '#34495e';
            ctx.fillRect(29, 24, 6, 24);
            // Lantern bracket & roof
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(22, 14, 20, 4);
            ctx.fillRect(25, 10, 14, 4);
            // Radiant glow halo
            ctx.fillStyle = 'rgba(255, 190, 40, 0.25)';
            ctx.beginPath();
            ctx.arc(32, 22, 18, 0, Math.PI * 2);
            ctx.fill();
            // Amber glass chamber
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(24, 18, 16, 12);
            // White-hot core flame
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(28, 20, 8, 8);
            // Wrought-iron cage bars
            ctx.strokeStyle = '#1c2833';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(24, 18, 16, 12);
            ctx.beginPath();
            ctx.moveTo(32, 18);
            ctx.lineTo(32, 30);
            ctx.stroke();

            canvas.refresh();
        }

        // 24. Town Prop: Supply Crates (64x64 wooden cargo crate with metal brackets)
        canvas = this.textures.createCanvas('town_crate', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Wooden crate body
            ctx.fillStyle = '#935116';
            ctx.fillRect(12, 16, 40, 40);
            // Horizontal planks
            ctx.strokeStyle = '#6e390e';
            ctx.lineWidth = 2;
            ctx.strokeRect(12, 16, 40, 40);
            ctx.beginPath();
            ctx.moveTo(12, 29);
            ctx.lineTo(52, 29);
            ctx.moveTo(12, 43);
            ctx.lineTo(52, 43);
            ctx.stroke();
            // Diagonal cross braces
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(14, 18);
            ctx.lineTo(50, 54);
            ctx.moveTo(50, 18);
            ctx.lineTo(14, 54);
            ctx.stroke();
            // Wrought-iron corner plates
            ctx.fillStyle = '#34495e';
            ctx.fillRect(12, 16, 6, 6);
            ctx.fillRect(46, 16, 6, 6);
            ctx.fillRect(12, 50, 6, 6);
            ctx.fillRect(46, 50, 6, 6);

            canvas.refresh();
        }

        // 25. Town Prop: Rustic Wooden Fence (64x64 posts & cross rails)
        canvas = this.textures.createCanvas('town_fence', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Left post
            ctx.fillStyle = '#783f04';
            ctx.fillRect(12, 16, 10, 44);
            // Right post
            ctx.fillStyle = '#783f04';
            ctx.fillRect(42, 16, 10, 44);
            // Post caps
            ctx.beginPath();
            ctx.moveTo(12, 16);
            ctx.lineTo(17, 10);
            ctx.lineTo(22, 16);
            ctx.fill();
            ctx.moveTo(42, 16);
            ctx.lineTo(47, 10);
            ctx.lineTo(52, 16);
            ctx.fill();
            // Upper and lower cross rails
            ctx.fillStyle = '#a0522d';
            ctx.fillRect(6, 24, 52, 8);
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(6, 40, 52, 8);
            // Nail studs
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(16, 27, 2, 2);
            ctx.fillRect(46, 27, 2, 2);
            ctx.fillRect(16, 43, 2, 2);
            ctx.fillRect(46, 43, 2, 2);

            canvas.refresh();
        }

        // 26. Town Prop: Starlight Wild Flowers (64x64 vibrant blossoms & foliage)
        canvas = this.textures.createCanvas('town_flowers', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Lush grass patch
            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            ctx.ellipse(32, 44, 24, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            // Stems
            ctx.strokeStyle = '#1e8449';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(22, 44);
            ctx.lineTo(20, 26);
            ctx.moveTo(32, 44);
            ctx.lineTo(32, 20);
            ctx.moveTo(42, 44);
            ctx.lineTo(44, 28);
            ctx.stroke();
            // Magenta bloom
            ctx.fillStyle = '#e91e63';
            ctx.beginPath();
            ctx.arc(20, 26, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(20, 26, 3, 0, Math.PI * 2);
            ctx.fill();
            // Starlight golden bloom
            ctx.fillStyle = '#ffea00';
            ctx.beginPath();
            ctx.arc(32, 20, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(32, 20, 3, 0, Math.PI * 2);
            ctx.fill();
            // Cyan bloom
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath();
            ctx.arc(44, 28, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(44, 28, 3, 0, Math.PI * 2);
            ctx.fill();
            // Pollen sparkle accents
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(14, 18, 2, 2);
            ctx.fillRect(48, 16, 2, 2);
            ctx.fillRect(28, 10, 2, 2);

            canvas.refresh();
        }

        // 27. Settler: Master Blacksmith Thorgan (64x64 leather apron, thick beard, forge hammer)
        canvas = this.textures.createCanvas('settler_blacksmith', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Broad muscular body & rolled sleeves
            ctx.fillStyle = '#dcdde1';
            ctx.fillRect(14, 20, 36, 18);
            // Heavy leather smithing apron
            ctx.fillStyle = '#5c2c16';
            ctx.fillRect(18, 22, 28, 32);
            ctx.fillStyle = '#3d1a0e';
            ctx.fillRect(22, 16, 4, 10);
            ctx.fillRect(38, 16, 4, 10);
            // Grey/silver hair and thick braided smith beard
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(20, 8, 24, 16);
            ctx.fillStyle = '#ffdbac';
            ctx.fillRect(24, 14, 16, 10);
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(22, 20, 20, 10); // Big beard
            // Fiery eyes
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(26, 16, 3, 3);
            ctx.fillRect(35, 16, 3, 3);
            // Smithing Hammer in hand
            ctx.fillStyle = '#8b4513';
            ctx.fillRect(10, 26, 4, 24); // Handle
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(6, 24, 12, 8); // Steel head
            // Hot orange iron ingot held in tongs
            ctx.fillStyle = '#ff5722';
            ctx.fillRect(44, 34, 10, 6);
            ctx.fillStyle = '#ffeb3b';
            ctx.fillRect(46, 35, 6, 4); // Glowing core
            // Heavy steel-toe work boots
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(18, 54, 10, 8);
            ctx.fillRect(36, 54, 10, 8);

            canvas.refresh();
        }

        // 28. Settler: Astrologer / Mystic Cynthia (64x64 midnight robes & celestial staff)
        canvas = this.textures.createCanvas('settler_mystic', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Midnight purple robes
            ctx.fillStyle = '#1a0f3d';
            ctx.fillRect(16, 20, 32, 36);
            ctx.fillStyle = '#2c1654';
            ctx.fillRect(22, 20, 20, 36);
            // Silver hair & golden star circlet
            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(20, 8, 24, 18);
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(20, 12, 24, 3);
            // Face & ethereal violet eyes
            ctx.fillStyle = '#ffdbac';
            ctx.fillRect(24, 14, 16, 10);
            ctx.fillStyle = '#9b59b6';
            ctx.fillRect(26, 16, 3, 3);
            ctx.fillRect(35, 16, 3, 3);
            // Celestial staff with glowing orb
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(44, 14, 4, 40); // Gold staff
            ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(46, 10, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath();
            ctx.arc(46, 10, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(45, 9, 2, 2);
            // Robe hem / boots
            ctx.fillStyle = '#0f0826';
            ctx.fillRect(18, 54, 10, 8);
            ctx.fillRect(36, 54, 10, 8);

            canvas.refresh();
        }

        // 29. Town Prop: Masterwork Anvil (64x64 steel anvil on wood block)
        canvas = this.textures.createCanvas('town_anvil', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Oak stump base
            ctx.fillStyle = '#5c3a1a';
            ctx.fillRect(18, 40, 28, 22);
            ctx.strokeStyle = '#3d230f';
            ctx.lineWidth = 2;
            ctx.strokeRect(18, 40, 28, 22);
            // Steel anvil waist & base
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(24, 32, 16, 10);
            ctx.fillRect(16, 38, 32, 4);
            // Anvil top face and horn
            ctx.beginPath();
            ctx.moveTo(10, 22); // Horn tip
            ctx.lineTo(22, 28);
            ctx.lineTo(52, 28);
            ctx.lineTo(52, 20);
            ctx.lineTo(20, 20);
            ctx.closePath();
            ctx.fillStyle = '#4a6572';
            ctx.fill();
            ctx.strokeStyle = '#1a252f';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Steel shine line
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(22, 21, 28, 2);

            canvas.refresh();
        }

        // 30. Town Prop: Roaring Brazier (64x64 wrought iron stand with fire)
        canvas = this.textures.createCanvas('town_brazier', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Tripod stand legs
            ctx.strokeStyle = '#1c2833';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(32, 38); ctx.lineTo(18, 58);
            ctx.moveTo(32, 38); ctx.lineTo(46, 58);
            ctx.moveTo(32, 38); ctx.lineTo(32, 58);
            ctx.stroke();
            // Iron basin bowl
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(32, 36, 16, 0, Math.PI);
            ctx.fill();
            ctx.stroke();
            // Radiant glow halo
            ctx.fillStyle = 'rgba(255, 100, 0, 0.25)';
            ctx.beginPath();
            ctx.arc(32, 26, 18, 0, Math.PI * 2);
            ctx.fill();
            // Outer flame (red/orange)
            ctx.fillStyle = '#ff3300';
            ctx.beginPath();
            ctx.moveTo(22, 36);
            ctx.lineTo(26, 16);
            ctx.lineTo(32, 24);
            ctx.lineTo(38, 14);
            ctx.lineTo(42, 36);
            ctx.closePath();
            ctx.fill();
            // Inner hot flame (yellow/white)
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.moveTo(26, 36);
            ctx.lineTo(30, 22);
            ctx.lineTo(32, 26);
            ctx.lineTo(34, 20);
            ctx.lineTo(38, 36);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(30, 28, 4, 8);

            canvas.refresh();
        }

        // 31. Town Prop: Pulsing Aether Crystal (64x64 floating cluster of crystals)
        canvas = this.textures.createCanvas('town_crystal', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Base rock cluster
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(16, 48, 32, 12);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(20, 44, 24, 6);
            // Glowing aura
            ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
            ctx.beginPath();
            ctx.arc(32, 28, 22, 0, Math.PI * 2);
            ctx.fill();
            // Large central crystal (cyan)
            ctx.beginPath();
            ctx.moveTo(32, 8);
            ctx.lineTo(40, 28);
            ctx.lineTo(32, 46);
            ctx.lineTo(24, 28);
            ctx.closePath();
            ctx.fillStyle = '#00e5ff';
            ctx.fill();
            // Left crystal shard (violet)
            ctx.beginPath();
            ctx.moveTo(20, 20);
            ctx.lineTo(26, 32);
            ctx.lineTo(22, 44);
            ctx.lineTo(16, 32);
            ctx.closePath();
            ctx.fillStyle = '#9b59b6';
            ctx.fill();
            // Right crystal shard (magenta)
            ctx.beginPath();
            ctx.moveTo(44, 18);
            ctx.lineTo(48, 30);
            ctx.lineTo(42, 44);
            ctx.lineTo(38, 30);
            ctx.closePath();
            ctx.fillStyle = '#e91e63';
            ctx.fill();
            // Specular crystal gleams
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(31, 14, 2, 14);
            ctx.fillRect(20, 24, 2, 8);
            ctx.fillRect(43, 22, 2, 8);

            canvas.refresh();
        }

        // 32. Overworld Portal Marker: Oakhaven Signpost (64x64 wooden arch sign)
        canvas = this.textures.createCanvas('portal_signpost', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Grass patch
            ctx.fillStyle = '#557a2b';
            ctx.fillRect(0, 0, 64, 64);
            // Wooden post
            ctx.fillStyle = '#5c3a1a';
            ctx.fillRect(28, 20, 8, 44);
            // Wooden village sign board
            ctx.fillStyle = '#8b5a2b';
            ctx.fillRect(10, 14, 44, 20);
            ctx.strokeStyle = '#3d230f';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 14, 44, 20);
            // Sign text indicator lines
            ctx.fillStyle = '#ffd700';
            ctx.fillRect(16, 20, 32, 3);
            ctx.fillRect(20, 26, 24, 2);
            // Hanging warm lantern
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(14, 38, 4, 0, Math.PI * 2);
            ctx.fill();

            canvas.refresh();
        }

        // 33. Overworld Portal Marker: Aetheria Runic Arch (64x64 sylvan stone archway)
        canvas = this.textures.createCanvas('portal_rune_arch', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Grass base
            ctx.fillStyle = '#557a2b';
            ctx.fillRect(0, 0, 64, 64);
            // Ancient stone archway
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(12, 12, 10, 52);
            ctx.fillRect(42, 12, 10, 52);
            ctx.fillRect(12, 8, 40, 10);
            // Portal portal glow
            ctx.fillStyle = 'rgba(0, 229, 255, 0.35)';
            ctx.beginPath();
            ctx.arc(32, 36, 14, 0, Math.PI * 2);
            ctx.fill();
            // Runic runes on stone
            ctx.fillStyle = '#00ffcc';
            ctx.fillRect(15, 20, 4, 4);
            ctx.fillRect(15, 34, 4, 4);
            ctx.fillRect(45, 20, 4, 4);
            ctx.fillRect(45, 34, 4, 4);
            ctx.fillRect(28, 10, 8, 3);

            canvas.refresh();
        }

        // 34. Overworld Portal Marker: Ironspire Mountain Gate (64x64 fortress gate)
        canvas = this.textures.createCanvas('portal_stone_gate', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Grass base
            ctx.fillStyle = '#557a2b';
            ctx.fillRect(0, 0, 64, 64);
            // Heavy stone gate towers
            ctx.fillStyle = '#34495e';
            ctx.fillRect(8, 8, 14, 56);
            ctx.fillRect(42, 8, 14, 56);
            ctx.fillRect(8, 8, 48, 12);
            // Tower crenellations
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(8, 4, 4, 6);
            ctx.fillRect(18, 4, 4, 6);
            ctx.fillRect(42, 4, 4, 6);
            ctx.fillRect(52, 4, 4, 6);
            // Iron-reinforced gate door
            ctx.fillStyle = '#5a2a18';
            ctx.fillRect(22, 20, 20, 44);
            // Iron grill & studs
            ctx.strokeStyle = '#1c2833';
            ctx.lineWidth = 2;
            ctx.strokeRect(22, 20, 20, 44);
            ctx.beginPath();
            ctx.moveTo(32, 20); ctx.lineTo(32, 64);
            ctx.moveTo(22, 34); ctx.lineTo(42, 34);
            ctx.moveTo(22, 48); ctx.lineTo(42, 48);
            ctx.stroke();

            canvas.refresh();
        }

        // 35. Ironspire Blast Furnace: town_furnace (64x64 roaring stone smelting furnace)
        canvas = this.textures.createCanvas('town_furnace', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Brick furnace base & chimney
            ctx.fillStyle = '#424949';
            ctx.fillRect(10, 18, 44, 46);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(20, 4, 24, 18);
            // Chimney rim
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(18, 2, 28, 4);

            // Brick mortar lines
            ctx.strokeStyle = '#1c2833';
            ctx.lineWidth = 1;
            for (let y = 22; y <= 58; y += 8) {
                ctx.beginPath();
                ctx.moveTo(10, y); ctx.lineTo(54, y);
                ctx.stroke();
            }

            // Furnace arch mouth
            ctx.fillStyle = '#111111';
            ctx.beginPath();
            ctx.arc(32, 44, 14, Math.PI, 0);
            ctx.rect(18, 44, 28, 16);
            ctx.fill();

            // Molten interior glow (Yellow / Orange flame)
            ctx.fillStyle = '#ff4500';
            ctx.beginPath();
            ctx.arc(32, 48, 10, Math.PI, 0);
            ctx.rect(22, 48, 20, 10);
            ctx.fill();

            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(32, 52, 6, 0, Math.PI * 2);
            ctx.fill();

            // Smelting iron grate
            ctx.strokeStyle = '#222222';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(22, 52); ctx.lineTo(42, 52);
            ctx.moveTo(27, 44); ctx.lineTo(27, 60);
            ctx.moveTo(37, 44); ctx.lineTo(37, 60);
            ctx.stroke();

            canvas.refresh();
        }

        // 36. Aetheria Grand Arcane Nexus: town_nexus_crystal (64x64 grand prismatic floating core)
        canvas = this.textures.createCanvas('town_nexus_crystal', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Runic stone pedestal
            ctx.fillStyle = '#1b2631';
            ctx.fillRect(16, 52, 32, 12);
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(20, 46, 24, 8);

            // Pedestal glowing rune lines
            ctx.fillStyle = '#00ffcc';
            ctx.fillRect(24, 50, 16, 2);
            ctx.fillRect(22, 56, 20, 2);

            // Floating Nexus Shards (Diamond Outer)
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.moveTo(32, 6);
            ctx.lineTo(50, 26);
            ctx.lineTo(32, 44);
            ctx.lineTo(14, 26);
            ctx.closePath();
            ctx.fill();

            // Inner Prismatic Core (Magenta / Purple)
            ctx.fillStyle = '#e040fb';
            ctx.beginPath();
            ctx.moveTo(32, 12);
            ctx.lineTo(44, 26);
            ctx.lineTo(32, 38);
            ctx.lineTo(20, 26);
            ctx.closePath();
            ctx.fill();

            // Starlight Specular Glint
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(32, 16);
            ctx.lineTo(38, 26);
            ctx.lineTo(32, 32);
            ctx.lineTo(26, 26);
            ctx.closePath();
            ctx.fill();

            // Orbiting Mini Mana Shards
            ctx.fillStyle = '#00e5ff';
            ctx.fillRect(8, 22, 4, 6);
            ctx.fillRect(52, 24, 4, 6);
            ctx.fillRect(22, 2, 4, 4);
            ctx.fillRect(40, 42, 4, 4);

            canvas.refresh();
        }

        // 37. Oakhaven Sanctuary Bell Tower: town_bell_tower (64x64 monumental belfry)
        canvas = this.textures.createCanvas('town_bell_tower', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Carved timber & stone base
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(16, 24, 32, 40);
            ctx.strokeStyle = '#3e2723';
            ctx.lineWidth = 2;
            ctx.strokeRect(16, 24, 32, 40);

            // Belfry arch pillars
            ctx.fillStyle = '#8d6e63';
            ctx.fillRect(18, 14, 6, 14);
            ctx.fillRect(40, 14, 6, 14);

            // Belfry peaked roof (slate red/gold trim)
            ctx.beginPath();
            ctx.moveTo(32, 2);
            ctx.lineTo(52, 14);
            ctx.lineTo(12, 14);
            ctx.closePath();
            ctx.fillStyle = '#c0392b';
            ctx.fill();
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Golden Bell
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(32, 20, 7, Math.PI, 0);
            ctx.lineTo(40, 26);
            ctx.lineTo(24, 26);
            ctx.closePath();
            ctx.fill();
            // Clapper
            ctx.fillStyle = '#d68910';
            ctx.fillRect(31, 26, 2, 4);

            // Woven celebration banners on tower body
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(20, 36, 24, 6);
            ctx.fillStyle = '#2980b9';
            ctx.fillRect(20, 46, 24, 6);
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(20, 56, 24, 6);

            canvas.refresh();
        }

        // 38. Settler NPC: Farmer Bran (settler_farmer)
        canvas = this.textures.createCanvas('settler_farmer', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Straw Hat brim & crown
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.ellipse(32, 14, 18, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(22, 6, 20, 8);
            // Hat band
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(22, 12, 20, 2);

            // Head / Face
            ctx.fillStyle = '#ffdbac';
            ctx.fillRect(24, 16, 16, 12);
            // Eyes & Friendly smile
            ctx.fillStyle = '#333333';
            ctx.fillRect(27, 20, 2, 3);
            ctx.fillRect(35, 20, 2, 3);
            ctx.fillStyle = '#a04000';
            ctx.fillRect(29, 25, 6, 2);

            // Plaid Flannel Shirt
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(20, 28, 24, 18);
            // Denim Overalls
            ctx.fillStyle = '#2980b9';
            ctx.fillRect(22, 34, 20, 18);
            // Straps
            ctx.fillRect(22, 28, 4, 8);
            ctx.fillRect(38, 28, 4, 8);

            // Wooden Pitchfork
            ctx.fillStyle = '#795548';
            ctx.fillRect(46, 14, 3, 44);
            ctx.fillStyle = '#95a5a6';
            ctx.fillRect(44, 14, 8, 3);
            ctx.fillRect(44, 8, 2, 8);
            ctx.fillRect(47, 8, 2, 8);
            ctx.fillRect(50, 8, 2, 8);

            // Boots
            ctx.fillStyle = '#4a235a';
            ctx.fillRect(22, 52, 8, 8);
            ctx.fillRect(34, 52, 8, 8);

            canvas.refresh();
        }

        // 39. Settler NPC: Merchant Lin (settler_merchant)
        canvas = this.textures.createCanvas('settler_merchant', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Merchant Velvet Beret / Turban with Jewel
            ctx.fillStyle = '#16a085';
            ctx.beginPath();
            ctx.arc(32, 14, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(30, 8, 4, 4);

            // Face
            ctx.fillStyle = '#ffdbac';
            ctx.fillRect(24, 18, 16, 12);
            ctx.fillStyle = '#222222';
            ctx.fillRect(27, 22, 2, 3);
            ctx.fillRect(35, 22, 2, 3);

            // Rich Emerald Silk Robes
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(18, 30, 28, 24);
            // Gold trim down center
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(30, 30, 4, 24);

            // Large Leather Trade Satchel across shoulder
            ctx.fillStyle = '#6e2c00';
            ctx.fillRect(12, 34, 10, 14);
            ctx.strokeStyle = '#d35400';
            ctx.lineWidth = 1;
            ctx.strokeRect(12, 34, 10, 14);
            // Satchel strap
            ctx.strokeStyle = '#6e2c00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(14, 34); ctx.lineTo(38, 28);
            ctx.stroke();

            // Shoes
            ctx.fillStyle = '#3e2723';
            ctx.fillRect(20, 54, 10, 6);
            ctx.fillRect(34, 54, 10, 6);

            canvas.refresh();
        }

        // 40. Freight Cart: town_cart (64x64 timber trade cart with ore/goods)
        canvas = this.textures.createCanvas('town_cart', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Cart timber bed
            ctx.fillStyle = '#6e2c00';
            ctx.fillRect(8, 20, 48, 24);
            ctx.strokeStyle = '#3e2723';
            ctx.lineWidth = 2;
            ctx.strokeRect(8, 20, 48, 24);

            // Freight Contents (Glowing ingots / golden grain / potion jugs)
            // Ore ingots
            ctx.fillStyle = '#95a5a6';
            ctx.fillRect(12, 14, 12, 8);
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(16, 10, 12, 8);
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(26, 12, 10, 8);
            // Grain sacks
            ctx.fillStyle = '#d4ac0d';
            ctx.beginPath();
            ctx.arc(42, 16, 7, 0, Math.PI * 2);
            ctx.fill();

            // Iron-banded wooden wheels
            ctx.fillStyle = '#3e2723';
            ctx.beginPath();
            ctx.arc(18, 48, 10, 0, Math.PI * 2);
            ctx.arc(46, 48, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Wheel hubs
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(16, 46, 4, 4);
            ctx.fillRect(44, 46, 4, 4);

            canvas.refresh();
        }

        // ==========================================
        // SPRINT 14: THE DUNGEONS & CASTLE MAP ASSETS
        // ==========================================

        // 41. Portal Castle Gate: portal_castle_gate (64x64 Overworld Castle Gatehouse)
        canvas = this.textures.createCanvas('portal_castle_gate', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Sky backdrop
            ctx.fillStyle = '#1a1c23';
            ctx.fillRect(0, 0, 64, 20);

            // Left & Right Fortified Towers (Limestone ashlar)
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(4, 8, 18, 56);
            ctx.fillRect(42, 8, 18, 56);

            // Tower Crenellations / Battlements
            ctx.fillStyle = '#95a5a6';
            ctx.fillRect(4, 4, 6, 6);
            ctx.fillRect(16, 4, 6, 6);
            ctx.fillRect(42, 4, 6, 6);
            ctx.fillRect(54, 4, 6, 6);

            // Tower Arrow Slits
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(11, 20, 4, 12);
            ctx.fillRect(49, 20, 4, 12);

            // Flying Royal Crimson Pennants
            ctx.fillStyle = '#c0392b';
            ctx.beginPath();
            ctx.moveTo(7, 4);
            ctx.lineTo(1, 8);
            ctx.lineTo(7, 12);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(57, 4);
            ctx.lineTo(63, 8);
            ctx.lineTo(57, 12);
            ctx.closePath();
            ctx.fill();

            // Central Castle Gatehouse Archway
            ctx.fillStyle = '#5d6d7e';
            ctx.fillRect(20, 16, 24, 48);

            // Arch header
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(22, 14, 20, 6);

            // Golden Royal Lion Crest above arch
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.arc(32, 17, 5, 0, Math.PI * 2);
            ctx.fill();

            // Dark Gate Passage
            ctx.fillStyle = '#0b0c10';
            ctx.fillRect(24, 26, 16, 38);

            // Iron Portcullis Grate
            ctx.strokeStyle = '#34495e';
            ctx.lineWidth = 2;
            for (let x = 26; x <= 38; x += 4) {
                ctx.beginPath();
                ctx.moveTo(x, 26);
                ctx.lineTo(x, 50);
                ctx.stroke();
            }
            for (let y = 30; y <= 48; y += 6) {
                ctx.beginPath();
                ctx.moveTo(24, y);
                ctx.lineTo(40, y);
                ctx.stroke();
            }

            canvas.refresh();
        }

        // 42. Castle Wall Tile: castle_wall_tile (64x64 Ashlar stone battlements)
        canvas = this.textures.createCanvas('castle_wall_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Solid limestone wall
            ctx.fillStyle = '#4a5568';
            ctx.fillRect(0, 0, 64, 64);

            // Ashlar stone blocks
            ctx.strokeStyle = '#2d3748';
            ctx.lineWidth = 2;
            // Row 1
            ctx.strokeRect(0, 0, 32, 20);
            ctx.strokeRect(32, 0, 32, 20);
            // Row 2
            ctx.strokeRect(-16, 20, 32, 22);
            ctx.strokeRect(16, 20, 32, 22);
            ctx.strokeRect(48, 20, 32, 22);
            // Row 3
            ctx.strokeRect(0, 42, 32, 22);
            ctx.strokeRect(32, 42, 32, 22);

            // Parapet top cornice
            ctx.fillStyle = '#718096';
            ctx.fillRect(0, 0, 64, 4);

            // Carved golden heraldic diamond medallion in center
            ctx.fillStyle = '#d4af37';
            ctx.beginPath();
            ctx.moveTo(32, 26);
            ctx.lineTo(38, 31);
            ctx.lineTo(32, 36);
            ctx.lineTo(26, 31);
            ctx.closePath();
            ctx.fill();

            canvas.refresh();
        }

        // 43. Castle Floor Tile: castle_floor_tile (64x64 Checkered marble & royal crimson carpet)
        canvas = this.textures.createCanvas('castle_floor_tile', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Checkered marble base
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, 32, 32);
            ctx.fillRect(32, 32, 32, 32);
            ctx.fillStyle = '#34495e';
            ctx.fillRect(32, 0, 32, 32);
            ctx.fillRect(0, 32, 32, 32);

            // Royal Crimson Center Carpet Runner
            ctx.fillStyle = '#781515';
            ctx.fillRect(12, 0, 40, 64);

            // Gold Embroidered Carpet Edges
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(12, 0, 3, 64);
            ctx.fillRect(49, 0, 3, 64);

            // Subtle carpet pile weave texture
            ctx.strokeStyle = '#922b21';
            ctx.lineWidth = 1;
            for (let y = 4; y < 64; y += 8) {
                ctx.beginPath();
                ctx.moveTo(16, y);
                ctx.lineTo(48, y);
                ctx.stroke();
            }

            canvas.refresh();
        }

        // 44. Locked Dungeon Door: locked_dungeon_door (64x64 Heavy Iron Portcullis & Skull Lock)
        canvas = this.textures.createCanvas('locked_dungeon_door', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Dark stone frame
            ctx.fillStyle = '#1a1d20';
            ctx.fillRect(0, 0, 64, 64);

            // Stone archway surround
            ctx.strokeStyle = '#3e444a';
            ctx.lineWidth = 6;
            ctx.strokeRect(4, 4, 56, 56);

            // Dark cavern passage behind
            ctx.fillStyle = '#050708';
            ctx.fillRect(8, 8, 48, 48);

            // Heavy Iron Vertical Bars
            ctx.fillStyle = '#566573';
            for (let x = 12; x <= 52; x += 8) {
                ctx.fillRect(x, 8, 4, 48);
            }

            // Horizontal reinforcing crossbars
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(8, 18, 48, 6);
            ctx.fillRect(8, 42, 48, 6);

            // Massive Skull Padlock
            ctx.fillStyle = '#b7950b';
            ctx.beginPath();
            ctx.arc(32, 32, 10, 0, Math.PI * 2);
            ctx.fill();

            // Skull face carving
            ctx.fillStyle = '#17202a';
            ctx.fillRect(28, 28, 3, 3); // Eye left
            ctx.fillRect(33, 28, 3, 3); // Eye right
            ctx.fillRect(30, 33, 4, 2); // Mouth

            // Mystical locked rune glow
            ctx.strokeStyle = '#9b59b6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(32, 32, 12, 0, Math.PI * 2);
            ctx.stroke();

            canvas.refresh();
        }

        // 45. Dungeon Descent Stairs: dungeon_stairs_down (64x64 Stone spiral stairs down)
        canvas = this.textures.createCanvas('dungeon_stairs_down', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Stone floor base
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, 64, 64);

            // Stairwell opening (descending into blackness)
            ctx.fillStyle = '#050709';
            ctx.fillRect(8, 8, 48, 48);

            // Carved stone steps descending down
            const stepColors = ['#5d6d7e', '#4d5656', '#34495e', '#212f3d', '#17202a', '#0b0e11'];
            for (let i = 0; i < stepColors.length; i++) {
                ctx.fillStyle = stepColors[i];
                ctx.fillRect(12, 12 + i * 7, 40, 6);
            }

            // Torch light casting warm amber on the entrance
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.arc(10, 10, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(243, 156, 18, 0.3)';
            ctx.beginPath();
            ctx.arc(10, 10, 10, 0, Math.PI * 2);
            ctx.fill();

            canvas.refresh();
        }

        // 46. Dungeon Ascent Stairs: dungeon_stairs_up (64x64 Stone stairs ascending)
        canvas = this.textures.createCanvas('dungeon_stairs_up', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Stone floor base
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, 64, 64);

            // Stairwell masonry border
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 4;
            ctx.strokeRect(6, 6, 52, 52);

            // Bright portal light at the top of the stairs
            ctx.fillStyle = '#f9e79f';
            ctx.fillRect(18, 10, 28, 12);

            // Carved ascending stone steps
            const stepColors = ['#d5dbdb', '#bdc3c7', '#95a5a6', '#7f8c8d', '#566573'];
            for (let i = 0; i < stepColors.length; i++) {
                ctx.fillStyle = stepColors[i];
                ctx.fillRect(12, 22 + i * 6, 40, 5);
            }

            canvas.refresh();
        }

        // 47. Royal Throne: royal_throne (64x64 Gilded Sovereign Throne)
        canvas = this.textures.createCanvas('royal_throne', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Golden Throne Frame
            ctx.fillStyle = '#f1c40f';
            // High backrest
            ctx.fillRect(16, 6, 32, 40);
            // Armrests
            ctx.fillRect(10, 30, 8, 20);
            ctx.fillRect(46, 30, 8, 20);
            // Throne pedestal base
            ctx.fillRect(8, 48, 48, 12);

            // Rich Crimson Tufted Velvet Cushion
            ctx.fillStyle = '#922b21';
            ctx.fillRect(20, 12, 24, 28);
            ctx.fillRect(16, 38, 32, 10);

            // Diamond tufting pattern
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(26, 20, 3, 3);
            ctx.fillRect(35, 20, 3, 3);
            ctx.fillRect(31, 28, 3, 3);

            // Gilded Crown finial at throne peak
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.moveTo(24, 6);
            ctx.lineTo(28, 0);
            ctx.lineTo(32, 4);
            ctx.lineTo(36, 0);
            ctx.lineTo(40, 6);
            ctx.closePath();
            ctx.fill();

            // Ruby jewel in crown
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(32, 4, 2, 0, Math.PI * 2);
            ctx.fill();

            canvas.refresh();
        }

        // 48. Royal Knight: royal_knight (64x64 Paladin in silver/gold plate armor)
        canvas = this.textures.createCanvas('royal_knight', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Polished Steel Greaves & Boots
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(22, 50, 8, 12);
            ctx.fillRect(34, 50, 8, 12);

            // Silver Plate Cuirass & Crimson Tabard
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(18, 24, 28, 26);
            // Crimson tabard stripe
            ctx.fillStyle = '#c0392b';
            ctx.fillRect(27, 24, 10, 26);
            // Golden cross on tabard
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(28, 30, 8, 2);
            ctx.fillRect(31, 27, 2, 8);

            // Greathelm
            ctx.fillStyle = '#95a5a6';
            ctx.fillRect(22, 8, 20, 16);
            // Visor slit
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(24, 16, 16, 3);

            // Crimson Plume Feather
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(32, 8);
            ctx.lineTo(30, 0);
            ctx.lineTo(38, 4);
            ctx.closePath();
            ctx.fill();

            // Royal Kite Shield (Left arm)
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.moveTo(8, 24);
            ctx.lineTo(18, 24);
            ctx.lineTo(18, 40);
            ctx.lineTo(13, 46);
            ctx.lineTo(8, 40);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#2980b9'; // Blue shield core
            ctx.fillRect(10, 26, 6, 14);

            // Upright Halberd Spear (Right arm)
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(48, 4, 3, 56);
            ctx.fillStyle = '#ecf0f1'; // Axe blade
            ctx.fillRect(45, 8, 10, 8);

            canvas.refresh();
        }

        // 49. King Aurelius: king_npc (64x64 Monarch in purple velvet & golden crown)
        canvas = this.textures.createCanvas('king_npc', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Imperial Purple Robes
            ctx.fillStyle = '#5b2c6f';
            ctx.fillRect(16, 22, 32, 40);

            // Ermine Fur Collar & Trim (White with black specks)
            ctx.fillStyle = '#f4f6f7';
            ctx.fillRect(14, 20, 36, 10);
            ctx.fillRect(29, 30, 6, 32);
            ctx.fillStyle = '#1c2833';
            ctx.fillRect(18, 24, 2, 2);
            ctx.fillRect(26, 24, 2, 2);
            ctx.fillRect(36, 24, 2, 2);
            ctx.fillRect(44, 24, 2, 2);

            // Head & Regal Face
            ctx.fillStyle = '#f5cba7';
            ctx.fillRect(24, 10, 16, 14);

            // Flowing Silver Royal Beard
            ctx.fillStyle = '#d5dbdb';
            ctx.beginPath();
            ctx.moveTo(24, 18);
            ctx.lineTo(32, 28);
            ctx.lineTo(40, 18);
            ctx.closePath();
            ctx.fill();

            // Golden High Crown
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(22, 4, 20, 7);
            ctx.beginPath();
            ctx.moveTo(22, 4);
            ctx.lineTo(24, 0);
            ctx.lineTo(28, 4);
            ctx.lineTo(32, -1);
            ctx.lineTo(36, 4);
            ctx.lineTo(40, 0);
            ctx.lineTo(42, 4);
            ctx.closePath();
            ctx.fill();

            // Emerald & Ruby Jewels in crown
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(25, 6, 2, 2);
            ctx.fillRect(37, 6, 2, 2);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(31, 6, 3, 2);

            // Golden Royal Scepter in hand
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(48, 16, 3, 38);
            ctx.beginPath();
            ctx.arc(49, 14, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#3498db'; // Sapphire orb atop scepter
            ctx.beginPath();
            ctx.arc(49, 14, 2.5, 0, Math.PI * 2);
            ctx.fill();

            canvas.refresh();
        }

        // 50. Treasure Chest: treasure_chest (64x64 Iron-banded wooden coffer)
        canvas = this.textures.createCanvas('treasure_chest', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Shadow under chest
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(32, 54, 24, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Oak chest body
            ctx.fillStyle = '#784212';
            ctx.fillRect(10, 24, 44, 28);

            // Iron bands and rivets
            ctx.fillStyle = '#566573';
            ctx.fillRect(10, 24, 44, 4);
            ctx.fillRect(10, 48, 44, 4);
            ctx.fillRect(14, 24, 6, 28);
            ctx.fillRect(44, 24, 6, 28);

            // Domed Lid
            ctx.fillStyle = '#935116';
            ctx.beginPath();
            ctx.arc(32, 24, 22, Math.PI, 0);
            ctx.fill();

            // Iron band over dome
            ctx.fillStyle = '#566573';
            ctx.fillRect(14, 10, 6, 14);
            ctx.fillRect(44, 10, 6, 14);

            // Golden Brass Lockplate
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(28, 26, 8, 10);
            // Keyhole
            ctx.fillStyle = '#17202a';
            ctx.beginPath();
            ctx.arc(32, 29, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(31, 30, 2, 4);

            // Gold glow seeping through lid seam
            ctx.fillStyle = '#f9e79f';
            ctx.fillRect(10, 23, 44, 2);

            canvas.refresh();
        }

        // 51. Monster: Acid Slime / Alpha Slime Emperor (slime) (64x64 translucent emerald gelatinous cube with acidic bubbles)
        canvas = this.textures.createCanvas('slime', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(32, 54, 24, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            // Main gelatinous body (translucent emerald green)
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.moveTo(14, 48);
            ctx.quadraticCurveTo(10, 26, 32, 18);
            ctx.quadraticCurveTo(54, 26, 50, 48);
            ctx.quadraticCurveTo(32, 56, 14, 48);
            ctx.closePath();
            ctx.fill();

            // Inner glowing acidic nucleus
            ctx.fillStyle = '#a9dfbf';
            ctx.beginPath();
            ctx.arc(32, 38, 12, 0, Math.PI * 2);
            ctx.fill();

            // Acidic bubbles inside gelatin
            ctx.fillStyle = '#f9e79f';
            ctx.beginPath();
            ctx.arc(26, 34, 3, 0, Math.PI * 2);
            ctx.arc(38, 42, 2.5, 0, Math.PI * 2);
            ctx.arc(34, 28, 2, 0, Math.PI * 2);
            ctx.fill();

            // Shiny specular highlight gleam (top-left)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(24, 24, 6, 3, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();

            // Cute / Corrosive eyes
            ctx.fillStyle = '#145a32';
            ctx.fillRect(24, 34, 4, 6);
            ctx.fillRect(36, 34, 4, 6);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(25, 35, 2, 2);
            ctx.fillRect(37, 35, 2, 2);

            canvas.refresh();
        }

        // 52. Monster: Great Basilisk / Heal Snake (snake) (64x64 coiled jade viper with flared hood)
        canvas = this.textures.createCanvas('snake', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(32, 56, 22, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Coiled lower body (Forest Green)
            ctx.fillStyle = '#1e8449';
            ctx.beginPath();
            ctx.ellipse(32, 48, 20, 10, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#27ae60';
            ctx.beginPath();
            ctx.ellipse(32, 45, 16, 7, 0, 0, Math.PI * 2);
            ctx.fill();

            // Flared cobra hood
            ctx.fillStyle = '#196f3d';
            ctx.beginPath();
            ctx.moveTo(32, 16);
            ctx.lineTo(48, 28);
            ctx.lineTo(38, 42);
            ctx.lineTo(26, 42);
            ctx.lineTo(16, 28);
            ctx.closePath();
            ctx.fill();

            // Gold diamond scales pattern on hood
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(30, 26, 4, 4);
            ctx.fillRect(24, 32, 4, 4);
            ctx.fillRect(36, 32, 4, 4);

            // Snake Head & Snout
            ctx.fillStyle = '#229954';
            ctx.beginPath();
            ctx.moveTo(32, 12);
            ctx.lineTo(40, 22);
            ctx.lineTo(24, 22);
            ctx.closePath();
            ctx.fill();

            // Glowing yellow slit eyes
            ctx.fillStyle = '#f39c12';
            ctx.fillRect(26, 18, 3, 3);
            ctx.fillRect(35, 18, 3, 3);
            ctx.fillStyle = '#111111';
            ctx.fillRect(27, 18, 1, 3);
            ctx.fillRect(36, 18, 1, 3);

            // Forked Crimson Tongue
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(32, 12);
            ctx.lineTo(32, 4);
            ctx.moveTo(32, 4);
            ctx.lineTo(29, 1);
            ctx.moveTo(32, 4);
            ctx.lineTo(35, 1);
            ctx.stroke();

            canvas.refresh();
        }

        // 53. Monster: Vampire Bat / Alpha Vampire Archlord (bat) (64x64 midnight violet bat with spreading wings)
        canvas = this.textures.createCanvas('bat', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(32, 58, 18, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Left Leathery Wing
            ctx.fillStyle = '#4a235a';
            ctx.beginPath();
            ctx.moveTo(26, 28);
            ctx.lineTo(4, 18);
            ctx.lineTo(8, 36);
            ctx.lineTo(16, 44);
            ctx.lineTo(24, 38);
            ctx.closePath();
            ctx.fill();

            // Right Leathery Wing
            ctx.beginPath();
            ctx.moveTo(38, 28);
            ctx.lineTo(60, 18);
            ctx.lineTo(56, 36);
            ctx.lineTo(48, 44);
            ctx.lineTo(40, 38);
            ctx.closePath();
            ctx.fill();

            // Wing bone struts
            ctx.strokeStyle = '#2c1236';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(26, 28); ctx.lineTo(4, 18);
            ctx.moveTo(26, 28); ctx.lineTo(8, 36);
            ctx.moveTo(38, 28); ctx.lineTo(60, 18);
            ctx.moveTo(38, 28); ctx.lineTo(56, 36);
            ctx.stroke();

            // Bat Furry Body
            ctx.fillStyle = '#21102b';
            ctx.beginPath();
            ctx.ellipse(32, 34, 9, 14, 0, 0, Math.PI * 2);
            ctx.fill();

            // Pointed Ears
            ctx.fillStyle = '#3b1847';
            ctx.beginPath();
            ctx.moveTo(25, 24); ctx.lineTo(22, 10); ctx.lineTo(28, 20); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(39, 24); ctx.lineTo(42, 10); ctx.lineTo(36, 20); ctx.closePath(); ctx.fill();

            // Glowing Ruby Eyes
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(28, 26, 3, 3);
            ctx.fillRect(33, 26, 3, 3);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(29, 27, 1, 1);
            ctx.fillRect(34, 27, 1, 1);

            // Twin White Vampire Fangs
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(29, 36, 2, 4);
            ctx.fillRect(33, 36, 2, 4);

            canvas.refresh();
        }

        // 54. Monster: Tomb Skeleton / Alpha Undead Dreadknight (skeleton) (64x64 bleached skeleton with glowing cyan eye sockets)
        canvas = this.textures.createCanvas('skeleton', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.beginPath();
            ctx.ellipse(32, 58, 16, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Bony Legs
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(26, 46, 3, 12);
            ctx.fillRect(35, 46, 3, 12);
            // Pelvis
            ctx.fillRect(24, 42, 16, 5);

            // Spine and Ribcage
            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(30, 24, 4, 18);
            // Ribs
            ctx.fillRect(22, 26, 20, 3);
            ctx.fillRect(24, 32, 16, 3);
            ctx.fillRect(26, 38, 12, 3);

            // Bleached Skull
            ctx.beginPath();
            ctx.arc(32, 16, 10, 0, Math.PI * 2);
            ctx.fill();
            // Jaw
            ctx.fillRect(27, 20, 10, 5);

            // Glowing Cyan Soul-fire in Eye Sockets
            ctx.fillStyle = '#111111';
            ctx.fillRect(27, 13, 4, 4);
            ctx.fillRect(33, 13, 4, 4);
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(28, 14, 2, 2);
            ctx.fillRect(34, 14, 2, 2);

            // Left Arm holding Rusted Iron Sword
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(16, 26, 3, 14);
            // Sword hilt and blade
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(10, 12, 3, 26);
            ctx.fillStyle = '#d35400'; // Rusted edge
            ctx.fillRect(11, 14, 1, 22);
            ctx.fillStyle = '#95a5a6'; // Crossguard
            ctx.fillRect(7, 28, 9, 3);

            // Right Arm holding round iron buckler
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(44, 26, 3, 14);
            ctx.fillStyle = '#34495e';
            ctx.beginPath();
            ctx.arc(48, 34, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#bdc3c7';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            canvas.refresh();
        }

        // 55. Monster: Phoenix Guardian / Eternal Phoenix Sovereign (phoenix) (64x64 blazing solar firebird with flame crest and tail feathers)
        canvas = this.textures.createCanvas('phoenix', 64, 64);
        if (canvas) {
            let ctx = canvas.getContext();
            // Fiery radial aura
            let auraGrad = ctx.createRadialGradient(32, 30, 4, 32, 30, 28);
            auraGrad.addColorStop(0, 'rgba(255, 200, 0, 0.4)');
            auraGrad.addColorStop(0.6, 'rgba(255, 60, 0, 0.2)');
            auraGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = auraGrad;
            ctx.beginPath();
            ctx.arc(32, 30, 28, 0, Math.PI * 2);
            ctx.fill();

            // Long Trailing Solar Tail Ribbons
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(32, 42);
            ctx.quadraticCurveTo(24, 54, 22, 64);
            ctx.quadraticCurveTo(30, 52, 32, 42);
            ctx.fill();
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.moveTo(32, 42);
            ctx.quadraticCurveTo(32, 54, 32, 64);
            ctx.quadraticCurveTo(34, 52, 32, 42);
            ctx.fill();
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(32, 42);
            ctx.quadraticCurveTo(40, 54, 42, 64);
            ctx.quadraticCurveTo(34, 52, 32, 42);
            ctx.fill();

            // Left Flaming Wing
            ctx.fillStyle = '#ff4500';
            ctx.beginPath();
            ctx.moveTo(26, 26);
            ctx.lineTo(2, 10);
            ctx.lineTo(10, 24);
            ctx.lineTo(4, 32);
            ctx.lineTo(16, 38);
            ctx.lineTo(24, 34);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffcc00'; // Inner feather tier
            ctx.beginPath();
            ctx.moveTo(24, 26);
            ctx.lineTo(8, 18);
            ctx.lineTo(14, 28);
            ctx.lineTo(22, 32);
            ctx.closePath();
            ctx.fill();

            // Right Flaming Wing
            ctx.fillStyle = '#ff4500';
            ctx.beginPath();
            ctx.moveTo(38, 26);
            ctx.lineTo(62, 10);
            ctx.lineTo(54, 24);
            ctx.lineTo(60, 32);
            ctx.lineTo(48, 38);
            ctx.lineTo(40, 34);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffcc00'; // Inner feather tier
            ctx.beginPath();
            ctx.moveTo(40, 26);
            ctx.lineTo(56, 18);
            ctx.lineTo(50, 28);
            ctx.lineTo(42, 32);
            ctx.closePath();
            ctx.fill();

            // Solar Body (Golden Ember core)
            ctx.fillStyle = '#d35400';
            ctx.beginPath();
            ctx.ellipse(32, 32, 9, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.ellipse(32, 30, 6, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            // Flame Crest Head Plume
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(32, 16);
            ctx.lineTo(26, 4);
            ctx.lineTo(32, 8);
            ctx.lineTo(38, 2);
            ctx.lineTo(36, 12);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath();
            ctx.moveTo(32, 16);
            ctx.lineTo(30, 8);
            ctx.lineTo(34, 6);
            ctx.closePath();
            ctx.fill();

            // Head & Sharp Golden Beak
            ctx.fillStyle = '#f39c12';
            ctx.beginPath();
            ctx.arc(32, 18, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f1c40f'; // Beak
            ctx.beginPath();
            ctx.moveTo(32, 17);
            ctx.lineTo(32, 23);
            ctx.lineTo(40, 20);
            ctx.closePath();
            ctx.fill();

            // Fierce Cyan Eye
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(30, 16, 2, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(30, 16, 1, 1);

            canvas.refresh();
        }

        // Sprint 27: Generate procedural textures for capes, circlets, shields, armor, and accessories
        this.createEquipmentAndLayerTextures();
    }

    private createEquipmentAndLayerTextures() {
        // Flowing Cape 4-frame retro breeze animation
        const capeWaveOffsets = [0, 2, 4, 1];
        for (let f = 0; f < 4; f++) {
            const key = `cape_flowing_${f}`;
            if (!this.textures.exists(key)) {
                const canvas = this.textures.createCanvas(key, 64, 64);
                if (canvas) {
                    const ctx = canvas.getContext();
                    const w = capeWaveOffsets[f];
                    ctx.fillStyle = '#1a2255'; // Royal Navy Mantle
                    ctx.beginPath();
                    ctx.moveTo(26, 22);
                    ctx.lineTo(38, 22);
                    ctx.lineTo(44 + w, 52);
                    ctx.lineTo(20 - w, 52);
                    ctx.closePath();
                    ctx.fill();

                    // Gold hem fringe
                    ctx.strokeStyle = '#ffd700';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(20 - w, 52);
                    ctx.lineTo(44 + w, 52);
                    ctx.stroke();

                    // Shading fold lines
                    ctx.strokeStyle = '#10163a';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(32, 22);
                    ctx.lineTo(32 + Math.floor(w / 2), 52);
                    ctx.stroke();

                    canvas.refresh();
                }
            }
        }

        // Circlets & Tiaras (Strictly circlets, tiaras, coronets, browbands per Golden Rule #2)
        const circlets = [
            { key: 'helmet_circlet_silver', color: '#c0c5d0', gem: '#00ffff' },
            { key: 'helmet_tiara_gold', color: '#ffd700', gem: '#2ecc71' },
            { key: 'helmet_coronet_star', color: '#e6ccff', gem: '#ffffff' },
            { key: 'helmet_crown_flame', color: '#e74c3c', gem: '#ffaa00' },
            { key: 'helmet_diadem_frost', color: '#a0e6ff', gem: '#00e5ff' }
        ];

        circlets.forEach(c => {
            if (!this.textures.exists(c.key)) {
                const canvas = this.textures.createCanvas(c.key, 64, 64);
                if (canvas) {
                    const ctx = canvas.getContext();
                    // Sleek circlet / tiara fitted to the hero's forehead (x=22..35, y=11..15)
                    ctx.strokeStyle = c.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(28.5, 10, 7.5, Math.PI * 0.15, Math.PI * 0.85, false);
                    ctx.stroke();

                    // Central crest peak
                    ctx.fillStyle = c.color;
                    ctx.beginPath();
                    ctx.moveTo(27, 12);
                    ctx.lineTo(28.5, 8.5);
                    ctx.lineTo(30, 12);
                    ctx.closePath();
                    ctx.fill();

                    // Inset gemstone
                    ctx.fillStyle = c.gem;
                    ctx.fillRect(27.5, 9.5, 2, 2);
                    canvas.refresh();
                }
            }
        });

        // Shields
        const shields = [
            { key: 'shield_silver', bg: '#bdc3c7', border: '#7f8c8d', motif: '#3498db' },
            { key: 'shield_winged', bg: '#2c3e50', border: '#8e44ad', motif: '#9b59b6' },
            { key: 'shield_bronze', bg: '#d35400', border: '#a04000', motif: '#e67e22' },
            { key: 'shield_frost', bg: '#5dade2', border: '#2980b9', motif: '#aed6f1' },
            { key: 'shield_fire', bg: '#c0392b', border: '#962d22', motif: '#f39c12' }
        ];

        shields.forEach(s => {
            if (!this.textures.exists(s.key)) {
                const canvas = this.textures.createCanvas(s.key, 64, 64);
                if (canvas) {
                    const ctx = canvas.getContext();
                    ctx.fillStyle = s.bg;
                    ctx.strokeStyle = s.border;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(18, 14);
                    ctx.lineTo(46, 14);
                    ctx.lineTo(44, 38);
                    ctx.lineTo(32, 52);
                    ctx.lineTo(20, 38);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = s.motif;
                    ctx.fillRect(30, 20, 4, 18);
                    ctx.fillRect(24, 26, 16, 4);
                    canvas.refresh();
                }
            }
        });

        // Body Armors
        const armors = [
            { key: 'armor_royal_plate', color: '#2980b9', trim: '#f1c40f' },
            { key: 'armor_chainmail', color: '#7f8c8d', trim: '#bdc3c7' },
            { key: 'armor_leather', color: '#a0522d', trim: '#cd853f' },
            { key: 'armor_mystic_robe', color: '#4a235a', trim: '#bb8fce' }
        ];

        armors.forEach(a => {
            // Always recreate so stale cached canvases from prior hot-reload sessions are replaced
            if (this.textures.exists(a.key)) {
                this.textures.remove(a.key);
            }
            {
                // 64x64 canvas aligned to player sprite coordinate space.
                // The player body occupies roughly x:22-42, y:26-54 in the 64px frame.
                // We draw a narrow chest/torso silhouette + pauldron nubs to overlay Melodie's art.
                const canvas = this.textures.createCanvas(a.key, 64, 64);
                if (canvas) {
                    const ctx = canvas.getContext();

                    // Semi-transparent chest plate (torso only — no full-body fill)
                    ctx.globalAlpha = 0.55;
                    ctx.fillStyle = a.color;
                    // Torso/chest: narrow rectangle aligned to body center
                    ctx.beginPath();
                    ctx.moveTo(24, 28); // top-left shoulder
                    ctx.lineTo(40, 28); // top-right shoulder
                    ctx.lineTo(42, 32); // right chest flare
                    ctx.lineTo(42, 50); // right hip
                    ctx.lineTo(22, 50); // left hip
                    ctx.lineTo(22, 32); // left chest flare
                    ctx.closePath();
                    ctx.fill();

                    // Left pauldron (shoulder pad)
                    ctx.beginPath();
                    ctx.arc(20, 30, 5, Math.PI * 0.8, Math.PI * 1.9);
                    ctx.fill();

                    // Right pauldron
                    ctx.beginPath();
                    ctx.arc(44, 30, 5, Math.PI * 1.1, Math.PI * 2.2);
                    ctx.fill();

                    // Trim/outline at higher opacity
                    ctx.globalAlpha = 0.75;
                    ctx.strokeStyle = a.trim;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(24, 28);
                    ctx.lineTo(40, 28);
                    ctx.lineTo(42, 32);
                    ctx.lineTo(42, 50);
                    ctx.lineTo(22, 50);
                    ctx.lineTo(22, 32);
                    ctx.closePath();
                    ctx.stroke();

                    // Center belt buckle detail
                    ctx.globalAlpha = 0.8;
                    ctx.fillStyle = a.trim;
                    ctx.fillRect(29, 46, 6, 3);

                    ctx.globalAlpha = 1.0;
                    canvas.refresh();
                }
            }
        });

        // Elemental Swords
        const swords = [
            { key: 'sword_flame', blade: '#ff4500', hilt: '#ffd700' },
            { key: 'sword_frost', blade: '#00ffff', hilt: '#ffffff' }
        ];
        swords.forEach(sw => {
            if (!this.textures.exists(sw.key)) {
                const canvas = this.textures.createCanvas(sw.key, 64, 64);
                if (canvas) {
                    const ctx = canvas.getContext();
                    ctx.fillStyle = sw.blade;
                    ctx.fillRect(30, 10, 4, 38);
                    ctx.beginPath();
                    ctx.moveTo(30, 10);
                    ctx.lineTo(34, 10);
                    ctx.lineTo(32, 4);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = sw.hilt;
                    ctx.fillRect(24, 48, 16, 4);
                    ctx.fillStyle = '#4a2810';
                    ctx.fillRect(31, 52, 2, 8);
                    canvas.refresh();
                }
            }
        });

        // Rings, Amulets & Earrings
        const accessories = [
            { key: 'ring_ruby', base: '#ffd700', gem: '#ff0033' },
            { key: 'ring_sapphire', base: '#c0c0c0', gem: '#0066ff' },
            { key: 'ring_amethyst', base: '#333333', gem: '#9933ff' },
            { key: 'ring_emerald', base: '#ffd700', gem: '#00cc66' },
            { key: 'ring_topaz', base: '#ffcc00', gem: '#ff9900' },
            { key: 'amulet_meteor_pendant', base: '#c0c0c0', gem: '#00ffcc' },
            { key: 'amulet_phoenix_tear', base: '#d4af37', gem: '#ff3300' },
            { key: 'amulet_dragon_eye', base: '#8b4513', gem: '#ffcc00' },
            { key: 'earrings_astral_pair', base: '#e6e6fa', gem: '#3399ff' },
            { key: 'earrings_whisper_bead', base: '#c0c0c0', gem: '#00ff88' },
            { key: 'earrings_sunstone', base: '#ffd700', gem: '#ff6600' }
        ];

        accessories.forEach(acc => {
            if (!this.textures.exists(acc.key)) {
                const canvas = this.textures.createCanvas(acc.key, 64, 64);
                if (canvas) {
                    const ctx = canvas.getContext();
                    ctx.strokeStyle = acc.base;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(32, 32, 16, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.fillStyle = acc.gem;
                    ctx.beginPath();
                    ctx.arc(32, 20, 6, 0, Math.PI * 2);
                    ctx.fill();
                    canvas.refresh();
                }
            }
        });
    }
}
