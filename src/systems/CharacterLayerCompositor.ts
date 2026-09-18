/**
 * CharacterLayerCompositor: Pure TypeScript visual layering engine for Project SwiftSouls.
 * 
 * Enforces:
 * 1. Modular sprite compositing order: Cape -> Base Body -> Armor -> Circlet/Headwear -> Shield -> Weapon -> Aura.
 * 2. Strict Headwear Constraint: Helmets are strictly constrained to circlets, tiaras, coronets, and browbands
 *    to preserve Melodie Swift's hand-drawn hair and face art silhouette. Enclosed full-face helms are rejected.
 * 3. 4-Frame Flowing Cape Animation: Retro breeze animation with distinct idle vs walking wave speeds.
 * 4. Elemental Infusion Color Tints: Maps monster essence affinities to gear layer visual tints.
 * 5. Melodie Swift 8-Slot Artwork Catalog: Official registry of hand-drawn art cards and inspectable variants.
 */

import type { EquipmentSlot } from './GameManager';

export type CharacterLayerType = 'cape' | 'base' | 'armor' | 'helmet' | 'shield' | 'sword' | 'aura';

export interface LayerDescriptor {
    type: CharacterLayerType;
    assetKey: string;
    depthOffset: number;
    tint: number;
    alpha: number;
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    originX?: number;
    originY?: number;
    rotation?: number;
    flipWithPlayer: boolean;
    description: string;
}

export interface ArtworkVariant {
    id: string;
    assetKey: string;
    name: string;
    description: string;
    artistLore: string;
    element?: string;
    statBonus?: string;
}

export interface SlotArtworkData {
    slot: EquipmentSlot;
    slotTitle: string;
    variants: ArtworkVariant[];
}

/**
 * Permitted headwear keywords preserving Melodie's hair silhouette.
 * Enclosed helms (e.g., 'visor', 'full_helm', 'bucket', 'bascinet', 'kabuto') are strictly forbidden.
 */
export const ALLOWED_HEADWEAR_PREFIXES = ['circlet', 'tiara', 'coronet', 'browband', 'diadem', 'crown'];
export const FORBIDDEN_HEADWEAR_PATTERNS = ['full_helm', 'visor', 'closed_helm', 'bucket_helm', 'faceless'];

/**
 * Elemental infusion color palettes (Hex values)
 */
export const INFUSION_TINTS: Record<string, number> = {
    fire: 0xff5533,      // Blazing Crimson / Ember Amber
    water: 0x33ccff,     // Azure Flow / Pure Water
    poison: 0x33ee66,    // Serpentine Jade / Toxic Mending
    dark: 0xaa44ff,      // Void Violet / Nightwing Shadow
    cold: 0x99ffff,      // Glacial Pale Cyan / Permafrost
    earth: 0xddaa44,     // Terra Bronze / Golem Umber
    physical: 0xeeeeee,  // Polished Steel / Mythril
    default: 0xffffff    // Pristine Uninfused Neutral
};

/**
 * Official Melodie Swift Hand-Drawn 8-Slot Artwork Catalog
 */
export const MELODIE_ARTWORK_CATALOG: Record<EquipmentSlot, SlotArtworkData> = {
    sword: {
        slot: 'sword',
        slotTitle: 'Weapon (Blade)',
        variants: [
            {
                id: 'sword_winged',
                assetKey: 'sword_winged',
                name: 'Winged Demonic Greatsword',
                description: 'Bat-wing crossguard forged from abyssal meteorite ore.',
                artistLore: 'Hand-drawn by Melodie Swift (age 13) in colored pencil and ink for the crater prologue.',
                element: 'dark',
                statBonus: '+12 Attack Power, +15% Crit Damage'
            },
            {
                id: 'sword_silver',
                assetKey: 'sword_silver',
                name: "Silver Knight's Blade",
                description: 'Polished royal silver broadsword inset with an azure sapphire fuller.',
                artistLore: 'Melodie designed this sword for the royal guard stationed at the capital gates.',
                element: 'physical',
                statBonus: '+8 Attack Power, +5% Accuracy'
            },
            {
                id: 'sword_bronze',
                assetKey: 'sword_bronze',
                name: 'Bronze Adventurer Blade',
                description: 'Rugged bronze broadsword carried on the initial meteor expedition.',
                artistLore: 'The very first weapon sketch Melodie made in her game design notebook.',
                element: 'physical',
                statBonus: '+4 Attack Power'
            },
            {
                id: 'sword_flame',
                assetKey: 'sword_flame',
                name: 'Pyre Flamebrand',
                description: 'Blazing edge engulfed in eternal phoenix embers.',
                artistLore: 'Created by Melodie to celebrate the player bonding with the Pyre Fledgling companion.',
                element: 'fire',
                statBonus: '+14 Attack Power, Fire Elemental Damage'
            },
            {
                id: 'sword_frost',
                assetKey: 'sword_frost',
                name: 'Glacial Rime Blade',
                description: 'Carved from deep glacial ice that never melts.',
                artistLore: 'Sketched by Melodie during a winter snow day while designing the frost peaks.',
                element: 'cold',
                statBonus: '+10 Attack Power, +15 Magic Power'
            }
        ]
    },
    shield: {
        slot: 'shield',
        slotTitle: 'Off-Hand (Shield)',
        variants: [
            {
                id: 'shield_silver',
                assetKey: 'shield_silver',
                name: "Knight's Silver Heater Shield",
                description: 'Polished silver kite shield bearing the royal leylines crest.',
                artistLore: 'Drawn by Melodie to provide an elegant counterpoint to the silver knight sword.',
                element: 'physical',
                statBonus: '+8 Defense, +5 Magic Defense'
            },
            {
                id: 'shield_winged',
                assetKey: 'shield_winged',
                name: 'Aegis of the Astral Wing',
                description: 'Demonic wing-plated shield that deflects incoming soul projectiles.',
                artistLore: 'Matches the winged demonic greatsword motif, sketched with sweeping wing ridges.',
                element: 'dark',
                statBonus: '+12 Defense, +10% Dark Resistance'
            },
            {
                id: 'shield_bronze',
                assetKey: 'shield_bronze',
                name: 'Sturdy Bronze Buckler',
                description: 'Heavy bronze round shield with a reinforced central iron boss.',
                artistLore: 'Simple, rugged starter gear drawn with Melodie’s distinctive circular rivets.',
                element: 'physical',
                statBonus: '+4 Defense, +3% Evasion'
            },
            {
                id: 'shield_frost',
                assetKey: 'shield_frost',
                name: 'Glacial Bulwark',
                description: 'Hexagonal ice plate humming with protective cryo-energy.',
                artistLore: 'Drawn with crystalline facets that sparkle under torchlight.',
                element: 'cold',
                statBonus: '+10 Defense, +25% Cold Resistance'
            },
            {
                id: 'shield_fire',
                assetKey: 'shield_fire',
                name: 'Magma Barricade',
                description: 'Basalt shield carved with glowing volcanic fissure veins.',
                artistLore: 'Inspired by Hawaiian lava rocks that Melodie saw in her science class.',
                element: 'fire',
                statBonus: '+11 Defense, +25% Fire Resistance'
            }
        ]
    },
    armor: {
        slot: 'armor',
        slotTitle: 'Body Armor',
        variants: [
            {
                id: 'armor_royal_plate',
                assetKey: 'armor_royal_plate',
                name: 'Royal Paladin Cuirass',
                description: 'Gilded breastplate with shaped shoulder pauldrons.',
                artistLore: 'Melodie carefully drew this armor to ensure the hero’s blue tunic peaks out cleanly.',
                element: 'physical',
                statBonus: '+14 Defense, +10 Max HP'
            },
            {
                id: 'armor_chainmail',
                assetKey: 'armor_chainmail',
                name: 'Reinforced Mithril Chainmail',
                description: 'Interlocking mithril links that absorb crushing impact.',
                artistLore: 'Detailed ringlet crosshatching drawn by Melodie with fine-tip micro pens.',
                element: 'physical',
                statBonus: '+8 Defense, +5 Agility'
            },
            {
                id: 'armor_leather',
                assetKey: 'armor_leather',
                name: "Adventurer's Leather Jerkin",
                description: 'Supple cured leather vest equipped with brass buckles and belt pouches.',
                artistLore: 'The classic outfit Melodie gave Swift for the initial meteor crash landing.',
                element: 'physical',
                statBonus: '+4 Defense, +8 Evasion'
            },
            {
                id: 'armor_mystic_robe',
                assetKey: 'armor_mystic_robe',
                name: 'Arch-Mage Leyline Weave',
                description: 'Deep violet enchanted robe threads that shimmer with planetary mana.',
                artistLore: 'Flowing wizard vestment drawn with ornate constellation patterns on the hem.',
                element: 'dark',
                statBonus: '+6 Defense, +20 Max SP, +15 Magic'
            }
        ]
    },
    helmet: {
        slot: 'helmet',
        slotTitle: 'Headwear (Circlets Only)',
        variants: [
            {
                id: 'helmet_circlet_silver',
                assetKey: 'helmet_circlet_silver',
                name: 'Silver Browband',
                description: 'Delicate polished silver band that rests across the forehead.',
                artistLore: 'Created under Golden Rule #2: leaves the protagonist’s hair silhouette 100% visible.',
                element: 'physical',
                statBonus: '+4 Magic Defense, +10 Accuracy'
            },
            {
                id: 'helmet_tiara_gold',
                assetKey: 'helmet_tiara_gold',
                name: 'Jeweled Golden Tiara',
                description: 'Gilded tiara with a central emerald gemstone focusing psychic clarity.',
                artistLore: 'A royal headpiece drawn by Melodie with leaf filigree wrapping around the temples.',
                element: 'poison',
                statBonus: '+6 Magic Defense, +15 Max SP'
            },
            {
                id: 'helmet_coronet_star',
                assetKey: 'helmet_coronet_star',
                name: 'Astral Coronet',
                description: 'Cosmic starburst circlet forged from iridescent meteorite metal.',
                artistLore: 'Melodie gave this circlet five tiny pointed stars that pulsate with starlight.',
                element: 'dark',
                statBonus: '+8 Magic Defense, +10 Luck, +5% Crit'
            },
            {
                id: 'helmet_crown_flame',
                assetKey: 'helmet_crown_flame',
                name: 'Solar Fire Circlet',
                description: 'Ruby browband adorned with rising phoenix feather arches.',
                artistLore: 'Designed to harmonize with the Pyre Fledgling pet and flame sword.',
                element: 'fire',
                statBonus: '+6 Defense, +8 Magic Defense, +10 Magic'
            },
            {
                id: 'helmet_diadem_frost',
                assetKey: 'helmet_diadem_frost',
                name: 'Glacial Diadem',
                description: 'Platinum band crowned with three upright permafrost crystal shards.',
                artistLore: 'Melodie’s favorite headwear design, drawn with sharp crystalline facets.',
                element: 'cold',
                statBonus: '+8 Defense, +8 Magic Defense, +10 Agility'
            }
        ]
    },
    ring1: {
        slot: 'ring1',
        slotTitle: 'Ring 1 (Active Spell)',
        variants: [
            {
                id: 'ring_ruby',
                assetKey: 'ring_ruby',
                name: 'Flame Ruby Signet',
                description: 'Heavy gold signet ring mounting a glowing ruby cut in the shape of an ember.',
                artistLore: 'Drawn by Melodie with radiant facet lines to signify active spell channeling.',
                element: 'fire',
                statBonus: 'Enables Active Spell: Fireball'
            },
            {
                id: 'ring_sapphire',
                assetKey: 'ring_sapphire',
                name: 'Frost Sapphire Band',
                description: 'Intertwined silver filigree ring holding a pale blue chilled jewel.',
                artistLore: 'Melodie sketched this ring with tiny snowflakes etched into the silver shank.',
                element: 'cold',
                statBonus: 'Enables Active Spell: Frost Lance'
            },
            {
                id: 'ring_amethyst',
                assetKey: 'ring_amethyst',
                name: 'Void Amethyst Signet',
                description: 'Black iron band with a swirling purple dark-matter cabochon.',
                artistLore: 'Drawn to represent the shadowy powers harvested from vampire bats.',
                element: 'dark',
                statBonus: 'Enables Active Spell: Drain Bite'
            }
        ]
    },
    ring2: {
        slot: 'ring2',
        slotTitle: 'Ring 2 (Active Spell)',
        variants: [
            {
                id: 'ring_emerald',
                assetKey: 'ring_emerald',
                name: 'Venom Emerald Loop',
                description: 'Carved jade serpent coiled around the finger biting its own tail.',
                artistLore: 'An Ouroboros ring drawn by Melodie during Greek mythology week in history class.',
                element: 'poison',
                statBonus: 'Enables Active Spell: Heal'
            },
            {
                id: 'ring_topaz',
                assetKey: 'ring_topaz',
                name: 'Thunder Topaz Ring',
                description: 'Electrum band with an amber topaz that crackles with static charge.',
                artistLore: 'Drawn with jagged lightning prong settings holding the stone securely.',
                element: 'earth',
                statBonus: 'Enables Active Spell: Bone Toss'
            }
        ]
    },
    amulet: {
        slot: 'amulet',
        slotTitle: 'Amulet (Major Spell)',
        variants: [
            {
                id: 'amulet_meteor_pendant',
                assetKey: 'amulet_meteor_pendant',
                name: 'Starfall Core Pendant',
                description: 'Fragment of the glowing cosmic meteorite wrapped in spiraling silver wire.',
                artistLore: 'The signature amulet recovered from the crash site, drawn with celestial speckles.',
                element: 'dark',
                statBonus: 'Enables Major Spell: Greater Heal'
            },
            {
                id: 'amulet_phoenix_tear',
                assetKey: 'amulet_phoenix_tear',
                name: 'Phoenix Locket',
                description: 'Heart-shaped brass talisman containing glowing teardrop essence of rebirth.',
                artistLore: 'Melodie drew this locket with warm orange gradients and tiny embossed wings.',
                element: 'fire',
                statBonus: 'Enables Major Spell: Phoenix Flare'
            },
            {
                id: 'amulet_dragon_eye',
                assetKey: 'amulet_dragon_eye',
                name: 'Dragon Eye Talisman',
                description: 'Amber stone displaying a serpentine slit pupil that blinks when danger approaches.',
                artistLore: 'A spooky relic Melodie sketched for high-level dungeon rewards.',
                element: 'earth',
                statBonus: 'Enables Major Spell: Bone Storm'
            }
        ]
    },
    earrings: {
        slot: 'earrings',
        slotTitle: 'Earrings (Pet Companion Conduit)',
        variants: [
            {
                id: 'earrings_astral_pair',
                assetKey: 'earrings_astral_pair',
                name: 'Astral Ear-Cuffs',
                description: 'Pair of winged silver ear-cuffs with dangling sapphire star motes.',
                artistLore: 'The recovered 8th relic from the crater rim boss! Acts as conduit for the pet companion.',
                element: 'dark',
                statBonus: 'Summons & Links Overworld/Battle Pet Companion'
            },
            {
                id: 'earrings_whisper_bead',
                assetKey: 'earrings_whisper_bead',
                name: 'Verdant Drop Earrings',
                description: 'Twin emerald drops that hum with harmonic forest beast communication.',
                artistLore: 'Drawn by Melodie to enhance companion vitality and verdant regeneration.',
                element: 'poison',
                statBonus: 'Pet HP +20%, Verdant Mending Catalyst'
            },
            {
                id: 'earrings_sunstone',
                assetKey: 'earrings_sunstone',
                name: 'Sunburst Studs',
                description: 'Radiant gold sunburst studs that ignite companion offensive prowess.',
                artistLore: 'Warm solar earrings drawn with golden spikes radiating from an amber core.',
                element: 'fire',
                statBonus: 'Pet Attack +15%, Solar Radiance Catalyst'
            }
        ]
    }
};

/**
 * CharacterLayerCompositor core calculation and verification functions.
 */
export class CharacterLayerCompositor {
    /**
     * Enforces Golden Rule #2: Headwear items MUST be circlets, tiaras, coronets, or browbands.
     * Enclosed helmets that obscure hair or face are strictly rejected.
     */
    public static isCircletOrTiara(assetKey: string): boolean {
        if (!assetKey || typeof assetKey !== 'string') return false;
        const normalized = assetKey.toLowerCase().trim();

        // Check if explicitly forbidden pattern exists
        for (const forbidden of FORBIDDEN_HEADWEAR_PATTERNS) {
            if (normalized.includes(forbidden)) return false;
        }

        // Check if valid circlet/tiara prefix or keyword exists
        for (const allowed of ALLOWED_HEADWEAR_PREFIXES) {
            if (normalized.includes(allowed)) return true;
        }

        return false;
    }

    /**
     * Validates headwear asset constraint and returns a sanitized, legal circlet asset key.
     * If an illegal full-face helmet is supplied, it falls back to 'helmet_circlet_silver'.
     */
    public static validateAndSanitizeHeadwear(assetKey: string | null | undefined): string {
        if (!assetKey) return 'helmet_circlet_silver';
        if (this.isCircletOrTiara(assetKey)) {
            return assetKey;
        }
        console.warn(`[ArtRuleViolation] Headwear '${assetKey}' violates Melodie's Golden Rule #2 (No enclosed helmets). Replaced with 'helmet_circlet_silver'.`);
        return 'helmet_circlet_silver';
    }

    /**
     * Returns the 4-frame retro breeze cape animation frame index (0, 1, 2, 3)
     * based on elapsed milliseconds and movement status.
     * Walking: faster flutter (110ms per frame)
     * Idle: gentle breeze (180ms per frame)
     */
    public static getCapeFrame(elapsedMs: number, isMoving: boolean = false): number {
        const frameDuration = isMoving ? 110 : 180;
        const cycle = Math.floor(elapsedMs / frameDuration) % 4;
        return cycle;
    }

    public static readonly SPECIES_AFFINITIES: Record<string, string> = {
        phoenix: 'fire',
        pyre_fledgling: 'fire',
        flame_beast: 'fire',
        water_elemental: 'water',
        aquatic: 'water',
        slime: 'poison',
        serpent: 'poison',
        snake: 'poison',
        bat: 'dark',
        skeleton: 'dark',
        nightwing: 'dark',
        shadow: 'dark',
        abyssal: 'dark',
        frost_elemental: 'cold',
        glacial: 'cold',
        golem: 'earth',
        terra: 'earth',
        goblin: 'physical',
        beast: 'physical'
    };

    /**
     * Calculates the elemental color tint for an equipped essence crystal or affinity name.
     */
    public static getInfusionTint(elementOrSpecies: string | null | undefined): number {
        if (!elementOrSpecies) return INFUSION_TINTS.default;
        const normalized = elementOrSpecies.toLowerCase();
        if (INFUSION_TINTS[normalized]) {
            return INFUSION_TINTS[normalized];
        }
        const affinity = this.SPECIES_AFFINITIES[normalized];
        if (affinity && INFUSION_TINTS[affinity]) {
            return INFUSION_TINTS[affinity];
        }
        return INFUSION_TINTS.default;
    }

    /**
     * Generates a composite list of ordered visual layer descriptors for rendering the hero sprite.
     */
    public static getCompositedLayers(options?: {
        equippedCrystals?: Partial<Record<EquipmentSlot, string | null>>;
        selectedVariants?: Partial<Record<EquipmentSlot, string>>;
        isMoving?: boolean;
        elapsedMs?: number;
        flipX?: boolean;
        [key: string]: any;
    }): LayerDescriptor[] {
        const rawOptions: any = options || {};
        const isDirectMap = rawOptions.sword !== undefined || rawOptions.shield !== undefined || rawOptions.armor !== undefined || rawOptions.helmet !== undefined;
        const equippedCrystals: Partial<Record<EquipmentSlot, string | null>> = (isDirectMap ? rawOptions : rawOptions.equippedCrystals) || {};
        const selectedVariants: Partial<Record<EquipmentSlot, string>> = rawOptions.selectedVariants || {};
        const isMoving = !!rawOptions.isMoving;
        const elapsedMs = typeof rawOptions.elapsedMs === 'number' ? rawOptions.elapsedMs : 0;
        const flipX = !!rawOptions.flipX;

        const capeFrame = this.getCapeFrame(elapsedMs, isMoving);
        const layers: LayerDescriptor[] = [];

        // 1. Layer: Flowing Cape (Rendered behind base body)
        const capeTint = this.getInfusionTint(equippedCrystals.armor);
        layers.push({
            type: 'cape',
            assetKey: `cape_flowing_${capeFrame}`,
            depthOffset: -1,
            tint: capeTint,
            alpha: 1.0,
            scaleX: flipX ? -1 : 1,
            scaleY: 1,
            offsetX: flipX ? 4 : -4,
            offsetY: isMoving ? -1 : 0,
            flipWithPlayer: true,
            description: `Flowing Cape (Frame ${capeFrame})`
        });

        // 2. Layer: Base Hero Sprite (Melodie's original character art)
        // Sprint 28: Resolves to player_female for Cora Swift, player for Valen Swift
        const gender = rawOptions.gender as ('male' | 'female' | undefined);
        const baseKey = (gender === 'female') ? 'player_female' : 'player';
        layers.push({
            type: 'base',
            assetKey: baseKey,
            depthOffset: 0,
            tint: 0xffffff,
            alpha: 1.0,
            scaleX: flipX ? -1 : 1,
            scaleY: 1,
            offsetX: 0,
            offsetY: 0,
            flipWithPlayer: true,
            description: "Melodie's Protagonist Base Sprite"
        });

        // 3. Layer: Body Armor Overlay (Tinted by equipped body crystal)
        const armorCrystal = equippedCrystals.armor;
        const armorVariant = selectedVariants.armor || 'armor_royal_plate';
        if (armorCrystal || selectedVariants.armor) {
            const armorTint = this.getInfusionTint(armorCrystal);
            layers.push({
                type: 'armor',
                assetKey: armorVariant,
                depthOffset: 1,
                tint: armorTint,
                alpha: 0.85,
                scaleX: flipX ? -1 : 1,
                scaleY: 1,
                offsetX: 0,
                offsetY: 2,
                flipWithPlayer: true,
                description: `Infused Body Armor (${armorVariant})`
            });
        }

        // 4. Layer: Circlet / Tiara Headwear (Strictly circlets to preserve hair!)
        const rawHeadwear = selectedVariants.helmet || (equippedCrystals.helmet ? `helmet_circlet_${equippedCrystals.helmet}` : 'helmet_circlet_silver');
        const sanitizedHeadwear = this.validateAndSanitizeHeadwear(rawHeadwear);
        const helmetTint = this.getInfusionTint(equippedCrystals.helmet);
        layers.push({
            type: 'helmet',
            assetKey: sanitizedHeadwear,
            depthOffset: 2,
            tint: helmetTint,
            alpha: 0.95,
            scaleX: flipX ? -1 : 1,
            scaleY: 1,
            offsetX: 0,
            offsetY: 0, // Positioned precisely along the brow
            flipWithPlayer: true,
            description: `Sanitized Circlet Headwear (${sanitizedHeadwear})`
        });

        // 5. Layer: Off-Hand Shield Overlay (Default shield always equipped)
        const shieldCrystal = equippedCrystals.shield;
        let defaultShieldKey = 'shield_silver';
        if (shieldCrystal === 'bat') {
            defaultShieldKey = 'shield_winged';
        }
        const shieldVariant = selectedVariants.shield || defaultShieldKey;
        const shieldTint = this.getInfusionTint(shieldCrystal);
        layers.push({
            type: 'shield',
            assetKey: shieldVariant,
            depthOffset: 3,
            tint: shieldTint,
            alpha: 0.9,
            scaleX: flipX ? -0.7 : 0.7,
            scaleY: 0.7,
            offsetX: flipX ? 14 : -14,
            offsetY: 4,
            flipWithPlayer: true,
            description: `Shield Overlay (${shieldVariant})`
        });

        // 6. Layer: Main-Hand Sword Overlay (Positioned directly in hero's hand, rotated naturally)
        const swordCrystal = equippedCrystals.sword;
        let defaultSwordKey = 'sword_bronze';
        if (swordCrystal === 'bat') {
            defaultSwordKey = 'sword_winged';
        } else if (swordCrystal === 'phoenix') {
            defaultSwordKey = 'sword_flame';
        } else if (swordCrystal) {
            defaultSwordKey = 'sword_silver';
        }
        const swordVariant = selectedVariants.sword || defaultSwordKey;
        const swordTint = this.getInfusionTint(swordCrystal);
        layers.push({
            type: 'sword',
            assetKey: swordVariant,
            depthOffset: 4,
            tint: swordTint,
            alpha: 1.0,
            scaleX: flipX ? -0.68 : 0.68,
            scaleY: 0.68,
            offsetX: flipX ? -11 : 11,
            offsetY: 10,
            originX: 0.5,
            originY: 0.20,
            rotation: flipX ? -0.52 : 0.52,
            flipWithPlayer: true,
            description: `Infused Sword Overlay (${swordVariant})`
        });

        return layers;
    }

    /**
     * Cycles to the next available artwork variant for a given equipment slot.
     */
    public static cycleNextArtworkVariant(slot: EquipmentSlot, currentVariantId: string): ArtworkVariant {
        const slotData = MELODIE_ARTWORK_CATALOG[slot];
        if (!slotData || slotData.variants.length === 0) {
            return {
                id: 'default',
                assetKey: 'sword_winged',
                name: 'Standard Relic',
                description: 'Ancient artifact.',
                artistLore: 'Drawn by Melodie Swift.'
            };
        }

        const currentIndex = slotData.variants.findIndex(v => v.id === currentVariantId || v.assetKey === currentVariantId);
        const nextIndex = (currentIndex + 1) % slotData.variants.length;
        return slotData.variants[nextIndex];
    }

    /**
     * Gets an artwork variant by ID or returns the first variant for that slot.
     */
    public static getArtworkVariant(slot: EquipmentSlot, variantId?: string): ArtworkVariant {
        const slotData = MELODIE_ARTWORK_CATALOG[slot];
        if (!slotData || slotData.variants.length === 0) {
            return {
                id: 'default',
                assetKey: 'sword_winged',
                name: 'Standard Relic',
                description: 'Ancient artifact.',
                artistLore: 'Drawn by Melodie Swift.'
            };
        }

        if (variantId) {
            const match = slotData.variants.find(v => v.id === variantId || v.assetKey === variantId);
            if (match) return match;
        }

        return slotData.variants[0];
    }
}
