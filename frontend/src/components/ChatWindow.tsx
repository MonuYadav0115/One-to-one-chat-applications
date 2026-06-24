import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import socket from "../socket/socket";
import {
  getMessages,
  sendMessage,
  deleteMessage,
} from "../services/messageService";
import MessageBubble from "./MessageBubble";

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Message {
  _id: string;
  sender: string;
  receiver: string;
  message: string;
  status: "sent" | "delivered" | "seen";
  createdAt?: string;
}

interface ChatWindowProps {
  selectedUser: User | null;
}

const ChatWindow = ({ selectedUser }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollRef = useRef(true);
  
  const currentUserId = localStorage.getItem("userId") || "";

  // Track if user has scrolled up to read older messages
  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    shouldScrollRef.current = isAtBottom;
  }, []);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (shouldScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Join socket room
  useEffect(() => {
    if (currentUserId) {
      socket.emit("joinRoom", currentUserId);
    }
    
    return () => {
      if (currentUserId) {
        socket.emit("leaveRoom", currentUserId);
      }
    };
  }, [currentUserId]);

  // Online Users Listener
  useEffect(() => {
    const handleOnlineUsers = (users: string[]) => {
      setOnlineUsers(users);
    };

    socket.on("onlineUsers", handleOnlineUsers);

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
    };
  }, []);

  // Load messages + realtime socket
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      setIsTyping(false);
      return;
    }

    // Reset states
    setIsLoading(true);
    setError(null);
    setIsTyping(false);

    // Mark messages as read when opening chat
    socket.emit("markMessagesRead", {
      senderId: selectedUser._id,
      readerId: currentUserId,
    });

    // Load messages from API
    const loadMessages = async () => {
      try {
        const data = await getMessages(selectedUser._id);
        setMessages(data.messages || []);
      } catch (error) {
        console.error("Failed to load messages:", error);
        setError("Failed to load messages");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadMessages();

    // Handle new incoming messages
    const handleReceiveMessage = (newMessage: Message) => {
      console.log("NEW MESSAGE RECEIVED:", newMessage);

      // Only show message if it belongs to current conversation
      if (
        newMessage.sender !== selectedUser._id &&
        newMessage.receiver !== selectedUser._id
      ) {
        return;
      }

      setMessages((prev) => {
        // Check for duplicates
        const alreadyExist = prev.some((msg) => msg._id === newMessage._id);
        if (alreadyExist) return prev;

        // Auto-scroll for new messages
        shouldScrollRef.current = true;

        return [...prev, newMessage];
      });

      // Send delivery confirmation
      if (newMessage.sender === selectedUser._id) {
        socket.emit("messageDelivered", {
          messageId: newMessage._id,
          senderId: newMessage.sender,
        });
      }
    };

    // Handle message status updates
    const handleMessageDelivered = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId && msg.status === "sent"
            ? { ...msg, status: "delivered" as const }
            : msg
        )
      );
    };

    const handleMessageSeen = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, status: "seen" as const }
            : msg
        )
      );
    };

    // Handle typing indicators
    const handleUserTyping = (data: { userId: string }) => {
      if (data.userId === selectedUser._id) {
        setIsTyping(true);

        // Clear previous timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    };

    const handleUserStopTyping = (data: { userId: string }) => {
      if (data.userId === selectedUser._id) {
        setIsTyping(false);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      }
    };

    // Register socket listeners
    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("messageSeen", handleMessageSeen);
    socket.on("userTyping", handleUserTyping);
    socket.on("userStopTyping", handleUserStopTyping);

    // Cleanup
    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("messageDelivered", handleMessageDelivered);
      socket.off("messageSeen", handleMessageSeen);
      socket.off("userTyping", handleUserTyping);
      socket.off("userStopTyping", handleUserStopTyping);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [selectedUser, currentUserId]);

  // Send Message
  const handleSend = async () => {
    if (!selectedUser || !text.trim()) return;

    const messageText = text.trim();
    setText(""); // Clear input immediately for better UX
    setError(null);

    // Stop typing indicator
    socket.emit("stopTyping", {
      receiverId: selectedUser._id,
      userId: currentUserId,
    });

    try {
      const data = await sendMessage(selectedUser._id, messageText);
      console.log("SEND RESPONSE:", data);

      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        shouldScrollRef.current = true;
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setError("Failed to send message. Please try again.");
      // Restore the text if sending failed
      setText(messageText);
    }
  };

  // Handle typing
  const handleTyping = (value: string) => {
    setText(value);

    if (selectedUser && value.trim()) {
      socket.emit("typing", {
        receiverId: selectedUser._id,
        userId: currentUserId,
      });
    } else if (selectedUser) {
      socket.emit("stopTyping", {
        receiverId: selectedUser._id,
        userId: currentUserId,
      });
    }
  };

  // Handle input key events - Fixed: Use React.KeyboardEvent inline instead of importing
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    } catch (error) {
      console.error("Failed to delete message:", error);
      setError("Failed to delete message");
    }
  };

  // Memoize filtered messages for performance
  const filteredMessages = useMemo(() => {
    if (!searchText.trim()) return messages;
    
    return messages.filter((msg) =>
      msg.message.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [messages, searchText]);

  // Check if selected user is online
  const isUserOnline = onlineUsers.includes(selectedUser?._id || "");

  // Empty state
  if (!selectedUser) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            Select a conversation
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Choose a user from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
              <span className="text-sm font-semibold text-white">
                {selectedUser.name.charAt(0).toUpperCase()}
              </span>
            </div>
            {/* Online/Offline Indicator */}
            <div
              className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                isUserOnline ? "bg-green-500" : "bg-gray-400"
              }`}
            />
          </div>

          {/* User Info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedUser.name}
            </h2>
            <p className="text-xs text-gray-500">
              {isUserOnline ? (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  Offline
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-4"
      >
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-bounce rounded-full bg-blue-600" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:0.1s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:0.2s]" />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="mb-4 rounded-lg bg-red-50 p-3">
            <p className="flex items-center gap-2 text-sm text-red-600">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </p>
          </div>
        )}

        {/* Messages List */}
        {!isLoading && filteredMessages.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-12">
            <svg
              className="h-16 w-16 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
              />
            </svg>
            <p className="mt-4 text-sm text-gray-500">
              {searchText ? "No messages match your search" : "No messages yet. Say hello!"}
            </p>
          </div>
        )}

        {filteredMessages.map((msg) => (
          <MessageBubble
            key={msg._id}
            message={msg}
            currentUserId={currentUserId}
            onDelete={handleDeleteMessage}
          />
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2">
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.1s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.2s]" />
            </div>
            <span className="text-xs text-gray-500">typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>Send</span>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;