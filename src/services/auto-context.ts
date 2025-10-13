import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import Anthropic from '@anthropic-ai/sdk';
import {
  ContextDiscoveryRequest,
  ContextDiscoveryResponse,
  DiscoveredFile,
  FileContext,
  GatheredContext
} from '../types';

const execAsync = promisify(exec);

export class AutoContextService {
  private fileTreeCache: Map<string, { tree: string; timestamp: number }> = new Map();
  private readonly FILE_TREE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private claudeClient: Anthropic | null = null;

  /**
   * Initialize Claude client (called from main process with API key)
   */
  initClaude(apiKey: string): void {
    this.claudeClient = new Anthropic({ apiKey });
  }

  /**
   * Main entry point: discover relevant context from raw text
   */
  async discoverContext(
    rawText: string,
    projectRoot: string
  ): Promise<GatheredContext> {
    throw new Error('Not implemented yet');
  }

  /**
   * Generate file tree using tree command (cached for 5 minutes)
   */
  private async generateFileTree(
    projectRoot: string,
    maxDepth: number = 4
  ): Promise<string> {
    // Check cache
    const cached = this.fileTreeCache.get(projectRoot);
    const now = Date.now();
    if (cached && now - cached.timestamp < this.FILE_TREE_CACHE_TTL) {
      return cached.tree;
    }

    // Try tree command first
    try {
      const { stdout } = await execAsync(
        `tree -L ${maxDepth} -I "node_modules|.git|out|.webpack|.vite|coverage|dist" "${projectRoot}"`,
        { maxBuffer: 1024 * 1024 } // 1MB buffer
      );

      this.fileTreeCache.set(projectRoot, { tree: stdout, timestamp: now });
      return stdout;
    } catch (error) {
      // Fallback: use find command if tree not available
      try {
        const { stdout } = await execAsync(
          `find "${projectRoot}" -maxdepth ${maxDepth} -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/out/*" ! -path "*/.webpack/*"`,
          { maxBuffer: 1024 * 1024 }
        );

        this.fileTreeCache.set(projectRoot, { tree: stdout, timestamp: now });
        return stdout;
      } catch (fallbackError) {
        throw new Error(`Failed to generate file tree: ${(fallbackError as Error).message}`);
      }
    }
  }

  /**
   * Use Claude to select relevant files from the tree
   */
  private async selectFiles(
    fileTree: string,
    rawText: string
  ): Promise<ContextDiscoveryResponse> {
    if (!this.claudeClient) {
      throw new Error('Claude client not initialized. Call initClaude() first.');
    }

    const prompt = `You are helping a task manager analyze which source code files are relevant to a user's tasks.

FILE TREE:
${fileTree}

USER'S RAW TASKS:
${rawText}

Instructions:
1. Identify files explicitly mentioned with @ syntax (e.g., @src/App.tsx) - these MUST be included
2. Discover up to 8 additional files that would help analyze these tasks
3. Total budget: ~2000 lines of code across all files
4. For files likely >300 lines, set readFully=false and provide 2-4 specific keywords to grep

Return JSON only (no markdown):
{
  "explicit": ["path/from/@mentions"],
  "discovered": [
    {"file": "src/path/file.ts", "readFully": true},
    {"file": "src/large.ts", "readFully": false, "keywords": ["function", "export"]}
  ],
  "reasoning": "Brief explanation of why these files matter"
}`;

    try {
      const message = await this.claudeClient.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
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

      // Parse JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Claude did not return valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ContextDiscoveryResponse;

      // Validate structure
      if (!Array.isArray(parsed.explicit) || !Array.isArray(parsed.discovered)) {
        throw new Error('Invalid response structure from Claude');
      }

      return parsed;
    } catch (error) {
      console.error('Error selecting files with Claude:', error);
      // Return empty discovery on error (graceful degradation)
      return {
        explicit: [],
        discovered: [],
        reasoning: `Error: ${(error as Error).message}`
      };
    }
  }
}

export default new AutoContextService();
