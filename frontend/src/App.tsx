import { useState } from 'react';
import { motion } from 'motion/react';
import { EmployeeDirectory } from '@/components/employees/EmployeeDirectory';
import { PolicyStudio } from '@/components/policies/PolicyStudio';
import { cn } from '@/lib/cn';

type View = 'directory' | 'studio';

const VIEWS: { id: View; label: string }[] = [
  { id: 'directory', label: 'Directory' },
  { id: 'studio', label: 'Policy studio' },
];

export default function App() {
  // Two screens and no deep links needed yet -- local state beats a router.
  const [view, setView] = useState<View>('directory');

  return (
    <div className="min-h-dvh">
      <header className="border-rule bg-paper/80 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-3.5">
          <div className="flex items-baseline gap-2.5">
            <span className="bg-oxblood text-paper-high flex size-6 items-center justify-center rounded-[2px] font-mono text-[11px] font-semibold">
              α
            </span>
            <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">
              AlphaLaw
            </span>
            <span className="stamp">Policy desk</span>
          </div>

          <nav className="flex items-center gap-1">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  'focus-ring relative rounded-[3px] px-3 py-1.5',
                  'font-mono text-[10px] font-medium tracking-[0.1em] uppercase',
                  'transition-colors duration-200',
                  view === item.id ? 'text-ink' : 'text-ink-faint hover:text-ink-soft'
                )}
              >
                {item.label}
                {view === item.id && (
                  <motion.span
                    layoutId="nav-underline"
                    className="bg-oxblood absolute inset-x-3 -bottom-[15px] h-[2px]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
              </button>
            ))}
          </nav>

          <span className="stamp ml-auto hidden sm:inline">Rule engine · live</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {view === 'directory' ? <EmployeeDirectory /> : <PolicyStudio />}
      </main>
    </div>
  );
}
