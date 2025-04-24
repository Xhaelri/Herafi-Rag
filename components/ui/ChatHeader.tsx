// ChatHeader.tsx
import Image from "next/image";

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
              src={"/logo.png"}
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