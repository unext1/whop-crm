import { ArrowRight, DownloadIcon, Flame, MessageSquareHeartIcon, MessageSquareIcon, UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Link, href } from 'react-router';
import { FeatureFourImages } from '~/components/feature-component';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader } from '~/components/ui/card';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const CardDecorator = ({ children }: { children: ReactNode }) => (
  <div className="mask-radial-from-40% mask-radial-to-60% relative mx-auto size-36 duration-200 [--color-border:color-mix(in_oklab,var(--color-primary/50)10%,transparent)] group-hover:[--color-border:color-mix(in_oklab,var(--color-primary)20%,transparent)] dark:[--color-border:color-mix(in_oklab,var(--color-white)15%,transparent)] dark:group-hover:[--color-border:color-mix(in_oklab,var(--color-white)20%,transparent)] transition-all">
    <div
      aria-hidden
      className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] dark:opacity-50"
    />

    <div className="bg-background absolute inset-0 m-auto flex size-12 items-center justify-center border-l border-t">
      {children}
    </div>
  </div>
);

const DiscoverPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-y-scroll">
      {/* Gradient Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="z-10 fixed top-0  w-full">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <div className="flex items-center justify-between">
            <Link to={href('/')} className="hover:scale-105 transition-transform">
              <motion.div className="flex items-center gap-3 cursor-pointer">
                <img src="/logo.png" alt="CRM Logo" className=" rounded" width={32} height={32} />
                <h1 className="text-2xl font-bold tracking-tight">CRM</h1>{' '}
                <span className="text-xs text-muted-foreground">for WHOP</span>
              </motion.div>
            </Link>

            <a href="https://whop.com/apps/app_yGI58V5bhzIDJq" target="_blank" rel="noopener">
              <Button
                variant="default"
                className="hover:text-foreground hover:scale-105 transition-transform bg-primary rounded-full p-2 hover:bg-primary/90"
              >
                <DownloadIcon className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div className="text-center" initial="hidden" animate="visible" variants={staggerContainer}>
            {/* Announcement Badge */}
            <motion.div variants={fadeInUp}>
              <Link
                to={href('/dashboard/:companyId', { companyId: 'your-company-id' })}
                className="hover:bg-muted bg-card group mx-auto flex w-fit items-center gap-4 rounded-full border border-border p-1 pl-4 px-4 shadow-lg transition-colors duration-300"
              >
                <span className="text-foreground text-sm flex items-center">
                  <Flame className="h-4 w-4 text-primary mr-2" />
                  The #1 CRM tool for your <span className="font-bold text-primary mx-1">WHOP</span> organization
                </span>
              </Link>
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              className="mx-auto mt-12 max-w-4xl text-balance text-6xl font-bold md:text-7xl lg:text-[5.25rem] bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent"
              variants={fadeInUp}
            >
              Manage Contacts.
              <br />
              Close Deals Faster.
            </motion.h1>

            {/* Subheading */}
            <motion.p
              className="mx-auto mt-8 max-w-3xl text-balance text-lg text-muted-foreground leading-relaxed"
              variants={fadeInUp}
            >
              Transform your sales process with intelligent contact management, visual deal pipelines, team
              collaboration tools, and powerful analytics that help your organization close more deals and grow faster.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div className="mt-12 flex  items-center justify-center gap-4 md:flex-row" variants={fadeInUp}>
              <a href="https://whop.com/apps/app_yGI58V5bhzIDJq" target="_blank" rel="noopener">
                <Button
                  size="lg"
                  className="rounded-xl px-8 py-6 text-base bg-gradient-to-r from-primary to-primary hover:shadow-lg hover:shadow-primary/50 transition-all"
                >
                  <Flame className="mr-2 h-5 w-5" />
                  Install in My Organization
                </Button>
              </a>
            </motion.div>
          </motion.div>

          {/* App Preview */}
          <motion.div
            className="mt-20 relative"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl">
              <img src="/main.png" alt="CRM App Preview" className="w-full rounded-xl" />
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto w-full">
        <FeatureFourImages />
      </div>

      {/* Additional Features Section */}
      <section className="relative py-24 bg-background">
        <div className="@container mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-balance text-4xl font-semibold lg:text-5xl mb-4">And there is more...</h2>
            <p className="text-muted-foreground">Always evolving, always improving</p>
          </div>
          <div className="@min-4xl:max-w-full @min-4xl:grid-cols-3 mx-auto mt-8 grid max-w-sm gap-6 *:text-center">
            <Card className="group shadow-primary/20">
              <CardHeader className="pb-3">
                <CardDecorator>
                  <UserIcon className="size-6" aria-hidden />
                </CardDecorator>
                <h3 className="mt-6 font-medium">Smart Contact Management</h3>
              </CardHeader>
              <CardContent>
                <p className="text-xs">
                  Intelligent contact profiles with detailed information, relationship mapping, and automated data
                  enrichment for better lead qualification.
                </p>
              </CardContent>
            </Card>

            <Card className="group shadow-primary/20">
              <CardHeader className="pb-3">
                <CardDecorator>
                  <MessageSquareHeartIcon className="size-6" aria-hidden />
                </CardDecorator>
                <h3 className="mt-6 font-medium">Visual Deal Pipeline</h3>
              </CardHeader>
              <CardContent>
                <p className=" text-xs">
                  Drag-and-drop kanban boards for deal management. Track progress from lead to closed deal with
                  customizable pipeline stages.
                </p>
              </CardContent>
            </Card>

            <Card className="group shadow-primary/20">
              <CardHeader className="pb-3">
                <CardDecorator>
                  <MessageSquareIcon className="size-6" aria-hidden />
                </CardDecorator>
                <h3 className="mt-6 font-medium">Team Collaboration</h3>
              </CardHeader>
              <CardContent>
                <p className=" text-xs">
                  Real-time task assignment, activity timelines, and collaborative note-taking to keep your entire sales
                  team aligned and productive.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 bg-gradient-to-b from-background via-card/10 to-background">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}>
            <motion.h2
              className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent"
              variants={fadeInUp}
            >
              Ready to Transform Your Sales Process?
            </motion.h2>

            <motion.p
              className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
              variants={fadeInUp}
            >
              Install CRM in your WHOP organization today and watch your team close more deals with intelligent contact
              management and visual pipelines.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8"
              variants={fadeInUp}
            >
              <a href="https://whop.com/apps/app_yGI58V5bhzIDJq" target="_blank" rel="noopener">
                <Button
                  size="lg"
                  className="rounded-2xl px-12 py-6 text-lg font-semibold bg-gradient-to-r from-primary to-primary hover:shadow-2xl hover:shadow-primary/50 transition-all transform hover:scale-105"
                >
                  <Flame className="mr-3 h-6 w-6" />
                  Start Closing More Deals
                  <ArrowRight className="ml-3 h-5 w-5" />
                </Button>
              </a>
            </motion.div>

            <motion.p className="text-sm text-muted-foreground" variants={fadeInUp}>
              3-day(no credit card required!) free trial • Premium features included
            </motion.p>
          </motion.div>
        </div>

        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>
      </section>
    </div>
  );
};

export default DiscoverPage;
