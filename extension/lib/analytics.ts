import { Application } from './schemas/application';

export interface AnalyticsResult {
  totalApplications: number;
  responseRate: number; // percentage, e.g. 66.7
  averageDaysToFirstReply: number; // days
  applicationsOverTime: Array<{ date: string; count: number }>;
  statusFunnel: Array<{ status: string; count: number }>;
}

const RESPONSE_STATUSES = new Set(['interview', 'rejected', 'assessment', 'offer']);

export function computeAnalytics(applications: Application[]): AnalyticsResult {
  if (!applications || applications.length === 0) {
    return {
      totalApplications: 0,
      responseRate: 0,
      averageDaysToFirstReply: 0,
      applicationsOverTime: [],
      statusFunnel: [
        { status: 'applied', count: 0 },
        { status: 'assessment', count: 0 },
        { status: 'interview', count: 0 },
        { status: 'offer', count: 0 },
        { status: 'rejected', count: 0 },
      ],
    };
  }

  const total = applications.length;
  let respondedCount = 0;
  let totalDaysToReply = 0;

  // Track counts per date
  const dateCounts: Record<string, number> = {};

  // Track status funnel counts
  const funnelMap: Record<string, number> = {
    applied: 0,
    assessment: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
  };

  for (const app of applications) {
    // Funnel count for current status
    if (app.status in funnelMap) {
      funnelMap[app.status]++;
    } else {
      funnelMap[app.status] = 1;
    }

    // Applications over time
    const dateStr = app.applied_at ? app.applied_at.substring(0, 10) : 'unknown';
    dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;

    // Check response
    const appliedTime = new Date(app.applied_at).getTime();
    let firstReplyTime: number | null = null;

    if (app.status_history && app.status_history.length > 0) {
      for (const h of app.status_history) {
        if (RESPONSE_STATUSES.has(h.status)) {
          const t = new Date(h.at).getTime();
          if (!firstReplyTime || t < firstReplyTime) {
            firstReplyTime = t;
          }
        }
      }
    } else if (RESPONSE_STATUSES.has(app.status)) {
      firstReplyTime = Date.now();
    }

    if (firstReplyTime !== null) {
      respondedCount++;
      const days = Math.max(0, (firstReplyTime - appliedTime) / (1000 * 60 * 60 * 24));
      totalDaysToReply += days;
    }
  }

  const responseRate = total > 0 ? (respondedCount / total) * 100 : 0;
  const averageDaysToFirstReply = respondedCount > 0 ? totalDaysToReply / respondedCount : 0;

  const applicationsOverTime = Object.keys(dateCounts)
    .sort()
    .map((date) => ({ date, count: dateCounts[date] }));

  // Fixed order funnel
  const statusFunnel = [
    { status: 'applied', count: total },
    { status: 'assessment', count: funnelMap['assessment'] || 0 },
    { status: 'interview', count: funnelMap['interview'] || 0 },
    { status: 'offer', count: funnelMap['offer'] || 0 },
    { status: 'rejected', count: funnelMap['rejected'] || 0 },
  ];

  return {
    totalApplications: total,
    responseRate,
    averageDaysToFirstReply,
    applicationsOverTime,
    statusFunnel,
  };
}
