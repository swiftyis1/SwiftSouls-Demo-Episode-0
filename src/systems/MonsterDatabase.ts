import { GameManager } from './GameManager.ts';
import type { ElementType } from './ElementSystem.ts';

export interface MonsterStats {
    speciesId: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    strength: number;
    defense: number;
    agility: number;
    magic: number;
    magicDefense: number;
    accuracy: number;
    evasion: number;
    critChance: number;
    critDamage: number;
    luck: number;
    physicalPenetration: number;
    magicPenetration: number;
    spriteKey: string;
    color: number;
    element?: ElementType;
    elementalResistances?: Partial<Record<ElementType, number>>;
}

export interface EncounterEntry {
    speciesId: string;
    weight: number;
}

export const MonsterDatabase: { [speciesId: string]: MonsterStats } = {
    keenkat: {
        speciesId: 'keenkat',
        name: 'Verdant Kit',
        level: 1,
        hp: 10,
        maxHp: 10,
        strength: 3,
        defense: 1,
        agility: 7,
        magic: 2,
        magicDefense: 2,
        accuracy: 88,
        evasion: 12,
        critChance: 6,
        critDamage: 1.2,
        luck: 40,
        physicalPenetration: 0,
        magicPenetration: 0,
        spriteKey: 'keenkat',
        color: 0xffaa33,
        element: 'physical',
        elementalResistances: { physical: 0.2, dark: -0.3 }
    },
    slime: {

        speciesId: 'slime',
        name: 'Acid Slime',
        level: 1,
        hp: 15,
        maxHp: 15,
        strength: 4,
        defense: 2,
        agility: 3,
        magic: 6,
        magicDefense: 4,
        accuracy: 90,
        evasion: 2,
        critChance: 3,
        critDamage: 1.3,
        luck: 20,
        physicalPenetration: 0,
        magicPenetration: 10,
        spriteKey: 'slime',
        color: 0x00ff88,
        element: 'poison',
        elementalResistances: { poison: 0.8, water: 0.5, fire: -0.5, lightning: -0.5 }
    },
    snake: {
        speciesId: 'snake',
        name: 'Heal Snake',
        level: 1,
        hp: 18,
        maxHp: 18,
        strength: 5,
        defense: 3,
        agility: 5,
        magic: 5,
        magicDefense: 5,
        accuracy: 94,
        evasion: 8,
        critChance: 5,
        critDamage: 1.4,
        luck: 35,
        physicalPenetration: 0,
        magicPenetration: 0,
        spriteKey: 'snake',
        color: 0x33cc66,
        element: 'earth',
        elementalResistances: { poison: 1.0, earth: 0.5, cold: -0.5 }
    },
    bat: {
        speciesId: 'bat',
        name: 'Vampire Bat',
        level: 1,
        hp: 12,
        maxHp: 12,
        strength: 6,
        defense: 1,
        agility: 8,
        magic: 4,
        magicDefense: 3,
        accuracy: 96,
        evasion: 16,
        critChance: 10,
        critDamage: 1.5,
        luck: 15,
        physicalPenetration: 0,
        magicPenetration: 0,
        spriteKey: 'bat',
        color: 0x9933ff,
        element: 'dark',
        elementalResistances: { dark: 0.6, cold: 0.4, light: -0.75, fire: -0.5 }
    },
    goblin: {
        speciesId: 'goblin',
        name: 'Dungeon Goblin',
        level: 2,
        hp: 25,
        maxHp: 25,
        strength: 8,
        defense: 5,
        agility: 4,
        magic: 3,
        magicDefense: 2,
        accuracy: 92,
        evasion: 5,
        critChance: 15,
        critDamage: 1.6,
        luck: 25,
        physicalPenetration: 15,
        magicPenetration: 0,
        spriteKey: 'goblin',
        color: 0xff6600,
        element: 'earth',
        elementalResistances: { earth: 0.4, lightning: -0.25 }
    },
    skeleton: {
        speciesId: 'skeleton',
        name: 'Cave Skeleton',
        level: 3,
        hp: 32,
        maxHp: 32,
        strength: 10,
        defense: 7,
        agility: 3,
        magic: 8,
        magicDefense: 6,
        accuracy: 95,
        evasion: 4,
        critChance: 12,
        critDamage: 1.5,
        luck: 10,
        physicalPenetration: 25,
        magicPenetration: 0,
        spriteKey: 'skeleton',
        color: 0xcccccc,
        element: 'dark',
        elementalResistances: { poison: 1.0, cold: 0.5, dark: 0.5, light: -1.0, fire: -0.5 }
    },
    phoenix: {
        speciesId: 'phoenix',
        name: 'Phoenix Guardian',
        level: 5,
        hp: 100,
        maxHp: 100,
        strength: 18,
        defense: 12,
        agility: 10,
        magic: 24,
        magicDefense: 18,
        accuracy: 98,
        evasion: 12,
        critChance: 18,
        critDamage: 1.8,
        luck: 50,
        physicalPenetration: 0,
        magicPenetration: 20,
        spriteKey: 'phoenix',
        color: 0xff3300,
        element: 'fire',
        elementalResistances: { fire: 1.25, light: 0.75, cold: -0.75, water: -0.75 }
    },
    cataclysm: {
        speciesId: 'cataclysm',
        name: 'Cataclysm',
        level: 10,
        hp: 10056,
        maxHp: 10056,
        strength: 100,
        defense: 66,
        agility: 131,
        magic: 5,
        magicDefense: 3,
        accuracy: 95,
        evasion: 5,
        critChance: 7,
        critDamage: 1.5,
        luck: 10,
        physicalPenetration: 0,
        magicPenetration: 0,
        spriteKey: 'phoenix',
        color: 0xff0055,
        element: 'dark',
        elementalResistances: {
            fire: 0.5, dark: 0.5, light: 0.5, poison: 0.5,
            earth: 0.5, cold: 0.5, water: 0.5, lightning: 0.5, physical: 0.5
        }
    }
};

export const AlphaBossDatabase: { [speciesId: string]: MonsterStats } = {
    keenkat: {
        speciesId: 'keenkat',
        name: 'Alpha Pridecat Sovereign',
        level: 4,
        hp: 975,
        maxHp: 975,
        strength: 12,
        defense: 5,
        agility: 18,
        magic: 6,
        magicDefense: 6,
        accuracy: 93,
        evasion: 22,
        critChance: 20,
        critDamage: 1.7,
        luck: 60,
        physicalPenetration: 0,
        magicPenetration: 0,
        spriteKey: 'keenkat',
        color: 0xffcc44,
        element: 'physical',
        elementalResistances: { physical: 0.3, dark: -0.2 }
    },
    slime: {
        speciesId: 'slime',
        name: 'Alpha Prime Slime',
        level: 5,
        hp: 1275,
        maxHp: 1275,
        strength: 14,
        defense: 8,
        agility: 6,
        magic: 15,
        magicDefense: 12,
        accuracy: 95,
        evasion: 5,
        critChance: 8,
        critDamage: 1.5,
        luck: 40,
        physicalPenetration: 0,
        magicPenetration: 25,
        spriteKey: 'slime',
        color: 0x00ffaa,
        element: 'poison',
        elementalResistances: { poison: 1.0, water: 0.6, fire: -0.4, lightning: -0.4 }
    },
    snake: {
        speciesId: 'snake',
        name: 'Alpha Great Basilisk',
        level: 6,
        hp: 1650,
        maxHp: 1650,
        strength: 16,
        defense: 10,
        agility: 10,
        magic: 14,
        magicDefense: 14,
        accuracy: 96,
        evasion: 12,
        critChance: 10,
        critDamage: 1.6,
        luck: 60,
        physicalPenetration: 10,
        magicPenetration: 10,
        spriteKey: 'snake',
        color: 0x33ff66,
        element: 'earth',
        elementalResistances: { poison: 1.0, earth: 0.6, cold: -0.4 }
    },
    bat: {
        speciesId: 'bat',
        name: 'Alpha Vampire Archlord',
        level: 6,
        hp: 1200,
        maxHp: 1200,
        strength: 18,
        defense: 6,
        agility: 16,
        magic: 12,
        magicDefense: 10,
        accuracy: 98,
        evasion: 25,
        critChance: 20,
        critDamage: 1.8,
        luck: 30,
        physicalPenetration: 10,
        magicPenetration: 0,
        spriteKey: 'bat',
        color: 0xaa33ff,
        element: 'dark',
        elementalResistances: { dark: 0.7, cold: 0.5, light: -0.6, fire: -0.4 }
    },
    goblin: {
        speciesId: 'goblin',
        name: 'Alpha Goblin Warchief',
        level: 7,
        hp: 2100,
        maxHp: 2100,
        strength: 22,
        defense: 14,
        agility: 8,
        magic: 10,
        magicDefense: 8,
        accuracy: 95,
        evasion: 8,
        critChance: 25,
        critDamage: 1.9,
        luck: 45,
        physicalPenetration: 30,
        magicPenetration: 0,
        spriteKey: 'goblin',
        color: 0xff7700,
        element: 'earth',
        elementalResistances: { earth: 0.5, lightning: -0.2 }
    },
    skeleton: {
        speciesId: 'skeleton',
        name: 'Alpha Undead Dreadknight',
        level: 8,
        hp: 2550,
        maxHp: 2550,
        strength: 25,
        defense: 18,
        agility: 7,
        magic: 18,
        magicDefense: 15,
        accuracy: 96,
        evasion: 6,
        critChance: 22,
        critDamage: 1.8,
        luck: 25,
        physicalPenetration: 40,
        magicPenetration: 0,
        spriteKey: 'skeleton',
        color: 0xeeeeee,
        element: 'dark',
        elementalResistances: { poison: 1.0, cold: 0.6, dark: 0.6, light: -0.8, fire: -0.4 }
    },
    phoenix: {
        speciesId: 'phoenix',
        name: 'Eternal Phoenix Sovereign',
        level: 10,
        hp: 3750,
        maxHp: 3750,
        strength: 32,
        defense: 22,
        agility: 18,
        magic: 45,
        magicDefense: 35,
        accuracy: 100,
        evasion: 18,
        critChance: 30,
        critDamage: 2.2,
        luck: 100,
        physicalPenetration: 15,
        magicPenetration: 35,
        spriteKey: 'phoenix',
        color: 0xff2200,
        element: 'fire',
        elementalResistances: { fire: 1.35, light: 0.85, cold: -0.6, water: -0.6 }
    }
};

export function getAlphaBoss(speciesId: string): MonsterStats {
    const template = AlphaBossDatabase[speciesId] || AlphaBossDatabase['slime'];
    return {
        ...template,
        hp: template.maxHp
    };
}

// Sprint 25: Special Quest & Regional Encounter Bosses
export const SpecialBossDatabase: { [bossId: string]: MonsterStats } = {
    astral_scavenger: {
        speciesId: 'astral_scavenger',
        name: 'Astral Scavenger',
        level: 3,
        hp: 200,
        maxHp: 200,
        strength: 9,
        defense: 4,
        agility: 17,
        magic: 16,
        magicDefense: 12,
        accuracy: 95,
        evasion: 8,
        critChance: 5,
        critDamage: 1.5,
        luck: 35,
        physicalPenetration: 2,
        magicPenetration: 5,
        spriteKey: 'bat',
        color: 0x8a2be2,
        element: 'dark',
        elementalResistances: { dark: 0.8, light: -0.5, poison: 0.3 }
    },
    cataclysm: {
        speciesId: 'cataclysm',
        name: 'Cataclysm',
        level: 10,
        hp: 10056,
        maxHp: 10056,
        strength: 100,
        defense: 66,
        agility: 131,
        magic: 5,
        magicDefense: 3,
        accuracy: 95,
        evasion: 5,
        critChance: 7,
        critDamage: 1.5,
        luck: 10,
        physicalPenetration: 0,
        magicPenetration: 0,
        spriteKey: 'phoenix',
        color: 0xff0055,
        element: 'dark',
        elementalResistances: {
            fire: 0.5, dark: 0.5, light: 0.5, poison: 0.5,
            earth: 0.5, cold: 0.5, water: 0.5, lightning: 0.5, physical: 0.5
        }
    }
};

export function getSpecialBoss(bossId: string): MonsterStats {
    if (bossId === 'cataclysm') {
        return GameManager.computeCataclysmBossStats();
    }
    const template = SpecialBossDatabase[bossId] || SpecialBossDatabase['astral_scavenger'];
    return {
        ...template,
        hp: template.maxHp
    };
}

export const EncounterTables: { [mapId: string]: EncounterEntry[] } = {
    world_map: [
        { speciesId: 'slime', weight: 40 },
        { speciesId: 'snake', weight: 35 },
        { speciesId: 'bat', weight: 25 }
    ],
    // Low/plain grass in the starter world map — only the 2 weakest monsters to ease new players in
    world_map_lowgrass: [
        { speciesId: 'keenkat', weight: 120 }, // spawns ~62% of the time — most common beginner target
        { speciesId: 'slime', weight: 40 },
        { speciesId: 'snake', weight: 35 }
    ],
    dungeon_map: [
        { speciesId: 'goblin', weight: 40 },
        { speciesId: 'skeleton', weight: 35 },
        { speciesId: 'bat', weight: 25 }
    ],
    dungeon_floor2: [
        { speciesId: 'skeleton', weight: 35 },
        { speciesId: 'goblin', weight: 30 },
        { speciesId: 'bat', weight: 20 },
        { speciesId: 'phoenix', weight: 15 }
    ],
    castle_exterior: [
        { speciesId: 'phoenix', weight: 30 },
        { speciesId: 'skeleton', weight: 40 },
        { speciesId: 'goblin', weight: 30 }
    ]
};

export interface EcosystemStatus {
    totalSpecies: number;
    activeSpecies: string[];
    endangeredSpecies: string[];
    extinctSpecies: string[];
    isUnderMigration: boolean;
    allExtinctOrEndangered: boolean;
}

export function getGlobalEcosystemStatus(): EcosystemStatus {
    const state = GameManager.instance.getState();
    const allSpecies = ['keenkat', 'slime', 'snake', 'bat', 'goblin', 'skeleton', 'phoenix'];
    const activeSpecies: string[] = [];
    const endangeredSpecies: string[] = [];
    const extinctSpecies: string[] = [];

    for (const id of allSpecies) {
        const crystal = state.soulCrystals[id];
        if (!crystal) {
            activeSpecies.push(id);
        } else if (crystal.isExtinct) {
            extinctSpecies.push(id);
        } else if (crystal.fragments >= 49) {
            endangeredSpecies.push(id);
        } else {
            activeSpecies.push(id);
        }
    }

    return {
        totalSpecies: allSpecies.length,
        activeSpecies,
        endangeredSpecies,
        extinctSpecies,
        isUnderMigration: activeSpecies.length > 0 && (extinctSpecies.length > 0 || endangeredSpecies.length > 0),
        allExtinctOrEndangered: activeSpecies.length === 0
    };
}

export function rollEncounter(mapId: string): MonsterStats | null {
    const table = EncounterTables[mapId];
    const state = GameManager.instance.getState();

    // 1. Check primary native encounter table for this map
    let activeEntries: EncounterEntry[] = [];
    if (table && table.length > 0) {
        activeEntries = table.filter(entry => {
            const crystalState = state.soulCrystals[entry.speciesId];
            if (!crystalState) return true;
            return !crystalState.isExtinct && crystalState.fragments < 49;
        });
    }

    // 2. If native species exist, roll from the native encounter table
    if (activeEntries.length > 0) {
        const totalWeight = activeEntries.reduce((sum, entry) => sum + entry.weight, 0);
        let rand = Math.random() * totalWeight;

        let chosenSpeciesId = activeEntries[0].speciesId;
        for (const entry of activeEntries) {
            if (rand < entry.weight) {
                chosenSpeciesId = entry.speciesId;
                break;
            }
            rand -= entry.weight;
        }

        const template = MonsterDatabase[chosenSpeciesId];
        if (template) {
            return {
                ...template,
                hp: template.maxHp
            };
        }
    }

    // 3. GLOBAL SPAWNING SAFETY & MIGRATION FALLBACK:
    // If native species in this biome are all endangered (>= 49) or extinct,
    // dynamically pull from any remaining non-extinct species on the planet.
    const ecosystem = getGlobalEcosystemStatus();

    // If every single species on the planet is endangered or extinct, wild wilderness is completely quiet
    if (ecosystem.allExtinctOrEndangered || ecosystem.activeSpecies.length === 0) {
        return null;
    }

    // Dynamic Territory Migration: Remaining species expand territory into this cleared sector
    const migratedSpecies = ecosystem.activeSpecies;
    const randomIndex = Math.floor(Math.random() * migratedSpecies.length);
    const chosenMigratedId = migratedSpecies[randomIndex];

    const template = MonsterDatabase[chosenMigratedId];
    if (!template) return null;

    return {
        ...template,
        hp: template.maxHp
    };
}
