import express from "express";

import { protect } from "../middleware/authMiddleware";
import { createConversation } from "../controllers/conversationController";

const router = express.Router();

router.post("/", protect, createConversation);

export default router; 