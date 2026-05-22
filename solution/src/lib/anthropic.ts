import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const ALLOWED_MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] as const
export type AllowedModel = typeof ALLOWED_MODELS[number]

export function resolveModel(requested?: string | null): AllowedModel {
  const def = (process.env.DEFAULT_MODEL ?? 'claude-sonnet-4-6') as AllowedModel
  if (!requested) return def
  return (ALLOWED_MODELS as readonly string[]).includes(requested)
    ? (requested as AllowedModel)
    : def
}
