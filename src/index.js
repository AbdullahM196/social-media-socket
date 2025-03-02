const { createClient } = require("redis");
const allowedOrigins = process.Errors.allowedOrigins?.split(",");
const { config } = require("dotenv");
config();
const io = require("socket.io")(3500, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
      } else if (allowedOrigins?.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not Allowed By Cors"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  },
});
const redisClient = createClient({
  url: process.env.redisUri,
});
(async () => {
  redisClient.on("error", (err) => {
    console.error("Redis connection error:", err);
  });
  redisClient.on("ready", () => {
    console.log("Redis Client is Ready");
  });
  await redisClient.connect();
  await redisClient.ping();
})();
const addUser = async (userId, socketId) => {
  try {
    await redisClient.hSet("users", userId.toString(), socketId.toString());
  } catch (error) {
    console.error("Failed to add user to Redis:", error);
  }
};
const removeUser = async (socketId) => {
  try {
    const user = await redisClient.hGetAll("users");
    const userId = Object.keys(user).find((key) => user[key] === socketId);
    if (userId) {
      await redisClient.hDel("users", userId);
    }
  } catch (error) {
    console.error("Failed to remove user from Redis:", error);
  }
};

const getUser = async (userId) => {
  try {
    if (!userId) return null;
    return await redisClient.hGet("users", userId);
  } catch (error) {
    console.error("Failed to get user from Redis:", error);
    return null;
  }
};

const addConversation = async (conversationId, members) => {
  try {
    const firstMember = await getUser(members[0]);
    const secondMember = await getUser(members[1]);
    if (firstMember) {
      io.to(firstMember).emit("newConversation", {
        _id: conversationId,
        members,
      });
    }
    if (secondMember) {
      io.to(secondMember).emit("newConversation", {
        _id: conversationId,
        members,
      });
    }
  } catch (error) {
    console.error("Failed to add conversation to Redis:", error);
  }
};

io.on("connection", (socket) => {
  // when client connected
  console.log("Client connected");
  socket.on("addUser", async (data) => {
    if (data) {
      await addUser(data, socket.id);
    }
  });
  socket.on("getUser", async (userId) => {
    const user = await getUser(userId);
    socket.emit("userData", user);
  });
  socket.on("addConversation", async (conversationId, members) => {
    if (conversationId) {
      await addConversation(conversationId, members);
    }
  });

  // send and get message
  socket.on(
    "sendMessage",
    async ({ _id, senderId, receiverId, text, img, conversationId }) => {
      const receiverSocketId = await getUser(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("getMessage", {
          _id,
          senderId,
          text,
          conversationId,
          img: { url: img.url },
        });
      }
    }
  );
  socket.on(
    "sendNotification",
    async ({ _id, sender, receiver, type, text, comment }) => {
      const receiverSocketId = await getUser(receiver);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("getNotification", {
          _id,
          sender,
          receiver,
          type,
          text,
          comment,
        });
      }
    }
  );
  socket.on(
    "sendFriendRequest",
    async ({ friendRequestId, sender, receiver }) => {
      const receiverSocketId = await getUser(receiver._id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("getFriendRequest", {
          friendRequestId,
          sender,
          receiver,
          msg: `${sender.username} sent you a friend request`,
        });
        await redisClient.hSet(
          "friendRequests",
          friendRequestId,
          JSON.stringify({ sender, receiver })
        );
      }
    }
  );
  socket.on("cancel-friend-request", async (friendRequestId) => {
    let data = await redisClient.hGet("friendRequests", friendRequestId);
    data = JSON.parse(data);
    const receiverSocketId = await getUser(data.receiver._id);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("cancelRequest", friendRequestId);
    }
    redisClient.hDel("friendRequests", friendRequestId);
  });

  // when client disconnect
  socket.on("disconnect", async () => {
    await removeUser(socket.id);
    console.log("Client disconnected", socket.id);
  });
});
console.log("Socket server is running on port 3500");
