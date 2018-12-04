import os from 'os';
import Server from 'socket.io'
import config from '../config.json'

let serverConfig : {port: number}

switch (process.env.NODE_ENV) {
  case "PROD":
    console.log("Using NODE_ENV=PROD")
    serverConfig = {port: config.PROD.PORT}
    break;

  case "DEV":
    console.log("Using NODE_ENV=DEV")
    serverConfig = {port: config.DEV.PORT}
    break;

  default:
    throw "INVALID VALUE FOR NODE_ENV. MUST BE EITHER PROD OR DEV";
}

console.log("serverConfig: ", serverConfig)

const io = Server(serverConfig.port, {
  path: "/xoxo-multiplayer-socketConnectionNamespace"
  // pingInterval: 6000,
  // pingTimeout: 5000,
});

const AvailablePlayersRoom = "AvailablePlayersRoom"

interface SocketResponse {
  message: string
  code: number
}

type AckFn = (resp: SocketResponse) => void

let socketToPlayerName: Map<string, string> = new Map()

function GetAvailablePlayers() {
  const socketsDictionary = io.of("/").adapter.rooms[AvailablePlayersRoom]

  const availablePlayersRoomSockets = socketsDictionary ? socketsDictionary.sockets : {}
  
  const availablePlayers = Object.entries(availablePlayersRoomSockets).map(([playerSocketID, boolean]) => ({name: socketToPlayerName.get(playerSocketID), socketID: playerSocketID, boolean}))

  return availablePlayers
}

function IsPlayerInAvailableRoom(playerSocketID: string) {
  const result = io.of("/").adapter.rooms[AvailablePlayersRoom].sockets[playerSocketID]
  return result
}


io.on('connection', (socket) => {

  function log(msg: string) {
    const logMsg = `Message from server: ${msg}`
    console.log(logMsg)
    socket.emit('log', logMsg)
  }

  socket.on('registerNameWithSocket', (playerName: string, ackFn: AckFn) => {
    socketToPlayerName.set(socket.id, playerName)
    const msg = `Name ${playerName} registered with the socket`
    ackFn({message: msg, code: 200})
  })

  socket.on('signalOfferToRemotePlayer', (offerMessage, remotePlayerSocketID) => {
    
    const playerName = socketToPlayerName.get(socket.id)

    const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID)

    if (!remotePlayerSocketStillInAvailableRoom) {

      log(`Remote player ${socketToPlayerName.get(socket.id)} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`)

      io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", GetAvailablePlayers())
      
      return
    }

    log(`${playerName} wants to signal OFFER message to remote player ${socketToPlayerName.get(remotePlayerSocketID)} with message: ${offerMessage}`);

    io.to(remotePlayerSocketID).emit('offerFromRemotePlayer', offerMessage, playerName, socket.id)
  });

  socket.on('signalCandidateToRemotePlayer', (candidateMessage, remotePlayerSocketID) => {
    
    const playerName = socketToPlayerName.get(socket.id)

    const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID)

    if (!remotePlayerSocketStillInAvailableRoom) {

      log(`Remote player ${socketToPlayerName.get(remotePlayerSocketID)} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`)

      io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", GetAvailablePlayers())
      
      return
    }
    
    log(`${playerName} wants to signal CANDIDATE message to remote player ${socketToPlayerName.get(remotePlayerSocketID)} with message: ${candidateMessage}`);
    
    io.to(remotePlayerSocketID).emit('candidateFromRemotePlayer', candidateMessage, playerName, socket.id)
  });

  socket.on('sendRejectionResponseToPeers', (peersToRejectConnection: Array<string>, ackFn: AckFn) => {
    const playerName =  socketToPlayerName.get(socket.id)
    log(`Received request to send rejection message to the peers ${peersToRejectConnection} from ${playerName}`)
    
    peersToRejectConnection.forEach(socketID => {
      io.to(socketID).emit("rejectionFromRequestedPlayer", playerName)
    })
    
    ackFn({message: "Successfully sent the rejection message to the given peers", code: 200})
  })

  socket.on('signalAnswerToRemotePlayer', (answerMessage, remotePlayerSocketID) => {
    
    const playerName = socketToPlayerName.get(socket.id)

    const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID)

    if (!remotePlayerSocketStillInAvailableRoom) {

      log(`Remote player ${socketToPlayerName.get(remotePlayerSocketID)} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`)

      io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", GetAvailablePlayers())
      
      return
    }
    
    log(`${playerName} wants to signal ANSWER message to remote player ${socketToPlayerName.get(remotePlayerSocketID)} with message: ${answerMessage}`);
    
    io.to(remotePlayerSocketID).emit('answerFromRemotePlayer', answerMessage, playerName, socket.id)
  });

  socket.on('exitFromAvailablePlayersRoom', (ackFn: AckFn) => {
    log(`Received request to leave AvailablePlayersRoom from ${socketToPlayerName.get(socket.id)}`);

    socket.leave(AvailablePlayersRoom, (err: Error) => {
      if (err) {
        log(`Trouble in leaving AvailablePlayersRoom : ${err}`)
        ackFn({message: `could not leave AvailablePlayersRoom : ${err}`, code: 500})
        return
      }
      log(`Player ${socketToPlayerName.get(socket.id)} with client ID ${socket.id} exited from the room AvailablePlayersRoom`)

      ackFn({message: "left AvailablePlayersRoom!", code: 200})
      
      const availablePlayers = GetAvailablePlayers()

      log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);
      
      io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", availablePlayers)
    })
  })

  socket.on('joinAvailablePlayersRoom', (ackFn: AckFn) => {
    log('Received request to create or join room AvailablePlayersRoom' + ' from ' + socketToPlayerName.get(socket.id));

    socket.join(AvailablePlayersRoom, (err) => {
      if (err) {
        log(`Trouble in joining AvailablePlayersRoom : ${err}`)
        ackFn({message: `could not join AvailablePlayersRoom : ${err}`, code: 500})
        return
      }

      log(`Player ${socketToPlayerName.get(socket.id)} with client ID ${socket.id} joined the room AvailablePlayersRoom`)

      ackFn({message: "joined AvailablePlayersRoom!", code: 200})

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
    log(`Player ${socketToPlayerName.get(socket.id)} with client ID ${socket.id} disconnected from the server, reason : ${reason}`)

    socketToPlayerName.delete(socket.id)

    const availablePlayers = GetAvailablePlayers()
    
    log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);

    io.to(AvailablePlayersRoom).emit("playersInAvailableRoom", availablePlayers)
  });
});