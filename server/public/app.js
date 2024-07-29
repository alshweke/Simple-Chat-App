// Client-side: Handles user interactions, displays messages, and updates the UI based on server events.

document.addEventListener("DOMContentLoaded", () => {
  // Connect to the Socket.IO server
  const socket = io("ws://localhost:3500");

  const nameInput = document.querySelector("#name");
  const selectChatRoom = document.querySelector("#room");
  const joinRoomBtn = document.querySelector("#joinRoomBtn");
  const createRoomInput = document.querySelector("#createRoom");
  const createRoomBtn = document.querySelector("#createRoomBtn");
  const msgInput = document.querySelector("#message");
  const activity = document.querySelector(".activity");
  const usersList = document.querySelector(".user-list");
  const roomList = document.querySelector(".room-list");
  const chatDisplay = document.querySelector(".chat-display");
  const errorText = document.querySelector("#error");

  let currentRoom = ""; // a global variable to store the current room

  function sendMessage(e) {
    e.preventDefault();
    if (nameInput.value && msgInput.value && currentRoom) {
      socket.emit("message", {
        name: nameInput.value,
        text: msgInput.value,
        room: currentRoom,
      });
      msgInput.value = "";
    } else {
      console.log("Message not sent. Missing required fields.");
    }
    msgInput.focus();
  }

  function enterRoom(e) {
    e.preventDefault();
    chatDisplay.innerHTML = "";
    currentRoom = selectChatRoom.value || createRoomInput.value;
    if (nameInput.value && currentRoom) {
      socket.emit(
        "enterRoom",
        {
          name: nameInput.value,
          room: currentRoom,
        },
        (response) => {
          if (response.error) {
            errorText.textContent = response.error;
          } else {
            errorText.textContent = "";
            document.querySelector(".form-join").style.display = "none";
            document.querySelector(".chat-container").style.display = "block";
            // Enable message input after joining a room
            msgInput.disabled = false;
            msgInput.focus();
          }
        }
      );
    } else {
      errorText.textContent = "Name and room are required to join a chat.";
    }
  }

  function createRoom(e) {
    e.preventDefault();
    chatDisplay.innerHTML = "";
    if (nameInput.value && createRoomInput.value) {
      currentRoom = createRoomInput.value;
      socket.emit(
        "createRoom",
        {
          name: nameInput.value,
          room: currentRoom,
        },
        (response) => {
          if (response.error) {
            errorText.textContent = response.error;
          } else {
            selectChatRoom.value = currentRoom;
            enterRoom(e);
          }
        }
      );
    } else {
      errorText.textContent = "Name and room are required to create a chat.";
    }
  }
  // Event listeners for form submissions
  document.querySelector(".form-msg").addEventListener("submit", sendMessage);
  joinRoomBtn.addEventListener("click", enterRoom);
  createRoomBtn.addEventListener("click", createRoom);
  nameInput.addEventListener("input", () => {
    errorText.textContent = "";
  });

  msgInput.addEventListener("keypress", () => {
    socket.emit("activity", nameInput.value);
  });

  function createMessageElement(name, text, time, isCurrentUser, isAdmin) {
    const li = document.createElement("li");
    li.className = `post ${isCurrentUser ? "post--left" : "post--right"}`;
    if (isAdmin) {
      li.innerHTML = `<div class="post__text">${text}</div>`;
    } else {
      li.innerHTML = `
        <div class="post__header ${
          isCurrentUser ? "post__header--user" : "post__header--reply"
        }">
          <span class="post__header--name">${name}</span>
          <span class="post__header--time">${time}</span>
        </div>
        <div class="post__text">${text}</div>`;
    }
    return li;
  }

  socket.on("message", (data) => {
    activity.textContent = "";
    const { name, text, time } = data;
    const isCurrentUser = name === nameInput.value;
    const isAdmin = name === "Admin";
    const messageElement = createMessageElement(
      name,
      text,
      time,
      isCurrentUser,
      isAdmin
    );
    document.querySelector(".chat-display").appendChild(messageElement);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
  });

  // Handle user typing activity
  let activityTimer;
  socket.on("activity", (name) => {
    activity.textContent = `${name} is typing...`;
    clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
      activity.textContent = "";
    }, 1000);
  });
  // Update user list
  socket.on("userList", ({ users }) => {
    showUsers(users);
  });
  // Update room list
  socket.on("roomList", ({ rooms }) => {
    updateRoomList(rooms);
  });
  // Display the list of users in the current room
  function showUsers(users) {
    if (!usersList) {
      console.error("User list element not found in the DOM.");
      return;
    }
    usersList.innerHTML = "";
    if (users) {
      usersList.innerHTML = `<p><strong>Users in room: ${currentRoom} </strong></p>`;
      users.forEach((user) => {
        const li = document.createElement("li");
        li.textContent = user.name;
        usersList.appendChild(li);
      });
    }
  }

  function updateRoomList(rooms) {
    roomList.innerHTML = "";
    selectChatRoom.innerHTML = '<option value="">Select a room</option>';
    rooms.forEach((room) => {
      const option = document.createElement("option");
      option.value = room;
      option.textContent = room;
      selectChatRoom.appendChild(option);
    });
  }
});
