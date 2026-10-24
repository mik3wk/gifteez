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
  /** Life stage when a number is missing or alongside it. Never a name. */
  ageBand?: 'baby' | 'kid' | 'teen' | 'adult' | null;
  /** Idea titles already on the phone. The model should not repeat them. */
  avoid?: string[];
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
    v: 5,
    personId,
    relationship: prompt.relationship ?? '',
    age: prompt.age ?? null,
    ageBand: prompt.ageBand ?? null,
    avoid: [...(prompt.avoid ?? [])].sort(),
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
    ageBand: prompt.ageBand ?? null,
    avoid: prompt.avoid ?? [],
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
  'Interests are the strongest signal. When interests are listed, every idea must match at least one of them.',
  'Do not let relationship, age, occasion, or budget pull an idea outside those interests.',
  'Read relationship and age next and treat them as the life stage, never as a reason to ignore interests.',
  'An adult sister, brother, parent, or partner is not a child and must not get kids\' toys, picture books, or playground gifts.',
  'A baby or kid age band must not get fragrance, jewelry, live shows, reservations, alcohol, or other adult-only gifts.',
  'Suggest toys only for a child relationship, a baby or kid age band, or an age under 13.',
  'Do not repeat any title listed under avoid.',
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
  const band = shaped.ageBand ?? 'unknown';
  const avoid = (shaped.avoid ?? []).filter(Boolean);
  const avoidLine = avoid.length ? ` Avoid these titles: ${avoid.join('; ')}.` : '';
  const tags = (shaped.tags ?? []).map(tag => tag.trim()).filter(Boolean);
  const interests = tags.length
    ? `Interests: ${tags.join(', ')}. These interests outrank every other field. Every idea must fit at least one interest.`
    : 'Interests: none given.';
  const lead = `${interests} Relationship: ${relationship}. Age: ${age}. Age band: ${band}. Use this relationship, age, and age band as the life stage, and do not let that life stage override the interests.${avoidLine}`;
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
