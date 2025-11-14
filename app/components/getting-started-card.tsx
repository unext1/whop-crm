import { Building2, Check, CheckSquareIcon, DollarSign, Rocket, User } from 'lucide-react';
import { href, Link, useParams, useFetcher } from 'react-router';
import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { cn } from '~/utils';
import { ShimmerButton } from './shimmer-button';
import { Card } from './ui/card';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Progress } from './ui/progress';

interface GettingStartedCardProps {
  progress: {
    hasPerson: boolean;
    hasCompany: boolean;
    hasTask: boolean;
    hasDeal: boolean;
  };
}

const tasks = [
  {
    id: 'person',
    label: 'Add your first person',
    icon: User,
    completed: false,
    url: (companyId: string) => href('/dashboard/:companyId/people', { companyId }),
  },
  {
    id: 'company',
    label: 'Add your first company',
    icon: Building2,
    completed: false,
    url: (companyId: string) => href('/dashboard/:companyId/company', { companyId }),
  },
  {
    id: 'task',
    label: 'Create your first task',
    icon: CheckSquareIcon,
    completed: false,
    url: (companyId: string) => href('/dashboard/:companyId/tasks', { companyId }),
  },
  {
    id: 'deal',
    label: 'Create your first deal',
    icon: DollarSign,
    completed: false,
    url: (companyId: string) => href('/dashboard/:companyId/projects', { companyId }),
  },
];

export function GettingStartedCard({ progress }: GettingStartedCardProps) {
  const params = useParams();
  const companyId = params.companyId || '';
  const fetcher = useFetcher();
  const prevCompletedTasksRef = useRef<number>(0);

  const completedTasks = [progress.hasPerson, progress.hasCompany, progress.hasTask, progress.hasDeal].filter(
    Boolean,
  ).length;

  const totalTasks = 4;
  const percentage = Math.round((completedTasks / totalTasks) * 100);

  // Detect when all tasks are completed and trigger confetti
  useEffect(() => {
    const prevCompletedTasks = prevCompletedTasksRef.current;
    const isJustCompleted = prevCompletedTasks < totalTasks && completedTasks === totalTasks;

    if (isJustCompleted) {
      // Trigger fireworks confetti
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = window.setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      // Mark as completed in database
      const formData = new FormData();
      formData.append('intent', 'completeGettingStarted');
      fetcher.submit(formData, {
        method: 'post',
        action: href('/dashboard/:companyId/api/complete-getting-started', { companyId }),
      });
    }

    prevCompletedTasksRef.current = completedTasks;
  }, [completedTasks, fetcher, companyId]);

  if (completedTasks === totalTasks) {
    return null;
  }

  const tasksWithStatus = tasks.map((task) => ({
    ...task,
    completed:
      progress[
        task.id === 'person'
          ? 'hasPerson'
          : task.id === 'company'
            ? 'hasCompany'
            : task.id === 'task'
              ? 'hasTask'
              : 'hasDeal'
      ],
  }));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ShimmerButton background="hsl(var(--muted))" className="w-full text-center text-xs flex justify-center mb-6">
          <Rocket className="h-4 w-4 shrink-0 mr-2" />
          <span>Getting started</span>
        </ShimmerButton>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-60 p-0 bg-muted/30 backdrop-blur-md border-none shadow-s"
        onOpenAutoFocus={(e) => e.preventDefault()}
        collisionPadding={16}
      >
        <Card className="p-3 bg-transparent border-0 shadow-none">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Getting started</h3>{' '}
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">{percentage}% completed</span>
              {percentage < 100 && <span className="text-xs text-muted-foreground">Keep it up!</span>}
            </div>
            <Progress value={percentage} className="h-1.5" />
          </div>

          <div className="space-y-2">
            {tasksWithStatus.map((task) => {
              const Icon = task.icon;
              return (
                <Link
                  key={task.id}
                  to={task.url(companyId)}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md transition-all group',
                    task.completed ? 'hover:bg-muted' : 'hover:bg-primary/20 active:bg-primary/30',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      task.completed ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs flex-1 transition-colors',
                      task.completed ? 'line-through text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {task.label}
                  </span>
                  {task.completed && (
                    <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
