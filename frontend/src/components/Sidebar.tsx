import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket/socket";
import { getUsers } from "../services/userService";
import { getUnreadCounts, markMessagesAsRead } from "../services/messageService";
import { createConversation } from "../services/conversationService";
import { logout } from "../services/authService";

interface User {
  _id: string;
  name: string;
  email: string;
}

interface UsersResponse {
  success: boolean;
  users: User[];
}

interface SidebarProps {
  setSelectedUser: (user: User) => void;
}

const Sidebar = ({ setSelectedUser }: SidebarProps) => {
  const navigate = useNavigate();

  // ===== STATE =====
  const [users, setUsers] = useState<User[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // ✅ NEW: track which user is selected for highlighting
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // ===== FETCH CURRENT USER =====
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user from localStorage");
      }
    }
  }, []);

  // ===== FETCH USERS =====
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data: UsersResponse = await getUsers();
        setUsers(data.users.filter((u) => u._id !== currentUser?._id));
      } catch (error) {
        console.error("Failed to fetch users:", error);
        setError("Failed to load users");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [currentUser]);

  // ===== FETCH UNREAD COUNTS =====
  useEffect(() => {
    const loadUnread = async () => {
      try {
        const data = await getUnreadCounts();
        const counts: Record<string, number> = {};
        data.unreadMessages?.forEach((item: { _id: string; count: number }) => {
          if (item._id && typeof item.count === "number") {
            counts[item._id] = item.count;
          }
        });
        setUnreadCounts(counts);
      } catch (error) {
        console.error("Failed to load unread counts:", error);
      }
    };

    loadUnread();
  }, []);

  // ===== SOCKET LISTENERS =====
  useEffect(() => {
    const handleOnlineUsers = (users: string[]) => {
      setOnlineUsers(users);
    };

    const handleNewUnreadMessage = (data: { senderId: string }) => {
      if (data?.senderId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [data.senderId]: (prev[data.senderId] || 0) + 1,
        }));
      }
    };

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("newUnreadMessage", handleNewUnreadMessage);
    socket.emit("getOnlineUsers");

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("newUnreadMessage", handleNewUnreadMessage);
    };
  }, []);

  // ===== HANDLE USER CLICK =====
  const handleUserClick = useCallback(
    async (user: User) => {
      try {
        // ✅ Set selected user for highlighting
        setSelectedUserId(user._id);
        // Notify parent
        setSelectedUser(user);
        // Create conversation & mark as read
        await createConversation(user._id);
        await markMessagesAsRead(user._id);
        setUnreadCounts((prev) => ({
          ...prev,
          [user._id]: 0,
        }));
      } catch (error) {
        console.error("Failed to create conversation:", error);
      }
    },
    [setSelectedUser]
  );

  // ===== LOGOUT =====
  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      socket.disconnect();
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      setError("Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }, [navigate]);

  // ===== FILTER USERS =====
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  // ===== RENDER =====
  return (
    <div className="flex h-full w-80 flex-col border-r border-gray-200 bg-white">
      {/* Current User Info */}
      {currentUser && (
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-teal-500">
            <span className="text-sm font-semibold text-white">
              {currentUser.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">
              {currentUser.name}
            </p>
            <p className="truncate text-xs text-gray-500">
              {currentUser.email}
            </p>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
        </div>
      )}

      {/* Header with search */}
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Users</h2>
          <span className="text-xs text-gray-500">
            {onlineUsers.length} online
          </span>
        </div>
        <div className="mt-2">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-500"
            >
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && filteredUsers.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">
              {searchTerm ? "No users match your search" : "No users found"}
            </p>
          </div>
        )}

        {!isLoading && !error && filteredUsers.length > 0 && (
          <div className="space-y-1">
            {filteredUsers.map((user) => {
              const isSelected = selectedUserId === user._id;
              return (
                <button
                  key={user._id}
                  onClick={() => handleUserClick(user)}
                  className={`
                    w-full rounded-lg border px-3 py-2 text-left transition-all
                    ${
                      isSelected
                        ? "border-blue-300 bg-blue-50 shadow-sm ring-1 ring-blue-300"
                        : "border-transparent hover:border-gray-200 hover:bg-gray-50"
                    }
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                  `}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
                        <span className="text-sm font-medium text-white">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {onlineUsers.includes(user._id) && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                      )}
                    </div>

                    {/* User details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {user.name}
                        </p>
                        {unreadCounts[user._id] > 0 && (
                          <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                            {unreadCounts[user._id] > 99
                              ? "99+"
                              : unreadCounts[user._id]}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-gray-500">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Logout Button */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50"
        >
          {isLoggingOut ? (
            <>
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Logging out...
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;