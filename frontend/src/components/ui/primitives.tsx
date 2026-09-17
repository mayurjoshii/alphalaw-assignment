/**
 * The small set of inputs the three screens share, in the beUI spirit
 * (copy-paste, motion-first) but wearing this project's ledger palette
 * rather than beUI's defaults. See `beui-components-analysis.md`.
 */

import { motion } from 'motion/react';
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

// ------------------------------------------------------------------ button

type ButtonTone = 'primary' | 'ghost' | 'quiet';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  tone?: ButtonTone;
  disabled?: boolean;
  /** Drives the built-in pending/done affordance (beUI "Stateful Button"). */
  state?: 'idle' | 'pending' | 'done';
  className?: string;
}

const TONES: Record<ButtonTone, string> = {
  primary: 'bg-ink text-paper-high border-ink hover:bg-oxblood hover:border-oxblood',
  ghost: 'bg-paper-high text-ink border-rule hover:border-ink-faint hover:bg-paper-raised',
  quiet: 'bg-transparent text-ink-soft border-transparent hover:text-oxblood',
};

export function Button({
  children,
  onClick,
  type = 'button',
  tone = 'primary',
  disabled,
  state = 'idle',
  className,
}: ButtonProps) {
  const busy = state === 'pending';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      whileTap={{ scale: disabled || busy ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 520, damping: 30 }}
      className={cn(
        'focus-ring relative inline-flex items-center justify-center gap-2 rounded-[3px] border px-4 py-2',
        'font-mono text-[11px] font-medium tracking-[0.12em] uppercase',
        // Labels are short and spaced; wrapping one reads as a layout bug.
        // shrink-0 keeps a flex row from squeezing the button to force it.
        'shrink-0 whitespace-nowrap',
        'transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-45',
        TONES[tone],
        className
      )}
    >
      {busy && (
        <motion.span
          aria-hidden
          className="size-3 rounded-full border-[1.5px] border-current border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {state === 'done' && <span aria-hidden>✓</span>}
      {children}
    </motion.button>
  );
}

// ------------------------------------------------------------------- badge

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'oxblood' | 'brass' | 'verdigris';
}) {
  const tones = {
    neutral: 'bg-paper text-ink-faint border-rule',
    oxblood: 'bg-oxblood-wash text-oxblood border-oxblood/25',
    brass: 'bg-brass-wash text-brass border-brass/25',
    verdigris: 'bg-verdigris-wash text-verdigris border-verdigris/25',
  }[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[2px] border px-1.5 py-0.5',
        'font-mono text-[9px] font-semibold tracking-[0.12em] uppercase',
        tones
      )}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------- field

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="stamp mb-1.5 flex items-baseline justify-between gap-3">
        <span>{label}</span>
        {hint && <span className="normal-case tracking-normal opacity-70">{hint}</span>}
      </span>
      {children}
      {error && (
        <motion.span
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-oxblood mt-1 block font-mono text-[10px]"
        >
          {error}
        </motion.span>
      )}
    </label>
  );
}

const CONTROL = cn(
  'focus-ring w-full rounded-[3px] border border-rule bg-paper-high px-3 py-2',
  'font-mono text-[13px] text-ink placeholder:text-ink-faint/60',
  'transition-colors duration-150 hover:border-ink-faint'
);

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, props.className)} />;
}

export function Select({
  options,
  placeholder = 'Not set',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select {...props} className={cn(CONTROL, 'appearance-none pr-8', props.className)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="text-ink-faint pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px]">
        ▾
      </span>
    </div>
  );
}

/**
 * Preferred over Select for 2-4 mutually exclusive values, where seeing every
 * option at once beats hiding them behind a click.
 */
export function RadioGroup({
  value,
  onChange,
  options,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  name: string;
}) {
  return (
    <div className="border-rule bg-paper-high flex gap-0.5 rounded-[3px] border p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'focus-ring relative flex-1 rounded-[2px] px-3 py-1.5',
              'font-mono text-[10px] font-medium tracking-[0.1em] uppercase',
              'transition-colors duration-200',
              active ? 'text-paper-high' : 'text-ink-faint hover:text-ink'
            )}
          >
            {active && (
              <motion.span
                layoutId={`radio-${name}`}
                className="bg-ink absolute inset-0 rounded-[2px]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------- tooltip

/** Hover explainer. Used on resolved rows to surface *why* a value applied. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 -translate-x-1/2',
          'bg-ink text-paper-high w-max max-w-[16rem] rounded-[3px] px-2 py-1',
          'font-mono text-[10px] leading-relaxed whitespace-normal',
          'opacity-0 blur-[2px] transition-[opacity,filter,transform] duration-200',
          'translate-y-1 group-hover/tip:translate-y-0 group-hover/tip:opacity-100 group-hover/tip:blur-none'
        )}
      >
        {label}
      </span>
    </span>
  );
}
