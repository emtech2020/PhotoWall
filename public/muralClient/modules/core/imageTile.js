/*
imageTile.js

A single cell in the image grid tiling that displays a user-posted snapshot image
This is the atomic unit of the image tiling
*/

function ImageTile(brain, parent, row, column, imageSize, fullImageUrl, smallImageUrl, isNew) {

	var self = this;
	var object;
	var gridPosition;
	var DEFAULT_IMAGE_URL = "images/soundWave_720x720.jpg";

	self.init = function() {
		self.createObject();
	}

	// Create the WebGL box element
	// and we draw the image on its front facing side
	self.createObject = function() {
		var borderSize = .5;
		var imageGeometrySize = imageSize - borderSize;
		var cubeSizeX = imageGeometrySize;
		var cubeSizeY = imageGeometrySize;
		var cubeSizeZ = imageGeometrySize/7
		var geometry = new THREE.BoxGeometry(cubeSizeX, cubeSizeY, cubeSizeZ);

		var flatMaterial = new THREE.MeshPhongMaterial( { color: 0xdddddd, specular: 0x00BCD4, shininess: 30, shading: THREE.SmoothShading } );
		var texture = THREE.ImageUtils.loadTexture(fullImageUrl, null, self.onImageLoaded, self.onImageLoadError);
		texture.magFilter = THREE.LinearFilter;
    	texture.minFilter = THREE.LinearMipMapLinearFilter;
    	var textureMaterial = new THREE.MeshPhongMaterial({map:texture});
    	var materials = [flatMaterial, flatMaterial, flatMaterial, flatMaterial, textureMaterial, flatMaterial];

		object = new THREE.Mesh( geometry, new THREE.MeshFaceMaterial(materials) );
		object.position.z = -1.01*(cubeSizeZ/2);

		var name = "imageTile_" + row.toString() + "_" + column.toString();
    	object.name = name;
    	object.visible = false;
	}


	////////////////////////////////////
	// accessors
	////////////////////////////////////

	self.getRow = function() { return row; }
	self.setRow = function(newRow) { row = newRow; }
	self.getColumn = function() { return column; }
	self.setColumn = function(newColumn) { column = newColumn; }
	self.getObject = function() { return object; }
	self.getFullImageUrl = function() { return fullImageUrl; }
	// The object position
	self.getPosition = function() { return object.position; }
	// The position in the tiling grid
	self.getGridPosition = function() { return gridPosition; }
	self.setGridPosition = function(newPosition) { gridPosition = newPosition;}


	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Fires when the image tile's image has loaded
	self.onImageLoaded = function() {
		// Track whether the image is new so we know to
		// create the ripple effect when adding it to the scene
		if (isNew == true) {
			parent.onNewImageTileImageLoaded(self);
		} else {
			parent.onImageTileImageLoaded(self);	
		}
	}

	// Fires when the image tile's image could not be loaded
	self.onImageLoadError = function() {
		console.log("onImageLoadError", self.getRow(), self.getColumn());
		self.loadDefaultImage();
	}

	// Fires when the image tile's default image could not be loaded
	self.onDefaultImageLoadError = function() {
		console.log("onDefaultImageLoadError", self.getRow(), self.getColumn());
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// Load the image tile's default image
	self.loadDefaultImage = function() {
		object.material.map = THREE.ImageUtils.loadTexture(DEFAULT_IMAGE_URL, null, self.onImageLoaded, self.onDefaultImageLoadError);
	}


	self.init();
}
