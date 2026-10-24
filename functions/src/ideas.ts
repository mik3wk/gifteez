export type IdeaPrompt = {
  name?: string;
  occasion?: string | null;
  tags?: string[];
  budgetCents?: number | null;
  year?: number;
  likes?: string[];
  dislikes?: string[];
};

export function parseIdeas(content: string): string[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed) as { ideas?: unknown };
    if (Array.isArray(parsed.ideas)) {
      return parsed.ideas.map(item => String(item).trim()).filter(Boolean).slice(0, 5);
    }
  } catch {
    // Fall through to a line split when the model skips JSON.
  }
  return trimmed
    .split('\n')
    .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function promptHash(personId: string, prompt: IdeaPrompt): string {
  return JSON.stringify({
    personId,
    name: prompt.name ?? '',
    occasion: prompt.occasion ?? '',
    tags: [...(prompt.tags ?? [])].sort(),
    budgetCents: prompt.budgetCents ?? null,
    year: prompt.year ?? null,
    likes: [...(prompt.likes ?? [])].sort(),
    dislikes: [...(prompt.dislikes ?? [])].sort(),
  });
}

export async function requestIdeas(apiKey: string, model: string, prompt: IdeaPrompt): Promise<string[]> {
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
          content: 'You suggest practical gift ideas. Reply with JSON {"ideas":["..."]} containing exactly 5 short ideas. No preamble.',
        },
        { role: 'user', content: JSON.stringify(prompt) },
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
