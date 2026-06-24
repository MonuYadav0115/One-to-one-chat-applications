// src/services/authService.ts

import api from "./api";

export const loginUser = async (email: string, password: string) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

export const registerUser = async (name: string, email: string, password: string) => {
  const response = await api.post("/auth/register", { name, email, password });
  return response.data;
};

// Add this logout function
export const logout = async (): Promise<void> => {
  try {
    // Optional: inform the server to invalidate the token
    await api.post("/auth/logout");
  } catch (error) {
    console.error("Logout API call failed:", error);
    // Even if the server fails, we should clear client-side data
  } finally {
    // Remove token from localStorage (or wherever you store it)
    localStorage.removeItem("token");
    // If you store user data, remove that too
    localStorage.removeItem("user");
    // If using sessionStorage, adjust accordingly
  }
};