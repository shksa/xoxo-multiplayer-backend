const os = require('os');
const io = require('socket.io')(8000, {
  pingInterval: 6000,
  pingTimeout: 5000,
});

const AvailablePlayersRoom = "AvailablePlayersRoom"

/**
 * A map-like object that maps arbitrary `string` properties to `string`s.
 * @type {Object<string, string>}
 */
let socketToPlayerName

function GetAvailablePlayers() {
  const socketsDictionary = io.of("/").adapter.rooms[AvailablePlayersRoom]

  const availablePlayersRoomSockets = socketsDictionary ? socketsDictionary.sockets : {}
  
  const availablePlayers = Object.entries(availablePlayersRoomSockets).map(([playerSocketID, boolean]) => ({name: socketToPlayerName[playerSocketID], socketID: playerSocketID, boolean}))

  return availablePlayers
}

/**
 * @param {string} playerSocketID // writing type of return value is necessary
 */
function IsPlayerInAvailableRoom(playerSocketID) {
  const result = io.of("/").adapter.rooms[AvailablePlayersRoom].sockets[playerSocketID]
  return result
}


io.on('connection', (socket) => {

  /**
   * @param {string} msg 
   */
  function log(msg) {
    const logMsg = `Message from server: ${msg}`
    console.log(logMsg)
    socket.emit('log', logMsg)
  }

  socket.on('registerNameWithSocket', /** @param {string} playerName * @param {Function} ackFn */
  (playerName, ackFn) => {

    socketToPlayerName[socket.id] = playerName

    const msg = `Name ${playerName} registered with the socket`
    
    ackFn(msg)
  })

  socket.on('signalOfferToRemotePlayer', /** @param {object} offerMessage * @param {string} remotePlayerSocketID */
    (offerMessage, remotePlayerSocketID) => {
    
    const playerName = socketToPlayerName[socket.id]

    const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID)

    if (!remotePlayerSocketStillInAvailableRoom) {

      log(`Remote player ${socketToPlayerName[remotePlayerSocketID]} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`)

      io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", GetAvailablePlayers())
      
      return
    }

    log(`${playerName} wants to signal OFFER message to remote player ${socketToPlayerName[remotePlayerSocketID]} with message: ${offerMessage}`);

    io.to(remotePlayerSocketID).emit('offerFromRemotePlayer', offerMessage, playerName, socket.id)
  });

  socket.on('signalCandidateToRemotePlayer', /** @param {object} candidateMessage * @param {string} remotePlayerSocketID */
  (candidateMessage, remotePlayerSocketID) => {
    
    const playerName = socketToPlayerName[socket.id]

    const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID)

    if (!remotePlayerSocketStillInAvailableRoom) {

      log(`Remote player ${socketToPlayerName[remotePlayerSocketID]} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`)

      io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", GetAvailablePlayers())
      
      return
    }
    
    log(`${playerName} wants to signal CANDIDATE message to remote player ${socketToPlayerName[remotePlayerSocketID]} with message: ${candidateMessage}`);
    
    io.to(remotePlayerSocketID).emit('candidateFromRemotePlayer', candidateMessage)
  });

  socket.on('signalAnswerToRemotePlayer', /** @param {object} answerMessage * @param {string} remotePlayerSocketID */
  (answerMessage, remotePlayerSocketID) => {
    
    const playerName = socketToPlayerName[socket.id]

    const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID)

    if (!remotePlayerSocketStillInAvailableRoom) {

      log(`Remote player ${socketToPlayerName[remotePlayerSocketID]} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`)

      io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", GetAvailablePlayers())
      
      return
    }
    
    log(`${playerName} wants to signal ANSWER message to remote player ${socketToPlayerName[remotePlayerSocketID]} with message: ${answerMessage}`);
    
    io.to(remotePlayerSocketID).emit('answerFromRemotePlayer', answerMessage)
  });

  socket.on('exitFromAvailablePlayersRoom', /** @param {Function} ackFn */ 
  (ackFn) => {
    log(`Received request to leave AvailablePlayersRoom from ${socketToPlayerName[socket.id]}`);

    socket.leave(AvailablePlayersRoom, /** @param {Error} err */ (err) => {
      if (err) {
        log(`Trouble in leaving AvailablePlayersRoom : ${err}`)
        ackFn(`could not leave AvailablePlayersRoom : ${err}`)
        return
      }
      log(`Player ${socketToPlayerName[socket.id]} with client ID ${socket.id} exited from the room AvailablePlayersRoom`)

      ackFn("left AvailablePlayersRoom!")
      
      const availablePlayers = GetAvailablePlayers()

      log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);
      
      io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", availablePlayers)
    })
  })

  socket.on('joinAvailablePlayersRoom', /** @param {Function} ackFn */
  (ackFn) => {
    log('Received request to create or join room AvailablePlayersRoom' + ' from ' + socketToPlayerName[socket.id]);

    socket.join(AvailablePlayersRoom, /** @param {Error} err */ (err) => {
      if (err) {
        log(`Trouble in joining AvailablePlayersRoom : ${err}`)
        ackFn(`could not join AvailablePlayersRoom : ${err}`)
        return
      }

      log(`Player ${socketToPlayerName[socket.id]} with client ID ${socket.id} joined the room AvailablePlayersRoom`)

      ackFn("joined AvailablePlayersRoom!")

      const availablePlayers = GetAvailablePlayers()
      
      log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);
      
      io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", availablePlayers)
    })
  })

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
    log(`Player ${socketToPlayerName[socket.id]} with client ID ${socket.id} disconnected from the server, reason : ${reason}`)

    delete socketToPlayerName[socket.id]

    const availablePlayers = GetAvailablePlayers()
    
    log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);

    io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", availablePlayers)
  });
});