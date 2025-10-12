import { useState, useEffect, useCallback } from 'react';
import { ProjectSettings } from '../types';

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectSettings[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const allProjects = await window.electronAPI.getProjects();
      const sorted = allProjects.sort((a, b) => b.last_accessed - a.last_accessed);
      setProjects(sorted);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return { projects, loading, refreshProjects: loadProjects };
};
