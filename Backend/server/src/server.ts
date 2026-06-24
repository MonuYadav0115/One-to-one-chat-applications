import express, {
  Application,
  Request,
  Response,
} from "express";

import cors from "cors";
import dotenv from "dotenv";
import http from "http";


import connectDB from "./config/db";

import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import conversationRoutes from "./routes/conversationRoutes";
import messageRoutes from "./routes/messageRoutes";


import { initSocket } from "./socket";


dotenv.config();


connectDB();



const app: Application = express();


// Middleware

app.use(
  cors({
    origin:process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json());

// Routes

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/users",
  userRoutes
);

app.use(
  "/api/conversations",
  conversationRoutes
);

app.use(
  "/api/messages",
  messageRoutes
);

// Test Route

app.get(
  "/",
  (
    req: Request,
    res: Response
  ) => {

    res.send(
      "Chat API Running"
    );

  }
);


const PORT: number =
  Number(process.env.PORT) || 5000;
// Create HTTP Server

const server = http.createServer(app);

// Initialize Socket.IO

initSocket(server);

// Start Server

server.listen(
  PORT,
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

  }
);