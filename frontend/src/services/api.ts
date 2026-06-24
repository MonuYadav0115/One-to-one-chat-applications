import axios from "axios";

const api = axios.create({
  baseURL: "https://one-to-one-chat-applications-1.onrender.com",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;