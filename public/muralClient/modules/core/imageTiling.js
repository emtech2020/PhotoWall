/*
imageTiling.js

This is the grid of image tiles that comprise the mural display
It asks the server for the latest images on startup
and then creates the tiling
Tracks the grid to make sure that rows are removed as neeeded
to make room for newer images
Manages the idle animation, for when nobody has interacted with it for awhile
Controls the zoom and camera translation interface that is needed
to respond to mobile client gestures on their individual touch pads
The mobile touchpads are visible copies of the mural and meant to allow the user
to interact with that touch pad to update the camera on the mural
For example, a user could tap the picture of a cat on the touch pad
and the mural would move the camera to and zoom in on that cat
*/



function ImageTiling(brain, parent) {

	var self = this;
	var group;
	var imageTiles = [];
	var TILING_INIT_Z = 0;
	var NUM_COLUMNS = 20;
	var imageTileSize;
	var MAX_NUM_ROWS = 11;
	var canIdlyAnimate;
	var RETURN_TO_PLANE_TWEEEN_DURATION = .6;
	var PISTON_MAX_Z = 100;
	var startIdleAnimationTimeoutId;
	var START_IDLE_ANIMATION_TIMEOUT_DURATION = 10000;
	var currentImageTile = null;
	var touchStartImageTilesReturnedToPlaneTimeoutId;

	self.init = function() {
		self.createGroup();
		setTimeout(self.startIdleAnimation, 10000);
	}

	self.createGroup = function() {
		group = new THREE.Group();
		group.position.z = TILING_INIT_Z;
	}


	////////////////////////////////////
	// accessors
	////////////////////////////////////

	self.getGroup = function() { return group; }
	self.getImageTiles = function() { return imageTiles; }
	self.getTilingInitZ = function() { return TILING_INIT_Z; }
	self.getImageTileSize = function() { return imageTileSize; }
	self.getTilingParams = function() {
		var tilingParams = {};
		tilingParams["numColumns"] = NUM_COLUMNS;
		tilingParams["maxNumRows"] = MAX_NUM_ROWS;
		tilingParams["numRows"] = Math.ceil(imageTiles.length / NUM_COLUMNS);
		tilingParams["numImages"] = imageTiles.length;
		return tilingParams;
	}
	self.getImageTile = function(row, column) {
		for (var i=0; i<imageTiles.length; i++) {
			if ((imageTiles[i].getRow() == row) && (imageTiles[i].getColumn() == column)) {
				return imageTiles[i];
			}
		}
		return null;
	}
	self.getCurrentImageTile = function() { return currentImageTile; }


	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Called when a saved image tile loads
	// when the page first loads
	self.onImageTileImageLoaded = function(imageTile) {
		imageTile.getObject().visible = true;
		TweenLite.fromTo(imageTile.getPosition(), 1.5, {
			x: 0,
			y: 0,
			z: -500
		}, {
			x: imageTile.getGridPosition().x,
			y: imageTile.getGridPosition().y,
			z: imageTile.getGridPosition().z,
			ease: Back.easeOut,
			delay: Math.random()*1
		});
	}

	// Fires when new snapshot data has been received
	self.onNewSnapShotDataReceived = function(newSnapShotData) {
		if (self.checkIfAtMaxNumTiles() == true) {
			self.removeOldestTilingRow();
			self.createNewImageTile(newSnapShotData);
		} else {
			self.createNewImageTile(newSnapShotData);
		}
	}

	// Called when a new image tile loads
	// when a user posts a new image
	self.onNewImageTileImageLoaded = function(imageTile) {
		imageTile.getObject().visible = true;
		var tweenDuration = 1.2;
		TweenLite.fromTo(imageTile.getPosition(), tweenDuration, {
			x: 0,
			y: 0,
			z: parent.getCameraInitZ()
		}, {
			x: imageTile.getGridPosition().x,
			y: imageTile.getGridPosition().y,
			z: imageTile.getGridPosition().z,
			ease: Back.easeOut,
		});
		var timeoutDuration = .25*tweenDuration*1000;
		setTimeout(self.createRippleAtImageTile, timeoutDuration, imageTile);
	}

	// Fires when a mobile client touchpad tile touch event started
	self.onImageTileTouchStart = function(imageTile) {
		//console.log("imageTiling onImageTileTouchStart");

		// Set the current image tile
		currentImageTile = imageTile;
		// Make sure the tiling is ready for user input
		self.prepareForInteraction();
		// Inform parent upon completion
		touchStartImageTilesReturnedToPlaneTimeoutId = setTimeout(parent.onTouchStartImageTilesReturnedToPlane, RETURN_TO_PLANE_TWEEEN_DURATION * 1000);
	}

	// // Fires when a mobile client touchpad tile touch move event occurred
	self.onImageTileTouchMove = function(imageTile) {
		//console.log("imageTiling onImageTileTouchMove");

		// Set the current image tile
		currentImageTile = imageTile;
		// Clear any pending idle animation timeouts
		clearTimeout(startIdleAnimationTimeoutId);
		// Return image tiles to the plane
		// except for the current image tile
		self.returnImageTilesToPlane(currentImageTile);
	}

	// Fires when a mobile client touchpad tile touch event ended
	self.onImageTileTouchEnd = function(imageTile) {
		//console.log("imageTiling onImageTileTouchEnd");

		// Cancel potential pending returnedToPlane callback
		clearTimeout(touchStartImageTilesReturnedToPlaneTimeoutId);
		// Return image tiles to the plane
		self.returnImageTilesToPlane(null);
		// Start the idle animation timeout
		startIdleAnimationTimeoutId = setTimeout(self.startIdleAnimation, START_IDLE_ANIMATION_TIMEOUT_DURATION);
	}

	// Fires when a mobile client user input event has been received
	self.onMobileClientUserInputEventReceived = function() {
		self.prepareForInteraction();
		// Start the idle animation timeout
		startIdleAnimationTimeoutId = setTimeout(self.startIdleAnimation, START_IDLE_ANIMATION_TIMEOUT_DURATION);
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// Create the image tiling using the latest image data
	self.createImageTiles = function(imageUrlData) {
		var imageFiles = imageUrlData["imageFiles"];
		var fullFolderName = imageUrlData["fullFolderName"];
		var smallFolderName = imageUrlData["smallFolderName"];
		var isNew = false;

		for (var i=0; i<imageFiles.length; i++) {
			var imageFile = imageFiles[i];
			self.createImageTile(i, imageFile, fullFolderName, smallFolderName, isNew);
		}
	}

	// Create an individual image tile in the grid
	self.createImageTile = function(imageTileIndex, imageFile, fullFolderName, smallFolderName, isNew) {
		// Use the fiducial points and number of rows and columns to determine the tile size and position
		var tilingWidth = parent.getFiducialPoints()["topRight"].getPosition().x - parent.getFiducialPoints()["topLeft"].getPosition().x;
		imageTileSize = tilingWidth / NUM_COLUMNS;
		var fullImageUrl = fullFolderName + "/" + imageFile;
		var smallImageUrl = smallFolderName + "/" + imageFile;
		var row = Math.floor(imageTileIndex / NUM_COLUMNS);
		var column = imageTileIndex % NUM_COLUMNS;
		var offsetX = parent.getFiducialPoints()["bottomLeft"].getPosition().x + imageTileSize/2;
		var offsetY = parent.getFiducialPoints()["bottomLeft"].getPosition().y + imageTileSize/2;	
		var x = (column * imageTileSize) + offsetX;
		var y = (row * imageTileSize) + offsetY;
		var z = 0;
		var imageTile = new ImageTile(brain, self, row, column, imageTileSize, fullImageUrl, smallImageUrl, isNew);
		imageTile.setGridPosition(new THREE.Vector3(x, y, z));
		imageTile.getObject().position.x = x;
		imageTile.getObject().position.y = y;
		imageTile.getObject().position.z = z;
		imageTiles.push(imageTile);
		group.add(imageTile.getObject());
	}

	// Determine if the grid is full of image tiles
	// i.e. all rows and columns are populated
	self.checkIfAtMaxNumTiles = function() {
		//return true;

		var maxNumTiles = NUM_COLUMNS * MAX_NUM_ROWS;
		var numTiles = imageTiles.length;
		if (numTiles >= maxNumTiles) {
			return true;
		}
		return false;
	}

	// Remove the row in the tiling that is the oldest
	self.removeOldestTilingRow = function() {
		console.log("removeOldestTilingRow");
		// pluck the image tiles to be removed
		var imageTilesToRemove = imageTiles.splice(0, NUM_COLUMNS);
		// reassign the image tile row, column, grid position, and object name
		self.reassignImageTilePropertiesOnRowRemoval(imageTilesToRemove);
		// move all tiles to their new positions
		self.updateTilePositionsOnRowRemoval(imageTilesToRemove);
		// remove the now unseen tiles (after row is slid offscreen...assume 5 seconds is enough wait)
		setTimeout(self.removeTilesOnRowRemoval, 5000, imageTilesToRemove);
	}

	// Given that a row is going to be removed, update the tiles positions and grid params
	self.reassignImageTilePropertiesOnRowRemoval = function(imageTilesToRemove) {
		var tilingWidth = parent.getFiducialPoints()["topRight"].getPosition().x - parent.getFiducialPoints()["topLeft"].getPosition().x;
		var offsetX = parent.getFiducialPoints()["bottomLeft"].getPosition().x + imageTileSize/2;
		var offsetY = parent.getFiducialPoints()["bottomLeft"].getPosition().y + imageTileSize/2;

		// Update the tiles that are not being removed
		for (var i=0; i<imageTiles.length; i++) {
			var imageTile = imageTiles[i];
			var row = Math.floor(i / NUM_COLUMNS);
			var column = i % NUM_COLUMNS;
			var x = (column * imageTileSize) + offsetX;
			var y = (row * imageTileSize) + offsetY;
			var z = 0;
			var name = "imageTile_" + row.toString() + "_" + column.toString();
			imageTile.setRow(row);
			imageTile.setColumn(column);
			imageTile.setGridPosition(new THREE.Vector3(x, y, z));
			imageTile.getObject().name = name;
		}

		// Update the tiles that are to be removed
		for (var j=0; j<imageTilesToRemove.length; j++) {
			var imageTileToRemove = imageTilesToRemove[j];
			var row = -1;
			var column = i % NUM_COLUMNS;
			var x = (column * imageTileSize) + offsetX;
			var y = (row * imageTileSize) + offsetY;
			var z = 0;
			var name = "imageTile_" + row.toString() + "_" + column.toString();
			imageTileToRemove.setGridPosition(new THREE.Vector3(x, y, z));
			imageTileToRemove.getObject().name = name;
		}
	}

	// Now that the tiles params have been updated, animate them to their new positions
	self.updateTilePositionsOnRowRemoval = function(imageTilesToRemove) {
		// Animate the not-to-be-removed tiles to their new location
		for (var i=0; i<imageTiles.length; i++) {
			var imageTile = imageTiles[i];
			var newY = imageTile.getGridPosition().y;
			TweenLite.to(imageTile.getPosition(), .6, {
				y: newY,
				ease: Quint.easeOut,
				delay: imageTile.getColumn()*.05
			});
		}

		// Move the to-be-removed tiles offscreen
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

	// Remove the tiles to-be-removed from the WebGL scene
	self.removeTilesOnRowRemoval = function(imageTilesToRemove) {
		for (var k=0; k<imageTilesToRemove.length; k++) {
			var object = imageTilesToRemove[k].getObject();
			object.geometry.dispose();
    		object.material.dispose();
    		group.remove(object);
		}
	}

	// Create a new image tile using the snapshot data
	self.createNewImageTile = function(newSnapShotData) {
		var newImageTileIndex = imageTiles.length;
		var imageFileName = newSnapShotData["imageFileName"];
		var fullFolderName = newSnapShotData["fullFolderName"];
		var smallFolderName = newSnapShotData["smallFolderName"];
		// Specify as a new tile, so we can trigger the ripple animation when it is added
		var isNew = true;
		self.createImageTile(newImageTileIndex, imageFileName, fullFolderName, smallFolderName, isNew);
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
				// Bump the imageTile down
				TweenLite.to(imageTile.getPosition(), duration, {
					z:zNew,
					delay:delay,
					ease:Expo.easeOut
				});
				// Return the imageTile back to the plane
				TweenLite.to(imageTile.getPosition(), duration, {
					z:0,
					delay:delay + duration,
					ease:Expo.easeOut
				});
			}
		}
	}

	// Start a subtle and slow animation of the grid tiles
	self.startIdleAnimation = function() {
		console.log("startIdleAnimation");
		canIdlyAnimate = true;
		self.idlyAnimate();
	}

	// Run a lava-lamp like animation that moves the tiles like pistons 
	// along a direction orthogonal to the tiling plane and also
	// rotates the entire tiling to simulate camera motion
	self.idlyAnimate = function() {
		console.log("idlyAnimate", canIdlyAnimate);
		if (canIdlyAnimate == false) {
			return;
		}

		//var duration = (Math.random() * 30) + 10;
		var duration = 100;//(Math.random() * 30) + 10;
		var translateMax = 25;
		// Find how much we need to vertically translate the tiling (yOffset)
		// so that it's center of mass is centered in the window
		var worldOrigin = parent.convertScreenCoordsToWorldCoords(window.innerWidth/2, innerHeight/2, TILING_INIT_Z);
		var tilesCenter = self.findCenterOfTiles();
		var yOffset = worldOrigin.y - tilesCenter.y;
		var newX = (Math.random() * translateMax) - translateMax/2;
		var newY = (Math.random() * translateMax) - translateMax/2 + yOffset;
		var newZ = (Math.random() * translateMax) - translateMax/2;
		
		var rotationMaxX = Math.PI/10;
		var rotationMaxY = Math.PI/4;
		var rotationMaxZ = Math.PI/10;
		var newRotationX = (Math.random() * rotationMaxX) - rotationMaxX/2;
		var newRotationY = (Math.random() * rotationMaxY) - rotationMaxY/2;
		var newRotationZ = (Math.random() * rotationMaxZ) - rotationMaxZ/2;

		// Move the tilings up and down perpendicular to the tiling
		var maxImageTileZ = PISTON_MAX_Z;
		for (var i=0; i<imageTiles.length; i++) {
			var imageTile = imageTiles[i];
			var newImageTileZ = (Math.random() * maxImageTileZ);
			TweenLite.to(imageTile.getObject().position, duration, {
				z: newImageTileZ,
				ease: Linear.easeInOut
			})
		}

		// Rotate the entire tiling
		TweenLite.to(group.rotation, duration, {
			x: newRotationX,
			y: newRotationY,
			z: newRotationZ,
			ease: Linear.easeInOut
		});
		
		// Translate the entire tiling
		TweenLite.to(group.position, duration, {
			x: newX,
			y: newY,
			z: newZ,
			ease: Linear.easeInOut,
			onComplete: self.idlyAnimate
		});
	}

	// Find the center point of the tiling
	// We use this to make sure the idle animation is boxed
	self.findCenterOfTiles = function() {
		var xTotal = 0;
		var yTotal = 0;
		var zTotal = 0;
		var numTiles = imageTiles.length;
		for (var i=0; i<numTiles; i++) {
			var imageTile = imageTiles[i];
			xTotal += imageTile.getPosition().x;
			yTotal += imageTile.getPosition().y;
			zTotal += imageTile.getPosition().z;
		}
		var xAverage = xTotal / numTiles;
		var yAverage = yTotal / numTiles;
		var zAverage = zTotal / numTiles;
		var center = new THREE.Vector3(xAverage, yAverage, zAverage);
		return center;
	}

	// Bring all the idly animated tiles back to the original grid plane
	// This is for when the user first walks up to the mural
	// so that the tiles are back to being easily browsable
	// and will match what they have on their device's touchpad
	self.returnImageTilesToPlane = function(imageTileToExcept) {
		for (var i=0; i<imageTiles.length; i++) {
			var imageTile = imageTiles[i];
			var newZ;
			if (imageTile == imageTileToExcept) {
				newZ = parent.getCameraPreviewZ() - 15;
			}
			else {
				newZ = 0;
			}
			if (imageTile.getPosition().z != newZ) {
				TweenLite.to(imageTile.getPosition(), RETURN_TO_PLANE_TWEEEN_DURATION, {
					z: newZ,
					ease: Quint.easeOut,
					overwrite: true,
				});
			}
		}
	}

	// Given that a mobile client user input event was receive
	// get the tiling ready for browsing and interacing
	self.prepareForInteraction = function() {
		// Clear any pending idle animation timeouts
		clearTimeout(startIdleAnimationTimeoutId);

		// Stop any current tweens on the group
		canIdlyAnimate = false;
		TweenLite.killTweensOf(self.getGroup().position);

		// Center the group
		TweenLite.to(self.getGroup().position, .6, {
			x: 0,
			y: 0,
			z: 0
		});

		// Make the group frontoparallel
		TweenLite.to(self.getGroup().rotation, .6, {
			x: 0,
			y: 0,
			z: 0
		});

		// Return image tiles to the plane
		self.returnImageTilesToPlane(currentImageTile);
	}


	self.init();
}
