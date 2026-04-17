import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatBubbleProps {
  messages: ChatMessage[];
  currentUserId: string;
  userName: string;
  onSendMessage: (text: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ messages, currentUserId, userName, onSendMessage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewTimeout = useRef<NodeJS.Timeout | null>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleHashChange = () => {
      setIsOpen(window.location.hash === '#chat');
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // init
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.userId !== currentUserId) {
      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
        setPreview(lastMsg.text);
        if (previewTimeout.current) clearTimeout(previewTimeout.current);
        previewTimeout.current = setTimeout(() => {
          setPreview(null);
        }, 3000);
      }
    }
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setPreview(null);
      scrollToBottom();
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const toggleChat = () => {
    if (!isOpen) {
      window.location.hash = 'chat';
    } else {
      window.history.back();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" ref={constraintsRef}>
      {/* Draggable Bubble */}
      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragMomentum={false}
        className="absolute top-24 right-4 pointer-events-auto flex items-center gap-2 z-10"
      >
        {/* Preview */}
        <AnimatePresence>
          {preview && !isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.8 }}
              className="bg-white text-black px-4 py-2 rounded-2xl rounded-tr-none shadow-lg max-w-[200px] truncate"
            >
              {preview}
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          className="relative bg-emerald-500/80 backdrop-blur-md text-black w-14 h-14 rounded-full flex items-center justify-center shadow-xl cursor-pointer hover:scale-105 transition-transform"
          onClick={toggleChat}
        >
          <MessageCircle size={28} />
          {unreadCount > 0 && !isOpen && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-[#121212]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-24 right-4 w-80 sm:w-96 h-[500px] max-h-[70vh] bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden z-20"
          >
            {/* Header */}
            <div className="bg-black/40 backdrop-blur-md p-4 flex items-center justify-between border-b border-white/5">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <MessageCircle size={18} className="text-emerald-500" />
                Room Chat
              </h3>
              <button onClick={() => window.history.back()} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 hide-scrollbar">
              {messages.map((msg) => {
                const isMe = msg.userId === currentUserId;
                const timeString = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div 
                      className={`px-3 py-2 rounded-2xl max-w-[80%] break-words flex flex-col ${
                        isMe 
                          ? 'bg-emerald-500/90 text-black rounded-tr-sm' 
                          : 'bg-[#2a2a2a]/90 text-white rounded-tl-sm'
                      }`}
                    >
                      {!isMe && <span className="text-[10px] font-bold opacity-70 mb-0.5">{msg.userName}</span>}
                      <span className="text-sm">{msg.text}</span>
                      <span className={`text-[9px] self-end mt-1 ${isMe ? 'text-black/60' : 'text-white/50'}`}>
                        {timeString}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-black/40 backdrop-blur-md border-t border-white/5 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-white/10 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-white/50"
              />
              <button 
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 bg-emerald-500 text-black rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
              >
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
