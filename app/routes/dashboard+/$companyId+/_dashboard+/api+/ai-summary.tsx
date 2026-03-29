import { generateObject } from 'ai';
import { and, desc, eq, sql } from 'drizzle-orm';
import { data } from 'react-router';
import z from 'zod';
import { db } from '~/db';
import {
  activitiesTable,
  boardTaskTable,
  companiesTable,
  peopleTable,
  summaryTable,
} from '~/db/schema';
import { getAiSummaryLimit, buildAiSummaryPrompt } from '~/services/ai.server';
import { putToast } from '~/services/cookie.server';
import { requireUser } from '~/services/whop.server';
import type { Route } from './+types/ai-summary';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { env } from '~/services/env.server';

type TaskRow = typeof boardTaskTable.$inferSelect;
type ActivityRow = typeof activitiesTable.$inferSelect;

type CrmData = {
  tasks: TaskRow[];
  deals: TaskRow[];
  activities: ActivityRow[];
};

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId: organizationId } = params;
  console.warn('[ai-summary] action entry', {
    organizationId,
    method: request.method,
    url: request.url,
    origin: request.headers.get('origin'),
    host: request.headers.get('host'),
    xForwardedHost: request.headers.get('x-forwarded-host'),
  });

  const { user } = await requireUser(request, organizationId);
  console.warn('[ai-summary] after requireUser', { userId: user.id });

  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();
  console.warn('[ai-summary] formData', {
    intent,
    hasPersonId: !!formData.get('personId'),
    hasCompanyId: !!formData.get('companyId'),
  });

  if (intent === 'aiSummary') {
    const personId = formData.get('personId')?.toString();
    const companyId = formData.get('companyId')?.toString();

    if (!personId && !companyId) {
      console.warn('[ai-summary] missing personId and companyId');
      return data({ error: 'personId or companyId required' }, { status: 400 });
    }

    const dailyLimit = await getAiSummaryLimit(organizationId);
    console.warn('[ai-summary] dailyLimit', { organizationId, dailyLimit });

    try {
      let contextData = '';
      let crmData: CrmData | null = null;
      let entityType: 'contact' | 'company' = personId ? 'contact' : 'company';

      if (personId) {
        const branchData = await db.transaction(async (tx) => {
          const personData = await tx.query.peopleTable.findFirst({
            where: eq(peopleTable.id, personId),
          });
          if (!personData) return null;

          const tasks = await tx.query.boardTaskTable.findMany({
            where: and(eq(boardTaskTable.personId, personId), eq(boardTaskTable.type, 'tasks')),
          });
          const deals = await tx.query.boardTaskTable.findMany({
            where: and(eq(boardTaskTable.personId, personId), eq(boardTaskTable.type, 'pipeline')),
          });
          const activities = await tx.query.activitiesTable.findMany({
            where: and(eq(activitiesTable.entityId, personId), eq(activitiesTable.entityType, 'person')),
            orderBy: [desc(activitiesTable.createdAt)],
            limit: 20,
          });

          return { personData, tasks, deals, activities };
        });

        if (!branchData?.personData) {
          console.warn('[ai-summary] person not found', { personId });
          return data({ error: 'Person not found' }, { status: 404 });
        }

        const { personData, tasks, deals, activities } = branchData;
        entityType = 'contact';
        contextData = `Name: ${personData.name}
        Job Title: ${personData.jobTitle || 'Not specified'}
        Description: ${personData.description || 'No description'}
        Phone: ${personData.phone || 'Not provided'}
        LinkedIn: ${personData.linkedin || 'Not provided'}
        Website: ${personData.website || 'Not provided'}${personData.notes ? `\nNotes: ${personData.notes}` : ''}`;
        crmData = { tasks, deals, activities };
      } else if (companyId) {
        const branchData = await db.transaction(async (tx) => {
          const companyData = await tx.query.companiesTable.findFirst({
            where: eq(companiesTable.id, companyId),
          });
          if (!companyData) return null;

          const tasks = await tx.query.boardTaskTable.findMany({
            where: and(eq(boardTaskTable.companyId, companyId), eq(boardTaskTable.type, 'tasks')),
          });
          const deals = await tx.query.boardTaskTable.findMany({
            where: and(eq(boardTaskTable.companyId, companyId), eq(boardTaskTable.type, 'pipeline')),
          });
          const activities = await tx.query.activitiesTable.findMany({
            where: and(eq(activitiesTable.entityId, companyId), eq(activitiesTable.entityType, 'company')),
            orderBy: [desc(activitiesTable.createdAt)],
            limit: 20,
          });

          return { companyData, tasks, deals, activities };
        });

        if (!branchData?.companyData) {
          console.warn('[ai-summary] company not found', { companyId });
          return data({ error: 'Company not found' }, { status: 404 });
        }

        const { companyData, tasks, deals, activities } = branchData;
        entityType = 'company';
        contextData = `Name: ${companyData.name}
        Description: ${companyData.description || 'No description'}
        Domain: ${companyData.domain || 'Not specified'}
        Industry: ${companyData.industry || 'Not specified'}
        Website: ${companyData.website || 'Not provided'}
        Phone: ${companyData.phone || 'Not provided'}`;
        crmData = { tasks, deals, activities };
      }

      if (!contextData || !crmData) {
        console.warn('[ai-summary] missing contextData or crmData', { entityType });
        return data({ error: 'CRM data not found' }, { status: 500 });
      }

      console.warn('[ai-summary] calling generateObject', {
        entityType,
        modelId: 'openrouter/free',
        tasks: crmData.tasks.length,
        deals: crmData.deals.length,
        activities: crmData.activities.length,
      });

      const model = openrouter.chat('openrouter/free');
      const result = await generateObject({
        model,
        prompt: buildAiSummaryPrompt({ entityType, contextData, crmData }),
        schema: z.object({
          description: z.string().describe('1-2 sentences describing the lead/contact/company'),
          insights: z.array(z.string()).max(6).describe('Max 6 labeled insight strings (e.g. "Engagement: ...")'),
          rating: z
            .object({
              score: z.number().min(0).max(100).describe('Lead score from 0-100'),
              tier: z.enum(['cold', 'warm', 'hot', 'very_hot']).describe('Lead temperature tier'),
              reasoning: z.string().describe('Which rubric bands were applied (no subjective interpretation)'),
            })
            .describe('Lead scoring, tier, and rubric reasoning'),
          recommendation: z
            .string()
            .describe('Couple sentence actionable recommendation for revenue-focused next step (qualify, expand, upsell, close) when data allows'),
        }),
        temperature: 0.1,
      });

      console.warn('[ai-summary] generateObject ok', {
        hasDescription: !!result.object.description,
        insightsCount: result.object.insights?.length,
      });

      const insertResult = await db.transaction(async (tx) => {
        const todaySummaries = await tx
          .select({ count: sql<number>`count(*)` })
          .from(summaryTable)
          .where(
            and(eq(summaryTable.organizationId, organizationId), sql`date(${summaryTable.createdAt}) = date('now')`),
          );
        const usedToday = Number(todaySummaries[0]?.count || 0);

        if (usedToday >= dailyLimit) {
          return { inserted: false as const, used: usedToday };
        }

        await tx.insert(summaryTable).values({
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
        });

        return { inserted: true as const, used: usedToday + 1 };
      });

      if (!insertResult.inserted) {
        console.warn('[ai-summary] daily limit path', { used: insertResult.used, dailyLimit });
        const headers = await putToast({
          title: 'Daily Limit Reached',
          message: `You've reached the daily limit of ${dailyLimit} AI summaries. Please try again tomorrow.`,
          variant: 'destructive',
        });
        return data({ error: 'Daily limit reached', limit: dailyLimit, used: insertResult.used }, { headers });
      }

      const headers = await putToast({
        title: 'Success',
        message: 'AI summary generated successfully',
        variant: 'default',
      });

      console.warn('[ai-summary] success', { usage: insertResult.used, limit: dailyLimit });

      return data(
        {
          success: true,
          description: result.object.description,
          insights: result.object.insights,
          rating: result.object.rating,
          recommendation: result.object.recommendation,
          usage: insertResult.used,
          limit: dailyLimit,
        },
        { headers },
      );
    } catch (err) {
      console.warn('[ai-summary] generateObject / db error', err);
      const headers = await putToast({
        title: 'Sorry!',
        message: "We couldn't generate a summary for this entity. Please try again later.",
        variant: 'destructive',
      });
      return data({ error: "We couldn't generate a summary for this entity. Please try again later." }, { headers });
    }
  }

  console.warn('[ai-summary] invalid intent', { intent });
  return data({ error: 'Invalid intent' }, { status: 400 });
};
