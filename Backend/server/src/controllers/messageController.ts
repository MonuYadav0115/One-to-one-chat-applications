import { Response } from "express";
import mongoose from "mongoose";
import Message from "../models/Message";
import { AuthRequest } from "../middleware/authMiddleware";
import { getIO } from "../socket";
import {isUserOnline} from "../socket";


export const sendMessage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {

  try {

    const {
      receiverId,
      message
    } = req.body;



    const newMessage = await Message.create({
      sender: req.userId,
      receiver: receiverId,
      message,
      status: "sent" }); 

      if(
  isUserOnline(receiverId)
){

  await Message.findByIdAndUpdate(
    newMessage._id,
    {
      status:"delivered"
    }
  );

  newMessage.status =
    "delivered";

}

console.log("EMIT MESSAGE TO:",receiverId);


getIO()
.to(receiverId)
.emit(
 "receiveMessage",
 newMessage
);

getIO()
.to(receiverId)
.emit(
 "newUnreadMessage",
 {
   senderId: req.userId
 }
);


// delivered update

if(req.userId){

 getIO()
 .to(req.userId)
 .emit(
  "messageDelivered",
  newMessage._id
 );

}


console.log(
  "MESSAGE EMITTED"
);



    res.status(201).json({

      success:true,

      message:newMessage,

    });



  } catch(error) {

    console.error(error);


    res.status(500).json({

      success:false,

      message:"Server Error",

    });


  }

};

export const getMessages = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { receiverId } = req.params;

    const messages = await Message.find({
      $or: [
        {
          sender: req.userId,
          receiver: receiverId,
        },
        {
          sender: receiverId,
          receiver: req.userId,
        },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const markMessageSeen = async(
 req:AuthRequest,
 res:Response
)=>{

 try{


 const {
   messageId
 } = req.body;


await Message.findByIdAndUpdate(
  messageId,
  {
    status:"seen",
    isRead:true
  }
);


 res.json({
  success:true
 });


 }
 catch(error){

 console.log(error);

 res.status(500)
 .json({
  success:false
 });

 }

};

export const deleteMessage = async(
  req: AuthRequest,
  res: Response
): Promise<void> => {

  try{

    const {
      messageId
    } = req.params;

    const message =
      await Message.findById(
        messageId
      );

    if(!message){

      res.status(404).json({
        success:false,
        message:"Message not found"
      });

      return;
    }

    message.isDeleted = true;

    message.message =
      "This message was deleted";

    await message.save();

    res.status(200).json({
      success:true,
      message
    });

  }
  catch(error){

    console.log(error);

    res.status(500).json({
      success:false,
      message:"Server Error"
    });

  }

};

export const getUnreadCounts = async(
  req: AuthRequest,
  res: Response
)=>{

  try{

    const unreadMessages =
      await Message.aggregate([

        {
          $match:{

            receiver:
              new mongoose.Types.ObjectId(
                req.userId
              ),

            isRead:false

          }
        },


        {
          $group:{

            _id:"$sender",

            count:{
              $sum:1
            }

          }
        }

      ]);


    console.log(
      "UNREAD COUNT:",
      unreadMessages
    );


    res.json({

      success:true,

      unreadMessages

    });


  }
  catch(error){

    console.log(error);


    res.status(500).json({

      success:false

    });

  }

};