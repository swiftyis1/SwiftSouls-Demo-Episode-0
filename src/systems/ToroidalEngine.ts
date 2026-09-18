/**
 * ToroidalEngine.ts
 * 
 * Pure mathematical utilities for seamless toroidal world geometry,
 * coordinate normalization, shortest-path wrapping deltas, and chunk index calculation.
 * 
 * Project SwiftSouls - Sprint 29
 */

export class ToroidalEngine {
    /**
     * Seamlessly wraps a floating point coordinate into [0, max).
     */
    public static wrapCoordinate(coord: number, max: number): number {
        if (max <= 0) return 0;
        let wrapped = coord % max;
        if (wrapped < 0) {
            wrapped += max;
        }
        return wrapped;
    }

    /**
     * Calculates the shortest signed delta from pos1 to pos2 on a toroidal axis of length max.
     * Positive means target is to the "right/down", negative means "left/up".
     */
    public static toroidalDelta(pos1: number, pos2: number, max: number): number {
        if (max <= 0) return 0;
        let diff = (pos2 - pos1) % max;
        if (diff > max / 2) {
            diff -= max;
        } else if (diff < -max / 2) {
            diff += max;
        }
        return diff;
    }

    /**
     * Computes the Euclidean distance between two points considering toroidal wrap-around.
     */
    public static toroidalDistance(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        width: number,
        height: number
    ): number {
        const dx = this.toroidalDelta(x1, x2, width);
        const dy = this.toroidalDelta(y1, y2, height);
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Normalizes integer tile grid coordinates into valid toroidal bounds [0, cols) and [0, rows).
     */
    public static normalizeGridCoords(
        gridX: number,
        gridY: number,
        cols: number,
        rows: number
    ): { gridX: number; gridY: number } {
        let gx = gridX % cols;
        if (gx < 0) gx += cols;
        let gy = gridY % rows;
        if (gy < 0) gy += rows;
        return { gridX: gx, gridY: gy };
    }

    /**
     * Calculates the chunk coordinate (0-indexed) for a given tile position.
     */
    public static getChunkCoord(tileCoord: number, chunkSize: number = 10): number {
        return Math.floor(tileCoord / chunkSize);
    }

    /**
     * Returns an array of (chunkX, chunkY) coordinates representing the ring of chunks
     * centered at (centerChunkX, centerChunkY) within a toroidal world of (totalChunksX, totalChunksY).
     * By default radius=1 gives a 3x3 grid of active chunks.
     */
    public static getActiveChunks(
        centerChunkX: number,
        centerChunkY: number,
        totalChunksX: number,
        totalChunksY: number,
        radius: number = 1
    ): { chunkX: number; chunkY: number; key: string }[] {
        const chunks: { chunkX: number; chunkY: number; key: string }[] = [];
        const seen = new Set<string>();

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                let cx = (centerChunkX + dx) % totalChunksX;
                if (cx < 0) cx += totalChunksX;

                let cy = (centerChunkY + dy) % totalChunksY;
                if (cy < 0) cy += totalChunksY;

                const key = `${cx},${cy}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    chunks.push({ chunkX: cx, chunkY: cy, key });
                }
            }
        }
        return chunks;
    }
}
