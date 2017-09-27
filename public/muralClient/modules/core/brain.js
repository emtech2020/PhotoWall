/*
brain.js

Top level manager that creates all of the singletons
that will perfrom the core logic for the app
*/

function Brain() {
	
	var self = this;
	var muralManager;
	var serverManager;

	self.init = function() {
		self.createServerManager();
		self.createMuralManager();
	}

	self.createServerManager = function() {
		serverManager = new ServerManager(self);
	}

	self.createMuralManager = function() {
		muralManager = new MuralManager(self);
	}


	////////////////////////////////////
	// accessors
	////////////////////////////////////
	
	self.getServerManager = function() { return serverManager; }
	self.getMuralManager = function() { return muralManager; }


	self.init();
}













