const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;
const { Server } = require('socket.io');
const { createServer } = require('node:http');
const server = createServer(app);
const io = new Server(server);

let users = {};
let chatRooms = { 'general': [] }; // Almaceno los mensajes por sala
let roomUsers = { 'general': new Set() }; // Rastreo usuarios por sala

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
    console.log("Página inicial se ha iniciado.");
});

app.use(express.static(path.join(__dirname, '../public')));

io.on('connection', (socket) => {
    console.log('Nuevo usuario conectado.');

    socket.on('register user', (userData) => {
        users[socket.id] = userData;
        io.emit('update users', Object.values(users));
        socket.join('general');
        if (!roomUsers['general']) {
            roomUsers['general'] = new Set();
        }
        roomUsers['general'].add(userData.username);
        socket.emit('chat history', { room: 'general', messages: chatRooms['general'] });
        io.to('general').emit('user joined', `${userData.username} se ha unido al chat.`);
        console.log(`Usuario registrado: ${userData.username}`);
    });

    socket.on('join room', (room) => {
        socket.join(room);
        if (!chatRooms[room]) {
            chatRooms[room] = [];
        }
        if (!roomUsers[room]) {
            roomUsers[room] = new Set();
        }
        roomUsers[room].add(users[socket.id].username);
        socket.emit('chat history', { room, messages: chatRooms[room] });
        console.log(`Usuario ${users[socket.id].username} se unió a la sala ${room}`);
    });

    socket.on('chat message', (data) => {
        if (users[socket.id]) {
            const messageData = { 
                user: users[socket.id], 
                message: data.message, 
                room: data.room,
                type: data.type || 'text'
            };
            chatRooms[data.room].push(messageData);
            io.to(data.room).emit('chat message', messageData);
        }
    });

    socket.on('typing', (room) => {
        if (users[socket.id]) {
            socket.to(room).emit('user typing', { username: users[socket.id].username, room });
        }
    });

    socket.on('stop typing', (room) => {
        if (users[socket.id]) {
            socket.to(room).emit('user stop typing', { username: users[socket.id].username, room });
        }
    });

    socket.on('disconnect', () => {
        if (users[socket.id]) {
            const disconnectedUser = users[socket.id];
            io.emit('user left', `${disconnectedUser.username} ha salido del chat.`);
            io.emit('user disconnected', disconnectedUser.username);
            console.log(`Usuario desconectado: ${disconnectedUser.username}`);
            delete users[socket.id];
            io.emit('update users', Object.values(users));
            removeUserFromRooms(disconnectedUser.username);
            
            // Verificar si la sala general está vacía y limpiarla si es necesario
            if (roomUsers['general'].size === 0) {
                chatRooms['general'] = [];
                io.emit('clear chat', 'general');
            }
        }
    });
});

function removeUserFromRooms(username) {
    for (let room in chatRooms) {
        if (room !== 'general') {
            if (room.includes(username)) {
                delete chatRooms[room];
                if (roomUsers[room]) {
                    roomUsers[room].delete(username);
                }
            }
        } else {
            roomUsers[room].delete(username);
            if (roomUsers[room].size === 0) {
                chatRooms[room] = [];
            }
        }
    }
}

server.listen(port, () => {
    console.log(`Aplicación escuchando en el puerto ${port}`);
});

/*const express = require('express');
const path = require('path');
const app = express();
const port = 3000;
const { Server } = require('socket.io');
const { createServer } = require('node:http');
const server = createServer(app);
const io = new Server(server);

let users = {};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
  console.log("Página inicial se ha iniciado.");
});

app.use(express.static(path.join(__dirname, '../public')));

io.on('connection', (socket) => {
  console.log('Nuevo usuario conectado.');

  socket.on('register user', (userData) => {
    users[socket.id] = userData;
    io.emit('update users', Object.values(users));
    console.log(`Usuario registrado: ${userData.username}`);
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      console.log(`Usuario desconectado: ${users[socket.id].username}`);
      delete users[socket.id];
      io.emit('update users', Object.values(users));
    }
  });
});

server.listen(port, () => {
  console.log(`Aplicación escuchando en el puerto ${port}`);
});*/