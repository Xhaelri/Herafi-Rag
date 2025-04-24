// InputArea.tsx
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Loader2, Image as ImageIcon } from "lucide-react";

interface InputAreaProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleCustomSubmit: (e: React.FormEvent) => void;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  imagePreview: string | null;
  setImagePreview: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedImage: React.Dispatch<React.SetStateAction<File | null>>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  isLoading: boolean;
  isMobile: boolean;
}

export default function InputArea({
  input,
  handleInputChange,
  handleKeyDown,
  handleCustomSubmit,
  handleImageChange,
  imagePreview,
  setImagePreview,
  setSelectedImage,
  fileInputRef,
  isLoading,
  isMobile,
}: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <footer
      className="p-4 border-t"
      style={{
        backgroundColor: "#FFFFFF",
        borderTopColor: "#C0392B",
      }}
    >
      <form
        onSubmit={handleCustomSubmit}
        className="max-w-3xl mx-auto flex items-end gap-2 border p-2 rounded-xl shadow-sm"
        style={{
          borderColor: "#C0392B",
          backgroundColor: "#FFFFFF",
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
                  backgroundColor: "#C0392B",
                  color: "#FFFFFF",
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
                borderColor: "#C0392B",
                color: "#C0392B",
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
              dir="rtl"
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
                color: "#8D5524",
                placeholderColor: "#C0392B",
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 rounded-full cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed font-rubik"
              disabled={(!input.trim() && !imagePreview) || isLoading}
              style={{
                backgroundColor: "#C0392B",
                color: "#FFFFFF",
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
        style={{ color: "#8D5524" }}
      >
        الردود تعتمد على معلومات منصة حرفي. يرجى التحقق دائمًا من التفاصيل
        المهمة.
      </div>
    </footer>
  );
}