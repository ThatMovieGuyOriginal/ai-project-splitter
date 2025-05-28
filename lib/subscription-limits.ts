// lib/subscription-limits.ts
export const SUBSCRIPTION_LIMITS = {
  free: {
    repositories: 3,
    analysesPerMonth: 10,
    historyDays: 30,
    features: ['basic_metrics', 'github_sync'],
  },
  pro: {
    repositories: 50,
    analysesPerMonth: 200,
    historyDays: 365,
    features: ['basic_metrics', 'github_sync', 'advanced_insights', 'pdf_reports', 'trend_analysis'],
  },
  team: {
    repositories: 200,
    analysesPerMonth: 1000,
    historyDays: 730,
    features: ['basic_metrics', 'github_sync', 'advanced_insights', 'pdf_reports', 'trend_analysis', 'team_collaboration', 'custom_rules'],
  },
} as const;

export function canUserPerformAction(
  userTier: 'free' | 'pro' | 'team',
  action: 'add_repository' | 'run_analysis',
  currentUsage: { repositories: number; analysesThisMonth: number }
): boolean {
  const limits = SUBSCRIPTION_LIMITS[userTier];
  
  switch (action) {
    case 'add_repository':
      return currentUsage.repositories < limits.repositories;
    case 'run_analysis':
      return currentUsage.analysesThisMonth < limits.analysesPerMonth;
    default:
      return false;
  }
}
