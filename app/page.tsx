// Filename: app/chat/page.tsx
"use client";

import { Message } from "@ai-sdk/react";
import { ArrowUp, Hammer, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { CraftsmenGrid } from "@/components/ui/CraftsmenGrid";
import {
  extractCraftsmanData,
  messageContainsCraftsmanData,
} from "@/lib/extract-craftsman-data";
import Image from "next/image";

// Define the API endpoint
const api = "/api/chat";

// Define the Craftsman type
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
      style={atomDark}
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

// Default text constant for comparison
const DEFAULT_IMAGE_TEXT = "ايه المشكلة في الصورة هنا؟";

export default function Chat() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Local state for user and assistant messages
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [assistantMessages, setAssistantMessages] = useState<Message[]>([]);
  // Combine user and assistant messages for rendering
  const allMessages = [...userMessages, ...assistantMessages].sort(
    (a, b) =>
      new Date(a.createdAt ?? Date.now()).getTime() -
      new Date(b.createdAt ?? Date.now()).getTime()
  );

  // State for image upload
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for extracted card data and processing
  const [extractedCardData, setExtractedCardData] = useState<
    Record<string, Craftsman[]>
  >({});
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, processingMessageIds]);

  // Log messages for debugging
  useEffect(() => {
    console.log("All messages:", allMessages);
  }, [allMessages]);

  // --- Effect for Data Extraction ---
  useEffect(() => {
    const lastMessage = allMessages[allMessages.length - 1];
    const messageId = lastMessage?.id;

    if (
      messageId &&
      lastMessage.role === "assistant" &&
      !isLoading &&
      extractedCardData[messageId] === undefined &&
      !processingMessageIds.has(messageId)
    ) {
      const textPart = Array.isArray(lastMessage.content)
        ? lastMessage.content.find((part) => part.type === "text")?.text
        : lastMessage.content;

      if (textPart && messageContainsCraftsmanData(textPart)) {
        setProcessingMessageIds((prev) => new Set(prev).add(messageId));
        queueMicrotask(() => {
          let data: Craftsman[] = [];
          try {
            data = extractCraftsmanData(textPart);
          } catch (extractionError) {
            console.error(
              `Message ${messageId}: Error during extraction ->`,
              extractionError
            );
          } finally {
            setExtractedCardData((prev) => ({ ...prev, [messageId]: data }));
            setProcessingMessageIds((prev) => {
              const next = new Set(prev);
              next.delete(messageId);
              return next;
            });
          }
        });
      } else {
        if (textPart && !messageContainsCraftsmanData(textPart)) {
          setExtractedCardData((prev) => ({ ...prev, [messageId]: [] }));
        }
      }
    }
  }, [allMessages, isLoading, extractedCardData, processingMessageIds]);

  // --- Image Upload Handlers ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("Selected file:", file);
    if (file && file.type.startsWith("image/")) {
      if (file.size > 5 * 1024 * 1024) {
        alert("الصورة كبيرة جدًا. يرجى اختيار صورة أقل من 5 ميغابايت.");
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        console.log("Image preview set:", reader.result);
      };
      reader.onerror = () => {
        console.error("Error reading file for preview");
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImage(null);
      setImagePreview(null);
      console.log("No valid image selected");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form, selectedImage:", selectedImage, "input:", input);
    if (!input.trim() && !selectedImage) {
      console.log("No input or image provided, submission aborted");
      return;
    }

    setIsLoading(true);

    let messageContent: Message["content"];
    if (selectedImage) {
      try {
        const base64Image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(selectedImage);
        });
        console.log("Base64 image generated, length:", base64Image.length);
        messageContent = [
          { type: "text", text: input.trim() || DEFAULT_IMAGE_TEXT },
          { type: "image", image: base64Image },
        ];
      } catch (error) {
        console.error("Error converting image to base64:", error);
        alert("حدث خطأ أثناء معالجة الصورة. يرجى المحاولة مرة أخرى.");
        setIsLoading(false);
        return;
      }
    } else {
      messageContent = input.trim();
      console.log("No image, using text only:", messageContent);
    }

    console.log("Submitting message content:", JSON.stringify(messageContent));

    // Add user message to local state
    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      createdAt: new Date(),
    };
    setUserMessages((prev) => [...prev, newMessage]);

    // Send to backend via custom fetch
    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...allMessages, newMessage],
        }),
      });
      console.log("Response status:", response.status, response.statusText);
      const responseText = await response.text(); // Get raw response
      console.log("Raw response:", responseText);
      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}, Response: ${responseText}`);
      }
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      console.log("Backend response:", result);

      // Add assistant response to local state
      if (result && result.role === "assistant") {
        setAssistantMessages((prev) => [...prev, result]);
      } else {
        console.warn("No assistant response in result:", result);
      }
    } catch (error) {
      console.error("Error sending message to backend:", error);
      alert("حدث خطأ أثناء إرسال الرسالة: " + (error.message || "خطأ غير معروف"));
    }

    setIsLoading(false);
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile && !isLoading) {
      e.preventDefault();
      handleCustomSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div
      className="flex flex-col h-screen font-inter"
      style={{
        backgroundColor: "#F5F5F5", // Light gray background inspired by the logo's patterned backdrop
        backgroundImage: "linear-gradient(135deg, rgba(196, 57, 43, 0.1) 0%, rgba(244, 208, 63, 0.1) 100%)", // Subtle gradient with red and beige
      }}
    >
      {/* Header */}
      <header
        className="p-4 border-b shadow-sm"
        style={{
          backgroundColor: "#C0392B", // Red background to match the logo's circle
          color: "#FFFFFF", // White text for contrast
          borderBottomColor: "#8D5524", // Brown border inspired by the tools
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-center">
          <h1 className="text-xl font-semibold font-aboreto">
            <div className="flex items-center justify-center gap-3.5">
              <Image
                src={"/logo.png"}
                alt="شعار حرفي"
                width={100}
                height={100}
              />
              <p
                className="font-rubik text-3xl"
                style={{ color: "#F4D03F" }} // Beige text to match the hard hat
              >
                مساعد حرفي
              </p>
            </div>
          </h1>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {allMessages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full py-16">
              <Hammer
                className="h-8 w-8 mb-4"
                style={{ color: "#8D5524" }} // Brown icon to match the tools
              />
              <div
                className="text-lg font-medium font-rubik"
                style={{ color: "#C0392B" }} // Red text
              >
                كيف يمكنني مساعدتك في خدمات حرفي اليوم؟
              </div>
              <div
                className="mt-2 text-sm text-center max-w-md font-rubik"
                style={{ color: "#8D5524" }} // Brown text for secondary info
              >
                اسألني عن المشكلة التي تواجهك، أو اطلب التواصل مع حرفي مختص.
              </div>
            </div>
          )}

          {allMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`rounded-2xl px-4 py-3 max-w-[85%] shadow-sm relative ${
                  message.role === "user"
                    ? "text-black" // Black text for readability on beige
                    : "bg-white border" // White background for assistant messages
                }`}
                style={
                  message.role === "user"
                    ? {
                        backgroundColor: "#F4D03F", // Beige background for user messages
                        borderColor: "#C0392B", // Red border
                      }
                    : {
                        borderColor: "#C0392B", // Red border for assistant messages
                      }
                }
              >
                {message.role === "assistant" ? (
                  <div className="flex gap-2 items-start">
                    <div
                      className="h-8 w-8 p-1.5 shrink-0 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: "#F4D03F", // Beige background for the icon circle
                        color: "#C0392B", // Red icon
                      }}
                    >
                      <Hammer className="w-5 h-5" /> {/* Changed to Hammer icon */}
                    </div>
                    <div className="min-w-0 flex-1">
                      {processingMessageIds.has(message.id) ||
                      (isLoading &&
                        allMessages[allMessages.length - 1]?.id === message.id &&
                        !extractedCardData[message.id]) ? (
                        <div
                          className="flex items-center gap-2 text-sm h-6"
                          style={{ color: "#8D5524" }} // Brown text for loading
                        >
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>
                            {processingMessageIds.has(message.id)
                              ? "جاري تجهيز المعلومات..."
                              : "لحظة من فضلك..."}
                          </span>
                        </div>
                      ) : (
                        <>
                          {extractedCardData[message.id]?.length > 0 ? (
                            <>
                              {(() => {
                                const messageTextContent = Array.isArray(
                                  message.content
                                )
                                  ? message.content
                                      .filter((p) => p.type === "text")
                                      .map((p) => p.text)
                                      .join("\n")
                                  : message.content;
                                const firstMarkerIndex =
                                  messageTextContent.indexOf("--- المستند");
                                let intro = "";
                                if (firstMarkerIndex >= 0) {
                                  intro = messageTextContent
                                    .substring(0, firstMarkerIndex)
                                    .trim();
                                }
                                return intro ? (
                                  <div
                                    className="prose prose-sm max-w-none mb-2 font-rubik"
                                    style={{ color: "#8D5524" }} // Brown text
                                  >
                                    <ReactMarkdown
                                      components={{ code: CodeBlock }}
                                    >
                                      {intro}
                                    </ReactMarkdown>
                                  </div>
                                ) : null;
                              })()}
                            </>
                          ) : (
                            <div
                              className="prose prose-sm max-w-none font-rubik"
                              style={{ color: "#8D5524" }} // Brown text for assistant messages
                            >
                              {Array.isArray(message.content) ? (
                                message.content.map((part, i) =>
                                  part.type === "text" ? (
                                    <ReactMarkdown
                                      key={`${message.id}-part-${i}`}
                                      components={{ code: CodeBlock }}
                                    >
                                      {part.text}
                                    </ReactMarkdown>
                                  ) : part.type === "image" ? (
                                    <img
                                      key={`${message.id}-part-${i}`}
                                      src={part.image}
                                      alt="Assistant provided image"
                                      className="max-w-full rounded-lg mt-2"
                                    />
                                  ) : null
                                )
                              ) : (
                                <ReactMarkdown components={{ code: CodeBlock }}>
                                  {message.content}
                                </ReactMarkdown>
                              )}
                            </div>
                          )}
                          {extractedCardData[message.id]?.length > 0 && (
                            <div className="mt-4">
                              <CraftsmenGrid
                                craftsmen={extractedCardData[message.id]}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="prose prose-sm max-w-none font-rubik"
                    style={{ color: "#000000" }} // Black text for user messages
                  >
                    {Array.isArray(message.content) ? (
                      message.content.map((part: any, i: number) => {
                        // If this part is an image, always render it
                        if (part.type === "image") {
                          return (
                            <img
                              key={`${message.id}-part-${i}`}
                              src={part.image}
                              alt="User uploaded image"
                              className="max-w-[200px] rounded-lg mt-2"
                            />
                          );
                        }
                        // If this part is text, render it only if it's not the default text
                        if (part.type === "text") {
                          const isDefaultText = part.text === DEFAULT_IMAGE_TEXT;
                          if (isDefaultText) {
                            return null; // Skip rendering the default text
                          }
                          return (
                            <ReactMarkdown key={`${message.id}-part-${i}`}>
                              {part.text}
                            </ReactMarkdown>
                          );
                        }
                        return null;
                      })
                    ) : (
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    )}
                  </div>
                )}

                <div
                  className="text-xs mt-1 opacity-70 text-right font-rubik"
                  style={{
                    color: message.role === "user" ? "#C0392B" : "#C0392B", // Red timestamp
                  }}
                >
                  {new Date(message.createdAt ?? Date.now()).toLocaleTimeString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    }
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer
        className="p-4 pb-6 border-t"
        style={{
          backgroundColor: "#FFFFFF", // White background for footer
          borderTopColor: "#C0392B", // Red border
        }}
      >
        <form
          onSubmit={handleCustomSubmit}
          className="max-w-3xl mx-auto flex items-end gap-2 p-2 rounded-xl shadow-sm focus-within:ring-2"
          style={{
            borderColor: "#C0392B", // Red border
            backgroundColor: "#FFFFFF", // White background
            focusWithin: {
              ringColor: "#F4D03F", // Beige ring on focus
            },
          }}
        >
          <div className="flex flex-col w-full">
            {imagePreview && (
              <div className="mb-2">
                <img
                  src={imagePreview}
                  alt="Image preview"
                  className="max-w-[100px] rounded-lg"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedImage(null);
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-1 font-rubik"
                  style={{
                    backgroundColor: "#C0392B", // Red button
                    color: "#FFFFFF", // White text
                  }}
                >
                  إزالة الصورة
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-10 shrink-0"
                style={{
                  borderColor: "#C0392B", // Red border
                  color: "#C0392B", // Red icon
                }}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageChange}
                className="hidden"
              />
              <Textarea
                ref={textareaRef}
                className="flex-1 border-none resize-none min-h-[40px] focus:outline-none focus-visible:ring-0 focus-visible:border-none shadow-none font-rubik"
                value={input}
                placeholder="اسألني عن المشكلة التي تواجهك..."
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                style={{
                  maxHeight: isMobile ? "150px" : "200px",
                  overflowY: "auto",
                  backgroundColor: "transparent",
                  color: "#8D5524", // Brown text
                  placeholderColor: "#C0392B", // Red placeholder
                }}
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 rounded-full cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed font-rubik"
                disabled={(!input.trim() && !selectedImage) || isLoading}
                style={{
                  backgroundColor: "#C0392B", // Red button
                  color: "#FFFFFF", // White icon
                }}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </form>
        <div
          className="max-w-3xl mx-auto text-xs mt-2 text-center font-rubik"
          style={{ color: "#8D5524" }} // Brown text for footer note
        >
          الردود تعتمد على معلومات منصة حرفي. يرجى التحقق دائمًا من التفاصيل
          المهمة.
        </div>
      </footer>
    </div>
  );
}