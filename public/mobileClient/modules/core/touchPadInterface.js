/*
touchPadInterface.js

A ui element that visually is a copy of the mural image grid
The user can tap a specific image on the touch pad
and the mural will zoom into that photo
On release of the image, the mural zooms back out
Also, the user can move around the touch pad
and the camera zoom in and move around with the moving touch
until the user releases and the camera zooms back out
*/

function TouchPadInterface(brain) {
	
	var self = this;
	var touchPadContainer;
	var muralTilingParams = null;
	var imageUrlData = null;
	var TILING_Z = 0;
	var imageTileSize;
	var imageTiles = [];
	var previousImageTileTouchEvent = null;
	var CAMERA_INIT_Z = 100;
	var touchPadContainerWidth;
	var touchPadContainerHeight;
	var scene = null;
	var camera = null;
	var renderer = null;
	var stats = null;
	var fiducialPoints;

	self.init = function() {
		self.initTouchPadContainer();
		self.createScene();
		self.createRenderer();
		self.createCamera();
		self.createLight();
		self.createFiducialPoints();
		//self.createStats();
		self.listenForWindowResize();
		//brain.getServerManager().sendMuralTilingParamsRequestToServer();
		self.animate();
	}

	// Initialize the container in which the touch pad ui will live
	self.initTouchPadContainer = function() {
		// Bind to the dom element container
		touchPadContainer = document.querySelector("#touchPadContainer");
		// Update the layout now that the document has loaded
		self.updateTouchPadContainerOnResize();
		// Listen for touch events
		touchPadContainer.addEventListener("touchstart", self.onTouchPadContainerTouchStart);
		touchPadContainer.addEventListener("touchmove", self.onTouchPadContainerTouchMove);
		touchPadContainer.addEventListener("touchend", self.onTouchPadContainerTouchEnd);
	}

	// Create the WebGL scene
	self.createScene = function() {
		scene = new THREE.Scene();
	}

	// Create the WebGL renderer
	self.createRenderer = function() {
		renderer = new THREE.WebGLRenderer();
		renderer.setClearColor(0x000000);
		renderer.setSize(touchPadContainerWidth, touchPadContainerHeight);
		touchPadContainer.appendChild(renderer.domElement);
	}

	// Create the WebGL light
	self.createLight = function() {
		var light = new THREE.DirectionalLight(0xffffff);
    	light.position.set(0, 1, 1).normalize();
    	scene.add(light);
	}

	// Create the WebGL camera
	self.createCamera = function() {
		camera = new THREE.PerspectiveCamera(45, touchPadContainerWidth/touchPadContainerHeight, 1, 10000);
		camera.position.x = 0;
		camera.position.y = 0;
		camera.position.z = CAMERA_INIT_Z;
	}

	// Create the WebGL framerate stats ui
	self.createStats = function() {
		stats = new Stats();
		stats.domElement.style.position = "absolute";
		stats.domElement.style.top = "0px";
		touchPadContainer.appendChild(stats.domElement);
	}

	// Create the points to calculate relative 3D world and 2D screen dimensions
	// We use these when calculating the image tile widths
	self.createFiducialPoints = function() {
		if (scene == null) {
			return;
		}

		topLeftPosition = self.convertScreenCoordsToWorldCoords(0, 0, TILING_Z);
		topRightPosition = self.convertScreenCoordsToWorldCoords(touchPadContainerWidth, 0, TILING_Z);
		bottomLeftPosition = self.convertScreenCoordsToWorldCoords(0, touchPadContainerHeight, TILING_Z);
		bottomRightPosition = self.convertScreenCoordsToWorldCoords(touchPadContainerWidth, touchPadContainerHeight, TILING_Z);

		fiducialPoints = {};
		fiducialPoints["topLeft"] = self.createFiducialPoint(topLeftPosition);
		fiducialPoints["topRight"] = self.createFiducialPoint(topRightPosition);
		fiducialPoints["bottomLeft"] = self.createFiducialPoint(bottomLeftPosition);
		fiducialPoints["bottomRight"] = self.createFiducialPoint(bottomRightPosition);
	}

	// Create a test point in the world at the given position
	self.createFiducialPoint = function(position) {
		var fiducialPoint = new FiducialPoint(brain, self);
		scene.add(fiducialPoint.getObject());
		// TODO: figure out why first pass needs this scalar???
		fiducialPoint.getPosition().x = position.x * 26;
		fiducialPoint.getPosition().y = position.y * 26;
		fiducialPoint.getPosition().z = position.z;
		return fiducialPoint 
	}

	// Bind to window resize events
	self.listenForWindowResize = function() {
		window.addEventListener("resize", self.onWindowResize);
	}


	////////////////////////////////////
	// accessors
	////////////////////////////////////

	self.getPreviousImageTileTouchEvent = function() { return previousImageTileTouchEvent; }
	self.setPreviousImageTileTouchEvent = function(newImageTileTouchEvent) {
		previousImageTileTouchEvent = {
			"row": newImageTileTouchEvent["row"],
			"column": newImageTileTouchEvent["column"],
			"type": newImageTileTouchEvent["type"]
		};
	}


	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Fires when the ui reveal animation has completed
	self.onContainerRevealed = function() {
		brain.getServerManager().sendMuralTilingParamsRequestToServer();
	}

	// Fires when the mural tiling params have been received from the server
	self.onMuralTilingParamsReceived = function(newMuralTilingParams) {
		if (muralTilingParams != null) {
			return;
		}
		// Store them
		muralTilingParams = newMuralTilingParams;
		// Ask the server for the latest images
		brain.getServerManager().sendImageUrlDataRequestToServer()
	}

	// Fires when the window is resized
	self.onWindowResize = function() {
		self.updateTouchPadContainerOnResize();
		self.updateRendererAndCameraOnResize();
		self.updateFiducialPointsOnResize();
		self.updateImageTilesOnResize();
	}

	// Fires when the latest image data has been received from the server
	self.onImageUrlDataReceived = function(newImageUrlData) {
		if (imageUrlData != null) {
			return;
		}
		// Store it
		imageUrlData = newImageUrlData;
		// Create the image tiles for each of these images
		self.createImageTiles(newImageUrlData);
	}

	// Fires when new snapshot data has been received
	self.onNewSnapShotDataReceived = function(newSnapShotData) {
		// If the touch pad grid is full
		if (self.checkIfAtMaxNumTiles() == true) {
			// Remove the bottom row (i.e. the oldest row)
			self.removeOldestTilingRow();
			// Create the image tile in the newly avaiable space
			self.createNewImageTile(newSnapShotData);
		} else {
			self.createNewImageTile(newSnapShotData);
		}
	}

	// Fires when a touch event starts
	self.onTouchPadContainerTouchStart = function(touchEvent) {
		self.handleTouchPadTouchEvent(touchEvent);
	}

	// Fires when a touch move event occurs
	self.onTouchPadContainerTouchMove = function(touchEvent) {
		self.handleTouchPadTouchEvent(touchEvent);
	}

	// Fires when a touch event ends
	self.onTouchPadContainerTouchEnd = function(touchEvent) {
		self.handleTouchPadTouchEvent(touchEvent);
	}

	// Called when a new image tile loads
	// when a user posts a new image
	self.onNewImageTileImageLoaded = function(imageTile) {
		// Drop the tile into the grid, moving from outside the screen
		// into the screen along the z axis
		imageTile.getObject().visible = true;
		var duration = 1.5;
		TweenLite.fromTo(imageTile.getPosition(), 1.2, {
			x: 0,
			y: 0,
			z: CAMERA_INIT_Z
		}, {
			x: imageTile.getGridPosition().x,
			y: imageTile.getGridPosition().y,
			z: imageTile.getGridPosition().z,
			ease: Back.easeOut,
			delay: Math.random()*1,
		});
		// Once the tile lands, ripple the grid to 
		// simulate a waterlike effect
		setTimeout(self.createRippleAtImageTile, .7*1000*duration, imageTile);
	}

	// Called when a saved image tile loads
	// when then page first loads
	self.onImageTileImageLoaded = function(imageTile) {
		// Init the tiles WebGL params
		imageTile.getObject().material.transparent = true;
		imageTile.getObject().material.opacity = 0;
		imageTile.getObject().visible = true;
		
		// Save the tiles position
		var newPosition = new THREE.Vector3(
			imageTile.getGridPosition().x,
			imageTile.getGridPosition().y,
			imageTile.getGridPosition().z
			);
		imageTile.setPosition(newPosition);

		// Fade in the tile
		TweenLite.to(imageTile.getObject().material, .6, {
			opacity: 1,
			ease: Quint.easeOut,
			delay: Math.random() * .5
		});
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// The WebGL redraw method
	self.animate = function() {
		// Keep redrawing when the system is ready
		requestAnimationFrame(self.animate);
		// Render out the graphics
		self.render();
		if (stats != null) {
			// Update the framerate stats ui
			stats.update();
		}	
	}

	// Actually draw the scene
	self.render = function() {
		renderer.render(scene, camera);
	}

	// Project from a 3D coordinate to 2D screen coordinate
	self.convertScreenCoordsToWorldCoords = function(screenX, screenY, worldZ) {
		var geometry = new THREE.PlaneBufferGeometry(5000, 5000, 32);
		var material = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide} );
		var plane = new THREE.Mesh(geometry, material);
		plane.position.z = worldZ;
		scene.add(plane);

		var screenPoint = new THREE.Vector2();
		screenPoint.x =	(screenX / touchPadContainerWidth) * 2 - 1;
		screenPoint.y =	-(screenY / touchPadContainerHeight) * 2 + 1;	

		var raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(screenPoint, camera);
		var intersects = raycaster.intersectObjects(scene.children);
		var intersectionPoint = intersects[0].point;

		scene.remove(plane);

		return intersectionPoint;
	}

	// Create the set of image tiles that will make up the touch pad interface
	self.createImageTiles = function(imageUrlData) {
		var imageFiles = imageUrlData["imageFiles"];
		var fullFolderName = imageUrlData["fullFolderName"];
		var smallFolderName = imageUrlData["smallFolderName"];
		var tinyFolderName = imageUrlData["tinyFolderName"];
		var isNew = false;

		for (var i=0; i<imageFiles.length; i++) {
			var imageFile = imageFiles[i];
			self.createImageTile(i, imageFile, fullFolderName, smallFolderName, tinyFolderName, isNew);
		}
	}

	// Create a single image tile that will live in the touchpad
	self.createImageTile = function(imageTileIndex, imageFile, fullFolderName, smallFolderName, tinyFolderName, isNew) {
		// Calculate the tile size based on the leftmost and rightmost screen extremes and grid params
		// Then figure out the tile position based on where it is in the list of tiles and knowledge
		// of how many rows and columns exist in the grid
		var tilingWidth = fiducialPoints["topRight"].getPosition().x - fiducialPoints["topLeft"].getPosition().x;
		var numColumns = muralTilingParams["numColumns"];
		imageTileSize = tilingWidth / numColumns;
		var fullImageUrl = fullFolderName + "/" + imageFile;
		var smallImageUrl = smallFolderName + "/" + imageFile;
		var tinyImageUrl = tinyFolderName + "/" + imageFile;
		var row = Math.floor(imageTileIndex / numColumns);
		var column = imageTileIndex % numColumns;
		var offsetX = fiducialPoints["bottomLeft"].getPosition().x + imageTileSize/2;
		var offsetY = fiducialPoints["bottomLeft"].getPosition().y + imageTileSize/2;	
		var x = (column * imageTileSize) + offsetX;
		var y = (row * imageTileSize) + offsetY;
		var z = TILING_Z;
		var imageTile = new ImageTile(brain, self, row, column, imageTileSize, fullImageUrl, smallImageUrl, tinyImageUrl, isNew);
		scene.add(imageTile.getObject());
		imageTile.setGridPosition(new THREE.Vector3(x, y, z));
		var position = new THREE.Vector3(x, y, z);
		imageTile.setPosition(position);
		imageTiles.push(imageTile);
	}

	// Figure out which image tile was just touched based on the touch event position
	// and the screen point of each image tile
	self.findImageTileUnderTouchPoint = function(touchEvent) {
		var referenceX = parseInt(touchPadContainer.offsetLeft);
		var referenceY = parseInt(touchPadContainer.offsetTop);

		var changedTouches = touchEvent.changedTouches;
		if (changedTouches.length < 1) {
			return null;
		}
		var touch = changedTouches[0];
		var touchX = touch.pageX;
		var touchY = touch.pageY;
		var relativeTouchX = touchX - referenceX;
		var relativeTouchY = touchY - referenceY;
		var screenPoint = new THREE.Vector2();

		screenPoint.x =	(relativeTouchX/touchPadContainerWidth) * 2 - 1;
		screenPoint.y =	-(relativeTouchY/touchPadContainerHeight) * 2 + 1;

		var raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(screenPoint, camera);
		var intersects = raycaster.intersectObjects(scene.children);
		if (intersects.length == 0) {
			return null;
		}
		var intersectionPoint = intersects[0].point;
		var intersectedObject = intersects[0].object;

		for (var i=0; i<imageTiles.length; i++) {
			var imageTile = imageTiles[i];
			if (imageTile.getObject().name == intersectedObject.name) {
				return imageTile;
			}
		}
	}

	// Figure out what to do given that a touchpad touch event just occurred
	self.handleTouchPadTouchEvent = function(touchEvent) {
		// Find the image tile under the touch
		var imageTile = self.findImageTileUnderTouchPoint(touchEvent);
		if (imageTile == null) {
			return;
		}
		// Create an object to capture the touched tile
		// Keep the keys short so socket message transit time is reduced
		// This becomes important for touch move events as they flood the network
		var imageTileTouchEvent = {
			"r": imageTile.getRow(),
			"c": imageTile.getColumn(),
			"t": touchEvent.type
		};

		// If the event is not new (e.g. a touch move event on the same tile)
		// then don't tell the server about it
		if (self.checkIfIsNewImageTileTouchEvent(imageTileTouchEvent) == false) {
			return;
		}
		
		// Tell the server about the touch event
		brain.getServerManager().sendImageTileTouchEventToServer(imageTileTouchEvent);
	}

	// If the event is new (e.g. a touch move event on one tile, and then another different tile)
	self.checkIfIsNewImageTileTouchEvent = function(imageTileTouchEvent) {
		if (self.getPreviousImageTileTouchEvent() == null) {
			self.setPreviousImageTileTouchEvent(imageTileTouchEvent);
			return true;
		}

		if ((imageTileTouchEvent["r"] == previousImageTileTouchEvent["r"]) &&
			(imageTileTouchEvent["c"] == previousImageTileTouchEvent["c"]) &&
			(imageTileTouchEvent["t"] == previousImageTileTouchEvent["t"])) {
			return false;
		}

		// Store this touch event for future checks
		self.setPreviousImageTileTouchEvent(imageTileTouchEvent);

		return true;
	}

	// Check if the device is in portrait mode
	self.checkIfInPortraitMode = function() {
		if (window.innerWidth <= window.innerHeight) {
			return true;
		}
		return false;
	}

	// Reposition the touch pad based on device orientation
	self.updateTouchPadContainerOnResize = function() {
		if (self.checkIfInPortraitMode() == true) {
			touchPadContainerWidth = window.innerWidth;
			touchPadContainerHeight = (window.innerHeight/2) * .80;
			touchPadContainer.width = touchPadContainerWidth;
			touchPadContainer.height = touchPadContainerHeight;
			touchPadContainer.style.top = (window.innerHeight - touchPadContainerHeight) + "px";
			touchPadContainer.style.left = "0px";
		} else {
			touchPadContainerWidth = window.innerWidth - window.innerHeight;
			touchPadContainerHeight = window.innerHeight;
			touchPadContainer.width = touchPadContainerWidth;
			touchPadContainer.height = touchPadContainerHeight;
			touchPadContainer.style.top = "0px";
			touchPadContainer.style.left = window.innerHeight + "px";
		}
	}

	// Update the WebGL scene on window resize
	self.updateRendererAndCameraOnResize = function() {
		if (renderer == null) {
			return;
		}
		camera.aspect = touchPadContainerWidth / touchPadContainerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(touchPadContainerWidth, touchPadContainerHeight);
	}

	// Update the WebGL test points on window resize
	// So they remap to the proper extremes
	self.updateFiducialPointsOnResize = function() {
		topLeftPosition = self.convertScreenCoordsToWorldCoords(0, 0, TILING_Z);
		topRightPosition = self.convertScreenCoordsToWorldCoords(touchPadContainerWidth, 0, TILING_Z);
		bottomLeftPosition = self.convertScreenCoordsToWorldCoords(0, touchPadContainerHeight, TILING_Z);
		bottomRightPosition = self.convertScreenCoordsToWorldCoords(touchPadContainerWidth, touchPadContainerHeight, TILING_Z);

		fiducialPoints["topLeft"].setPosition(topLeftPosition);
		fiducialPoints["topRight"].setPosition(topRightPosition);
		fiducialPoints["bottomLeft"].setPosition(bottomLeftPosition);
		fiducialPoints["bottomRight"].setPosition(bottomRightPosition);
	}

	// Resize and position the image tile on window resize
	// to fit inside the new layout
	self.updateImageTilesOnResize = function() {
		for (var i=0; i<imageTiles.length; i++) {
			var imageTile = imageTiles[i];
			var tilingWidth = fiducialPoints["topRight"].getPosition().x - fiducialPoints["topLeft"].getPosition().x;
			var numColumns = muralTilingParams["numColumns"];
			imageTileSize = tilingWidth / numColumns;
			var row = imageTile.getRow();
			var column = imageTile.getColumn();
			var offsetX = fiducialPoints["bottomLeft"].getPosition().x + imageTileSize/2;
			var offsetY = fiducialPoints["bottomLeft"].getPosition().y + imageTileSize/2;
			var x = (column * imageTileSize) + offsetX;
			var y = (row * imageTileSize) + offsetY;
			var z = TILING_Z;
			var newPosition = new THREE.Vector3(x, y, z);
			imageTile.setPosition(newPosition);
			var newScale = new THREE.Vector2(imageTileSize, imageTileSize);
			imageTile.setScale(newScale);		}
	}

	// Create a water ripple effect that extends outward from the given tile
	self.createRippleAtImageTile = function(epicenterImageTile) {
		for (var i=0; i<imageTiles.length; i++) {
			var imageTile = imageTiles[i];

			var distance = imageTile.getGridPosition().distanceTo(epicenterImageTile.getGridPosition());
			var zNew;

			if (imageTile.getObject().name != epicenterImageTile.getObject().name) {	
				zNew = -5*(50/distance);
				var duration = .15;
				var delay = distance/100 + duration;
				// Push down the tile, then animate it back to the grid plane
				TweenLite.to(imageTile.getPosition(), duration, {z:zNew, delay:delay, ease:Expo.easeOut});
				TweenLite.to(imageTile.getPosition(), duration, {z:0, delay:delay + duration, ease:Expo.easeOut});
			}
		}
	}

	// Create a new image tile using the given snapshot data
	self.createNewImageTile = function(newSnapShotData) {
		var newImageTileIndex = imageTiles.length;
		var imageFileName = newSnapShotData["imageFileName"];
		var fullFolderName = newSnapShotData["fullFolderName"];
		var smallFolderName = newSnapShotData["smallFolderName"];
		var tinyFolderName = newSnapShotData["tinyFolderName"];
		var isNew = true;
		self.createImageTile(newImageTileIndex, imageFileName, fullFolderName, smallFolderName, tinyFolderName, isNew);
	}

	// Check if the grid tiling is full
	self.checkIfAtMaxNumTiles = function() {
		var maxNumTiles = muralTilingParams["numColumns"] * muralTilingParams["maxNumRows"];
		var numTiles = imageTiles.length;
		if (numTiles >= maxNumTiles) {
			return true;
		}
		return false;
	}

	// Remove the oldest grid tiling row so we can draw more rows
	self.removeOldestTilingRow = function() {
		// pluck the image tiles to be removed
		var imageTilesToRemove = imageTiles.splice(0, muralTilingParams["numColumns"]);
		// reassign the image tile row, column, grid position, and object name
		self.reassignImageTilePropertiesOnRowRemoval(imageTilesToRemove);
		// move all tiles to their new positions
		self.updateTilePositionsOnRowRemoval(imageTilesToRemove);
		// remove the now unseen tiles (after row is slid offscreen...assume 5 seconds is enough wait)
		setTimeout(self.removeTilesOnRowRemoval, 5000, imageTilesToRemove);
	}

	// Now that we've removed a row, we need to update all the positions and grid coordinates of the tiles
	self.reassignImageTilePropertiesOnRowRemoval = function(imageTilesToRemove) {
		var tilingWidth = fiducialPoints["topRight"].getPosition().x - fiducialPoints["topLeft"].getPosition().x;
		var offsetX = fiducialPoints["bottomLeft"].getPosition().x + imageTileSize/2;
		var offsetY = fiducialPoints["bottomLeft"].getPosition().y + imageTileSize/2;

		// Update the tiles that are not to be removed
		for (var i=0; i<imageTiles.length; i++) {
			var imageTile = imageTiles[i];
			var row = Math.floor(i / muralTilingParams["numColumns"]);
			var column = i % muralTilingParams["numColumns"];
			var x = (column * imageTileSize) + offsetX;
			var y = (row * imageTileSize) + offsetY;
			var z = TILING_Z;
			var name = "imageTile_" + row.toString() + "_" + column.toString();
			imageTile.setRow(row);
			imageTile.setColumn(column);
			imageTile.setGridPosition(new THREE.Vector3(x, y, z));
			imageTile.getObject().name = name;
		}

		// Remove the tile that are to be removed
		for (var j=0; j<imageTilesToRemove.length; j++) {
			var imageTileToRemove = imageTilesToRemove[j];
			var row = -1;
			var column = i % muralTilingParams["numColumns"];
			var x = (column * imageTileSize) + offsetX;
			var y = (row * imageTileSize) + offsetY;
			var z = TILING_Z;
			var name = "imageTile_" + row.toString() + "_" + column.toString();
			imageTileToRemove.setGridPosition(new THREE.Vector3(x, y, z));
			imageTileToRemove.getObject().name = name;
		}
	}

	// Update the tile positions given that a row was removed
	self.updateTilePositionsOnRowRemoval = function(imageTilesToRemove) {
		// Move the non-removed tiles to their new position
		for (var i=0; i<imageTiles.length; i++) {
			var imageTile = imageTiles[i];
			var newY = imageTile.getGridPosition().y;
			TweenLite.to(imageTile.getPosition(), .6, {
				y: newY,
				ease: Quint.easeOut,
				delay: imageTile.getColumn()*.05
			});
		}

		// Move the to-be-removed tiles off screen
		for (var j=0; j<imageTilesToRemove.length; j++) {
			var imageTileToRemove = imageTilesToRemove[j];
			var newY = imageTileToRemove.getGridPosition().y;
			TweenLite.to(imageTileToRemove.getPosition(), .6, {
				y: newY,
				ease: Quint.easeOut,
				delay: imageTileToRemove.getColumn()*.05
			});
		}
	}

	// Remove the given tiles from the grid tiling
	self.removeTilesOnRowRemoval = function(imageTilesToRemove) {
		for (var k=0; k<imageTilesToRemove.length; k++) {
			var object = imageTilesToRemove[k].getObject();
			object.geometry.dispose();
    		object.material.dispose();
    		scene.remove(object);
		}
	}


	self.init();
}


// A simple WegGL point that is used
// as a sample point when figuring out how big
// the image tiles should be given the grid tiling params
// and that grids position is three-space
function FiducialPoint(brain, parent) {

	 var self = this;
	 var object;

	 self.init = function() {
	 	self.createObject();
	 }

	 // Create the WebGL element
	 self.createObject = function() {
		var geometry = new THREE.PlaneBufferGeometry(1, 1, 1);
		var material = new THREE.MeshBasicMaterial({color: 0x00ff00});
		object = new THREE.Mesh(geometry, material);
		object.visible = false;
	 }

	 self.getObject = function() { return object; }
	 self.getPosition = function() { return object.position; }
	 self.setPosition = function(newPosition) {
	 	self.getPosition().x = newPosition.x;
	 	self.getPosition().y = newPosition.y;
	 	self.getPosition().z = newPosition.z;
	 }

	 self.init();
}


// A WebGL plane geometry on which we draw an image
// It is the atomic unit of the grid tiling
function ImageTile(brain, parent, row, column, imageSize, fullImageUrl, smallImageUrl, tinyImageUrl, isNew) {

	var self = this;
	var object;
	var gridPosition;
	var DEFAULT_IMAGE_URL = "mobileClient/images/bizCat_32x32.jpg";

	self.init = function() {
		self.createObject();
	}

	// Create the WebGL element
	self.createObject = function() {
		var geometry = new THREE.PlaneBufferGeometry(1, 1);
    	var texture = THREE.ImageUtils.loadTexture(tinyImageUrl, null, self.onImageLoaded, self.onImageLoadError);
    	//texture.minFilter = THREE.LinearFilter;
    	texture.magFilter = THREE.LinearFilter;
    	texture.minFilter = THREE.LinearMipMapLinearFilter;
    	var material = new THREE.MeshPhongMaterial({map:texture, side: THREE.DoubleSide});
    	object = new THREE.Mesh(geometry, material);
    	object.scale.x = imageSize;
    	object.scale.y = imageSize;
    	var name = "imageTile_" + row.toString() + "_" + column.toString();
    	object.name = name;
    	object.visible = false;
	}
	

	////////////////////////////////////
	// accessors
	////////////////////////////////////

	self.getRow = function() { return row; }
	self.setRow = function(newRow) { row = newRow;}
	self.getColumn = function() { return column; }
	self.setColumn = function(newColumn) { column = newColumn; }
	self.getObject = function() { return object; }
	self.getFullImageUrl = function() { return fullImageUrl; }
	// The object position
	self.getPosition = function() { return object.position; }
	self.setPosition = function(newPosition) {
		self.getPosition().x = newPosition.x;
		self.getPosition().y = newPosition.y;
		self.getPosition().z = newPosition.z;
	}
	// The position in the tiling grid
	self.getGridPosition = function() { return gridPosition; }
	self.setGridPosition = function(newPosition) { gridPosition = newPosition;}
	self.getScale = function() { return object.scale; }
	self.setScale = function(newScale) {
		self.getScale().x = newScale.x;
		self.getScale().y = newScale.y;
	}


	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Fires when the image for this tile has loaded
	self.onImageLoaded = function() {
		// Track if it's new so we know wheter to ripple the grid or not
		if (isNew == true) {
			parent.onNewImageTileImageLoaded(self);
		} else {
			parent.onImageTileImageLoaded(self);	
		}
	}

	// Fires when the tile's image could not load
	self.onImageLoadError = function() {
		console.log("onImageLoadError", self.getRow(), self.getColumn());
		self.loadDefaultImage();
	}

	// Fires when the tile's default image could not load
	self.onDefaultImageLoadError = function() {
		console.log("onDefaultImageLoadError", self.getRow(), self.getColumn());
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// Load the tile's default image
	// Use for debugging
	self.loadDefaultImage = function() {
		object.material.map = THREE.ImageUtils.loadTexture(DEFAULT_IMAGE_URL, null, self.onImageLoaded, self.onDefaultImageLoadError);
	}


	self.init();
}




