import { Response } from "express";

import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

export const getUsers = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const users = await User.find({
      _id: { $ne: req.userId },
    }).select("-password");

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};