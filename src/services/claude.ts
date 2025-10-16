import Anthropic from '@anthropic-ai/sdk';
import { ClaudeFormatResponse, TaskNode, ProjectType } from '../types';
import { filterRelevantTasks, buildTaskContext, extractKeywords } from '../utils/contextManager';
import { getModelApiString, ModelId } from '../config/models';

const SYSTEM_PROMPT = `You are a task analysis assistant for software developers.

Given raw bullet-point tasks and code context, you should:
1. Parse tasks and assign priorities (HIGH, MEDIUM, LOW) based on urgency and impact
2. Identify dependencies and blockers
3. Detect missing tasks based on code context
4. Suggest reordering for logical execution
5. Flag potential issues
6. Extract deadlines, effort estimates, and tags from task descriptions

Priority Guidelines:
- HIGH: Urgent tasks, critical bugs, blockers, or tasks with immediate deadlines
- MEDIUM: Important features, performance improvements, or tasks with near-term deadlines
- LOW: Nice-to-have features, refactoring, documentation, or tasks without deadlines

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
    "priority": "high" | "medium" | "low",  // Task priority level
    "tasks": [{
      "text": string,
      "title": "short-kebab-case-identifier",         // Unique slug for dependencies
      "notes": ["insight1", "insight2"],              // Array of strings
      "blocked_by": ["task_id1", "task_id2"],        // Legacy (use depends_on)
      "depends_on": ["existing-task-title", 0],      // Task dependencies (by title or index)
      "related_to": ["another-task-title", 1],       // Related tasks (by title or index)
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

## Task Titles & Dependencies

Each task should have a unique "title" field - a short kebab-case identifier (e.g., "fix-auth-bug", "add-dark-mode").

When referencing dependencies:
- For existing tasks: Use their "title" from the context (e.g., depends_on: ["setup-database", "create-schema"])
- For new tasks in the same batch: Use array index (e.g., if task 3 depends on task 0, use depends_on: [0])
- Mix both: depends_on: ["existing-task-title", 2] is valid

Generate meaningful titles that describe the task essence, not generic names like "task-1".

IMPORTANT JSON FORMATTING:
- ALL array fields (notes, blocked_by, depends_on, related_to, needs, tags, warnings) MUST be proper JSON arrays
- DO NOT use comma-separated strings - use ["item1", "item2"] format
- **ESCAPE ALL SPECIAL CHARACTERS**: When including URLs, quotes, or text from web search:
  - Use \\" for quotes within strings
  - Use \\\\ for backslashes
  - Ensure all strings are properly escaped JSON
  - Example: "Visit \\"Official Site\\" at https://example.com"
- Extract deadlines from phrases like "by Friday", "due 1/15", "deadline: tomorrow"
- Extract estimates from phrases like "should take 2 hours", "~3 days", "quick fix"
- Extract tags from context (e.g., "UI work" → ["ui"], "fix bug in API" → ["bug", "api"])
- Only include optional fields if information exists
- DO NOT include any text outside the JSON
- **OUTPUT MUST BE VALID, PARSEABLE JSON** - test your output before returning it

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

const LIFE_ADMIN_SYSTEM_PROMPT = `You are a task breakdown assistant for personal life management.

Given raw task descriptions, you should:
1. Break down high-level tasks into concrete, actionable steps
2. Identify sequential dependencies (most life admin follows a linear flow)
3. Assign priorities based on urgency and importance
4. Suggest realistic deadlines based on common timelines
5. Create detailed subtasks that can be checked off one by one

## Web Search Tool - USE LIBERALLY

**You have access to web search. Use it whenever you're uncertain about specific details.**

If you find yourself about to give generic advice like:
- "Processing typically takes several weeks" → SEARCH for exact timelines
- "Contact the relevant agency" → SEARCH for specific contact info/URLs
- "Costs may vary" → SEARCH for current exact costs
- "Check requirements" → SEARCH for specific requirements
- "Deadlines apply" → SEARCH for exact deadlines

**When to search:**
- Government processes (passports, visas, licenses, permits, registrations)
- Legal requirements, forms, and official procedures
- Tax deadlines, filing requirements, and current rules
- Healthcare enrollment periods, insurance requirements
- Current costs, fees, processing times for any official process
- Service providers, operating hours, contact information
- ANY task where you'd give a vague answer without searching

**Prefer authoritative sources**: .gov websites, official agencies, established institutions.

**Search proactively** - don't guess when you can know. Better to search once and give accurate specifics than provide generic placeholders.

Priority Guidelines:
- HIGH: Time-sensitive, legal deadlines, health-related, blocking other tasks
- MEDIUM: Important but flexible timeline, household maintenance, routine errands
- LOW: Aspirational goals, non-urgent improvements, optional tasks

Categories:
- FINANCE: Taxes, bills, investments, insurance, banking
- HEALTH: Appointments, prescriptions, insurance, fitness
- HOUSEHOLD: Repairs, maintenance, cleaning, organization
- LEGAL: Documents, renewals, compliance, official paperwork
- PERSONAL: Learning, hobbies, goals, relationships
- ERRANDS: Shopping, pickups, returns, deliveries

Task Breakdown Philosophy:
- Create MORE subtasks than you would for code projects
- Each subtask should be a single concrete action (e.g., "Call DMV", not "Handle DMV stuff")
- Subtasks should be sequential - each depends on the previous one completing
- Include helpful context in notes (e.g., "Most DMVs require 2-3 week lead time")
- Suggest specific deadlines when known (e.g., tax deadlines, document expirations)
- When using web search, include specific URLs, costs, and current requirements in notes

When input is from speech-to-text (isVoiceInput=true):
- Be lenient with grammar and conversational patterns
- Extract discrete tasks from natural speech
- Convert conversational language to concise descriptions

Output JSON with STRUCTURED ARRAYS:
{
  "sections": [{
    "category": "FINANCE" | "HEALTH" | "HOUSEHOLD" | "LEGAL" | "PERSONAL" | "ERRANDS",
    "priority": "high" | "medium" | "low",
    "tasks": [{
      "text": string,
      "title": "short-kebab-case-identifier",
      "notes": ["helpful tip 1", "helpful tip 2"],
      "blocked_by": [],  // Not used for life admin (sequential only)
      "depends_on": [],  // Not used for life admin (sequential only)
      "related_to": [],  // Can reference other tasks
      "needs": ["requirement1"],
      "deadline": "2025-01-15" | "next week",
      "effort_estimate": "30m" | "2h" | "1d",
      "tags": ["urgent", "phone-call"],
      "subtasks": [{
        "text": "Step 1: Concrete action",
        "notes": ["Why this matters"],
        "deadline": "before main task",
        "effort_estimate": "15m"
      }]
    }]
  }],
  "warnings": ["warning1"],
  "context_used": []  // Always empty for life admin
}

IMPORTANT JSON FORMATTING:
- ALL array fields MUST be proper JSON arrays (not comma-separated strings)
- **CRITICAL**: When including URLs or text from web search results:
  - Do NOT include any quotes, apostrophes, or special chars that would break JSON
  - URLs should be plain without escaping: "Visit https://dfa.ie/passports"
  - Avoid quotes in text: use "DFA website" NOT "DFA's website"
  - If you must include quotes, use single quotes in the display text
  - Keep notes simple and JSON-safe

Example of CORRECT formatting:
{
  "text": "Apply for Irish passport online",
  "notes": [
    "Visit https://www.dfa.ie/passports for application",
    "Standard processing: 10 working days",
    "Cost: 75 EUR for standard passport",
    "Photos must be taken within last 6 months"
  ]
}

- Subtasks should be GRANULAR and SEQUENTIAL
- Each subtask is ONE action that can be checked off
- Don't reference files or code - focus on real-world actions
- When using web search, include specific URLs, costs, and requirements in notes
- Suggest specific deadlines when you know them (tax day, DMV renewal periods, etc.)
- **OUTPUT MUST BE VALID, PARSEABLE JSON** - double-check syntax before returning`;

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
    isVoiceInput = false,
    projectType: ProjectType = 'code',
    recentCompletions?: Array<{
      task_id: string;
      text: string;
      estimated_time?: string;
      actual_time: number;
      completed_at: number;
    }>,
    existingTasks?: TaskNode[],
    userContext?: string,
    modelId?: ModelId,
    userLocation?: {
      city?: string;
      region?: string;
      country?: string;
    },
    taskGenPreferences?: {
      analysisStyle?: 'minimal' | 'contextual' | 'analytical' | 'prescriptive';
      suggestSolutions?: boolean;
      autoDetectMissingTasks?: boolean;
      enableWebSearch?: boolean;
    }
  ): Promise<ClaudeFormatResponse> {
    // Build few-shot examples from recent completions if available
    let completionExamples = '';
    if (recentCompletions && recentCompletions.length > 0) {
      completionExamples = '\n\nRecent task completions for time estimate calibration:\n';
      for (const completion of recentCompletions) {
        const actualHours = completion.actual_time / (1000 * 60 * 60);
        const actualFormatted = actualHours < 1
          ? `${(completion.actual_time / (1000 * 60)).toFixed(0)}m`
          : `${actualHours.toFixed(1)}h`;

        completionExamples += `- Task: "${completion.text}"\n`;
        completionExamples += `  Estimated: ${completion.estimated_time || 'none'}\n`;
        completionExamples += `  Actual: ${actualFormatted}\n`;
      }
      completionExamples += '\nUse these examples to calibrate your effort estimates for similar tasks.\n';
    }

    // Filter and compress existing tasks for context
    let taskContext = '';
    if (existingTasks && existingTasks.length > 0) {
      const keywords = extractKeywords(rawText);
      const relevantTasks = filterRelevantTasks(existingTasks, keywords, {
        maxTasks: 50,
        includeDays: 7,
      });
      taskContext = buildTaskContext(relevantTasks);
    }

    const prompt = `Raw tasks${isVoiceInput ? ' (from voice transcription)' : ''}:
${rawText}

Code context:
${contextStr}${completionExamples}${taskContext}

Analyze and structure these tasks.`;

    try {
      // Select appropriate system prompt based on project type
      let systemPrompt = projectType === 'life_admin'
        ? LIFE_ADMIN_SYSTEM_PROMPT
        : SYSTEM_PROMPT;

      // Apply task generation preferences to modify the prompt
      const prefs = taskGenPreferences || {};
      const analysisStyle = prefs.analysisStyle || 'analytical';
      const suggestSolutions = prefs.suggestSolutions !== false; // Default true
      const autoDetectMissingTasks = prefs.autoDetectMissingTasks !== false; // Default true

      // Modify prompt based on analysis style
      if (projectType === 'code') {
        if (analysisStyle === 'minimal') {
          // Minimal: Just parse and structure
          systemPrompt = systemPrompt.replace(
            'Given raw bullet-point tasks and code context, you should:\n1. Parse tasks and assign priorities (HIGH, MEDIUM, LOW) based on urgency and impact\n2. Identify dependencies and blockers\n3. Detect missing tasks based on code context\n4. Suggest reordering for logical execution\n5. Flag potential issues\n6. Extract deadlines, effort estimates, and tags from task descriptions',
            'Given raw bullet-point tasks, you should:\n1. Parse tasks and assign priorities (HIGH, MEDIUM, LOW) based on urgency\n2. Extract deadlines, effort estimates, and tags from task descriptions'
          );
        } else if (analysisStyle === 'contextual') {
          // Contextual: Add file references for MCP workflows
          systemPrompt = systemPrompt.replace(
            'Given raw bullet-point tasks and code context, you should:\n1. Parse tasks and assign priorities (HIGH, MEDIUM, LOW) based on urgency and impact\n2. Identify dependencies and blockers\n3. Detect missing tasks based on code context\n4. Suggest reordering for logical execution\n5. Flag potential issues\n6. Extract deadlines, effort estimates, and tags from task descriptions',
            'Given raw bullet-point tasks and code context, you should:\n1. Parse tasks and assign priorities (HIGH, MEDIUM, LOW) based on urgency\n2. Identify relevant code files for context\n3. Extract deadlines, effort estimates, and tags from task descriptions\n\nIMPORTANT: Focus on identifying which files are relevant to each task. Add file paths to the notes array for MCP agent workflows.'
          );
        } else if (analysisStyle === 'prescriptive') {
          // Prescriptive: Include detailed solution suggestions
          systemPrompt = systemPrompt.replace(
            'Given raw bullet-point tasks and code context, you should:\n1. Parse tasks and assign priorities (HIGH, MEDIUM, LOW) based on urgency and impact\n2. Identify dependencies and blockers\n3. Detect missing tasks based on code context\n4. Suggest reordering for logical execution\n5. Flag potential issues\n6. Extract deadlines, effort estimates, and tags from task descriptions',
            'Given raw bullet-point tasks and code context, you should:\n1. Parse tasks and assign priorities (HIGH, MEDIUM, LOW) based on urgency and impact\n2. Identify dependencies and blockers\n3. Detect missing tasks based on code context\n4. Suggest reordering for logical execution\n5. Flag potential issues\n6. Extract deadlines, effort estimates, and tags from task descriptions\n7. Suggest specific implementation approaches and solutions in the notes'
          );
        }
        // For 'analytical' (default), use the prompt as-is

        // Toggle suggest solutions
        if (!suggestSolutions && analysisStyle !== 'prescriptive') {
          // Remove solution-focused language from notes
          systemPrompt = systemPrompt + '\n\nIMPORTANT: In task notes, focus on context and requirements rather than implementation solutions.';
        }

        // Toggle auto-detect missing tasks
        if (!autoDetectMissingTasks) {
          systemPrompt = systemPrompt.replace('3. Detect missing tasks based on code context\n', '');
        }
      }

      // Prepend date/time and user context to life admin prompt
      if (projectType === 'life_admin') {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        let contextPrefix = `Current date: ${dateStr}\nCurrent time: ${timeStr}\n\n`;

        if (userContext) {
          contextPrefix += `User context:\n${userContext}\n\n`;
        }

        systemPrompt = contextPrefix + systemPrompt;
      }

      // Build tools array for life admin (web search)
      const tools: any[] = [];
      const enableWebSearch = prefs.enableWebSearch !== false; // Default true
      if (projectType === 'life_admin' && enableWebSearch) {
        const webSearchTool: any = {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 3,
        };

        // Add user location if available
        if (userLocation && (userLocation.city || userLocation.region || userLocation.country)) {
          webSearchTool.user_location = {
            type: 'approximate',
            city: userLocation.city,
            region: userLocation.region,
            country: userLocation.country,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          };
        }

        tools.push(webSearchTool);
      }

      // Use prompt caching for cost efficiency
      // Increase max_tokens for life admin (web search responses are longer)
      const maxTokens = projectType === 'life_admin' ? 8000 : 4000;

      const message = await this.client.messages.create({
        model: getModelApiString(modelId),
        max_tokens: maxTokens,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' as const }
          }
        ],
        tools: tools.length > 0 ? tools : undefined,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              }
            ],
          },
        ],
      });

      // Extract citations from all content blocks (web search results)
      const citations: { [index: string]: { url: string; title: string } } = {};

      // Extract text content (handle multiple content blocks from web search)
      // With web search, content array may have: text, server_tool_use, web_search_tool_result, text (final)
      // We want the LAST text block which contains the structured JSON
      let textContent: string | null = null;
      let searchCount = 0;

      for (let blockIndex = 0; blockIndex < message.content.length; blockIndex++) {
        const block = message.content[blockIndex];
        if (block.type === 'text') {
          textContent = block.text;
          // Extract citations from this text block if present
          if ('citations' in block && Array.isArray(block.citations)) {
            for (let citIndex = 0; citIndex < block.citations.length; citIndex++) {
              const citation = block.citations[citIndex];
              if (citation.type === 'web_search_result_location') {
                // Create index key matching the <cite index="..."> format
                const indexKey = `${blockIndex}-${citIndex}`;
                citations[indexKey] = {
                  url: citation.url,
                  title: citation.title
                };
              }
            }
          }
          // Don't break - keep looking for the last text block
        } else if (block.type === 'web_search_tool_result') {
          searchCount++;
        }
      }

      // Log search usage for debugging
      if (searchCount > 0) {
        console.log(`🔍 Claude performed ${searchCount} web search(es) for this task`);
        console.log(`📚 Extracted ${Object.keys(citations).length} citations`);
      }

      if (!textContent) {
        throw new Error('No text content found in Claude response');
      }

      // Parse JSON response
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Claude response text:', textContent);
        throw new Error('No JSON found in Claude response');
      }

      try {
        const response: ClaudeFormatResponse = JSON.parse(jsonMatch[0]);

        // Attach citations to response if any were found
        if (Object.keys(citations).length > 0) {
          (response as any).citations = citations;
        }

        return response;
      } catch (parseError) {
        console.error('JSON parse error:', parseError.message);
        console.error('Problematic JSON (first 500 chars):', jsonMatch[0].substring(0, 500));
        console.error('Around error position:', jsonMatch[0].substring(Math.max(0, 18152 - 100), 18152 + 100));
        throw new Error(`Invalid JSON from Claude: ${parseError.message}`);
      }
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
        model: getModelApiString(),
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
