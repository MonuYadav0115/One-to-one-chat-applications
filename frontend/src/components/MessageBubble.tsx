interface Message {
  _id: string;
  sender: string;
  receiver: string;
  message: string;
  status: "sent" | "delivered" | "seen";
  createdAt?: string;
}

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  onDelete: (messageId: string) => void;
}

const MessageBubble = ({
  message,
  currentUserId,
  onDelete,
}: MessageBubbleProps) => {
  const isMine = String(message.sender) === String(currentUserId);

  // Safe message rendering (prevents XSS)
  const sanitizedMessage = message.message
    ?.replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Format time safely
  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) return "";
      
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  // Status indicators with tooltips
  const getStatusIcon = () => {
    if (!isMine) return null;

    const statusConfig = {
      sent: {
        icon: (
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.5 4l-7 7-3-3" stroke="currentColor" fill="none" strokeWidth="2" />
          </svg>
        ),
        label: "Sent",
        className: "text-gray-400",
      },
      delivered: {
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.5 4l-7 7-3-3" stroke="currentColor" fill="none" strokeWidth="2" />
            <path d="M15.5 4l-7 7-3-3" stroke="currentColor" fill="none" strokeWidth="2" transform="translate(3, -2)" />
          </svg>
        ),
        label: "Delivered",
        className: "text-gray-400",
      },
      seen: {
        icon: (
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.5 4l-7 7-3-3" stroke="currentColor" fill="none" strokeWidth="2" />
            <path d="M15.5 4l-7 7-3-3" stroke="currentColor" fill="none" strokeWidth="2" transform="translate(3, -2)" />
          </svg>
        ),
        label: "Seen",
        className: "text-blue-300",
      },
    };

    const status = statusConfig[message.status];
    if (!status) return null;

    return (
      <span className={`inline-flex items-center ${status.className}`} title={status.label}>
        {status.icon}
      </span>
    );
  };

  return (
    <div
      className={`flex mb-2 px-4 animate-fadeIn ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      {/* Message Container */}
      <div
        className={`relative group max-w-[75%] md:max-w-[60%] lg:max-w-[50%] rounded-2xl px-4 py-2.5 shadow-sm transition-all duration-200 ${
          isMine
            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md"
            : "bg-gray-100 text-gray-900 rounded-bl-md hover:bg-gray-200"
        }`}
      >
        {/* Sender Name (for group chats or received messages) */}
        {!isMine && (
          <p className="text-xs font-semibold text-gray-600 mb-1">
            {message.sender}
          </p>
        )}

        {/* Message Content */}
        <div className="break-words">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {sanitizedMessage}
          </p>
        </div>

        {/* Message Footer: Time, Status, Actions */}
        <div className="flex items-center justify-end gap-1.5 mt-1">
          {/* Time */}
          {message.createdAt && (
            <span className="text-[10px] opacity-75 select-none">
              {formatTime(message.createdAt)}
            </span>
          )}

          {/* Status */}
          {getStatusIcon()}

          {/* Delete Button - Only visible on hover */}
          {isMine && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent event bubbling
                onDelete(message._id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-1 p-0.5 rounded hover:bg-red-500/20"
              title="Delete message"
            >
              <svg
                className="w-3.5 h-3.5 text-red-300 hover:text-red-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Message Tail */}
        <div
          className={`absolute bottom-0 w-3 h-3 ${
            isMine
              ? "-right-1.5 bg-blue-700"
              : "-left-1.5 bg-gray-100"
          }`}
          style={{
            clipPath: isMine
              ? "polygon(0 0, 100% 100%, 100% 0)"
              : "polygon(100% 0, 0 100%, 0 0)",
          }}
        />
      </div>
    </div>
  );
};

export default MessageBubble;