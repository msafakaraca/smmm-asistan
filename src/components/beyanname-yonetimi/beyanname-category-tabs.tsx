"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { BeyannameTuru } from "./hooks/use-beyanname-yonetimi";

interface BeyannameCategoryTabsProps {
    categories: string[];
    activeCategory: string;
    onCategoryChange: (category: string) => void;
    categoryTurleri: BeyannameTuru[];
}

export const BeyannameCategoryTabs = memo(function BeyannameCategoryTabs({
    categories,
    activeCategory,
    onCategoryChange,
    categoryTurleri,
}: BeyannameCategoryTabsProps) {
    return (
        <div className="shrink-0 border-b px-4 bg-background">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-1">
                {categories.map((category) => {
                    const isActive = category === activeCategory;
                    return (
                        <button
                            key={category}
                            onClick={() => onCategoryChange(category)}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            {category}
                            {isActive && (
                                <span className="ml-1.5 text-xs opacity-80">
                                    ({categoryTurleri.length})
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
});
