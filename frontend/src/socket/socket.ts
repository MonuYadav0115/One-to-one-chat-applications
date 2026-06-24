import { io } from "socket.io-client";


const socket = io(
  "https://one-to-one-chat-applications-1.onrender.com",
  {
    transports: ["websocket"],
  }
);


export default socket;