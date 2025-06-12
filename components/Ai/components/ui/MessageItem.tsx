import { Message } from "@ai-sdk/react";
import { User, Hammer, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
<<<<<<< HEAD:components/Ai/components/ui/MessageItem.tsx
import { CraftsmenGrid } from "./CraftsmenGrid";
import Image from "next/image";
import {Craftsman} from "@/typs"
=======
import { CraftsmenGrid } from "@/components/ui/CraftsmenGrid";

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
>>>>>>> 8964f1a99377932b293d7fab7da34f12d318c4c0:components/ui/MessageItem.tsx

interface MessageItemProps {
  message: Message;
  isLoading: boolean;
  isProcessing: boolean;
  craftsmen: Craftsman[];
}

interface CodeProps {
  node: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
  [key: string]: any;
}

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

const DEFAULT_IMAGE_TEXT = "ايه المشكلة في الصورة هنا؟";

export default function MessageItem({
  message,
  isLoading,
  isProcessing,
  craftsmen,
}: MessageItemProps) {
  return (
    <div
      className={`flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
      
    >
      <div
      
<<<<<<< HEAD:components/Ai/components/ui/MessageItem.tsx
        className={`rounded-2xl px-4 py-3 max-w-[85%]  shadow-sm relative ${
=======
        className={`rounded-2xl px-4 py-3 max-w-[85%] shadow-sm relative ${
>>>>>>> 8964f1a99377932b293d7fab7da34f12d318c4c0:components/ui/MessageItem.tsx
          message.role === "user" ? "bg-white border" : "bg-white border"
        }`}
        style={
          message.role === "user"
            ? {
                borderColor: "#C0392B",
              }
            : {
                borderColor: "#C0392B",
              }
        }
      >
        {message.role === "assistant" ? (
          <div className="flex gap-2 items-start" >
            <div
              className="h-8 w-8 p-1.5 shrink-0 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: "#FFEFA9",
                color: "#C0392B",
              }}
              
            >
              <Hammer className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1" dir="rtl">
              {isProcessing ||
              (isLoading && message.id.startsWith("temp-")) ? (
                <div
                  className="flex items-center gap-2 text-sm h-6"
                  style={{ color: "#8D5524" }}
                  dir="ltr"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span dir="rtl">
                    {isProcessing
                      ? "جاري تجهيز المعلومات..."
                      : "لحظة من فضلك..."}
                  </span>
                </div>
              ) : (
                <>
                  {craftsmen.length > 0 ? (
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
                            style={{ color: "#8D5524" }}
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
                      style={{ color: "#8D5524" }}
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
<<<<<<< HEAD:components/Ai/components/ui/MessageItem.tsx
                            <Image
=======
                            <img
>>>>>>> 8964f1a99377932b293d7fab7da34f12d318c4c0:components/ui/MessageItem.tsx
                              key={`${message.id}-part-${i}`}
                              src={part.image}
                              alt="Assistant provided image"
                              className="max-w-full rounded-lg mt-2"
<<<<<<< HEAD:components/Ai/components/ui/MessageItem.tsx
                              width={200}
                              height={200}
=======
>>>>>>> 8964f1a99377932b293d7fab7da34f12d318c4c0:components/ui/MessageItem.tsx
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
                  {craftsmen.length > 0 && (
                    <div className="mt-4">
                      <CraftsmenGrid
                        craftsmen={craftsmen}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-2 items-start">
            <div className="min-w-0 flex-1">
              <div
                className="prose prose-sm max-w-none font-rubik"
                style={{ color: "#8D5524" }}
                dir="rtl"
              >
                {Array.isArray(message.content) ? (
                  message.content.map((part: any, i: number) => {
                    if (part.type === "image") {
                      return (
<<<<<<< HEAD:components/Ai/components/ui/MessageItem.tsx
                        <Image
=======
                        <img
>>>>>>> 8964f1a99377932b293d7fab7da34f12d318c4c0:components/ui/MessageItem.tsx
                          key={`${message.id}-part-${i}`}
                          src={part.image}
                          alt="User uploaded image"
                          className="max-w-[200px] rounded-lg mt-2"
<<<<<<< HEAD:components/Ai/components/ui/MessageItem.tsx
                          width={200}
                          height={200}
=======
>>>>>>> 8964f1a99377932b293d7fab7da34f12d318c4c0:components/ui/MessageItem.tsx
                        />
                      );
                    }
                    if (part.type === "text") {
                      const isDefaultText =
                        part.text === DEFAULT_IMAGE_TEXT;
                      if (isDefaultText) {
                        return null;
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
            </div>
            <div
              className="h-8 w-8 p-1.5 shrink-0 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: "#FFEFA9",
                color: "#C0392B",
              }}
            >
              <User className="w-5 h-5" />
            </div>
          </div>
        )}

        <div
          className="text-xs mt-1 opacity-70 text-right font-rubik"
          style={{
            color: message.role === "user" ? "#C0392B" : "#C0392B",
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
  );
}