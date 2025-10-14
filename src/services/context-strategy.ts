import { GatheredContext, ProjectType, ContextStrategy } from '../types';

// Code project strategy - uses existing file discovery
export class CodeContextStrategy implements ContextStrategy {
  async gatherContext(rawText: string, projectRoot: string): Promise<GatheredContext> {
    // Call existing context gathering logic
    const result = await window.electronAPI.gatherProjectContext(rawText, projectRoot);

    if (!result.success || !result.data) {
      return {
        files: [],
        totalLines: 0,
        cacheHits: 0,
        cacheMisses: 0,
      };
    }

    return result.data;
  }

  getCategories(): string[] {
    return ['FEATURE', 'BUG', 'REFACTOR', 'ADMIN', 'DOCS', 'PERFORMANCE'];
  }

  shouldShowFileTree(): boolean {
    return true;
  }
}

// Life admin strategy - no file context
export class LifeAdminContextStrategy implements ContextStrategy {
  async gatherContext(rawText: string, projectRoot: string): Promise<GatheredContext> {
    // Return empty context for life admin projects
    return {
      files: [],
      totalLines: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  getCategories(): string[] {
    return ['FINANCE', 'HEALTH', 'HOUSEHOLD', 'LEGAL', 'PERSONAL', 'ERRANDS'];
  }

  shouldShowFileTree(): boolean {
    return false;
  }
}

// Factory function to get appropriate strategy
export function getContextStrategy(projectType: ProjectType): ContextStrategy {
  switch (projectType) {
    case 'code':
      return new CodeContextStrategy();
    case 'life_admin':
      return new LifeAdminContextStrategy();
    default:
      throw new Error(`Unknown project type: ${projectType}`);
  }
}
