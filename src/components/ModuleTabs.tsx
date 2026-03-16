interface ModuleTabItem {
  key: string;
  label: string;
}

interface ModuleTabsProps {
  items: ModuleTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function ModuleTabs({ items, activeKey, onChange }: ModuleTabsProps) {
  if (!items.length) return null;

  return (
    <div className="module-tabs" role="tablist" aria-label="Secciones del modulo">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={activeKey === item.key}
          className={`module-tab${activeKey === item.key ? " active" : ""}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
