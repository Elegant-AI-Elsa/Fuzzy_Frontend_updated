"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, X, Send, Rocket, Briefcase, Users, Mail, RotateCcw, MessageCircle, Clock, CheckCircle, AlertCircle, Phone } from 'lucide-react';

// Enhanced type definitions
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
  userDetails?: {
    name: string;
    email: string;
    phone: string;
    timing: string;
  };
}

type Page = 'home' | 'about' | 'careers' | 'contact';
type ChatStatus = 'idle' | 'typing' | 'connecting' | 'error';

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

const API_URL = `${API_BASE_URL}/api/chat`;
const COMMON_QUESTIONS_URL = `${API_BASE_URL}/api/common-questions`;


// Utility functions
const generateSessionId = (): string => {
  return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

const generateMessageId = (): string => {
  return 'msg_' + Math.random().toString(36).substr(2, 9);
};

const formatTimestamp = (): string => {
  return new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
};

// Enhanced Chatbot Component
const Chatbot: React.FC = () => {
  // Core state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [chatStatus, setChatStatus] = useState<ChatStatus>('idle');
  const [session, setSession] = useState<ChatSession>({
    sessionId: '',
    isBookingConfirmed: false
  });

  // UI state
  const [commonQuestions, setCommonQuestions] = useState<string[]>([]);
  const [isUserScrolled, setIsUserScrolled] = useState<boolean>(false);
  const [showScrollButton, setShowScrollButton] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Enhanced text formatting with better markdown support
  const formatBotResponse = useCallback((text: string): string => {
    let formattedText = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
      .replace(/^- (.*?)(\n|$)/gm, '<li>$1</li>')
      .replace(/^\* (.*?)(\n|$)/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.*?)(\n|$)/gm, '<li class="numbered">$2</li>');
    
    return formattedText.replace("Response:", "").trim();
  }, []);

  // Initialize session
  useEffect(() => {
    const newSessionId = generateSessionId();
    setSession(prev => ({ ...prev, sessionId: newSessionId }));
  }, []);

  // Enhanced scroll management
  const scrollToBottom = useCallback((smooth: boolean = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? "smooth" : "auto",
        block: "end"
      });
    }
  }, []);

  // Handle scroll events with better UX
  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isScrolledToBottom = scrollHeight - scrollTop <= clientHeight + 10;
      const shouldShowScrollButton = scrollHeight > clientHeight && !isScrolledToBottom;
      
      setIsUserScrolled(!isScrolledToBottom);
      setShowScrollButton(shouldShowScrollButton);
    }
  }, []);

  // Auto-scroll management
  useEffect(() => {
    if (!isUserScrolled && messages.length > 0) {
      const timer = setTimeout(() => scrollToBottom(), 100);
      return () => clearTimeout(timer);
    }
  }, [messages, isUserScrolled, scrollToBottom]);

  // Focus management
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: Message = {
        id: generateMessageId(),
        sender: 'bot',
        text: "Hello! I'm **Fuzzy**, your friendly AI assistant from **Fuzionest**. 👋\nI'm here to help you:\n- Learn about our innovative services\n- Book consultations with our expert team\n\nHow can I assist you today?",
        timestamp: formatTimestamp()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length]);

  // Load common questions
  useEffect(() => {
    if (isOpen && commonQuestions.length === 0) {
      fetchCommonQuestions();
    }
  }, [isOpen, commonQuestions.length]);

  const fetchCommonQuestions = async () => {
    try {
      const response = await fetch(COMMON_QUESTIONS_URL);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setCommonQuestions(data.questions || []);
    } catch (error) {
      console.error('Failed to load common questions:', error);
      // Fallback questions
      setCommonQuestions([
        "What services does Fuzionest offer?",
        "Tell me about the company's mission.",
        "How can I contact the support team?",
        "I'd like to book an appointment"
      ]);
    }
  };

  // Enhanced message sending with better error handling
  const sendMessage = async (text: string, isRetry: boolean = false) => {
    if (!text.trim() || chatStatus === 'typing') return;

    if (session.isBookingConfirmed && /change|update|reschedule|modify/i.test(text)) {
      setSession(prev => ({ ...prev, isBookingConfirmed: false }));
    }

    const userMessage: Message = {
      id: generateMessageId(),
      sender: 'user',
      text: text.trim(),
      timestamp: formatTimestamp()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setChatStatus('typing');
    setIsUserScrolled(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': session.sessionId
        },
        body: JSON.stringify({ message: text.trim() }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get readable stream');
      }

      const decoder = new TextDecoder('utf-8');
      let botMessageText = '';
      let isStreamComplete = false;

      const tempBotMessage: Message = {
        id: generateMessageId(),
        sender: 'bot',
        text: '',
        timestamp: formatTimestamp()
      };
      setMessages(prev => [...prev, tempBotMessage]);

      while (!isStreamComplete) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const jsonStrings = chunk.split('\n').filter(s => s.trim() !== '');

        for (const jsonStr of jsonStrings) {
          try {
            const data = JSON.parse(jsonStr);
            
            if (data.response_chunk) {
              botMessageText += data.response_chunk;

              setMessages(prev => {
                const newMessages = [...prev];
                const lastIndex = newMessages.length - 1;
                if (newMessages[lastIndex]?.sender === 'bot') {
                  newMessages[lastIndex] = {
                    ...newMessages[lastIndex],
                    text: botMessageText
                  };
                }
                return newMessages;
              });
            }

            if (data.is_final) {
              isStreamComplete = true;
              
              if (botMessageText.includes("Your appointment request has been submitted successfully!") ||
                  botMessageText.includes("Perfect! Your appointment timing has been updated successfully!")) {
                setSession(prev => ({ ...prev, isBookingConfirmed: true }));
              }
            }

            if (data.session_id) {
              setSession(prev => ({ ...prev, sessionId: data.session_id }));
            }
            
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (parseError) {
            console.error('Failed to parse JSON chunk:', parseError);
          }
        }
      }

      setRetryCount(0);
      
    } catch (error: any) {
      console.error("Error fetching bot response:", error);

      if (error.name === 'AbortError') {
        return;
      }

      const errorMessage: Message = {
        id: generateMessageId(),
        sender: 'bot',
        text: getErrorMessage(error, retryCount),
        timestamp: formatTimestamp(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
      
      if (retryCount < 2 && !isRetry) {
        setRetryCount(prev => prev + 1);
      }
      
      setChatStatus('error');
    } finally {
      setChatStatus('idle');
      abortControllerRef.current = null;
    }
  };

  const getErrorMessage = (error: any, retryCount: number): string => {
    if (error.message?.includes('Failed to fetch')) {
      return `🔌 **Connection Issue**\n\nI'm having trouble connecting to our servers. Please check your internet connection and try again.\n\n${retryCount < 2 ? '🔄 You can also try sending your message again.' : '📞 If the issue persists, please contact our support team.'}`;
    }
    
    if (error.message?.includes('500')) {
      return `⚠️ **Server Error**\n\nOur servers are experiencing some issues. Please try again in a moment.\n\n📞 For urgent matters, contact us directly at: **+1 (555) 123-4567**`;
    }

    return `😔 **Oops! Something went wrong**\n\nI apologize for the technical difficulty. Please try again or contact our team directly.\n\n📧 **Email:** info@fuzionest.com\n📞 **Phone:** +1 (555) 123-4567`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatStatus === 'typing') return;
    sendMessage(input.trim());
  };

  const handleQuestionClick = (question: string) => {
    if (chatStatus !== 'typing') {
      sendMessage(question);
    }
  };
  
  const handleTimeSlotClick = (slot: string) => {
    if (chatStatus !== 'typing' && !session.isBookingConfirmed) {
      sendMessage(slot);
    }
  };
  
  const handleConfirmSwitch = (choice: 'yes' | 'no') => {
    if (choice === 'yes') {
      clearChat();
      setTimeout(() => sendMessage("I would like to cancel the appointment booking."), 500);
    } else {
      sendMessage("I would like to continue with the booking.");
    }
  };

  const clearChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setMessages([]);
    setSession({
      sessionId: generateSessionId(),
      isBookingConfirmed: false
    });
    setChatStatus('idle');
    setRetryCount(0);
    setIsUserScrolled(false);
    
    setTimeout(() => {
      const welcomeMessage: Message = {
        id: generateMessageId(),
        sender: 'bot',
        text: "Hello! I'm **Fuzzy**, your friendly AI assistant from **Fuzionest**. 👋\nI'm here to help you:\n- Learn about our innovative services\n- Book consultations with our expert team\n\nHow can I assist you today?",
        timestamp: formatTimestamp()
      };
      setMessages([welcomeMessage]);
    }, 200);
  };
  
  const renderMessageContent = (text: string) => {
    let messageToRender = text;
    let timeSlotsToRender: string[] = [];
    
    const bookingCompleteTag = "BOOKING_COMPLETE:";
    const updateCompleteTag = "UPDATE_COMPLETE:";
    
    [bookingCompleteTag, updateCompleteTag].forEach(tag => {
      const tagIndex = messageToRender.indexOf(tag);
      if (tagIndex !== -1) {
        const preTagText = messageToRender.substring(0, tagIndex).trim();
        const jsonStart = messageToRender.indexOf('{', tagIndex);
        let postTagText = "";
        
        if (jsonStart !== -1) {
          let braceCount = 0;
          let jsonEnd = -1;
          
          for (let i = jsonStart; i < messageToRender.length; i++) {
            if (messageToRender[i] === '{') braceCount++;
            else if (messageToRender[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
          
          if (jsonEnd !== -1) {
            postTagText = messageToRender.substring(jsonEnd).trim();
          }
        }
        
        messageToRender = (preTagText + " " + postTagText).trim();
      }
    });
    
    const timeSlotsMatch = messageToRender.match(/TIME_SLOTS_DISPLAY:\[(.*?)\]/);
    if (timeSlotsMatch && timeSlotsMatch[1]) {
      try {
        timeSlotsToRender = JSON.parse(`[${timeSlotsMatch[1].replace(/'/g, '"')}]`);
        messageToRender = messageToRender.replace(timeSlotsMatch[0], "").trim();
      } catch (e) {
        console.error("Failed to parse time slots:", e);
      }
    }
    
    if (messageToRender.includes("CONFIRM_SWITCH_MODE:")) {
      const message = messageToRender.replace("CONFIRM_SWITCH_MODE:", "").trim();
      return (
        <div>
          <div dangerouslySetInnerHTML={{ __html: formatBotResponse(message) }} />
          <div className="flex space-x-3 mt-4">
            <button
              onClick={() => handleConfirmSwitch('yes')}
              className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <X size={16} />
              <span>Cancel Booking</span>
            </button>
            <button
              onClick={() => handleConfirmSwitch('no')}
              className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <CheckCircle size={16} />
              <span>Continue</span>
            </button>
          </div>
        </div>
      );
    }

    const formattedText = formatBotResponse(messageToRender);
    const hasListItems = formattedText.includes('<li>');

    return (
      <>
        {hasListItems ? (
          <div>
            {formattedText.split('<li>').map((part, index) => {
              if (index === 0) {
                return <div key={index} dangerouslySetInnerHTML={{ __html: part.replace(/\n/g, '<br />') }} />;
              }
              const isNumbered = part.includes('class="numbered"');
              return (
                <ul key={index} className={`${isNumbered ? 'list-decimal' : 'list-disc'} list-inside space-y-1 mt-2`}>
                  <li dangerouslySetInnerHTML={{ __html: part.replace('class="numbered"', '').replace('</li>', '') }} />
                </ul>
              );
            })}
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: formattedText.replace(/\n/g, '<br />') }} />
        )}
        
        {timeSlotsToRender.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2 font-medium">
              <Clock size={14} className="inline mr-1" />
              Choose a preferred time slot:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {timeSlotsToRender.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => handleTimeSlotClick(slot)}
                  disabled={session.isBookingConfirmed || chatStatus === 'typing'}
                  className={`px-3 py-2 text-sm rounded-lg border transition-all duration-200 ${
                    session.isBookingConfirmed || chatStatus === 'typing'
                      ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed' 
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Or type your preferred time manually in the message box below.
            </p>
          </div>
        )}
      </>
    );
  };

  // Chat status indicator
  const renderChatStatus = () => {
    if (chatStatus === 'typing') {
      return (
        <div className="flex justify-start">
          <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-center space-x-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Quick suggestions for new users
  const renderQuickSuggestions = () => {
    if (messages.length > 1) return null;
    
    const suggestions = commonQuestions.length > 0 
      ? commonQuestions.slice(0, 3) 
      : [
          "What services does Fuzionest offer?",
          "How can I contact the support team?",
          "I'd like to book an appointment"
        ];

    return (
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-t border-gray-200">
        <p className="text-sm text-gray-700 mb-3 font-medium flex items-center">
          <MessageCircle size={16} className="mr-2 text-indigo-600" />
          Quick suggestions:
        </p>
        <div className="space-y-2">
          {suggestions.map((question, index) => {
            const isAppointmentQuestion = question.toLowerCase().includes("appointment");
            const isButtonDisabled = isAppointmentQuestion && session.isBookingConfirmed;

            return (
              <button
                key={index}
                onClick={() => handleQuestionClick(question)}
                disabled={isButtonDisabled || chatStatus === 'typing'}
                className={`w-full text-left text-sm p-3 rounded-lg border transition-all duration-200 ${
                  isButtonDisabled || chatStatus === 'typing'
                    ? 'text-gray-400 bg-gray-100 cursor-not-allowed border-gray-300'
                    : 'text-indigo-700 hover:text-indigo-800 hover:bg-white hover:shadow-sm border-indigo-200 bg-indigo-50'
                }`}
              >
                {question}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
          aria-label="Open chat"
        >
          <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
            💬
          </span>
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Chat with Fuzzy AI
          </div>
        </button>
      )}

      {/* Chat Window */}
      {/* CHANGED: Made width responsive for narrow phone screens */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 w-full h-[90vh] sm:max-w-sm md:max-w-md lg:max-w-lg mx-auto bg-white rounded-t-xl shadow-xl overflow-hidden flex flex-col transition-all duration-300 ease-in-out md:inset-auto md:bottom-6 md:right-6 md:h-[640px] md:rounded-xl md:mx-0 ${
          isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {/* Enhanced Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-lg font-bold">F</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Fuzzy AI Assistant</h2>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <p className="text-xs text-indigo-100">Online • Ready to help</p>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={clearChat}
              className="p-2 rounded-full hover:bg-white/20 transition-colors group"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <RotateCcw size={18} className="group-hover:rotate-180 transition-transform duration-300" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-gray-50 to-white scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
          onScroll={handleScroll}
        >
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 max-w-[85%] rounded-xl shadow-sm transition-all duration-200 ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : msg.isError
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-white text-gray-800 border border-gray-200 hover:shadow-md'
              }`}>
                <div className="text-sm leading-relaxed">
                  {renderMessageContent(msg.text)}
                </div>
                {msg.timestamp && (
                  <p className={`text-xs mt-2 ${
                    msg.sender === 'user' ? 'text-indigo-100' : 'text-gray-500'
                  }`}>
                    {msg.timestamp}
                  </p>
                )}
              </div>
            </div>
          ))}

          {renderChatStatus()}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-20 right-4 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors z-10"
            aria-label="Scroll to bottom"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        )}

        {/* Quick Suggestions */}
        {renderQuickSuggestions()}

        {/* Enhanced Input Form */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={chatStatus === 'typing' ? " " : "Ask me anything about Fuzionest..."}
              className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all duration-200"
              disabled={chatStatus === 'typing'}
              maxLength={500}
            />
            <button
              type="submit"
              className={`p-3 rounded-xl shadow-md transition-all duration-200 ${
                (!input.trim() || chatStatus === 'typing')
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:scale-105'
              }`}
              disabled={!input.trim() || chatStatus === 'typing'}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-500">
              Powered by Fuzzy AI • Press Enter to send
            </p>
            <p className="text-xs text-gray-400">
              {input.length}/500
            </p>
          </div>
        </form>
      </div>
    </>
  );
};

// Header Component
const Header: React.FC<{ currentPage: Page; onPageChange: (page: Page) => void }> = ({ currentPage, onPageChange }) => (
  <header className="bg-white shadow-lg p-4 sticky top-0 z-30">
    <div className="container mx-auto flex items-center justify-between">
      <div className="flex items-center">
        <Rocket size={32} className="text-indigo-600 mr-2" />
        <span className="text-2xl font-bold text-gray-900">Fuzionest</span>
      </div>
      <nav className="hidden md:block">
        <ul className="flex space-x-4">
          <li>
            <button
              onClick={() => onPageChange('home')}
              className={`text-lg font-medium hover:text-indigo-600 transition-colors ${
                currentPage === 'home' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600'
              }`}
            >
              Home
            </button>
          </li>
          <li>
            <button
              onClick={() => onPageChange('about')}
              className={`text-lg font-medium hover:text-indigo-600 transition-colors ${
                currentPage === 'about' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600'
              }`}
            >
              About
            </button>
          </li>
          <li>
            <button
              onClick={() => onPageChange('careers')}
              className={`text-lg font-medium hover:text-indigo-600 transition-colors ${
                currentPage === 'careers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600'
              }`}
            >
              Careers
            </button>
          </li>
          <li>
            <button
              onClick={() => onPageChange('contact')}
              className={`text-lg font-medium hover:text-indigo-600 transition-colors ${
                currentPage === 'contact' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600'
              }`}
            >
              Contact
            </button>
          </li>
        </ul>
      </nav>
      <button className="md:hidden" aria-label="Toggle navigation menu">
        <Menu size={24} />
      </button>
    </div>
  </header>
);

// Page Components
const HomePage: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full px-4 text-center">
    <Rocket size={80} className="text-indigo-600 mb-6" />
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Welcome to Fuzionest</h1>
    <p className="text-xl text-gray-600 mb-8">Your partner in innovative solutions and digital transformation.</p>
    <div className="flex flex-col sm:flex-row gap-4">
      <a href="#" className="px-6 py-3 bg-indigo-600 text-white text-lg font-semibold rounded-full shadow-lg hover:bg-indigo-700 transition-colors">
        Learn more about our services
      </a>
      <a href="#" className="px-6 py-3 bg-white text-indigo-600 text-lg font-semibold rounded-full shadow-lg border-2 border-indigo-600 hover:bg-indigo-50 transition-colors">
        Book a consultation
      </a>
    </div>
    <div className="mt-8 text-sm text-gray-500">
      <p>💬 Need help? Click the chat button to talk with Fuzzy, our AI assistant!</p>
    </div>
  </div>
);

const AboutPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full px-4 text-center">
    <Users size={80} className="text-indigo-600 mb-6" />
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">About Fuzionest</h1>
    <p className="text-xl text-gray-600 max-w-2xl mb-8">
      Fuzionest is a leading innovator in digital solutions, dedicated to helping businesses thrive in the modern technological landscape. We believe in creating powerful, user-centric experiences that drive growth and foster innovation.
    </p>
    <div className="grid md:grid-cols-3 gap-6 w-full max-w-4xl">
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-3">Innovation</h3>
        <p className="text-gray-600">Cutting-edge solutions that push boundaries and drive progress.</p>
      </div>
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-3">Expertise</h3>
        <p className="text-gray-600">Deep knowledge and experience across multiple technology domains.</p>
      </div>
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-xl font-bold mb-3">Partnership</h3>
        <p className="text-gray-600">Collaborative approach focused on your success and growth.</p>
      </div>
    </div>
  </div>
);

const CareersPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full px-4 text-center">
    <Briefcase size={80} className="text-indigo-600 mb-6" />
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Join Our Team</h1>
    <p className="text-xl text-gray-600 max-w-2xl mb-8">
      We are always looking for passionate and talented individuals to join the Fuzionest family. Explore our open positions and find your next career opportunity with us!
    </p>
    <div className="bg-gray-50 p-6 rounded-lg shadow-md w-full max-w-2xl">
      <h3 className="text-2xl font-bold mb-4">Current Openings</h3>
      <ul className="space-y-4 text-left">
        <li className="bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500">
          <h4 className="text-lg font-semibold">Senior Software Engineer</h4>
          <p className="text-gray-500">San Francisco, CA • Full-time</p>
          <p className="text-sm text-gray-600 mt-1">Lead development of scalable web applications</p>
        </li>
        <li className="bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500">
          <h4 className="text-lg font-semibold">Product Manager</h4>
          <p className="text-gray-500">New York, NY • Full-time</p>
          <p className="text-sm text-gray-600 mt-1">Drive product strategy and roadmap execution</p>
        </li>
        <li className="bg-white p-4 rounded-lg shadow border-l-4 border-indigo-500">
          <h4 className="text-lg font-semibold">UX/UI Designer</h4>
          <p className="text-gray-500">Remote • Full-time</p>
          <p className="text-sm text-gray-600 mt-1">Create beautiful and intuitive user experiences</p>
        </li>
      </ul>
      <div className="mt-6">
        <p className="text-sm text-gray-600 mb-2">Interested in joining us?</p>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          Apply Now
        </button>
      </div>
    </div>
  </div>
);

const ContactPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full px-4 text-center">
    <Mail size={80} className="text-indigo-600 mb-6" />
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Get in Touch</h1>
    <p className="text-xl text-gray-600 max-w-2xl mb-8">
      Have a question or want to learn more? Feel free to reach out to us!
    </p>
    <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
      <div className="bg-gray-50 p-6 rounded-lg shadow-md text-left space-y-4">
        <h3 className="text-xl font-bold text-center mb-4">Contact Information</h3>
        <div>
          <h4 className="text-lg font-semibold text-indigo-600">Email</h4>
          <a href="mailto:info@fuzionest.com" className="text-gray-700 hover:text-indigo-600 transition-colors">info@fuzionest.com</a>
        </div>
        <div>
          <h4 className="text-lg font-semibold text-indigo-600">Phone</h4>
          <p className="text-gray-700">+1 (555) 123-4567</p>
        </div>
        <div>
          <h4 className="text-lg font-semibold text-indigo-600">Address</h4>
          <p className="text-gray-700">123 Tech Avenue, Suite 400<br/>Innovation City, CA 90210</p>
        </div>
        <div>
          <h4 className="text-lg font-semibold text-indigo-600">Business Hours</h4>
          <p className="text-gray-700">Monday - Friday: 9:00 AM - 6:00 PM PST</p>
        </div>
      </div>
      <div className="bg-gray-50 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-bold mb-4">Quick Contact</h3>
        <form className="space-y-4">
          <input
            type="text"
            placeholder="Your Name"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <input
            type="email"
            placeholder="Your Email"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <textarea
            placeholder="Your Message"
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          ></textarea>
          <button
            type="submit"
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Send Message
          </button>
        </form>
      </div>
    </div>
    <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
      <p className="text-sm text-indigo-800">
        <strong>💡 Pro Tip:</strong> For instant help, try our AI assistant Fuzzy by clicking the chat button!
      </p>
    </div>
  </div>
);

// Main App Component
const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  
  const renderPage = () => {
    switch (currentPage) {
      case 'about': return <AboutPage />;
      case 'careers': return <CareersPage />;
      case 'contact': return <ContactPage />;
      case 'home': default: return <HomePage />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 font-sans">
      <Header currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="bg-white p-6 rounded-lg shadow-lg min-h-[70vh] flex flex-col justify-center">
          {renderPage()}
        </div>
      </main>
      <Chatbot />
    </div>
  );
};

export default App;