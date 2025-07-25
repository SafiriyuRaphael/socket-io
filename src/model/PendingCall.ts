import mongoose, { Schema, Document } from "mongoose";

export interface IPendingCall extends Document {
    callerId: string;
    recipientId: string;
    offer: any;
    callType: "audio" | "video";
    callerName: string;
    callerLogo: string;
    timestamp: Date;
}

const PendingCallSchema: Schema = new Schema({
    callerId: { type: String, required: true },
    recipientId: { type: String, required: true },
    offer: { type: Schema.Types.Mixed, required: true },
    callType: { type: String, enum: ["audio", "video"], required: true },
    callerName: { type: String, required: true },
    callerLogo: { type: String, required: true },
    timestamp: { type: Date, required: true, expires: 120 }, 
});

export default mongoose.model<IPendingCall>("PendingCall", PendingCallSchema);