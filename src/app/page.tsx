"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, X, Send, Rocket, Briefcase, Users, Mail, RotateCcw, MessageCircle, Clock, CheckCircle } from 'lucide-react';

// Type definitions
interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp?: string;
  isError?: boolean;
  id: string;
}

interface ChatSession {
  sessionId: string;
  isBookingConfirmed: boolean;
}

type Page = 'home' | 'about' | 'careers' | 'contact';
type ChatStatus = 'idle' | 'typing' | 'error';

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";
const API_URL = `${API_BASE_URL}/api/chat`;
const COMMON_QUESTIONS_URL = `${API_BASE_URL}/api/common-questions`;

// Utility functions
const generateSessionId = (): string => `session_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
const generateMessageId = (): string => `msg_${Math.random().toString(36).substr(2, 9)}`;
const formatTimestamp = (): string => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

// --- CHATBOT COMPONENT ---
const Chatbot: React.FC = () => {
  // State
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [chatStatus, setChatStatus] = useState<ChatStatus>('idle');
  const [session, setSession] = useState<ChatSession>({ sessionId: '', isBookingConfirmed: false });
  const [commonQuestions, setCommonQuestions] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [bookingAttempted, setBookingAttempted] = useState<boolean>(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Format bot response for HTML
  const formatBotResponse = useCallback((text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
      .replace(/^- (.*?)(\n|$)/gm, '<li>$1</li>')
      .replace(/^\* (.*?)(\n|$)/gm, '<li>$1</li>')
      .replace("Response:", "").trim();
  }, []);

  // Initialize session
  useEffect(() => {
    setSession(prev => ({ ...prev, sessionId: generateSessionId() }));
  }, []);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Welcome message and common questions
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: generateMessageId(),
        sender: 'bot',
        text: "Hello! I'm **Fuzzy**, your friendly AI assistant from **Fuzionest**. 👋\nI'm here to help you:\n- Learn about our innovative services\n- Book consultations with our expert team\n\nHow can I assist you today?",
        timestamp: formatTimestamp()
      }]);
      fetchCommonQuestions();
    }
  }, [isOpen, messages.length]);

  const fetchCommonQuestions = async () => {
    try {
      const response = await fetch(COMMON_QUESTIONS_URL);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setCommonQuestions(data.questions || []);
    } catch (error) {
      console.error('Failed to load common questions:', error);
      setCommonQuestions([
        "What services does Fuzionest offer?",
        "Tell me about the company's mission.",
        "How can I contact the support team?",
        "I'd like to book an appointment"
      ]);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || chatStatus === 'typing') return;

    setMessages(prev => [...prev, {
      id: generateMessageId(),
      sender: 'user',
      text: text.trim(),
      timestamp: formatTimestamp()
    }]);
    setInput('');
    setChatStatus('typing');
    
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-ID': session.sessionId },
        body: JSON.stringify({ message: text.trim() }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error('No readable stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let botMessageText = '';
      
      const tempBotMessageId = generateMessageId();
      setMessages(prev => [...prev, { id: tempBotMessageId, sender: 'bot', text: '', timestamp: formatTimestamp() }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const jsonStrings = chunk.split('\n').filter(s => s.trim());

        for (const jsonStr of jsonStrings) {
          try {
            const data = JSON.parse(jsonStr);
            if (data.response_chunk) {
              botMessageText = data.response_chunk;
              setMessages(prev => prev.map(m => m.id === tempBotMessageId ? { ...m, text: botMessageText } : m));
            }
            if (data.is_final) {
              if (botMessageText.includes("appointment request has been submitted")) {
                setSession(prev => ({ ...prev, isBookingConfirmed: true }));
              }
            }
          } catch (e) {
            console.error('Failed to parse JSON chunk:', e);
          }
        }
      }
      setRetryCount(0);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error("Error fetching bot response:", error);
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        sender: 'bot',
        text: "🔌 **Connection Issue**\nI'm having trouble connecting. Please check your internet and try again.",
        timestamp: formatTimestamp(),
        isError: true
      }]);
      setChatStatus('error');
    } finally {
      setChatStatus('idle');
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input.trim());
  };

  const handleTimeSlotClick = (slot: string) => {
    if (chatStatus !== 'typing' && !session.isBookingConfirmed) {
      setBookingAttempted(true);
      sendMessage(slot);
    }
  };

  const clearChat = () => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setBookingAttempted(false);
    setSession({ sessionId: generateSessionId(), isBookingConfirmed: false });
    setChatStatus('idle');
    setRetryCount(0);
    setTimeout(() => {
      setMessages([{
        id: generateMessageId(),
        sender: 'bot',
        text: "Hello! I'm **Fuzzy**, your friendly AI assistant from **Fuzionest**. 👋\nI'm here to help you:\n- Learn about our innovative services\n- Book consultations with our expert team\n\nHow can I assist you today?",
        timestamp: formatTimestamp()
      }]);
    }, 200);
  };
  
  const renderMessageContent = (text: string) => {
    let messageToRender = text;
    let timeSlotsToRender: string[] = [];
    
    const timeSlotsMatch = messageToRender.match(/TIME_SLOTS_DISPLAY:\[(.*?)\]/);
    if (timeSlotsMatch?.[1]) {
      try {
        timeSlotsToRender = JSON.parse(`[${timeSlotsMatch[1].replace(/'/g, '"')}]`);
        messageToRender = messageToRender.replace(timeSlotsMatch[0], "").trim();
      } catch (e) { console.error("Failed to parse time slots:", e); }
    }
    
    const formattedText = formatBotResponse(messageToRender);

    return (
      <>
        <div dangerouslySetInnerHTML={{ __html: formattedText.replace(/\n/g, '<br />') }} />
        {timeSlotsToRender.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2 font-medium">
              <Clock size={14} className="inline mr-1" /> Choose a preferred time slot:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {timeSlotsToRender.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => handleTimeSlotClick(slot)}
                  disabled={bookingAttempted || session.isBookingConfirmed || chatStatus === 'typing'}
                  className="px-3 py-2 text-sm rounded-lg border transition-all duration-200 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                >
                  {slot}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Or type your preferred time manually.</p>
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
          aria-label="Open chat"
        >
          <MessageCircle size={24} />
        </button>
      )}
      <div className={`fixed inset-x-0 bottom-0 z-40 w-full h-[90vh] sm:max-w-sm md:max-w-md bg-white rounded-t-xl shadow-xl flex flex-col transition-all duration-300 ease-in-out md:inset-auto md:bottom-6 md:right-6 md:h-[640px] md:rounded-xl ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"><span className="text-lg font-bold">F</span></div>
            <div>
              <h2 className="text-lg font-semibold">Fuzzy AI Assistant</h2>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <p className="text-xs text-indigo-100">Online • Ready to help</p>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button onClick={clearChat} className="p-2 rounded-full hover:bg-white/20" title="Clear chat"><RotateCcw size={18} /></button>
            <button onClick={() => setIsOpen(false)} className="p-2 rounded-full hover:bg-white/20" aria-label="Close chat"><X size={18} /></button>
          </div>
        </div>
        <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 max-w-[85%] rounded-xl shadow-sm ${msg.sender === 'user' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : msg.isError ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-white text-gray-800 border'}`}>
                <div className="text-sm leading-relaxed">{renderMessageContent(msg.text)}</div>
                {msg.timestamp && <p className={`text-xs mt-2 ${msg.sender === 'user' ? 'text-indigo-100' : 'text-gray-500'}`}>{msg.timestamp}</p>}
              </div>
            </div>
          ))}
          {chatStatus === 'typing' && (
            <div className="flex justify-start"><div className="p-3 bg-white border rounded-lg shadow-sm"><div className="flex items-center space-x-1.5">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />)}</div></div></div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {messages.length <= 1 && commonQuestions.length > 0 && (
          <div className="p-4 bg-gray-100 border-t"><p className="text-sm text-gray-700 mb-3 font-medium">Quick suggestions:</p><div className="space-y-2">{commonQuestions.map((q, i) => <button key={i} onClick={() => sendMessage(q)} className="w-full text-left text-sm p-3 rounded-lg border bg-white hover:bg-gray-50">{q}</button>)}</div></div>
        )}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t">
          <div className="flex items-center space-x-3">
            <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask me anything..." className="flex-1 p-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" disabled={chatStatus === 'typing'} />
            <button type="submit" className={`p-3 rounded-xl shadow-md transition-transform hover:scale-105 ${!input.trim() || chatStatus === 'typing' ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'}`} disabled={!input.trim() || chatStatus === 'typing'}><Send size={18} /></button>
          </div>
        </form>
      </div>
    </>
  );
};

// --- PAGE & HEADER COMPONENTS ---
const Header: React.FC<{ currentPage: Page; onPageChange: (page: Page) => void }> = ({ currentPage, onPageChange }) => (
  <header className="bg-white shadow p-4 sticky top-0 z-30">
    <div className="container mx-auto flex items-center justify-between">
      <div className="flex items-center"><Rocket size={32} className="text-indigo-600 mr-2" /><span className="text-2xl font-bold">Fuzionest</span></div>
      <nav className="hidden md:block"><ul className="flex space-x-4">{['home', 'about', 'careers', 'contact'].map(page => <li key={page}><button onClick={() => onPageChange(page as Page)} className={`text-lg font-medium hover:text-indigo-600 ${currentPage === page ? 'text-indigo-600' : 'text-gray-600'}`}>{page.charAt(0).toUpperCase() + page.slice(1)}</button></li>)}</ul></nav>
      <button className="md:hidden"><Menu size={24} /></button>
    </div>
  </header>
);

const HomePage: React.FC = () => (
  <div className="text-center"><Rocket size={80} className="text-indigo-600 mx-auto mb-6" /><h1 className="text-4xl font-extrabold mb-4">Welcome to Fuzionest</h1><p className="text-xl text-gray-600">Your partner in innovative solutions.</p></div>
);
const AboutPage: React.FC = () => (
  <div className="text-center"><Users size={80} className="text-indigo-600 mx-auto mb-6" /><h1 className="text-4xl font-extrabold mb-4">About Fuzionest</h1><p className="text-xl text-gray-600">We are a team dedicated to excellence.</p></div>
);
const CareersPage: React.FC = () => (
  <div className="text-center"><Briefcase size={80} className="text-indigo-600 mx-auto mb-6" /><h1 className="text-4xl font-extrabold mb-4">Join Our Team</h1><p className="text-xl text-gray-600">Explore exciting career opportunities with us.</p></div>
);
const ContactPage: React.FC = () => (
  <div className="text-center"><Mail size={80} className="text-indigo-600 mx-auto mb-6" /><h1 className="text-4xl font-extrabold mb-4">Get in Touch</h1><p className="text-xl text-gray-600">We'd love to hear from you!</p></div>
);

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  
  const renderPage = () => {
    switch (currentPage) {
      case 'about': return <AboutPage />;
      case 'careers': return <CareersPage />;
      case 'contact': return <ContactPage />;
      default: return <HomePage />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Header currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 container mx-auto p-4"><div className="bg-white p-6 rounded-lg shadow-lg min-h-[70vh] flex items-center justify-center">{renderPage()}</div></main>
      <Chatbot />
    </div>
  );
};

export default App;