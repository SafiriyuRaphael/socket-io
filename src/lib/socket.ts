// import { Server as HTTPServer } from "http";
// import { Server as SocketIOServer, Socket } from "socket.io";
// import Message from "../model/Message";
// import mongoose from "mongoose";
// import User from "../model/User";
// import { Business } from "../model/Business";

// interface UserSocket {
//     userId: string;
//     socketId: string;
// }

// interface CustomSocket extends Socket {
//     userId?: string;
// }

// const setupSocket = (server: HTTPServer) => {
//     const io = new SocketIOServer(server, {
//         cors: {
//             origin: process.env.NEXT_PUBLIC_BASE_URL,
//             methods: ["GET", "POST"],
//         },
//     });

//     const userSockets: UserSocket[] = [];

//     const users = new Map();

//     io.on("connection", (socket: CustomSocket) => {
//         console.log("User connected:", socket.id);

//         socket.on("register", (userId: string) => {
//             socket.userId = userId;
//             userSockets.push({ userId, socketId: socket.id });
//             users.set(userId, socket.id);
//             console.log(`🧠 Registered user ${userId} with socket ${socket.id}`);
//             io.emit("userStatus", { userId, online: true });
//         });

//         socket.on("reject-call", ({ to }) => {
//             const targetSocketId = users.get(to);
//             if (targetSocketId) {
//                 io.to(targetSocketId).emit("call-rejected");
//             }
//         });

//         socket.on("typing", ({ senderId, recipientId }: { senderId: string; recipientId: string }) => {
//             const recipientSocket = userSockets.find((us) => us.userId === recipientId);
//             if (recipientSocket) {
//                 io.to(recipientSocket.socketId).emit("typing", { senderId });
//             }
//         });

//         socket.on("stopTyping", ({ senderId, recipientId }: { senderId: string; recipientId: string }) => {
//             const recipientSocket = userSockets.find((us) => us.userId === recipientId);
//             if (recipientSocket) {
//                 io.to(recipientSocket.socketId).emit("stopTyping", { senderId });
//             }
//         });


//         socket.on("call-user", async ({ to, offer, callType }) => {
//             const targetSocketId = users.get(to);

//             try {
//                 // First get base user info
//                 const baseUser = await User.findById(socket.userId).select("fullName logo userType");

//                 if (!baseUser) {
//                     return socket.emit("call-unavailable", { to, callType });
//                 }

//                 let callerName = baseUser.fullName;

//                 // If it's a business, get businessName from Business model
//                 if (baseUser.userType === "business") {
//                     const bizUser = await Business.findById(socket.userId).select("businessName logo");
//                     callerName = bizUser?.businessName || baseUser.fullName;
//                 }

//                 if (targetSocketId) {
//                     io.to(targetSocketId).emit("receive-call", {
//                         from: socket.userId,
//                         offer,
//                         callType,
//                         callerName,
//                         callerLogo: baseUser.logo,
//                     });
//                 } else {
//                     socket.emit("call-unavailable", { to, callType });
//                 }
//             } catch (err) {
//                 console.error("Error fetching caller info:", err);
//                 socket.emit("call-unavailable", { to, callType });
//             }
//         });


//         socket.on("end-call", ({ to }) => {
//             const targetSocketId = users.get(to);
//             if (targetSocketId) {
//                 io.to(targetSocketId).emit("call-ended");
//                 io.to(targetSocketId).emit("call-cancelled");
//             }
//         });

//         socket.on("answer-call", ({ to, answer }) => {
//             const targetSocketId = users.get(to);
//             if (targetSocketId) {
//                 console.log(`✅ Sending answer to ${to}`);
//                 io.to(targetSocketId).emit("call-answered", { answer });
//             }
//         });

//         socket.on("ice-candidate", ({ to, candidate }) => {
//             const targetSocketId = users.get(to);
//             if (targetSocketId) {
//                 io.to(targetSocketId).emit("ice-candidate", { candidate });
//             }
//         });

//         socket.on(
//             "sendMessage",
//             async ({
//                 senderId,
//                 recipientId,
//                 content,
//                 file,
//                 type = "text",
//                 callDetails,
//             }: {
//                 senderId: string;
//                 recipientId: string;
//                 content?: string;
//                 file?: { url: string; type: string; name: string };
//                 type?: "text" | "file" | "call";
//                 callDetails?: { status: string; callType: string };
//             }) => {
//                 try {
//                     const message = new Message({
//                         sender: new mongoose.Types.ObjectId(senderId),
//                         recipient: new mongoose.Types.ObjectId(recipientId),
//                         content,
//                         file,
//                         type,
//                         callDetails,
//                         isSeen: false,
//                     });
//                     await message.save();

//                     const messageData = {
//                         id: message._id,
//                         sender: senderId,
//                         recipient: recipientId,
//                         content,
//                         file,
//                         type,
//                         callDetails,
//                         timestamp: message.createdAt,
//                         isSeen: false,
//                         seenAt: null,
//                     };

//                     const recipientSocket = userSockets.find((us) => us.userId === recipientId);
//                     if (recipientSocket) {
//                         io.to(recipientSocket.socketId).emit("newMessage", messageData);
//                     }
//                     socket.emit("messageSent", messageData);

//                     // const senderSocket = userSockets.find((us) => us.userId === senderId);
//                     // if (senderSocket) {
//                     //     io.to(senderSocket.socketId).emit("newMessage", messageData);
//                     // }
//                 } catch (error) {
//                     console.error("Error saving message:", error);
//                     socket.emit("messageError", { error: "Failed to send message" });
//                 }
//             }
//         );

//         socket.on("messageSeen", async ({ messageId }: { messageId: string }) => {
//             try {
//                 const seenAt = new Date();
//                 await Message.findByIdAndUpdate(messageId, { isSeen: true, seenAt });
//                 const message = await Message.findById(messageId);
//                 const senderSocket = userSockets.find((us) => us.userId === message?.sender.toString());
//                 if (senderSocket) {
//                     io.to(senderSocket.socketId).emit("messageSeen", { messageId, seenAt });
//                 }
//             } catch (error) {
//                 console.error("Error updating message seen status:", error);
//             }
//         });

//         socket.on("disconnect", () => {
//             console.log("User disconnected:", socket.id);
//             const index = userSockets.findIndex((us) => us.socketId === socket.id);
//             if (index !== -1) {
//                 const { userId } = userSockets[index];
//                 users.delete(userId);
//                 userSockets.splice(index, 1);
//                 io.emit("userStatus", { userId, online: false });
//             }
//         });
//     });

//     return io;
// };

// export default setupSocket;



import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import Message from "../model/Message";
import mongoose from "mongoose";
import User from "../model/User";
import { Business } from "../model/Business";
import PendingCall from "../model/PendingCall";

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

    const activeCalls = new Map<string, { from: string; to: string; startedAt: Date }>();

    io.on("connection", (socket: CustomSocket) => {
        console.log("User connected:", socket.id);

        socket.on("register", async (userId: string) => {
            socket.userId = userId;
            userSockets.push({ userId, socketId: socket.id });
            users.set(userId, socket.id);
            console.log(`🧠 Registered user ${userId} with socket ${socket.id}`);
            io.emit("userStatus", { userId, online: true });
            io.emit("active-users", Array.from(users.keys()));

            // Check for pending calls
            try {
                const pendingCalls = await PendingCall.find({ recipientId: userId });
                for (const call of pendingCalls) {
                    io.to(socket.id).emit("receive-call", {
                        from: call.callerId,
                        offer: call.offer,
                        callType: call.callType,
                        callerName: call.callerName,
                        callerLogo: call.callerLogo,
                    });
                    await PendingCall.deleteOne({ _id: call._id }); // Remove delivered call
                }
            } catch (err) {
                console.error("Error fetching pending calls:", err);
            }
        });

        socket.on("check-status", async () => {
            try {
                const dbStatus = mongoose.connection.readyState === 1 ? "Online" : "Offline";
                const chatOnline = userSockets.length > 0;
                const activeCallCount = activeCalls.size;
        
                const status = {
                    chatService: chatOnline ? "Online" : "Offline",
                    voiceCalls: activeCallCount > 0 ? "Online" : "Idle",
                    videoCalls: activeCallCount > 0 ? "Online" : "Idle", 
                    database: dbStatus,
                };
        
                socket.emit("status-update", status);
            } catch (err) {
                console.error("Error checking status:", err);
                socket.emit("status-update", {
                    chatService: "Unknown",
                    voiceCalls: "Unknown",
                    videoCalls: "Unknown",
                    database: "Unknown",
                });
            }
        });

        socket.on("reject-call", ({ to }) => {
            const targetSocketId = users.get(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit("call-rejected");
                const key = socket.userId + "-" + to;
                activeCalls.delete(key);
                io.emit("activeCalls", {
                    total: activeCalls.size,
                    calls: Array.from(activeCalls.values()),
                });
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
            activeCalls.set(socket.userId + "-" + to, {
                from: socket.userId!,
                to,
                startedAt: new Date()
            });
            io.emit("activeCalls", {
                total: activeCalls.size,
                calls: Array.from(activeCalls.values()), // Send serializable format
            });

            try {
                const baseUser = await User.findById(socket.userId).select("fullName logo userType");
                if (!baseUser) {
                    return socket.emit("call-unavailable", { to, callType });
                }

                let callerName = baseUser.fullName;
                if (baseUser.userType === "business") {
                    const bizUser = await Business.findById(socket.userId).select("businessName logo");
                    callerName = bizUser?.businessName || baseUser.fullName;
                }

                const callData = {
                    from: socket.userId,
                    offer,
                    callType,
                    callerName,
                    callerLogo: baseUser.logo,
                };

                if (targetSocketId) {
                    io.to(targetSocketId).emit("receive-call", callData);
                    socket.emit("call-initiated", { callerName });
                } else {
                    // Store pending call in MongoDB
                    const pendingCall = new PendingCall({
                        callerId: socket.userId!,
                        recipientId: to,
                        offer,
                        callType,
                        callerName,
                        callerLogo: baseUser.logo,
                        timestamp: new Date(),
                    });
                    await pendingCall.save();
                    console.log(`Stored pending call for offline user ${to}`);
                    socket.emit("call-queued", { to, callType });
                }
            } catch (err) {
                console.error("Error handling call-user:", err);
                socket.emit("call-unavailable", { to, callType });
            }
        });

        socket.on("end-call", async ({ to }) => {
            const targetSocketId = users.get(to);
            if (targetSocketId) {
                io.to(targetSocketId).emit("call-ended");
                io.to(targetSocketId).emit("call-cancelled");
                const key = socket.userId + "-" + to;
                activeCalls.delete(key);
                io.emit("activeCalls", {
                    total: activeCalls.size,
                    calls: Array.from(activeCalls.values()),
                });
            }
            // Remove any pending calls for this recipient
            try {
                await PendingCall.deleteMany({ callerId: socket.userId, recipientId: to });
            } catch (err) {
                console.error("Error deleting pending calls:", err);
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
                    const [userA, userB] = senderId < recipientId ? [senderId, recipientId] : [recipientId, senderId];
                    const count = await Message.countDocuments({
                        $or: [
                            { sender: userA, recipient: userB },
                            { sender: userB, recipient: userA },
                        ],
                    });
                    const isNewConnection = count === 0;
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

                    if (isNewConnection) {
                        socket.emit("newConnection", { from: messageData.recipient, to: messageData.sender });
                    }
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


        socket.on("disconnect", async () => {
            console.log("User disconnected:", socket.id);
            const index = userSockets.findIndex((us) => us.socketId === socket.id);
            if (index !== -1) {
                const { userId } = userSockets[index];
                users.delete(userId);
                userSockets.splice(index, 1);
                io.emit("userStatus", { userId, online: false });
                io.emit("active-users", Array.from(users.keys()));
            }
        });
    });

    return io;
};

export default setupSocket;