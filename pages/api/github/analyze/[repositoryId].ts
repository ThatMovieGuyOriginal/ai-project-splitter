// pages/api/github/analyze/[repositoryId].ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';
import { GitHubService } from '../../../../lib/github';
import { db } from '../../../../lib/db';
import { repositories, repositoryAnalyses, users, usageTracking } from '../../../../lib/db/schema';
import { eq, and, gte } from 'drizzle-orm';
import { canUserPerformAction } from '../../../../lib/subscription-limits';
import { CodeAnalyzer } from '../../../../src/core/analyzer';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { archiveExtractor } from '../../../../utils/archive-extractor';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { repositoryId } = req.query;

  try {
    // Get repository
    const [repo] = await db
      .select()
      .from(repositories)
      .where(and(
        eq(repositories.id, repositoryId as string),
        eq(repositories.userId, session.user.id)
      ))
      .limit(1);

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Check subscription limits
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // Get this month's analyses
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthAnalyses = await db
      .select()
      .from(repositoryAnalyses)
      .where(and(
        eq(repositoryAnalyses.userId, session.user.id),
        gte(repositoryAnalyses.createdAt, startOfMonth)
      ));

    if (!canUserPerformAction(
      user.subscriptionTier || 'free',
      'run_analysis',
      { repositories: 0, analysesThisMonth: thisMonthAnalyses.length }
    )) {
      return res.status(403).json({ 
        error: 'Analysis limit reached for your subscription tier',
        limit: true 
      });
    }

    // Get GitHub service
    const github = await GitHubService.fromSession(req, res);
    if (!github) {
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    // Download repository archive
    const [owner, repoName] = repo.fullName.split('/');
    const archiveBuffer = await github.downloadRepositoryArchive(owner, repoName);

    // Create temp directory and extract
    const tempDir = await mkdtemp(join(tmpdir(), 'github-analysis-'));
    const archivePath = join(tempDir, 'repo.zip');
    await writeFile(archivePath, archiveBuffer);

    const extractDir = join(tempDir, 'extracted');
    const extractedFiles = await archiveExtractor.extractArchive(archivePath, extractDir);

    // Run analysis
    const analyzer = new CodeAnalyzer();
    const analysisResult = await analyzer.analyzeProject(extractDir);

    // Calculate scores
    const overallScore = calculateOverallScore(analysisResult);
    const complexityGrade = calculateComplexityGrade(analysisResult.metadata.avgComplexity);
    const maintainabilityScore = calculateMaintainabilityScore(analysisResult);
    const securityRisk = calculateSecurityRisk(analysisResult);
    const technicalDebt = calculateTechnicalDebt(analysisResult);

    // Save analysis to database
    const [analysis] = await db
      .insert(repositoryAnalyses)
      .values({
        repositoryId: repo.id,
        userId: session.user.id,
        overallScore,
        complexityGrade,
        maintainabilityScore,
        securityRisk,
        technicalDebt,
        totalFiles: analysisResult.files.length,
        totalLinesOfCode: analysisResult.files.reduce((sum, f) => sum + f.loc, 0),
        averageComplexity: analysisResult.metadata.avgComplexity.toString(),
        fileAnalyses: analysisResult.files,
        clusters: analysisResult.clusters,
        dependencies: analysisResult.depGraph,
        recommendations: generateRecommendations(analysisResult),
      })
      .returning();

    // Update repository last analyzed
    await db
      .update(repositories)
      .set({
        lastAnalyzedAt: new Date(),
        analysisCount: repo.analysisCount + 1,
      })
      .where(eq(repositories.id, repo.id));

    // Track usage
    await db.insert(usageTracking).values({
      userId: session.user.id,
      action: 'analysis',
      resourceId: repo.id,
      metadata: { repositoryName: repo.fullName },
    });

    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true });

    res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing repository:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
}

// Helper functions
function calculateOverallScore(result: any): number {
  const complexityScore = Math.max(0, 100 - result.metadata.avgComplexity * 2);
  const fileScore = Math.max(0, 100 - (result.files.length > 100 ? 20 : 0));
  const clusterScore = result.clusters.length > 0 ? 80 : 40;
  
  return Math.round((complexityScore * 0.5 + fileScore * 0.2 + clusterScore * 0.3));
}

function calculateComplexityGrade(avgComplexity: number): string {
  if (avgComplexity <= 5) return 'A';
  if (avgComplexity <= 10) return 'B';
  if (avgComplexity <= 20) return 'C';
  if (avgComplexity <= 35) return 'D';
  return 'F';
}

function calculateMaintainabilityScore(result: any): number {
  return Math.max(0, Math.min(100, 100 - result.metadata.avgComplexity * 2));
}

function calculateSecurityRisk(result: any): 'low' | 'medium' | 'high' | 'critical' {
  const avgComplexity = result.metadata.avgComplexity;
  if (avgComplexity > 50) return 'critical';
  if (avgComplexity > 30) return 'high';
  if (avgComplexity > 15) return 'medium';
  return 'low';
}

function calculateTechnicalDebt(result: any): number {
  return Math.round(result.metadata.avgComplexity * result.files.length / 10);
}

function generateRecommendations(result: any): string[] {
  const recommendations: string[] = [];
  
  if (result.metadata.avgComplexity > 20) {
    recommendations.push('Consider refactoring files with high complexity scores');
  }
  
  if (result.files.length > 100) {
    recommendations.push('Large codebase - consider modularization strategies');
  }
  
  if (result.clusters.length < 3) {
    recommendations.push('Code organization could benefit from better separation of concerns');
  }
  
  return recommendations;
}
