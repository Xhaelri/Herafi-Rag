// ChatHeader.tsx
import Image from "next/image";
<<<<<<< HEAD:components/Ai/components/ui/ChatHeader.tsx
import icon from "@/assets/char-blob.png"
=======

>>>>>>> 8964f1a99377932b293d7fab7da34f12d318c4c0:components/ui/ChatHeader.tsx
export default function ChatHeader() {
  return (
    <header
      className="p-4 border-b shadow-sm"
      style={{
        backgroundColor: "#C0392B",
        color: "#FFFFFF",
        borderBottomColor: "#8D5524",
      }}
    >
      <div className="max-w-3xl mx-auto flex items-center justify-center">
        <h1 className="text-xl font-semibold font-aboreto">
          <div className="flex items-center justify-center gap-3.5">
            <Image
<<<<<<< HEAD:components/Ai/components/ui/ChatHeader.tsx
              src={icon}
=======
              src={"/logo.png"}
>>>>>>> 8964f1a99377932b293d7fab7da34f12d318c4c0:components/ui/ChatHeader.tsx
              alt="شعار حرفي"
              width={50}
              height={50}
            />
            <p className="font-rubik text-2xl" style={{ color: "#fff" }}>
              مساعد حرفي
            </p>
          </div>
        </h1>
      </div>
    </header>
  );
}