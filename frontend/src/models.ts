// Single source of truth for which models AVAIL queries.
// If you change a model in supabase/functions/*, change it here too so the
// site always states exactly what was run.

export type ModelInfo = {
  key: 'claude' | 'perplexity' | 'chatgpt' | 'gemini';
  v1Label: string; // label returned by the v1 run-demo function
  name: string; // human-readable model name
  modelId: string; // exact API model string
  provider: string; // who serves it
  how: string; // how it finds and cites sources
};

export const MODELS: ModelInfo[] = [
  {
    key: 'claude',
    v1Label: 'Claude',
    name: 'Claude Sonnet 4.6',
    modelId: 'claude-sonnet-4-6',
    provider: 'Anthropic API',
    how: 'Built-in web search tool; citations come from the model’s own response',
  },
  {
    key: 'perplexity',
    v1Label: 'Perplexity',
    name: 'Perplexity Sonar',
    modelId: 'sonar',
    provider: 'Perplexity API',
    how: 'Search-native; returns its sources with every answer',
  },
  {
    key: 'chatgpt',
    v1Label: 'ChatGPT',
    name: 'GPT-5.6',
    modelId: 'gpt-5.6',
    provider: 'OpenAI Responses API',
    how: 'Built-in web search tool; citations come from URL annotations',
  },
  {
    key: 'gemini',
    v1Label: 'Gemini',
    name: 'Gemini 3.7 Flash',
    modelId: 'gemini-3.7-flash',
    provider: 'Google Gemini API',
    how: 'Google Search grounding; citations come from grounding metadata, with Google redirect links resolved to the real page',
  },
];

export function modelByLabel(label: string): ModelInfo | undefined {
  return MODELS.find((m) => m.v1Label === label);
}

export function modelByKey(key: string): ModelInfo | undefined {
  return MODELS.find((m) => m.key === key);
}
