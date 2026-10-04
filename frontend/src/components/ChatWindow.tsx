import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from "react";
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

  // Online users listener
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

    let cancelled = false; // ignore results from outdated requests

    setIsLoading(true);
    setError(null);
    setIsTyping(false);

    // Mark messages as read when opening chat
    socket.emit("markMessagesRead", {
      senderId: selectedUser._id,
      readerId: currentUserId,
    });

    const loadMessages = async () => {
      try {
        const data = await getMessages(selectedUser._id);
        if (!cancelled) setMessages(data.messages || []);
      } catch (err) {
        console.error("Failed to load messages:", err);
        if (!cancelled) setError("Failed to load messages");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadMessages();

    // Handle new incoming messages
    const handleReceiveMessage = (newMessage: Message) => {
      // Only show message if it belongs to current conversation
      if (
        newMessage.sender !== selectedUser._id &&
        newMessage.receiver !== selectedUser._id
      ) {
        return;
      }

      shouldScrollRef.current = true;

      setMessages((prev) =>
        prev.some((m) => m._id === newMessage._id)
          ? prev
          : [...prev, newMessage],
      );

      if (newMessage.sender === selectedUser._id) {
        socket.emit("messageDelivered", {
          messageId: newMessage._id,
          senderId: newMessage.sender,
        });

        // Chat is open, so mark as read too
        socket.emit("markMessagesRead", {
          senderId: selectedUser._id,
          readerId: currentUserId,
        });
      }
    };

    const handleMessageDelivered = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId && msg.status === "sent"
            ? { ...msg, status: "delivered" as const }
            : msg,
        ),
      );
    };

    const handleMessageSeen = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, status: "seen" as const }
            : msg,
        ),
      );
    };

    const handleMessageDeleted = (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== data.messageId));
    };

    const handleUserTyping = (data: { userId: string }) => {
      if (data.userId === selectedUser._id) {
        setIsTyping(true);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

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

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("messageSeen", handleMessageSeen);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("userTyping", handleUserTyping);
    socket.on("userStopTyping", handleUserStopTyping);

    return () => {
      cancelled = true;

      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("messageDelivered", handleMessageDelivered);
      socket.off("messageSeen", handleMessageSeen);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("userTyping", handleUserTyping);
      socket.off("userStopTyping", handleUserStopTyping);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [selectedUser, currentUserId]);

  // Send message
  const handleSend = async () => {
    if (!selectedUser || !text.trim()) return;

    const messageText = text.trim();

    setText("");
    setError(null);

    socket.emit("stopTyping", {
      receiverId: selectedUser._id,
      userId: currentUserId,
    });

    try {
      const data = await sendMessage(selectedUser._id, messageText);

      if (data.message) {
        shouldScrollRef.current = true;

        // Dedupe: the socket event may have already added this message
        setMessages((prev) =>
          prev.some((m) => m._id === data.message._id)
            ? prev
            : [...prev, data.message],
        );
      }
    } catch (err) {
      console.error("Failed to send message:", err);
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

  // Handle input key events
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    } catch (err) {
      console.error("Failed to delete message:", err);
      setError("Failed to delete message");
    }
  };

  // Memoize filtered messages
  const filteredMessages = useMemo(() => {
    if (!searchText.trim()) return messages;

    return messages.filter((msg) =>
      msg.message.toLowerCase().includes(searchText.toLowerCase()),
    );
  }, [messages, searchText]);

  const isUserOnline = onlineUsers.includes(selectedUser?._id || "");

  // Empty state
  if (!selectedUser) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-gray-50 via-white to-blue-50 px-6">
        <div className="max-w-sm text-center">
          {/* Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100 shadow-sm">
            <svg
              className="h-10 w-10 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 10h8M8 14h5m8-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Heading */}
          <h3 className="mt-6 text-xl font-semibold text-gray-900">
            Welcome to Chat
          </h3>

          {/* Description */}
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Select a conversation from the sidebar to start messaging with
            someone.
          </p>

          {/* Hint */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-gray-400 shadow-sm ring-1 ring-gray-200">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6l4 2"
              />
            </svg>
            Choose a conversation to begin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* Header */}
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
              <span className="text-base font-semibold text-white">
                {selectedUser.name.charAt(0).toUpperCase()}
              </span>
            </div>

            {/* Online indicator */}
            <span
              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                isUserOnline ? "bg-green-500" : "bg-gray-400"
              }`}
            />
          </div>

          {/* User info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-gray-900 md:text-base">
                {selectedUser.name}
              </h2>

              {isUserOnline && (
                <span className="hidden rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600 sm:inline-block">
                  Active
                </span>
              )}
            </div>

            <div className="mt-0.5 flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isUserOnline ? "bg-green-500" : "bg-gray-400"
                }`}
              />

              <span
                className={`text-xs ${
                  isUserOnline ? "text-green-600" : "text-gray-400"
                }`}
              >
                {isUserOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>

          {/* Conversation status */}
          <div className="hidden shrink-0 sm:block">
            <div className="rounded-lg bg-gray-50 px-3 py-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                Chat
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 md:px-4">
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search messages..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
          />

          {/* Clear Search */}
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText("")}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Clear search"
              aria-label="Clear search"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-slate-50 px-2 py-4 sm:px-4"
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

        {/* Empty messages state */}
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
              {searchText
                ? "No messages match your search"
                : "No messages yet. Say hello!"}
            </p>
          </div>
        )}

        {/* Messages List */}
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
          <div className="flex items-center gap-2 px-2 py-2 sm:px-4">
            <div className="rounded-2xl rounded-bl-md bg-white px-4 py-2.5 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0.3s]" />
              </div>
            </div>

            <span className="text-[11px] font-medium text-gray-400">
              typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-2 py-3 sm:px-4">
        <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 shadow-sm transition-all focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/10">
          <textarea
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="max-h-32 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0"
          />

          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            title="Send message"
            aria-label="Send message"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18-9 2 9-2v-8"
              />
            </svg>
          </button>
        </div>

        <p className="mt-1.5 hidden text-center text-[10px] text-gray-400 sm:block">
          Press Enter to send • Shift + Enter for new line
        </p>
      </div>
    </div>
  );
};

export default ChatWindow;
