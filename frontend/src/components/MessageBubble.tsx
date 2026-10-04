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
      className={`group flex w-full px-4 py-1.5 ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`relative max-w-[80%] md:max-w-[65%] lg:max-w-[55%] ${
          isMine
            ? "rounded-2xl rounded-br-md bg-blue-600 text-white"
            : "rounded-2xl rounded-bl-md bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
        }`}
      >
        {/* Message */}
        <div className="px-4 pt-2.5 pb-1.5">
          <p className="whitespace-pre-wrap break-words text-sm leading-6">
            {sanitizedMessage}
          </p>

          {/* Footer */}
          <div
            className={`mt-1 flex items-center justify-end gap-1.5 ${
              isMine ? "text-blue-100" : "text-gray-400"
            }`}
          >
            {/* Time */}
            {message.createdAt && (
              <span className="select-none text-[10px]">
                {formatTime(message.createdAt)}
              </span>
            )}

            {/* Status */}
            {getStatusIcon()}

            {/* Delete */}
            {isMine && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(message._id);
                }}
                className="ml-1 rounded-md p-1 opacity-0 transition-all duration-200 hover:bg-white/10 group-hover:opacity-100"
                title="Delete message"
                aria-label="Delete message"
              >
                <svg
                  className="h-3.5 w-3.5 text-blue-100 transition-colors hover:text-red-300"
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
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;