import type { PetCompanionState, PetSkill, CharacterStats } from './GameManager';
import { type ElementType, calculateDamage } from './ElementSystem.ts';

export interface PetActionDecision {
    actionType: 'HEAL' | 'SKILL' | 'ATTACK' | 'PASS';
    target: 'PLAYER' | 'PET' | 'ENEMY';
    skillUsed?: PetSkill;
    spCost: number;
    rawAmount: number;
    element?: ElementType;
    message: string;
}

/**
 * PetBattleAI - Autonomous Co-Op Battle Decision Engine for Sprint 26
 * 
 * Rules:
 * 1. Low-HP Healing Logic: Restorative skills ONLY trigger if Pet HP or Player HP is below 50%.
 * 2. Signature Elemental Skill: Executes signature skill if Pet has sufficient SP.
 * 3. SP Conservation: If Pet SP is below skill requirement, defaults to basic attack to conserve SP.
 * 4. Defeat / Unconscious: If Pet HP is 0 or isDefeated is true, Pet passes turn.
 */
export class PetBattleAI {
    /**
     * Evaluates the current combat context and determines the autonomous Pet action.
     */
    public static evaluateTurn(
        pet: PetCompanionState,
        playerStats: CharacterStats,
        _enemyHp: number,
        _enemyMaxHp: number,
        enemyElement: ElementType = 'physical'
    ): PetActionDecision {
        // 1. Defeat check
        if (pet.isDefeated || pet.hp <= 0) {
            return {
                actionType: 'PASS',
                target: 'ENEMY',
                spCost: 0,
                rawAmount: 0,
                message: `${pet.name} is unconscious and cannot act!`
            };
        }

        const skill = pet.signatureSkill;

        // 2. Low-HP Healing Logic (Threshold: < 50% Max HP for either ally)
        if (skill && skill.type === 'heal') {
            const petHpPct = pet.hp / pet.maxHp;
            const playerHpPct = playerStats.hp / playerStats.maxHp;

            if (petHpPct < 0.5 || playerHpPct < 0.5) {
                // Check SP availability
                if (pet.sp >= skill.spCost) {
                    const targetAlly: 'PLAYER' | 'PET' = playerHpPct <= petHpPct ? 'PLAYER' : 'PET';
                    const targetName = targetAlly === 'PLAYER' ? playerStats.name : pet.name;
                    const healAmount = Math.trunc(skill.power + (pet.level - 1) * 6);

                    return {
                        actionType: 'HEAL',
                        target: targetAlly,
                        skillUsed: skill,
                        spCost: skill.spCost,
                        rawAmount: healAmount,
                        element: skill.element,
                        message: `[PET CO-OP] ${pet.name} senses critical danger and casts ${skill.name} on ${targetName}, restoring ${healAmount} HP!`
                    };
                }
            }
        }

        // 3. Signature Elemental Offensive Skill
        if (skill && skill.type === 'damage' && pet.sp >= skill.spCost) {
            const basePower = Math.round(14 + pet.level * 4 * skill.power);
            // Calculate damage with element matrix
            const dmgResult = calculateDamage({
                basePower,
                attackerMag: 10 + pet.level * 2,
                attackElement: skill.element,
                defenderElement: enemyElement
            });
            const totalDmg = Math.max(1, Math.round(dmgResult.damage));
            const multiplierNote = dmgResult.multiplier > 1.0 
                ? ' (Super Effective!)' 
                : (dmgResult.multiplier < 1.0 ? ' (Resisted)' : '');

            return {
                actionType: 'SKILL',
                target: 'ENEMY',
                skillUsed: skill,
                spCost: skill.spCost,
                rawAmount: totalDmg,
                element: skill.element,
                message: `[PET CO-OP] ${pet.name} unleashes signature ${skill.name} for ${totalDmg} ${skill.element.toUpperCase()} damage!${multiplierNote}`
            };
        }

        // 4. SP Conservation & Basic Physical Attack
        // Triggered when Pet SP is insufficient for signature skill, or no skill exists
        const basicDamage = Math.max(1, Math.round(10 + pet.level * 3));
        const dmgResult = calculateDamage({
            basePower: basicDamage,
            attackElement: 'physical',
            defenderElement: enemyElement
        });
        const finalDmg = Math.max(1, Math.round(dmgResult.damage));

        const spNote = skill && pet.sp < skill.spCost
            ? ` (Conserving SP: ${pet.sp}/${skill.spCost})`
            : '';

        return {
            actionType: 'ATTACK',
            target: 'ENEMY',
            spCost: 0,
            rawAmount: finalDmg,
            element: 'physical',
            message: `[PET CO-OP] ${pet.name} leaps into the fray with a basic attack, dealing ${finalDmg} physical damage!${spNote}`
        };
    }

    /**
     * Determines whether enemy attacks the player or the companion pet.
     * Default: 75% Player, 25% Pet (or 50% if pet has protective aura).
     */
    public static evaluateEnemyTarget(
        pet: PetCompanionState | null | undefined,
        randomSeed: number = Math.random()
    ): 'PLAYER' | 'PET' {
        if (!pet || pet.isDefeated || pet.hp <= 0) {
            return 'PLAYER';
        }

        // If pet has an active aura from catalyst augmentation, elevated threat increases to 45%
        const petHasAura = !!pet.augmentation?.auraEffect;
        const petThreshold = petHasAura ? 0.45 : 0.25;

        return randomSeed < petThreshold ? 'PET' : 'PLAYER';
    }

    /**
     * Applies damage to Pet and evaluates defeat / unconscious state.
     */
    public static applyDamageToPet(pet: PetCompanionState, damage: number): {
        actualDamage: number;
        isDefeated: boolean;
        message: string;
    } {
        const actualDamage = Math.max(1, Math.trunc(damage));
        pet.hp = Math.max(0, pet.hp - actualDamage);

        if (pet.hp <= 0) {
            pet.hp = 0;
            pet.isDefeated = true;
            return {
                actualDamage,
                isDefeated: true,
                message: `[PET FALLEN] ${pet.name} took ${actualDamage} damage and fell unconscious! Revive at any Healing Station.`
            };
        }

        return {
            actualDamage,
            isDefeated: false,
            message: `[PET HIT] ${pet.name} took ${actualDamage} damage! (${pet.hp}/${pet.maxHp} HP)`
        };
    }
}
