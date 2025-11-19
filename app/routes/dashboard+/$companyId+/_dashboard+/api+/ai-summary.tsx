import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { data } from 'react-router';
import z from 'zod';
import { db } from '~/db';
import {
  activitiesTable,
  boardTaskTable,
  companiesTable,
  organizationTable,
  peopleTable,
  summaryTable,
} from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { requireUser } from '~/services/whop.server';
import { getTodayUTC } from '~/utils';
import type { Route } from './+types/ai-summary';

/**
 * Get the AI summary daily limit based on trial status
 * Trial users: 10 summaries per day
 * Paid users: 50 summaries per day
 */
function getAiSummaryLimit(organizationId: string): Promise<number> {
  return db.query.organizationTable
    .findFirst({
      where: eq(organizationTable.id, organizationId),
    })
    .then((org) => {
      if (!org) return 50; // Default to 50 if org not found

      // Check if user has active trial (no membershipId but has trialEnd)
      if (org.trialEnd && !org.membershipId) {
        const trialEndDate = new Date(org.trialEnd);
        const now = new Date();
        if (now <= trialEndDate) {
          return 10; // Trial users get 10
        }
      }

      // Paid users or no trial get 50
      return 50;
    });
}

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId: organizationId } = params;
  const { user } = await requireUser(request, organizationId);

  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'aiSummary') {
    const personId = formData.get('personId')?.toString();
    const companyId = formData.get('companyId')?.toString();

    if (!personId && !companyId) {
      return data({ error: 'personId or companyId required' }, { status: 400 });
    }

    // Check daily limit for organization
    // Use UTC to match database timestamps (stored as UTC)
    const todayStr = getTodayUTC();

    const todaySummaries = await db
      .select({ count: sql<number>`count(*)` })
      .from(summaryTable)
      .where(and(eq(summaryTable.organizationId, organizationId), gte(summaryTable.createdAt, todayStr)));

    const todayCount = Number(todaySummaries[0]?.count || 0);

    // Get the limit based on trial status
    const dailyLimit = await getAiSummaryLimit(organizationId);

    if (todayCount >= dailyLimit) {
      const headers = await putToast({
        title: 'Daily Limit Reached',
        message: `You've reached the daily limit of ${dailyLimit} AI summaries. Please try again tomorrow.`,
        variant: 'destructive',
      });
      return data({ error: 'Daily limit reached', limit: dailyLimit, used: todayCount }, { headers });
    }

    try {
      let entityData: typeof peopleTable.$inferSelect | typeof companiesTable.$inferSelect | null = null;
      let crmData: {
        tasks: Array<{
          id: string;
          name: string;
          status: string;
          priority: string | null;
          type: 'tasks' | 'pipeline';
          amount: number | null;
          dueDate: string | null;
          createdAt: string;
          updatedAt: string;
        }>;
        deals: Array<{ id: string; name: string; status: string; amount: number | null; dueDate: string | null }>;
        activities: Array<{
          id: string;
          createdAt: string;
          activityType: string;
          description: string | null;
          metadata: string | null;
        }>;
      } | null = null;

      if (personId) {
        // Fetch person data
        const personData = await db.query.peopleTable.findFirst({
          where: eq(peopleTable.id, personId),
        });

        if (!personData) {
          return data({ error: 'Person not found' }, { status: 404 });
        }

        entityData = personData;

        // Fetch related tasks and pipeline items
        const tasks = await db
          .select({
            id: boardTaskTable.id,
            name: boardTaskTable.name,
            status: boardTaskTable.status,
            priority: boardTaskTable.priority,
            type: boardTaskTable.type,
            amount: boardTaskTable.amount,
            dueDate: boardTaskTable.dueDate,
            createdAt: boardTaskTable.createdAt,
            updatedAt: boardTaskTable.updatedAt,
          })
          .from(boardTaskTable)
          .where(and(eq(boardTaskTable.personId, personId), eq(boardTaskTable.type, 'tasks')));

        const deals = await db
          .select({
            id: boardTaskTable.id,
            name: boardTaskTable.name,
            status: boardTaskTable.status,
            amount: boardTaskTable.amount,
            dueDate: boardTaskTable.dueDate,
          })
          .from(boardTaskTable)
          .where(and(eq(boardTaskTable.personId, personId), eq(boardTaskTable.type, 'pipeline')));

        // Fetch activity history
        const activities = await db
          .select({
            id: activitiesTable.id,
            createdAt: activitiesTable.createdAt,
            activityType: activitiesTable.activityType,
            description: activitiesTable.description,
            metadata: activitiesTable.metadata,
          })
          .from(activitiesTable)
          .where(and(eq(activitiesTable.entityId, personId), eq(activitiesTable.entityType, 'person')))
          .orderBy(desc(activitiesTable.createdAt))
          .limit(20); // Get last 20 activities

        crmData = { tasks, deals, activities };
      } else if (companyId) {
        // Fetch company data
        const companyData = await db.query.companiesTable.findFirst({
          where: eq(companiesTable.id, companyId),
        });

        if (!companyData) {
          return data({ error: 'Company not found' }, { status: 404 });
        }

        entityData = companyData;

        // Fetch related tasks and pipeline items
        const tasks = await db
          .select({
            id: boardTaskTable.id,
            name: boardTaskTable.name,
            status: boardTaskTable.status,
            priority: boardTaskTable.priority,
            type: boardTaskTable.type,
            amount: boardTaskTable.amount,
            dueDate: boardTaskTable.dueDate,
            createdAt: boardTaskTable.createdAt,
            updatedAt: boardTaskTable.updatedAt,
          })
          .from(boardTaskTable)
          .where(and(eq(boardTaskTable.companyId, companyId), eq(boardTaskTable.type, 'tasks')));

        const deals = await db
          .select({
            id: boardTaskTable.id,
            name: boardTaskTable.name,
            status: boardTaskTable.status,
            amount: boardTaskTable.amount,
            dueDate: boardTaskTable.dueDate,
          })
          .from(boardTaskTable)
          .where(and(eq(boardTaskTable.companyId, companyId), eq(boardTaskTable.type, 'pipeline')));

        // Fetch activity history
        const activities = await db
          .select({
            id: activitiesTable.id,
            createdAt: activitiesTable.createdAt,
            activityType: activitiesTable.activityType,
            description: activitiesTable.description,
            metadata: activitiesTable.metadata,
          })
          .from(activitiesTable)
          .where(and(eq(activitiesTable.entityId, companyId), eq(activitiesTable.entityType, 'company')))
          .orderBy(desc(activitiesTable.createdAt))
          .limit(20); // Get last 20 activities

        crmData = { tasks, deals, activities };
      }

      if (!entityData || !crmData) {
        return data({ error: 'Entity or CRM data not found' }, { status: 500 });
      }

      const result = await generateObject({
        model: google('gemini-2.5-flash'),
        prompt: `
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

Reasoning must ONLY explain which scoring bands were applied. Do not add subjective interpretation.

==========================
### OUTPUT STRUCTURE
Output the following fields:

1. DESCRIPTION  
   1–2 sentences summarizing who this CONTACT/COMPANY is, based strictly on provided data (no assumptions).

2. INSIGHTS  
   Up to 6 bullet points with factual CRM insights:
   - engagement recency
   - deal activity & value
   - task load and urgency
   - data quality
   - risks or growth signals
   - actionable patterns from activity history

3. RECOMMENDATION  
   Provide exactly ONE specific, actionable next step.

4. RATING  
   Must match this schema:
   {
     "score": number (0–100),
     "tier": "cold" | "warm" | "hot" | "very_hot",
     "reasoning": string
   }

==========================
### CONTEXT DATA

You are analyzing a ${personId ? 'contact' : 'company'}.

${
  personId
    ? `Name: ${(entityData as typeof peopleTable.$inferSelect).name}
Job Title: ${(entityData as typeof peopleTable.$inferSelect).jobTitle || 'Not specified'}
Description: ${(entityData as typeof peopleTable.$inferSelect).description || 'No description'}
Phone: ${(entityData as typeof peopleTable.$inferSelect).phone || 'Not provided'}
LinkedIn: ${(entityData as typeof peopleTable.$inferSelect).linkedin || 'Not provided'}
Website: ${(entityData as typeof peopleTable.$inferSelect).website || 'Not provided'}`
    : `Name: ${(entityData as typeof companiesTable.$inferSelect).name}
Description: ${(entityData as typeof companiesTable.$inferSelect).description || 'No description'}
Domain: ${(entityData as typeof companiesTable.$inferSelect).domain || 'Not specified'}
Industry: ${(entityData as typeof companiesTable.$inferSelect).industry || 'Not specified'}
Website: ${(entityData as typeof companiesTable.$inferSelect).website || 'Not provided'}
Phone: ${(entityData as typeof companiesTable.$inferSelect).phone || 'Not provided'}`
}

### CRM METRICS:
Tasks: ${crmData.tasks.length} total (${crmData.tasks.filter((t) => t.status === 'open').length} open, ${crmData.tasks.filter((t) => t.priority === 'high').length} high priority)
Deals: ${crmData.deals.length} total (${crmData.deals.filter((d) => d.status !== 'lost' && d.status !== 'won').length} active, $${crmData.deals.reduce((sum, d) => sum + (d.amount || 0), 0)} total value)

### RECENT ACTIVITY:
${
  crmData.activities.length > 0
    ? crmData.activities
        .slice(0, 10)
        .map((a) => `${a.createdAt}: ${a.activityType} - ${a.description || 'No description'}`)
        .join('\n')
    : 'No recent activity recorded'
}

${'notes' in entityData && entityData.notes ? `Notes: ${entityData.notes}` : ''}

==========================
### REQUIREMENTS
- Be concise and strictly factual.
- Use only the information provided.
- Do NOT guess, infer, or embellish.
- Follow the scoring rubric EXACTLY.
- Output must match the schema.
        `,
        schema: z.object({
          description: z.string().describe('1-2 sentences describing the lead/contact/company'),
          insights: z.array(z.string()).max(6).describe('Max 6 bullet points of key CRM insights'),
          rating: z
            .object({
              score: z.number().min(0).max(100).describe('Lead score from 0-100'),
              tier: z.enum(['cold', 'warm', 'hot', 'very_hot']).describe('Lead temperature tier'),
            })
            .describe('Lead scoring and rating'),
          recommendation: z.string().describe('Specific actionable recommendation'),
        }),
        temperature: 0.3,
      });

      // Save the summary to the database
      await db
        .insert(summaryTable)
        .values({
          description: result.object.description,
          insights: JSON.stringify(result.object.insights),
          ratingScore: result.object.rating.score,
          ratingTier: result.object.rating.tier,
          ratingReasoning: 'No reasoning provided',
          recommendation: result.object.recommendation,
          peopleId: personId || null,
          companyId: personId ? null : companyId,
          userId: user.id,
          organizationId,
        })
        .returning();

      const headers = await putToast({
        title: 'Success',
        message: 'AI summary generated successfully',
        variant: 'default',
      });

      return data(
        {
          success: true,
          description: result.object.description,
          insights: result.object.insights,
          rating: result.object.rating,
          recommendation: result.object.recommendation,
          usage: todayCount + 1,
          limit: dailyLimit,
        },
        { headers },
      );
    } catch {
      const headers = await putToast({
        title: 'Sorry!',
        message: "We couldn't generate a summary for this entity. Please try again later.",
        variant: 'destructive',
      });
      return data({ error: "We couldn't generate a summary for this entity. Please try again later." }, { headers });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};
