export interface PortalConfig {
    gridX: number;
    gridY: number;
    targetMapId: string;
    targetGridX: number;
    targetGridY: number;
}

export interface NpcConfig {
    id: string;
    name: string;
    spriteKey: string;
    gridX: number;
    gridY: number;
    dialogue: string[];
}

export interface MapData {
    id: string;
    name: string;
    width: number;  // Columns
    height: number; // Rows
    grid: number[][]; // 2D grid: 0=grass, 1=wall/mountain, 2=tall grass, 3=path, 4=stone floor, 5=forest, 6=hill, 7=basalt, 8=magma, 9=cobble bridge, 10=sandbar, 11=flowers, 12=water
    portals: PortalConfig[];
    npcs: NpcConfig[];
}

export interface ChunkData {
    chunkX: number;
    chunkY: number;
    width: number;
    height: number;
    grid: number[][];
    portals: PortalConfig[];
    npcs: NpcConfig[];
}

export class MapRegistry {
    private static worldGridCache: number[][] | null = null;

    public static buildToroidalWorldGrid(): number[][] {
        if (this.worldGridCache) return this.worldGridCache;

        const W = 100;
        const H = 100;
        const grid: number[][] = Array.from({ length: H }, () => Array(W).fill(0));

        // 1. Natural Waterways & Toroidal Land Bridge network
        for (let y = 0; y < H; y++) {
            grid[y][25] = 12;
            grid[y][26] = 12;
            grid[y][72] = 12;
            grid[y][73] = 12;
        }
        for (let x = 0; x < W; x++) {
            grid[68][x] = 12;
            grid[69][x] = 12;
        }

        // Walkable Causeway Bridges & Sandbars (Zero boats required)
        [20, 45, 46, 75, 90].forEach(y => {
            grid[y][25] = 9; grid[y][26] = 9;
        });
        [15, 35, 48, 49, 80].forEach(y => {
            grid[y][72] = 9; grid[y][73] = 9;
        });
        [15, 30, 45, 50, 65, 85].forEach(x => {
            grid[68][x] = 10; grid[69][x] = 10;
        });

        // Toroidal border seamless bridges (East-West & North-South continuity)
        for (let y = 40; y <= 55; y++) {
            grid[y][0] = 3;
            grid[y][99] = 3;
        }
        for (let x = 45; x <= 60; x++) {
            grid[0][x] = 3;
            grid[99][x] = 3;
        }

        // 2. Zone 1: Crater Basin (Center-West, X: 38-54, Y: 38-54)
        for (let y = 38; y <= 54; y++) {
            for (let x = 38; x <= 54; x++) {
                const dist = Math.hypot(x - 45, y - 45);
                if (dist < 7) {
                    grid[y][x] = 7; // Crater Basalt
                } else if (dist < 9.5) {
                    grid[y][x] = (dist > 8.8 && Math.sin(x * 1.5 + y) > 0.2) ? 1 : 8; // Magma fissures & basalt rims
                }
            }
        }

        // Broad Paved Pathways to enter & leave the Crater Basin in all 4 cardinal directions:
        // 1. East Causeway (Crater Basin -> Oakhaven Valley & East Land Bridge)
        for (let x = 45; x <= 72; x++) {
            grid[45][x] = 3;
            grid[46][x] = 3;
            grid[47][x] = 3;
            grid[48][x] = 3;
            grid[49][x] = 3;
        }

        // 2. West Causeway (Crater Basin -> West Coast & Toroidal Boundary Wrap)
        for (let x = 0; x <= 45; x++) {
            grid[45][x] = 3;
            grid[46][x] = 3;
            grid[47][x] = 3;
            grid[48][x] = 3;
        }

        // 3. North Trail (Crater Basin -> Catacombs Ridge & Northern Highlands)
        for (let y = 20; y <= 45; y++) {
            grid[y][45] = 3;
            grid[y][46] = 3;
        }

        // 4. South Trail (Crater Basin -> Aetheria & Obsidian Castle)
        for (let y = 45; y <= 85; y++) {
            grid[y][45] = 3;
            grid[y][46] = 3;
        }

        // 3. Zone 2: Verdant Valley & Oakhaven Hub (Center-East, X: 54-71, Y: 40-60)
        for (let y = 40; y <= 60; y++) {
            for (let x = 54; x <= 71; x++) {
                if (grid[y][x] === 0) {
                    const noise = Math.sin(x * 0.4) * Math.cos(y * 0.4);
                    if (noise > 0.4) {
                        grid[y][x] = 11; // Wildflower Field
                    } else if (noise > 0.1) {
                        grid[y][x] = 2; // Tall Grass Encounter
                    } else if (noise < -0.5 && x > 66) {
                        grid[y][x] = 5; // Forest grove
                    }
                }
            }
        }

        // Cobblestone Main Road connecting Crater Basin -> Oakhaven -> East Bridge
        for (let x = 53; x <= 71; x++) {
            grid[48][x] = 3;
            grid[49][x] = 3;
        }
        for (let y = 20; y <= 48; y++) {
            grid[y][60] = 3; // North road to Catacombs
        }
        for (let y = 49; y <= 85; y++) {
            grid[y][60] = 3; // South road to Aetheria / Castle
        }

        // 4. Zone 3: Catacombs Ridge & Northern Highlands (X: 45-65, Y: 10-35)
        for (let y = 10; y <= 35; y++) {
            for (let x = 45; x <= 65; x++) {
                if (grid[y][x] === 0) {
                    const mNoise = Math.sin(x * 0.35) + Math.cos(y * 0.35);
                    if (mNoise > 0.8 && !(x >= 53 && x <= 57 && y >= 18 && y <= 22)) {
                        grid[y][x] = 1; // High Mountain
                    } else if (mNoise > 0.3) {
                        grid[y][x] = 6; // Hill Ridge
                    } else if (mNoise < -0.4) {
                        grid[y][x] = 5; // Pine Forest
                    } else {
                        grid[y][x] = 2; // Highland grass
                    }
                }
            }
        }
        for (let y = 20; y <= 30; y++) {
            grid[y][55] = 3;
        }
        for (let x = 55; x <= 60; x++) {
            grid[30][x] = 3;
        }

        // 5. Zone 4: Eastern Steppes & Ironspire Gateway (X: 74-98, Y: 25-60)
        for (let y = 25; y <= 60; y++) {
            for (let x = 74; x <= 98; x++) {
                if (grid[y][x] === 0) {
                    const sNoise = Math.sin(x * 0.25) * Math.sin(y * 0.25);
                    if (sNoise > 0.5) {
                        grid[y][x] = 6; // Rocky Hill
                    } else if (sNoise < -0.4) {
                        grid[y][x] = 5; // Ironwood Grove
                    } else if (sNoise > 0.2) {
                        grid[y][x] = 2; // Steppe encounters
                    }
                }
            }
        }
        for (let x = 72; x <= 88; x++) {
            grid[35][x] = 3;
        }

        // 6. Zone 5: Southern Sandbars & Archipelago (X: 35-85, Y: 70-98)
        for (let y = 70; y <= 98; y++) {
            for (let x = 35; x <= 85; x++) {
                if (grid[y][x] === 0) {
                    const cNoise = Math.cos(x * 0.3) + Math.sin(y * 0.3);
                    if (cNoise > 0.7) {
                        grid[y][x] = 10; // Sandbar
                    } else if (cNoise < -0.6) {
                        grid[y][x] = 12; // Coastal water
                    } else if (cNoise > 0.2) {
                        grid[y][x] = 11; // Wildflower meadow
                    } else {
                        grid[y][x] = 2; // Coastal reeds
                    }
                }
            }
        }

        // Ensure key portal and spawn coordinates are fully open and clear
        grid[45][45] = 7; grid[45][46] = 7; // Meteor Pod & spawn
        grid[60][48] = 3; grid[60][49] = 3; // Oakhaven Town
        grid[55][20] = 3; grid[55][21] = 3; // Catacombs Dungeon
        grid[65][82] = 10; grid[65][83] = 10; // Aetheria Town
        grid[88][35] = 3; grid[88][36] = 3; // Ironspire Town
        grid[50][88] = 3; grid[50][89] = 3; // Castle Keep

        this.worldGridCache = grid;
        return grid;
    }

    private static maps: { [id: string]: MapData } = {
        world_map: {
            id: 'world_map',
            name: 'Toroidal Overworld (100x100)',
            width: 100,
            height: 100,
            get grid() {
                return MapRegistry.buildToroidalWorldGrid();
            },
            portals: [
                { gridX: 45, gridY: 45, targetMapId: 'meteor_pod', targetGridX: 7, targetGridY: 7 },
                { gridX: 60, gridY: 48, targetMapId: 'town_oakhaven', targetGridX: 5, targetGridY: 8 },
                { gridX: 65, gridY: 82, targetMapId: 'town_aetheria', targetGridX: 10, targetGridY: 12 },
                { gridX: 88, gridY: 35, targetMapId: 'town_ironspire', targetGridX: 10, targetGridY: 12 },
                { gridX: 55, gridY: 20, targetMapId: 'dungeon_map', targetGridX: 6, targetGridY: 10 },
                { gridX: 50, gridY: 88, targetMapId: 'castle_exterior', targetGridX: 10, targetGridY: 14 }
            ],
            npcs: []
        },
        meteor_pod: {
            id: 'meteor_pod',
            name: 'Meteor Drop Pod',
            width: 15,
            height: 10,
            grid: [
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
                [1, 4, 1, 1, 4, 4, 4, 4, 4, 4, 4, 1, 1, 4, 1],
                [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
                [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
                [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
                [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
                [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
                [1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1], // Hatch exit at (7, 8)
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            ],
            portals: [
                { gridX: 7, gridY: 8, targetMapId: 'world_map', targetGridX: 45, targetGridY: 46 }
            ],
            npcs: [
                {
                    id: 'red_mage_npc',
                    name: 'Hologram Guide',
                    spriteKey: 'npc',
                    gridX: 5,
                    gridY: 4,
                    dialogue: [
                        '[SYSTEM HOLOGRAPHIC INTERFACE ONLINE]',
                        'Welcome, Hunt Unit Swift.',
                        'The celestial drop pod remains operational as your safe bio-reconstruction anchor.',
                        'Eradicate monster species across the realm to lift the ecological blight.',
                        'Regional settlements are taking root across the continent as your Soul Level ascends.'
                    ]
                },
                {
                    id: 'save_console',
                    name: 'Meteor Data Console',
                    spriteKey: 'save_altar',
                    gridX: 9,
                    gridY: 4,
                    dialogue: [
                        '[METEOR MAINFRAME: SYNC PROTOCOL]',
                        'Transferring hunt telemetry and bio-metrics...',
                        'State validation checks: PASSED.',
                        'Progress successfully synchronized to Meteor Database!'
                    ]
                }
            ]
        },
        town_oakhaven: {
            id: 'town_oakhaven',
            name: 'Oakhaven',
            width: 22,
            height: 17,
            grid: [
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
                [1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 3, 1], // Houses
                [1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 3, 1],
                [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
                [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
                [1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 3, 1],
                [1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 3, 1],
                [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
                [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1], // Exit portal at (5,9), southern district walkway at cols 14-16
                [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
                [1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 3, 1],
                [1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 1, 3, 1, 1, 3, 1, 1, 3, 1, 3, 3, 1],
                [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
                [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
                [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            ],
            portals: [
                { gridX: 5, gridY: 9, targetMapId: 'world_map', targetGridX: 60, targetGridY: 49 }
            ],
            npcs: []
        },
        town_aetheria: {
            id: 'town_aetheria',
            name: 'Aetheria',
            width: 21,
            height: 15,
            grid: [
                [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
                [5, 0, 0, 3, 3, 3, 0, 0, 5, 3, 3, 3, 5, 0, 0, 3, 3, 3, 0, 0, 5],
                [5, 0, 3, 3, 3, 3, 3, 0, 5, 3, 3, 3, 5, 0, 3, 3, 3, 3, 3, 0, 5],
                [5, 3, 3, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 3, 3, 5],
                [5, 3, 3, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 3, 3, 5],
                [5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5],
                [5, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 5],
                [5, 0, 0, 3, 3, 3, 0, 3, 3, 3, 3, 3, 3, 3, 0, 3, 3, 3, 0, 0, 5],
                [5, 5, 0, 3, 3, 3, 0, 3, 3, 3, 3, 3, 3, 3, 0, 3, 3, 3, 0, 5, 5],
                [5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5],
                [5, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 5],
                [5, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 5],
                [5, 5, 5, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 5, 5, 5],
                [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], // Exit portal at (10, 13)
                [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
            ],
            portals: [
                { gridX: 10, gridY: 13, targetMapId: 'world_map', targetGridX: 65, targetGridY: 83 }
            ],
            npcs: []
        },
        town_ironspire: {
            id: 'town_ironspire',
            name: 'Ironspire',
            width: 21,
            height: 15,
            grid: [
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                [1, 4, 4, 3, 3, 3, 4, 4, 1, 3, 3, 3, 1, 4, 4, 3, 3, 3, 4, 4, 1],
                [1, 4, 3, 3, 3, 3, 3, 4, 1, 3, 3, 3, 1, 4, 3, 3, 3, 3, 3, 4, 1],
                [1, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 1],
                [1, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 1],
                [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
                [1, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 1],
                [1, 4, 4, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 4, 4, 1],
                [1, 1, 4, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 4, 1, 1],
                [1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1],
                [1, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 1],
                [1, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 1],
                [1, 1, 1, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 1, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Exit portal at (10, 13)
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
            ],
            portals: [
                { gridX: 10, gridY: 13, targetMapId: 'world_map', targetGridX: 88, targetGridY: 36 }
            ],
            npcs: []
        },
        dungeon_map: {
            id: 'dungeon_map',
            name: 'Dungeon Cave',
            width: 24,
            height: 18,
            grid: [
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
                [1, 4, 4, 4, 4, 4, 1, 4, 4, 4, 4, 4, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1], // Row 1 - Descent stairs at (22, 1)
                [1, 4, 1, 1, 1, 4, 1, 4, 1, 1, 1, 4, 1, 4, 1, 1, 1, 1, 1, 1, 1, 4, 4, 1], // Row 2
                [1, 4, 1, 4, 4, 4, 4, 4, 4, 4, 1, 4, 1, 4, 1, 4, 4, 4, 4, 4, 1, 4, 4, 1], // Row 3
                [1, 4, 1, 4, 1, 1, 1, 1, 1, 4, 1, 4, 1, 4, 1, 4, 1, 1, 1, 4, 1, 4, 4, 1], // Row 4
                [1, 4, 4, 4, 1, 4, 4, 4, 1, 4, 4, 4, 4, 4, 4, 4, 1, 4, 1, 4, 4, 4, 4, 1], // Row 5 - Archway at (12, 5)
                [1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 1, 1, 1, 4, 1, 4, 1, 1, 1, 1, 4, 1], // Row 6
                [1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 1, 4, 4, 4, 4, 1], // Row 7
                [1, 4, 1, 4, 4, 4, 4, 4, 4, 4, 1, 4, 1, 4, 1, 4, 4, 4, 1, 4, 1, 1, 1, 1], // Row 8
                [1, 4, 1, 1, 1, 1, 4, 1, 1, 1, 1, 4, 1, 4, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1], // Row 9
                [1, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 1], // Row 10 - Walled between (7,10) and (18,10)
                [1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 11 - Exit portal at (6, 11)
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 12
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 13
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 14
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 15
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 16
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 17
            ],
            portals: [
                { gridX: 6, gridY: 11, targetMapId: 'world_map', targetGridX: 55, targetGridY: 21 },
                { gridX: 22, gridY: 1, targetMapId: 'dungeon_floor2', targetGridX: 4, targetGridY: 15 }
            ],
            npcs: []
        },
        dungeon_floor2: {
            id: 'dungeon_floor2',
            name: 'Catacombs of the Fallen (Floor 2)',
            width: 24,
            height: 18,
            grid: [
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 1
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 2 - Ascent stairs at (12, 2)
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 3
                [1, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 1], // Row 4 - Locked Gate at (12,4), Chest at (20,4)
                [1, 4, 1, 1, 4, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 4, 1, 1, 1, 4, 1], // Row 5
                [1, 4, 1, 1, 4, 1, 4, 1, 1, 1, 1, 4, 4, 1, 1, 1, 4, 1, 4, 1, 1, 1, 4, 1], // Row 6
                [1, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 4, 4, 1, 1, 1, 4, 4, 4, 4, 4, 4, 4, 1], // Row 7
                [1, 4, 1, 1, 1, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 4, 4, 1], // Row 8
                [1, 4, 1, 1, 1, 1, 4, 1, 1, 4, 4, 4, 4, 4, 4, 1, 1, 4, 1, 1, 1, 4, 4, 1], // Row 9
                [1, 4, 4, 4, 4, 4, 4, 1, 1, 4, 4, 4, 4, 4, 4, 1, 1, 4, 4, 4, 4, 4, 4, 1], // Row 10
                [1, 1, 1, 1, 4, 1, 1, 1, 1, 4, 4, 1, 1, 4, 4, 1, 1, 1, 1, 4, 1, 1, 1, 1], // Row 11
                [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1], // Row 12
                [1, 4, 1, 1, 4, 1, 1, 1, 1, 1, 4, 1, 1, 4, 1, 1, 1, 1, 1, 4, 1, 1, 4, 1], // Row 13
                [1, 4, 1, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 4, 1], // Row 14
                [1, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1, 4, 4, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 1], // Row 15
                [1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 16 - Ascent stairs to F1 at (4, 16)
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 17
            ],
            portals: [
                { gridX: 4, gridY: 16, targetMapId: 'dungeon_map', targetGridX: 21, targetGridY: 1 },
                { gridX: 12, gridY: 2, targetMapId: 'castle_interior', targetGridX: 18, targetGridY: 4 }
            ],
            npcs: [
                {
                    id: 'dungeon_chest',
                    name: 'Iron-Bound Chest',
                    spriteKey: 'treasure_chest',
                    gridX: 20,
                    gridY: 4,
                    dialogue: [
                        'You inspect the ancient iron-bound coffer.',
                        'Inside lies an intricately carved Iron Skeleton Key!'
                    ]
                },
                {
                    id: 'dungeon_gate_npc',
                    name: 'Ancient Portcullis',
                    spriteKey: 'locked_dungeon_door',
                    gridX: 12,
                    gridY: 4,
                    dialogue: [
                        'A massive iron portcullis bars the shortcut between the Royal Keep and the Catacombs.',
                        'A skull-inscribed keyhole glints in the torchlight.'
                    ]
                }
            ]
        },
        castle_exterior: {
            id: 'castle_exterior',
            name: 'Royal Castle - Outer Bailey',
            width: 22,
            height: 16,
            grid: [
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 1
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 2 - Keep entrance at (10, 2)
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 3
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 4 - Sentries at (8, 4), (12, 4)
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 5
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 6
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 7
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 8 - Herald at (14, 8)
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 9
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 10
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 11
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 12
                [1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1, 1, 1], // Row 13
                [1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 14 - Spawn from world map
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 15 - Exit portal at (10, 15)
            ],
            portals: [
                { gridX: 10, gridY: 15, targetMapId: 'world_map', targetGridX: 50, targetGridY: 89 },
                { gridX: 10, gridY: 2, targetMapId: 'castle_interior', targetGridX: 10, targetGridY: 13 }
            ],
            npcs: [
                {
                    id: 'castle_sentry_left',
                    name: 'Royal Sentry Marcus',
                    spriteKey: 'royal_knight',
                    gridX: 8,
                    gridY: 4,
                    dialogue: [
                        'Halt, traveller! You stand before the outer bailey of the Royal Sovereign Keep.',
                        'The King grants audience to the Hunter who stems the monster tide.'
                    ]
                },
                {
                    id: 'castle_sentry_right',
                    name: 'Royal Sentry Thorne',
                    spriteKey: 'royal_knight',
                    gridX: 12,
                    gridY: 4,
                    dialogue: [
                        'Keep your weapons sheathed within the courtyard walls.',
                        'The subterranean vaults below the castle have been sealed since the cataclysm.'
                    ]
                },
                {
                    id: 'castle_herald',
                    name: 'Royal Herald Justin',
                    spriteKey: 'settler_scout',
                    gridX: 14,
                    gridY: 8,
                    dialogue: [
                        'Hear ye! The royal throne room lies through the double gates ahead.',
                        'His Majesty closely monitors the extinction reports of our realm.'
                    ]
                }
            ]
        },
        castle_interior: {
            id: 'castle_interior',
            name: 'Royal Castle - The Grand Keep',
            width: 21,
            height: 15,
            grid: [
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 0
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 1
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 2
                [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 1, 1], // Row 3 - Throne at (10,3), Secret stairs at (18,3)
                [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 1, 1], // Row 4 - King Aurelius at (10,4)
                [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1], // Row 5
                [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1], // Row 6 - Valerie at (8,6), Soul Altar at (14,6)
                [1, 1, 1, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1], // Row 7
                [1, 1, 1, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1], // Row 8
                [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1], // Row 9
                [1, 1, 1, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1], // Row 10
                [1, 1, 1, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 1, 1], // Row 11
                [1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 1], // Row 12
                [1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Row 13 - Entry walkway
                [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // Row 14 - Exit portal at (10, 14)
            ],
            portals: [
                { gridX: 10, gridY: 14, targetMapId: 'castle_exterior', targetGridX: 10, targetGridY: 3 },
                { gridX: 18, gridY: 3, targetMapId: 'dungeon_floor2', targetGridX: 12, targetGridY: 3 }
            ],
            npcs: [
                {
                    id: 'king_aurelius',
                    name: 'King Aurelius III',
                    spriteKey: 'king_npc',
                    gridX: 10,
                    gridY: 4,
                    dialogue: [
                        'Welcome to the Grand Keep, Hunter Swift.',
                        'I have watched from these parapets as settlements bloom under your protection.',
                        'Eradicate the remaining monster broods so our people may reclaim this continent forever.'
                    ]
                },
                {
                    id: 'knight_commander_valerie',
                    name: 'Knight Commander Valerie',
                    spriteKey: 'royal_knight',
                    gridX: 8,
                    gridY: 6,
                    dialogue: [
                        'Our knights stand ready to defend the crown.',
                        'If you dare brave the catacombs beneath our throne room, heed the warning: ancient terrors sleep below.'
                    ]
                },
                {
                    id: 'castle_soul_altar',
                    name: 'Sovereign Soul Altar',
                    spriteKey: 'save_altar',
                    gridX: 14,
                    gridY: 6,
                    dialogue: [
                        '[SOVEREIGN SOUL ALTAR: SYNC PROTOCOL]',
                        'Channeling planetary soul leylines and royal bio-frequencies...',
                        'State validation checks: PASSED.',
                        'Progress successfully synchronized to the Royal Sovereign Archive!'
                    ]
                }
            ]
        }
    };

    public static getMap(id: string): MapData {
        if (id === 'town_map') {
            return this.maps['town_oakhaven'] || this.maps.world_map;
        }
        return this.maps[id] || this.maps.world_map;
    }

    public static getTownName(townId: string, soulLevel: number): string {
        if (townId === 'town_oakhaven' || townId === 'town_map') {
            if (soulLevel >= 6) return 'Oakhaven - Verdant Metropolis (Soul LV 6)';
            if (soulLevel === 5) return 'Oakhaven - Merchant Haven (Soul LV 5)';
            if (soulLevel === 4) return 'Oakhaven - Thriving Township (Soul LV 4)';
            if (soulLevel === 3) return 'Oakhaven - Prosperous Village (Soul LV 3)';
            if (soulLevel === 2) return 'Oakhaven - Agricultural Hamlet (Soul LV 2)';
            if (soulLevel === 1) return 'Oakhaven - Pioneer Outpost (Soul LV 1)';
            return 'Oakhaven - Wild Clearing (Soul LV 0)';
        }
        if (townId === 'town_aetheria') {
            if (soulLevel >= 6) return 'Aetheria - Starlight Citadel (Soul LV 6)';
            if (soulLevel === 5) return 'Aetheria - Astral Academy (Soul LV 5)';
            if (soulLevel === 4) return 'Aetheria - Arcane Sanctuary (Soul LV 4)';
            if (soulLevel === 3) return 'Aetheria - Celestial Enclave (Soul LV 3)';
            if (soulLevel === 2) return 'Aetheria - Aetheric Sanctum (Soul LV 2)';
            if (soulLevel === 1) return 'Aetheria - Luminescent Grove (Soul LV 1)';
            return 'Aetheria - Silent Grove (Soul LV 0)';
        }
        if (townId === 'town_ironspire') {
            if (soulLevel >= 6) return 'Ironspire - The Imperial Fortress (Soul LV 6)';
            if (soulLevel === 5) return 'Ironspire - Vulcan Bastion (Soul LV 5)';
            if (soulLevel === 4) return 'Ironspire - Roaring Smeltery (Soul LV 4)';
            if (soulLevel === 3) return 'Ironspire - The Grand Forge (Soul LV 3)';
            if (soulLevel === 2) return 'Ironspire - Masonry Bastion (Soul LV 2)';
            if (soulLevel === 1) return 'Ironspire - Miner\'s Post (Soul LV 1)';
            return 'Ironspire - Barren Quarry (Soul LV 0)';
        }
        return this.maps[townId]?.name || 'Unknown Settlement';
    }

    public static getTownMapName(soulLevel: number): string {
        return this.getTownName('town_oakhaven', soulLevel);
    }

    public static getChunkData(mapId: string, chunkX: number, chunkY: number, chunkSize: number = 10): ChunkData {
        const map = this.getMap(mapId);
        const startX = chunkX * chunkSize;
        const startY = chunkY * chunkSize;

        const subGrid: number[][] = [];
        for (let r = 0; r < chunkSize; r++) {
            const row: number[] = [];
            let worldY = (startY + r) % map.height;
            if (worldY < 0) worldY += map.height;
            for (let c = 0; c < chunkSize; c++) {
                let worldX = (startX + c) % map.width;
                if (worldX < 0) worldX += map.width;
                row.push(map.grid[worldY][worldX]);
            }
            subGrid.push(row);
        }

        const totalChunksX = Math.ceil(map.width / chunkSize);
        const totalChunksY = Math.ceil(map.height / chunkSize);
        const normChunkX = ((chunkX % totalChunksX) + totalChunksX) % totalChunksX;
        const normChunkY = ((chunkY % totalChunksY) + totalChunksY) % totalChunksY;

        const chunkPortals = (map.portals || []).filter(p => {
            const cx = Math.floor(p.gridX / chunkSize);
            const cy = Math.floor(p.gridY / chunkSize);
            return cx === normChunkX && cy === normChunkY;
        });

        const chunkNpcs = (map.npcs || []).filter(n => {
            const cx = Math.floor(n.gridX / chunkSize);
            const cy = Math.floor(n.gridY / chunkSize);
            return cx === normChunkX && cy === normChunkY;
        });

        return {
            chunkX,
            chunkY,
            width: chunkSize,
            height: chunkSize,
            grid: subGrid,
            portals: chunkPortals,
            npcs: chunkNpcs
        };
    }
}
