/**
 * Claude model configurations
 */

export type ModelId = 'sonnet' | 'haiku' | 'balanced';

export interface ModelConfig {
  id: ModelId;
  name: string;
  apiModel?: string; // Optional for hybrid modes like 'balanced'
  description: string;
  color: string;
}

export const MODELS: Record<ModelId, ModelConfig> = {
  sonnet: {
    id: 'sonnet',
    name: 'SONNET',
    apiModel: 'claude-sonnet-4-5-20250929',
    description: 'Intelligent • Best for complex analysis',
    color: '#FF4D00', // Deep orange
  },
  haiku: {
    id: 'haiku',
    name: 'HAIKU',
    apiModel: 'claude-haiku-4-5-20251001',
    description: 'Fast • Economical • Best for simple tasks',
    color: '#FF8C4D', // Light orange
  },
  balanced: {
    id: 'balanced',
    name: 'BALANCED',
    description: 'Haiku for discovery • Sonnet for generation',
    color: '#FF6D27', // Mid orange
  },
};

export const DEFAULT_MODEL: ModelId = 'balanced';

/**
 * Get model API string for a specific operation
 */
export function getModelApiString(modelId?: ModelId, operation: 'discovery' | 'generation' = 'generation'): string {
  const id = modelId || DEFAULT_MODEL;

  // For balanced mode, use different models for different operations
  if (id === 'balanced') {
    return operation === 'discovery'
      ? MODELS.haiku.apiModel!
      : MODELS.sonnet.apiModel!;
  }

  return MODELS[id].apiModel!;
}

/**
 * Get model color from model ID
 */
export function getModelColor(modelId?: ModelId): string {
  return MODELS[modelId || DEFAULT_MODEL].color;
}
