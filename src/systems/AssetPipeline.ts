import type Phaser from 'phaser';

export type AssetRenderMode = 'procedural' | 'external' | 'fallback';

export interface AssetDefinition {
    key: string;
    proceduralGenerator?: (scene: Phaser.Scene) => void;
    externalPath?: string;
    status: AssetRenderMode;
    width?: number;
    height?: number;
}

export class AssetPipeline {
    private static instance: AssetPipeline | null = null;
    private registry: Map<string, AssetDefinition> = new Map();
    private useExternalAssets: boolean = false;

    private constructor() {}

    public static getInstance(): AssetPipeline {
        if (!this.instance) {
            this.instance = new AssetPipeline();
        }
        return this.instance;
    }

    /**
     * Registers an asset key with its procedural generator and optional external file path.
     */
    public registerAsset(
        key: string,
        proceduralGenerator?: (scene: Phaser.Scene) => void,
        externalPath?: string,
        width: number = 64,
        height: number = 64
    ) {
        this.registry.set(key, {
            key,
            proceduralGenerator,
            externalPath,
            status: 'procedural',
            width,
            height
        });
    }

    /**
     * Executes procedural texture generators for all registered keys on the given scene.
     */
    public generateAllProcedural(scene: Phaser.Scene) {
        this.registry.forEach((def, key) => {
            if (def.proceduralGenerator) {
                try {
                    def.proceduralGenerator(scene);
                    def.status = 'procedural';
                } catch (e) {
                    console.warn(`[AssetPipeline] Procedural generation failed for '${key}':`, e);
                    def.status = 'fallback';
                }
            }
        });
    }

    /**
     * Enqueues external assets to load via Phaser's LoaderPlugin with automatic fallback handling.
     */
    public loadExternalAssets(scene: Phaser.Scene) {
        if (!this.useExternalAssets) return;

        this.registry.forEach((def, key) => {
            if (def.externalPath) {
                scene.load.image(key + '_external', def.externalPath);
            }
        });

        scene.load.on('loaderror', (fileObj: any) => {
            console.warn(`[AssetPipeline] External asset '${fileObj.key}' failed to load. Falling back to procedural canvas texture.`);
            const originalKey = fileObj.key.replace('_external', '');
            const def = this.registry.get(originalKey);
            if (def) {
                def.status = 'fallback';
            }
        });

        scene.load.on('filecomplete', (key: string) => {
            if (key.endsWith('_external')) {
                const originalKey = key.replace('_external', '');
                const def = this.registry.get(originalKey);
                if (def) {
                    def.status = 'external';
                }
            }
        });
    }

    /**
     * Toggles whether the engine prioritizes external image files over procedural canvas textures.
     */
    public setUseExternalAssets(enabled: boolean) {
        this.useExternalAssets = enabled;
        if (!enabled) {
            this.registry.forEach((def) => {
                def.status = 'procedural';
            });
        }
    }

    public isExternalEnabled(): boolean {
        return this.useExternalAssets;
    }

    public getAssetStatus(key: string): AssetRenderMode {
        return this.registry.get(key)?.status || 'procedural';
    }

    public getAllRegisteredKeys(): string[] {
        return Array.from(this.registry.keys());
    }

    public hasTexture(scene: Phaser.Scene, key: string): boolean {
        return scene.textures.exists(key);
    }

    public getTextureKey(key: string): string {
        const def = this.registry.get(key);
        if (def && this.useExternalAssets && def.status === 'external') {
            return key + '_external';
        }
        return key;
    }
}
