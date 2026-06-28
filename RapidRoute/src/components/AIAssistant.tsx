/**
 * AI Smart Assistant — Claude-powered chat widget for RapidRoute.
 *
 * Floating widget in the bottom-right corner (above the Concurrency Demo button).
 * Supports natural language seat search, route suggestions, booking help,
 * and general travel queries with real-time context injection.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Brain, X, Send, Trash2, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Format timestamp for messages
const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Simple markdown renderer for AI responses
const renderMarkdown = (text: string) => {
  // Bold **text**
  const withBold = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Bullet points
  const withBullets = withBold.replace(/^[-*]\s+(.*?)$/gm, '<li>$1</li>');
  // Paragraphs
  const withParagraphs = withBullets
    .split('\n\n')
    .map((p) => {
      if (p.startsWith('<li>')) {
        return `<ul>${p.replace(/\n/g, '')}</ul>`;
      }
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  return withParagraphs;
};

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hi! I'm your **RapidRoute AI Assistant**. I can help you:\n\n- **Find routes** — \"Show me buses from Mumbai to Pune tomorrow\"\n- **Choose seats** — \"I want a window seat in the lower deck\"\n- **Explain features** — \"How do seat holds work?\"\n- **Answer questions** — \"What happens if payment fails?\"\n\nHow can I help you today? 🚌",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages
              .filter((m) => m.id !== 'welcome')
              .slice(-10)
              .map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
          ],
          context: {
            currentPage: window.location.pathname,
            pageTitle: document.title,
            userAgent: navigator.userAgent.slice(0, 100),
          },
        }),
      });

      const data = await response.json();

      let replyContent = '';
      if (data.content) {
        if (Array.isArray(data.content)) {
          replyContent = data.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
        } else if (typeof data.content === 'string') {
          replyContent = data.content;
        }
      }

      if (!replyContent) {
        replyContent =
          "I'm sorry, I couldn't process that request. Please try asking in a different way.";
      }

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: `ai-error-${Date.now()}`,
        role: 'assistant',
        content:
          "I'm having trouble connecting. Please make sure the server is running and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          "Hi! I'm your **RapidRoute AI Assistant**. I can help you:\n\n- **Find routes** — \"Show me buses from Mumbai to Pune tomorrow\"\n- **Choose seats** — \"I want a window seat in the lower deck\"\n- **Explain features** — \"How do seat holds work?\"\n- **Answer questions** — \"What happens if payment fails?\"\n\nHow can I help you today? 🚌",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/30 flex items-center justify-center transition-all duration-200 hover:scale-110 group"
        title="RapidRoute AI Assistant"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Brain className="w-6 h-6 text-white animate-pulse" />
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-40 right-6 z-40 w-[380px] h-[480px] bg-navy-900 rounded-2xl border border-white/10 shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-[#00C2A8] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white" />
              <span className="font-semibold text-white text-sm">
                RapidRoute AI Assistant
              </span>
            </div>
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4 text-white/80" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-navy">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-[#00C2A8] text-white rounded-br-md'
                      : 'bg-[#162236] text-white/90 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div
                      className="text-xs leading-relaxed ai-response"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  ) : (
                    <p className="text-xs leading-relaxed">{msg.content}</p>
                  )}
                  <p
                    className={`text-[10px] mt-1 ${
                      msg.role === 'user' ? 'text-white/60' : 'text-text-secondary'
                    }`}
                  >
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#162236] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10 bg-navy-900 flex-shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                className="flex-1 bg-navy border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-text-secondary focus:outline-none focus:border-teal-400/50 transition-colors"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles for AI response rendering */}
      <style>{`
        .ai-response p { margin-bottom: 4px; }
        .ai-response ul { margin: 4px 0; padding-left: 16px; list-style: disc; }
        .ai-response li { margin-bottom: 2px; }
        .ai-response strong { color: #00C2A8; font-weight: 600; }
      `}</style>
    </>
  );
}
