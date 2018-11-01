'use strict';

/****************************************************************************
* Initial setup
****************************************************************************/

// var configuration = {
//   'iceServers': [{
//     'urls': 'stun:stun.l.google.com:19302'
//   }]
// };
var localPeerName = prompt("Enter your chat name", "eminem");

document.getElementById("localPeerName").innerText = localPeerName

var configuration = null;

// var roomURL = document.getElementById('url');
var outgoingTextAreaElement = document.getElementById('outgoingText');
var incomingTextAreaElement = document.getElementById('incomingText');
var remotePeerNameParaElement = document.getElementById('remotePeerName');
var sendBtn = document.getElementById('send');

// Attach event handlers
sendBtn.addEventListener('click', sendText);

// Disable send buttons by default.
sendBtn.disabled = true;

// Create a random room if not already present in the URL and put that room as the hash value in the current URL.
var isInitiator;
var room = window.location.hash.substring(1); // location.hash returns "#xyz" <- with the hash symbol, therefore substring()
if (!room) { // room is either xyz or "" (bcoz, hash will be "", and "".substring(1) is still be "")
  room = window.location.hash = randomToken(); // No need of the "#" symbol when setting the hash.
}

document.getElementById("room").innerText = room

// Now variable "room" will store the name of the room.

/****************************************************************************
* Signaling server
****************************************************************************/


var socket = io.connect();

(function registerToSocketEvents() {
  socket.on('ipaddr', (ipaddr) => {
    console.log('Server IP address is: ' + ipaddr);
    // updateRoomURL(ipaddr);
  });
  
  socket.on('created', (room, clientId) => {
    console.log('Created room', room, '- my client ID is', clientId);
    isInitiator = true;
  });
  
  socket.on('joined', (room, clientId) => {
    console.log('This peer has joined room', room, 'with client ID', clientId);
    isInitiator = false;
    createPeerConnection(isInitiator, configuration);
  });
  
  socket.on('full', (room) => {
    alert('Room ' + room + ' is full. We will create a new room for you.');
    window.location.hash = '';
    window.location.reload();
  });
  
  socket.on('ready', () => {
    console.log('Socket is ready');
    createPeerConnection(isInitiator, configuration);
  });
  
  socket.on('log', (msg) => { console.log(msg) })
  
  socket.on('signaling2Client4mServer', (message, peerName) => {
    console.log(`${peerName} has signalled the message ${message}`)
    console.log(`${localPeerName} received the message: ${message}`);
    remotePeerNameParaElement.innerText = peerName
    signalingMessageCallback(message);
  });
})()

// Joining a room.
socket.emit('create or join', room, localPeerName);

if (location.hostname.match(/localhost|127\.0\.0/)) {
  socket.emit('ipaddr');
}

// Leaving rooms and disconnecting from peers.
(function registeringToMoreSocketEvents() {
  socket.on('disconnect', (reason) => {
    console.log(`Disconnected from signaling Node server: ${reason}.`);
    sendBtn.disabled = true;
  });
  
  socket.on('leftRoom', (msg) => {
    console.log(msg);
    sendBtn.disabled = true;
    // If peer did not create the room, re-enter to be creator.
    if (!isInitiator) {
      window.location.reload();
    }
  })
  
  window.addEventListener('unload', () => {
    console.log(`Unloading window. Notifying peers in ${room}.`);
    socket.emit('leaveRoom');
  });
})()

//Send message to signaling server
function sendMessageToSignalingServer(message) {
  console.log(`${localPeerName} signalling the message: ${message}`);
  socket.emit('signaling2Server4mClient', message);
}

/**
* Updates URL on the page so that users can copy&paste it to their peers.
*/
// function updateRoomURL(ipaddr) {
//   var url;
//   if (!ipaddr) {
//     url = location.href;
//   } else {
//     url = location.protocol + '//' + ipaddr + ':2013/#' + room;
//   }
//   roomURL.innerHTML = url;
// }


/****************************************************************************
* WebRTC peer connection and data channel
****************************************************************************/

var peerConn;
var dataChannel;

function signalingMessageCallback(message) {
  if (message.type === 'offer') {
    console.log('Got offer. Sending answer to peer.');
    peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
                                  logError);
    peerConn.createAnswer(onLocalSessionCreated, logError);

  } else if (message.type === 'answer') {
    console.log('Got answer.');
    peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
                                  logError);

  } else if (message.type === 'candidate') {
    peerConn.addIceCandidate(new RTCIceCandidate({
      candidate: message.candidate
    }));

  }
}

function createPeerConnection(isInitiator, config) {
  console.log('Creating Peer connection as initiator?', isInitiator, 'config:',
              config);
  peerConn = new RTCPeerConnection(config);

  // send any ice candidates to the other peer
  peerConn.onicecandidate = function(event) {
    console.log('icecandidate event:', event);
    if (event.candidate) {
      sendMessageToSignalingServer({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } else {
      console.log('End of candidates.');
    }
  };

  if (isInitiator) {
    console.log('Creating Data Channel');
    dataChannel = peerConn.createDataChannel('textMessages');
    onDataChannelCreated(dataChannel);

    console.log('Creating an offer');
    peerConn.createOffer(onLocalSessionCreated, logError);
  } else {
    peerConn.ondatachannel = function(event) {
      console.log('ondatachannel:', event.channel);
      dataChannel = event.channel;
      onDataChannelCreated(dataChannel);
    };
  }
}

function onLocalSessionCreated(desc) {
  console.log('local session created:', desc);
  peerConn.setLocalDescription(desc, function() {
    console.log('sending local desc:', peerConn.localDescription);
    sendMessageToSignalingServer(peerConn.localDescription);
  }, logError);
}

function onDataChannelCreated(channel) {
  console.log('onDataChannelCreated:', channel);

  channel.onopen = function() {
    console.log('CHANNEL opened!!!');
    sendBtn.disabled = false;
  };

  channel.onclose = function () {
    console.log('Channel closed.');
    sendBtn.disabled = true;
  }

  channel.onmessage = displayIncomingText
}

/****************************************************************************
* Aux functions, mostly UI-related
****************************************************************************/

function sendText() {
  const message = outgoingTextAreaElement.value
  dataChannel.send(message);
}

function displayIncomingText(event) {
  console.log('Received Message')
  incomingTextAreaElement.value = event.data
}

function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

function logError(err) {
  if (!err) return;
  if (typeof err === 'string') {
    console.warn(err);
  } else {
    console.warn(err.toString(), err);
  }
}