import Anthropic from '@anthropic-ai/sdk';
import { ClaudeFormatResponse } from '../types';

const SYSTEM_PROMPT = `You are a task analysis assistant for software developers.

Given raw bullet-point tasks and code context, you should:
1. Parse tasks into structured categories (CRITICAL, PERFORMANCE, FEATURES)
2. Identify dependencies and blockers
3. Detect missing tasks based on code context
4. Suggest reordering for logical execution
5. Flag potential issues
6. Extract deadlines, effort estimates, and tags from task descriptions

When input is from speech-to-text (isVoiceInput=true):
- Be lenient with grammar, filler words, and conversational patterns
- Extract discrete tasks from run-on sentences and natural speech
- Ignore filler words like "um", "uh", "like", "you know"
- Convert conversational language to concise task descriptions
- Example: "So um I need to like fix the login bug and then uh also we should add the dark mode"
  becomes two tasks: "Fix login bug" and "Add dark mode feature"

Output JSON with STRUCTURED ARRAYS (not comma-separated strings):

{
  "sections": [{
    "category": string,
    "priority": string,
    "tasks": [{
      "text": string,
      "notes": ["insight1", "insight2"],              // Array of strings
      "blocked_by": ["task_id1", "task_id2"],        // Legacy (use depends_on)
      "depends_on": ["task_id1", "task_id2"],        // Task dependencies
      "related_to": ["task_id1", "task_id2"],        // Related tasks
      "needs": ["requirement1", "requirement2"],     // Array of strings
      "deadline": "2025-01-15" | "next week",        // Optional: ISO or human
      "effort_estimate": "2h" | "1d" | "3 days",     // Optional: time estimate
      "tags": ["frontend", "api", "urgent"],         // Optional: category tags
      "subtasks": [/* nested ClaudeTask objects */]  // Optional: subtasks
    }]
  }],
  "warnings": ["warning1", "warning2"],              // Array of strings
  "context_used": [{                                 // Optional: files that informed analysis
    "file": "src/App.tsx",
    "reason": "Modified voice recording initialization"
  }]
}

IMPORTANT:
- ALL array fields (notes, blocked_by, depends_on, related_to, needs, tags, warnings) MUST be proper JSON arrays
- DO NOT use comma-separated strings - use ["item1", "item2"] format
- Extract deadlines from phrases like "by Friday", "due 1/15", "deadline: tomorrow"
- Extract estimates from phrases like "should take 2 hours", "~3 days", "quick fix"
- Extract tags from context (e.g., "UI work" → ["ui"], "fix bug in API" → ["bug", "api"])
- Only include optional fields if information exists
- DO NOT include any text outside the JSON
- Validate output is parseable JSON

## Context Usage Metadata

When you receive code context (either from @mentions or auto-discovered files), include the context_used field in your response to explain which files informed your analysis and why. This helps users understand how context influenced your task structuring decisions.

Example:
{
  "sections": [...],
  "tasks": [...],
  "warnings": [...],
  "context_used": [
    {"file": "src/App.tsx", "reason": "Analyzed voice recording initialization for bug fix task"},
    {"file": "src/hooks/useVoiceRecording.ts", "reason": "Core recording state management relevant to refactoring"},
    {"file": "src/services/storage.ts", "reason": "Current implementation for async/await migration"}
  ]
}

The context_used array should:
- List each file that influenced your task analysis
- Provide a brief reason explaining why that file was relevant
- Be omitted if no code context was provided
- Focus on files that directly informed priority, dependencies, or task structuring decisions`;

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
    contextStr: string,
    isVoiceInput: boolean = false
  ): Promise<ClaudeFormatResponse> {
    const prompt = `Raw tasks${isVoiceInput ? ' (from voice transcription)' : ''}:
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
