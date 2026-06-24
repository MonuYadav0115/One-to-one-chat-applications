import { useState } from "react";

import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";


interface User {

  _id: string;
  name: string;
  email: string;

}



const Chat = () => {


  const [selectedUser, setSelectedUser] =
    useState<User | null>(null);



  return (

    <div
      className="
      flex
      h-screen
      "
    >


      <Sidebar

        setSelectedUser={
          setSelectedUser
        }

      />



      <ChatWindow

        selectedUser={
          selectedUser
        }

      />


    </div>

  );

};


export default Chat;