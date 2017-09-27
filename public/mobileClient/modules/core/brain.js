/*
brain.js

Top level manager that creates all of the singletons
that will perfrom the core logic for the app
*/

function Brain() {
	
	var self = this;
	var zoomTimelineInterface;
	var cameraInterface;
	var touchPadInterface;
	var serverManager;

	
	self.init = function() {
		self.createServerManager();
		self.createCameraInterface();
		self.createTouchPadInterface();
		self.listenForVisibilityStateChange();
		self.getServerManager().sendUserInputEventToServer();
	}
	
	self.createCameraInterface = function() {
		cameraInterface = new CameraInterface(self);
	}

	self.createTouchPadInterface = function() {
		touchPadInterface = new TouchPadInterface(self);
	}

	self.createServerManager = function() {
		serverManager = new ServerManager(self);
	}

	self.listenForVisibilityStateChange = function() {
		document.addEventListener("webkitvisibilitychange", self.onWebKitVisibilityChange);
	}


	////////////////////////////////////
	// accessors
	////////////////////////////////////

	self.getCameraInterface = function() { return cameraInterface; }
	self.getTouchPadInterface = function() { return touchPadInterface; }
	self.getServerManager = function() { return serverManager; }



	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Fires when the camera video is up and running
	self.onVideoReady = function() {
		// Only perform this animation 
		// the first time the video is ready
		if (document.querySelector("#container").style.display != "block") {
			// Show the ui
			self.revealContainer();
		}
	}

	// Fires when the interactive state (e.g. tab changed, or screen off)
	// of the app changes
	self.onWebKitVisibilityChange = function(event) {
		console.log("brain onWebKitVisibilityChange", event);
		var visibilityState = event.srcElement.visibilityState;
		// If the app just became visible, then tell the server about it
		if (visibilityState == "visible") {
			self.getServerManager().sendUserInputEventToServer();
		}
	}

	// Fires when the touch pad ui has been shown
	self.onContainerRevealed = function() {
		self.getTouchPadInterface().onContainerRevealed();
	}

	// Fires when the media capture input
	// has signalled that it is ready
	self.onMediaCaptureInputReady = function() {
		// Only perform this animation 
		// the first time the input is ready
		if (document.querySelector("#container").style.display != "block") {
			// Show the ui
			self.revealContainer();
		}
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// Show all of the app ui via animation
	self.revealContainer = function() {
		console.log("reveal container");
		TweenLite.to("#container", 0, {opacity: 0});
		TweenLite.to("#container", 0, {display: "block"});
		TweenLite.to("#container", .1, {
			opacity: 1, 
			ease:Quint.easeOut, 
			onComplete: self.onContainerRevealed
		});
	}

	self.init();
}



















