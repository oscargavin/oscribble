import Anthropic from '@anthropic-ai/sdk';
import { ClaudeFormatResponse } from '../types';

const SYSTEM_PROMPT = `You are a task analysis assistant for software developers.

Given raw bullet-point tasks and code context, you should:
1. Parse tasks into structured categories (CRITICAL, PERFORMANCE, FEATURES)
2. Identify dependencies and blockers
3. Detect missing tasks based on code context
4. Suggest reordering for logical execution
5. Flag potential issues

Output JSON matching this schema:
{
  "sections": [{
    "category": string,
    "priority": string,
    "tasks": [{
      "text": string,
      "notes": string[],
      "blocked_by": string[],
      "needs": string[]
    }]
  }],
  "warnings": string[]
}

DO NOT include any text outside the JSON. Validate output is parseable.`;

export class ClaudeService {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey,
    });
  }

  /**
   * Format raw text with Claude
   */
  async formatTasks(
    rawText: string,
    contextStr: string
  ): Promise<ClaudeFormatResponse> {
    const prompt = `Raw tasks:
${rawText}

Context:
${contextStr}

Analyze and structure these tasks.`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract text content
      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const response: ClaudeFormatResponse = JSON.parse(jsonMatch[0]);
      return response;
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Failed to format tasks: ${error.message}`);
    }
  }

  /**
   * Stream format response (for future implementation)
   */
  async *streamFormatTasks(
    rawText: string,
    contextStr: string
  ): AsyncGenerator<string> {
    const prompt = `Raw tasks:
${rawText}

Context:
${contextStr}

Analyze and structure these tasks.`;

    try {
      const stream = await this.client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        stream: true,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (error) {
      console.error('Claude streaming error:', error);
      throw error;
    }
  }
}
