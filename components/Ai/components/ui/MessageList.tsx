// MessageList.tsx
import { Message } from "@ai-sdk/react";
import MessageItem from "./MessageItem";
import { Craftsman } from "@/typs";

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