/*
serverManager.js

Manages all websocket communication with the server
Also routes incoming server messages accordingly for handling
*/


function ServerManager(brain) {

	var self = this;
	var socket;

	self.init = function() {
		self.createSocket();
	}

	self.createSocket = function() {
		console.log("creating web socket");
		socket = io();
		// Specify the message handlers
		socket.on("connect", self.onConnectionWithServer);
		socket.on("connect_failed", self.onConnectionFailedWithServer);
		socket.on("disconnect", self.onDisonnectionFromServer);
		socket.on("zoomButtonEvent", self.handleZoomButtonEventMessage);
		socket.on("sendMuralTilingParams", self.handleSendMuralTilingParamsMessage);
		socket.on("itte", self.handleImageTileTouchEventMessage);
		socket.on("imageUrlData", self.handleImageUrlDataMessage);
		socket.on("newSnapShotData", self.handleNewSnapShotData);
		socket.on("userInputEvent", self.handleUserInputEventMessage);
	}

	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Fires when connection with the server is established
	self.onConnectionWithServer = function() {
	}

	// Fires when a connection with server failed
	self.onConnectionFailedWithServer = function() {
	}

	// Fires when the socket with the server disconnects
	self.onDisonnectionFromServer = function() {
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// Receive a snapshot message
	self.handleSnapShotMessage = function(message) {
		var id = message["id"];
		var imageUrl = message["imageUrl"];
		// Tell the mural manager about it
		brain.getMuralManager().onSnapShotReceived(id, imageUrl);
	}

	// Receive a mobile client zoom button message
	self.handleZoomButtonEventMessage = function(message) {
		var zoomButtonEvent = message["zoomButtonEvent"];
		// Tell the mural manager about it
		brain.getMuralManager().onZoomButtonEventReceived(zoomButtonEvent);
	}

	// Receive a request to send back the mural tiling params
	self.handleSendMuralTilingParamsMessage = function(message) {
		// Gather the params
		var muralTilingParams = brain.getMuralManager().getWorldManager().getTilingParams();
		var newMessage = {};
		newMessage["muralTilingParams"] = muralTilingParams;
		// Send the params to the server
		self.sendMessageToServer("muralTilingParams", newMessage);
	}

	// Receive a mobile client touch event
	self.handleImageTileTouchEventMessage = function(message) {
		var imageTileTouchEvent = message["itte"];
		// Tell the mural manager about it
		brain.getMuralManager().onImageTileTouchEventReceived(imageTileTouchEvent);
	}

	// Receive the latest image data
	self.handleImageUrlDataMessage = function(message) {
		var imageUrlData = message["imageUrlData"];
		// Tell the mural manager about it
		brain.getMuralManager().onImageUrlDataReceived(imageUrlData);
	}

	// Receive new snapshot data
	self.handleNewSnapShotData = function(message) {
		var newSnapShotData = message["newSnapShotData"];
		// Tell the mural manager about it
		brain.getMuralManager().onNewSnapShotDataReceived(newSnapShotData);
	}

	// Receive a mobile client user input event
	self.handleUserInputEventMessage = function(message) {
		// Tell the mural manager about it
		brain.getMuralManager().onMobileClientUserInputEventReceived();
	}

	// Ask the server to send back the latest image data
	self.sendRequestImageUrlDataMessage = function() {
		var message = {};
		self.sendMessageToServer("sendImageUrlDataToMuralClients", message);
	}

	// Send a message to the server of the given type and content
	self.sendMessageToServer = function(messageType, message) {
		var json = JSON.stringify(message);
		console.log("sending message to server: " + messageType + "  " + json);
		socket.emit(messageType, message);
	}
	
	self.init();
}