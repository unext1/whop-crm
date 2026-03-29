import { eq } from 'drizzle-orm';
import { db } from '~/db';
import { organizationTable } from '~/db/schema';

type PromptCrmData = {
  tasks: Array<{ status: string; priority: string | null }>;
  deals: Array<{ status: string; amount: number | null }>;
  activities: Array<{ createdAt: string; activityType: string; description: string | null }>;
};

type BuildAiSummaryPromptArgs = {
  entityType: 'contact' | 'company';
  contextData: string;
  crmData: PromptCrmData;
};


export const getAiSummaryLimit = async (organizationId: string): Promise<number> => {
  const org = await db.query.organizationTable.findFirst({
    where: eq(organizationTable.id, organizationId),
  });
  if (!org) {
    console.warn('[ai-summary] getAiSummaryLimit: org not found', { organizationId });
    return 0;
  }

  if (org.trialEnd && !org.membershipId) {
    const trialEndDate = new Date(org.trialEnd);
    const now = new Date();
    if (now <= trialEndDate) {
      console.warn('[ai-summary] getAiSummaryLimit: trial', { organizationId, limit: 10 });
      return 10;
    }
  }

  console.warn('[ai-summary] getAiSummaryLimit: default', { organizationId, limit: 50 });
  return 50;
};


export const buildAiSummaryPrompt = ({ entityType, contextData, crmData }: BuildAiSummaryPromptArgs) => {
  console.warn('[ai-summary] buildAiSummaryPrompt', {
    entityType,
    contextDataLength: contextData.length,
    tasks: crmData.tasks.length,
    deals: crmData.deals.length,
    activities: crmData.activities.length,
  });

  const openTasks = crmData.tasks.filter((task) => task.status === 'open').length;
  const highPriorityTasks = crmData.tasks.filter((task) => task.priority === 'high').length;
  const activeDeals = crmData.deals.filter((deal) => deal.status !== 'lost' && deal.status !== 'won').length;
  const totalDealValue = crmData.deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
  const recentActivity =
    crmData.activities.length > 0
      ? crmData.activities
          .slice(0, 10)
          .map((activity) => `${activity.createdAt}: ${activity.activityType} - ${activity.description || 'No description'}`)
          .join('\n')
      : 'No recent activity recorded';

  const prompt = `
You are an AI CRM assistant. Your goal is to provide a structured intelligence summary for a sales or success manager.
Your output must be fully deterministic, concise, and based ONLY on the provided data.

==========================
### STRICT SCORING RULES
Follow these rules EXACTLY. Do not infer or modify any scoring logic.

1. ENGAGEMENT SCORE (0–40)
   - Last activity ≤ 7 days: +40
   - 8–30 days: +25
   - 31–90 days: +10
   - >90 days or no activity: +0

2. DEAL VALUE SCORE (0–40)
   - Total deal value ≥ $10,000: +40
   - $5,000–9,999: +30
   - $1,000–4,999: +20
   - < $1,000: +10
   - No deals: +0

3. DATA COMPLETENESS SCORE (0–20)
   - All key fields present (name, job title, phone, website, LinkedIn/domain): +20
   - 1–2 fields missing: +10
   - 3+ fields missing: +5
   - No meaningful data: +0

TOTAL SCORE = ENGAGEMENT + DEAL VALUE + DATA COMPLETENESS

4. LEAD TIER (STRICT)
   - 0–39 = cold
   - 40–59 = warm
   - 60–79 = hot
   - 80–100 = very_hot

RATING.reasoning must ONLY explain which scoring bands were applied (Engagement band, Deal value band, Data completeness band) and the resulting tier. Do not add subjective interpretation.
rating.tier MUST match rating.score: 0–39 cold, 40–59 warm, 60–79 hot, 80–100 very_hot.

==========================
### OUTPUT STRUCTURE
Output the following fields:

1. DESCRIPTION
   1–2 sentences summarizing who this CONTACT/COMPANY is, based strictly on provided data (no assumptions).

2. INSIGHTS
   Up to 6 strings. Each string MUST start with one label so it’s easy to scan:
   - Engagement:
   - Deals:
   - Tasks:
   - Data quality:
   - Risks/Growth:
   - Action patterns:
   Each string must be factual and based ONLY on the provided data.

3. RECOMMENDATION
   Exactly ONE sentence. Start with an action verb. Optimize for revenue: landing the account, expanding use, or upsell/cross-sell when plausible from the data (e.g. higher tier, add-on, renewal conversation)—not only CRM hygiene.
   Tie the step to progression: qualify budget and success criteria; surface a concrete commercial next step (pilot scope, upgrade path, seats, contract timing) only when the data supports it; otherwise propose the smallest step that moves toward that outcome (e.g. discovery with agenda aimed at fit and expansion).
   You may still mention enriching missing fields if outreach is blocked, but combine with a commercial angle when possible (e.g. “so you can pitch the right tier/plan”).
   Do not invent product names, prices, SKUs, or promises not in the data.

4. RATING
   Must match this schema:
   {
     "score": number (0–100),
     "tier": "cold" | "warm" | "hot" | "very_hot",
     "reasoning": string
   }

==========================
### CONTEXT DATA

You are analyzing a ${entityType}.

${contextData}

### CRM METRICS:
Tasks: ${crmData.tasks.length} total (${openTasks} open, ${highPriorityTasks} high priority)
Deals: ${crmData.deals.length} total (${activeDeals} active, $${totalDealValue} total value)

### RECENT ACTIVITY:
${recentActivity}

==========================
### REQUIREMENTS
- Be concise and strictly factual.
- Use only the information provided.
- Do NOT guess, infer, or embellish.
- Follow the scoring rubric EXACTLY.
- Output must match the schema.
- RECOMMENDATION must read like a sales or CS next step toward revenue (qualification, expansion, upsell, or close) when the record allows—not a generic check-in unless the data only supports that.
`;

  console.warn('[ai-summary] buildAiSummaryPrompt done', {
    entityType,
    promptLength: prompt.length,
  });

  return prompt;
};
