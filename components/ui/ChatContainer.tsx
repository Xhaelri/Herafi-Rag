"use client";

import { Message } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import ChatHeader from "@/components/ui/ChatHeader";
import MessageList from "@/components/ui/MessageList";
import InputArea from "@/components/ui/InputArea";
import EmptyState from "@/components/ui/EmptyState";
import { extractCraftsmanData, messageContainsCraftsmanData } from "@/lib/extract-craftsman-data";

const api = "/api/chat";

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

export default function ChatContainer() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [assistantMessages, setAssistantMessages] = useState<Message[]>([]);
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
    console.log("All messages:", allMessages);
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

  const DEFAULT_IMAGE_TEXT = "ايه المشكلة في الصورة هنا؟";

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(
      "Submitting form, selectedImage:",
      selectedImage,
      "input:",
      input
    );
    if (!input.trim() && !selectedImage) {
      console.log("No input or image provided, submission aborted");
      return;
    }

    // Clear the input field and image preview immediately after submission
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

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageContent,
      createdAt: new Date(),
    };
    setUserMessages((prev) => [...prev, newMessage]);

    // Add temporary assistant message for loading
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
      console.log("Response status:", response.status, response.statusText);
      const responseText = await response.text();
      console.log("Raw response:", responseText);
      if (!response.ok) {
        throw new Error(
          `Backend error: ${response.statusText}, Response: ${responseText}`
        );
      }
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }
      console.log("Backend response:", result);

      // Replace temporary message with actual response
      if (result && result.role === "assistant") {
        setAssistantMessages((prev) =>
          prev.filter((msg) => msg.id !== `temp-${newMessage.id}`).concat(result)
        );
      } else {
        console.warn("No assistant response in result:", result);
      }
    } catch (error) {
      console.error("Error sending message to backend:", error);
      alert(
        "حدث خطأ أثناء إرسال الرسالة: " + (error.message || "خطأ غير معروف")
      );
      // Remove temporary message on error
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
      className="flex flex-col h-screen font-inter"
      style={{
        backgroundColor: "#F5F5F5",
        backgroundImage:
          "linear-gradient(135deg, rgba(196, 57, 43, 0.1) 0%, rgba(244, 208, 63, 0.1) 100%)",
      }}
    >
      <ChatHeader />

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