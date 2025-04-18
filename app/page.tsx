// Filename: app/chat/page.tsx
"use client";

import { useChat, Message } from "@ai-sdk/react";
import { ArrowUp, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button"; // Assuming path is correct
import { Textarea } from "@/components/ui/textarea"; // Assuming path is correct
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { CraftsmenGrid } from "@/components/ui/CraftsmenGrid"; // Assuming path is correct
import {
  extractCraftsmanData,
  messageContainsCraftsmanData,
} from "@/lib/extract-craftsman-data"; // Assuming path is correct
import Image from "next/image";

const api = "/api/chat";

// Define the Craftsman type (ensure properties match your data structure)
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
}

// Props type for the code component
interface CodeProps {
  node: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

// Code component for Syntax Highlighting
const CodeBlock: React.FC<CodeProps> = ({
  node,
  inline,
  className,
  children,
  ...props
}) => {
  const match = /language-(\w+)/.exec(className || "");
  return !inline && match ? (
    <SyntaxHighlighter
      style={atomDark} // Choose your desired theme
      language={match[1]}
      PreTag="div"
      {...props}
    >
      {String(children).replace(/\n$/, "")}
    </SyntaxHighlighter>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api,
    });

  // State to hold extracted card data mapped by message ID
  const [extractedCardData, setExtractedCardData] = useState<
    Record<string, Craftsman[]>
  >({});
  // State to track IDs of messages currently being processed for card data
  const [processingMessageIds, setProcessingMessageIds] = useState<Set<string>>(
    new Set()
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // --- Basic useEffects (Mobile, Resize, Scroll) ---
  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 768);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = isMobile ? 150 : 200;
      textareaRef.current.style.height = `${Math.min(
        scrollHeight,
        maxHeight
      )}px`;
    }
  }, [input, isMobile]);

  useEffect(() => {
    // Scroll logic adjusted to avoid scrolling during processing if preferred,
    // but generally scrolling to the latest message/indicator is fine.
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, processingMessageIds]); // Add processingMessageIds if you want scroll behavior tied to it

  // --- Effect for Data Extraction ---
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const messageId = lastMessage?.id; // Get ID early

    if (
      messageId && // Ensure messageId exists
      lastMessage.role === "assistant" &&
      !isLoading && // Process when loading finishes for the *whole chat*
      extractedCardData[messageId] === undefined && // Only process if not already attempted/done
      !processingMessageIds.has(messageId) // Double check not already processing (safety)
    ) {
      const textPart = lastMessage.parts.find(
        (part) => part.type === "text"
      )?.text;

      if (textPart && messageContainsCraftsmanData(textPart)) {
        // *** Mark message as processing START ***
        setProcessingMessageIds((prev) => new Set(prev).add(messageId));
        // console.log(`Message ${messageId}: START processing`);

        // Use a microtask to allow state update before heavy extraction potentially blocks
        queueMicrotask(() => {
          let data: Craftsman[] = [];
          try {
            data = extractCraftsmanData(textPart);
            // console.log(`Message ${messageId}: Extraction result ->`, data);
          } catch (extractionError) {
            console.error(
              `Message ${messageId}: Error during extraction ->`,
              extractionError
            );
          } finally {
            // Store the result (could be empty array)
            setExtractedCardData((prev) => ({ ...prev, [messageId]: data }));
            // *** Mark message as processing END ***
            setProcessingMessageIds((prev) => {
              const next = new Set(prev);
              next.delete(messageId);
              // console.log(`Message ${messageId}: END processing`);
              return next;
            });
          }
        });
      } else {
        // Message doesn't contain data markers, mark extraction as done (with empty result)
        // No need to mark as 'processing' visually as it should be quick
        if (textPart && !messageContainsCraftsmanData(textPart)) {
          setExtractedCardData((prev) => ({ ...prev, [messageId]: [] }));
        }
        // console.log(`Message ${messageId}: Not attempting extraction (no data markers).`);
      }
    }
    // Depend on messages, isLoading, and the state maps
  }, [messages, isLoading, extractedCardData, processingMessageIds]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile && !isLoading) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 font-inter">
      {/* Header */}
      <header className="p-4 border-b bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-center">
          <h1 className="text-xl font-semibold font-aboreto">
            <div className="flex items-center justify-center gap-3.5">
              <Image
                src={"/logo.png"}
                alt="شعار حرفي"
                width={100}
                height={100}
              />
              <p className="font-rubik text-3xl">مساعد حرفي</p>
            </div>
          </h1>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Initial Placeholder Message */}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16">
              <Sparkles className="h-8 w-8 mb-4 text-indigo-500" />
              <div className="text-lg font-medium">
                كيف يمكنني مساعدتك في خدمات حرفي اليوم؟
              </div>
              <div className="mt-2 text-sm text-center max-w-md">
                اسألني عن المشكلة التي تواجهك، أو اطلب التواصل مع حرفي مختص.
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.map((message) => {
            // --- RENDER THE MESSAGE BUBBLE ---
            return (
              <div
                key={message.id} // Use message.id here
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[85%] shadow-sm ${
                    message.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {/* --- Content Rendering Logic --- */}
                  {message.role === "assistant" ? (
                    // --- Assistant Message ---
                    (() => {
                      // Use IIFE to manage complex conditional logic cleanly
                      const messageId = message.id;
                      const isProcessing = processingMessageIds.has(messageId);
                      // Check if it's the last message and chat is globally loading AND we haven't finished processing
                      const cardData = extractedCardData[messageId]; // Can be undefined, [], or Craftsman[]
                      const isPotentiallyLoadingStream =
                        isLoading &&
                        messages[messages.length - 1]?.id === messageId &&
                        cardData === undefined;

                      return (
                        <div className="flex gap-2 items-start">
                          {/* Assistant Icon */}
                          <div className="h-8 w-8 p-1.5 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          {/* Assistant Content Area */}
                          <div className="min-w-0 flex-1">
                            {isProcessing || isPotentiallyLoadingStream ? (
                              // --- Show Loading/Processing within Bubble ---
                              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 h-6">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>
                                  {isProcessing
                                    ? "جاري تجهيز المعلومات..."
                                    : "لحظة من فضلك..."}
                                </span>
                              </div>
                            ) : (
                              // --- Show Final Content (Intro + Cards OR Full Text) ---
                              <>
                                {cardData && cardData.length > 0 ? (
                                  // Data Extracted: Show Intro (if any)
                                  <>
                                    {(() => {
                                      // Calculate intro text ONLY when needed
                                      const messageTextContent = message.parts
                                        .filter((p) => p.type === "text")
                                        .map((p) => p.text)
                                        .join("\n");
                                      const firstMarkerIndex =
                                        messageTextContent.indexOf(
                                          "--- المستند"
                                        );
                                      let intro = "";
                                      if (firstMarkerIndex >= 0) {
                                        intro = messageTextContent
                                          .substring(0, firstMarkerIndex)
                                          .trim();
                                      }
                                      return intro ? (
                                        <div className="prose prose-sm max-w-none dark:prose-invert mb-2">
                                          <ReactMarkdown
                                            components={{ code: CodeBlock }}
                                          >
                                            {intro}
                                          </ReactMarkdown>
                                        </div>
                                      ) : null;
                                    })()}
                                    {/* Cards are rendered below */}
                                  </>
                                ) : (
                                  // No Data Extracted OR Processing finished with no cards: Show full original text
                                  <div className="prose prose-sm max-w-none dark:prose-invert">
                                    {message.parts.map((part, i) =>
                                      part.type === "text" ? (
                                        <ReactMarkdown
                                          key={`${messageId}-part-${i}`}
                                          components={{ code: CodeBlock }}
                                        >
                                          {part.text}
                                        </ReactMarkdown>
                                      ) : null
                                    )}
                                  </div>
                                )}

                                {/* Render Cards (only if processing done and data exists) */}
                                {cardData && cardData.length > 0 && (
                                  <div className="mt-4">
                                    <CraftsmenGrid craftsmen={cardData} />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })() // End of IIFE
                  ) : (
                    // --- User Message ---
                    <div className="prose prose-sm prose-invert max-w-none">
                      {message.parts.map((part, i) =>
                        part.type === "text" ? (
                          <ReactMarkdown key={`${message.id}-part-${i}`}>
                            {part.text}
                          </ReactMarkdown>
                        ) : null
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-xs mt-1 opacity-70 text-right">
                    {new Date(
                      message.createdAt ?? Date.now()
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                </div>
              </div>
            );
            // --- End of the return statement inside messages.map ---
          })}

          {/* Loading Indicator (Optional: Could be removed if in-bubble loading is sufficient) */}
          {/*
          {isLoading && !messages.some(msg => processingMessageIds.has(msg.id)) && messages[messages.length - 1]?.role !== 'assistant' && (
             <div className="flex justify-start">
               <div className="rounded-2xl px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                 <div className="flex items-center gap-2">
                   <div className="h-8 w-8 p-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                     <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-300 animate-spin" />
                   </div>
                   <div className="text-sm text-slate-500 dark:text-slate-400">جاري التفكير...</div>
                 </div>
               </div>
             </div>
           )}
          */}

          {/* Element to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 pb-6 bg-white dark:bg-slate-800 border-t">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2 border border-slate-300 dark:border-slate-600 p-2 rounded-xl bg-white dark:bg-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500"
        >
          <Textarea
            ref={textareaRef}
            className="flex-1 border-none resize-none min-h-[40px] focus:outline-none focus-visible:ring-0 focus-visible:border-none shadow-none bg-transparent dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            value={input}
            placeholder="اسألني عن المشكلة التي تواجهك..."
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              maxHeight: isMobile ? "150px" : "200px",
              overflowY: "auto",
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </form>
        <div className="max-w-3xl mx-auto text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
          الردود تعتمد على معلومات منصة حرفي. يرجى التحقق دائمًا من التفاصيل
          المهمة.
        </div>
      </footer>
    </div>
  );
}
