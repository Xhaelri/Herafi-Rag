"use client";
import React, { useState } from "react";
import HerafiLogo from "@/assets/herafi logo.svg"
import ChatContainer from "./components/ui/ChatContainer";
import { motion, AnimatePresence } from "framer-motion";

const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <motion.button
        onClick={toggleChat}
        className="bg-[#a80338] hover:bg-primary-color p-3 rounded-full shadow-lg"
        aria-label="Toggle AI Assistant"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={{ scale: isOpen ? 0.9 : 1, opacity: isOpen ? 0.8 : 1 }}
        transition={{ duration: 0.2 }}
      >
      <HerafiLogo className="w-12 h-12"/>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute bottom-22 right-10 w-[500px] h-[550px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[550px]"
            initial={{ opacity: 0, scale: 0.80, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* Chat Header */}
            <div className="bg-primary-color text-white p-3 rounded-t-lg flex justify-between items-center">
              <h2 className="text-lg font-semibold">مساعد حرفي</h2>
              <button
                onClick={toggleChat}
                className="text-white hover:text-gray-200"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
            <ChatContainer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIAssistant;