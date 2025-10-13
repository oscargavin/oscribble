import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
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
}

export default new AutoContextService();
