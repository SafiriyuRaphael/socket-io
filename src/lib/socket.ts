import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import Message from "../model/Message";
import mongoose from "mongoose";
import User from "../model/User";
import { Business } from "../model/Business";

interface UserSocket {
    userId: string;
    socketId: string;
}

interface CustomSocket extends Socket {
    userId?: string;
}

const setupSocket = (server: HTTPServer) => {
    const io = new SocketIOServer(server, {
        cors: {
            origin: process.env.NEXT_PUBLIC_BASE_URL,
            methods: ["GET", "POST"],
        },
    });

    const userSockets: UserSocket[] = [];

    const users = new Map();

    io.on("connection", (socket: CustomSocket) => {
        console.log("User connected:", socket.id);

        socket.on("register", (userId: string) => {
            socket.userId = userId;
            userSockets.push({ userId, socketId: socket.id });
            users.set(userId, socket.id);
            console.log(`🧠 Registered user ${userId} with socket ${socket.id}`);
            io.emit("userStatus", { userId, online: true });
        });

        socket.on("reject-call", ({ to }) => {
            const targetSocketId = users.get(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit("call-rejected");
            }
        });

        socket.on("typing", ({ senderId, recipientId }: { senderId: string; recipientId: string }) => {
            const recipientSocket = userSockets.find((us) => us.userId === recipientId);
            if (recipientSocket) {
                io.to(recipientSocket.socketId).emit("typing", { senderId });
            }
        });

        socket.on("stopTyping", ({ senderId, recipientId }: { senderId: string; recipientId: string }) => {
            const recipientSocket = userSockets.find((us) => us.userId === recipientId);
            if (recipientSocket) {
                io.to(recipientSocket.socketId).emit("stopTyping", { senderId });
            }
        });


        socket.on("call-user", async ({ to, offer, callType }) => {
            const targetSocketId = users.get(to);

            try {
                // First get base user info
                const baseUser = await User.findById(socket.userId).select("fullName logo userType");

                if (!baseUser) {
                    return socket.emit("call-unavailable", { to, callType });
                }

                let callerName = baseUser.fullName;

                // If it's a business, get businessName from Business model
                if (baseUser.userType === "business") {
                    const bizUser = await Business.findById(socket.userId).select("businessName logo");
                    callerName = bizUser?.businessName || baseUser.fullName;
                }

                if (targetSocketId) {
                    io.to(targetSocketId).emit("receive-call", {
                        from: socket.userId,
                        offer,
                        callType,
                        callerName,
                        callerLogo: baseUser.logo, 
                    });
                } else {
                    socket.emit("call-unavailable", { to, callType });
                }
            } catch (err) {
                console.error("Error fetching caller info:", err);
                socket.emit("call-unavailable", { to, callType });
            }
        });


        socket.on("end-call", ({ to }) => {
            const targetSocketId = users.get(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit("call-ended");
            }
        });

        socket.on("answer-call", ({ to, answer }) => {
            const targetSocketId = users.get(to);
            if (targetSocketId) {
                console.log(`✅ Sending answer to ${to}`);
                io.to(targetSocketId).emit("call-answered", { answer });
            }
        });

        socket.on("ice-candidate", ({ to, candidate }) => {
            const targetSocketId = users.get(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit("ice-candidate", { candidate });
            }
        });

        socket.on(
            "sendMessage",
            async ({
                senderId,
                recipientId,
                content,
                file,
                type = "text",
                callDetails,
            }: {
                senderId: string;
                recipientId: string;
                content?: string;
                file?: { url: string; type: string; name: string };
                type?: "text" | "file" | "call";
                callDetails?: { status: string; callType: string };
            }) => {
                try {
                    const message = new Message({
                        sender: new mongoose.Types.ObjectId(senderId),
                        recipient: new mongoose.Types.ObjectId(recipientId),
                        content,
                        file,
                        type,
                        callDetails,
                        isSeen: false,
                    });
                    await message.save();

                    const messageData = {
                        id: message._id,
                        sender: senderId,
                        recipient: recipientId,
                        content,
                        file,
                        type,
                        callDetails,
                        timestamp: message.createdAt,
                        isSeen: false,
                        seenAt: null,
                    };

                    const recipientSocket = userSockets.find((us) => us.userId === recipientId);
                    if (recipientSocket) {
                        io.to(recipientSocket.socketId).emit("newMessage", messageData);
                    }
                    socket.emit("messageSent", messageData);

                    // const senderSocket = userSockets.find((us) => us.userId === senderId);
                    // if (senderSocket) {
                    //     io.to(senderSocket.socketId).emit("newMessage", messageData);
                    // }
                } catch (error) {
                    console.error("Error saving message:", error);
                    socket.emit("messageError", { error: "Failed to send message" });
                }
            }
        );

        socket.on("messageSeen", async ({ messageId }: { messageId: string }) => {
            try {
                const seenAt = new Date();
                await Message.findByIdAndUpdate(messageId, { isSeen: true, seenAt });
                const message = await Message.findById(messageId);
                const senderSocket = userSockets.find((us) => us.userId === message?.sender.toString());
                if (senderSocket) {
                    io.to(senderSocket.socketId).emit("messageSeen", { messageId, seenAt });
                }
            } catch (error) {
                console.error("Error updating message seen status:", error);
            }
        });

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
            const index = userSockets.findIndex((us) => us.socketId === socket.id);
            if (index !== -1) {
                const { userId } = userSockets[index];
                users.delete(userId);
                userSockets.splice(index, 1);
                io.emit("userStatus", { userId, online: false });
            }
        });
    });

    return io;
};

export default setupSocket;