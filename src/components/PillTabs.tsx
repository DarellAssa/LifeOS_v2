interface PillTabsProps {
  tabs: { value: string; label: string }[];
  active: string;
  onChange: (value: string) => void;
}

export function PillTabs({ tabs, active, onChange }: PillTabsProps) {
  return (
    <div className="flex gap-0.5 rounded-full bg-muted/70 p-1 border border-border/30">
      {tabs.map(tab => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`flex-1 px-4 py-1.5 text-sm rounded-full capitalize transition-all duration-200 ${
            active === tab.value
              ? 'bg-card text-foreground font-medium shadow-[var(--shadow-sm)] border border-border/30'
              : 'text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
