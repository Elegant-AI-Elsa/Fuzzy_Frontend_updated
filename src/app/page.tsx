"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, Send, Rocket, Briefcase, Users, Mail, RotateCcw } from 'lucide-react';

// Define a type for a chat message
interface Message {
  sender: 'user' | 'bot';
  text: string;
  timestamp?: string;
  isError?: boolean;
}

// Define the pages for navigation
type Page = 'home' | 'about' | 'careers' | 'contact';

// The URL for the chatbot API
const API_URL = "http://127.0.0.1:5000/api/chat";

// Generate a unique session ID
const generateSessionId = (): string => {
  return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [commonQuestions, setCommonQuestions] = useState<string[]>([]);
  const [isUserScrolled, setIsUserScrolled] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Function to format the chatbot's response text with markdown
  const formatBotResponse = (text: string): string => {
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formattedText = formattedText.replace(/^- (.*?)(\n|$)/gm, '<li>$1</li>');
    return formattedText.replace("Response:", "").trim();
  };

  // Initialize session ID (using in-memory storage instead of localStorage)
  useEffect(() => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
  }, []);

  const initialQuestions = [
    "What services does Fuzionest offer?",
    "Tell me about the company's mission.",
    "How can I contact the support team?",
    "I'd like to book an appointment"
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!isUserScrolled) {
      scrollToBottom();
    }
  }, [messages, isUserScrolled]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        sender: 'bot',
        text: "Hello! I'm Fuzzy, your friendly AI assistant from Fuzionest. 👋 I'm here to help you learn about our services or book a consultation with our expert team. How can I assist you today?",
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (isOpen && commonQuestions.length === 0) {
      fetchCommonQuestions();
    }
  }, [isOpen, commonQuestions.length]);

  const fetchCommonQuestions = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/common-questions');
      const data = await response.json();
      setCommonQuestions(data.questions || []);
    } catch (error) {
      console.error('Failed to load common questions:', error);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setIsUserScrolled(false);
    setTimeout(scrollToBottom, 50);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId
        },
        body: JSON.stringify({ message: text.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get a readable stream from the response.');
      }

      const decoder = new TextDecoder('utf-8');
      let botMessageText = '';
      let isStreamComplete = false;

      // Create initial bot message
      const tempBotMessage: Message = {
        sender: 'bot',
        text: '',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, tempBotMessage]);

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

              // Update the bot message in real-time
              setMessages((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage && lastMessage.sender === 'bot') {
                  return [...prev.slice(0, -1), { ...lastMessage, text: botMessageText }];
                }
                return [...prev, { ...tempBotMessage, text: botMessageText }];
              });
            }

            if (data.is_final) {
              isStreamComplete = true;
            }

            if (data.session_id) {
              setSessionId(data.session_id);
            }
            
            if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {
            console.error('Failed to parse JSON chunk:', e);
          }
        }
      }

    } catch (error) {
      console.error("Error fetching bot response:", error);

      const errorMessage: Message = {
        sender: 'bot',
        text: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment, or feel free to contact our team directly.",
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        isError: true
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
  };

  const handleQuestionClick = (question: string) => {
    sendMessage(question);
  };
 
  const handleTimeSlotClick = (slot: string) => {
    sendMessage(slot);
  };
 
  const handleConfirmSwitch = (choice: 'yes' | 'no') => {
    if (choice === 'yes') {
      clearChat();
      sendMessage("I would like to cancel the appointment booking.");
    } else {
      sendMessage("I would like to continue with the booking.");
    }
  };

  const clearChat = () => {
    setMessages([]);
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    
    setTimeout(() => {
      setMessages([{
        sender: 'bot',
        text: "Hello! I'm Fuzzy, your friendly AI assistant from Fuzionest. 👋 I'm here to help you learn about our services or book a consultation with our expert team. How can I assist you today?",
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 100);
  };
 
  const renderMessageContent = (text: string) => {
    let messageToRender = text;
    let timeSlotsToRender: string[] = [];
    
    // Step 1: Handle BOOKING_COMPLETE and its JSON data - IMPROVED VERSION
    const bookingCompleteTag = "BOOKING_COMPLETE:";
    const bookingCompleteIndex = messageToRender.indexOf(bookingCompleteTag);

    if (bookingCompleteIndex !== -1) {
      // Extract only the message part before the booking data
      const preBookingText = messageToRender.substring(0, bookingCompleteIndex).trim();
      
      // Find any text after the JSON (like confirmation messages)
      const jsonStart = messageToRender.indexOf('{', bookingCompleteIndex);
      let postBookingText = "";
      
      if (jsonStart !== -1) {
        let braceCount = 0;
        let jsonEnd = -1;
        
        // Find the end of the JSON
        for (let i = jsonStart; i < messageToRender.length; i++) {
          if (messageToRender[i] === '{') {
            braceCount++;
          } else if (messageToRender[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
        
        // If JSON is found, get any text after it
        if (jsonEnd !== -1) {
          postBookingText = messageToRender.substring(jsonEnd).trim();
        }
      }
      
      // Combine pre-booking text with any post-booking text, excluding the JSON
      messageToRender = (preBookingText + " " + postBookingText).trim();
    }
    
    // Step 2: Handle TIME_SLOTS_DISPLAY
    const timeSlotsMatch = messageToRender.match(/TIME_SLOTS_DISPLAY:\[(.*?)\]/);
    if (timeSlotsMatch && timeSlotsMatch[1]) {
      try {
        timeSlotsToRender = JSON.parse(`[${timeSlotsMatch[1].replace(/'/g, '"')}]`);
        messageToRender = messageToRender.replace(timeSlotsMatch[0], "").trim();
      } catch (e) {
        console.error("Failed to parse time slots from AI response:", e);
      }
    }
    
    // Step 3: Handle CONFIRM_SWITCH_MODE
    if (messageToRender.includes("CONFIRM_SWITCH_MODE:")) {
      const message = messageToRender.replace("CONFIRM_SWITCH_MODE:", "").trim();
      return (
        <div>
          <p dangerouslySetInnerHTML={{ __html: formatBotResponse(message) }} />
          <div className="flex space-x-2 mt-2">
            <button
              onClick={() => handleConfirmSwitch('yes')}
              className="bg-red-500 text-white text-sm px-3 py-1 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={() => handleConfirmSwitch('no')}
              className="bg-green-500 text-white text-sm px-3 py-1 rounded-md"
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

    // Step 4: Render the final formatted text (now without JSON data)
    const formattedText = formatBotResponse(messageToRender);
    const lines = formattedText.split('<li>');
    const hasList = lines.length > 1;

    return (
      <>
        {hasList ? (
          <>
            <div dangerouslySetInnerHTML={{ __html: lines[0].replace(/\n/g, '<br />') }} />
            <ul className="list-disc list-inside space-y-1 mt-2" dangerouslySetInnerHTML={{ __html: lines.slice(1).join('<li>') }} />
          </>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: formattedText.replace(/\n/g, '<br />') }} />
        )}
        
        {timeSlotsToRender.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {timeSlotsToRender.map((slot, index) => (
              <button
                key={index}
                onClick={() => handleTimeSlotClick(slot)}
                className="px-4 py-2 text-sm bg-indigo-100 text-indigo-600 rounded-md border border-indigo-300 hover:bg-indigo-200 transition-colors"
              >
                {slot}
              </button>
            ))}
          </div>
        )}
      </>
    );
  };
 
  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isScrolledToBottom = scrollHeight - scrollTop <= clientHeight + 10;
      setIsUserScrolled(!isScrolledToBottom);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-300 hover:scale-110"
          aria-label="Open chat"
        >
          <Menu size={24} />
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
            !
          </span>
        </button>
      )}

      <div
        className={`fixed inset-x-0 bottom-0 z-40 w-full h-[calc(100vh-4rem)] max-w-sm sm:max-w-md md:max-w-md lg:max-w-lg bg-white rounded-t-lg shadow-xl overflow-hidden flex flex-col transition-all duration-300 ease-in-out md:inset-auto md:bottom-4 md:right-4 md:h-[600px] md:rounded-lg ${
          isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-full opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">F</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Fuzzy AI Assistant</h2>
              <p className="text-xs text-indigo-100">Online • Ready to help</p>
            </div>
          </div>
          <div className="flex space-x-1">
            <button
              onClick={clearChat}
              className="p-1 rounded-full hover:bg-indigo-700 transition-colors"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:bg-indigo-700 transition-colors"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div ref={messagesContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50" onScroll={handleScroll}>
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 max-w-[85%] rounded-lg shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white'
                  : msg.isError
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}>
                <div className="text-sm">
                  {renderMessageContent(msg.text)}
                </div>
                {msg.timestamp && (
                  <p className={`text-xs mt-1 ${
                    msg.sender === 'user' ? 'text-indigo-100' : 'text-gray-500'
                  }`}>
                    {msg.timestamp}
                  </p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm max-w-[85%]">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                  <span className="text-sm text-gray-500">Fuzzy is typing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length <= 1 && (
          <div className="p-4 bg-white border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2 font-medium">Quick questions:</p>
            <div className="space-y-2">
              {(commonQuestions.length > 0 ? commonQuestions.slice(0, 3) : initialQuestions.slice(0, 3)).map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleQuestionClick(question)}
                  className="w-full text-left text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 p-2 rounded-md border border-indigo-200 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about Fuzionest..."
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="p-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Powered by Fuzzy AI • Press Enter to send
          </p>
        </form>
      </div>
    </>
  );
};

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