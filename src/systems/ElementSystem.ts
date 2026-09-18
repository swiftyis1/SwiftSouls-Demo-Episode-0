/**
 * ElementSystem.ts
 * 
 * Master Elemental Interaction Matrix, Over-100% Absorption Engine,
 * and Battle-Scoped Status Ailments for Project SwiftSouls (Sprint 22).
 */

export type ElementType = 
    | 'physical'
    | 'fire'
    | 'cold'
    | 'poison'
    | 'lightning'
    | 'dark'
    | 'light'
    | 'water'
    | 'earth';

export type StatusAilmentType = 
    | 'poison'
    | 'burn'
    | 'freeze'
    | 'stun'
    | 'bleed'
    | 'silence';

export interface ActiveStatusAilment {
    type: StatusAilmentType;
    duration: number; // In turns
    potency?: number;  // Damage per turn or stat penalty
    appliedBy?: string;
}

export interface ElementalDamageResult {
    effectiveDamage: number;
    rawDamage: number;
    isWeakness: boolean;
    isResisted: boolean;
    isImmune: boolean;
    isAbsorbed: boolean;
    absorbedHealing: number;
    multiplier: number;
    badgeText: string;
    badgeColor: string;
}

export class ElementSystem {
    /**
     * Master elemental affinity matrix: maps attacking element against defending inherent element
     * Default base multipliers when specific gear/monster resistance % is not explicitly defined.
     */
    public static readonly AFFINITY_MATRIX: Record<ElementType, Partial<Record<ElementType, number>>> = {
        physical: {
            // Neutral across all elements
        },
        fire: {
            cold: 1.5,     // Fire melts Cold
            water: 0.5,    // Water douses Fire
            fire: 0.0,     // Fire resists Fire
            earth: 1.25    // Fire scorches Earth
        },
        cold: {
            fire: 1.25,    // Cold quenches Fire
            water: 1.0,
            cold: 0.0,     // Cold resists Cold
            earth: 1.25,   // Frost cracks Earth
            poison: 1.25   // Freezes Poison
        },
        poison: {
            poison: 0.0,   // Poison immune to Poison
            water: 1.25,   // Pollutes Water
            earth: 0.5,    // Earth absorbs Poison
            light: 0.5     // Light purifies Poison
        },
        lightning: {
            water: 1.75,   // Lightning electrocutes Water
            earth: 0.25,   // Earth grounds Lightning
            lightning: 0.0,
            cold: 1.25     // Shatters ice
        },
        dark: {
            light: 1.75,   // Dark and Light mutually devastate each other
            dark: 0.0,     // Dark resists Dark
            physical: 1.0
        },
        light: {
            dark: 1.75,    // Light dispels Dark
            light: 0.0,    // Light resists Light
            poison: 1.5    // Light purifies Poison
        },
        water: {
            fire: 1.75,    // Water extinguishes Fire
            lightning: 0.5,// Water weak to Lightning
            earth: 1.25,   // Water erodes Earth
            water: 0.0
        },
        earth: {
            lightning: 1.5,// Earth absorbs Lightning
            water: 0.5,    // Water erodes Earth
            fire: 0.75,    // Earth resists Fire
            earth: 0.0
        }
    };

    /**
     * Calculates final elemental damage, applying:
     * - Target elemental resistance percentage (-100% to +200%)
     * - Inherent element matrix affinity
     * - Magic Defense mitigation
     * - Over-100% elemental absorption into HP healing
     */
    public static calculateDamage(
        baseDamage: number,
        attackElement: ElementType,
        targetResistances: Partial<Record<ElementType, number>> = {},
        targetMagicDefense: number = 0,
        targetInherentElement?: ElementType
    ): ElementalDamageResult {
        if (baseDamage <= 0) {
            return {
                effectiveDamage: 0,
                rawDamage: 0,
                isWeakness: false,
                isResisted: false,
                isImmune: false,
                isAbsorbed: false,
                absorbedHealing: 0,
                multiplier: 1.0,
                badgeText: '',
                badgeColor: '#ffffff'
            };
        }

        // 1. Determine base multiplier from inherent element affinity
        let affinityMultiplier = 1.0;
        if (targetInherentElement && this.AFFINITY_MATRIX[attackElement]?.[targetInherentElement] !== undefined) {
            affinityMultiplier = this.AFFINITY_MATRIX[attackElement]![targetInherentElement]!;
        }

        // 2. Fetch specific resistance percentage (e.g., 0.5 = 50% resistance, -0.5 = 50% weakness, 1.25 = 125% absorption)
        const resistancePercent = targetResistances[attackElement] ?? 0;

        // 3. Combined net multiplier:
        // netMultiplier = affinityMultiplier * (1.0 - resistancePercent)
        // If resistancePercent > 1.0 (over-100%), it represents elemental absorption!
        const isAbsorbed = resistancePercent > 1.0;
        
        if (isAbsorbed) {
            // Excess resistance above 100% converts directly into healing
            const absorptionRatio = resistancePercent - 1.0;
            const healAmount = Math.max(1, Math.trunc(baseDamage * absorptionRatio));
            return {
                effectiveDamage: 0,
                rawDamage: baseDamage,
                isWeakness: false,
                isResisted: false,
                isImmune: false,
                isAbsorbed: true,
                absorbedHealing: healAmount,
                multiplier: 0,
                badgeText: `ABSORBED! +${healAmount} HP`,
                badgeColor: '#00ff88'
            };
        }

        let effectiveMultiplier = affinityMultiplier * Math.max(0, 1.0 - resistancePercent);
        effectiveMultiplier = Math.round(effectiveMultiplier * 100) / 100;

        // Check for complete immunity (resistance >= 1.0 or effectiveMultiplier <= 0)
        if (resistancePercent >= 1.0 || effectiveMultiplier <= 0.01) {
            return {
                effectiveDamage: 0,
                rawDamage: baseDamage,
                isWeakness: false,
                isResisted: false,
                isImmune: true,
                isAbsorbed: false,
                absorbedHealing: 0,
                multiplier: 0,
                badgeText: 'IMMUNE! (0 Dmg)',
                badgeColor: '#aaaaaa'
            };
        }

        // Apply Magic Defense mitigation for non-physical elements
        let mitigatedBase = baseDamage;
        if (attackElement !== 'physical' && targetMagicDefense > 0) {
            const mDefReduction = targetMagicDefense / (targetMagicDefense + 40); // Diminishing returns curve
            mitigatedBase = Math.max(1, Math.round(baseDamage * (1.0 - mDefReduction)));
        }

        const finalDamage = Math.max(1, Math.round(mitigatedBase * effectiveMultiplier));

        const isWeakness = effectiveMultiplier >= 1.25;
        const isResisted = effectiveMultiplier <= 0.75;

        let badgeText = '';
        let badgeColor = '#ffffff';

        if (isWeakness) {
            badgeText = `WEAKNESS! (${effectiveMultiplier}x)`;
            badgeColor = '#ff4444';
        } else if (isResisted) {
            badgeText = `RESISTED! (${effectiveMultiplier}x)`;
            badgeColor = '#44aaff';
        }

        return {
            effectiveDamage: finalDamage,
            rawDamage: baseDamage,
            isWeakness,
            isResisted,
            isImmune: false,
            isAbsorbed: false,
            absorbedHealing: 0,
            multiplier: effectiveMultiplier,
            badgeText,
            badgeColor
        };
    }

    /**
     * Formats status ailment abbreviation badge for HUD display
     */
    public static getAilmentBadge(ailment: ActiveStatusAilment): { text: string; color: string } {
        switch (ailment.type) {
            case 'poison':
                return { text: `[PSN ${ailment.duration}t]`, color: '#00cc44' };
            case 'burn':
                return { text: `[BRN ${ailment.duration}t]`, color: '#ff6600' };
            case 'freeze':
                return { text: `[FRZ ${ailment.duration}t]`, color: '#33ccff' };
            case 'stun':
                return { text: `[STN ${ailment.duration}t]`, color: '#ffcc00' };
            case 'bleed':
                return { text: `[BLD ${ailment.duration}t]`, color: '#cc0033' };
            case 'silence':
                return { text: `[SIL ${ailment.duration}t]`, color: '#9966ff' };
            default:
                return { text: `[${ailment.type}]`, color: '#ffffff' };
        }
    }

    /**
     * Applies or refreshes a status ailment in an active ailment list
     */
    public static applyAilment(
        ailments: ActiveStatusAilment[],
        newAilment: ActiveStatusAilment
    ): { applied: boolean; message: string } {
        const existingIdx = ailments.findIndex(a => a.type === newAilment.type);
        if (existingIdx >= 0) {
            // Refresh duration if longer
            if (newAilment.duration > ailments[existingIdx].duration) {
                ailments[existingIdx].duration = newAilment.duration;
            }
            if (newAilment.potency && newAilment.potency > (ailments[existingIdx].potency || 0)) {
                ailments[existingIdx].potency = newAilment.potency;
            }
            return {
                applied: true,
                message: `${newAilment.type.toUpperCase()} refreshed (${newAilment.duration} turns)!`
            };
        }

        ailments.push({ ...newAilment });
        return {
            applied: true,
            message: `Inflicted with ${newAilment.type.toUpperCase()}!`
        };
    }

    /**
     * Removes an ailment type from the list
     */
    public static removeAilment(ailments: ActiveStatusAilment[], type: StatusAilmentType): boolean {
        const idx = ailments.findIndex(a => a.type === type);
        if (idx >= 0) {
            ailments.splice(idx, 1);
            return true;
        }
        return false;
    }

    /**
     * Decrements durations of ailments and purges expired ones
     */
    public static tickAilmentDurations(ailments: ActiveStatusAilment[]): StatusAilmentType[] {
        const expired: StatusAilmentType[] = [];
        for (let i = ailments.length - 1; i >= 0; i--) {
            ailments[i].duration -= 1;
            if (ailments[i].duration <= 0) {
                expired.push(ailments[i].type);
                ailments.splice(i, 1);
            }
        }
        return expired;
    }

    /**
     * Checks if a specific ailment is active
     */
    public static hasAilment(ailments: ActiveStatusAilment[], type: StatusAilmentType): boolean {
        return ailments.some(a => a.type === type && a.duration > 0);
    }

    /**
     * Calculates burn physical strength reduction (20% penalty while burned)
     */
    public static getBurnStrengthPenalty(ailments: ActiveStatusAilment[], baseStrength: number = 1): number {
        if (this.hasAilment(ailments, 'burn')) {
            return Math.round(baseStrength * 0.20);
        }
        return 0;
    }
}

// ==========================================
// Top-Level Convenience Exports for BattleScene & Tests
// ==========================================

export function calculateDamage(params: {
    basePower: number;
    attackerMag?: number;
    attackerPenetration?: number;
    defenderDef?: number;
    defenderMDef?: number;
    attackElement: ElementType;
    defenderElement?: ElementType;
    defenderResistances?: Partial<Record<ElementType, number>>;
}): {
    damage: number;
    effectiveDamage: number;
    rawDamage: number;
    isWeakness: boolean;
    isResisted: boolean;
    isImmune: boolean;
    isAbsorbed: boolean;
    absorbedHealing: number;
    multiplier: number;
    badgeText: string;
    badgeColor: string;
} {
    const {
        basePower,
        attackerPenetration = 0,
        defenderDef = 0,
        defenderMDef = 0,
        attackElement,
        defenderElement,
        defenderResistances = {}
    } = params;

    if (basePower <= 0) {
        return {
            damage: 0,
            effectiveDamage: 0,
            rawDamage: 0,
            isWeakness: false,
            isResisted: false,
            isImmune: false,
            isAbsorbed: false,
            absorbedHealing: 0,
            multiplier: 1.0,
            badgeText: '',
            badgeColor: '#ffffff'
        };
    }

    // 1. Inherent element affinity multiplier
    let affinityMultiplier = 1.0;
    if (defenderElement && ElementSystem.AFFINITY_MATRIX[attackElement]?.[defenderElement] !== undefined) {
        affinityMultiplier = ElementSystem.AFFINITY_MATRIX[attackElement]![defenderElement]!;
    }

    // 2. Specific resistance percentage
    const resistancePercent = defenderResistances[attackElement] ?? 0;

    // 3. Absorption check (resistance > 1.0)
    if (resistancePercent > 1.0) {
        const absorptionRatio = resistancePercent - 1.0;
        const healAmount = Math.max(1, Math.trunc(basePower * absorptionRatio));
        return {
            damage: 0,
            effectiveDamage: 0,
            rawDamage: basePower,
            isWeakness: false,
            isResisted: false,
            isImmune: false,
            isAbsorbed: true,
            absorbedHealing: healAmount,
            multiplier: 0,
            badgeText: `ABSORBED! +${healAmount} HP`,
            badgeColor: '#00ff88'
        };
    }

    // 4. Immunity check
    if (resistancePercent >= 1.0) {
        return {
            damage: 0,
            effectiveDamage: 0,
            rawDamage: basePower,
            isWeakness: false,
            isResisted: false,
            isImmune: true,
            isAbsorbed: false,
            absorbedHealing: 0,
            multiplier: 0,
            badgeText: 'IMMUNE! (0 Dmg)',
            badgeColor: '#aaaaaa'
        };
    }

    // 5. Defense / Magic Defense mitigation
    let mitigatedBase = basePower;
    if (attackElement === 'physical') {
        const effectiveDef = Math.max(0, defenderDef * (1 - attackerPenetration));
        mitigatedBase = Math.max(1, basePower - effectiveDef * 0.4);
    } else {
        const effectiveMDef = Math.max(0, defenderMDef * (1 - attackerPenetration));
        if (effectiveMDef > 0) {
            const mDefReduction = effectiveMDef / (effectiveMDef + 40);
            mitigatedBase = Math.max(1, Math.round(basePower * (1.0 - mDefReduction)));
        }
    }

    let netMultiplier = affinityMultiplier * Math.max(0, 1.0 - resistancePercent);
    netMultiplier = Math.round(netMultiplier * 100) / 100;

    const finalDamage = Math.max(1, Math.round(mitigatedBase * netMultiplier));
    const isWeakness = netMultiplier >= 1.25;
    const isResisted = netMultiplier <= 0.75;

    let badgeText = '';
    let badgeColor = '#ffffff';
    if (isWeakness) {
        badgeText = `WEAKNESS! (${netMultiplier}x)`;
        badgeColor = '#ff4444';
    } else if (isResisted) {
        badgeText = `RESISTED! (${netMultiplier}x)`;
        badgeColor = '#44aaff';
    }

    return {
        damage: finalDamage,
        effectiveDamage: finalDamage,
        rawDamage: basePower,
        isWeakness,
        isResisted,
        isImmune: false,
        isAbsorbed: false,
        absorbedHealing: 0,
        multiplier: netMultiplier,
        badgeText,
        badgeColor
    };
}

export function getAilmentBadge(ailment: ActiveStatusAilment): string {
    switch (ailment.type) {
        case 'poison': return `[PSN ${ailment.duration}t]`;
        case 'burn': return `[BRN ${ailment.duration}t]`;
        case 'freeze': return `[FRZ ${ailment.duration}t]`;
        case 'stun': return `[STN ${ailment.duration}t]`;
        case 'bleed': return `[BLD ${ailment.duration}t]`;
        case 'silence': return `[SIL ${ailment.duration}t]`;
        default: return `[${ailment.type}]`;
    }
}

export function applyAilment(ailments: ActiveStatusAilment[], type: StatusAilmentType, duration: number, potency?: number): void {
    const existing = ailments.find(a => a.type === type);
    if (existing) {
        existing.duration = Math.max(existing.duration, duration);
        if (potency !== undefined) existing.potency = potency;
    } else {
        ailments.push({ type, duration, potency });
    }
}

export function removeAilment(ailments: ActiveStatusAilment[], type: StatusAilmentType): boolean {
    return ElementSystem.removeAilment(ailments, type);
}

export function tickAilmentDurations(ailments: ActiveStatusAilment[]): StatusAilmentType[] {
    return ElementSystem.tickAilmentDurations(ailments);
}

export function hasAilment(ailments: ActiveStatusAilment[], type: StatusAilmentType): boolean {
    return ElementSystem.hasAilment(ailments, type);
}

export function getBurnStrengthPenalty(ailments: ActiveStatusAilment[]): number {
    return hasAilment(ailments, 'burn') ? 0.20 : 0;
}
