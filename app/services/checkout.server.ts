import { whopSdk, WhopServerApi } from "./whop.server";

export const createCheckoutSession = async ( planId: string,) => {
  const checkoutSession = await WhopServerApi.payments.createCheckoutSession({
    planId: planId,
    metadata: {
      userId: '123',
    //   More metadata can be added here maybe organization id buzz_xxx etc.
    },
  });
  return checkoutSession;
};