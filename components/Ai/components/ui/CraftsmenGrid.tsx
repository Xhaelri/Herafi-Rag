import React, { useMemo } from "react";
import { CraftsmanCard } from "./CraftsmanCard";
import { Craftsman } from "@/typs";

interface CraftsmenGridProps {
  craftsmen: Craftsman[];
}

export const CraftsmenGrid: React.FC<CraftsmenGridProps> = ({ craftsmen }) => {
  const displayedCraftsmen = useMemo(() => {
    return [...craftsmen];
  }, [craftsmen]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
      {displayedCraftsmen.map((craftsman) => (
        <CraftsmanCard key={craftsman.id} {...craftsman} />
      ))}
    </div>
  );
};