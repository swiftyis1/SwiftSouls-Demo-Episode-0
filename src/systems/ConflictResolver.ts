import type { SaveEnvelope } from './GameManager.ts';

export interface ProgressMetrics {
    extinctCount: number;
    totalFragments: number;
    soulLevel: number;
    timestamp: number;
    progressScore: number;
}

export type ConflictStrategy = 'highest_progress' | 'latest_timestamp' | 'prefer_local' | 'prefer_cloud';

export interface ConflictResolution {
    winner: SaveEnvelope;
    winnerSource: 'local' | 'cloud';
    reason: string;
    isIdentical: boolean;
    localMetrics: ProgressMetrics;
    cloudMetrics: ProgressMetrics;
}

/**
 * ConflictResolver: Evaluates local and remote save states to safeguard player progress.
 * Prevents accidental loss of hard-earned species extinctions and Soul Levels.
 */
export class ConflictResolver {
    /**
     * Extracts gameplay progress metrics from a SaveEnvelope payload.
     */
    public static extractMetrics(envelope: SaveEnvelope): ProgressMetrics {
        let extinctCount = 0;
        let totalFragments = 0;
        let soulLevel = 0;

        try {
            const state = JSON.parse(envelope.payload);
            if (state && state.party && state.party[0]) {
                soulLevel = Number(state.party[0].level) || 0;
            }

            if (state && state.soulCrystals && typeof state.soulCrystals === 'object') {
                Object.keys(state.soulCrystals).forEach(key => {
                    const cry = state.soulCrystals[key];
                    if (cry) {
                        if (cry.isExtinct) {
                            extinctCount++;
                        }
                        if (typeof cry.fragments === 'number') {
                            totalFragments += cry.fragments;
                        }
                    }
                });
            }
        } catch {
            // If payload parsing fails, metrics remain zeroes
        }

        // Progress score: Extinctions (highest value) > Soul Level > Fragments
        const progressScore = (extinctCount * 10000) + (soulLevel * 100) + totalFragments;

        return {
            extinctCount,
            totalFragments,
            soulLevel,
            timestamp: envelope.timestamp || 0,
            progressScore
        };
    }

    /**
     * Compares local and cloud save envelopes and decides the authoritative winner.
     */
    public static resolve(
        localEnv: SaveEnvelope,
        cloudEnv: SaveEnvelope,
        strategy: ConflictStrategy = 'highest_progress'
    ): ConflictResolution {
        const localMetrics = this.extractMetrics(localEnv);
        const cloudMetrics = this.extractMetrics(cloudEnv);

        // Check if payloads and signatures match exactly
        if (localEnv.signature === cloudEnv.signature && localEnv.payload === cloudEnv.payload) {
            return {
                winner: localEnv,
                winnerSource: 'local',
                reason: 'Local and cloud saves are identical.',
                isIdentical: true,
                localMetrics,
                cloudMetrics
            };
        }

        if (strategy === 'prefer_local') {
            return {
                winner: localEnv,
                winnerSource: 'local',
                reason: 'Strategy explicitly configured to prefer local save.',
                isIdentical: false,
                localMetrics,
                cloudMetrics
            };
        }

        if (strategy === 'prefer_cloud') {
            return {
                winner: cloudEnv,
                winnerSource: 'cloud',
                reason: 'Strategy explicitly configured to prefer cloud save.',
                isIdentical: false,
                localMetrics,
                cloudMetrics
            };
        }

        if (strategy === 'latest_timestamp') {
            const localIsNewer = localMetrics.timestamp >= cloudMetrics.timestamp;
            return {
                winner: localIsNewer ? localEnv : cloudEnv,
                winnerSource: localIsNewer ? 'local' : 'cloud',
                reason: localIsNewer
                    ? `Local save timestamp (${localMetrics.timestamp}) is newer or equal.`
                    : `Cloud save timestamp (${cloudMetrics.timestamp}) is newer.`,
                isIdentical: false,
                localMetrics,
                cloudMetrics
            };
        }

        // Default 'highest_progress' strategy:
        // Invariant: Never overwrite higher extinct count!
        if (localMetrics.extinctCount > cloudMetrics.extinctCount) {
            return {
                winner: localEnv,
                winnerSource: 'local',
                reason: `Local save has higher species extinction count (${localMetrics.extinctCount} vs ${cloudMetrics.extinctCount}).`,
                isIdentical: false,
                localMetrics,
                cloudMetrics
            };
        }

        if (cloudMetrics.extinctCount > localMetrics.extinctCount) {
            return {
                winner: cloudEnv,
                winnerSource: 'cloud',
                reason: `Cloud save has higher species extinction count (${cloudMetrics.extinctCount} vs ${localMetrics.extinctCount}).`,
                isIdentical: false,
                localMetrics,
                cloudMetrics
            };
        }

        // Extinction counts match: compare total progress scores
        if (localMetrics.progressScore > cloudMetrics.progressScore) {
            return {
                winner: localEnv,
                winnerSource: 'local',
                reason: `Local save has greater progress score (${localMetrics.progressScore} vs ${cloudMetrics.progressScore}).`,
                isIdentical: false,
                localMetrics,
                cloudMetrics
            };
        }

        if (cloudMetrics.progressScore > localMetrics.progressScore) {
            return {
                winner: cloudEnv,
                winnerSource: 'cloud',
                reason: `Cloud save has greater progress score (${cloudMetrics.progressScore} vs ${localMetrics.progressScore}).`,
                isIdentical: false,
                localMetrics,
                cloudMetrics
            };
        }

        // Progress scores match: break tie with latest timestamp
        if (localMetrics.timestamp >= cloudMetrics.timestamp) {
            return {
                winner: localEnv,
                winnerSource: 'local',
                reason: `Progress tied; local save is newer or equal (${localMetrics.timestamp} vs ${cloudMetrics.timestamp}).`,
                isIdentical: false,
                localMetrics,
                cloudMetrics
            };
        } else {
            return {
                winner: cloudEnv,
                winnerSource: 'cloud',
                reason: `Progress tied; cloud save is newer (${cloudMetrics.timestamp} vs ${localMetrics.timestamp}).`,
                isIdentical: false,
                localMetrics,
                cloudMetrics
            };
        }
    }
}
