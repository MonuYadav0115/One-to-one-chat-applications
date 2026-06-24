import { Server } from "socket.io";
import Message from "./models/Message";


let io: Server;


const onlineUsers = new Map< string,string >();

export const isUserOnline = (
  userId:string
) => {

  return onlineUsers.has(
    userId
  );

};


export const initSocket = (server:any)=>{
io = new Server(
 server,
 {
  cors:{
   origin:"http://localhost:5173",
   methods:[
    "GET",
    "POST"
   ]
  }
 }
);



io.on(
 "connection",
 (socket)=>{


console.log(
 "Socket Connected:",
 socket.id
);



// JOIN ROOM

socket.on(
 "joinRoom",
 (userId)=>{


 console.log(
  "USER ONLINE:",
  userId
 );


 socket.join(
  userId
 );


 onlineUsers.set(
  userId,
  socket.id
 );


 io.emit(
  "onlineUsers",
  Array.from(
   onlineUsers.keys()
  )
 );


 }
);

// MESSAGE SEEN

socket.on(
 "markAsSeen",
 (data)=>{


 const {
  messageId,
  senderId
 } = data;


 console.log(
  "MESSAGE SEEN:",
  messageId
 );


 io.to(senderId)
 .emit(
  "messageSeen",
  messageId
 );


}
);

// MARK ALL MESSAGES READ

socket.on(
 "markMessagesRead",
 async(data)=>{

  try{

    const {
      senderId
    } = data;


    const receiverId =
      Array.from(
        onlineUsers.entries()
      )
      .find(
        ([userId,socketId]) =>
        socketId === socket.id
      )?.[0];


    if(!receiverId){
      return;
    }


    await Message.updateMany(
      {
        sender: senderId,
        receiver: receiverId,
        isRead:false
      },
      {
        isRead:true,
        status:"seen"
      }
    );


    console.log(
      "Messages marked read"
    );


    io.to(senderId)
    .emit(
      "unreadUpdated"
    );


  }
  catch(error){

    console.log(
      error
    );

  }

 }
);



// TYPING

socket.on(
 "typing",
 ({
  receiverId,
  userId
 })=>{


 socket.to(
  receiverId
 )
 .emit(
  "userTyping",
  {
   userId
  }
 );


}
);

// STOP TYPING

socket.on(
 "stopTyping",
 ({
  receiverId
 })=>{


 socket.to(
  receiverId
 )
 .emit(
  "userStoppedTyping"
 );


}
);


// DISCONNECT

socket.on(
 "disconnect",
 ()=>{


 console.log(
  "Socket Disconnected"
 );



 for(
  const [
   userId,
   socketId
  ]
  of onlineUsers
 ){

  if(
   socketId === socket.id
  ){

   onlineUsers.delete(
    userId
   );

  }

 }



 io.emit(
  "onlineUsers",
  Array.from(
   onlineUsers.keys()
  )
 );


}
);



 }

);


};

export const getIO = ()=>{

 return io;

};