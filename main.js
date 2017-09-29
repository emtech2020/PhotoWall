/*
main.js

Main entry point for the server application
Manages image storage and manipulation
Also manages communication with all clients
and sending messages between them
*/


// Top-level manager that creates the singletons
// who perform the core logic for the server
function Brain() {

	var self = this;
	var imageManager;
	var serverManager;

	self.init = function() {
		imageManager = new ImageManager(self);
		serverManager = new ServerManager(self);
	}

	self.getImageManager = function() { return imageManager; }
	self.getServerManager = function() { return serverManager; }

	self.init();
}


// Manages saving images, resizing,
// and gathering image data for clients
function ImageManager(brain) {

	var self = this;
	var fs;
	var path;
	var gm;
	var ORIG_SNAPSHOT_FOLDER_NAME = "snapShots/snapShots_orig";
	var ORIG_SNAPSHOT_LOCAL_FOLDER_PATH = "./public/" + ORIG_SNAPSHOT_FOLDER_NAME + "/";
	var FULL_SNAPSHOT_SIZE = 512;
	var FULL_SNAPSHOT_FOLDER_NAME = "snapShots/snapShots_full";
	var FULL_SNAPSHOT_LOCAL_FOLDER_PATH = "./public/" + FULL_SNAPSHOT_FOLDER_NAME + "/";
	var SMALL_SNAPSHOT_SIZE = 96;
	var SMALL_SNAPSHOT_FOLDER_NAME = "snapShots/snapShots_small";
	var SMALL_SNAPSHOT_LOCAL_FOLDER_PATH = "./public/" + SMALL_SNAPSHOT_FOLDER_NAME + "/";
	var TINY_SNAPSHOT_SIZE = 32;
	var TINY_SNAPSHOT_FOLDER_NAME = "snapShots/snapShots_tiny";
	var TINY_SNAPSHOT_LOCAL_FOLDER_PATH = "./public/" + TINY_SNAPSHOT_FOLDER_NAME + "/";
	var TEST_SNAPSHOT_LOCAL_FOLDER_PATH = "./public/testSnapShots/"
	var MAX_NUM_IMAGES_TO_SEND_TO_CLIENTS = 11 * 20; // 11 max rows and 20 columns (on mural)
	var AM_DEBUGGING = false;//true;

	self.init = function() {
		fs = require("fs");
		path = require("path");
		// use imageMagick instead of graphicsMagick here (graphicsMagick complains about missing binaries)
		gm = require('gm').subClass({imageMagick: true}); 
	}


	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Fires when the full size save images have been
	// collected for the mural clients
	self.onFullSavedImageFileNamesFoundForMuralClients = function(err, files) {
		console.log("onFullSavedImageFileNamesFoundForMuralClient");
		var savedImageFiles;
		if (AM_DEBUGGING == false) {
			savedImageFiles = self.gatherSavedImages(files);	
		} else {
			savedImageFiles = self.gatherDebugSavedImages(files);
		}
		// Build out the URLs for the given image files
		var imageUrlData = self.createImageUrlData(savedImageFiles);
		// Send the data to the mural clients
		brain.getServerManager().sendImageUrlDataToMuralClients(imageUrlData);
	}

	// Fires when the full size save images have been
	// collected for the mural clients
	self.onFullSavedImageFileNamesFoundForMobileClients = function(err, files) {
		var savedImageFiles;
		if (AM_DEBUGGING == false) {
			savedImageFiles = self.gatherSavedImages(files);	
		} else {
			savedImageFiles = self.gatherDebugSavedImages(files);
		}
		// Build out the URLs for the given image files
		var imageUrlData = self.createImageUrlData(savedImageFiles);
		// Send the data to the mural clients
		brain.getServerManager().sendImageUrlDataToMobileClients(imageUrlData);
	}

	// Fires when a snap shot with the given id has been saved to disk
	self.onSnapShotSaved = function(imageId) {
		// Inform the mobile clients that the image was saved
		brain.getServerManager().sendImageSavedMessageToMobileClients(true);
		// Build the image data to send to the clients
		var imageFileName = imageId + ".jpg";
		var snapShotData = {};
		snapShotData["imageFileName"] = imageFileName;
		snapShotData["fullFolderName"] = "/" + FULL_SNAPSHOT_FOLDER_NAME;
		snapShotData["smallFolderName"] = "/" + SMALL_SNAPSHOT_FOLDER_NAME;
		snapShotData["tinyFolderName"] = "/" + TINY_SNAPSHOT_FOLDER_NAME;
		// Send the data to the clients
		brain.getServerManager().sendNewSnapShotDataToMuralClients(snapShotData);
		brain.getServerManager().sendNewSnapShotDataToMobileClients(snapShotData);
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// Collect images to use for debugging purposes
	self.gatherDebugSavedImages = function(files) {
		// Pick a random saved image
		var randIndex = Math.floor(Math.random()*files.length);
		var debugFile = files[randIndex];
		// Populate the image grid with that image
		var savedImageFiles = [];
		var numImagesToReturn = 220;
		for (var i=0; i<numImagesToReturn; i++) {
			savedImageFiles.push(debugFile);
		}
		return savedImageFiles;
	}

	// Collect the latest saved images
	// But only consider a maximum amount
	// which is the size of the grid
	self.gatherSavedImages = function(files) {
		var savedImageFiles = [];
		// Start at the end of the list (the newest files first)
		for (var i=(files.length-1); i>=0; i--) {
			var file = files[i];
			if (path.extname(file) == ".jpg") {
				if (savedImageFiles.length < MAX_NUM_IMAGES_TO_SEND_TO_CLIENTS) {
					savedImageFiles.push(file);
				}
			}
		}
		savedImageFiles.reverse();
		return savedImageFiles;
	}

	// Save the given test snap shot and assign it the given id
	// The image is passed as a base64 image
	// and then saved to file a a jpeg
	// This method is used for debugging
	self.saveTestSnapShot = function(testSnapShot, imageId) {
		console.log("saveTestSnapShot");
		var imageFilePath =  TEST_SNAPSHOT_LOCAL_FOLDER_PATH + imageId + ".jpg";
		fs.writeFile(imageFilePath, testSnapShot, 'base64', function(err) {
			if (err) {
				brain.getServerManager().sendImageSavedMessageToMobileClients(false);
				throw err;
			}
			else {
		  		console.log('image ' + imageId.toString() + ' saved');
		  		brain.getServerManager().sendImageSavedMessageToMobileClients(true);
		  	}
		});
	}

	// Save the given snap shot and assign it the given id
	// The image is passed as a base64 image
	// and then saved to file a a jpeg
	self.saveSnapShot = function(snapShot, imageId) {
		console.log("saveSnapShot", imageId);
		var imageFilePath =  ORIG_SNAPSHOT_LOCAL_FOLDER_PATH + imageId + ".jpg";
		fs.writeFile(imageFilePath, snapShot, 'base64', function(err) {
			if (err) {
				brain.getServerManager().sendImageSavedMessageToMobileClients(false);
				throw err;
			}
			else {
		  		console.log('image ' + imageId.toString() + ' saved');
		  		// Start saving the different image sizes via daisy chaining
		  		// i.e. the subsequnent save size method will be called
		  		// after each new size is saved
		  		self.saveFullSnapShot(imageId);
		  	}
		});
	}

	// Save the image with the given id at the full size 
	// Not the image's full size, but that specified by FULL_SNAPSHOT_SIZE
	self.saveFullSnapShot = function(imageId) {
		var sourceImagePath = ORIG_SNAPSHOT_LOCAL_FOLDER_PATH + imageId.toString() + ".jpg";
		var destintaionImagePath = FULL_SNAPSHOT_LOCAL_FOLDER_PATH + imageId.toString() + ".jpg";
		var newWidth = FULL_SNAPSHOT_SIZE;
		var newHeight = FULL_SNAPSHOT_SIZE;
		var image = gm(sourceImagePath);
		var resizedImage = image.resize(newWidth, newHeight);
		resizedImage.write(destintaionImagePath, function (err) {
			if (!err) {
				console.log('saveFullSnapShot success!');
				// Now save to the tiny size
				self.saveTinySnapShot(imageId);
			} else {
				console.log("9");
				console.log(err);
			}
		});
	}

	// Save the image with the given id at the small size 
	self.saveSmallSnapShot = function(imageId) {
		var sourceImagePath = ORIG_SNAPSHOT_LOCAL_FOLDER_PATH + imageId.toString() + ".jpg";
		var destintaionImagePath = SMALL_SNAPSHOT_LOCAL_FOLDER_PATH + imageId.toString() + ".jpg";
		var newWidth = SMALL_SNAPSHOT_SIZE;
		var newHeight = SMALL_SNAPSHOT_SIZE;
		var image = gm(sourceImagePath);
		var resizedImage = image.resize(newWidth, newHeight);
		resizedImage.write(destintaionImagePath, function (err) {
			if (!err) {
				console.log('saveSmallSnapShot success!');
				// Now save to the tiny size
				self.saveTinySnapShot(imageId);
			} else {
				console.log(err);
			}
		});
	}

	// Save the image with the given id at the tiny size 
	self.saveTinySnapShot = function(imageId) {
		console.log("saveTinySnapShot");
		var sourceImagePath = ORIG_SNAPSHOT_LOCAL_FOLDER_PATH + imageId.toString() + ".jpg";
		var destintaionImagePath = TINY_SNAPSHOT_LOCAL_FOLDER_PATH + imageId.toString() + ".jpg";
		var newWidth = TINY_SNAPSHOT_SIZE;
		var newHeight = TINY_SNAPSHOT_SIZE;
		var image = gm(sourceImagePath);
		var resizedImage = image.resize(newWidth, newHeight);
		resizedImage.write(destintaionImagePath, function (err) {
			if (!err) {
				console.log('saveTinySnapShot success!');
				// Assume this is the last image size to save
				// so now call the onSaved callback
				self.onSnapShotSaved(imageId);
			} else {
				console.log(err);
			}
		});
	}

	// Build the url for the image with the given id
	self.createFullImageUrlFromId = function(imageId) {
		var imageUrl = "/" + FULL_SNAPSHOT_FOLDER_NAME + "/" + imageId + ".jpg";
		return imageUrl;
	}
	
	// Collect the data that will allow the mural clients
	// to load the latest images
	self.gatherImageUrlDataForMuralClients = function() {
		console.log("gatherImageUrlDataForMuralClients");
		self.findFullSavedImageFileNamesForMuralClients();
	}

	// Get all the files listed in the full size image folder
	// and callback once completed
	self.findFullSavedImageFileNamesForMuralClients = function() {
		fs.readdir(FULL_SNAPSHOT_LOCAL_FOLDER_PATH, self.onFullSavedImageFileNamesFoundForMuralClients);		
	}

	// Collect the data that will allow the mobile clients
	// to load the latest images
	self.gatherImageUrlDataForMobileClients = function() {
		console.log("gatherImageUrlDataForMobileClients");
		self.findFullSavedImageFileNamesForMobileClients();
	}

	// Get all the files listed in the full size image folder
	// and callback once completed
	self.findFullSavedImageFileNamesForMobileClients = function() {
		console.log("findFullSavedImageFileNamesForMobileClients", FULL_SNAPSHOT_LOCAL_FOLDER_PATH);
		fs.readdir(FULL_SNAPSHOT_LOCAL_FOLDER_PATH, self.onFullSavedImageFileNamesFoundForMobileClients);	
	}

	// Build out the complete image url data
	// so client will be able to load them
	self.createImageUrlData = function(savedImageFiles) {
		console.log(savedImageFiles);
		var imageUrlData = {};
		imageUrlData["imageFiles"] = savedImageFiles;
		imageUrlData["fullFolderName"] = "/" + FULL_SNAPSHOT_FOLDER_NAME;
		imageUrlData["smallFolderName"] = "/" + SMALL_SNAPSHOT_FOLDER_NAME;
		imageUrlData["tinyFolderName"] = "/" + TINY_SNAPSHOT_FOLDER_NAME;
		return imageUrlData;
	}

	self.init();
}


// Manages websocket communication with clients
// and the communication layers between them
// Also routes various incoming message to
// handle various logic requests accordingly
function ServerManager(brain) {

	var self = this;
	var app;
	var express;
	var favicon;
	var PUBLIC_FOLDER_PATH = "/public";
	var MOBILE_CLIENT_FOLDER_PATH = PUBLIC_FOLDER_PATH + "/mobileClient";
	var MOBILE_CLIENT_INDEX_PATH = MOBILE_CLIENT_FOLDER_PATH + "/index.html";
	var FAVICON_PATH = MOBILE_CLIENT_FOLDER_PATH + "/images/favicon.png";
	var MURAL_CLIENT_FOLDER_PATH = PUBLIC_FOLDER_PATH + "/muralClient";
	var MURAL_CLIENT_INDEX_PATH = MURAL_CLIENT_FOLDER_PATH + "/index.html";
	var MOBILE_CLIENT_SOCKET_PORT = 55555;
	var MURAL_CLIENT_SOCKET_PORT = 55556;
	var mobileClientSockets = [];
	var muralClientSockets = [];

	self.init = function() {
		self.createExpress();
		self.createApp();
		self.createFavicon();
		self.createMobileClientSocket();
		self.createMuralClientSocket();
	}

	// Create the express object
	self.createExpress = function() {
		express = require('express');
	}

	// Create the express app that will route
	// incoming http requeusts appropriately
	self.createApp = function() {
		app = express();

		// Serve up static files from the public folder
		app.use(express.static(__dirname + PUBLIC_FOLDER_PATH));

		// Set the mobile client path
		app.get('/', function(req, res){
			res.sendFile(MOBILE_CLIENT_INDEX_PATH, {"root": __dirname});
		});

		// Set the mural client path
		app.get('/muralClient', function(req, res) {
			res.sendFile(MURAL_CLIENT_INDEX_PATH, {"root": __dirname});
		});

		const bodyParser = require('body-parser')

		app.set('view engine', 'ejs')
		app.use(bodyParser.urlencoded({extended: true}))
		app.use(bodyParser.json())
		app.use(express.static('public'))
	}

	// Serve up the favicon
	self.createFavicon = function() {
		var favicon = require('serve-favicon');
		app.use(favicon(__dirname + FAVICON_PATH));
	}

	// Listen for incoming mobile client sockets
	self.createMobileClientSocket = function() {
		var server = self.createHttpsServer();
		var io = require('socket.io')(server);

		// Listen for the connection event
		io.on('connection', function(socket){
			self.onMobileClientSocketConnection(socket);

			// Specify the message handlers
			socket.on('disconnect', function() {
				self.onMobileClientSocketDisconnection(socket);
	   		});

			socket.on("snapShot", self.handleSnapShotMessage);
			socket.on("testSnapShot", self.handleTestSnapShotMessage);
			socket.on("sendMuralTilingParams", self.handleSendMuralTilingParamsMessage);
			socket.on("itte", self.handleImageTileTouchEventMessage);
			socket.on("sendImageUrlDataToMobileClients", self.handleSendImageUrlDataToMobileClientsMessage);
			socket.on("userInputEvent", self.handleUserInputEventMessage);
		});

		// Listen on the given port
		server.listen(MOBILE_CLIENT_SOCKET_PORT, function() {
		  console.log('listening on *:' + MOBILE_CLIENT_SOCKET_PORT.toString());
		});
	}

	// Listen for incoming mural client socket connections
	self.createMuralClientSocket = function() {
		var server = self.createHttpsServer();
		var io = require('socket.io')(server);

		// Listen for the connection event
		io.on('connection', function(socket){
			self.onMuralClientSocketConnection(socket);

			// Specify the message handlers
			socket.on('disconnect', function() {
				self.onMuralClientSocketDisconnection(socket);
	   		});

	   		socket.on("muralTilingParams", self.handleMuralTilingParamsMessage);
	   		socket.on("sendImageUrlDataToMuralClients", self.handleSendImageUrlDataToMuralClientsMessage);
		});

		// Listen on the given port
		server.listen(MURAL_CLIENT_SOCKET_PORT, function() {
		  console.log('listening on *:' + MURAL_CLIENT_SOCKET_PORT.toString());
		});
	}

	// Create the https server to serve up the content
	self.createHttpsServer = function() {
		var server = require('http').createServer(app)
		return server;
	}


	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Fires when a mobile client socket connection is made
	self.onMobileClientSocketConnection = function(socket) {
		console.log("mobile client socket " + socket.id + " connection opened");
		// Store the socket in the list
		mobileClientSockets.push(socket);
	}

	// Fires when a mboile client socket disconnects
	self.onMobileClientSocketDisconnection = function(socket) {
		console.log("mobile client socket " + socket.id + " disconnected");
		// Remove the socket from the list
		var socketIndex = mobileClientSockets.indexOf(socket);
		if (socketIndex > -1) {
			mobileClientSockets.splice(socketIndex, 1);
		}
	}

	// Fires when a mural socket connection is made
	self.onMuralClientSocketConnection = function(socket) {
		console.log("mural client socket " + socket.id + " connection opened");
		// Store the socket in the list
		muralClientSockets.push(socket);
	}

	// Fires when a mural socket disconnects
	self.onMuralClientSocketDisconnection = function(socket) {
		console.log("mural client socket " + socket.id + " disconnected");
		// Remove the socket from the list
		var socketIndex = muralClientSockets.indexOf(socket);
		if (socketIndex > -1) {
			muralClientSockets.splice(socketIndex, 1);
		}
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// Send a message to the mobile clients to indicate
	// that an image was successfully saved
	self.sendImageSavedMessageToMobileClients = function(wasSuccessful) {
		console.log("sendImageSavedMessageToMobileClients", wasSuccessful);
		var message = {"wasSuccessful":wasSuccessful};
		self.sendMessageToMobileClients("imageSaved", message);
	}

	// Extract the given snapshot data sent from the client
	// and tell the image manager about it
	self.handleSnapShotMessage = function(message) {
		console.log("handleSnapShotMessage");
		var snapShot = message["snapShot"];
		var imageId = message["id"];
		brain.getImageManager().saveSnapShot(snapShot, imageId);
	}

	// Extract the given test snapshot data sent from the client
	// and tell the image manager about it 
	self.handleTestSnapShotMessage = function(message) {
		var snapShot = message["testSnapShot"];
		var imageId = message["id"];
		var imageUrl = "https://pwdemo.org:55555/testSnapShots/" + imageId + ".jpg";
		console.log(imageUrl);
		brain.getImageManager().saveTestSnapShot(snapShot, imageId);
	}

	// Receive a zoom message from the mobile client
	// and pass it on to the mural clients
	self.handleZoomButtonEventMessage = function(message) {
		self.sendMessageToMuralClients("zoomButtonEvent", message);
	}

	// Receive a request from the mural client to send back
	// the image data so it can create its grid
	self.handleSendImageUrlDataToMuralClientsMessage = function(message) {
		// Tell the image manager to collect up the image data
		brain.getImageManager().gatherImageUrlDataForMuralClients();
	}

	// Receive a request from the mobile client to send back
	// the image data so it can create its grid
	self.handleSendImageUrlDataToMobileClientsMessage = function(message) {
		brain.getImageManager().gatherImageUrlDataForMobileClients();
	}

	// Receive a request from the mobile client to send back
	// the mural tiling params, so it can build an identical grid on its mobile end
	self.handleSendMuralTilingParamsMessage = function(message) {
		self.sendMessageToMuralClients("sendMuralTilingParams", message);
	}

	// Receive a mobile client image grid touch event
	// and pass it on to the mural clients so they can
	// handle the event
	self.handleImageTileTouchEventMessage = function(message) {
		self.sendMessageToMuralClients("itte", message);
	}

	// Receive an image tiling params message
	// and pass it on to the mobile clients
	self.handleMuralTilingParamsMessage = function(message) {
		self.sendMessageToMobileClients("muralTilingParams", message);
	}

	// Receive a user input event message from the mobile client
	// and pass it on to the the mural client
	// so they can handle it
	self.handleUserInputEventMessage = function(message) {
		self.sendMessageToMuralClients("userInputEvent", message);
	}

	// Send out the image data to the mural clients
	self.sendImageUrlDataToMuralClients = function(imageUrlData) {
		var message = {"imageUrlData":imageUrlData};
		self.sendMessageToMuralClients("imageUrlData", message);
	}

	// Send out the image data to the mobile clients
	self.sendImageUrlDataToMobileClients = function(imageUrlData) {
		var message = {"imageUrlData":imageUrlData};
		self.sendMessageToMobileClients("imageUrlData", message);		
	}

	// Send out a message to the mural clients
	// with the newly saved snapshot data
	self.sendNewSnapShotDataToMuralClients = function(snapShotData) {
		var message = {"newSnapShotData":snapShotData};
		self.sendMessageToMuralClients("newSnapShotData", message);
	}

	// Send out a message to the mobile clients
	// with the newly saved snapshot data
	self.sendNewSnapShotDataToMobileClients = function(snapShotData) {
		var message = {"newSnapShotData":snapShotData};
		self.sendMessageToMobileClients("newSnapShotData", message);
	}

	// Send a message of the given type and content
	// to all of the stored mural clients
	self.sendMessageToMuralClients = function(messageType, message) {
		var json = JSON.stringify(message);
		console.log("sending message to mural client: " + messageType + "  " + json);
		for (var i=0; i<muralClientSockets.length; i++) {
			console.log("sending message to muralClient " + i + "  " + messageType + "   " + message);
			muralClientSockets[i].emit(messageType, message);
		}
	}

	// Send a message of the given type and content
	// to all of the stored mobile clients
	self.sendMessageToMobileClients = function(messageType, message) {	
		for (var i=0; i<mobileClientSockets.length; i++) {
			console.log("sending message to mobileClient " + i + "  " + messageType + "   " + message);
			mobileClientSockets[i].emit(messageType, message);
		}
	}


	self.init();
}


var brain = new Brain();


