// src/services/messageService.ts

import api from "./api";

export const getMessages = async (receiverId: string) => {
  const response = await api.get(`/messages/${receiverId}`);
  return response.data;
};

export const sendMessage = async (receiverId: string, message: string) => {
  const response = await api.post("/messages", { receiverId, message });
  return response.data;
};

export const deleteMessage = async (messageId: string) => {
  const response = await api.delete(`/messages/${messageId}`);
  return response.data;
};

export const getUnreadCounts = async () => {
  const response = await api.get("/messages/unread/count");
  return response.data;
};

// ✅ NEW: Mark messages from a specific user as read
export const markMessagesAsRead = async (userId: string) => {
  // Adjust the endpoint to match your backend.
  // If your backend uses /messages/read/:userId, use that.
  // If it uses /conversations/:conversationId/read, adjust accordingly.
  const response = await api.post(`/messages/read/${userId}`);
  return response.data;
};