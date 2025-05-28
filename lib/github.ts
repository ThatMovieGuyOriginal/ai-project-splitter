// lib/github.ts
import { Octokit } from 'octokit';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { db } from './db';
import { accounts } from './db/schema';
import { eq } from 'drizzle-orm';

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  language: string | null;
  default_branch: string;
  size: number;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
}

export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  static async fromSession(req: any, res: any): Promise<GitHubService | null> {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session?.user?.id) {
      return null;
    }

    // Get GitHub access token
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, session.user.id))
      .where(eq(accounts.provider, 'github'))
      .limit(1);

    if (!account?.access_token) {
      return null;
    }

    return new GitHubService(account.access_token);
  }

  async getUserRepositories(page = 1, perPage = 30): Promise<GitHubRepository[]> {
    try {
      const response = await this.octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        direction: 'desc',
        per_page: perPage,
        page,
        type: 'all',
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching repositories:', error);
      throw new Error('Failed to fetch repositories from GitHub');
    }
  }

  async getRepositoryContents(owner: string, repo: string, path = '', ref?: string): Promise<any[]> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: ref || 'HEAD',
      });

      return Array.isArray(response.data) ? response.data : [response.data];
    } catch (error) {
      console.error('Error fetching repository contents:', error);
      throw new Error(`Failed to fetch contents for ${owner}/${repo}`);
    }
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: ref || 'HEAD',
      });

      if (Array.isArray(response.data) || response.data.type !== 'file') {
        throw new Error('Path does not point to a file');
      }

      if (response.data.encoding === 'base64') {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      return response.data.content;
    } catch (error) {
      console.error('Error fetching file content:', error);
      throw new Error(`Failed to fetch file content for ${path}`);
    }
  }

  async downloadRepositoryArchive(owner: string, repo: string, ref = 'HEAD'): Promise<Buffer> {
    try {
      const response = await this.octokit.rest.repos.downloadZipballArchive({
        owner,
        repo,
        ref,
      });

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      console.error('Error downloading repository archive:', error);
      throw new Error(`Failed to download archive for ${owner}/${repo}`);
    }
  }

  async getRepositoryLanguages(owner: string, repo: string): Promise<Record<string, number>> {
    try {
      const response = await this.octokit.rest.repos.listLanguages({
        owner,
        repo,
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching repository languages:', error);
      return {};
    }
  }

  async searchRepositoryFiles(
    owner: string, 
    repo: string, 
    query: string,
    extension?: string
  ): Promise<any[]> {
    try {
      let searchQuery = `repo:${owner}/${repo} ${query}`;
      if (extension) {
        searchQuery += ` extension:${extension}`;
      }

      const response = await this.octokit.rest.search.code({
        q: searchQuery,
        per_page: 100,
      });

      return response.data.items;
    } catch (error) {
      console.error('Error searching repository files:', error);
      return [];
    }
  }
}
