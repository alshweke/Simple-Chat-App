// Server-side: Manages user connections, room assignments, message broadcasting, and updates to users and rooms.

import express from "express";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// Determine the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize express app
const app = express();
// Routing, set up an Express application to serve static files from the public directory.
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3500;
const ADMIN = "Admin";

const expressServer = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// State to keep track of connected users
const UsersState = {
  users: [],
  setUsers: function (newUsersArray) {
    this.users = newUsersArray;
  },
};
// configure the Socket.IO server to handle cross-origin requests from specified origins
const io = new Server(expressServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? false
        : ["http://localhost:5500", "http://127.0.0.1:5500"],
  },
});
// Handles new connections, sends the list of rooms and users to the client.
io.on("connection", (socket) => {
  console.log(`User ${socket.id} connected`);
  socket.emit("roomList", { rooms: getAllActiveRooms() });
  socket.emit("userList", { users: getUsersInRoom(getUser(socket.id)?.room) });

  socket.emit("message", buildMsg(ADMIN, "Welcome to Chat App!"));
  // allows a user to create a new room or join on
  socket.on("createRoom", ({ name, room }, callback) => {
    if (getAllActiveRooms().includes(room)) {
      callback({
        error: "Room name already taken. Please choose another one.",
      });
      return;
    }
    joinRoom(socket, name, room, callback);
  });
  // Handle user entering a room
  socket.on("enterRoom", ({ name, room }, callback) => {
    joinRoom(socket, name, room, callback);
  });
  // Handles user disconnections, updates the user and room lists.
  socket.on("disconnect", () => {
    const user = getUser(socket.id);
    userLeavesApp(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        buildMsg(ADMIN, `${user.name} has left the room`)
      );

      io.to(user.room).emit("userList", {
        users: getUsersInRoom(user.room),
      });

      io.emit("roomList", {
        rooms: getAllActiveRooms(),
      });
    }

    console.log(`User ${socket.id} disconnected`);
  });
  // Broadcasts a received message to the appropriate room.
  socket.on("message", ({ name, text }) => {
    const room = getUser(socket.id)?.room;
    if (room) {
      io.to(room).emit("message", buildMsg(name, text));
    }
  });
  // Broadcasts typing activity to other users in the room.
  socket.on("activity", (name) => {
    const room = getUser(socket.id)?.room;
    if (room) {
      socket.broadcast.to(room).emit("activity", name);
    }
  });
});
// Handles user joining a room, including leaving the previous room if applicable.
function joinRoom(socket, name, room, callback) {
  if (UsersState.users.some((user) => user.name === name)) {
    callback({ error: "Username already taken. Please choose another one." });
    return;
  }
  const prevRoom = getUser(socket.id)?.room;
  if (prevRoom) {
    socket.leave(prevRoom);
    io.to(prevRoom).emit(
      "message",
      buildMsg(ADMIN, `${name} has left the room`)
    );
  }
  const user = activateUser(socket.id, name, room);
  if (prevRoom) {
    io.to(prevRoom).emit("userList", {
      users: getUsersInRoom(prevRoom),
    });
  }
  socket.join(user.room);
  socket.emit(
    "message",
    buildMsg(ADMIN, `You have joined the ${user.room} chat room`)
  );
  socket.broadcast
    .to(user.room)
    .emit("message", buildMsg(ADMIN, `${user.name} has joined the room`));
  io.to(user.room).emit("userList", {
    users: getUsersInRoom(user.room),
  });
  io.emit("roomList", {
    rooms: getAllActiveRooms(),
  });
  io.to(user.room).emit("userList", {
    users: getUsersInRoom(user.room),
  });
}
//  Constructs a message object with a timestamp.
function buildMsg(name, text) {
  return {
    name,
    text,
    time: new Intl.DateTimeFormat("default", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).format(new Date()),
  };
}

// User management functions
function activateUser(id, name, room) {
  const user = { id, name, room };
  UsersState.setUsers([
    ...UsersState.users.filter((user) => user.id !== id),
    user,
  ]);
  return user;
}

function userLeavesApp(id) {
  UsersState.setUsers(UsersState.users.filter((user) => user.id !== id));
}

function getUser(id) {
  return UsersState.users.find((user) => user.id === id);
}

function getUsersInRoom(room) {
  return UsersState.users.filter((user) => user.room === room);
}

function getAllActiveRooms() {
  return Array.from(new Set(UsersState.users.map((user) => user.room)));
}
