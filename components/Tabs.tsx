"use client";

import { useState, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export function Tabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div>
      <div className="flex gap-1 mb-6 overflow-x-auto card p-1 w-fit max-w-full">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-3.5 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
              active === tab.id
                ? "bg-[#2a78d6] dark:bg-[#3987e5] text-white font-medium"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.find((tab) => tab.id === active)?.content}
    </div>
  );
}
