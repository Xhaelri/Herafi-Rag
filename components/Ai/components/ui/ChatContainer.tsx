"use client";

import { Message } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import MessageList from "./MessageList";
import InputArea from "./InputArea";
import EmptyState from "./EmptyState";
import { extractCraftsmanData, messageContainsCraftsmanData } from "@/lib/AI/extract-craftsman-data";
import { Craftsman } from "@/typs";

const api = "/api/chat";


export default function ChatContainer() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userMessages, setUserMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("chatMessages");
    if (saved) {
      const { messages, timestamp } = JSON.parse(saved);
      if (Date.now() - timestamp < 3600000) {
        return messages.filter((msg: Message) => msg.role === "user");
      }
    }
    return [];
  });
  const [assistantMessages, setAssistantMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("chatMessages");
    if (saved) {
      const { messages, timestamp } = JSON.parse(saved);
      if (Date.now() - timestamp < 3600000) {
        return messages.filter((msg: Message) => msg.role === "assistant");
      }
    }
    return [];
  });
  const allMessages = [...userMessages, ...assistantMessages].sort(
    (a, b) =>
      new Date(a.createdAt ?? Date.now()).getTime() -
      new Date(b.createdAt ?? Date.now()).getTime()
  );

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [extractedCardData, setExtractedCardData] = useState<
    Record<string, Craftsman[]>
  >({});
  const [processingMessageIds, setProcessingMessageIds] = useState<Set<string>>(
    new Set()
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < 768);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages, processingMessageIds]);

  useEffect(() => {
    localStorage.setItem(
      "chatMessages",
      JSON.stringify({
        messages: allMessages,
        timestamp: Date.now(),
      })
    );
  }, [allMessages]);

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
            console.log("Extracted craftsmen data:", data);
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
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 5 * 1024 * 1024) {
        alert("الصورة كبيرة جدًا. يرجى اختيار صورة أقل من 5 ميغابايت.");
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.onerror = () => {
        console.error("Error reading file for preview");
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const DEFAULT_IMAGE_TEXT = "ايه المشكلة في الصورة هنا؟";

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) {
      return;
    }

    setInput("");
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

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
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      createdAt: new Date(),
    };
    setUserMessages((prev) => [...prev, newMessage]);

    const tempAssistantMessage: Message = {
      id: `temp-${newMessage.id}`,
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };
    setAssistantMessages((prev) => [...prev, tempAssistantMessage]);

    try {
      const response = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...allMessages, newMessage],
        }),
      });
      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`);
      }
      const result = await response.json();

      if (result && result.role === "assistant") {
        setAssistantMessages((prev) =>
          prev.filter((msg) => msg.id !== `temp-${newMessage.id}`).concat(result)
        );
      }
    } catch (error) {
      console.error("Error sending message to backend:", error);
      alert(
        "حدث خطأ أثناء إرسال الرسالة: " + (error.message || "خطأ غير معروف")
      );
      setAssistantMessages((prev) =>
        prev.filter((msg) => msg.id !== `temp-${newMessage.id}`)
      );
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile && !isLoading) {
      e.preventDefault();
      handleCustomSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div
      className="flex flex-col rounded-b-lg h-screen font-inter max-h-[500px]"
      style={{
        backgroundColor: "#F5F5F5",
        backgroundImage:
          "linear-gradient(135deg, rgba(196, 57, 43, 0.1) 0%, rgba(244, 208, 63, 0.1) 100%)",
      }}
      dir="ltr"
    >
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {allMessages.length === 0 && !isLoading ? (
            <EmptyState />
          ) : (
            <MessageList
              messages={allMessages}
              isLoading={isLoading}
              processingMessageIds={processingMessageIds}
              extractedCardData={extractedCardData}
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <InputArea
        input={input}
        handleInputChange={handleInputChange}
        handleKeyDown={handleKeyDown}
        handleCustomSubmit={handleCustomSubmit}
        handleImageChange={handleImageChange}
        imagePreview={imagePreview}
        setImagePreview={setImagePreview}
        setSelectedImage={setSelectedImage}
        fileInputRef={fileInputRef}
        isLoading={isLoading}
        isMobile={isMobile}
      />
    </div>
  );
}