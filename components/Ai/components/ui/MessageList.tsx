// MessageList.tsx
import { Message } from "@ai-sdk/react";
import MessageItem from "./MessageItem";
<<<<<<< HEAD:components/Ai/components/ui/MessageList.tsx
import { Craftsman } from "@/typs";
=======

interface Craftsman {
  id: string;
  name: string;
  craft: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  description?: string;
  status?: string;
  cities?: string;
  completedJobs?: number;
  activeJobs?: number;
  image?: string | null;
}
>>>>>>> 8964f1a99377932b293d7fab7da34f12d318c4c0:components/ui/MessageList.tsx

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  processingMessageIds: Set<string>;
  extractedCardData: Record<string, Craftsman[]>;
}

export default function MessageList({
  messages,
  isLoading,
  processingMessageIds,
  extractedCardData,
}: MessageListProps) {
  return (
    <>
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          isLoading={isLoading}
          isProcessing={processingMessageIds.has(message.id)}
          craftsmen={extractedCardData[message.id] || []}
        />
      ))}
    </>
  );
}