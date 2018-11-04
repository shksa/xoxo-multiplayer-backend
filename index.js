'use strict';

const os = require('os');
const io = require('socket.io')(8000, {
  pingInterval: 6000,
  pingTimeout: 5000,
});

// An alias for the default (/) namespace.
io.sockets.on('connection', (socket) => {

  // convenience function to log server messages on the client
  const log = (...msgs) => {
    console.log('Message from server:', ...msgs)
    socket.emit('log', 'Message from server:', ...msgs)
  }

  socket.on('registerNameWithSocket', (playerName, ackFn) => {
    socket["playerName"] = playerName
    const msg = `Name ${playerName} registered with the socket`
    ackFn(msg)
  })

  socket.on('signalOfferToRemotePlayer', (offerMessage, remotePlayerSocketID) => {
    const {playerName} = socket

    log(`${playerName} wants to signal OFFER message to remote player ${io.sockets.to("AvailablePlayersRoom").sockets[remotePlayerSocketID].playerName} with message:`, offerMessage);

    socket.broadcast.to(remotePlayerSocketID).emit('offerFromRemotePlayer', offerMessage, playerName, socket.id)
  });

  socket.on('signalCandidateToRemotePlayer', (candidateMessage, remotePlayerSocketID) => {
    const {playerName} = socket
    
    log(`${playerName} wants to signal CANDIDATE message to remote player ${io.sockets.to("AvailablePlayersRoom").sockets[remotePlayerSocketID].playerName} with message:`, candidateMessage);
    
    socket.broadcast.to(remotePlayerSocketID).emit('candidateFromRemotePlayer', candidateMessage)
  });

  socket.on('signalAnswerToRemotePlayer', (answerMessage, remotePlayerSocketID) => {
    const {playerName} = socket
    
    log(`${playerName} wants to signal ANSWER message to remote player ${io.sockets.to("AvailablePlayersRoom").sockets[remotePlayerSocketID].playerName} with message:`, answerMessage);
    
    socket.broadcast.to(remotePlayerSocketID).emit('answerFromRemotePlayer', answerMessage)
  });

  socket.on('exitFromAvailablePlayersRoom', (ackFn) => {
    log('Received request to leave "AvailablePlayersRoom"' + ' from ' + socket.playerName);

    io.sockets.adapter.del(socket.id, "AvailablePlayersRoom", (err) => {
      if (err) {
        console.error("Trouble in leaving 'AvailablePlayersRoom' ", err)
        return
      }
      ackFn("left!")

      const socketsDictionary = io.sockets.adapter.rooms["AvailablePlayersRoom"]

      const availablePlayersRoomSockets = socketsDictionary ? socketsDictionary.sockets : {}
      
      const availablePlayers = Object.entries(availablePlayersRoomSockets).map(([playerSocketID, boolean]) => ({name: io.sockets.sockets[playerSocketID].playerName, socketID: playerSocketID, boolean}))
      
      log(`Room "AvailablePlayersRoom" now has ${availablePlayers.length} player(s)`);
      
      log(`Player ${socket.playerName} with client ID ${socket.id} exited from the room "AvailablePlayersRoom"`)
      
      io.sockets.in("AvailablePlayersRoom").emit("playersInAvailableRoom", availablePlayers)
    })
  })

  socket.on('joinAvailablePlayersRoom', (ackFn) => {
    log('Received request to create or join room "AvailablePlayersRoom"' + ' from ' + socket.playerName);

    io.sockets.adapter.add(socket.id, "AvailablePlayersRoom", (err) => {
      if (err) {
        console.error("Trouble in joining 'AvailablePlayersRoom' ", err)
        ackFn(`could not join due to error: ${err.toString()}`)
        return
      }
      ackFn("joined!")

      const availablePlayersRoomSockets = io.sockets.adapter.rooms["AvailablePlayersRoom"].sockets
      
      const availablePlayers = Object.entries(availablePlayersRoomSockets).map(([playerSocketID, boolean]) => ({name: io.sockets.sockets[playerSocketID].playerName, socketID: playerSocketID, boolean}))
      
      log(`Room "AvailablePlayersRoom" now has ${availablePlayers.length} player(s)`);
      
      log(`Player ${socket.playerName} with client ID ${socket.id} joined the room "AvailablePlayersRoom"`)
      
      io.sockets.in("AvailablePlayersRoom").emit("playersInAvailableRoom", availablePlayers)
    })
  })

  socket.on('create or join', (room, peerName) => {
    log('Received request to create or join room ' + room + ' from ' + peerName);

    const clientsInRoom = io.sockets.adapter.rooms[room];
    const numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log(`Room ${room} now has ${numClients} client(s)`);

    if (numClients === 0) {
      socket.join(room, (err) => {
        if (err) {
          console.error("Trouble in joining room ", err)
          return
        }
        socket["room"] = room
        socket["peerName"] = peerName
        log(`PeerName ${peerName} with client ID ${socket.id} CREATED the room ${room}`);
        socket.emit('created', room, socket.id);
      });
    } else if (numClients === 1) {
      log(`PeerName ${peerName} with client ID ${socket.id} JOINED the room ${room}`);
      socket.join(room, (err) => {
        if (err) {
          console.error("Trouble in joining room ", err)
          return
        }
        socket["room"] = room
        socket["peerName"] = peerName
        socket.emit('joined', room, socket.id);
        socket.broadcast.to(room).emit('remotePeerJoinedRoom', room);
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

  socket.on('disconnect', (reason) => {
    const msg = `player ${socket.playerName} is disconnected. Reason: ${reason}.`
    console.log(msg);

    const socketsDictionary = io.sockets.adapter.rooms["AvailablePlayersRoom"]

    const availablePlayersRoomSockets = socketsDictionary ? socketsDictionary.sockets : {}
    
    const availablePlayers = Object.entries(availablePlayersRoomSockets).map(([playerSocketID, boolean]) => ({name: io.sockets.sockets[playerSocketID].playerName, socketID: playerSocketID, boolean}))
    
    log(`Room "AvailablePlayersRoom" now has ${availablePlayers.length} player(s)`);
    
    log(`Player ${socket.playerName} with client ID ${socket.id} exited from the room "AvailablePlayersRoom"`)
    
    io.sockets.in("AvailablePlayersRoom").emit("playersInAvailableRoom", availablePlayers)
  });
});