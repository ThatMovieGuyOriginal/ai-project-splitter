// pages/api/github/repositories.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { GitHubService } from '../../../lib/github';
import { db } from '../../../lib/db';
import { repositories, users } from '../../../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { canUserPerformAction } from '../../../lib/subscription-limits';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const github = await GitHubService.fromSession(req, res);
      if (!github) {
        return res.status(400).json({ error: 'GitHub not connected' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const repos = await github.getUserRepositories(page, 30);

      // Get user's saved repositories
      const savedRepos = await db
        .select()
        .from(repositories)
        .where(eq(repositories.userId, session.user.id));

      const savedRepoIds = new Set(savedRepos.map(r => r.githubId));

      const enrichedRepos = repos.map(repo => ({
        ...repo,
        isSaved: savedRepoIds.has(repo.id),
        lastAnalyzed: savedRepos.find(r => r.githubId === repo.id)?.lastAnalyzedAt || null,
      }));

      res.json({ repositories: enrichedRepos });
    } catch (error) {
      console.error('Error fetching repositories:', error);
      res.status(500).json({ error: 'Failed to fetch repositories' });
    }
  } else if (req.method === 'POST') {
    // Add repository to tracking
    try {
      const { repositoryId } = req.body;

      if (!repositoryId) {
        return res.status(400).json({ error: 'Repository ID required' });
      }

      // Check subscription limits
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

      const userRepos = await db
        .select()
        .from(repositories)
        .where(and(
          eq(repositories.userId, session.user.id),
          eq(repositories.isActive, true)
        ));

      if (!canUserPerformAction(
        user.subscriptionTier || 'free',
        'add_repository',
        { repositories: userRepos.length, analysesThisMonth: 0 }
      )) {
        return res.status(403).json({ 
          error: 'Repository limit reached for your subscription tier',
          limit: true 
        });
      }

      const github = await GitHubService.fromSession(req, res);
      if (!github) {
        return res.status(400).json({ error: 'GitHub not connected' });
      }

      // Get repository details from GitHub
      const repos = await github.getUserRepositories();
      const repo = repos.find(r => r.id === repositoryId);

      if (!repo) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      // Check if already exists
      const existing = await db
        .select()
        .from(repositories)
        .where(and(
          eq(repositories.userId, session.user.id),
          eq(repositories.githubId, repositoryId)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Reactivate if inactive
        await db
          .update(repositories)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(repositories.id, existing[0].id));

        return res.json({ repository: existing[0] });
      }

      // Create new repository record
      const [newRepo] = await db
        .insert(repositories)
        .values({
          userId: session.user.id,
          githubId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          language: repo.language,
          isPrivate: repo.private,
          url: repo.html_url,
          defaultBranch: repo.default_branch,
        })
        .returning();

      res.json({ repository: newRepo });
    } catch (error) {
      console.error('Error adding repository:', error);
      res.status(500).json({ error: 'Failed to add repository' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
