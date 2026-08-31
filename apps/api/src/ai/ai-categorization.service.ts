import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CategorizationCandidate {
  id: string;
  name: string;
}

export interface CategorizationResult {
  suggestedCategoryId?: string;
  suggestedKeywords?: string[];
  cleanedDescription?: string;
}

/**
 * AI may ONLY ever suggest — never decide (Rules 6-8, Section 11). This
 * service has no code path that can write price, quantity, or sku; the
 * caller is responsible for storing whatever comes back in the
 * aiSuggested* columns only, which the supplier must separately approve.
 *
 * Entirely optional: without ANTHROPIC_API_KEY configured, every call
 * here returns null and the import proceeds without AI suggestions —
 * never blocking on it, never inventing a result.
 */
@Injectable()
export class AiCategorizationService {
  private readonly logger = new Logger(AiCategorizationService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY'));
  }

  async categorize(
    product: { name: string; description?: string },
    categories: CategorizationCandidate[],
  ): Promise<CategorizationResult | null> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey || categories.length === 0) return null;

    const categoryList = categories.map((c) => `${c.id}: ${c.name}`).join('\n');
    const prompt = `You are categorizing an automotive parts product listing for a marketplace. Pick the single best-matching category ID from this list (or omit if none fit well), suggest up to 8 short search keywords, and lightly clean up the description for spelling/clarity WITHOUT changing its meaning.

Categories:
${categoryList}

Product name: ${product.name}
Product description: ${product.description ?? '(none provided)'}

Respond with ONLY a JSON object, no other text: {"categoryId": "<id or null>", "keywords": ["..."], "cleanedDescription": "<string or null>"}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        this.logger.warn(`AI categorization request failed: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as {
        content?: { type: string; text?: string }[];
      };
      const text = data.content?.find((block) => block.type === 'text')?.text;
      if (!text) return null;

      const jsonMatch = /\{[\s\S]*\}/.exec(text);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]) as {
        categoryId?: string | null;
        keywords?: string[];
        cleanedDescription?: string | null;
      };

      const validCategoryId = categories.some((c) => c.id === parsed.categoryId)
        ? (parsed.categoryId ?? undefined)
        : undefined;

      return {
        suggestedCategoryId: validCategoryId,
        suggestedKeywords: parsed.keywords?.slice(0, 8),
        cleanedDescription: parsed.cleanedDescription ?? undefined,
      };
    } catch (error) {
      this.logger.warn(
        `AI categorization threw: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
