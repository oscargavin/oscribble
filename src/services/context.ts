import { promises as fs } from 'fs';
import * as path from 'path';
import { FileContext, GatheredContext } from '../types';
import AutoContextService from './auto-context';

const MAX_FILE_SIZE = 50 * 1024; // 50KB limit per file
const MAX_DEPTH = 3;
const MAX_FILES_PER_MENTION = 10;

export class ContextService {
  /**
   * Gather context from @mentions in raw text
   */
  static async gatherContext(
    rawText: string,
    projectRoot: string
  ): Promise<Map<string, FileContext>> {
    const mentions = this.extractMentions(rawText);
    const context = new Map<string, FileContext>();

    for (const mention of mentions) {
      try {
        await this.loadFileWithDeps(mention, projectRoot, context, 0);
      } catch (error) {
        console.error(`Failed to load context for ${mention}:`, error);
      }
    }

    return context;
  }

  /**
   * Extract @mentions from text
   */
  static extractMentions(text: string): string[] {
    const regex = /@[\w\/\-\.]+/g;
    const matches = text.match(regex) || [];
    return Array.from(new Set(matches)); // Remove duplicates
  }

  /**
   * Load a file and its dependencies recursively
   */
  private static async loadFileWithDeps(
    mention: string,
    projectRoot: string,
    context: Map<string, FileContext>,
    depth: number
  ): Promise<void> {
    if (depth >= MAX_DEPTH || context.has(mention)) {
      return;
    }

    const resolvedPath = path.join(projectRoot, mention.slice(1)); // Remove @

    try {
      // Check file size
      const stats = await fs.stat(resolvedPath);
      if (stats.size > MAX_FILE_SIZE) {
        console.warn(`File ${mention} exceeds size limit, truncating...`);
      }

      // Read file content
      let content = await fs.readFile(resolvedPath, 'utf-8');

      // Truncate if too large
      if (content.length > MAX_FILE_SIZE) {
        content = content.slice(0, MAX_FILE_SIZE) + '\n... [truncated]';
      }

      // Parse imports/dependencies
      const dependencies = this.parseImports(content, resolvedPath, projectRoot);

      // Add to context
      context.set(mention, {
        path: mention,
        content,
        dependencies,
      });

      // Recursively load dependencies (limited)
      for (const dep of dependencies.slice(0, MAX_FILES_PER_MENTION)) {
        await this.loadFileWithDeps(dep, projectRoot, context, depth + 1);
      }
    } catch (error) {
      console.error(`Error loading file ${mention}:`, error);
      // Add error context
      context.set(mention, {
        path: mention,
        content: `Error loading file: ${error.message}`,
      });
    }
  }

  /**
   * Parse imports from file content
   */
  private static parseImports(
    content: string,
    filePath: string,
    projectRoot: string
  ): string[] {
    const imports: string[] = [];
    const dir = path.dirname(filePath);

    // Match various import patterns
    const patterns = [
      // ES6 imports
      /import\s+.*\s+from\s+['"](.+?)['"]/g,
      /import\s+['"](.+?)['"]/g,
      // CommonJS requires
      /require\s*\(\s*['"](.+?)['"]\s*\)/g,
      // TypeScript imports
      /import\s+type\s+.*\s+from\s+['"](.+?)['"]/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1];

        // Skip node_modules and absolute imports
        if (importPath.startsWith('.')) {
          try {
            // Resolve relative import
            let resolvedPath = path.resolve(dir, importPath);

            // Try adding extensions if file doesn't exist
            const extensions = ['', '.ts', '.tsx', '.js', '.jsx'];
            let found = false;

            for (const ext of extensions) {
              const testPath = resolvedPath + ext;
              try {
                // Check if file exists (synchronously for simplicity in parsing)
                const relativePath = path.relative(projectRoot, testPath);
                if (!relativePath.startsWith('..')) {
                  imports.push(`@${relativePath}`);
                  found = true;
                  break;
                }
              } catch {
                // Continue to next extension
              }
            }

            // Try index files if directory
            if (!found) {
              for (const ext of ['/index.ts', '/index.tsx', '/index.js']) {
                const testPath = resolvedPath + ext;
                const relativePath = path.relative(projectRoot, testPath);
                if (!relativePath.startsWith('..')) {
                  imports.push(`@${relativePath}`);
                  break;
                }
              }
            }
          } catch (error) {
            // Ignore resolution errors
          }
        }
      }
    }

    return Array.from(new Set(imports)); // Remove duplicates
  }

  /**
   * Format context for Claude prompt
   */
  static formatContextForPrompt(context: Map<string, FileContext>): string {
    const entries: string[] = [];

    for (const [path, fileContext] of context.entries()) {
      entries.push(`File: ${path}\n\`\`\`\n${fileContext.content}\n\`\`\``);
    }

    return entries.join('\n\n');
  }

  /**
   * Unified context gathering: @mentions + auto-discovery
   */
  static async gatherProjectContext(
    rawText: string,
    projectRoot: string
  ): Promise<GatheredContext> {
    // Check feature flag
    const autoContextEnabled = process.env.ENABLE_AUTO_CONTEXT !== 'false';

    if (!autoContextEnabled) {
      // Fall back to explicit @mentions only
      const explicitContext = await this.gatherContext(rawText, projectRoot);
      const contextStr = this.formatContextForPrompt(explicitContext);
      return {
        files: [
          {
            path: '@mentions',
            content: contextStr,
            lineCount: contextStr.split('\n').length,
            wasGrepped: false
          }
        ],
        totalLines: contextStr.split('\n').length,
        cacheHits: 0,
        cacheMisses: 1
      };
    }

    // Auto-discovery enabled
    const autoContext = await AutoContextService.discoverContext(rawText, projectRoot);

    // Also gather explicit @mentions (legacy support)
    const explicitContext = await this.gatherContext(rawText, projectRoot);
    const contextStr = this.formatContextForPrompt(explicitContext);

    // Merge contexts
    if (contextStr && contextStr.trim().length > 0) {
      autoContext.files.unshift({
        path: '@mentions (explicit)',
        content: contextStr,
        lineCount: contextStr.split('\n').length,
        wasGrepped: false
      });
      autoContext.totalLines += contextStr.split('\n').length;
    }

    return autoContext;
  }
}
