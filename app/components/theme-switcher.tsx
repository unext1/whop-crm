import { Computer, Moon, Sun } from 'lucide-react';
import { href, useFetcher } from 'react-router';

import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { useRootData } from '~/hooks/use-route-data-hook';

const icons = {
  light: <Sun className="h-5 w-5" />,
  dark: <Moon className="h-5 w-5" />,
  system: <Computer className="h-5 w-5" />
} as const;

const themes = Object.keys(icons) as Array<keyof typeof icons>;
type Theme = (typeof themes)[number];

export function ThemeToggle() {
  const data = useRootData();
  const theme = data?.colorScheme as Theme;

  const fetcher = useFetcher();
  const optimisticTheme = fetcher.state !== 'idle' ? (fetcher.formData?.get('theme') as Theme) : theme;

  const updateTheme = (newTheme: Theme) => {
    const element = document.documentElement;
    element.setAttribute('data-theme', newTheme);
    element.style.colorScheme = newTheme;

    void fetcher.submit({ theme: newTheme }, { method: 'POST', action: href('/api/theme') });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          {icons[optimisticTheme]}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((key) => (
          <DropdownMenuItem
            key={key}
            className="space-x-2"
            onClick={() => updateTheme(key)}
            disabled={key === optimisticTheme}
          >
            {icons[key]}
            <span className="capitalize">{key}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
