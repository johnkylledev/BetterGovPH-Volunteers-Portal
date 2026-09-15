/**
 * api/_lib/types.ts
 * Centralized type definitions for all API handlers
 */

/** Handler type: (req, res) => Promise<void> */
export type H = (req: any, res: any) => Promise<void>;

/** External project data structure (supports multiple schemas) */
export interface ExternalProject {
  slug?: string;
  title?: string;
  id?: string;
  project_name?: string;
  project_url?: string;
  description?: string | null;
  repositoryUrls?: string[];
  [k: string]: unknown;
}

/** GitHub repository reference */
export interface GithubRepo {
  owner: string;
  name: string;
}

/** Contributor statistics from GitHub */
export interface ContributorStats {
  login: string;
  commits: number;
  prs: number;
  reviews: number;
  issues: number;
  repos: string[];
}

/** Contributor with computed score */
export interface ContributorScore extends ContributorStats {
  score: number;
}

/** In-memory cache entry */
export interface MemoryCacheEntry {
  value: any;
  expiresAt: number;
}
