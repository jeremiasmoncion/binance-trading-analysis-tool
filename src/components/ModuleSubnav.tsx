interface ModuleSubnavItem {
  id: string;
  label: string;
}

interface ModuleSubnavProps {
  items: ModuleSubnavItem[];
}

export function ModuleSubnav({ items }: ModuleSubnavProps) {
  if (!items.length) return null;

  function handleScroll(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="module-subnav">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="module-subnav-item"
          onClick={() => handleScroll(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
