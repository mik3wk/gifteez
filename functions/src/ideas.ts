export type GiftIdea = {
  title: string;
  priceMin: number;
  priceMax: number;
  reason: string;
  searchQuery: string;
};

export type IdeaPrompt = {
  relationship?: string;
  /** Whole years, when a birthday year is known. Never a name. */
  age?: number | null;
  occasion?: string | null;
  tags?: string[];
  budgetCents?: number | null;
  year?: number;
  likes?: string[];
  dislikes?: string[];
  notes?: string;
  pastGifts?: string[];
};

export function parseIdeas(content: string): GiftIdea[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed) as { ideas?: unknown };
    if (!Array.isArray(parsed.ideas)) {
      return [];
    }
    return parsed.ideas.map(normalizeIdea).filter((idea): idea is GiftIdea => idea != null).slice(0, 5);
  } catch {
    return [];
  }
}

function normalizeIdea(item: unknown): GiftIdea | null {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const row = item as Record<string, unknown>;
  const title = cleanText(row.title);
  const reason = cleanText(row.reason);
  const searchQuery = cleanText(row.searchQuery).replace(/\s+/g, ' ');
  const words = searchQuery.split(' ').filter(Boolean);
  const priceMin = clampPrice(row.priceMin);
  const priceMax = clampPrice(row.priceMax);
  if (!title || !reason || words.length < 3 || words.length > 6 || priceMin == null || priceMax == null) {
    return null;
  }
  return {
    title,
    reason,
    searchQuery,
    priceMin: Math.min(priceMin, priceMax),
    priceMax: Math.max(priceMin, priceMax),
  };
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampPrice(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) {
    return null;
  }
  const rounded = Math.round(number);
  return rounded > 0 ? rounded : null;
}

export function promptHash(personId: string, prompt: IdeaPrompt): string {
  return JSON.stringify({
    v: 3,
    personId,
    relationship: prompt.relationship ?? '',
    age: prompt.age ?? null,
    occasion: prompt.occasion ?? '',
    tags: [...(prompt.tags ?? [])].sort(),
    budgetCents: prompt.budgetCents ?? null,
    year: prompt.year ?? null,
    likes: [...(prompt.likes ?? [])].sort(),
    dislikes: [...(prompt.dislikes ?? [])].sort(),
    notes: (prompt.notes ?? '').slice(0, 300),
    pastGifts: [...(prompt.pastGifts ?? [])].sort(),
  });
}

export function modelPrompt(prompt: IdeaPrompt): IdeaPrompt {
  return {
    relationship: prompt.relationship ?? '',
    age: prompt.age ?? null,
    occasion: prompt.occasion ?? null,
    tags: prompt.tags ?? [],
    budgetCents: prompt.budgetCents ?? null,
    year: prompt.year,
    likes: prompt.likes ?? [],
    dislikes: prompt.dislikes ?? [],
    notes: (prompt.notes ?? '').slice(0, 300),
    pastGifts: prompt.pastGifts ?? [],
  };
}

const SYSTEM_PROMPT = [
  'You suggest practical gift ideas.',
  'Do not use or guess a person\'s name. No name is provided.',
  'Read relationship and age first and treat them as the life stage.',
  'An adult sister, brother, parent, or partner is not a child and must not get kids\' toys, picture books, or playground gifts.',
  'Suggest toys only for a child relationship or an age under 13.',
  'Stay within the occasion budget and do not repeat past gifts.',
  'Be specific but not brand-dependent.',
  'Reply with JSON {"ideas":[{"title":"...","priceMin":60,"priceMax":120,"reason":"...","searchQuery":"..."}]} containing exactly 5 ideas.',
  'priceMin and priceMax are positive whole dollars.',
  'Each reason is one plain warm sentence. Vary the wording: the five reasons must not share the same opening or the same sentence shape.',
  'searchQuery is 3 to 6 words. No preamble.',
].join(' ');

function userContent(prompt: IdeaPrompt): string {
  const shaped = modelPrompt(prompt);
  const relationship = shaped.relationship?.trim() || 'unspecified';
  const age = shaped.age == null ? 'unknown' : String(shaped.age);
  const lead = `Relationship: ${relationship}. Age: ${age}. Use this relationship and age as the life stage before any other field.`;
  return `${lead}\n${JSON.stringify(shaped)}`;
}

export async function requestIdeas(apiKey: string, model: string, prompt: IdeaPrompt): Promise<GiftIdea[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        { role: 'user', content: userContent(prompt) },
      ],
    }),
  });
  if (!response.ok) {
    let message = '';
    try {
      const failed = await response.json() as { error?: { message?: unknown } };
      message = typeof failed.error?.message === 'string' ? failed.error.message : '';
    } catch {
      message = '';
    }
    console.error('openai request failed', { status: response.status, message });
    throw new Error(`openai_${response.status}`);
  }
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return parseIdeas(body.choices?.[0]?.message?.content ?? '');
}
