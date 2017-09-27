/*
serverManager.js

Manages all websocket communication with the server
Also routes incoming server messages accordingly for handling
*/

function ServerManager(brain) {

	var self = this;
	var socket;

	self.init = function() {
		socket = io();
		// specify message handlers
		socket.on("connect", self.onConnectionWithServer);
		socket.on("connect_failed", self.onConnectionFailedWithServer);
		socket.on("disconnect", self.onDisonnectionFromServer);
		socket.on("imageSaved", self.handleImageSavedMesage);
		socket.on("muralTilingParams", self.handleMuralTilingParamsMessage);
		socket.on("imageUrlData", self.handleImageUrlDataMessage);
		socket.on("newSnapShotData", self.handleNewSnapShotDataMessage);
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

	// Receive message indicating whether the recent snapshot was saved
	self.handleImageSavedMesage = function(message) {
		console.log("handleImageSavedMesage", message);
		var wasSuccessful = message["wasSuccessful"];
		// Tell the camera about it
		brain.getCameraInterface().onImageSavedMessageReceived(wasSuccessful);
	}

	// Receive a message containing the mural parameters
	self.handleMuralTilingParamsMessage = function(message) {
		console.log("handleMuralTilingParams", message);
		var muralTilingParams = message["muralTilingParams"];
		// Tell the touch pad about it
		brain.getTouchPadInterface().onMuralTilingParamsReceived(muralTilingParams);
	}

	// Receive a message containing the latest mural images
	self.handleImageUrlDataMessage = function(message) {
		console.log("handleImageUrlDataMessage");
		var imageUrlData = message["imageUrlData"];
		// Tell the touch pad about it
		brain.getTouchPadInterface().onImageUrlDataReceived(imageUrlData);
	}

	// Receive a message with the latest snap shot data
	self.handleNewSnapShotDataMessage = function(message) {
		console.log("handleNewSnapShotDataMessage");
		var newSnapShotData = message["newSnapShotData"];
		// Tell the touch pad about it
		brain.getTouchPadInterface().onNewSnapShotDataReceived(newSnapShotData);
	}

	// Send a just taken snapshot to the server
	self.sendSnapShotToServer = function(base64ImageString) {
		var id = new Date().toISOString();
		var message = {
			"snapShot": base64ImageString, 
			"id": id
		};
		self.sendMessageToServer("snapShot", message);
	}

	// Send a test snapshot to the server
	self.sendTestSnapShotToServer = function(base64ImageString) {
		var id = "foo";
		var message = {
			"testSnapShot": base64ImageString, 
			"id": id
		};
		self.sendMessageToServer("testSnapShot", message);
	}

	// Send a touch pad zoom event to the server
	self.sendZoomButtonEvent = function(zoomButtonEvent) {
		var message = {
			"zoomButtonEvent": zoomButtonEvent, 
		};
		self.sendMessageToServer("zoomButtonEvent", message);	
	}

	// Send a touch pad image tile touch event to the server
	self.sendImageTileTouchEventToServer = function(imageTileTouchEvent) {
		var message = {
			"itte": imageTileTouchEvent
		};
		self.sendMessageToServer("itte", message);
	}

	// Send a message to the server requesting the mural tiling params
	self.sendMuralTilingParamsRequestToServer = function() {
		var message = {};
		self.sendMessageToServer("sendMuralTilingParams", message);
	}

	// Send a message to the server requesting the latest image data
	self.sendImageUrlDataRequestToServer = function() {
		var message = {};
		self.sendMessageToServer("sendImageUrlDataToMobileClients", message);
	}

	// Tell the server about a recent user input event
	self.sendUserInputEventToServer = function() {
		var message = {};
		self.sendMessageToServer("userInputEvent", message);
	}

	// Send a message to the server of the given type and content
	self.sendMessageToServer = function(messageType, message) {
		var json = JSON.stringify(message);
		console.log("sending message to server: " + messageType + "  " + json);
		socket.emit(messageType, message);
	}

	self.init();
}
