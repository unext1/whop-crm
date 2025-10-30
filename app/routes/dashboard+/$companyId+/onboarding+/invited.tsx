import { eq } from 'drizzle-orm';
import { Sparkles, Upload } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { data, Form, href, redirect, useActionData, useNavigation } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { db } from '~/db';
import { organizationTable, userTable } from '~/db/schema';
import { putToast } from '~/services/cookie.server';
import { requireUser, getUserEmail } from '~/services/whop.server';
import type { Route } from './+types/invited';

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { user: whopUser } = await requireUser(request, companyId);

  // Check if organization exists
  const existingOrg = await db.select().from(organizationTable).where(eq(organizationTable.id, companyId)).limit(1);

  // Check if user profile exists
  const existingUser = await db.select().from(userTable).where(eq(userTable.id, whopUser.id)).limit(1);

  const hasOrg = existingOrg.length > 0;
  const hasUser = existingUser.length > 0;

  // If no organization exists, redirect to main onboarding
  if (!hasOrg) {
    throw redirect(href('/dashboard/:companyId/onboarding/new', { companyId }));
  }

  // If user already exists, redirect to dashboard
  if (hasUser) {
    throw redirect(href('/dashboard/:companyId', { companyId }));
  }

  return {
    whopUser: {
      id: whopUser.id,
      username: whopUser.username,
      name: whopUser.name,
    },
    organization: existingOrg[0],
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { companyId } = params;
  const { user: whopUser } = await requireUser(request, companyId);

  const formData = await request.formData();
  const intent = formData.get('intent')?.toString();

  if (intent === 'createUser') {
    const firstName = formData.get('firstName')?.toString();
    const lastName = formData.get('lastName')?.toString();
    const username = formData.get('username')?.toString();
    const email = formData.get('email')?.toString();

    if (!firstName || !lastName || !username) {
      return data({ error: 'All fields are required', step: 1 } as const, { status: 400 });
    }

    // Get user email from Whop authorized users if not provided in form
    const whopUserEmail = await getUserEmail(companyId, whopUser.id);

    await db.insert(userTable).values({
      id: whopUser.id,
      email: email || whopUserEmail || whopUser.username || 'user@example.com',
      name: `${firstName} ${lastName}`,
      whopUserId: whopUser.id,
      username: username.trim(),
      organizationId: companyId,
    });

    return data({ success: true, step: 1, message: 'Profile created' } as const);
  }

  if (intent === 'complete') {
    const headers = await putToast({
      title: 'Welcome to the team! 🎉',
      message: 'Your profile is set up and ready to go',
      variant: 'default',
    });

    return redirect(href('/dashboard/:companyId', { companyId }), { headers });
  }

  return data({ error: 'Invalid intent' } as const, { status: 400 });
};

const InvitedUserOnboarding = ({ loaderData }: Route.ComponentProps) => {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');

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
                <h1 className="text-4xl font-bold text-foreground">Welcome to {loaderData.organization.name}!</h1>
                <p className="text-xl text-muted-foreground">
                  You've been invited to join this workspace. Let's set up your profile.
                </p>
              </div>

              <Form method="post" className="space-y-6">
                <input type="hidden" name="intent" value="createUser" />

                <div className="space-y-6">
                  {/* Profile Picture */}
                  <div className="flex flex-col items-center space-y-4">
                    <Label className="text-muted-foreground text-sm">Profile picture</Label>
                    <div className="relative">
                      <Avatar className="w-24 h-24 border-2 border-border">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-medium">
                          {firstName?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload image
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Remove
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      *.png, *.jpeg files up to 10MB at least 400px by 400px
                    </p>
                  </div>

                  {/* Name Fields */}
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

                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-muted-foreground text-sm">
                        Username
                      </Label>
                      <Input
                        id="username"
                        name="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Choose a username..."
                        required
                        className="h-12 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-muted-foreground text-sm">
                        Email
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        placeholder="Enter your email..."
                        className="h-12 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                {actionData && 'error' in actionData && 'step' in actionData && actionData.step === 1 && (
                  <p className="text-sm text-destructive">{actionData.error}</p>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting || !firstName || !lastName || !username}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  {isSubmitting ? 'Setting up...' : 'Continue'}
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
              <div className="text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="inline-flex items-center justify-center w-20 h-20 bg-primary/20 rounded-full"
                >
                  <Sparkles className="w-10 h-10 text-primary" />
                </motion.div>

                <div className="space-y-2">
                  <h1 className="text-4xl font-bold text-foreground">You're all set!</h1>
                  <p className="text-xl text-muted-foreground">
                    Welcome to {loaderData.organization.name}. Let's get started.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8">
                  <div className="p-6 bg-muted/50 border border-border rounded-lg space-y-2">
                    <div className="text-3xl">📊</div>
                    <h3 className="text-foreground font-medium">Track Projects</h3>
                    <p className="text-sm text-muted-foreground">Manage your projects with powerful kanban boards</p>
                  </div>
                  <div className="p-6 bg-muted/50 border border-border rounded-lg space-y-2">
                    <div className="text-3xl">👥</div>
                    <h3 className="text-foreground font-medium">Collaborate</h3>
                    <p className="text-sm text-muted-foreground">Work together with your team in real-time</p>
                  </div>
                  <div className="p-6 bg-muted/50 border border-border rounded-lg space-y-2">
                    <div className="text-3xl">⚡</div>
                    <h3 className="text-foreground font-medium">Stay Organized</h3>
                    <p className="text-sm text-muted-foreground">Keep everything in one place and accessible</p>
                  </div>
                </div>

                <Form method="post" className="pt-4">
                  <input type="hidden" name="intent" value="complete" />
                  <Button
                    type="submit"
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
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
        <p className="text-xs text-muted-foreground">© 2025 Your Company · Privacy Policy · Support · Sign out</p>
      </div>
    </div>
  );
};

export default InvitedUserOnboarding;
