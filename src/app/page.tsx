"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, Send, Rocket, Briefcase, Users, Mail } from 'lucide-react';

// Define a type for a chat message
interface Message {
  sender: 'user' | 'bot';
  text: string;
}

// Define the pages for navigation
type Page = 'home' | 'about' | 'careers' | 'contact';

// The URL for the chatbot API
const API_URL = "http://127.0.0.1:5000/api/chat";

// Function to format the chatbot's response text
const formatBotResponse = (text: string): string => {
  let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return formattedText.replace("Response:", "").trim();
};

// Chatbot component that is fixed at the bottom right
const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const initialQuestions = [
    "What services does Fuzionest offer?",
    "Tell me about the company's mission.",
    "How can I contact the support team?",
  ];

  // Function to scroll the chat window to the bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Effect to scroll to the bottom whenever a new message is added
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Effect to focus the input field when the chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Function to send a message to the bot API
  const sendMessage = async (text: string) => {
    setMessages((prev) => [...prev, { sender: 'user', text }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();
      const botResponse = formatBotResponse(data.response);

      setMessages((prev) => [...prev, { sender: 'bot', text: botResponse }]);
    } catch (error) {
      console.error("Error fetching bot response:", error);
      setMessages((prev) => [...prev, {
        sender: 'bot',
        text: "Sorry, I'm having trouble connecting right now. Please try again later.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for sending a message from the input form
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
  };

  // Handler for clicking on an initial question button
  const handleQuestionClick = (question: string) => {
    sendMessage(question);
  };

  // Function to render content, including lists
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    const isList = lines.some(line => line.trim().startsWith('*') || line.trim().startsWith('-'));

    if (isList) {
      return (
        <ul className="list-disc list-inside space-y-1">
          {lines.map((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('*') || trimmedLine.startsWith('-')) {
              return <li key={index} dangerouslySetInnerHTML={{ __html: trimmedLine.substring(1).trim() }} />;
            }
            return null;
          })}
        </ul>
      );
    }

    return <p dangerouslySetInnerHTML={{ __html: text }} />;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
        aria-label="Toggle chat"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <div
        className={`fixed bottom-20 right-4 z-40 w-full max-w-sm h-[80vh] max-h-[600px] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between p-4 bg-indigo-600 text-white shadow-md">
          <h2 className="text-xl font-semibold">Fuzzy AI Assistant</h2>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-indigo-700" aria-label="Close chat">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 italic mt-10">
              <p className="mb-4">Hello! I'm Fuzzy, your AI assistant for Fuzionest. How can I help you today?</p>
              <div className="flex flex-col space-y-2">
                {initialQuestions.map((q, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuestionClick(q)}
                    className="p-2 bg-gray-200 text-gray-800 rounded-lg text-sm hover:bg-gray-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 max-w-[80%] rounded-lg shadow-md ${
                msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'
              }`}>
                {renderContent(msg.text)}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="p-3 bg-gray-100 text-gray-800 rounded-lg shadow-md max-w-[80%]">
                <span className="animate-pulse">Typing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="p-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

// New Header component for navigation
const Header: React.FC<{ currentPage: Page; onPageChange: (page: Page) => void }> = ({ currentPage, onPageChange }) => (
  <header className="bg-white shadow-lg p-4 sticky top-0 z-30">
    <div className="container mx-auto flex items-center justify-between">
      <div className="flex items-center">
        <Rocket size={32} className="text-indigo-600 mr-2" />
        <span className="text-2xl font-bold text-gray-900">Fuzionest</span>
      </div>
      <nav>
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
    </div>
  </header>
);

// Home page component
const HomePage: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full px-4 text-center">
    <Rocket size={80} className="text-indigo-600 mb-6" />
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Welcome to Fuzionest</h1>
    <p className="text-xl text-gray-600 mb-8">Your partner in innovative solutions and digital transformation.</p>
    <a href="#" className="px-6 py-3 bg-indigo-600 text-white text-lg font-semibold rounded-full shadow-lg hover:bg-indigo-700 transition-colors">
      Learn more about our services
    </a>
  </div>
);

// New About page component
const AboutPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full px-4 text-center">
    <Users size={80} className="text-indigo-600 mb-6" />
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">About Fuzionest</h1>
    <p className="text-xl text-gray-600 max-w-2xl mb-8">
      Fuzionest is a leading innovator in digital solutions, dedicated to helping businesses thrive in the modern technological landscape. We believe in creating powerful, user-centric experiences that drive growth and foster innovation.
    </p>
  </div>
);

// New Careers page component
const CareersPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full px-4 text-center">
    <Briefcase size={80} className="text-indigo-600 mb-6" />
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Join Our Team</h1>
    <p className="text-xl text-gray-600 max-w-2xl mb-8">
      We are always looking for passionate and talented individuals to join the Fuzionest family. Explore our open positions and find your next career opportunity with us!
    </p>
    <div className="bg-gray-100 p-6 rounded-lg shadow-md w-full max-w-xl">
      <h3 className="text-2xl font-bold mb-4">Current Openings</h3>
      <ul className="space-y-4 text-left">
        <li className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-lg font-semibold">Senior Software Engineer</h4>
          <p className="text-gray-500">San Francisco, CA</p>
        </li>
        <li className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-lg font-semibold">Product Manager</h4>
          <p className="text-gray-500">New York, NY</p>
        </li>
        <li className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-lg font-semibold">UX/UI Designer</h4>
          <p className="text-gray-500">Remote</p>
        </li>
      </ul>
    </div>
  </div>
);

// New Contact page component
const ContactPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full px-4 text-center">
    <Mail size={80} className="text-indigo-600 mb-6" />
    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Get in Touch</h1>
    <p className="text-xl text-gray-600 max-w-2xl mb-8">
      Have a question or want to learn more? Feel free to reach out to us!
    </p>
    <div className="bg-gray-100 p-6 rounded-lg shadow-md w-full max-w-xl text-left space-y-4">
      <div>
        <h4 className="text-lg font-semibold">Email</h4>
        <a href="mailto:info@fuzionest.com" className="text-indigo-600 hover:underline">info@fuzionest.com</a>
      </div>
      <div>
        <h4 className="text-lg font-semibold">Phone</h4>
        <p className="text-gray-700">+1 (555) 123-4567</p>
      </div>
      <div>
        <h4 className="text-lg font-semibold">Address</h4>
        <p className="text-gray-700">123 Tech Avenue, Suite 400<br/>Innovation City, CA 90210</p>
      </div>
    </div>
  </div>
);

const App: React.FC = () => {
  // State to manage the current page
  const [currentPage, setCurrentPage] = useState<Page>('home');

  // Conditional rendering of the main content based on the current page
  const renderPage = () => {
    switch (currentPage) {
      case 'about':
        return <AboutPage />;
      case 'careers':
        return <CareersPage />;
      case 'contact':
        return <ContactPage />;
      case 'home':
      default:
        return <HomePage />;
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
