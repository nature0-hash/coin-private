'use client';

// ============================================================
// Coin Private: Appearance (light / dark) selector
// Used in Client → Settings and Admin → Platform settings.
// ============================================================
import { useTheme, type Theme } from '@/lib/theme';
import { Sun, Moon, MonitorCog } from 'lucide-react';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ value: Theme; label: string; desc: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', desc: 'Crisp daylight surfaces', icon: Sun },
  { value: 'dark', label: 'Dark', desc: 'Obsidian, low-light comfort', icon: Moon },
];

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="cp-card p-5">
      <div className="flex items-start gap-3.5 mb-5">
        <span className="w-10 h-10 rounded-full bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
          <MonitorCog className="w-5 h-5" />
        </span>
        <div>
          <p className="font-medium text-[14.5px]">Appearance</p>
          <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">
            Switch between light and dark mode. Your choice is saved on this device and applied across the entire platform instantly.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-[400px]" role="radiogroup" aria-label="Color theme">
        {OPTIONS.map((o) => {
          const active = theme === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(o.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 px-4 py-4 rounded-2xl border transition-all text-center cursor-pointer',
                active
                  ? 'border-primary bg-primary/8 ring-1 ring-primary/40'
                  : 'border-border bg-secondary/50 hover:border-border-strong hover:bg-hover'
              )}
            >
              <Icon className={cn('w-5 h-5', active ? 'text-primary' : 'text-muted-foreground')} />
              <span className="text-[13.5px] font-medium">{o.label}</span>
              <span className="text-[11.5px] text-muted-foreground leading-snug">{o.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
