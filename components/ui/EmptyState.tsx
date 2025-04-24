// EmptyState.tsx
import { Hammer } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16" dir="rtl">
      <Hammer className="h-8 w-8 mb-4" style={{ color: "#8D5524" }} />
      <div
        className="text-lg font-medium font-rubik"
        style={{ color: "#C0392B" }}
      >
        كيف يمكنني مساعدتك في خدمات حرفي اليوم؟
      </div>
      <div
        className="mt-2 text-sm text-center max-w-md font-rubik"
        style={{ color: "#8D5524" }}
      >
        اسألني عن المشكلة التي تواجهك، أو اطلب التواصل مع حرفي مختص.
      </div>
    </div>
  );
}