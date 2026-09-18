import { ToroidalEngine } from './ToroidalEngine';

/**
 * PetFollowerMath.ts
 * 
 * Pure mathematical utilities for Pet Follower trail interpolation,
 * snap threshold detection, and smoothing for Sprint 26 / Sprint 29.
 */

export class PetFollowerMath {
    /**
     * Pure static utility to compute trail target position.
     */
    public static computeTrailTarget(
        history: { x: number; y: number }[],
        delayFrames: number
    ): { x: number; y: number } {
        if (!history || history.length === 0) return { x: 0, y: 0 };
        const index = Math.max(0, history.length - 1 - delayFrames);
        return history[index] || history[0];
    }

    /**
     * Pure static utility to check whether pet must snap / warp to player.
     */
    public static shouldSnap(currentDist: number, threshold: number = 380): boolean {
        return currentDist > threshold;
    }

    /**
     * Pure static utility to calculate smooth interpolation movement with optional toroidal wrapping.
     */
    public static interpolatePosition(
        current: { x: number; y: number },
        target: { x: number; y: number },
        factor: number = 0.14,
        wrapWidth: number = 0,
        wrapHeight: number = 0
    ): { x: number; y: number } {
        let dx = wrapWidth > 0 
            ? ToroidalEngine.toroidalDelta(current.x, target.x, wrapWidth)
            : (target.x - current.x);
        let dy = wrapHeight > 0 
            ? ToroidalEngine.toroidalDelta(current.y, target.y, wrapHeight)
            : (target.y - current.y);

        let nextX = current.x + dx * factor;
        let nextY = current.y + dy * factor;

        if (wrapWidth > 0) {
            nextX = ToroidalEngine.wrapCoordinate(nextX, wrapWidth);
        }
        if (wrapHeight > 0) {
            nextY = ToroidalEngine.wrapCoordinate(nextY, wrapHeight);
        }

        return { x: nextX, y: nextY };
    }

    /**
     * Calculates distance considering toroidal wrap-around if world dimensions provided.
     */
    public static computeDistance(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        wrapWidth: number = 0,
        wrapHeight: number = 0
    ): number {
        if (wrapWidth > 0 && wrapHeight > 0) {
            return ToroidalEngine.toroidalDistance(x1, y1, x2, y2, wrapWidth, wrapHeight);
        }
        let dx = Math.abs(x2 - x1);
        let dy = Math.abs(y2 - y1);

        if (wrapWidth > 0 && dx > wrapWidth / 2) {
            dx = wrapWidth - dx;
        }
        if (wrapHeight > 0 && dy > wrapHeight / 2) {
            dy = wrapHeight - dy;
        }

        return Math.sqrt(dx * dx + dy * dy);
    }
}
