import { ChevronDown, Clock, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useLocation, useNavigation, useSearchParams } from 'react-router';
import { Button } from '~/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';

const sortOptions = [
  {
    value: 'newest',
    label: 'Newest',
    description: 'Sort by newest posts',
    icon: Clock,
  },
  {
    value: 'most_liked',
    label: 'Most Liked',
    description: 'Sort by most liked posts',
    icon: Flame,
  },
];

const SortingPopover = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const location = useLocation();
  const sort = searchParams.get('sort') || 'newest';
  const [open, setOpen] = useState(false);
  // Only show loading when navigating within the same route (sorting)
  const isLoading = navigation.state === 'loading' && navigation.location?.pathname === location.pathname;

  const currentOption = sortOptions.find((option) => option.value === sort) || sortOptions[0];

  const handleSortChange = (sortValue: string) => {
    setSearchParams({ sort: sortValue });
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 bg-muted rounded-3xl p-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`flex items-center gap-2 h-10 px-4 bg-transparent text-xs hover:bg-transparent text-foreground transition-all rounded-3xl shadow-s group translate duration-300 border border-transparent ${
              isLoading ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <currentOption.icon className="w-4 h-4 text-foreground group-hover:text-primary transition-all duration-300" />
            <span className="text-xs font-semibold text-foreground">{currentOption.label}</span>
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-3 h-3 opacity-70 text-foreground" />
            </motion.div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-70 p-0 border-border bg-background/95 backdrop-blur-xl shadow-2xl rounded-3xl"
          align="end"
          sideOffset={8}
        >
          <div className="space-y-2 p-2">
            {sortOptions.map((option, index) => {
              const Icon = option.icon;
              const isSelected = option.value === sort;

              return (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={`w-full p-3 rounded-xl text-left transition-all duration-200 group ${
                    isSelected
                      ? 'bg-gradient-to-r from-primary/20 to-primary/15 border border-primary/30 shadow-lg'
                      : 'hover:bg-background/80 border border-transparent hover:border-primary/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg transition-all duration-200 ${
                        isSelected
                          ? 'bg-gradient-to-br from-primary to-primary/80 shadow-lg'
                          : 'bg-background/60 group-hover:bg-primary/10'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 transition-colors duration-200 ${
                          isSelected ? 'text-primary-foreground' : 'text-primary group-hover:text-primary'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium transition-colors duration-200 ${
                          isSelected ? 'text-foreground' : 'text-foreground/90 group-hover:text-foreground'
                        }`}
                      >
                        {option.label}
                      </div>
                      <div
                        className={`text-xs transition-colors duration-200 mt-0.5 ${
                          isSelected ? 'text-foreground/70' : 'text-muted-foreground group-hover:text-foreground/60'
                        }`}
                      >
                        {option.description}
                      </div>
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-2 h-2 bg-primary rounded-full shadow-sm"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SortingPopover;
