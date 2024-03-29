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

const transportPath = "/xoxo-multiplayer-socketConnectionNamespace"

const AvailablePlayersRoomName = "AvailablePlayersRoom"

interface SocketResponse {
  message: string
  code: number
}

interface AnswerSignal extends RTCSessionDescription {}
interface OfferSignal extends RTCSessionDescription {}

interface CandidateSignal {
  type: 'candidate'
  candidate: RTCIceCandidateInit
}


type AckFn = (resp: SocketResponse) => void

type socketID = string
interface PlayerInfo {
  name: string
  avatar: string
}

const playerNames = new Set<string>()

const socketIDToPlayerInfo = new Map<socketID, PlayerInfo>()

const io = Server(serverConfig.port, {
  path: transportPath
  // pingInterval: 6000,
  // pingTimeout: 5000,
});

function GetAvailablePlayers() {
  const availablePlayersRoom = io.of("/").adapter.rooms[AvailablePlayersRoomName]

  const socketsInAvailablePlayersRoom = availablePlayersRoom ? availablePlayersRoom.sockets : {}
  
  const availablePlayers = Object.entries(socketsInAvailablePlayersRoom).map(([playerSocketID, boolean]) => {
    const {name, avatar} = socketIDToPlayerInfo.get(playerSocketID) as PlayerInfo
    return {
      socketID: playerSocketID, name, avatar, boolean
    }
  })

  return availablePlayers
}

function IsPlayerInAvailableRoom(playerSocketID: string) {
  const result = io.of("/").adapter.rooms[AvailablePlayersRoomName].sockets[playerSocketID]
  return result
}

// We call the default namespace "/" and it’s the one Socket.IO clients connect to by default, and the one the server listens to by default.
// This namespace is identified by `io.sockets` or simply `io`

io.on('connection', (socket) => {
  console.log(`socket ${socket.id} is connected!`)
  function log(msg: string) {
    const logMsg = `Message from server: ${msg}`
    console.log(logMsg)
    socket.emit('log', logMsg)
  }

  socket.on('registerNameAndAvatarWithSocket', (playerName: string, avatar: string, ackFn: AckFn) => {
    const playerInfo: PlayerInfo = {name: playerName, avatar}
    if (playerNames.has(playerName)) {
      const msg = `Could'nt register name "${playerName}" because some other player has the same name. Please choose a different name`
      log(msg)
      ackFn({message: msg, code: 401})
      return
    }
    playerNames.add(playerName)
    socketIDToPlayerInfo.set(socket.id, playerInfo)
    const msg = `Name ${playerName}, and avatar registered with the socket`
    log(msg)
    ackFn({message: msg, code: 200})
  })

  socket.on('signalOfferToRemotePlayer', (offersignal: OfferSignal, remotePlayerSocketID: string) => {
    
    const selfInfo = socketIDToPlayerInfo.get(socket.id) as PlayerInfo

    const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID)

    if (!remotePlayerSocketStillInAvailableRoom) {

      const errorMsg = `Remote player ${socketIDToPlayerInfo.get(socket.id)!.name} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`

      log(errorMsg)

      io.to(socket.id).emit("error", errorMsg)

      io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", GetAvailablePlayers())
      
      return
    }

    const remotePlayerInfo = socketIDToPlayerInfo.get(remotePlayerSocketID) as PlayerInfo

    log(`${selfInfo.name} wants to signal OFFER message to remote player ${remotePlayerInfo!.name} with message: ${JSON.stringify(offersignal)}`);

    io.to(remotePlayerSocketID).emit('offerFromRemotePlayer', offersignal, selfInfo.name, socket.id)
  });

  socket.on('signalCandidateToRemotePlayer', (candidateSignal:  CandidateSignal, remotePlayerSocketID: string) => {
    
    const selfInfo = socketIDToPlayerInfo.get(socket.id) as PlayerInfo

    const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID)

    if (!remotePlayerSocketStillInAvailableRoom) {

      const errorMsg = `Remote player ${socketIDToPlayerInfo.get(socket.id)!.name} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`

      log(errorMsg)

      io.to(socket.id).emit("error", errorMsg)

      io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", GetAvailablePlayers())
      
      return
    }

    const remotePlayerInfo = socketIDToPlayerInfo.get(remotePlayerSocketID) as PlayerInfo
    
    log(`${selfInfo.name} wants to signal CANDIDATE message to remote player ${remotePlayerInfo.name} with message: ${JSON.stringify(candidateSignal)}`);
    
    io.to(remotePlayerSocketID).emit('candidateFromRemotePlayer', candidateSignal, selfInfo.name, socket.id)
  });

  socket.on('sendRejectionResponseToPeers', (peersToRejectConnection: Array<string>, ackFn: AckFn) => {
    const selfInfo =  socketIDToPlayerInfo.get(socket.id) as PlayerInfo

    log(`Received request to send rejection message to the peers ${peersToRejectConnection} from ${selfInfo.name}`)
    
    peersToRejectConnection.forEach(socketID => {
      io.to(socketID).emit("rejectionFromRequestedPlayer", selfInfo.name)
    })
    
    ackFn({message: "Successfully sent the rejection message to the given peers", code: 200})
  })

  socket.on('signalAnswerToRemotePlayer', (answerSignal: AnswerSignal, remotePlayerSocketID: string) => {
    
    const selfInfo = socketIDToPlayerInfo.get(socket.id) as PlayerInfo

    const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID)

    if (!remotePlayerSocketStillInAvailableRoom) {

      const errorMsg = `Remote player ${socketIDToPlayerInfo.get(socket.id)!.name} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`

      log(errorMsg)

      io.to(socket.id).emit("error", errorMsg)

      io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", GetAvailablePlayers())
      
      return
    }

    const remotePlayerInfo = socketIDToPlayerInfo.get(remotePlayerSocketID) as PlayerInfo
    
    log(`${selfInfo.name} wants to signal ANSWER message to remote player ${remotePlayerInfo.name} with message: ${JSON.stringify(answerSignal)}`);
    
    io.to(remotePlayerSocketID).emit('answerFromRemotePlayer', answerSignal, selfInfo.name, socket.id)
  });

  socket.on('exitFromAvailablePlayersRoom', (ackFn: AckFn) => {
    const selfInfo =  socketIDToPlayerInfo.get(socket.id) as PlayerInfo
    log(`Received request to leave AvailablePlayersRoom from ${selfInfo.name}`);

    socket.leave(AvailablePlayersRoomName, (err: Error) => {
      if (err) {
        log(`Trouble in leaving AvailablePlayersRoom : ${err}`)
        ackFn({message: `could not leave AvailablePlayersRoom : ${err}`, code: 500})
        return
      }
      log(`Player ${selfInfo.name} with client ID ${socket.id} exited from the room AvailablePlayersRoom`)

      ackFn({message: "left AvailablePlayersRoom!", code: 200})
      
      const availablePlayers = GetAvailablePlayers()

      log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);
      
      io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", availablePlayers)
    })
  })

  socket.on('joinAvailablePlayersRoom', (ackFn: AckFn) => {
    const selfInfo = socketIDToPlayerInfo.get(socket.id) as PlayerInfo
    log(`Received request to create or join room AvailablePlayersRoom from "${selfInfo.name.toUpperCase()}"`);

    socket.join(AvailablePlayersRoomName, (err) => {
      if (err) {
        log(`Trouble in joining AvailablePlayersRoom : ${err}`)
        ackFn({message: `could not join AvailablePlayersRoom : ${err}`, code: 500})
        return
      }

      const selfInfo = socketIDToPlayerInfo.get(socket.id) as PlayerInfo

      log(`Player ${selfInfo.name} with client ID ${socket.id} joined the room AvailablePlayersRoom`)

      ackFn({message: "joined AvailablePlayersRoom!", code: 200})

      const availablePlayers = GetAvailablePlayers()
      
      log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);
      
      io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", availablePlayers)
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
    const selfInfo = socketIDToPlayerInfo.get(socket.id) as PlayerInfo
    log(`Player ${selfInfo} with client ID ${socket.id} disconnected from the server, reason : ${reason}`)

    socketIDToPlayerInfo.delete(socket.id)

    // playerNames.delete(selfInfo.name)

    const availablePlayers = GetAvailablePlayers()
    
    log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);

    io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", availablePlayers)
  });
});