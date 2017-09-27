/*
muralManager.js

Top level manager for the mural logic
Creates the singleton that manages the WebGL interface
and handles various callbacks accordingly
*/

function MuralManager(brain) {

	var self = this;
	var worldManager;
	

	self.init = function() {
		self.createWorldManager();
		self.hideScrollbars();
		brain.getServerManager().sendRequestImageUrlDataMessage();
	}

	// Create the WebGL manager
	self.createWorldManager = function() {
		worldManager = new WorldManager(brain);
	}

	// Hide the browser scrollbars
	self.hideScrollbars = function() {
		document.documentElement.style.overflowX = 'hidden';
		document.documentElement.style.overflowY = 'hidden';
	}


	////////////////////////////////////
	// accessors
	////////////////////////////////////

	self.getWorldManager = function() { return worldManager; }


	////////////////////////////////////
	// callback
	////////////////////////////////////

	// Fires when the latest image data has been received
	self.onImageUrlDataReceived = function(imageUrlData) {
		// Tell the world manager about it
		self.getWorldManager().onImageUrlDataReceived(imageUrlData);
	}

	// Fires when a mobile client touch event has been received
	self.onImageTileTouchEventReceived = function(imageTileTouchEvent) {
		// Tell the world mangaer about it
		self.getWorldManager().onImageTileTouchEventReceived(imageTileTouchEvent);
	}

	// Fires when new snapshot data has been received
	self.onNewSnapShotDataReceived = function(newSnapShotData) {
		self.getWorldManager().onNewSnapShotDataReceived(newSnapShotData);
	}

	// Fires when a mobile client user input event has been received
	self.onMobileClientUserInputEventReceived = function() {
		self.getWorldManager().onMobileClientUserInputEventReceived();
	}


	self.init();
}
