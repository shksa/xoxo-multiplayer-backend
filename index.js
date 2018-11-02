'use strict';

const os = require('os');
// var http = require('http');
const Server = require('socket.io');
const io = new Server(8000)

// An alias for the default (/) namespace.
io.sockets.on('connection', (socket) => {
  // convenience function to log server messages on the client
  const log = (msg) => {
    console.log(`Message from server: ${msg}`)
    socket.emit('log', `Message from server: ${msg}`)
  }

  socket.on('signaling2Server4mClient', (message) => {
    const {peerName, room} = socket
    log(`${peerName} said ${message}`);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.to(room).emit('signaling2Client4mServer', message, peerName);
  });

  socket.on('create or join', (room, peerName) => {
    log('Received request to create or join room ' + room + ' from ' + peerName);

    const clientsInRoom = io.sockets.adapter.rooms[room];
    const numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log(`Room ${room} now has ${numClients} client(s)`);

    if (numClients === 0) {
      socket.join(room, (err) => {
        if (err) {
          console.log("Trouble in joining room ", err)
          return
        }
        socket["room"] = room
        socket["peerName"] = peerName
        log(`PeerName ${peerName} with Client ID ${socket.id} CREATED the room ${room}`);
        socket.emit('created', room, socket.id);
      });
    } else if (numClients === 1) {
      log(`PeerName ${peerName} with Client ID ${socket.id} JOINED the room ${room}`);
      socket.join(room, (err) => {
        if (err) {
          console.log("Trouble in joining room ", err)
          return
        }
        socket["room"] = room
        socket["peerName"] = peerName
        socket.emit('joined', room, socket.id);
        socket.broadcast.to(room).emit('ready', room);
      });
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', () => {
    const ifaces = os.networkInterfaces();
    for (const dev in ifaces) {
      ifaces[dev].forEach((details) => {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('shareMyName', () => {
    const {peerName, room} = socket
    socket.broadcast.to(room).emit('remotePeerName', peerName);
  })

  socket.on('disconnect', (reason) => {
    const {peerName, room} = socket
    const msg = `Peer ${peerName} is disconnected. Reason: ${reason}.`
    console.log(msg);
    socket.broadcast.to(room).emit('leftRoom', msg);
  });

  socket.on('leaveRoom', () => {
    const {peerName, room} = socket
    const msg = `Peer ${peerName} has left the room ${room}.`
    socket.leave(room, (err) => {
      if (err) {
        console.log("Trouble in leaving room ", err)
        return
      }
      console.log(msg);
      socket.emit('leftRoom', msg)
      io.sockets.in(room).emit('remotePeerLeftRoom', msg);
    })
  });
});