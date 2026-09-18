/**
 * PetFollowerMath.ts
 * 
 * Pure mathematical utilities for Pet Follower trail interpolation,
 * snap threshold detection, and smoothing for Sprint 26.
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
        let dx = target.x - current.x;
        let dy = target.y - current.y;

        if (wrapWidth > 0) {
            if (dx > wrapWidth / 2) dx -= wrapWidth;
            else if (dx < -wrapWidth / 2) dx += wrapWidth;
        }
        if (wrapHeight > 0) {
            if (dy > wrapHeight / 2) dy -= wrapHeight;
            else if (dy < -wrapHeight / 2) dy += wrapHeight;
        }

        let nextX = current.x + dx * factor;
        let nextY = current.y + dy * factor;

        if (wrapWidth > 0) {
            nextX = ((nextX % wrapWidth) + wrapWidth) % wrapWidth;
        }
        if (wrapHeight > 0) {
            nextY = ((nextY % wrapHeight) + wrapHeight) % wrapHeight;
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
