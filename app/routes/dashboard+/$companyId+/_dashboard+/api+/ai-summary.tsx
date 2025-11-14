import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { data } from 'react-router';
import z from 'zod';
import { db } from '~/db';
import { activitiesTable, boardTaskTable, companiesTable, peopleTable, summaryTable } from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/ai-summary';

export const AI_SUMMARY_DAILY_LIMIT = 50;

export const action = async ({ request, params }: Route.ActionArgs) => {
  console.warn('[AI Summary] Action started', { organizationId: params.companyId });

  try {
    const { companyId: organizationId } = params;
    console.warn('[AI Summary] Params parsed', { organizationId });

    const { user } = await requireUser(request, organizationId);
    console.warn('[AI Summary] User authenticated', { userId: user.id });

    const formData = await request.formData();
    const intent = formData.get('intent')?.toString();
    console.warn('[AI Summary] Form data parsed', { intent });

    if (intent === 'aiSummary') {
      const personId = formData.get('personId')?.toString();
      const companyId = formData.get('companyId')?.toString();
      console.warn('[AI Summary] Entity IDs extracted', { personId, companyId });

      if (!personId && !companyId) {
        console.warn('[AI Summary] Missing entity ID');
        return data({ error: 'personId or companyId required' }, { status: 400 });
      }

      // Check daily limit for organization
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();
      console.warn('[AI Summary] Checking daily limit', { todayStr, organizationId });

      const todaySummaries = await db
        .select({ count: sql<number>`count(*)` })
        .from(summaryTable)
        .where(and(eq(summaryTable.organizationId, organizationId), gte(summaryTable.createdAt, todayStr)));

      const todayCount = Number(todaySummaries[0]?.count || 0);
      console.warn('[AI Summary] Daily limit check complete', { todayCount, limit: AI_SUMMARY_DAILY_LIMIT });

      if (todayCount >= AI_SUMMARY_DAILY_LIMIT) {
        console.warn('[AI Summary] Daily limit reached');
        const headers = await putToast({
          title: 'Daily Limit Reached',
          message: `You've reached the daily limit of ${AI_SUMMARY_DAILY_LIMIT} AI summaries. Please try again tomorrow.`,
          variant: 'destructive',
        });
        return data({ error: 'Daily limit reached', limit: AI_SUMMARY_DAILY_LIMIT, used: todayCount }, { headers });
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
          console.warn('[AI Summary] Fetching person data', { personId });
          // Fetch person data
          const personData = await db.query.peopleTable.findFirst({
            where: eq(peopleTable.id, personId),
          });

          if (!personData) {
            console.warn('[AI Summary] Person not found', { personId });
            return data({ error: 'Person not found' }, { status: 404 });
          }

          entityData = personData;
          console.warn('[AI Summary] Person data fetched', { personName: personData.name });

          // Fetch related tasks and pipeline items
          console.warn('[AI Summary] Fetching tasks for person', { personId });
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

          console.warn('[AI Summary] Fetching deals for person', { personId });
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
          console.warn('[AI Summary] Fetching activities for person', { personId });
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
          console.warn('[AI Summary] CRM data fetched for person', {
            tasksCount: tasks.length,
            dealsCount: deals.length,
            activitiesCount: activities.length,
          });
        } else if (companyId) {
          console.warn('[AI Summary] Fetching company data', { companyId });
          // Fetch company data
          const companyData = await db.query.companiesTable.findFirst({
            where: eq(companiesTable.id, companyId),
          });

          if (!companyData) {
            console.warn('[AI Summary] Company not found', { companyId });
            return data({ error: 'Company not found' }, { status: 404 });
          }

          entityData = companyData;
          console.warn('[AI Summary] Company data fetched', { companyName: companyData.name });

          // Fetch related tasks and pipeline items
          console.warn('[AI Summary] Fetching tasks for company', { companyId });
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

          console.warn('[AI Summary] Fetching deals for company', { companyId });
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
          console.warn('[AI Summary] Fetching activities for company', { companyId });
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
          console.warn('[AI Summary] CRM data fetched for company', {
            tasksCount: tasks.length,
            dealsCount: deals.length,
            activitiesCount: activities.length,
          });
        }

        if (!entityData || !crmData) {
          console.warn('[AI Summary] Missing entity or CRM data', {
            hasEntityData: !!entityData,
            hasCrmData: !!crmData,
          });
          return data({ error: 'Entity or CRM data not found' }, { status: 500 });
        }

        console.warn('[AI Summary] Starting AI generation', {
          entityType: personId ? 'person' : 'company',
          entityId: personId || companyId,
        });

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
                reasoning: z.string().describe('Brief explanation of the rating'),
              })
              .describe('Lead scoring and rating'),
            recommendation: z.string().describe('Specific actionable recommendation'),
          }),
          temperature: 0.3,
        });

        console.warn('[AI Summary] AI generation complete', {
          hasDescription: !!result.object.description,
          insightsCount: result.object.insights.length,
          ratingScore: result.object.rating.score,
        });

        // Save the summary to the database
        console.warn('[AI Summary] Saving summary to database', {
          peopleId: personId || null,
          companyId: personId ? null : companyId,
          userId: user.id,
          organizationId,
        });

        await db
          .insert(summaryTable)
          .values({
            description: result.object.description,
            insights: JSON.stringify(result.object.insights),
            ratingScore: result.object.rating.score,
            ratingTier: result.object.rating.tier,
            ratingReasoning: result.object.rating.reasoning,
            recommendation: result.object.recommendation,
            peopleId: personId || null,
            companyId: personId ? null : companyId,
            userId: user.id,
            organizationId,
          })
          .returning();

        console.warn('[AI Summary] Summary saved to database');

        const headers = await putToast({
          title: 'Success',
          message: 'AI summary generated successfully',
          variant: 'default',
        });

        console.warn('[AI Summary] Action completed successfully');

        return data(
          {
            success: true,
            description: result.object.description,
            insights: result.object.insights,
            rating: result.object.rating,
            recommendation: result.object.recommendation,
            usage: todayCount + 1,
            limit: AI_SUMMARY_DAILY_LIMIT,
          },
          { headers },
        );
      } catch (error) {
        console.warn('[AI Summary] Error in try block', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
        });
        return data({ error: 'Failed to generate AI summary' }, { status: 500 });
      }
    }

    console.warn('[AI Summary] Invalid intent', { intent });
    return data({ error: 'Invalid intent' }, { status: 400 });
  } catch (error) {
    console.warn('[AI Summary] Error in action', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return data({ error: 'Internal server error' }, { status: 500 });
  }
};
