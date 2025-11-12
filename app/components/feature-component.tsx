import { useEffect, useState } from 'react';
import { cn } from '~/utils';
import { TextComponent } from './features';

const data = [
  {
    title: 'Real-time Updates',
    content:
      'Instant post updates and live community interactions keep members engaged and connected without page refreshes.',
    srcImage: '/feed.png'
  },
  {
    title: 'Complete Admin Control',
    content:
      'Full moderation tools with post featuring, deletion, and community management capabilities at your fingertips.',
    srcImage: '/profile.png'
  },
  {
    title: 'Gamified Engagement',
    content:
      'SparkScore system and leaderboards create natural motivation for quality contributions and healthy competition.',
    srcImage: '/leaderboard.png'
  }
];

export function FeatureFourImages() {
  const [featureOpen, setFeatureOpen] = useState<number>(0);
  const [timer, setTimer] = useState<number>(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => prev + 10);
    }, 10);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (timer > 10000) {
      setFeatureOpen((prev) => (prev + 1) % data.length);
      setTimer(0);
    }
  }, [timer]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-20 ">
      <div className="mb-20 text-center">
        <p className=" mb-2 text-sm font-medium uppercase text-primary">How does it work ?</p>

        <h2 className="text-center text-3xl font-semibold leading-tight sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight">
          Spark up your community
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-6 my-auto">
          {data.map((item, index) => (
            <button
              className="w-full"
              key={item.title}
              onClick={() => {
                setFeatureOpen(index);
                setTimer(0);
              }}
              type="button"
            >
              <TextComponent
                content={item.content}
                isOpen={featureOpen === index}
                loadingWidthPercent={featureOpen === index ? timer / 100 : 0}
                number={index + 1}
                title={item.title}
              />
            </button>
          ))}
        </div>
        <div className="h-full flex">
          <div className={cn('relative h-96 w-full overflow-hidden my-auto rounded-3xl  bg-muted')}>
            {data.map((item, index) => (
              <img
                alt={item.title}
                className={cn(
                  'absolute  w-full transform-gpu  object-cover transition-all duration-300 p-4 rounded-3xl',
                  featureOpen === index ? 'scale-100' : 'scale-70',
                  featureOpen > index ? 'translate-x-full' : ''
                )}
                key={item.title}
                src={item.srcImage}
                style={{ zIndex: data.length - index }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
