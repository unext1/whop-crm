import type { ActionFunctionArgs } from 'react-router';
import { makeWebhookValidator } from '@whop/api';
import { env } from '~/services/env.server';

export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const validateWebhook = makeWebhookValidator({
    webhookSecret: env.WHOP_WEBHOOK_SECRET ?? 'fallback'
  });
  try {
    // Validate the webhook to ensure it's from Whop
    const webhookData = await validateWebhook(request);

    // Handle the webhook event
    if (webhookData.action === 'payment.succeeded') {
      const { id, final_amount, amount_after_fees, currency, user_id } = webhookData.data;

      // final_amount is the amount the user paid
      // amount_after_fees is the amount that is received by you, after card fees and processing fees are taken out

      console.log(`Payment ${id} succeeded for ${user_id} with amount ${final_amount} ${currency}`);

      // In React Router v7, we don't have waitUntil, but we can still do async work
      // The response will be sent immediately while background work continues
      potentiallyLongRunningHandler(user_id, final_amount, currency, amount_after_fees).catch(console.error); // Handle errors from background work
    } else {
      // Log other webhook events for debugging
      console.log(`Received webhook event: ${webhookData.action}`, webhookData.data);
    }

    // Make sure to return a 2xx status code quickly. Otherwise the webhook will be retried.
    return new Response('OK', { status: 200 });
  } catch (error) {
    // Log webhook validation errors but still return 200 to prevent retries
    console.error('Webhook validation failed:', error);
    return new Response('OK', { status: 200 });
  }
};

async function potentiallyLongRunningHandler(
  _user_id: string | null | undefined,
  _amount: number,
  _currency: string,
  _amount_after_fees: number | null | undefined
) {
  // This is a placeholder for a potentially long running operation
  // In a real scenario, you might need to fetch user data, update a database, etc.
}
