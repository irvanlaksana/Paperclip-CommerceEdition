/**
 * Provider catalog - the single source of truth for "how do we talk to X".
 *
 * Adding a brand new AI vendor is a two line change:
 *   1. add its type to AI_PROVIDER_TYPES in @paperclip/shared
 *   2. add an entry below
 * No driver code is needed when the vendor speaks the OpenAI chat-completions
 * protocol (DeepSeek, Grok, OpenRouter, Ollama, LM Studio, vLLM, Groq, ...).
 */
import type { AIProviderType, ProviderCatalogEntry } from '@paperclip/shared';

export const PROVIDER_CATALOG: Record<AIProviderType, ProviderCatalogEntry> = {
  GEMINI: {
    type: 'GEMINI',
    label: 'Google Gemini',
    driver: 'gemini',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
    suggestedModels: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
    ],
    apiKeyEnv: ['GEMINI_API_KEY', 'GOOGLE_AI_API_KEY', 'GOOGLE_API_KEY'],
    endpointEnv: ['GEMINI_ENDPOINT'],
    modelEnv: ['GEMINI_MODEL'],
    requiresApiKey: true,
    docsUrl: 'https://aistudio.google.com/apikey',
  },

  OPENAI: {
    type: 'OPENAI',
    label: 'OpenAI',
    driver: 'openai-compatible',
    defaultEndpoint: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    suggestedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1-mini', 'o4-mini'],
    apiKeyEnv: ['OPENAI_API_KEY'],
    endpointEnv: ['OPENAI_ENDPOINT', 'OPENAI_BASE_URL'],
    modelEnv: ['OPENAI_MODEL'],
    requiresApiKey: true,
    docsUrl: 'https://platform.openai.com/api-keys',
  },

  CLAUDE: {
    type: 'CLAUDE',
    label: 'Anthropic Claude',
    driver: 'anthropic',
    defaultEndpoint: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-5',
    suggestedModels: ['claude-opus-4-1', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-3-5-sonnet-latest'],
    apiKeyEnv: ['CLAUDE_API_KEY', 'ANTHROPIC_API_KEY'],
    endpointEnv: ['CLAUDE_ENDPOINT', 'ANTHROPIC_BASE_URL'],
    modelEnv: ['CLAUDE_MODEL', 'ANTHROPIC_MODEL'],
    requiresApiKey: true,
    defaultHeaders: { 'anthropic-version': '2023-06-01' },
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },

  DEEPSEEK: {
    type: 'DEEPSEEK',
    label: 'DeepSeek',
    driver: 'openai-compatible',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    suggestedModels: ['deepseek-chat', 'deepseek-reasoner'],
    apiKeyEnv: ['DEEPSEEK_API_KEY'],
    endpointEnv: ['DEEPSEEK_ENDPOINT'],
    modelEnv: ['DEEPSEEK_MODEL'],
    requiresApiKey: true,
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },

  GROK: {
    type: 'GROK',
    label: 'xAI Grok',
    driver: 'openai-compatible',
    defaultEndpoint: 'https://api.x.ai/v1',
    defaultModel: 'grok-4-fast',
    suggestedModels: ['grok-4', 'grok-4-fast', 'grok-3-mini'],
    apiKeyEnv: ['GROK_API_KEY', 'XAI_API_KEY'],
    endpointEnv: ['GROK_ENDPOINT', 'XAI_BASE_URL'],
    modelEnv: ['GROK_MODEL', 'XAI_MODEL'],
    requiresApiKey: true,
    docsUrl: 'https://console.x.ai/',
  },

  OPENROUTER: {
    type: 'OPENROUTER',
    label: 'OpenRouter',
    driver: 'openai-compatible',
    defaultEndpoint: 'https://openrouter.ai/api/v1',
    defaultModel: 'openrouter/auto',
    suggestedModels: [
      'openrouter/auto',
      'anthropic/claude-sonnet-4.5',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-chat',
    ],
    apiKeyEnv: ['OPENROUTER_API_KEY'],
    endpointEnv: ['OPENROUTER_ENDPOINT'],
    modelEnv: ['OPENROUTER_MODEL'],
    requiresApiKey: true,
    defaultHeaders: {
      'HTTP-Referer': 'https://paperclip.local',
      'X-Title': 'Paperclip Commerce Edition',
    },
    docsUrl: 'https://openrouter.ai/keys',
    notes: 'Satu API key untuk 300+ model. Ganti model cukup ubah <TYPE>_MODEL.',
  },

  OLLAMA: {
    type: 'OLLAMA',
    label: 'Ollama (lokal)',
    driver: 'openai-compatible',
    defaultEndpoint: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    suggestedModels: ['llama3.2', 'qwen2.5', 'mistral', 'gemma2'],
    apiKeyEnv: ['OLLAMA_API_KEY'],
    endpointEnv: ['OLLAMA_ENDPOINT', 'OLLAMA_BASE_URL'],
    modelEnv: ['OLLAMA_MODEL'],
    requiresApiKey: false,
    docsUrl: 'https://ollama.com/',
    notes: 'Jalan di localhost, tanpa API key.',
  },

  LM_STUDIO: {
    type: 'LM_STUDIO',
    label: 'LM Studio (lokal)',
    driver: 'openai-compatible',
    defaultEndpoint: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    suggestedModels: ['local-model'],
    apiKeyEnv: ['LM_STUDIO_API_KEY'],
    endpointEnv: ['LM_STUDIO_ENDPOINT', 'LM_STUDIO_BASE_URL'],
    modelEnv: ['LM_STUDIO_MODEL'],
    requiresApiKey: false,
    docsUrl: 'https://lmstudio.ai/',
    notes: 'Aktifkan "Local Server" di LM Studio, model apa pun bisa dipakai.',
  },

  OPENCLAW: {
    type: 'OPENCLAW',
    label: 'OpenClaw',
    driver: 'openai-compatible',
    defaultEndpoint: 'https://api.openclaw.ai/v1',
    defaultModel: 'openclaw-1',
    suggestedModels: ['openclaw-1'],
    apiKeyEnv: ['OPENCLAW_API_KEY'],
    endpointEnv: ['OPENCLAW_ENDPOINT'],
    modelEnv: ['OPENCLAW_MODEL'],
    requiresApiKey: true,
  },

  CUSTOM: {
    type: 'CUSTOM',
    label: 'Custom (OpenAI-compatible)',
    driver: 'openai-compatible',
    defaultEndpoint: 'http://localhost:8080/v1',
    defaultModel: 'custom-model',
    suggestedModels: [],
    apiKeyEnv: ['CUSTOM_AI_API_KEY', 'CUSTOM_API_KEY'],
    endpointEnv: ['CUSTOM_AI_ENDPOINT', 'CUSTOM_ENDPOINT'],
    modelEnv: ['CUSTOM_AI_MODEL', 'CUSTOM_MODEL'],
    requiresApiKey: false,
    notes: 'Untuk vLLM, Groq, Together, LiteLLM, atau gateway internal apa pun.',
  },

  MOCK: {
    type: 'MOCK',
    label: 'Mock (offline)',
    driver: 'mock',
    defaultEndpoint: 'mock://local',
    defaultModel: 'paperclip-mock-1',
    suggestedModels: ['paperclip-mock-1'],
    apiKeyEnv: [],
    requiresApiKey: false,
    notes: 'Driver offline untuk demo/CI. Tidak memanggil jaringan sama sekali.',
  },
};

export function getCatalogEntry(type: AIProviderType): ProviderCatalogEntry {
  const entry = PROVIDER_CATALOG[type];
  if (!entry) {
    throw new Error(
      `Unknown AI provider type "${type}". Tambahkan entri di packages/api/src/ai/provider-catalog.ts`,
    );
  }
  return entry;
}

export function listCatalog(): ProviderCatalogEntry[] {
  return Object.values(PROVIDER_CATALOG);
}
