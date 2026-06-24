import { Response } from "express";

import Conversation from "../models/Conversation";
import { AuthRequest } from "../middleware/authMiddleware";

export const createConversation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { receiverId } = req.body;

    const existingConversation = await Conversation.findOne({
      participants: {
        $all: [req.userId, receiverId],
      },
    });

    if (existingConversation) {
      res.status(200).json({
        success: true,
        conversation: existingConversation,
      });
      return;
    }

    const conversation = await Conversation.create({
      participants: [req.userId, receiverId],
    });

    res.status(201).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};