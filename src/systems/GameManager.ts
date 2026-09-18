import { CryptoChecksum } from './CryptoChecksum.ts';
import { TelegramAuth, type TelegramUser } from './TelegramAuth.ts';
import { CloudSyncClient, type SyncResult } from './CloudSyncClient.ts';
import { UserAuthManager } from './UserAuthManager.ts';
import { LicenseManager } from './LicenseManager.ts';
import { LiveOpsManager } from './LiveOpsManager.ts';
import { AchievementManager } from './AchievementManager.ts';
import type { ElementType, StatusAilmentType } from './ElementSystem.ts';

export type EquipmentSlot = 'sword' | 'shield' | 'armor' | 'helmet' | 'ring1' | 'ring2' | 'amulet' | 'earrings';

export const ALL_EQUIPMENT_SLOTS: EquipmentSlot[] = [
    'sword', 'shield', 'armor', 'helmet', 'ring1', 'ring2', 'amulet', 'earrings'
];

export const ALL_MONSTER_SPECIES = [
    'keenkat', 'goblin', 'snake', 'slime', 'bat', 'skeleton', 'phoenix'
] as const;
export type MonsterSpeciesId = typeof ALL_MONSTER_SPECIES[number];

export interface SaveEnvelope {
    version: 2;
    slot: number;
    timestamp: number;
    signature: string;
    payload: string; // Serialized GameState JSON
}

export interface SlotPreview {
    slot?: number;
    name: string;
    level: number;
    mapId: string;
    isTampered?: boolean;
    isLegacy?: boolean;
    timestamp?: number;
    // Sprint 24 Rich Preview Fields:
    timePlayedSeconds?: number;
    totalFragments?: number;
    maxFragments?: number;
    equippedCrystals?: { [slot in EquipmentSlot]?: string | null };
    lastHealingStationName?: string;
    // Sprint 28: Hero gender for save card display
    playerGender?: 'male' | 'female';
}

export interface HealingStationConfig {
    stationId: string;
    name: string;
    mapId: string;
    gridX: number;
    gridY: number;
    requiredSoulLevel: number;
    requiredFragments: number;
    description: string;
    flavorAttune?: string;
}

export interface PetAugmentation {
    secondarySpeciesId: string;
    name: string;
    traitName: string;
    description: string;
    bonusSkill?: string;
    passiveDescription?: string;
    bonusHpPercent: number;
    bonusAttackPercent: number;
    bonusDefensePercent: number;
    secondaryElement?: ElementType;
    auraEffect?: string;
}

export interface PetSkill {
    id: string;
    name: string;
    type: 'damage' | 'heal' | 'buff';
    element: ElementType;
    spCost: number;
    power: number;
    description: string;
}

export interface PetCompanionState {
    speciesId: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    sp: number;
    maxSp: number;
    isDefeated: boolean;
    signatureSkill: PetSkill;
    augmentation?: PetAugmentation | null;
}

export interface CharacterStats {
    name: string;
    level: number; // Soul Level (calculated from total fragments collected)
    hp: number;
    maxHp: number;
    sp: number;
    maxSp: number;
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
    spCostReduction: number;
}

export interface Item {
    id: string;
    name: string;
    description: string;
    type: 'consumable' | 'weapon' | 'armor';
    value: number; // HP heal, strength boost, etc.
}

export interface SoulCrystalState {
    fragments: number;
    isExtinct: boolean;
}

export interface GameState {
    party: CharacterStats[];
    inventory: { itemId: string; quantity: number }[];
    quests: { [questId: string]: 'inactive' | 'active' | 'completed' };
    currentScene: string;
    currentMapId: string;
    spawnPoint: { x: number; y: number };
    playerGridX?: number;
    playerGridY?: number;
    // Soul Crystals & Equipment Infusion
    soulCrystals: { [monsterId: string]: SoulCrystalState };
    equippedCrystals: { [slot in EquipmentSlot]: string | null };
    // Sprint 13 & 25: Masterwork Forge Refinements, Boss Soulmelds & Dual Sockets
    forgeRefinements?: { [slot in EquipmentSlot]?: number };
    bossMelds?: string[];
    hasUnlockedEarrings?: boolean;
    dualSocketUnlocked?: { [slot in EquipmentSlot]?: boolean };
    secondaryEquippedCrystals?: { [slot in EquipmentSlot]?: string | null };
    // Universal Achievements
    achievements?: { [achievementId: string]: number };
    // 80% Extinction Climax Event State
    extinctionEventTriggered?: boolean;
    finalBossUnlocked?: boolean;
    cataclysmBossDefeated?: boolean;
    // Sprint 24 Additions:
    timePlayedSeconds?: number;
    lastAttunedHealingStation?: {
        stationId: string;
        name: string;
        mapId: string;
        x: number;
        y: number;
    } | null;
    petCompanion?: PetCompanionState | null;
    // Sprint 28: Hero gender selection (Valen = 'male', Cora = 'female')
    playerGender?: 'male' | 'female';
}

export interface SlotEffect {
    description: string;
    modifier?: {
        maxHp?: number;
        maxSp?: number;
        strength?: number;
        defense?: number;
        agility?: number;
        magic?: number;
        magicDefense?: number;
        accuracy?: number;
        evasion?: number;
        critChance?: number;
        critDamage?: number;
        luck?: number;
        physicalPenetration?: number;
        magicPenetration?: number;
        spCostReduction?: number;
        lifesteal?: number;
        regen?: number;
        counterRate?: number;
        elementalResistances?: Partial<Record<ElementType, number>>;
    };
    spell?: {
        name: string;
        spCost: number;
        power: number;
        effect?: string;
    };
}

export interface ActiveSpell {
    slotKey: 'ring1' | 'ring2' | 'amulet';
    slotLabel: string;
    name: string;
    spCost: number;
    power: number;
    effect: 'rage' | 'heal' | 'acid' | 'drain' | 'physical' | 'fire' | 'phoenix_flare' | string;
    element?: ElementType;
    ailmentChance?: {
        type: StatusAilmentType;
        chance: number;
        duration: number;
    };
    description: string;
}

export interface CombatPassives {
    lifestealPercent: number;
    hpRegen: number;
    spRegen: number;
    evasionPercent: number;
    counterPercent: number;
    spAbsorbChance: number;
    critChance: number;
    critDamageBonus: number;
    accuracyBonus: number;
    physicalPenetration: number;
    magicPenetration: number;
    spCostReduction: number;
    magicBonus: number;
    magicDefenseBonus: number;
    luckBonus: number;
    elementalResistances: Partial<Record<ElementType, number>>;
}

export interface SoulCrystalConfig {
    id: string;
    name: string;
    statPerFragment: {
        maxHp?: number;
        maxSp?: number;
        strength?: number;
        defense?: number;
        agility?: number;
        magic?: number;
        magicDefense?: number;
        accuracy?: number;
        evasion?: number;
        critChance?: number;
        critDamage?: number;
        luck?: number;
        physicalPenetration?: number;
        magicPenetration?: number;
        spCostReduction?: number;
    };
    extinctionBonus: {
        maxHp?: number;
        maxSp?: number;
        strength?: number;
        defense?: number;
        agility?: number;
        magic?: number;
        magicDefense?: number;
        accuracy?: number;
        evasion?: number;
        critChance?: number;
        critDamage?: number;
        luck?: number;
        physicalPenetration?: number;
        magicPenetration?: number;
        spCostReduction?: number;
    };
    slotEffects: { [slot in EquipmentSlot]: SlotEffect };
}

export const SoulCrystalDatabase: { [id: string]: SoulCrystalConfig } = {
    keenkat: {
        id: 'keenkat',
        name: 'Verdant Kit Soul',
        statPerFragment: { critChance: 0.0025, maxHp: 0.25 }, // +0.0025% Crit Chance and +0.25 HP per fragment
        extinctionBonus: { critChance: 2, maxHp: 128 },     // +2% Crit Chance and +128 HP flat at extinction (doubles 255-kill harvest)
        slotEffects: {
            sword:    { description: 'Keen Strike: +4% Crit Chance, +5% Crit Damage', modifier: { critChance: 4, critDamage: 0.05 } },
            shield:   { description: "Cat's Grace: +5% Evasion", modifier: { evasion: 5 } },
            armor:    { description: 'Feline Agility: +4 Agility', modifier: { agility: 4 } },
            helmet:   { description: "Predator's Focus: +6% Accuracy, +3% Crit Chance", modifier: { accuracy: 6, critChance: 3 } },
            ring1:    { description: 'Pounce (4 SP): Deals 12 physical damage', spell: { name: 'Pounce', spCost: 4, power: 12, effect: 'physical' } },
            ring2:    { description: 'Pounce (4 SP): Deals 12 physical damage', spell: { name: 'Pounce', spCost: 4, power: 12, effect: 'physical' } },
            amulet:   { description: 'Feral Pounce (7 SP): Deals 28 physical damage', spell: { name: 'Feral Pounce', spCost: 7, power: 28, effect: 'physical' } },
            earrings: { description: 'Pet: Keen Kit (Agi +10% / Predator Instinct Catalyst)', modifier: { agility: 3, critChance: 2 } }
        }
    },
    goblin: {
        id: 'goblin',
        name: 'Goblin Soul',
        statPerFragment: { strength: 0.25 }, // +0.25 Strength per fragment
        extinctionBonus: { strength: 128 }, // +128 Strength flat at extinction (doubles 255-kill harvest)
        slotEffects: {
            sword: { description: 'Slash: +15% Critical Chance', modifier: { critChance: 15 } },
            shield: { description: 'Guard: +5 Defense', modifier: { defense: 5, elementalResistances: { earth: 0.25 } } },
            armor: { description: 'Spikes: 15% Counter-attack chance', modifier: { counterRate: 0.15 } },
            helmet: { description: 'Hunter Focus: +5 Agility, +8% Accuracy', modifier: { agility: 5, accuracy: 8 } },
            ring1: { description: 'Rage (6 SP): Str +25% for 3 turns', spell: { name: 'Rage', spCost: 6, power: 1.25, effect: 'rage' } },
            ring2: { description: 'Rage (6 SP): Str +25% for 3 turns', spell: { name: 'Rage', spCost: 6, power: 1.25, effect: 'rage' } },
            amulet: { description: 'Giga Rage (10 SP): Str +50% for 3 turns', spell: { name: 'Giga Rage', spCost: 10, power: 1.50, effect: 'rage' } },
            earrings: { description: 'Pet: Goblin Brawler (Str +15% / Fierce Fervor Catalyst)', modifier: { strength: 4 } }
        }
    },
    snake: {
        id: 'snake',
        name: 'Heal Snake Soul',
        statPerFragment: { maxHp: 0.25 }, // +0.25 HP per fragment
        extinctionBonus: { maxHp: 128 }, // +128 HP flat at extinction (doubles 255-kill harvest)
        slotEffects: {
            sword: { description: 'Lifesteal: Heal 5% of physical damage dealt', modifier: { lifesteal: 5 } },
            shield: { description: 'Bulk: +20 Max HP', modifier: { maxHp: 20 } },
            armor: { description: 'Regenerate: +2 HP every turn', modifier: { regen: 2, elementalResistances: { poison: 0.20, water: 0.15 } } },
            helmet: { description: 'Serpent Intuition: +30 Luck', modifier: { luck: 30 } },
            ring1: { description: 'Heal (5 SP): Restores 30 HP', spell: { name: 'Heal', spCost: 5, power: 30, effect: 'heal' } },
            ring2: { description: 'Heal (5 SP): Restores 30 HP', spell: { name: 'Heal', spCost: 5, power: 30, effect: 'heal' } },
            amulet: { description: 'Greater Heal (8 SP): Restores 60 HP', spell: { name: 'Greater Heal', spCost: 8, power: 60, effect: 'heal' } },
            earrings: { description: 'Pet: Viperling (HP +20% / Verdant Mending Catalyst)', modifier: { maxHp: 15 } }
        }
    },
    slime: {
        id: 'slime',
        name: 'Acid Slime Soul',
        statPerFragment: { maxSp: 0.25 }, // +0.25 SP per fragment
        extinctionBonus: { maxSp: 128 }, // +128 SP flat at extinction (doubles 255-kill harvest)
        slotEffects: {
            sword: { description: 'Corrosive: +15% Magic Penetration', modifier: { magicPenetration: 15 } },
            shield: { description: 'Sticky: Slime shields block +3 Defense', modifier: { defense: 3, elementalResistances: { poison: 0.25 } } },
            armor: { description: 'Soft Body: Reduces physical damage taken', modifier: { defense: 2 } },
            helmet: { description: 'Gelatinous Absorb: -10% SP Cost on spells', modifier: { spCostReduction: 10 } },
            ring1: { description: 'Slime Shot (4 SP): Deals 10 acid damage', spell: { name: 'Slime Shot', spCost: 4, power: 10, effect: 'acid' } },
            ring2: { description: 'Slime Shot (4 SP): Deals 10 acid damage', spell: { name: 'Slime Shot', spCost: 4, power: 10, effect: 'acid' } },
            amulet: { description: 'Slime Bomb (7 SP): Deals 25 acid damage', spell: { name: 'Slime Bomb', spCost: 7, power: 25, effect: 'acid' } },
            earrings: { description: 'Pet: Slimelet (Def +15% / Corrosive Buffer Catalyst)', modifier: { defense: 3 } }
        }
    },
    bat: {
        id: 'bat',
        name: 'Vampire Bat Soul',
        statPerFragment: { agility: 0.25 }, // +0.25 Agility per fragment
        extinctionBonus: { agility: 128 }, // +128 Agility flat at extinction (doubles 255-kill harvest)
        slotEffects: {
            sword: { description: 'Vampiric Strike: +3 Agility, +20% Crit Damage', modifier: { agility: 3, critDamage: 0.20 } },
            shield: { description: 'Sonar Evasion: Grants +8% Evasion rate', modifier: { evasion: 8 } },
            armor: { description: 'Shadow Cloak: +5 Agility, +3 Defense', modifier: { agility: 5, defense: 3, elementalResistances: { dark: 0.20 } } },
            helmet: { description: 'Echolocation: +10% Accuracy', modifier: { accuracy: 10 } },
            ring1: { description: 'Drain Bite (6 SP): Deals 15 damage, heals player', spell: { name: 'Drain Bite', spCost: 6, power: 15, effect: 'drain' } },
            ring2: { description: 'Drain Bite (6 SP): Deals 15 damage, heals player', spell: { name: 'Drain Bite', spCost: 6, power: 15, effect: 'drain' } },
            amulet: { description: 'Giga Drain (10 SP): Deals 30 damage, heals player', spell: { name: 'Giga Drain', spCost: 10, power: 30, effect: 'drain' } },
            earrings: { description: 'Pet: Nightwing Bat (Agi +15% / Shadow Wing Catalyst)', modifier: { agility: 4, evasion: 5 } }
        }
    },
    skeleton: {
        id: 'skeleton',
        name: 'Skeleton Archer Soul',
        statPerFragment: { defense: 0.25 }, // +0.25 Defense per fragment
        extinctionBonus: { defense: 128 }, // +128 Defense flat at extinction (doubles 255-kill harvest)
        slotEffects: {
            sword: { description: 'Bone Shatter: +20% Physical Penetration', modifier: { physicalPenetration: 20 } },
            shield: { description: 'Bone Barrier: +12 Defense', modifier: { defense: 12, elementalResistances: { dark: 0.25, physical: 0.10 } } },
            armor: { description: 'Undead Resolve: Additional +4 Defense', modifier: { defense: 4 } },
            helmet: { description: 'Grim Visage: +2 Defense, +4 Magic Defense', modifier: { defense: 2, magicDefense: 4 } },
            ring1: { description: 'Bone Toss (5 SP): Deals 18 physical damage', spell: { name: 'Bone Toss', spCost: 5, power: 18, effect: 'physical' } },
            ring2: { description: 'Bone Toss (5 SP): Deals 18 physical damage', spell: { name: 'Bone Toss', spCost: 5, power: 18, effect: 'physical' } },
            amulet: { description: 'Bone Storm (9 SP): Deals 40 physical damage', spell: { name: 'Bone Storm', spCost: 9, power: 40, effect: 'physical' } },
            earrings: { description: 'Pet: Bone Archer (Pen +15% / Ossified Bulwark Catalyst)', modifier: { physicalPenetration: 10 } }
        }
    },
    phoenix: {
        id: 'phoenix',
        name: 'Phoenix Soul',
        statPerFragment: { maxSp: 0.5, strength: 0.5 }, // +0.5 SP and +0.5 Str per fragment
        extinctionBonus: { maxSp: 255, strength: 255 }, // +255 SP and +255 Str flat at extinction (doubles 255-kill harvest)
        slotEffects: {
            sword: { description: 'Flame Strike: +8 Attack Power', modifier: { strength: 8 } },
            shield: { description: 'Fire Shield: +5 Defense, +5 Magic Defense', modifier: { defense: 5, magicDefense: 5, elementalResistances: { fire: 0.30 } } },
            armor: { description: 'Rebirth: +15 Max HP', modifier: { maxHp: 15 } },
            helmet: { description: 'Sun Crown: +10 Max SP, +8 Magic Power', modifier: { maxSp: 10, magic: 8 } },
            ring1: { description: 'Fireball (8 SP): Deals 35 Fire damage', spell: { name: 'Fireball', spCost: 8, power: 35, effect: 'fire' } },
            ring2: { description: 'Fireball (8 SP): Deals 35 Fire damage', spell: { name: 'Fireball', spCost: 8, power: 35, effect: 'fire' } },
            amulet: { description: 'Phoenix Flare (15 SP): Deals 80 Fire, heals 20 HP', spell: { name: 'Phoenix Flare', spCost: 15, power: 80, effect: 'phoenix_flare' } },
            earrings: { description: 'Pet: Pyre Fledgling (All Stats +10% / Solar Radiance Catalyst)', modifier: { strength: 5, maxSp: 10 } }
        }
    }
};

export const HEALING_STATIONS: { [stationId: string]: HealingStationConfig } = {
    station_meteor_pod: {
        stationId: 'station_meteor_pod',
        name: 'Meteor Bio-Pod',
        mapId: 'meteor_pod',
        gridX: 9,
        gridY: 4,
        requiredSoulLevel: 0,
        requiredFragments: 0,
        description: 'Celestial drop pod bio-reconstruction and synchronization anchor.',
        flavorAttune: 'Celestial drop pod mainframe synchronized. Bio-reconstruction anchor online.'
    },
    station_oakhaven: {
        stationId: 'station_oakhaven',
        name: 'Oakhaven Spring Sanctuary',
        mapId: 'town_oakhaven',
        gridX: 8,
        gridY: 4,
        requiredSoulLevel: 1,
        requiredFragments: 100,
        description: 'A luminous crystal spring bubbling with restorative earth vitality.',
        flavorAttune: 'The verdant waters of Oakhaven resonate with your soul. Sanctuary attuned.'
    },
    station_aetheria: {
        stationId: 'station_aetheria',
        name: 'Aetherian Starlight Monolith',
        mapId: 'town_aetheria',
        gridX: 10,
        gridY: 6,
        requiredSoulLevel: 3,
        requiredFragments: 600,
        description: 'An ancient starlight monolith channeling celestial leyline currents.',
        flavorAttune: 'Aetherian starlight descends upon your essence. Astral beacon attuned.'
    },
    station_ironspire: {
        stationId: 'station_ironspire',
        name: 'Ironspire Vulcan Hearth',
        mapId: 'town_ironspire',
        gridX: 11,
        gridY: 4,
        requiredSoulLevel: 5,
        requiredFragments: 1500,
        description: 'A fortified geothermal forge hearth roaring with primal volcanic power.',
        flavorAttune: 'The Vulcan Hearth tempers your life-force. Ironspire bastion attuned.'
    },
    station_castle: {
        stationId: 'station_castle',
        name: 'Sovereign Soul Altar',
        mapId: 'castle_interior',
        gridX: 14,
        gridY: 6,
        requiredSoulLevel: 7,
        requiredFragments: 2800,
        description: 'The royal obsidian altar presiding over continental leylines.',
        flavorAttune: 'The royal leylines recognize your supremacy. Sovereign sanctuary attuned.'
    },
    station_desert: {
        stationId: 'station_desert',
        name: 'Sunfire Dune Obelisk',
        mapId: 'town_sandstone_oasis',
        gridX: 10,
        gridY: 10,
        requiredSoulLevel: 7,
        requiredFragments: 2800,
        description: 'A sun-drenched obelisk standing against the desert sands.',
        flavorAttune: 'Solar fire purifies your spirit. Dune sanctuary attuned.'
    },
    station_glacier: {
        stationId: 'station_glacier',
        name: 'Glacial Cryo-Sanctuary',
        mapId: 'town_frostpeak',
        gridX: 10,
        gridY: 10,
        requiredSoulLevel: 9,
        requiredFragments: 4500,
        description: 'A frost-rimed shrine glowing within the permafrost.',
        flavorAttune: 'Cryo-resonance stabilizes your core. Glacier sanctuary attuned.'
    },
    station_forest: {
        stationId: 'station_forest',
        name: 'Whispering Leyline Spire',
        mapId: 'town_sylvan_grove',
        gridX: 10,
        gridY: 10,
        requiredSoulLevel: 11,
        requiredFragments: 6600,
        description: 'An elder bough entwined with humming starlight moss.',
        flavorAttune: 'Forest leylines embrace your crusade. Sylvan sanctuary attuned.'
    },
    station_volcano: {
        stationId: 'station_volcano',
        name: 'Obsidian Pyre Station',
        mapId: 'town_ashfall',
        gridX: 10,
        gridY: 10,
        requiredSoulLevel: 13,
        requiredFragments: 9100,
        description: 'A basalt pyre burning with eternal planetary magma.',
        flavorAttune: 'Caldera heat fuses with your soul. Obsidian sanctuary attuned.'
    }
};

// Aliases for alternate naming conventions
(HEALING_STATIONS as any)['station_royal_keep'] = HEALING_STATIONS['station_castle'];
(HEALING_STATIONS as any)['station_desert_oasis'] = HEALING_STATIONS['station_desert'];
(HEALING_STATIONS as any)['station_glacier_haven'] = HEALING_STATIONS['station_glacier'];
(HEALING_STATIONS as any)['station_deepwood_grove'] = HEALING_STATIONS['station_forest'];
(HEALING_STATIONS as any)['station_volcano_core'] = HEALING_STATIONS['station_volcano'];

export class GameManager {
    private static _instance: GameManager;
    private saveTimestamps: number[] = [];
    private telegramUser: TelegramUser | null = null;
    
    private state: GameState = {
        party: [
            {
                name: 'Swift',
                level: 0,
                hp: 24,
                maxHp: 24,
                sp: 8,
                maxSp: 8,
                strength: 4,
                defense: 2,
                agility: 3,
                magic: 5,
                magicDefense: 3,
                accuracy: 95,
                evasion: 5,
                critChance: 5,
                critDamage: 1.5,
                luck: 10,
                physicalPenetration: 0,
                magicPenetration: 0,
                spCostReduction: 0
            }
        ],
        inventory: [
            { itemId: 'potion_hp', quantity: 3 },
            { itemId: 'potion_sp', quantity: 1 }
        ],
        quests: {},
        currentScene: 'OverworldScene',
        currentMapId: 'world_map',
        spawnPoint: { x: 2912, y: 2976 },
        soulCrystals: {
            keenkat: { fragments: 0, isExtinct: false },
            goblin: { fragments: 0, isExtinct: false },
            snake: { fragments: 0, isExtinct: false },
            slime: { fragments: 0, isExtinct: false },
            bat: { fragments: 0, isExtinct: false },
            skeleton: { fragments: 0, isExtinct: false },
            phoenix: { fragments: 0, isExtinct: false }
        },
        equippedCrystals: {
            sword: null,
            shield: null,
            armor: null,
            helmet: null,
            ring1: null,
            ring2: null,
            amulet: null,
            earrings: null
        },
        forgeRefinements: {
            sword: 0,
            shield: 0,
            armor: 0,
            helmet: 0,
            ring1: 0,
            ring2: 0,
            amulet: 0,
            earrings: 0
        },
        bossMelds: [],
        hasUnlockedEarrings: false,
        dualSocketUnlocked: {
            sword: false,
            shield: false,
            armor: false,
            helmet: false,
            ring1: false,
            ring2: false,
            amulet: false,
            earrings: false
        },
        secondaryEquippedCrystals: {
            sword: null,
            shield: null,
            armor: null,
            helmet: null,
            ring1: null,
            ring2: null,
            amulet: null,
            earrings: null
        },
        achievements: {},
        extinctionEventTriggered: false,
        finalBossUnlocked: false,
        cataclysmBossDefeated: false,
        timePlayedSeconds: 0,
        lastAttunedHealingStation: {
            stationId: 'station_meteor_pod',
            name: 'Meteor Bio-Pod',
            mapId: 'meteor_pod',
            x: 9 * 64 + 32,
            y: 4 * 64 + 32
        },
        petCompanion: null
    };

    // Dictionary of all items in the game
    public readonly itemDatabase: { [id: string]: Item } = {
        potion_hp: { id: 'potion_hp', name: 'HP Potion', description: 'Restores 50 HP', type: 'consumable', value: 50 },
        potion_sp: { id: 'potion_sp', name: 'SP Potion', description: 'Restores 10 SP', type: 'consumable', value: 10 },
        bronze_sword: { id: 'bronze_sword', name: 'Bronze Sword', description: 'A basic sword (+5 Str)', type: 'weapon', value: 5 },
        cloth_armor: { id: 'cloth_armor', name: 'Cloth Armor', description: 'Simple cloth tunic (+3 Def)', type: 'armor', value: 3 },
        dungeon_key: { id: 'dungeon_key', name: 'Iron Skeleton Key', description: 'An ancient forged key bearing an undead crest. Unlocks deep dungeon portcullises.', type: 'consumable', value: 1 }
    };

    private constructor() {
        this.initTelegramContext();
        this.loadGame();
    }

    private initTelegramContext() {
        const tgEnv = TelegramAuth.detectTelegramEnvironment();
        if (tgEnv.isTelegram && tgEnv.initDataString) {
            const res = TelegramAuth.verifyInitData(tgEnv.initDataString);
            if (res.valid && res.user) {
                this.telegramUser = res.user;
                console.info(`[TelegramAuth] Authenticated user: @${res.user.username || res.user.first_name} (ID: ${res.user.id})`);
            }
        }
    }

    public getTelegramUser(): TelegramUser | null {
        return this.telegramUser;
    }

    public setTelegramUser(user: TelegramUser | null) {
        this.telegramUser = user;
    }

    public static get instance(): GameManager {
        if (!GameManager._instance) {
            GameManager._instance = new GameManager();
        }
        return GameManager._instance;
    }

    public getState(): GameState {
        return this.state;
    }

    public getSaveStateJson(): string {
        return JSON.stringify(this.state);
    }

    public getHeroCalculatedStats(): CharacterStats {
        const base = this.state.party[0];
        if (!base) {
            return {
                name: 'Swift',
                level: 0,
                hp: 24,
                maxHp: 24,
                sp: 8,
                maxSp: 8,
                strength: 4,
                defense: 2,
                agility: 3,
                magic: 5,
                magicDefense: 3,
                accuracy: 95,
                evasion: 5,
                critChance: 5,
                critDamage: 1.5,
                luck: 10,
                physicalPenetration: 0,
                magicPenetration: 0,
                spCostReduction: 0
            };
        }

        let maxHp = base.maxHp;
        let maxSp = base.maxSp;
        let strength = base.strength;
        let defense = base.defense;
        let agility = base.agility;
        let magic = base.magic ?? 5;
        let magicDefense = base.magicDefense ?? 3;
        let accuracy = base.accuracy ?? 95;
        let evasion = base.evasion ?? 5;
        let critChance = base.critChance ?? 5;
        let critDamage = base.critDamage ?? 1.5;
        let luck = base.luck ?? 10;
        let physicalPenetration = base.physicalPenetration ?? 0;
        let magicPenetration = base.magicPenetration ?? 0;
        let spCostReduction = base.spCostReduction ?? 0;

        // 1. Add fragment stats or flat extinction bonuses (Preserved 100% strictly unchanged)
        for (const speciesId in this.state.soulCrystals) {
            const crystalState = this.state.soulCrystals[speciesId];
            const config = SoulCrystalDatabase[speciesId];
            if (config && crystalState) {
                const frags = crystalState.fragments;
                if (crystalState.isExtinct) {
                    // Apply flat, massive mastery bonus (all player stats supported)
                    if (config.extinctionBonus.maxHp)             maxHp             += config.extinctionBonus.maxHp;
                    if (config.extinctionBonus.maxSp)             maxSp             += config.extinctionBonus.maxSp;
                    if (config.extinctionBonus.strength)          strength          += config.extinctionBonus.strength;
                    if (config.extinctionBonus.defense)           defense           += config.extinctionBonus.defense;
                    if (config.extinctionBonus.agility)           agility           += config.extinctionBonus.agility;
                    if (config.extinctionBonus.magic)             magic             += config.extinctionBonus.magic;
                    if (config.extinctionBonus.magicDefense)      magicDefense      += config.extinctionBonus.magicDefense;
                    if (config.extinctionBonus.accuracy)          accuracy          += config.extinctionBonus.accuracy;
                    if (config.extinctionBonus.evasion)           evasion           += config.extinctionBonus.evasion;
                    if (config.extinctionBonus.critChance)        critChance        += config.extinctionBonus.critChance;
                    if (config.extinctionBonus.critDamage)        critDamage        += config.extinctionBonus.critDamage;
                    if (config.extinctionBonus.luck)              luck              += config.extinctionBonus.luck;
                    if (config.extinctionBonus.physicalPenetration) physicalPenetration += config.extinctionBonus.physicalPenetration;
                    if (config.extinctionBonus.magicPenetration)  magicPenetration  += config.extinctionBonus.magicPenetration;
                    if (config.extinctionBonus.spCostReduction)   spCostReduction   += config.extinctionBonus.spCostReduction;
                } else {
                    // Apply linear fragment-based growth (all player stats supported)
                    if (config.statPerFragment.maxHp)             maxHp             += frags * config.statPerFragment.maxHp;
                    if (config.statPerFragment.maxSp)             maxSp             += frags * config.statPerFragment.maxSp;
                    if (config.statPerFragment.strength)          strength          += frags * config.statPerFragment.strength;
                    if (config.statPerFragment.defense)           defense           += frags * config.statPerFragment.defense;
                    if (config.statPerFragment.agility)           agility           += frags * config.statPerFragment.agility;
                    if (config.statPerFragment.magic)             magic             += frags * config.statPerFragment.magic;
                    if (config.statPerFragment.magicDefense)      magicDefense      += frags * config.statPerFragment.magicDefense;
                    if (config.statPerFragment.accuracy)          accuracy          += frags * config.statPerFragment.accuracy;
                    if (config.statPerFragment.evasion)           evasion           += frags * config.statPerFragment.evasion;
                    if (config.statPerFragment.critChance)        critChance        += frags * config.statPerFragment.critChance;
                    if (config.statPerFragment.critDamage)        critDamage        += frags * config.statPerFragment.critDamage;
                    if (config.statPerFragment.luck)              luck              += frags * config.statPerFragment.luck;
                    if (config.statPerFragment.physicalPenetration) physicalPenetration += frags * config.statPerFragment.physicalPenetration;
                    if (config.statPerFragment.magicPenetration)  magicPenetration  += frags * config.statPerFragment.magicPenetration;
                    if (config.statPerFragment.spCostReduction)   spCostReduction   += frags * config.statPerFragment.spCostReduction;
                }
            }
        }

        // 2. Add equipment slot modifiers
        for (const slotKey in this.state.equippedCrystals) {
            const crystalId = this.state.equippedCrystals[slotKey as EquipmentSlot];
            if (crystalId) {
                const effect = this.getScaledSlotEffect(crystalId, slotKey as EquipmentSlot);
                if (effect && effect.modifier) {
                    const mod = effect.modifier;
                    if (mod.maxHp) maxHp += mod.maxHp;
                    if (mod.maxSp) maxSp += mod.maxSp;
                    if (mod.strength) strength += mod.strength;
                    if (mod.defense) defense += mod.defense;
                    if (mod.agility) agility += mod.agility;
                    if (mod.magic) magic += mod.magic;
                    if (mod.magicDefense) magicDefense += mod.magicDefense;
                    if (mod.accuracy) accuracy += mod.accuracy;
                    if (mod.evasion) evasion += mod.evasion;
                    if (mod.critChance) {
                        critChance += (mod.critChance < 1 ? Math.round(mod.critChance * 100) : mod.critChance);
                    }
                    if (mod.critDamage) critDamage += mod.critDamage;
                    if (mod.luck) luck += mod.luck;
                    if (mod.physicalPenetration) physicalPenetration += mod.physicalPenetration;
                    if (mod.magicPenetration) magicPenetration += mod.magicPenetration;
                    if (mod.spCostReduction) spCostReduction += mod.spCostReduction;
                }
            }
        }

        // 2b. Add secondary equipment slot modifiers (Boss Soulmelding dual sockets)
        if (this.state.secondaryEquippedCrystals) {
            for (const slotKey in this.state.secondaryEquippedCrystals) {
                if (slotKey === 'earrings') continue; // Earrings secondary socket is reserved for Pet Augmentation
                const crystalId = this.state.secondaryEquippedCrystals[slotKey as EquipmentSlot];
                if (crystalId) {
                    const effect = this.getScaledSlotEffect(crystalId, slotKey as EquipmentSlot);
                    if (effect && effect.modifier) {
                        const mod = effect.modifier;
                        if (mod.maxHp) maxHp += mod.maxHp;
                        if (mod.maxSp) maxSp += mod.maxSp;
                        if (mod.strength) strength += mod.strength;
                        if (mod.defense) defense += mod.defense;
                        if (mod.agility) agility += mod.agility;
                        if (mod.magic) magic += mod.magic;
                        if (mod.magicDefense) magicDefense += mod.magicDefense;
                        if (mod.accuracy) accuracy += mod.accuracy;
                        if (mod.evasion) evasion += mod.evasion;
                        if (mod.critChance) {
                            critChance += (mod.critChance < 1 ? Math.round(mod.critChance * 100) : mod.critChance);
                        }
                        if (mod.critDamage) critDamage += mod.critDamage;
                        if (mod.luck) luck += mod.luck;
                        if (mod.physicalPenetration) physicalPenetration += mod.physicalPenetration;
                        if (mod.magicPenetration) magicPenetration += mod.magicPenetration;
                        if (mod.spCostReduction) spCostReduction += mod.spCostReduction;
                    }
                }
            }
        }

        // 2c. Add Companion Aura Modifiers from Earrings Pet Augmentation
        if (this.state.petCompanion && this.state.petCompanion.augmentation && !this.state.petCompanion.isDefeated) {
            const aura = this.state.petCompanion.augmentation.auraEffect;
            if (aura === 'shadow_aura') evasion += 10;
            else if (aura === 'fervor_aura') strength += 10;
            else if (aura === 'mending_aura') maxHp += 25;
            else if (aura === 'fire_aura') { maxSp += 20; strength += 5; }
            else if (aura === 'bone_bulwark') { defense += 15; physicalPenetration += 10; }
            else if (aura === 'slime_buffer') { defense += 10; magicDefense += 10; }
        }

        // 3. Add Masterwork Forge Refinement bonuses (Sprint 13)
        if (this.state.forgeRefinements) {
            const ref = this.state.forgeRefinements;
            if (ref.sword) strength += ref.sword * 6;
            if (ref.shield) {
                defense += ref.shield * 5;
                maxHp += ref.shield * 20;
            }
            if (ref.armor) {
                defense += ref.armor * 6;
                maxHp += ref.armor * 15;
            }
            if (ref.helmet) {
                defense += ref.helmet * 4;
                maxSp += ref.helmet * 15;
            }
            if (ref.ring1) {
                maxSp += ref.ring1 * 10;
                agility += ref.ring1 * 3;
            }
            if (ref.ring2) {
                maxSp += ref.ring2 * 10;
                agility += ref.ring2 * 3;
            }
            if (ref.amulet) {
                maxHp += ref.amulet * 15;
                maxSp += ref.amulet * 15;
                strength += ref.amulet * 2;
                defense += ref.amulet * 2;
                agility += ref.amulet * 2;
            }
            if (ref.earrings) {
                maxHp += ref.earrings * 15;
                maxSp += ref.earrings * 10;
            }
        }

        // 4. Apply Boss Soulmeld Multipliers (Sprint 13)
        if (this.state.bossMelds && this.state.bossMelds.length > 0) {
            let hpMult = 1.0;
            let spMult = 1.0;
            let strMult = 1.0;
            let defMult = 1.0;
            let agiMult = 1.0;

            for (const meld of this.state.bossMelds) {
                if (meld === 'slime') spMult += 0.05;
                else if (meld === 'snake') hpMult += 0.05;
                else if (meld === 'bat') agiMult += 0.05;
                else if (meld === 'goblin') strMult += 0.05;
                else if (meld === 'skeleton') defMult += 0.05;
                else if (meld === 'phoenix') {
                    hpMult += 0.10;
                    spMult += 0.10;
                    strMult += 0.10;
                    defMult += 0.10;
                    agiMult += 0.10;
                }
            }

            maxHp *= hpMult;
            maxSp *= spMult;
            strength *= strMult;
            defense *= defMult;
            agility *= agiMult;
        }

        // 5. Luck Tier Scaling: Every 100 Luck adds a flat +0.5 to attributes & ratings
        const luckTier = Math.floor(luck / 100);
        if (luckTier > 0) {
            const luckBonus = luckTier * 0.5;
            strength += luckBonus;
            defense += luckBonus;
            agility += luckBonus;
            magic += luckBonus;
            magicDefense += luckBonus;
            accuracy += luckBonus;
            evasion += luckBonus;
            critChance += luckBonus;
            critDamage += luckBonus * 0.01; // +0.5% crit damage multiplier per tier
        }

        // Calculate Soul Level from total fragments collected across all species (Sprint 24)
        const soulLevel = this.getSoulLevel();

        const truncatedMaxHp = Math.trunc(maxHp);
        const truncatedMaxSp = Math.trunc(maxSp);

        // Auto-clamp base stats to calculated limits to preserve integrity
        if (base.hp > truncatedMaxHp) base.hp = truncatedMaxHp;
        if (base.sp > truncatedMaxSp) base.sp = truncatedMaxSp;
        base.level = soulLevel;

        return {
            name: base.name,
            level: soulLevel,
            hp: Math.min(Math.trunc(base.hp), truncatedMaxHp),
            maxHp: truncatedMaxHp,
            sp: Math.min(Math.trunc(base.sp), truncatedMaxSp),
            maxSp: truncatedMaxSp,
            strength: parseFloat(strength.toFixed(1)),
            defense: parseFloat(defense.toFixed(1)),
            agility: parseFloat(agility.toFixed(1)),
            magic: parseFloat(magic.toFixed(1)),
            magicDefense: parseFloat(magicDefense.toFixed(1)),
            accuracy: parseFloat(accuracy.toFixed(1)),
            evasion: parseFloat(evasion.toFixed(1)),
            critChance: parseFloat(critChance.toFixed(1)),
            critDamage: parseFloat(critDamage.toFixed(3)),
            luck: parseFloat(luck.toFixed(1)),
            physicalPenetration: Math.round(physicalPenetration),
            magicPenetration: Math.round(magicPenetration),
            spCostReduction: Math.round(spCostReduction)
        };
    }

    /**
     * Calculates the total fragments captured across all monster species.
     */
    public getTotalFragmentsCollected(): number {
        let total = 0;
        if (this.state && this.state.soulCrystals) {
            for (const speciesId in this.state.soulCrystals) {
                total += this.state.soulCrystals[speciesId]?.fragments || 0;
            }
        }
        return total;
    }

    /**
     * Sprint 24 Triangular Soul Level Formula requested by David Swift:
     * Level 0: 0–99 fragments
     * Level 1: 100 fragments
     * Level 2: 300 fragments (+200)
     * Level 3: 600 fragments (+300)
     * Level 4: 1000 fragments (+400)
     * Level 5: 1500 fragments (+500)
     * Level 6: 2100 fragments (+600)
     * Level 7: 2800 fragments (+700)...
     * Closed-form: Level = floor((sqrt(1 + 0.08 * totalFragments) - 1) / 2)
     */
    public static getSoulLevelFromFragments(totalFragments: number): number {
        if (!totalFragments || totalFragments <= 0) return 0;
        return Math.floor((Math.sqrt(1 + 0.08 * totalFragments) - 1) / 2);
    }

    public static getFragmentsForSoulLevel(level: number): number {
        if (!level || level <= 0) return 0;
        return 50 * level * (level + 1);
    }

    public getSoulLevel(): number {
        return GameManager.getSoulLevelFromFragments(this.getTotalFragmentsCollected());
    }

    public getFragmentsForSoulLevel(level: number): number {
        return GameManager.getFragmentsForSoulLevel(level);
    }

    public getSoulLevelFromFragments(totalFragments: number): number {
        return GameManager.getSoulLevelFromFragments(totalFragments);
    }

    public getNextLevelProgress(): {
        currentLevel: number;
        totalFragments: number;
        currentLevelThreshold: number;
        nextLevelThreshold: number;
        fragmentsNeeded: number;
        progressPercent: number;
    } {
        const total = this.getTotalFragmentsCollected();
        const currentLevel = this.getSoulLevel();
        const currentThreshold = GameManager.getFragmentsForSoulLevel(currentLevel);
        const nextThreshold = GameManager.getFragmentsForSoulLevel(currentLevel + 1);
        const fragmentsNeeded = Math.max(0, nextThreshold - total);
        const span = nextThreshold - currentThreshold;
        const progressInLevel = Math.max(0, total - currentThreshold);
        const progressPercent = span > 0 ? Math.min(100, Math.round((progressInLevel / span) * 100)) : 100;

        return {
            currentLevel,
            totalFragments: total,
            currentLevelThreshold: currentThreshold,
            nextLevelThreshold: nextThreshold,
            fragmentsNeeded,
            progressPercent
        };
    }

    public static readonly DEMO_TRIAL_5MIN_STORAGE_KEY: string = 'swiftsouls_demo_5min_trial_reported';

    public checkAndReportDemo5MinTrial(): void {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
        if (!this.state || (this.state.timePlayedSeconds || 0) < 300) return;

        try {
            if (!localStorage.getItem(GameManager.DEMO_TRIAL_5MIN_STORAGE_KEY)) {
                localStorage.setItem(GameManager.DEMO_TRIAL_5MIN_STORAGE_KEY, 'true');
                console.log('[DemoTelemetry] 🌟 Player completed 5+ minutes of gameplay on active save file. Reporting trial...');

                // 1. PostMessage to parent frame (for website embedded iframe counter update)
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                        type: 'SWIFTSOULS_DEMO_5MIN_TRIAL',
                        timePlayed: Math.floor(this.state.timePlayedSeconds || 300),
                        timestamp: Date.now()
                    }, '*');
                }

                // 2. Telemetry HTTP POST to API endpoint
                if (typeof fetch !== 'undefined') {
                    fetch('/api/demo/trial-completed', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'trial_5min',
                            timePlayed: Math.floor(this.state.timePlayedSeconds || 300),
                            timestamp: new Date().toISOString()
                        })
                    }).catch(() => {
                        // Ignore offline / standalone fallback errors gracefully
                    });
                }
            }
        } catch (e) {
            // Storage or network exception safety
        }
    }

    public updateTimePlayed(deltaSeconds: number): void {
        if (!deltaSeconds || deltaSeconds <= 0) return;
        if (!this.state) return;
        if (typeof this.state.timePlayedSeconds !== 'number') {
            this.state.timePlayedSeconds = 0;
        }
        this.state.timePlayedSeconds += deltaSeconds;
        if (this.state.timePlayedSeconds >= 300) {
            this.checkAndReportDemo5MinTrial();
        }
    }

    public getTimePlayedSeconds(): number {
        return this.state?.timePlayedSeconds || 0;
    }

    public getFormattedTimePlayed(seconds?: number): string {
        const totalSec = Math.floor(seconds !== undefined ? seconds : (this.state?.timePlayedSeconds || 0));
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }

    public attuneAndRestAtHealingStation(stationId: string): { success: boolean; message: string; station?: HealingStationConfig } {
        const station = HEALING_STATIONS[stationId];
        if (!station) {
            return { success: false, message: 'Unknown healing station.' };
        }

        const currentSoulLevel = this.getSoulLevel();
        if (currentSoulLevel < station.requiredSoulLevel) {
            const neededFrags = station.requiredFragments;
            return {
                success: false,
                message: `Sanctuary dormant. Requires Soul Level ${station.requiredSoulLevel} (${neededFrags} total fragments). Current: Level ${currentSoulLevel}.`,
                station
            };
        }

        // Full heal hero and party
        this.fullHealParty();

        // Revive pet companion if present
        if (this.state.petCompanion) {
            this.state.petCompanion.hp = this.state.petCompanion.maxHp;
            this.state.petCompanion.sp = this.state.petCompanion.maxSp;
            this.state.petCompanion.isDefeated = false;
        }

        // Set attuned anchor
        this.state.lastAttunedHealingStation = {
            stationId: station.stationId,
            name: station.name,
            mapId: station.mapId,
            x: station.gridX * 64 + 32,
            y: station.gridY * 64 + 32
        };

        // Unlock achievement
        AchievementManager.instance.unlock('ACH_SANCTUARY_REST');

        // Continuous Auto-Save
        this.saveGame();

        return {
            success: true,
            message: station.flavorAttune || `Synchronized to ${station.name}. Health and Spirit restored!`,
            station
        };
    }

    public getLastAttunedHealingStation() {
        return this.state.lastAttunedHealingStation || null;
    }

    public getHeroBaseStats(): CharacterStats {
        const base = this.state.party[0];
        if (!base) {
            return {
                name: 'Swift',
                level: 0,
                hp: 24,
                maxHp: 24,
                sp: 8,
                maxSp: 8,
                strength: 4,
                defense: 2,
                agility: 3,
                magic: 5,
                magicDefense: 3,
                accuracy: 95,
                evasion: 5,
                critChance: 5,
                critDamage: 1.5,
                luck: 10,
                physicalPenetration: 0,
                magicPenetration: 0,
                spCostReduction: 0
            };
        }
        return {
            name: base.name,
            level: base.level,
            hp: base.hp,
            maxHp: base.maxHp,
            sp: base.sp,
            maxSp: base.maxSp,
            strength: base.strength,
            defense: base.defense,
            agility: base.agility,
            magic: base.magic ?? 5,
            magicDefense: base.magicDefense ?? 3,
            accuracy: base.accuracy ?? 95,
            evasion: base.evasion ?? 5,
            critChance: base.critChance ?? 5,
            critDamage: base.critDamage ?? 1.5,
            luck: base.luck ?? 10,
            physicalPenetration: base.physicalPenetration ?? 0,
            magicPenetration: base.magicPenetration ?? 0,
            spCostReduction: base.spCostReduction ?? 0
        };
    }

    public getScaledSlotEffect(crystalId: string, slot: EquipmentSlot): SlotEffect {
        const config = SoulCrystalDatabase[crystalId];
        const state = this.state.soulCrystals[crystalId];
        
        if (!config || !state || state.fragments === 0) {
            return { description: 'No effect' };
        }

        const frags = state.fragments;
        
        // Standard hunt tiers: 0 to 50 for regular kills (0 to 254 kills).
        // On the 255th kill (Extinction / Alpha Boss), the jump from 254 to 255 grants a double step (+2 tiers jump)
        // reaching effective tier 52 to end at the exact same 3.55x max power (+255%) and 25% lifesteal.
        const tier = Math.floor(frags / 5);
        const effectiveTier = frags >= 255 ? 52 : tier;
        const scale = 1.0 + effectiveTier * (2.55 / 52);

        const baseEffect = config.slotEffects[slot];
        const scaledEffect: SlotEffect = {
            description: baseEffect.description
        };

        // Scale modifiers
        if (baseEffect.modifier) {
            scaledEffect.modifier = {};
            const mod = baseEffect.modifier;
            if (mod.maxHp !== undefined) scaledEffect.modifier.maxHp = Math.trunc(mod.maxHp * scale);
            if (mod.maxSp !== undefined) scaledEffect.modifier.maxSp = Math.trunc(mod.maxSp * scale);
            if (mod.strength !== undefined) scaledEffect.modifier.strength = Math.round(mod.strength * scale);
            if (mod.defense !== undefined) scaledEffect.modifier.defense = Math.round(mod.defense * scale);
            if (mod.agility !== undefined) scaledEffect.modifier.agility = Math.round(mod.agility * scale);
            if (mod.magic !== undefined) scaledEffect.modifier.magic = Math.round(mod.magic * scale);
            if (mod.magicDefense !== undefined) scaledEffect.modifier.magicDefense = Math.round(mod.magicDefense * scale);
            if (mod.accuracy !== undefined) scaledEffect.modifier.accuracy = Math.round(mod.accuracy * scale);
            if (mod.evasion !== undefined) scaledEffect.modifier.evasion = Math.round(mod.evasion * scale);
            if (mod.critChance !== undefined) scaledEffect.modifier.critChance = Math.round(mod.critChance * scale);
            if (mod.critDamage !== undefined) scaledEffect.modifier.critDamage = parseFloat((mod.critDamage * scale).toFixed(2));
            if (mod.luck !== undefined) scaledEffect.modifier.luck = Math.round(mod.luck * scale);
            if (mod.physicalPenetration !== undefined) scaledEffect.modifier.physicalPenetration = Math.round(mod.physicalPenetration * scale);
            if (mod.magicPenetration !== undefined) scaledEffect.modifier.magicPenetration = Math.round(mod.magicPenetration * scale);
            if (mod.spCostReduction !== undefined) scaledEffect.modifier.spCostReduction = Math.round(mod.spCostReduction * scale);
            if (mod.lifesteal !== undefined) {
                // Lifesteal starts at 5% (tier 0) and scales across 52 units, with a 2-tier jump on the 255th kill to reach 25%
                scaledEffect.modifier.lifesteal = Math.min(25, Math.round(mod.lifesteal + effectiveTier * ((25 - mod.lifesteal) / 52)));
            }
            if (mod.regen !== undefined) scaledEffect.modifier.regen = Math.trunc(mod.regen * scale);
            if (mod.counterRate !== undefined) scaledEffect.modifier.counterRate = parseFloat((mod.counterRate * scale).toFixed(2));
            if (mod.elementalResistances) {
                scaledEffect.modifier.elementalResistances = {};
                for (const [el, res] of Object.entries(mod.elementalResistances)) {
                    if (res !== undefined) {
                        scaledEffect.modifier.elementalResistances[el as ElementType] = parseFloat((res * scale).toFixed(2));
                    }
                }
            }
        }

        // Scale spells
        if (baseEffect.spell) {
            scaledEffect.spell = {
                name: baseEffect.spell.name,
                spCost: baseEffect.spell.spCost,
                power: Math.round(baseEffect.spell.power * scale),
                effect: baseEffect.spell.effect
            };
        }

        // Dynamically compile description
        let desc = baseEffect.description;
        if (slot === 'sword') {
            if (crystalId === 'snake') {
                const percent = Math.round(scaledEffect.modifier?.lifesteal || 0);
                desc = `Lifesteal: Heal ${percent}% of physical damage dealt`;
            } else if (crystalId === 'goblin') {
                const percent = scaledEffect.modifier?.critChance || 0;
                desc = `Slash: +${percent}% Critical Chance`;
            } else if (crystalId === 'slime') {
                const pen = scaledEffect.modifier?.magicPenetration || 0;
                desc = `Corrosive: +${pen}% Magic Penetration`;
            } else if (crystalId === 'bat') {
                const agi = scaledEffect.modifier?.agility || 0;
                const cd = Math.round((scaledEffect.modifier?.critDamage || 0) * 100);
                desc = `Vampiric Strike: +${agi} Agility, +${cd}% Crit Damage`;
            } else if (crystalId === 'skeleton') {
                const pen = scaledEffect.modifier?.physicalPenetration || 0;
                desc = `Bone Shatter: +${pen}% Physical Penetration`;
            } else if (crystalId === 'phoenix') {
                const str = scaledEffect.modifier?.strength || 0;
                desc = `Flame Strike: +${str} Strength`;
            }
        } else if (slot === 'shield') {
            if (crystalId === 'snake') {
                desc = `Bulk: +${scaledEffect.modifier?.maxHp} Max HP`;
            } else if (crystalId === 'goblin') {
                desc = `Guard: +${scaledEffect.modifier?.defense} Defense`;
            } else if (crystalId === 'slime') {
                desc = `Sticky Body: +${scaledEffect.modifier?.defense} Defense`;
            } else if (crystalId === 'bat') {
                const percent = scaledEffect.modifier?.evasion || 0;
                desc = `Sonar Evasion: Grants +${percent}% Evasion rate`;
            } else if (crystalId === 'skeleton') {
                desc = `Bone Barrier: +${scaledEffect.modifier?.defense} Defense`;
            } else if (crystalId === 'phoenix') {
                desc = `Fire Shield: +${scaledEffect.modifier?.defense} Defense, +${scaledEffect.modifier?.magicDefense} Magic Defense`;
            }
        } else if (slot === 'armor') {
            if (crystalId === 'snake') {
                desc = `Regenerate: +${scaledEffect.modifier?.regen} HP every turn`;
            } else if (crystalId === 'goblin') {
                const percent = Math.round((scaledEffect.modifier?.counterRate || 0) * 100);
                desc = `Spikes: ${percent}% Counter-attack chance`;
            } else if (crystalId === 'slime') {
                desc = `Soft Body: Reduces physical damage taken by ${Math.round(10 * scale)}%`;
            } else if (crystalId === 'bat') {
                desc = `Shadow Cloak: +${scaledEffect.modifier?.agility} Agility, +${scaledEffect.modifier?.defense} Defense`;
            } else if (crystalId === 'skeleton') {
                desc = `Undead Resolve: +${scaledEffect.modifier?.defense} Defense`;
            } else if (crystalId === 'phoenix') {
                desc = `Rebirth: +${scaledEffect.modifier?.maxHp} Max HP`;
            }
        } else if (slot === 'helmet') {
            if (crystalId === 'snake') {
                desc = `Serpent Intuition: +${scaledEffect.modifier?.luck} Luck`;
            } else if (crystalId === 'goblin') {
                desc = `Hunter Focus: +${scaledEffect.modifier?.agility} Agility, +${scaledEffect.modifier?.accuracy}% Accuracy`;
            } else if (crystalId === 'slime') {
                desc = `Gelatinous Absorb: -${scaledEffect.modifier?.spCostReduction}% SP Cost on spells`;
            } else if (crystalId === 'bat') {
                desc = `Echolocation: +${scaledEffect.modifier?.accuracy}% Accuracy`;
            } else if (crystalId === 'skeleton') {
                desc = `Grim Visage: +${scaledEffect.modifier?.defense} Defense, +${scaledEffect.modifier?.magicDefense} Magic Defense`;
            } else if (crystalId === 'phoenix') {
                desc = `Sun Crown: +${scaledEffect.modifier?.maxSp} Max SP, +${scaledEffect.modifier?.magic} Magic Power`;
            }
        } else if (slot === 'ring1' || slot === 'ring2' || slot === 'amulet') {
            if (scaledEffect.spell) {
                if (crystalId === 'goblin') {
                    const percent = Math.round((scaledEffect.spell.power - 1) * 100);
                    desc = `${scaledEffect.spell.name} (${scaledEffect.spell.spCost} SP): Str +${percent}% for 3 turns`;
                } else if (crystalId === 'snake') {
                    desc = `${scaledEffect.spell.name} (${scaledEffect.spell.spCost} SP): Restores ${scaledEffect.spell.power} HP`;
                } else if (crystalId === 'slime') {
                    desc = `${scaledEffect.spell.name} (${scaledEffect.spell.spCost} SP): Deals ${scaledEffect.spell.power} acid damage`;
                } else if (crystalId === 'bat') {
                    desc = `${scaledEffect.spell.name} (${scaledEffect.spell.spCost} SP): Deals ${scaledEffect.spell.power} damage and heals`;
                } else if (crystalId === 'skeleton') {
                    desc = `${scaledEffect.spell.name} (${scaledEffect.spell.spCost} SP): Deals ${scaledEffect.spell.power} physical damage`;
                } else if (crystalId === 'phoenix') {
                    desc = `${scaledEffect.spell.name} (${scaledEffect.spell.spCost} SP): Deals ${scaledEffect.spell.power} Fire damage`;
                }
            }
        } else if (slot === 'earrings') {
            const petComp = this.state.petCompanion;
            if (petComp && petComp.augmentation) {
                desc = `${baseEffect.description} [Augment: ${petComp.augmentation.name}]`;
            }
        }

        scaledEffect.description = desc;
        return scaledEffect;
    }

    public getActiveSpells(): ActiveSpell[] {
        const spells: ActiveSpell[] = [];
        const slots: Array<{ key: 'ring1' | 'ring2' | 'amulet'; label: string }> = [
            { key: 'ring1', label: 'Ring 1' },
            { key: 'ring2', label: 'Ring 2' },
            { key: 'amulet', label: 'Amulet' }
        ];

        for (const s of slots) {
            // 1. Primary Socket Spell
            const crystalId = this.state.equippedCrystals[s.key];
            if (crystalId) {
                const scaled = this.getScaledSlotEffect(crystalId, s.key);
                if (scaled && scaled.spell) {
                    let element: ElementType = 'physical';
                    let ailmentChance: { type: StatusAilmentType; chance: number; duration: number } | undefined;

                    if (crystalId === 'phoenix') {
                        element = 'fire';
                        ailmentChance = { type: 'burn', chance: 0.40, duration: 3 };
                    } else if (crystalId === 'slime') {
                        element = 'poison';
                        ailmentChance = { type: 'poison', chance: 0.50, duration: 3 };
                    } else if (crystalId === 'bat') {
                        element = 'dark';
                        ailmentChance = { type: 'silence', chance: 0.30, duration: 2 };
                    } else if (crystalId === 'skeleton') {
                        element = 'physical';
                        ailmentChance = { type: 'bleed', chance: 0.35, duration: 3 };
                    } else if (crystalId === 'snake') {
                        element = 'light';
                    } else if (crystalId === 'goblin') {
                        element = 'earth';
                    }

                    spells.push({
                        slotKey: s.key,
                        slotLabel: s.label,
                        name: scaled.spell.name,
                        spCost: scaled.spell.spCost,
                        power: scaled.spell.power,
                        effect: scaled.spell.effect || 'physical',
                        element,
                        ailmentChance,
                        description: scaled.description
                    });
                }
            }

            // 2. Secondary Melded Socket Spell (Boss Soulmelding)
            const secCrystalId = this.state.secondaryEquippedCrystals?.[s.key];
            if (secCrystalId) {
                const scaled = this.getScaledSlotEffect(secCrystalId, s.key);
                if (scaled && scaled.spell) {
                    let element: ElementType = 'physical';
                    let ailmentChance: { type: StatusAilmentType; chance: number; duration: number } | undefined;

                    if (secCrystalId === 'phoenix') {
                        element = 'fire';
                        ailmentChance = { type: 'burn', chance: 0.40, duration: 3 };
                    } else if (secCrystalId === 'slime') {
                        element = 'poison';
                        ailmentChance = { type: 'poison', chance: 0.50, duration: 3 };
                    } else if (secCrystalId === 'bat') {
                        element = 'dark';
                        ailmentChance = { type: 'silence', chance: 0.30, duration: 2 };
                    } else if (secCrystalId === 'skeleton') {
                        element = 'physical';
                        ailmentChance = { type: 'bleed', chance: 0.35, duration: 3 };
                    } else if (secCrystalId === 'snake') {
                        element = 'light';
                    } else if (secCrystalId === 'goblin') {
                        element = 'earth';
                    }

                    spells.push({
                        slotKey: s.key,
                        slotLabel: `${s.label} (Melded)`,
                        name: `${scaled.spell.name} (Melded)`,
                        spCost: scaled.spell.spCost,
                        power: scaled.spell.power,
                        effect: scaled.spell.effect || 'physical',
                        element,
                        ailmentChance,
                        description: `[Melded Dual-Socket] ${scaled.description}`
                    });
                }
            }
        }

        return spells;
    }

    public getActivePassives(): CombatPassives {
        const passives: CombatPassives = {
            lifestealPercent: 0,
            hpRegen: 0,
            spRegen: 0,
            evasionPercent: 0,
            counterPercent: 0,
            spAbsorbChance: 0,
            critChance: 0,
            critDamageBonus: 0,
            accuracyBonus: 0,
            physicalPenetration: 0,
            magicPenetration: 0,
            spCostReduction: 0,
            magicBonus: 0,
            magicDefenseBonus: 0,
            luckBonus: 0,
            elementalResistances: {}
        };

        const passiveSlots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'helmet'];

        for (const slot of passiveSlots) {
            // Primary Socket Passives
            const crystalId = this.state.equippedCrystals[slot];
            if (crystalId) {
                const scaled = this.getScaledSlotEffect(crystalId, slot);
                if (scaled && scaled.modifier) {
                    const mod = scaled.modifier;
                    if (mod.lifesteal) passives.lifestealPercent += mod.lifesteal;
                    if (mod.regen) passives.hpRegen += mod.regen;
                    if (mod.evasion) passives.evasionPercent += mod.evasion;
                    if (mod.counterRate) passives.counterPercent += mod.counterRate;
                    if (mod.critChance) passives.critChance += mod.critChance;
                    if (mod.critDamage) passives.critDamageBonus += mod.critDamage;
                    if (mod.accuracy) passives.accuracyBonus += mod.accuracy;
                    if (mod.physicalPenetration) passives.physicalPenetration += mod.physicalPenetration;
                    if (mod.magicPenetration) passives.magicPenetration += mod.magicPenetration;
                    if (mod.spCostReduction) passives.spCostReduction += mod.spCostReduction;
                    if (mod.magic) passives.magicBonus += mod.magic;
                    if (mod.magicDefense) passives.magicDefenseBonus += mod.magicDefense;
                    if (mod.luck) passives.luckBonus += mod.luck;
                    if (mod.elementalResistances) {
                        for (const [el, val] of Object.entries(mod.elementalResistances)) {
                            if (val !== undefined) {
                                const elem = el as ElementType;
                                passives.elementalResistances[elem] = (passives.elementalResistances[elem] || 0) + val;
                            }
                        }
                    }
                }
            }

            // Secondary Melded Socket Passives
            const secCrystalId = this.state.secondaryEquippedCrystals?.[slot];
            if (secCrystalId) {
                const scaled = this.getScaledSlotEffect(secCrystalId, slot);
                if (scaled && scaled.modifier) {
                    const mod = scaled.modifier;
                    if (mod.lifesteal) passives.lifestealPercent += mod.lifesteal;
                    if (mod.regen) passives.hpRegen += mod.regen;
                    if (mod.evasion) passives.evasionPercent += mod.evasion;
                    if (mod.counterRate) passives.counterPercent += mod.counterRate;
                    if (mod.critChance) passives.critChance += mod.critChance;
                    if (mod.critDamage) passives.critDamageBonus += mod.critDamage;
                    if (mod.accuracy) passives.accuracyBonus += mod.accuracy;
                    if (mod.physicalPenetration) passives.physicalPenetration += mod.physicalPenetration;
                    if (mod.magicPenetration) passives.magicPenetration += mod.magicPenetration;
                    if (mod.spCostReduction) passives.spCostReduction += mod.spCostReduction;
                    if (mod.magic) passives.magicBonus += mod.magic;
                    if (mod.magicDefense) passives.magicDefenseBonus += mod.magicDefense;
                    if (mod.luck) passives.luckBonus += mod.luck;
                    if (mod.elementalResistances) {
                        for (const [el, val] of Object.entries(mod.elementalResistances)) {
                            if (val !== undefined) {
                                const elem = el as ElementType;
                                passives.elementalResistances[elem] = (passives.elementalResistances[elem] || 0) + val;
                            }
                        }
                    }
                }
            }
        }

        // Companion Aura Passives from Earrings Pet Augmentation
        if (this.state.petCompanion?.augmentation && !this.state.petCompanion.isDefeated) {
            const aura = this.state.petCompanion.augmentation.auraEffect;
            if (aura === 'shadow_aura') passives.evasionPercent += 10;
            else if (aura === 'slime_buffer') {
                passives.elementalResistances.poison = (passives.elementalResistances.poison || 0) + 0.20;
                passives.elementalResistances.water = (passives.elementalResistances.water || 0) + 0.20;
            } else if (aura === 'fire_aura') {
                passives.elementalResistances.fire = (passives.elementalResistances.fire || 0) + 0.25;
                passives.spRegen += 1;
            } else if (aura === 'bone_bulwark') {
                passives.physicalPenetration += 10;
            }
        }

        return passives;
    }

    public addSoulFragments(speciesId: string, quantity: number = 1): {
        added: number;
        total: number;
        endangeredTriggered: boolean;
        extinctTriggered: boolean;
    } {
        if (!this.state.soulCrystals[speciesId]) {
            this.state.soulCrystals[speciesId] = { fragments: 0, isExtinct: false };
        }

        const crystal = this.state.soulCrystals[speciesId];
        if (crystal.isExtinct) {
            return { added: 0, total: 255, endangeredTriggered: false, extinctTriggered: false };
        }

        const previousCount = crystal.fragments;
        let endangeredTriggered = false;
        let extinctTriggered = false;
        const effectiveQuantity = quantity;

        // If we are at 254 fragments, the next kill (255th) triggers extinction
        if (previousCount === 254 && effectiveQuantity > 0) {
            crystal.fragments = 255;
            crystal.isExtinct = true;
            extinctTriggered = true;
        } else {
            crystal.fragments = Math.min(254, crystal.fragments + effectiveQuantity);
            if (crystal.fragments === 254 && previousCount < 254) {
                endangeredTriggered = true;
            }
        }

        // Keep character Level synced to Soul Level (Sprint 24 triangular progression)
        if (this.state.party[0]) {
            this.state.party[0].level = this.getSoulLevel();
        }

        this.saveGame();

        if (extinctTriggered) {
            try {
                AchievementManager.instance.checkExtinctionProgress(this.getExtinctSpeciesCount());
            } catch (err) {
                console.warn('[GameManager] Achievement progress check deferred:', err);
            }
        }

        return {
            added: crystal.fragments - previousCount,
            total: crystal.fragments,
            endangeredTriggered,
            extinctTriggered
        };
    }

    public addEssenceFragments(speciesId: string, count: number = 1) {
        return this.addSoulFragments(speciesId, count);
    }

    public awardFullSoulCrystal(speciesId: string) {
        if (!this.state.soulCrystals[speciesId]) {
            this.state.soulCrystals[speciesId] = { fragments: 0, isExtinct: false };
        }
        const crystal = this.state.soulCrystals[speciesId];
        crystal.fragments = 255;
        crystal.isExtinct = true;

        if (this.state.party[0]) {
            this.state.party[0].level = this.getSoulLevel();
        }

        this.saveGame();

        try {
            AchievementManager.instance.checkExtinctionProgress(this.getExtinctSpeciesCount());
        } catch (err) {
            console.warn('[GameManager] Achievement progress check deferred:', err);
        }
    }

    public socketCrystal(speciesId: string, slot: EquipmentSlot): boolean {
        const crystal = this.state.soulCrystals[speciesId];
        if (!crystal || crystal.fragments === 0) return false;

        // If slot is earrings, check that earrings are unlocked
        if (slot === 'earrings' && !this.state.hasUnlockedEarrings) {
            return false;
        }

        // Unsocket from any other slot
        for (const slotKey in this.state.equippedCrystals) {
            if (this.state.equippedCrystals[slotKey as EquipmentSlot] === speciesId) {
                if (slotKey === 'earrings') {
                    this.state.petCompanion = null;
                }
                this.state.equippedCrystals[slotKey as EquipmentSlot] = null;
            }
        }

        this.state.equippedCrystals[slot] = speciesId;

        // If socketing into earrings: activate the single pet companion!
        if (slot === 'earrings') {
            this.state.petCompanion = this.createPetCompanion(speciesId);
            try {
                AchievementManager.instance.unlock('ACH_FAMILIAR_BOND');
            } catch {}
        }

        this.saveGame();

        try {
            AchievementManager.instance.unlock('ACH_FIRST_INFUSION');
            const baseSlots: EquipmentSlot[] = ['sword', 'shield', 'armor', 'helmet', 'ring1', 'ring2', 'amulet'];
            const allEquipped = baseSlots.every(s => !!this.state.equippedCrystals[s]);
            if (allEquipped) {
                AchievementManager.instance.unlock('ACH_FULL_INFUSION');
            }
        } catch {}

        return true;
    }

    public unsocketCrystal(slot: EquipmentSlot): boolean {
        if (this.state.equippedCrystals[slot] === null) return false;
        this.state.equippedCrystals[slot] = null;

        if (slot === 'earrings') {
            this.state.petCompanion = null;
            if (this.state.secondaryEquippedCrystals) {
                this.state.secondaryEquippedCrystals.earrings = null;
            }
        }

        this.saveGame();
        return true;
    }

    public equipSoulCrystal(slot: EquipmentSlot, speciesId: string | null): boolean {
        if (!speciesId) {
            return this.unsocketCrystal(slot);
        }
        return this.socketCrystal(speciesId, slot);
    }

    public createPetCompanion(speciesId: string): PetCompanionState {
        const crystal = this.state.soulCrystals[speciesId];
        const frags = crystal ? crystal.fragments : 0;
        const petLevel = Math.max(1, Math.floor(frags / 25) + 1);
        
        let name = 'Familiar';
        let baseHp = 40;
        let baseSp = 25;
        let skill: PetSkill = {
            id: 'primal_surge',
            name: 'Primal Surge',
            type: 'damage',
            element: 'physical',
            spCost: 10,
            power: 1.3,
            description: 'Unleashes stored beast essence.'
        };
        
        switch (speciesId) {
            case 'keenkat':
                name = 'Verdant Kit';
                baseHp = 42;
                baseSp = 28;
                skill = {
                    id: 'pounce',
                    name: 'Feral Pounce',
                    type: 'damage',
                    element: 'physical',
                    spCost: 7,
                    power: 1.35,
                    description: 'Pounces with razor claws, dealing quick physical damage.'
                };
                break;
            case 'goblin':
                name = 'Goblin Brawler';
                baseHp = 45;
                baseSp = 25;
                skill = {
                    id: 'fierce_strike',
                    name: 'Fierce Strike',
                    type: 'damage',
                    element: 'earth',
                    spCost: 8,
                    power: 1.4,
                    description: 'Brutal physical strike with earth tremor.'
                };
                break;
            case 'snake':
                name = 'Viperling';
                baseHp = 50;
                baseSp = 30;
                skill = {
                    id: 'venom_bite',
                    name: 'Venom Bite',
                    type: 'damage',
                    element: 'poison',
                    spCost: 10,
                    power: 1.3,
                    description: 'Strikes with venomous fangs.'
                };
                break;
            case 'slime':
                name = 'Slimelet';
                baseHp = 55;
                baseSp = 35;
                skill = {
                    id: 'revitalize',
                    name: 'Revitalize',
                    type: 'heal',
                    element: 'water',
                    spCost: 12,
                    power: 35,
                    description: 'Restores 35 HP to lowest ally when in danger.'
                };
                break;
            case 'bat':
                name = 'Nightwing Bat';
                baseHp = 35;
                baseSp = 25;
                skill = {
                    id: 'sonic_screech',
                    name: 'Sonic Screech',
                    type: 'damage',
                    element: 'dark',
                    spCost: 8,
                    power: 1.2,
                    description: 'Emits a piercing dark ultrasonic wave.'
                };
                break;
            case 'skeleton':
                name = 'Bone Archer';
                baseHp = 40;
                baseSp = 30;
                skill = {
                    id: 'bone_volley',
                    name: 'Bone Volley',
                    type: 'damage',
                    element: 'cold',
                    spCost: 10,
                    power: 1.5,
                    description: 'Fires a volley of ossified bone arrows.'
                };
                break;
            case 'phoenix':
                name = 'Pyre Fledgling';
                baseHp = 60;
                baseSp = 40;
                skill = {
                    id: 'healing_ember',
                    name: 'Healing Ember',
                    type: 'heal',
                    element: 'fire',
                    spCost: 14,
                    power: 45,
                    description: 'Bathes lowest ally in soothing solar flames, restoring 45 HP.'
                };
                break;
            case 'wolf':
            case 'direwolf':
                name = 'Dire Pup';
                baseHp = 48;
                baseSp = 25;
                skill = {
                    id: 'feral_pounce',
                    name: 'Feral Pounce',
                    type: 'damage',
                    element: 'physical',
                    spCost: 8,
                    power: 1.3,
                    description: 'Lunges with razor-sharp claws.'
                };
                break;
            case 'golem':
            case 'stone_golem':
                name = 'Obsidian Pebble';
                baseHp = 65;
                baseSp = 20;
                skill = {
                    id: 'boulder_toss',
                    name: 'Boulder Toss',
                    type: 'damage',
                    element: 'earth',
                    spCost: 10,
                    power: 1.4,
                    description: 'Hurls dense obsidian rocks.'
                };
                break;
            case 'basilisk':
                name = 'Glacial Whelp';
                baseHp = 52;
                baseSp = 32;
                skill = {
                    id: 'frost_breath',
                    name: 'Frost Breath',
                    type: 'damage',
                    element: 'cold',
                    spCost: 11,
                    power: 1.5,
                    description: 'Exhales chilling sub-zero frost.'
                };
                break;
        }

        const maxHp = baseHp + (petLevel - 1) * 8;
        const maxSp = baseSp + (petLevel - 1) * 5;
        const comp: PetCompanionState = {
            speciesId,
            name,
            level: petLevel,
            hp: maxHp,
            maxHp,
            sp: maxSp,
            maxSp,
            isDefeated: false,
            signatureSkill: skill,
            augmentation: null
        };

        const secondary = this.state.secondaryEquippedCrystals?.earrings;
        if (secondary) {
            comp.augmentation = this.getPetAugmentation(speciesId, secondary);
        }

        return comp;
    }

    public getPetAugmentation(primarySpecies: string, secondarySpecies: string): PetAugmentation {
        let traitName = 'Synergy Spark';
        let desc = 'Augments companion attributes.';
        let bonusHpPercent = 0.15;
        let bonusAttackPercent = 0.15;
        let bonusDefensePercent = 0.10;
        let secondaryElement: ElementType = 'physical';
        let auraEffect = 'stat_boost';

        let bonusSkill = 'Catalyst Pulse';

        switch (secondarySpecies) {
            case 'keenkat':
                traitName = 'Predator Instinct';
                desc = 'Sharpens pet senses. Pet gains +25% Agility and grants Hero +5% Crit Chance & +5% Evasion.';
                bonusSkill = 'Pounce Claw';
                bonusHpPercent = 0.20;
                bonusAttackPercent = 0.25;
                bonusDefensePercent = 0.15;
                secondaryElement = 'physical';
                auraEffect = 'predator_aura';
                break;
            case 'phoenix':
                traitName = 'Solar Radiance';
                desc = 'Infuses pet with blazing solar flames. Hero gains +5% SP regen and Fire resistance.';
                bonusSkill = 'Phoenix Flame';
                bonusHpPercent = 0.25;
                bonusAttackPercent = 0.25;
                bonusDefensePercent = 0.15;
                secondaryElement = 'fire';
                auraEffect = 'fire_aura';
                break;
            case 'slime':
                traitName = 'Corrosive Buffer';
                desc = 'Coats pet in viscous membrane. Pet gains +30% Defense and grants party Poison/Water shield.';
                bonusSkill = 'Acid Spray';
                bonusHpPercent = 0.30;
                bonusAttackPercent = 0.10;
                bonusDefensePercent = 0.30;
                secondaryElement = 'poison';
                auraEffect = 'slime_buffer';
                break;
            case 'bat':
                traitName = 'Shadow Wing Aura';
                desc = 'Surrounds pet with sonic vibrations. Pet gains +20% Agility and grants Hero +10% Evasion.';
                bonusSkill = 'Vampiric Drain';
                bonusHpPercent = 0.10;
                bonusAttackPercent = 0.20;
                bonusDefensePercent = 0.10;
                secondaryElement = 'dark';
                auraEffect = 'shadow_aura';
                break;
            case 'snake':
                traitName = 'Verdant Mending';
                desc = 'Empowers pet with restorative venom. Pet attacks inflict poison and heal party low-HP threshold +50%.';
                bonusSkill = 'Venom Fang';
                bonusHpPercent = 0.35;
                bonusAttackPercent = 0.15;
                bonusDefensePercent = 0.15;
                secondaryElement = 'light';
                auraEffect = 'mending_aura';
                break;
            case 'goblin':
                traitName = 'Fierce Fervor';
                desc = 'Fills pet with reckless combat fury. Pet gains +30% Attack and +15% Crit Chance.';
                bonusSkill = 'Pocket Sand';
                bonusHpPercent = 0.15;
                bonusAttackPercent = 0.35;
                bonusDefensePercent = 0.10;
                secondaryElement = 'physical';
                auraEffect = 'fervor_aura';
                break;
            case 'skeleton':
                traitName = 'Ossified Bulwark';
                desc = 'Encases pet in calcified skeletal armor. Pet attacks ignore 25% defense.';
                bonusSkill = 'Bone Splinter';
                bonusHpPercent = 0.20;
                bonusAttackPercent = 0.20;
                bonusDefensePercent = 0.25;
                secondaryElement = 'earth';
                auraEffect = 'bone_bulwark';
                break;
        }

        const primaryName = SoulCrystalDatabase[primarySpecies]?.name || primarySpecies;
        return {
            secondarySpeciesId: secondarySpecies,
            name: `${traitName} Catalyst`,
            traitName,
            description: `${primaryName} augmented: ${desc}`,
            bonusSkill,
            passiveDescription: desc,
            bonusHpPercent,
            bonusAttackPercent,
            bonusDefensePercent,
            secondaryElement,
            auraEffect
        };
    }

    public unlockEarringsSlot(): boolean {
        this.state.hasUnlockedEarrings = true;
        this.saveGame();
        try {
            AchievementManager.instance.unlock('ACH_ASTRAL_EARRINGS');
        } catch {}
        return true;
    }

    public hasEarringsUnlocked(): boolean {
        return !!this.state.hasUnlockedEarrings;
    }

    public unlockDualSocket(slot: EquipmentSlot): { success: boolean; message: string } {
        if (!this.state.dualSocketUnlocked) {
            this.state.dualSocketUnlocked = {};
        }
        if (this.state.dualSocketUnlocked[slot]) {
            return { success: false, message: `${slot.toUpperCase()} already has dual sockets unlocked!` };
        }
        this.state.dualSocketUnlocked[slot] = true;
        if (!this.state.secondaryEquippedCrystals) {
            this.state.secondaryEquippedCrystals = {
                sword: null, shield: null, armor: null, helmet: null, ring1: null, ring2: null, amulet: null, earrings: null
            };
        }
        this.saveGame();
        try {
            AchievementManager.instance.unlock('ACH_BOSS_SOULMELDER');
        } catch {}

        const msg = slot === 'earrings'
            ? `Boss Soulmeld Unlocked! The EARRINGS slot can now hold a Pet Augmentation Catalyst!`
            : `Boss Soulmeld Unlocked! ${slot.toUpperCase()} now holds a second infusion socket!`;

        return { success: true, message: msg };
    }

    public isDualSocketUnlocked(slot: EquipmentSlot): boolean {
        return !!(this.state.dualSocketUnlocked && this.state.dualSocketUnlocked[slot]);
    }

    public socketSecondaryCrystal(slot: EquipmentSlot, speciesId: string): boolean {
        if (!this.isDualSocketUnlocked(slot)) return false;
        const crystal = this.state.soulCrystals[speciesId];
        if (!crystal || crystal.fragments === 0) return false;

        if (!this.state.secondaryEquippedCrystals) {
            this.state.secondaryEquippedCrystals = {
                sword: null, shield: null, armor: null, helmet: null, ring1: null, ring2: null, amulet: null, earrings: null
            };
        }

        // Cannot equip same species in primary and secondary of same slot
        if (this.state.equippedCrystals[slot] === speciesId) {
            return false;
        }

        // For earrings: requires primary pet to be equipped first!
        if (slot === 'earrings') {
            if (!this.state.equippedCrystals.earrings || !this.state.petCompanion) {
                return false;
            }
            this.state.secondaryEquippedCrystals.earrings = speciesId;
            this.state.petCompanion.augmentation = this.getPetAugmentation(
                this.state.equippedCrystals.earrings,
                speciesId
            );
            try {
                AchievementManager.instance.unlock('ACH_PET_AUGMENTED');
            } catch {}
            this.saveGame();
            return true;
        }

        this.state.secondaryEquippedCrystals[slot] = speciesId;
        this.saveGame();
        return true;
    }

    public unsocketSecondaryCrystal(slot: EquipmentSlot): boolean {
        if (!this.state.secondaryEquippedCrystals) return false;
        if (this.state.secondaryEquippedCrystals[slot] === null) return false;
        this.state.secondaryEquippedCrystals[slot] = null;
        if (slot === 'earrings' && this.state.petCompanion) {
            this.state.petCompanion.augmentation = null;
        }
        this.saveGame();
        return true;
    }

    public getEquippedCrystal(slot: EquipmentSlot): string | null {
        return this.state.equippedCrystals ? (this.state.equippedCrystals[slot] || null) : null;
    }

    public getSecondaryEquippedCrystal(slot: EquipmentSlot): string | null {
        return this.state.secondaryEquippedCrystals ? (this.state.secondaryEquippedCrystals[slot] || null) : null;
    }

    public addItem(itemId: string, quantity: number = 1) {
        if (!this.itemDatabase[itemId]) return;
        const item = this.state.inventory.find(i => i.itemId === itemId);
        if (item) {
            item.quantity += quantity;
        } else {
            this.state.inventory.push({ itemId, quantity });
        }
        this.saveGame();
    }

    public removeItem(itemId: string, quantity: number = 1): boolean {
        const item = this.state.inventory.find(i => i.itemId === itemId);
        if (!item || item.quantity < quantity) return false;
        
        item.quantity -= quantity;
        if (item.quantity === 0) {
            this.state.inventory = this.state.inventory.filter(i => i.itemId !== itemId);
        }
        this.saveGame();
        return true;
    }

    public hasItem(itemId: string, minQuantity: number = 1): boolean {
        const item = this.state.inventory.find(i => i.itemId === itemId);
        return !!item && item.quantity >= minQuantity;
    }

    public setQuestState(questId: string, status: 'inactive' | 'active' | 'completed') {
        this.state.quests[questId] = status;
        this.saveGame();
    }

    public getQuestState(questId: string): 'inactive' | 'active' | 'completed' {
        return this.state.quests[questId] || 'inactive';
    }

    public setHeroName(name: string) {
        if (this.state.party && this.state.party[0]) {
            this.state.party[0].name = name;
            this.saveGame();
        }
    }

    // Sprint 28: Hero gender (Valen Swift = 'male', Cora Swift = 'female')
    public setPlayerGender(gender: 'male' | 'female') {
        this.state.playerGender = gender;
        this.saveGame();
    }

    public getPlayerGender(): 'male' | 'female' {
        return this.state.playerGender || 'male';
    }

    public updatePlayerLocation(sceneName: string, mapId: string, x: number, y: number) {
        this.state.currentScene = sceneName;
        this.state.currentMapId = mapId;
        this.state.spawnPoint = { x, y };
        this.saveGame();
    }

    public healPartyMember(index: number, hpAmount: number, spAmount: number = 0) {
        const char = this.state.party[index];
        if (!char) return;
        
        const calculated = this.getHeroCalculatedStats();
        char.hp = Math.min(calculated.maxHp, Math.trunc(char.hp + hpAmount));
        char.sp = Math.min(calculated.maxSp, Math.trunc(char.sp + spAmount));
        this.saveGame();
    }

    public fullHealParty() {
        const calculated = this.getHeroCalculatedStats();
        if (this.state.party && this.state.party[0]) {
            this.state.party[0].hp = calculated.maxHp;
            this.state.party[0].sp = calculated.maxSp;
            this.saveGame();
        }
    }

    public setDebugSoulLevel(level: number) {
        const keys = Object.keys(this.state.soulCrystals);
        // Reset all fragments
        for (const k of keys) {
            this.state.soulCrystals[k].fragments = 0;
            this.state.soulCrystals[k].isExtinct = false;
        }
        // Grant fragments to achieve desired Soul Level threshold: 50 * level * (level + 1)
        const requiredTotal = GameManager.getFragmentsForSoulLevel(level);
        let remaining = requiredTotal;
        for (let i = 0; i < keys.length && remaining > 0; i++) {
            const allocate = Math.min(255, remaining);
            this.state.soulCrystals[keys[i]].fragments = allocate;
            if (allocate === 255) {
                this.state.soulCrystals[keys[i]].isExtinct = true;
            }
            remaining -= allocate;
        }
        if (this.state.party[0]) {
            this.state.party[0].level = this.getSoulLevel();
        }
        this.saveGame();
    }

    public setDebugExtinctionCount(count: number) {
        const keys = ['slime', 'snake', 'bat', 'goblin', 'skeleton', 'phoenix'];
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (!this.state.soulCrystals[k]) {
                this.state.soulCrystals[k] = { fragments: 0, isExtinct: false };
            }
            if (i < count) {
                this.state.soulCrystals[k].fragments = 255;
                this.state.soulCrystals[k].isExtinct = true;
            } else {
                if (this.state.soulCrystals[k].fragments === 255) {
                    this.state.soulCrystals[k].fragments = 5;
                    this.state.soulCrystals[k].isExtinct = false;
                }
            }
        }
        this.saveGame();
    }

    public setDebugSpeciesEndangered(speciesId: string) {
        if (!this.state.soulCrystals[speciesId]) {
            this.state.soulCrystals[speciesId] = { fragments: 0, isExtinct: false };
        }
        this.state.soulCrystals[speciesId].fragments = 254;
        this.state.soulCrystals[speciesId].isExtinct = false;
        this.saveGame();
    }

    public getExtinctSpeciesCount(): number {
        let count = 0;
        for (const key in this.state.soulCrystals) {
            if (this.state.soulCrystals[key]?.isExtinct) count++;
        }
        return count;
    }

    public isSpeciesExtinct(speciesId: string): boolean {
        return !!(this.state.soulCrystals[speciesId]?.isExtinct);
    }

    public getForgeRefinements(): { [slot in EquipmentSlot]: number } {
        if (!this.state.forgeRefinements) {
            this.state.forgeRefinements = {
                sword: 0, shield: 0, armor: 0, helmet: 0, ring1: 0, ring2: 0, amulet: 0, earrings: 0
            };
        }
        return this.state.forgeRefinements as { [slot in EquipmentSlot]: number };
    }

    public refineEquipmentSlot(slot: EquipmentSlot): { success: boolean; newTier: number; message: string } {
        if (!this.state.forgeRefinements) {
            this.state.forgeRefinements = {
                sword: 0, shield: 0, armor: 0, helmet: 0, ring1: 0, ring2: 0, amulet: 0, earrings: 0
            };
        }
        if (slot === 'earrings' && !this.state.hasUnlockedEarrings) {
            return {
                success: false,
                newTier: 0,
                message: `You must first recover the Astral Earrings before refining them!`
            };
        }
        const currentTier = this.state.forgeRefinements[slot] || 0;
        if (currentTier >= 5) {
            return {
                success: false,
                newTier: currentTier,
                message: `${slot.toUpperCase()} is already at maximum Masterwork Refinement (Tier 5)!`
            };
        }

        const newTier = currentTier + 1;
        this.state.forgeRefinements[slot] = newTier;
        this.saveGame();

        if (newTier === 5) {
            try {
                AchievementManager.instance.unlock('ACH_MASTER_FORGE');
            } catch {}
        }

        return {
            success: true,
            newTier,
            message: `Hammer strikes true! ${slot.toUpperCase()} refined to Masterwork Tier ${newTier}!`
        };
    }

    public meldBossSoul(speciesId: string): { success: boolean; message: string } {
        if (!this.state.bossMelds) {
            this.state.bossMelds = [];
        }
        if (!this.isSpeciesExtinct(speciesId)) {
            return {
                success: false,
                message: `The ${speciesId.toUpperCase()} species is not extinct yet. Defeat its Alpha Boss first!`
            };
        }
        if (this.state.bossMelds.includes(speciesId)) {
            return {
                success: false,
                message: `The celestial soul of ${speciesId.toUpperCase()} is already melded into your core gear!`
            };
        }

        this.state.bossMelds.push(speciesId);
        this.saveGame();

        try {
            AchievementManager.instance.unlock('ACH_ALPHA_PREDATOR');
        } catch {}

        return {
            success: true,
            message: `Celestial confluence achieved! Melded the ancient soul of ${speciesId.toUpperCase()}!`
        };
    }

    public getBossMelds(): string[] {
        return this.state.bossMelds || [];
    }

    public isCataclysmEventTriggered(): boolean {
        return !!this.state.extinctionEventTriggered;
    }

    public isFinalBossUnlocked(): boolean {
        return !!this.state.finalBossUnlocked;
    }

    public isCataclysmBossDefeated(): boolean {
        return !!this.state.cataclysmBossDefeated;
    }

    public recordCataclysmBossDefeated(): void {
        this.state.cataclysmBossDefeated = true;
        this.saveGame();
        console.info('[GameManager] ⚔️ CATACLYSM VANQUISHED! The extinction engine reaches equilibrium.');
    }

    /**
     * Computes the Cataclysm boss stats dynamically by applying all species\' extinction bonuses
     * to the base hero stats — mirroring exactly what the player would have at 100% fragments
     * collected with no equipment or forge refinements. The player\'s only advantage is infusions.
     */
    public static computeCataclysmBossStats(): import('../systems/MonsterDatabase').MonsterStats {
        // Base party stats (mirrors GameManager.getHeroCalculatedStats() base)
        let maxHp = 24;
        let maxSp = 8;
        let strength = 4;
        let defense = 2;
        let agility = 3;
        let magic = 5;
        let magicDefense = 3;
        let accuracy = 95;
        let evasion = 5;
        let critChance = 5;
        let critDamage = 1.5;
        let luck = 10;
        let physicalPenetration = 0;
        let magicPenetration = 0;

        // Apply extinction bonuses for every species (the isExtinct branch of getHeroCalculatedStats)
        for (const speciesId in SoulCrystalDatabase) {
            const config = SoulCrystalDatabase[speciesId];
            if (!config) continue;
            const b = config.extinctionBonus;
            if (b.maxHp)             maxHp             += b.maxHp;
            if (b.maxSp)             maxSp             += b.maxSp;
            if (b.strength)          strength          += b.strength;
            if (b.defense)           defense           += b.defense;
            if (b.agility)           agility           += b.agility;
            if (b.magic)             magic             += b.magic;
            if (b.magicDefense)      magicDefense      += b.magicDefense;
            if (b.accuracy)          accuracy          += b.accuracy;
            if (b.evasion)           evasion           += b.evasion;
            if (b.critChance)        critChance        += b.critChance;
            if (b.critDamage)        critDamage        += b.critDamage;
            if (b.luck)              luck              += b.luck;
            if (b.physicalPenetration) physicalPenetration += b.physicalPenetration;
            if (b.magicPenetration)  magicPenetration  += b.magicPenetration;
        }

        // Max soul level: 7 species × 255 fragments each
        const totalMaxFragments = Object.keys(SoulCrystalDatabase).length * 255;
        const level = GameManager.getSoulLevelFromFragments(totalMaxFragments);

        const hp = Math.trunc(maxHp);
        return {
            speciesId: 'cataclysm',
            name: 'Cataclysm',
            level,
            hp,
            maxHp: hp,
            strength:          Math.trunc(strength),
            defense:           Math.trunc(defense),
            agility:           Math.trunc(agility),
            magic:             Math.trunc(magic),
            magicDefense:      Math.trunc(magicDefense),
            accuracy:          Math.trunc(accuracy),
            evasion:           Math.trunc(evasion),
            critChance:        Math.trunc(critChance),
            critDamage:        parseFloat(critDamage.toFixed(3)),
            luck:              Math.trunc(luck),
            physicalPenetration: Math.trunc(physicalPenetration),
            magicPenetration:  Math.trunc(magicPenetration),
            spriteKey: 'phoenix',
            color: 0xff0055,
            element: 'dark' as import('../systems/ElementSystem').ElementType,
            elementalResistances: {
                // Resists all damage types equally — immune to player elemental advantage
                fire: 0.5, dark: 0.5, light: 0.5, poison: 0.5,
                earth: 0.5, cold: 0.5, water: 0.5, lightning: 0.5, physical: 0.5
            }
        };
    }

    public triggerCataclysmClimaxEvent(_scene?: any): boolean {
        if (this.state.extinctionEventTriggered) return false;
        this.state.extinctionEventTriggered = true;
        this.state.finalBossUnlocked = true;
        this.saveGame();
        console.info('[GameManager] ⚠️ CATACLYSM CLIMAX EVENT TRIGGERED! 80% species extinct. Final Boss unlocked!');
        return true;
    }

    public recordAchievement(achievementId: string): boolean {
        if (!this.state.achievements) {
            this.state.achievements = {};
        }
        if (this.state.achievements[achievementId]) {
            return false;
        }
        this.state.achievements[achievementId] = Date.now();
        this.saveGame();
        return true;
    }

    public hasAchievement(achievementId: string): boolean {
        return !!(this.state.achievements && this.state.achievements[achievementId]);
    }

    public getAchievementUnlockTime(achievementId: string): number | null {
        return this.state.achievements?.[achievementId] ?? null;
    }

    public setHeroHp(hp: number) {
        if (this.state.party && this.state.party.length > 0) {
            this.state.party[0].hp = Math.max(0, Math.trunc(hp));
        }
    }

    public setHeroSp(sp: number) {
        if (this.state.party && this.state.party.length > 0) {
            this.state.party[0].sp = Math.max(0, Math.trunc(sp));
        }
    }

    public validateAndRepairState(state: GameState): GameState {
        // 1. Ensure party stats exist and are valid
        if (!state.party || state.party.length === 0) {
            state.party = [
                {
                    name: 'Swift',
                    level: 0,
                    hp: 24,
                    maxHp: 24,
                    sp: 8,
                    maxSp: 8,
                    strength: 4,
                    defense: 2,
                    agility: 3,
                    magic: 5,
                    magicDefense: 3,
                    accuracy: 95,
                    evasion: 5,
                    critChance: 5,
                    critDamage: 1.5,
                    luck: 10,
                    physicalPenetration: 0,
                    magicPenetration: 0,
                    spCostReduction: 0
                }
            ];
        } else {
            const hero = state.party[0];
            if (typeof hero.name !== 'string' || !hero.name) hero.name = 'Swift';
            if (typeof hero.level !== 'number' || isNaN(hero.level) || hero.level < 0) hero.level = 0;
            if (typeof hero.hp !== 'number' || isNaN(hero.hp) || hero.hp < 0) hero.hp = 15;
            if (typeof hero.maxHp !== 'number' || isNaN(hero.maxHp) || hero.maxHp <= 0) hero.maxHp = 15;
            if (typeof hero.sp !== 'number' || isNaN(hero.sp) || hero.sp < 0) hero.sp = 8;
            if (typeof hero.maxSp !== 'number' || isNaN(hero.maxSp) || hero.maxSp <= 0) hero.maxSp = 8;
            if (typeof hero.strength !== 'number' || isNaN(hero.strength) || hero.strength <= 0) hero.strength = 4;
            if (typeof hero.defense !== 'number' || isNaN(hero.defense) || hero.defense < 0) hero.defense = 2;
            if (typeof hero.agility !== 'number' || isNaN(hero.agility) || hero.agility <= 0) hero.agility = 3;
            // Sprint 20: Core attribute and combat rating hydration for saved states
            if (typeof hero.magic !== 'number' || isNaN(hero.magic) || hero.magic < 0) hero.magic = 5;
            if (typeof hero.magicDefense !== 'number' || isNaN(hero.magicDefense) || hero.magicDefense < 0) hero.magicDefense = 3;
            if (typeof hero.accuracy !== 'number' || isNaN(hero.accuracy) || hero.accuracy <= 0) hero.accuracy = 95;
            if (typeof hero.evasion !== 'number' || isNaN(hero.evasion) || hero.evasion < 0) hero.evasion = 5;
            if (typeof hero.critChance !== 'number' || isNaN(hero.critChance) || hero.critChance < 0) hero.critChance = 5;
            if (typeof hero.critDamage !== 'number' || isNaN(hero.critDamage) || hero.critDamage <= 0) hero.critDamage = 1.5;
            if (typeof hero.luck !== 'number' || isNaN(hero.luck) || hero.luck < 0) hero.luck = 10;
            if (typeof hero.physicalPenetration !== 'number' || isNaN(hero.physicalPenetration) || hero.physicalPenetration < 0) hero.physicalPenetration = 0;
            if (typeof hero.magicPenetration !== 'number' || isNaN(hero.magicPenetration) || hero.magicPenetration < 0) hero.magicPenetration = 0;
            if (typeof hero.spCostReduction !== 'number' || isNaN(hero.spCostReduction) || hero.spCostReduction < 0) hero.spCostReduction = 0;
        }

        // Sprint 28: Ensure playerGender is valid (default 'male' for legacy saves)
        if (state.playerGender !== 'male' && state.playerGender !== 'female') {
            state.playerGender = 'male';
        }

        // 2. Ensure inventory exists and has valid numbers
        if (!state.inventory || !Array.isArray(state.inventory)) {
            state.inventory = [];
        } else {
            state.inventory = state.inventory.filter(item => {
                return item && typeof item.itemId === 'string' && typeof item.quantity === 'number' && item.quantity > 0;
            });
        }

        // 3. Ensure quests object exists
        if (!state.quests || typeof state.quests !== 'object') {
            state.quests = {};
        }

        // 4. Ensure spawn point and maps exist
        if (!state.currentScene) state.currentScene = 'OverworldScene';
        if (!state.currentMapId) state.currentMapId = 'world_map';
        if (!state.spawnPoint || typeof state.spawnPoint.x !== 'number' || typeof state.spawnPoint.y !== 'number') {
            state.spawnPoint = { x: 2912, y: 2976 };
        }

        // 5. Ensure soulCrystals registry is complete and correct
        if (!state.soulCrystals || typeof state.soulCrystals !== 'object') {
            state.soulCrystals = {};
        }
        
        const speciesList: readonly string[] = ALL_MONSTER_SPECIES;
        speciesList.forEach(speciesId => {
            if (!state.soulCrystals[speciesId]) {
                state.soulCrystals[speciesId] = { fragments: 0, isExtinct: false };
            } else {
                const crystal = state.soulCrystals[speciesId];
                if (typeof crystal.fragments !== 'number' || isNaN(crystal.fragments)) {
                    crystal.fragments = 0;
                }
                // Clamp fragments
                crystal.fragments = Math.max(0, Math.min(255, crystal.fragments));
                
                // Extinction check alignment
                if (crystal.fragments === 255) {
                    crystal.isExtinct = true;
                }
                if (crystal.isExtinct) {
                    crystal.fragments = 255;
                }
            }
        });

        // 5. Ensure hasUnlockedEarrings boolean exists
        if (typeof state.hasUnlockedEarrings !== 'boolean') {
            state.hasUnlockedEarrings = false;
        }

        // 6. Ensure equippedCrystals exist and are consistent (ALL_EQUIPMENT_SLOTS)
        if (!state.equippedCrystals || typeof state.equippedCrystals !== 'object') {
            state.equippedCrystals = {
                sword: null, shield: null, armor: null, helmet: null, ring1: null, ring2: null, amulet: null, earrings: null
            };
        } else {
            const seenCrystals = new Set<string>();

            ALL_EQUIPMENT_SLOTS.forEach(slot => {
                const crystalId = state.equippedCrystals[slot];
                if (crystalId) {
                    const crystalState = state.soulCrystals[crystalId];
                    if (!crystalState || crystalState.fragments === 0 || !speciesList.includes(crystalId)) {
                        state.equippedCrystals[slot] = null;
                        return;
                    }

                    if (slot === 'earrings' && !state.hasUnlockedEarrings) {
                        state.equippedCrystals[slot] = null;
                        return;
                    }

                    if (seenCrystals.has(crystalId)) {
                        state.equippedCrystals[slot] = null;
                    } else {
                        seenCrystals.add(crystalId);
                    }
                }
            });

            ALL_EQUIPMENT_SLOTS.forEach(slot => {
                if (state.equippedCrystals[slot] === undefined) {
                    state.equippedCrystals[slot] = null;
                }
            });
        }

        // 6b. Ensure dualSocketUnlocked registry exists for all 8 slots
        if (!state.dualSocketUnlocked || typeof state.dualSocketUnlocked !== 'object') {
            state.dualSocketUnlocked = {
                sword: false, shield: false, armor: false, helmet: false, ring1: false, ring2: false, amulet: false, earrings: false
            };
        } else {
            ALL_EQUIPMENT_SLOTS.forEach(slot => {
                if (typeof state.dualSocketUnlocked![slot] !== 'boolean') {
                    state.dualSocketUnlocked![slot] = false;
                }
            });
        }

        // 6c. Ensure secondaryEquippedCrystals exist and are consistent
        if (!state.secondaryEquippedCrystals || typeof state.secondaryEquippedCrystals !== 'object') {
            state.secondaryEquippedCrystals = {
                sword: null, shield: null, armor: null, helmet: null, ring1: null, ring2: null, amulet: null, earrings: null
            };
        } else {
            ALL_EQUIPMENT_SLOTS.forEach(slot => {
                const secCrystal = state.secondaryEquippedCrystals![slot];
                if (secCrystal) {
                    const crystalState = state.soulCrystals[secCrystal];
                    if (!crystalState || crystalState.fragments === 0 || !speciesList.includes(secCrystal) || !state.dualSocketUnlocked?.[slot]) {
                        state.secondaryEquippedCrystals![slot] = null;
                    } else if (state.equippedCrystals[slot] === secCrystal) {
                        state.secondaryEquippedCrystals![slot] = null; // Cannot duplicate species in same slot
                    }
                } else {
                    state.secondaryEquippedCrystals![slot] = null;
                }
            });
        }

        // 7. Recompute Soul Level (level) and keep it in sync with total fragment progression
        let totalFrags = 0;
        for (const speciesId of speciesList) {
            totalFrags += state.soulCrystals[speciesId].fragments || 0;
        }
        state.party[0].level = GameManager.getSoulLevelFromFragments(totalFrags);

        // 8. Ensure forgeRefinements exist, have all 8 slots, and are bounded (0 to 5)
        if (!state.forgeRefinements || typeof state.forgeRefinements !== 'object') {
            state.forgeRefinements = {
                sword: 0, shield: 0, armor: 0, helmet: 0, ring1: 0, ring2: 0, amulet: 0, earrings: 0
            };
        } else {
            ALL_EQUIPMENT_SLOTS.forEach(slot => {
                const cur = state.forgeRefinements![slot];
                if (typeof cur !== 'number' || isNaN(cur) || cur < 0) {
                    state.forgeRefinements![slot] = 0;
                } else if (cur > 5) {
                    state.forgeRefinements![slot] = 5;
                }
            });
        }

        // 9. Ensure bossMelds is a valid string array
        if (!Array.isArray(state.bossMelds)) {
            state.bossMelds = [];
        } else {
            state.bossMelds = state.bossMelds.filter(m => typeof m === 'string' && speciesList.includes(m));
        }

        // 10. Ensure achievements registry exists and is clean
        if (!state.achievements || typeof state.achievements !== 'object' || Array.isArray(state.achievements)) {
            state.achievements = {};
        } else {
            for (const k in state.achievements) {
                if (typeof state.achievements[k] !== 'number' || isNaN(state.achievements[k])) {
                    state.achievements[k] = Date.now();
                }
            }
        }

        // 11. Ensure 80% extinction climax event flags
        if (typeof state.extinctionEventTriggered !== 'boolean') {
            state.extinctionEventTriggered = false;
        }
        if (typeof state.finalBossUnlocked !== 'boolean') {
            state.finalBossUnlocked = false;
        }
        if (typeof state.cataclysmBossDefeated !== 'boolean') {
            state.cataclysmBossDefeated = false;
        }

        // 12. Sprint 24: Ensure timePlayedSeconds is non-negative number
        if (typeof state.timePlayedSeconds !== 'number' || isNaN(state.timePlayedSeconds) || state.timePlayedSeconds < 0) {
            state.timePlayedSeconds = 0;
        }

        // 13. Sprint 24: Ensure lastAttunedHealingStation is valid or defaulted to Meteor Pod
        const meteorPod = HEALING_STATIONS['station_meteor_pod'];
        if (state.lastAttunedHealingStation && typeof state.lastAttunedHealingStation === 'object') {
            if (!state.lastAttunedHealingStation.stationId || !state.lastAttunedHealingStation.mapId) {
                state.lastAttunedHealingStation = {
                    stationId: meteorPod.stationId,
                    name: meteorPod.name,
                    mapId: meteorPod.mapId,
                    x: meteorPod.gridX * 64 + 32,
                    y: meteorPod.gridY * 64 + 32
                };
            }
        } else {
            state.lastAttunedHealingStation = {
                stationId: meteorPod.stationId,
                name: meteorPod.name,
                mapId: meteorPod.mapId,
                x: meteorPod.gridX * 64 + 32,
                y: meteorPod.gridY * 64 + 32
            };
        }

        // 14. Sprint 24 & 25: Ensure petCompanion state is clean and syncs with earrings crystal
        const primaryEarringCrystal = state.equippedCrystals.earrings;
        if (primaryEarringCrystal && speciesList.includes(primaryEarringCrystal)) {
            if (!state.petCompanion || state.petCompanion.speciesId !== primaryEarringCrystal) {
                state.petCompanion = GameManager.instance ? GameManager.instance.createPetCompanion(primaryEarringCrystal) : {
                    speciesId: primaryEarringCrystal,
                    name: 'Companion',
                    level: 1,
                    hp: 50,
                    maxHp: 50,
                    sp: 25,
                    maxSp: 25,
                    isDefeated: false,
                    signatureSkill: {
                        id: 'primal_surge',
                        name: 'Primal Surge',
                        type: 'damage',
                        element: 'physical',
                        spCost: 10,
                        power: 1.3,
                        description: 'Unleashes stored beast essence.'
                    },
                    augmentation: null
                };
            }
            if (state.petCompanion) {
                if (typeof state.petCompanion.sp !== 'number') state.petCompanion.sp = 25;
                if (typeof state.petCompanion.maxSp !== 'number') state.petCompanion.maxSp = 25;
                if (!state.petCompanion.signatureSkill) {
                    state.petCompanion.signatureSkill = {
                        id: 'primal_surge',
                        name: 'Primal Surge',
                        type: 'damage',
                        element: 'physical',
                        spCost: 10,
                        power: 1.3,
                        description: 'Unleashes stored beast essence.'
                    };
                }
            }
            // Augment check
            const secEarring = state.secondaryEquippedCrystals?.earrings;
            if (secEarring && speciesList.includes(secEarring) && GameManager.instance) {
                state.petCompanion.augmentation = GameManager.instance.getPetAugmentation(primaryEarringCrystal, secEarring);
            } else if (!secEarring && state.petCompanion) {
                state.petCompanion.augmentation = null;
            }
        } else {
            state.petCompanion = null;
            if (state.secondaryEquippedCrystals) {
                state.secondaryEquippedCrystals.earrings = null;
            }
        }

        return state;
    }

    private currentSaveSlot: number = 1;

    public getCurrentSaveSlot(): number {
        return this.currentSaveSlot;
    }

    public setCurrentSaveSlot(slot: number) {
        this.currentSaveSlot = slot;
    }

    public getSlotPreview(slot: number): SlotPreview | null {
        try {
            const saved = localStorage.getItem('swiftsouls_save_' + slot);
            if (!saved) {
                return null;
            }

            const parsed = JSON.parse(saved);

            // Version 2 Checksummed Envelope
            if (parsed && parsed.version === 2 && typeof parsed.signature === 'string' && typeof parsed.payload === 'string') {
                const isValid = CryptoChecksum.verifySignature(parsed.slot, parsed.timestamp, parsed.payload, parsed.signature);
                if (!isValid || parsed.slot !== slot) {
                    return {
                        name: 'TAMPERED',
                        level: 0,
                        mapId: 'CORRUPTED',
                        isTampered: true,
                        timestamp: parsed.timestamp
                    };
                }

                const parsedState = JSON.parse(parsed.payload);
                const clean = this.validateAndRepairState(parsedState);

                let totalFrags = 0;
                for (const sp in clean.soulCrystals) {
                    totalFrags += clean.soulCrystals[sp]?.fragments || 0;
                }
                const soulLvl = GameManager.getSoulLevelFromFragments(totalFrags);

                return {
                    slot,
                    name: clean.party[0]?.name || 'Swift',
                    level: soulLvl,
                    mapId: clean.currentMapId || 'world_map',
                    isTampered: false,
                    timestamp: parsed.timestamp,
                    timePlayedSeconds: clean.timePlayedSeconds || 0,
                    totalFragments: totalFrags,
                    maxFragments: 1530,
                    equippedCrystals: { ...clean.equippedCrystals },
                    lastHealingStationName: clean.lastAttunedHealingStation?.name || 'Meteor Bio-Pod',
                    playerGender: clean.playerGender || 'male'
                };
            }

            // Legacy Save Format (Sprint 1-16)
            if (parsed && parsed.party && Array.isArray(parsed.party)) {
                const clean = this.validateAndRepairState(parsed);

                let totalFrags = 0;
                for (const sp in clean.soulCrystals) {
                    totalFrags += clean.soulCrystals[sp]?.fragments || 0;
                }
                const soulLvl = GameManager.getSoulLevelFromFragments(totalFrags);

                return {
                    slot,
                    name: clean.party[0]?.name || 'Swift',
                    level: soulLvl,
                    mapId: clean.currentMapId || 'world_map',
                    isLegacy: true,
                    timePlayedSeconds: clean.timePlayedSeconds || 0,
                    totalFragments: totalFrags,
                    maxFragments: 1530,
                    equippedCrystals: { ...clean.equippedCrystals },
                    lastHealingStationName: clean.lastAttunedHealingStation?.name || 'Meteor Bio-Pod',
                    playerGender: clean.playerGender || 'male'
                };
            }
        } catch (e) {
            return {
                slot,
                name: 'CORRUPTED',
                level: 0,
                mapId: 'PARSE_ERROR',
                isTampered: true,
                timestamp: Date.now()
            };
        }
        return null;
    }

    public deleteSaveSlotWithConfirmation(slot: number, confirmationWord: string): boolean {
        if (!confirmationWord || typeof confirmationWord !== 'string') return false;
        const normalized = confirmationWord.trim().toUpperCase();
        if (normalized !== 'DELETE' && normalized !== 'CONFIRM') {
            console.warn(`[SaveSystem] Deletion rejected: invalid confirmation token '${confirmationWord}'. Must be 'DELETE' or 'CONFIRM'.`);
            return false;
        }

        try {
            if (typeof localStorage !== 'undefined') {
                const saveKey = 'swiftsouls_save_' + slot;
                if (!localStorage.getItem(saveKey)) {
                    return false;
                }
                localStorage.removeItem(saveKey);
                localStorage.removeItem('swiftsouls_cloud_save_' + slot);
            }
            console.info(`[SaveSystem] Save slot ${slot} permanently erased upon verified confirmation.`);
            return true;
        } catch (e) {
            console.error(`[SaveSystem] Failed to delete save slot ${slot}:`, e);
            return false;
        }
    }

    public hasAnySave(): boolean {
        for (let i = 1; i <= 16; i++) {
            if (localStorage.getItem('swiftsouls_save_' + i)) {
                return true;
            }
        }
        return false;
    }

    public ensureDemoSaves(force: boolean = false): void {
        try {
            if (typeof localStorage === 'undefined') return;
            if (!force && this.hasAnySave()) return;

            const now = Date.now();

            // Slot 1: Mid-game Hero with Phoenix Pet Companion
            const slot1State: GameState = {
                party: [{
                    name: 'Swift',
                    level: 2,
                    hp: 85,
                    maxHp: 85,
                    sp: 45,
                    maxSp: 45,
                    strength: 22,
                    defense: 16,
                    agility: 18,
                    magic: 24,
                    magicDefense: 16,
                    accuracy: 95,
                    evasion: 8,
                    critChance: 12,
                    critDamage: 1.6,
                    luck: 25,
                    physicalPenetration: 10,
                    magicPenetration: 15,
                    spCostReduction: 10
                }],
                inventory: [
                    { itemId: 'potion_hp', quantity: 5 },
                    { itemId: 'potion_sp', quantity: 3 }
                ],
                quests: { 'main_quest_1': 'completed', 'main_quest_2': 'active' },
                currentScene: 'OverworldScene',
                currentMapId: 'town_sylvan_grove',
                spawnPoint: { x: 10 * 64, y: 10 * 64 },
                playerGridX: 10,
                playerGridY: 10,
                soulCrystals: {
                    goblin: { fragments: 80, isExtinct: false },
                    snake: { fragments: 50, isExtinct: false },
                    slime: { fragments: 60, isExtinct: false },
                    bat: { fragments: 40, isExtinct: false },
                    phoenix: { fragments: 120, isExtinct: false }
                },
                equippedCrystals: {
                    sword: 'phoenix',
                    shield: 'slime',
                    armor: 'snake',
                    helmet: 'goblin',
                    ring1: 'phoenix',
                    ring2: 'bat',
                    amulet: 'snake',
                    earrings: 'phoenix'
                },
                hasUnlockedEarrings: true,
                timePlayedSeconds: 5240,
                lastAttunedHealingStation: {
                    stationId: 'station_forest',
                    name: 'Whispering Leyline Spire',
                    mapId: 'town_sylvan_grove',
                    x: 10 * 64 + 32,
                    y: 10 * 64 + 32
                },
                petCompanion: {
                    speciesId: 'phoenix',
                    name: 'Pyre Fledgling',
                    level: 5,
                    hp: 85,
                    maxHp: 85,
                    sp: 45,
                    maxSp: 45,
                    isDefeated: false,
                    signatureSkill: {
                        id: 'healing_ember',
                        name: 'Healing Ember',
                        type: 'heal',
                        element: 'fire',
                        spCost: 12,
                        power: 45,
                        description: 'Restores 45 HP to ally enveloped in pyre warmth.'
                    },
                    augmentation: {
                        secondarySpeciesId: 'goblin',
                        name: 'Solar Fervor Catalyst',
                        traitName: 'Solar Fervor',
                        description: 'Companion gains +15% Attack and Solar Aura',
                        bonusHpPercent: 10,
                        bonusAttackPercent: 15,
                        bonusDefensePercent: 10,
                        secondaryElement: 'earth',
                        auraEffect: 'golden_glow'
                    }
                }
            };

            // Slot 2: Mid-game Hero "Melodie" with Viperling Pet
            const slot2State: GameState = {
                party: [{
                    name: 'Melodie',
                    level: 3,
                    hp: 150,
                    maxHp: 150,
                    sp: 75,
                    maxSp: 75,
                    strength: 38,
                    defense: 32,
                    agility: 34,
                    magic: 46,
                    magicDefense: 36,
                    accuracy: 98,
                    evasion: 14,
                    critChance: 18,
                    critDamage: 1.75,
                    luck: 40,
                    physicalPenetration: 20,
                    magicPenetration: 25,
                    spCostReduction: 15
                }],
                inventory: [
                    { itemId: 'potion_hp', quantity: 10 },
                    { itemId: 'potion_sp', quantity: 8 }
                ],
                quests: { 'main_quest_1': 'completed', 'main_quest_2': 'completed', 'main_quest_3': 'active' },
                currentScene: 'OverworldScene',
                currentMapId: 'town_frostpeak',
                spawnPoint: { x: 10 * 64, y: 10 * 64 },
                playerGridX: 10,
                playerGridY: 10,
                soulCrystals: {
                    goblin: { fragments: 150, isExtinct: false },
                    snake: { fragments: 200, isExtinct: false },
                    slime: { fragments: 140, isExtinct: false },
                    bat: { fragments: 130, isExtinct: false },
                    skeleton: { fragments: 130, isExtinct: false }
                },
                equippedCrystals: {
                    sword: 'bat',
                    shield: 'skeleton',
                    armor: 'slime',
                    helmet: 'snake',
                    ring1: 'snake',
                    ring2: 'bat',
                    amulet: 'skeleton',
                    earrings: 'snake'
                },
                hasUnlockedEarrings: true,
                timePlayedSeconds: 14820,
                lastAttunedHealingStation: {
                    stationId: 'station_glacier',
                    name: 'Glacial Cryo-Sanctuary',
                    mapId: 'town_frostpeak',
                    x: 10 * 64 + 32,
                    y: 10 * 64 + 32
                },
                petCompanion: {
                    speciesId: 'snake',
                    name: 'Viperling',
                    level: 9,
                    hp: 140,
                    maxHp: 140,
                    sp: 65,
                    maxSp: 65,
                    isDefeated: false,
                    signatureSkill: {
                        id: 'venom_bite',
                        name: 'Venom Bite',
                        type: 'damage',
                        element: 'poison',
                        spCost: 10,
                        power: 1.5,
                        description: 'Strikes with venomous fangs.'
                    },
                    augmentation: null
                }
            };

            // Slot 3: End-Game Hero "Antigravity" Extinction Master
            const slot3State: GameState = {
                party: [{
                    name: 'Antigravity',
                    level: 5,
                    hp: 300,
                    maxHp: 300,
                    sp: 150,
                    maxSp: 150,
                    strength: 85,
                    defense: 75,
                    agility: 80,
                    magic: 95,
                    magicDefense: 80,
                    accuracy: 100,
                    evasion: 25,
                    critChance: 30,
                    critDamage: 2.2,
                    luck: 65,
                    physicalPenetration: 40,
                    magicPenetration: 50,
                    spCostReduction: 25
                }],
                inventory: [
                    { itemId: 'potion_hp', quantity: 99 },
                    { itemId: 'potion_sp', quantity: 99 }
                ],
                quests: { 'main_quest_1': 'completed', 'main_quest_2': 'completed', 'main_quest_3': 'completed' },
                currentScene: 'OverworldScene',
                currentMapId: 'castle_interior',
                spawnPoint: { x: 14 * 64, y: 6 * 64 },
                playerGridX: 14,
                playerGridY: 6,
                soulCrystals: {
                    goblin: { fragments: 300, isExtinct: true },
                    snake: { fragments: 300, isExtinct: true },
                    slime: { fragments: 300, isExtinct: true },
                    bat: { fragments: 250, isExtinct: true },
                    skeleton: { fragments: 300, isExtinct: true }
                },
                equippedCrystals: {
                    sword: 'phoenix',
                    shield: 'skeleton',
                    armor: 'slime',
                    helmet: 'phoenix',
                    ring1: 'bat',
                    ring2: 'phoenix',
                    amulet: 'snake',
                    earrings: 'bat'
                },
                hasUnlockedEarrings: true,
                extinctionEventTriggered: true,
                finalBossUnlocked: true,
                bossMelds: ['phoenix', 'skeleton'],
                dualSocketUnlocked: {
                    sword: true,
                    shield: true,
                    armor: true,
                    helmet: true,
                    ring1: true,
                    ring2: true,
                    amulet: true,
                    earrings: false
                },
                timePlayedSeconds: 32400,
                lastAttunedHealingStation: {
                    stationId: 'station_castle',
                    name: 'Sovereign Soul Altar',
                    mapId: 'castle_interior',
                    x: 14 * 64 + 32,
                    y: 6 * 64 + 32
                },
                petCompanion: {
                    speciesId: 'bat',
                    name: 'Nightwing Bat',
                    level: 11,
                    hp: 210,
                    maxHp: 210,
                    sp: 90,
                    maxSp: 90,
                    isDefeated: false,
                    signatureSkill: {
                        id: 'sonic_screech',
                        name: 'Sonic Screech',
                        type: 'damage',
                        element: 'dark',
                        spCost: 8,
                        power: 1.8,
                        description: 'Emits a piercing dark ultrasonic wave.'
                    },
                    augmentation: null
                }
            };

            const seedSlot = (slot: number, st: GameState) => {
                const clean = this.validateAndRepairState(st);
                const serialized = JSON.stringify(clean);
                const timestamp = now - (slot * 3600000);
                const signature = CryptoChecksum.signSavePayload(slot, timestamp, serialized);
                const envelope: SaveEnvelope = {
                    version: 2,
                    slot,
                    timestamp,
                    signature,
                    payload: serialized
                };
                localStorage.setItem('swiftsouls_save_' + slot, JSON.stringify(envelope));
            };

            seedSlot(1, slot1State);
            seedSlot(2, slot2State);
            seedSlot(3, slot3State);
            console.info('[SaveSystem] Demo save profiles seeded for Slots 1, 2, and 3.');
        } catch (e) {
            console.warn('[SaveSystem] Unable to seed demo saves:', e);
        }
    }

    public saveGame(): boolean {
        try {
            // Client-side Rate Limiting: Max 3 saves per second
            const now = Date.now();
            this.saveTimestamps = this.saveTimestamps.filter(t => now - t < 1000);
            if (this.saveTimestamps.length >= 3) {
                console.warn('Save operation throttled: rate limit exceeded (max 3 saves/sec).');
                return false;
            }
            this.saveTimestamps.push(now);

            this.state = this.validateAndRepairState(this.state);
            const serialized = JSON.stringify(this.state);
            
            // Safety limit check: Reject save if payload is excessively large (e.g. > 5MB)
            if (serialized.length > 5 * 1024 * 1024) {
                console.error('Save state verification failed: File size exceeds the 5MB safety limit.');
                return false;
            }

            const timestamp = now;
            const slot = this.currentSaveSlot;
            const signature = CryptoChecksum.signSavePayload(slot, timestamp, serialized);

            const envelope: SaveEnvelope = {
                version: 2,
                slot,
                timestamp,
                signature,
                payload: serialized
            };
            
            localStorage.setItem('swiftsouls_save_' + slot, JSON.stringify(envelope));

            // Asynchronously dispatch remote cloud synchronization (non-blocking)
            CloudSyncClient.instance.uploadSave(slot, envelope).catch(err => {
                console.warn('[CloudSync] Background upload failed:', err);
            });

            // Sprint 21: Check and trigger 24-hour automated rolling backup snapshot
            LiveOpsManager.instance.checkAndRunDailyBackup();

            // Record active user telemetry in LiveOps registry
            LiveOpsManager.instance.recordUserActivity(
                UserAuthManager.instance.getProfile(),
                LicenseManager.instance.getTier(),
                this.state.party[0]?.level || 1
            );

            return true;
        } catch (e) {
            console.error('Failed to save game state to localStorage:', e);
            return false;
        }
    }

    public exportSavePayload(): string | null {
        try {
            // Client-side Rate Limiting: Max 3 saves per second
            const now = Date.now();
            this.saveTimestamps = this.saveTimestamps.filter(t => now - t < 1000);
            if (this.saveTimestamps.length >= 3) {
                console.warn('Export operation throttled: rate limit exceeded (max 3 saves/sec).');
                return null;
            }
            this.saveTimestamps.push(now);

            const cleanState = this.validateAndRepairState(this.state);
            const payload = JSON.stringify(cleanState);
            
            // Enforce maximum 5MB size limit to protect cloud databases and prevent abuse
            if (payload.length > 5 * 1024 * 1024) {
                console.warn('Export rejected: Save state payload size exceeds 5MB limit.');
                return null;
            }

            const timestamp = now;
            const slot = this.currentSaveSlot;
            const signature = CryptoChecksum.signSavePayload(slot, timestamp, payload);

            const envelope: SaveEnvelope = {
                version: 2,
                slot,
                timestamp,
                signature,
                payload
            };
            
            return JSON.stringify(envelope);
        } catch (e) {
            console.error('Failed to export save state payload:', e);
            return null;
        }
    }

    public importSavePayload(rawString: string, slot?: number): { success: boolean; error?: string } {
        try {
            if (!rawString || typeof rawString !== 'string') {
                return { success: false, error: 'Empty or invalid payload string.' };
            }
            if (rawString.length > 5 * 1024 * 1024) {
                return { success: false, error: 'Import payload exceeds 5MB limit.' };
            }

            const targetSlot = slot !== undefined ? slot : this.currentSaveSlot;
            const parsed = JSON.parse(rawString);

            if (parsed && parsed.version === 2 && typeof parsed.signature === 'string' && typeof parsed.payload === 'string') {
                const isValid = CryptoChecksum.verifySignature(parsed.slot, parsed.timestamp, parsed.payload, parsed.signature);
                if (!isValid) {
                    return { success: false, error: 'Cryptographic signature verification failed (Tamper detected).' };
                }
                const parsedState = JSON.parse(parsed.payload);
                const cleanState = this.validateAndRepairState(parsedState);
                
                // Re-sign for the target slot if slot was explicitly overridden
                const timestamp = Date.now();
                const payloadStr = JSON.stringify(cleanState);
                const reSignedSignature = CryptoChecksum.signSavePayload(targetSlot, timestamp, payloadStr);
                const newEnvelope: SaveEnvelope = {
                    version: 2,
                    slot: targetSlot,
                    timestamp,
                    signature: reSignedSignature,
                    payload: payloadStr
                };

                localStorage.setItem('swiftsouls_save_' + targetSlot, JSON.stringify(newEnvelope));
                return { success: true };
            } else if (parsed && parsed.party && Array.isArray(parsed.party)) {
                // Legacy un-signed import
                const cleanState = this.validateAndRepairState(parsed);
                const timestamp = Date.now();
                const payloadStr = JSON.stringify(cleanState);
                const signature = CryptoChecksum.signSavePayload(targetSlot, timestamp, payloadStr);
                const newEnvelope: SaveEnvelope = {
                    version: 2,
                    slot: targetSlot,
                    timestamp,
                    signature,
                    payload: payloadStr
                };
                localStorage.setItem('swiftsouls_save_' + targetSlot, JSON.stringify(newEnvelope));
                return { success: true };
            } else {
                return { success: false, error: 'Unrecognized save format.' };
            }
        } catch (e: any) {
            return { success: false, error: `Import parsing error: ${e?.message || e}` };
        }
    }

    public loadGame(slot?: number, allowBackupFallback: boolean = true): boolean {
        try {
            const targetSlot = slot !== undefined ? slot : this.currentSaveSlot;
            const saved = localStorage.getItem('swiftsouls_save_' + targetSlot);
            if (!saved) {
                return false;
            }

            let parsed: any;
            try {
                parsed = JSON.parse(saved);
            } catch (jsonErr) {
                console.warn(`[SaveSystem] JSON parse error in slot ${targetSlot}. Attempting fallback to local backup...`);
                if (allowBackupFallback) {
                    return this.tryRecoverFromBackup(targetSlot);
                }
                return false;
            }

            // 1. Version 2 Checksummed Save Envelope
            if (parsed && parsed.version === 2 && typeof parsed.signature === 'string' && typeof parsed.payload === 'string') {
                const isValid = CryptoChecksum.verifySignature(parsed.slot, parsed.timestamp, parsed.payload, parsed.signature);
                if (!isValid) {
                    console.error(`[SECURITY ALERT] Save slot ${targetSlot} integrity check failed! Signature mismatch (Tampering or corruption detected). Attempting local backup recovery.`);
                    if (allowBackupFallback) {
                        return this.tryRecoverFromBackup(targetSlot);
                    }
                    return false;
                }

                // Verify slot alignment to prevent cross-slot replay attacks
                if (parsed.slot !== targetSlot) {
                    console.error(`[SECURITY ALERT] Save slot mismatch! Envelope indicates slot ${parsed.slot}, but attempted load from slot ${targetSlot}. Attempting local backup recovery.`);
                    if (allowBackupFallback) {
                        return this.tryRecoverFromBackup(targetSlot);
                    }
                    return false;
                }

                const parsedState = JSON.parse(parsed.payload);
                this.state = this.validateAndRepairState(parsedState);
                if (slot !== undefined) {
                    this.currentSaveSlot = slot;
                }
                LicenseManager.instance.checkPremiumVaultBonding();
                LiveOpsManager.instance.recordUserActivity(
                    UserAuthManager.instance.getProfile(),
                    LicenseManager.instance.getTier(),
                    this.state.party[0]?.level || 1
                );
                return true;
            }

            // 2. Legacy Sprint 1-16 Raw Save Format (Transparent Migration)
            if (parsed && parsed.party && Array.isArray(parsed.party)) {
                console.info(`[SaveSystem] Legacy save detected in slot ${targetSlot}. Validating and upgrading to cryptographic envelope.`);
                this.state = this.validateAndRepairState(parsed);
                if (slot !== undefined) {
                    this.currentSaveSlot = slot;
                }
                // Upgrade storage entry to signed Version 2 envelope immediately
                this.saveGame();
                return true;
            }

            console.error(`[SaveSystem] Corrupted or unrecognized save format in slot ${targetSlot}. Attempting local backup recovery.`);
            if (allowBackupFallback) {
                return this.tryRecoverFromBackup(targetSlot);
            }
            return false;
        } catch (e) {
            console.error('Failed to load game state from localStorage:', e);
            if (allowBackupFallback) {
                return this.tryRecoverFromBackup(slot !== undefined ? slot : this.currentSaveSlot);
            }
            return false;
        }
    }

    private tryRecoverFromBackup(targetSlot: number): boolean {
        try {
            if (typeof localStorage === 'undefined') return false;
            const backups = LiveOpsManager.instance.getBackupsList();
            if (!backups || backups.length === 0) {
                console.warn('[SaveSystem] No local backup snapshots available for recovery.');
                return false;
            }

            // Iterate over backups from newest to oldest
            for (const b of backups) {
                const bundle = localStorage.getItem(b.key);
                if (!bundle) continue;
                try {
                    const parsedBundle = JSON.parse(bundle);
                    const savedSlotRaw = parsedBundle?.items?.['swiftsouls_save_' + targetSlot];
                    if (savedSlotRaw) {
                        const parsedEnv = JSON.parse(savedSlotRaw);
                        if (parsedEnv && parsedEnv.payload) {
                            const valid = CryptoChecksum.verifySignature(parsedEnv.slot, parsedEnv.timestamp, parsedEnv.payload, parsedEnv.signature);
                            if (valid) {
                                console.info(`[SaveSystem] 🔄 Successfully recovered corrupted slot ${targetSlot} from local backup snapshot ${b.key}.`);
                                localStorage.setItem('swiftsouls_save_' + targetSlot, savedSlotRaw);
                                return this.loadGame(targetSlot, false);
                            }
                        }
                    }
                } catch {
                    // Try next backup snapshot
                }
            }
            return false;
        } catch (err) {
            console.error('[SaveSystem] Local backup recovery attempt encountered error:', err);
            return false;
        }
    }

    public getSaveEnvelope(slot: number): SaveEnvelope | null {
        try {
            const raw = localStorage.getItem('swiftsouls_save_' + slot);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.version === 2 && typeof parsed.signature === 'string' && typeof parsed.payload === 'string') {
                return parsed as SaveEnvelope;
            }
            return null;
        } catch {
            return null;
        }
    }

    public async syncWithCloud(slot?: number): Promise<SyncResult> {
        const targetSlot = slot !== undefined ? slot : this.currentSaveSlot;
        const localEnvelope = this.getSaveEnvelope(targetSlot);
        const result = await CloudSyncClient.instance.syncSlot(targetSlot, localEnvelope);

        if (result.success && result.winner && result.action === 'DOWNLOADED') {
            // Adopt winning cloud save into local storage
            localStorage.setItem('swiftsouls_save_' + targetSlot, JSON.stringify(result.winner));
            if (targetSlot === this.currentSaveSlot) {
                const parsedState = JSON.parse(result.winner.payload);
                this.state = this.validateAndRepairState(parsedState);
            }
        }
        return result;
    }

    public resetGame() {
        const defaultHeroName = this.telegramUser?.first_name || 'Swift';
        this.state = {
            party: [
                {
                    name: defaultHeroName,
                    level: 0,
                    hp: 24,
                    maxHp: 24,
                    sp: 8,
                    maxSp: 8,
                    strength: 4,
                    defense: 2,
                    agility: 3,
                    magic: 5,
                    magicDefense: 3,
                    accuracy: 95,
                    evasion: 5,
                    critChance: 5,
                    critDamage: 1.5,
                    luck: 10,
                    physicalPenetration: 0,
                    magicPenetration: 0,
                    spCostReduction: 0
                }
            ],
            inventory: [
                { itemId: 'potion_hp', quantity: 3 },
                { itemId: 'potion_sp', quantity: 1 }
            ],
            quests: {},
            currentScene: 'OverworldScene',
            currentMapId: 'world_map',
            spawnPoint: { x: 2912, y: 2976 },
            soulCrystals: {
                keenkat: { fragments: 0, isExtinct: false },
                goblin: { fragments: 0, isExtinct: false },
                snake: { fragments: 0, isExtinct: false },
                slime: { fragments: 0, isExtinct: false },
                bat: { fragments: 0, isExtinct: false },
                skeleton: { fragments: 0, isExtinct: false },
                phoenix: { fragments: 0, isExtinct: false }
            },
            equippedCrystals: {
                sword: null,
                shield: null,
                armor: null,
                helmet: null,
                ring1: null,
                ring2: null,
                amulet: null,
                earrings: null
            },
            forgeRefinements: {
                sword: 0,
                shield: 0,
                armor: 0,
                helmet: 0,
                ring1: 0,
                ring2: 0,
                amulet: 0,
                earrings: 0
            },
            bossMelds: [],
            hasUnlockedEarrings: false,
            dualSocketUnlocked: {
                sword: false,
                shield: false,
                armor: false,
                helmet: false,
                ring1: false,
                ring2: false,
                amulet: false,
                earrings: false
            },
            secondaryEquippedCrystals: {
                sword: null,
                shield: null,
                armor: null,
                helmet: null,
                ring1: null,
                ring2: null,
                amulet: null,
                earrings: null
            },
            achievements: {},
            extinctionEventTriggered: false,
            finalBossUnlocked: false,
            timePlayedSeconds: 0,
            lastAttunedHealingStation: {
                stationId: 'station_meteor_pod',
                name: 'Meteor Bio-Pod',
                mapId: 'meteor_pod',
                x: 9 * 64 + 32,
                y: 4 * 64 + 32
            },
            petCompanion: null,
            // Sprint 28: Gender defaults to 'male' (Valen Swift); overwritten by TitleScene after gender selection
            playerGender: 'male'
        };
        this.saveGame();
    }

    public getPetCompanion(): PetCompanionState | null {
        return this.state.petCompanion || null;
    }

    public setPetCompanionHp(hp: number): void {
        if (this.state.petCompanion) {
            this.state.petCompanion.hp = Math.max(0, Math.min(this.state.petCompanion.maxHp, Math.trunc(hp)));
            if (this.state.petCompanion.hp <= 0) {
                this.state.petCompanion.isDefeated = true;
            }
        }
    }

    public setPetCompanionSp(sp: number): void {
        if (this.state.petCompanion) {
            this.state.petCompanion.sp = Math.max(0, Math.min(this.state.petCompanion.maxSp, Math.trunc(sp)));
        }
    }

    public revivePetCompanion(): boolean {
        if (!this.state.petCompanion) return false;
        this.state.petCompanion.hp = this.state.petCompanion.maxHp;
        this.state.petCompanion.sp = this.state.petCompanion.maxSp;
        this.state.petCompanion.isDefeated = false;
        return true;
    }

    public handlePlayerDeath() {
        if (this.state.party && this.state.party[0]) {
            const calculated = this.getHeroCalculatedStats();
            this.state.party[0].hp = calculated.maxHp;
            this.state.party[0].sp = calculated.maxSp;
        }

        if (this.state.petCompanion) {
            this.state.petCompanion.hp = this.state.petCompanion.maxHp;
            this.state.petCompanion.sp = this.state.petCompanion.maxSp;
            this.state.petCompanion.isDefeated = false;
        }

        // Respawn player back at last attuned healing station, or fallback to meteor pod
        if (this.state.lastAttunedHealingStation) {
            this.state.currentScene = 'OverworldScene';
            this.state.currentMapId = this.state.lastAttunedHealingStation.mapId;
            this.state.spawnPoint = {
                x: this.state.lastAttunedHealingStation.x,
                y: this.state.lastAttunedHealingStation.y
            };
            this.state.playerGridX = Math.floor(this.state.lastAttunedHealingStation.x / 64);
            this.state.playerGridY = Math.floor(this.state.lastAttunedHealingStation.y / 64);
        } else {
            this.state.currentScene = 'OverworldScene';
            this.state.currentMapId = 'world_map';
            this.state.spawnPoint = { x: 45 * 64 + 32, y: 46 * 64 + 32 };
            this.state.playerGridX = 45;
            this.state.playerGridY = 46;
        }
        
        this.saveGame();
    }
}
