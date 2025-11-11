import { whopSdk } from './whop.server';

export const createCheckoutSession = async (planId: string, companyId: string) => {
  const checkoutConfiguration = await whopSdk.checkoutConfigurations.create({
    plan_id: planId,
    metadata: {
      companyId: companyId,
    },
  });
  return checkoutConfiguration;
};
