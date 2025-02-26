const socket = io();

// Elementos del DOM
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('login-btn');
const usernameInput = document.getElementById('username');
const statusInput = document.getElementById('status');
const usersList = document.getElementById('users-list');
const messagesDiv = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const userInfoDiv = document.getElementById('user-info');
const userAvatarImg = document.getElementById('user-avatar');
const userNameSpan = document.getElementById('user-name');
const chatList = document.getElementById('chat-list');
const imageUpload = document.getElementById('image-upload');

let currentUser;
let currentRoom = 'general';
let chatMessages = {}; // Objeto para almacenar mensajes de cada chat

// Añadir evento de clic al chat público existente
document.querySelector('#chat-list li[data-room="general"]').addEventListener('click', () => switchRoom('general'));

loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const status = statusInput.value.trim();
    const avatar = document.querySelector('input[name="avatar"]:checked').value;

    if (username && status && avatar) {
        currentUser = { username, status, avatar };
        socket.emit('register user', currentUser);
        loginScreen.style.display = 'none';
        chatScreen.style.display = 'flex';
        
        userAvatarImg.src = avatar;
        userNameSpan.textContent = username;
        userInfoDiv.style.display = 'flex';

        createChatRoom('Chat Público', 'general', 'img/chatgrupal.png');
        switchRoom('general');
    }
});

socket.on('update users', (users) => {
    usersList.innerHTML = '';
    chatList.innerHTML = '<li data-room="general" class="active">Chat Público</li>';
    document.querySelector('#chat-list li[data-room="general"]').addEventListener('click', () => switchRoom('general'));
    users.forEach(user => {
        if (user.username !== currentUser.username) {
            const li = document.createElement('li');
            li.textContent = `${user.username} - ${user.status}`;
            li.addEventListener('click', () => createPrivateChat(user));
            usersList.appendChild(li);
            createPrivateChat(user);
        }
    });
});

function createPrivateChat(user) {
    const roomId = generateRoomId(currentUser.username, user.username);
    createChatRoom(user.username, roomId, user.avatar);
}

function generateRoomId(username1, username2) {
    return [username1, username2].sort().join('-');
}

function createChatRoom(username, roomId, avatar) {
    let li = document.querySelector(`#chat-list li[data-room="${roomId}"]`);
    if (!li) {
        li = document.createElement('li');
        li.dataset.room = roomId;
        chatList.appendChild(li);
    }
    li.innerHTML = `<img src="${avatar}" alt="${username}"> ${username}`;
    li.addEventListener('click', () => switchRoom(roomId));
}

function switchRoom(roomId) {
    currentRoom = roomId;
    document.querySelectorAll('#chat-list li').forEach(el => el.classList.remove('active'));
    const roomElement = document.querySelector(`#chat-list li[data-room="${roomId}"]`);
    if (roomElement) {
        roomElement.classList.add('active');
    }
    loadChatMessages(roomId);
    socket.emit('join room', roomId);
}

function loadChatMessages(roomId) {
    messagesDiv.innerHTML = '';
    if (chatMessages[roomId]) {
        chatMessages[roomId].forEach(msg => displayMessage(msg, msg.user));
    }
}

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (messageInput.value || imageUpload.files.length > 0) {
        if (imageUpload.files.length > 0) {
            const file = imageUpload.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = e.target.result;
                socket.emit('chat message', { room: currentRoom, message: img, type: 'image' });
            };
            reader.readAsDataURL(file);
            imageUpload.value = ''; // Limpiar el input de archivo
        }
        if (messageInput.value) {
            const messageData = { room: currentRoom, message: messageInput.value, type: 'text' };
            socket.emit('chat message', messageData);
            messageInput.value = '';
        }
    }
});

socket.on('chat message', (data) => {
    if (!chatMessages[data.room]) {
        chatMessages[data.room] = [];
    }
    chatMessages[data.room].push(data);
    if (data.room === currentRoom) {
        displayMessage(data, data.user);
    }
});

function displayMessage(data, user) {
    const div = document.createElement('div');
    div.className = 'message';
    if (data.type === 'image') {
        div.innerHTML = `<span class="username">${user.username}:</span><br><img src="${data.message}" alt="Imagen compartida" style="max-width: 200px;">`;
    } else {
        div.innerHTML = `<span class="username">${user.username}:</span> ${data.message}`;
    }
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

socket.on('chat history', (data) => {
    chatMessages[data.room] = data.messages;
    if (currentRoom === data.room) {
        loadChatMessages(data.room);
    }
});

let typingTimer;
messageInput.addEventListener('input', () => {
    if (!typingTimer) {
        socket.emit('typing', currentRoom);
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('stop typing', currentRoom);
        typingTimer = null;
    }, 1000);
});

socket.on('user typing', (data) => {
    if (data.room === currentRoom) {
        const typingDiv = document.getElementById(`typing-${data.username}`) || document.createElement('div');
        typingDiv.id = `typing-${data.username}`;
        typingDiv.textContent = `${data.username} está escribiendo...`;
        typingDiv.className = 'system-message typing-indicator';
        messagesDiv.appendChild(typingDiv);
    }
});

socket.on('user stop typing', (data) => {
    if (data.room === currentRoom) {
        const typingDiv = document.getElementById(`typing-${data.username}`);
        if (typingDiv) typingDiv.remove();
    }
});

socket.on('user joined', (msg) => {
    const div = document.createElement('div');
    div.textContent = msg;
    div.className = 'system-message';
    messagesDiv.appendChild(div);
});

socket.on('user left', (msg) => {
    const div = document.createElement('div');
    div.textContent = msg;
    div.className = 'system-message';
    messagesDiv.appendChild(div);
});

socket.on('user disconnected', (username) => {
    removePrivateChat(username);
});

function removePrivateChat(username) {
    const roomId = generateRoomId(currentUser.username, username);
    const chatElement = document.querySelector(`#chat-list li[data-room="${roomId}"]`);
    if (chatElement) {
        chatElement.remove();
    }
    delete chatMessages[roomId];
    if (currentRoom === roomId) {
        switchRoom('general');
    }
}

imageUpload.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Nuevo: manejar la limpieza del chat
socket.on('clear chat', (room) => {
    if (room === currentRoom) {
        messagesDiv.innerHTML = '';
    }
    if (chatMessages[room]) {
        chatMessages[room] = [];
    }
});