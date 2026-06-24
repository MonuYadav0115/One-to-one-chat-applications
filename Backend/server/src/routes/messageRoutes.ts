import express from "express";

import { protect } from "../middleware/authMiddleware";
import {
  sendMessage,
  getMessages,
  markMessageSeen,
  deleteMessage,
  getUnreadCounts
} from "../controllers/messageController";

const router = express.Router();

router.post(
  "/",
  protect,
  sendMessage
);

router.get(
  "/unread/count",
  protect,
  getUnreadCounts
);

router.get(
  "/:receiverId",
  protect,
  getMessages
);

router.put(
  "/seen",
  protect,
  markMessageSeen
);

router.delete(
  "/:messageId",
  protect,
  deleteMessage
);

export default router;