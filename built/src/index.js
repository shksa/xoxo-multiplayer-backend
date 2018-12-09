"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const os_1 = __importDefault(require("os"));
const socket_io_1 = __importDefault(require("socket.io"));
const config_json_1 = __importDefault(require("../config.json"));
let serverConfig;
switch (process.env.NODE_ENV) {
    case "PROD":
        console.log("Using NODE_ENV=PROD");
        serverConfig = { port: config_json_1.default.PROD.PORT };
        break;
    case "DEV":
        console.log("Using NODE_ENV=DEV");
        serverConfig = { port: config_json_1.default.DEV.PORT };
        break;
    default:
        throw "INVALID VALUE FOR NODE_ENV. MUST BE EITHER PROD OR DEV";
}
console.log("serverConfig: ", serverConfig);
const transportPath = "/xoxo-multiplayer-socketConnectionNamespace";
const AvailablePlayersRoomName = "AvailablePlayersRoom";
let socketIDToPlayerInfo = new Map();
const io = socket_io_1.default(serverConfig.port, {
    path: transportPath
    // pingInterval: 6000,
    // pingTimeout: 5000,
});
function GetAvailablePlayers() {
    const availablePlayersRoom = io.of("/").adapter.rooms[AvailablePlayersRoomName];
    const socketsInAvailablePlayersRoom = availablePlayersRoom ? availablePlayersRoom.sockets : {};
    const availablePlayers = Object.entries(socketsInAvailablePlayersRoom).map(([playerSocketID, boolean]) => {
        const { name, avatar } = socketIDToPlayerInfo.get(playerSocketID);
        return {
            socketID: playerSocketID, name, avatar, boolean
        };
    });
    return availablePlayers;
}
function IsPlayerInAvailableRoom(playerSocketID) {
    const result = io.of("/").adapter.rooms[AvailablePlayersRoomName].sockets[playerSocketID];
    return result;
}
// We call the default namespace "/" and it’s the one Socket.IO clients connect to by default, and the one the server listens to by default.
// This namespace is identified by `io.sockets` or simply `io`
io.on('connection', (socket) => {
    console.log(`socket ${socket.id} is connected!`);
    function log(msg) {
        const logMsg = `Message from server: ${msg}`;
        console.log(logMsg);
        socket.emit('log', logMsg);
    }
    socket.on('registerNameAndAvatarWithSocket', (playerName, avatar, ackFn) => {
        const playerInfo = { name: playerName, avatar };
        socketIDToPlayerInfo.set(socket.id, playerInfo);
        const msg = `Name ${playerName}, and avatar registered with the socket`;
        ackFn({ message: msg, code: 200 });
    });
    socket.on('signalOfferToRemotePlayer', (offersignal, remotePlayerSocketID) => {
        const selfInfo = socketIDToPlayerInfo.get(socket.id);
        const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID);
        if (!remotePlayerSocketStillInAvailableRoom) {
            const errorMsg = `Remote player ${socketIDToPlayerInfo.get(socket.id).name} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`;
            log(errorMsg);
            io.to(socket.id).emit("error", errorMsg);
            io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", GetAvailablePlayers());
            return;
        }
        const remotePlayerInfo = socketIDToPlayerInfo.get(remotePlayerSocketID);
        log(`${selfInfo.name} wants to signal OFFER message to remote player ${remotePlayerInfo.name} with message: ${JSON.stringify(offersignal)}`);
        io.to(remotePlayerSocketID).emit('offerFromRemotePlayer', offersignal, selfInfo.name, socket.id);
    });
    socket.on('signalCandidateToRemotePlayer', (candidateSignal, remotePlayerSocketID) => {
        const selfInfo = socketIDToPlayerInfo.get(socket.id);
        const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID);
        if (!remotePlayerSocketStillInAvailableRoom) {
            const errorMsg = `Remote player ${socketIDToPlayerInfo.get(socket.id).name} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`;
            log(errorMsg);
            io.to(socket.id).emit("error", errorMsg);
            io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", GetAvailablePlayers());
            return;
        }
        const remotePlayerInfo = socketIDToPlayerInfo.get(remotePlayerSocketID);
        log(`${selfInfo.name} wants to signal CANDIDATE message to remote player ${remotePlayerInfo.name} with message: ${JSON.stringify(candidateSignal)}`);
        io.to(remotePlayerSocketID).emit('candidateFromRemotePlayer', candidateSignal, selfInfo.name, socket.id);
    });
    socket.on('sendRejectionResponseToPeers', (peersToRejectConnection, ackFn) => {
        const selfInfo = socketIDToPlayerInfo.get(socket.id);
        log(`Received request to send rejection message to the peers ${peersToRejectConnection} from ${selfInfo.name}`);
        peersToRejectConnection.forEach(socketID => {
            io.to(socketID).emit("rejectionFromRequestedPlayer", selfInfo.name);
        });
        ackFn({ message: "Successfully sent the rejection message to the given peers", code: 200 });
    });
    socket.on('signalAnswerToRemotePlayer', (answerSignal, remotePlayerSocketID) => {
        const selfInfo = socketIDToPlayerInfo.get(socket.id);
        const remotePlayerSocketStillInAvailableRoom = IsPlayerInAvailableRoom(remotePlayerSocketID);
        if (!remotePlayerSocketStillInAvailableRoom) {
            const errorMsg = `Remote player ${socketIDToPlayerInfo.get(socket.id).name} with client ID ${remotePlayerSocketID} not in room AvailablePlayersRoom anymore`;
            log(errorMsg);
            io.to(socket.id).emit("error", errorMsg);
            io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", GetAvailablePlayers());
            return;
        }
        const remotePlayerInfo = socketIDToPlayerInfo.get(remotePlayerSocketID);
        log(`${selfInfo.name} wants to signal ANSWER message to remote player ${remotePlayerInfo.name} with message: ${JSON.stringify(answerSignal)}`);
        io.to(remotePlayerSocketID).emit('answerFromRemotePlayer', answerSignal, selfInfo.name, socket.id);
    });
    socket.on('exitFromAvailablePlayersRoom', (ackFn) => {
        log(`Received request to leave AvailablePlayersRoom from ${socketIDToPlayerInfo.get(socket.id)}`);
        socket.leave(AvailablePlayersRoomName, (err) => {
            if (err) {
                log(`Trouble in leaving AvailablePlayersRoom : ${err}`);
                ackFn({ message: `could not leave AvailablePlayersRoom : ${err}`, code: 500 });
                return;
            }
            log(`Player ${socketIDToPlayerInfo.get(socket.id)} with client ID ${socket.id} exited from the room AvailablePlayersRoom`);
            ackFn({ message: "left AvailablePlayersRoom!", code: 200 });
            const availablePlayers = GetAvailablePlayers();
            log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);
            io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", availablePlayers);
        });
    });
    socket.on('joinAvailablePlayersRoom', (ackFn) => {
        log('Received request to create or join room AvailablePlayersRoom' + ' from ' + socketIDToPlayerInfo.get(socket.id));
        socket.join(AvailablePlayersRoomName, (err) => {
            if (err) {
                log(`Trouble in joining AvailablePlayersRoom : ${err}`);
                ackFn({ message: `could not join AvailablePlayersRoom : ${err}`, code: 500 });
                return;
            }
            const selfInfo = socketIDToPlayerInfo.get(socket.id);
            log(`Player ${selfInfo.name} with client ID ${socket.id} joined the room AvailablePlayersRoom`);
            ackFn({ message: "joined AvailablePlayersRoom!", code: 200 });
            const availablePlayers = GetAvailablePlayers();
            log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);
            io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", availablePlayers);
        });
    });
    socket.on('ipaddr', () => {
        const ifaces = os_1.default.networkInterfaces();
        for (const dev in ifaces) {
            ifaces[dev].forEach((details) => {
                if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                    socket.emit('ipaddr', details.address);
                }
            });
        }
    });
    socket.on('disconnect', (reason) => {
        const selfInfo = socketIDToPlayerInfo.get(socket.id);
        log(`Player ${selfInfo.name} with client ID ${socket.id} disconnected from the server, reason : ${reason}`);
        socketIDToPlayerInfo.delete(socket.id);
        const availablePlayers = GetAvailablePlayers();
        log(`Room AvailablePlayersRoom now has ${availablePlayers.length} player(s)`);
        io.to(AvailablePlayersRoomName).emit("playersInAvailableRoom", availablePlayers);
    });
});
//# sourceMappingURL=index.js.map