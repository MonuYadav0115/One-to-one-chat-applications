import mongoose, {
  Schema,
  Document
} from "mongoose";


export interface IMessage extends Document {

  sender: mongoose.Types.ObjectId;

  receiver: mongoose.Types.ObjectId;

  message: string;

  status:
  "sent"
  |
  "delivered"
  |
  "seen";

  isDeleted: boolean;

  isRead:boolean;

}


const MessageSchema =
new Schema<IMessage>(

{

 sender:{
  type:Schema.Types.ObjectId,
  ref:"User",
  required:true
 },


 receiver:{
  type:Schema.Types.ObjectId,
  ref:"User",
  required:true
 },


 message:{
  type:String,
  required:true
 },


status:{
  type:String,
  enum:[
    "sent",
    "delivered",
    "seen"
  ],
  default:"sent"
},

isDeleted:{
  type:Boolean,
  default:false
},

isRead:{
  type:Boolean,
  default:false
}


},

{
 timestamps:true
}

);


export default mongoose.model<IMessage>(
 "Message",
 MessageSchema
);