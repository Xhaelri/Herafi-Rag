import React, { useMemo } from "react";
import { CraftsmanCard } from "./CraftsmanCard";

interface Craftsman {
  id: string;
  name: string;
  craft: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  description?: string;
  status?: string;
  image?: string; // Already includes image prop
}

interface CraftsmenGridProps {
  craftsmen: Craftsman[];
}

export const CraftsmenGrid: React.FC<CraftsmenGridProps> = ({ craftsmen }) => {
  const displayedCraftsmen = useMemo(() => {
    return [...craftsmen]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0)) // Sort by rating, highest first
      .slice(0, 4); // Limit to 4 craftsmen
  }, [craftsmen]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
        {displayedCraftsmen.map((craftsman) => (
          <CraftsmanCard key={craftsman.id} {...craftsman} />
        ))}
    </div>
  );
};