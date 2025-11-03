import { eq } from 'drizzle-orm';
import { Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { data, Form, href, redirect, useActionData, useNavigation } from 'react-router';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { db } from '~/db';
import { organizationTable, userTable } from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { getAuthorizedUserId, getPublicUser, getTeamMembers, verifyWhopToken } from '~/services/whop.server';
import type { Route } from './+types/new';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const authorizedUser = await getAuthorizedUserId({ companyId, regularUserId: userId });
  // Check if organization exists
  const existingOrg = await db.select().from(organizationTable).where(eq(organizationTable.id, companyId)).limit(1);

  // Check if user profile exists
  const existingUser = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);

  const hasOrg = existingOrg.length > 0;
  const hasUser = existingUser.length > 0;

  // If both exist, redirect to dashboard (onboarding complete)
  // if (hasOrg && hasUser) {
  //   throw redirect(href('/dashboard/:companyId', { companyId }));
  // }

  // Determine starting step based on what exists
  let initialStep = 1;
  if (hasOrg && !hasUser) {
    initialStep = 2; // Skip org creation, go to user profile
  }

  // Get team members for invitation step (only if user has admin/moderator access)
  const teamMembers = await getTeamMembers(companyId);

  return {
    whopUser: {
      id: authorizedUser.id,
      username: authorizedUser.username || null,
      name: authorizedUser.name,
      email: authorizedUser.email,
    },
    initialStep,
    hasOrg,
    hasUser,
    teamMembers,
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const authorizedUser = await getAuthorizedUserId({ companyId, regularUserId: userId });
  const publicWhopUser = await getPublicUser(userId);

  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'createOrg') {
    const name = formData.get('name')?.toString();

    if (!name || name.trim().length === 0) {
      return data({ error: 'Organization name is required', step: 1 } as const, { status: 400 });
    }

    await db.insert(organizationTable).values({
      id: companyId,
      name: name.trim(),
      ownerId: authorizedUser.id,
    });

    return data({ success: true, step: 1, message: 'Organization created' } as const);
  }

  if (intent === 'createUser') {
    const firstName = formData.get('firstName')?.toString();
    const lastName = formData.get('lastName')?.toString();

    if (!firstName || !lastName) {
      return data({ error: 'First name and last name are required', step: 2 } as const, { status: 400 });
    }

    await db.insert(userTable).values({
      id: authorizedUser.id,
      email: authorizedUser.email || 'user@example.com',
      name: firstName.trim(),
      lastName: lastName.trim(),
      whopUserId: userId,
      organizationId: companyId,
      profilePictureUrl: publicWhopUser.profile_picture?.url || null,
    });

    return data({ success: true, step: 2, message: 'Profile created' } as const);
  }

  if (intent === 'addTeamMembers') {
    const selectedMembers = formData.getAll('selectedMembers') as string[];

    if (selectedMembers.length === 0) {
      return data({ error: 'Please select at least one team member', step: 3 } as const, { status: 400 });
    }

    // Get team members data to create user profiles
    const teamMembers = await getTeamMembers(companyId);
    const membersToAdd = teamMembers.filter((member) => selectedMembers.includes(member.id));

    // Create user profiles for selected team members (skip if they already exist)
    for (const member of membersToAdd) {
      const existingUser = await db.select().from(userTable).where(eq(userTable.id, member.id)).limit(1);

      if (existingUser.length === 0) {
        // Create user profile with basic info from team member data
        await db.insert(userTable).values({
          id: member.id,
          email: member.email || `${member.name?.toLowerCase().replace(/\s+/g, '') || 'user'}@example.com`,
          name: member.name || 'Team Member',
          organizationId: companyId,
          whopUserId: member.id,
        });
      }
    }

    return data({ success: true, step: 3, message: `${selectedMembers.length} team member(s) added` } as const);
  }

  if (intent === 'complete') {
    const headers = await putToast({
      title: 'Welcome! 🎉',
      message: 'Your workspace is ready to go',
      variant: 'default',
    });

    return redirect(href('/dashboard/:companyId', { companyId }), { headers });
  }

  return data({ error: 'Invalid intent' } as const, { status: 400 });
};

const OnboardingPage = ({ loaderData }: Route.ComponentProps) => {
  const [step, setStep] = useState(loaderData.initialStep);
  const [orgName, setOrgName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  // Auto-advance to next step on successful action
  useEffect(() => {
    if (actionData && 'success' in actionData && actionData.success && actionData.step === step && !isSubmitting) {
      const timer = setTimeout(() => setStep(step + 1), 100);
      return () => clearTimeout(timer);
    }
  }, [actionData, step, isSubmitting]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  return (
    <div className="flex-1 overflow-hidden bg-linear-to-br from-background via-muted/30 to-muted/50 flex items-center justify-center p-4">
      {/* Main Content */}
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait" custom={step}>
          {step === 1 && (
            <motion.div
              key="step1"
              custom={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-foreground">Create your workspace</h1>
              </div>

              <Form method="post" className="space-y-6">
                <input type="hidden" name="intent" value="createOrg" />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-muted-foreground text-sm">
                      Organization name
                    </Label>
                    <Input
                      id="name"
                      name="name"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Enter your organization name..."
                      required
                      autoFocus
                      className="h-12 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 1 && (
                  <p className="text-sm text-destructive">{actionData.error}</p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !orgName.trim()}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  {isSubmitting ? 'Creating...' : 'Continue'}
                </Button>
              </Form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              custom={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-foreground">Let's get to know you</h1>
              </div>

              <Form method="post" className="space-y-6">
                <input type="hidden" name="intent" value="createUser" />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-muted-foreground text-sm">
                      First name
                    </Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name..."
                      required
                      autoFocus
                      className="h-12 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-muted-foreground text-sm">
                      Last name
                    </Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name..."
                      required
                      className="h-12 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                    />
                  </div>
                </div>

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 2 && (
                  <p className="text-sm text-destructive">{actionData.error}</p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !firstName || !lastName}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  {isSubmitting ? 'Saving...' : 'Continue'}
                </Button>
              </Form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step4"
              custom={step}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full"
                >
                  <Sparkles className="w-8 h-8 text-primary" />
                </motion.div>

                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold text-foreground">Welcome to your workspace!</h1>
                  <p className="text-base text-muted-foreground">Everything is set up and ready to go.</p>
                </div>

                <Form method="post" className="pt-4">
                  <input type="hidden" name="intent" value="complete" />
                  <Button
                    type="submit"
                    className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    Get started
                  </Button>
                </Form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-xs text-muted-foreground">© 2025 WHOP CRM · Privacy Policy · Support · Sign out</p>
      </div>
    </div>
  );
};

export default OnboardingPage;
