import { WhopServerApi } from './whop.server';

export const createCheckoutSession = async (planId: string, companyId: string) => {
  const checkoutSession = await WhopServerApi.payments.createCheckoutSession({
    planId: planId,
    metadata: {
      companyId: companyId, // bizz_Id
    },
  });
  return checkoutSession;
};
