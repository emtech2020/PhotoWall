/*
worldManager.js

Manages the logic and ui for the WebGL ui
Creates the lower level renderer components like camera, lighting, etc
Also handles and routes the user input events to control grid browsing
*/

function WorldManager(brain) {

	var self = this;
	var scene;
	var camera;
	var renderer;
	var directionalLightA;
	var directionalLightB;
	var stats;
	var worldContainer;
	var mesh;
	var CAMERA_INIT_Z = 100;
	var CAMERA_PREVIEW_Z = 20;
	var pointLight;
	var fiducialPoints;
	var promptContainer = null;
	var PROMPT_INACTIVITY_THRESHOLD_DURATION = 15000;
	var amShowingPrompt = true;
	var showPromptTimeoutId;
	var imageTiling;
	var POINT_LIGHT_Z = 10;//8;
	var gridBackdrop;
	var canPreview = false;
	var DIRECTIONAL_LIGHT_MAX_INTENSITY = 1;
	var POINT_LIGHT_MAX_INTENSITY = .8;
	var spotLight;
	var tweenDurationScalar = 1;
	var CAMERA_PREVIEW_MOVE_TWEEN_DURATION = 2 * tweenDurationScalar;
	var CAMERA_UNPREVIEW_MOVE_TWEEN_DURATION = 2 * tweenDurationScalar;
	var POINT_LIGHT_PREVIEW_MOVE_TWEEN_DURATION = .6 * tweenDurationScalar;
	var POINT_LIGHT_PREVIEW_FADE_TWEEN_DURATION = .6 * tweenDurationScalar;
	var POINT_LIGHT_UNPREVIEW_MOVE_TWEEN_DURATION = .6 * tweenDurationScalar;
	var POINT_LIGHT_UNPREVIEW_FADE_TWEEN_DURATION = 1 * tweenDurationScalar;
	var DIRECTIONAL_LIGHT_PREIVEW_FADE_TWEEN_DURATION = .6 * tweenDurationScalar;
	var DIRECTIONAL_LIGHT_UNPREIVEW_FADE_TWEEN_DURATION = .6 * tweenDurationScalar;
	var moveCount = 0;


	self.init = function() {
		self.initWorldContainer();
		self.createScene();
		self.createRenderer();
		self.createCamera();
		self.createOrbitControls();
		self.createDirectionalLight();
		self.createPointLight();
		self.createSpotLight();
		self.createGridBackdrop();
		self.createImageTiling();
		self.createPrompt();
		self.createStats();
		self.animate();
	}
	
	// Initialize the container where we will draw the WebGL content
	self.initWorldContainer = function() {
		worldContainer = document.querySelector("#worldContainer");
		// Fit the container to the window dimensions
		worldContainer.style.width = window.innerWidth + "px";
		worldContainer.style.height = window.innerHeight + "px";
	}

	// Create the WebGL scene
	self.createScene = function() {
		scene = new THREE.Scene();
	}

	// Create the WebGL renderer
	self.createRenderer = function() {
		renderer = new THREE.WebGLRenderer({antialias: true});
		renderer.setClearColor(0x000000);
		renderer.setSize(worldContainer.offsetWidth, worldContainer.offsetHeight);
		worldContainer.appendChild(renderer.domElement);
	}

	// Create the WebGL light
	self.createDirectionalLight = function() {
		var color = 0xffffff;
		var intensity = DIRECTIONAL_LIGHT_MAX_INTENSITY;

		directionalLightA = new THREE.DirectionalLight(color, intensity);
    	directionalLightA.position.set(-1, 1, 1).normalize();
    	scene.add(directionalLightA);

		//directionalLightB = new THREE.DirectionalLight(color, intensity);
    	//directionalLightB.position.set(1, 1, 1).normalize();
    	//scene.add(directionalLightB);
	}

	// Create the WebGL point light (a light that moves around in three-space)
	self.createPointLight = function() {
		var color = 0xffffff;
		var intensity = 0;
		var distance = 50
   		pointLight = new THREE.PointLight(color, intensity, distance);
		pointLight.position.set(0, 0, POINT_LIGHT_Z);
		scene.add(pointLight);
	}

	// Create the WebGL spot light
	self.createSpotLight = function() {
		spotLight = new THREE.SpotLight(0xffffff, .25, 40, Math.PI/5);
		// Make spotlight follow camera
		camera.add(spotLight);
		spotLight.position.set(0,0,1);
		spotLight.target = camera;
	}

	// Create the background grid
	// It's literally a grid of horizontal and vertical lines
	// meant to add more depth to the scene
	self.createGridBackdrop = function() {
		var size = 700;
		var step = 25;
		gridBackdrop = new THREE.GridHelper(size, step);
		gridBackdrop.rotation.x = Math.PI/2;
		gridBackdrop.rotation.z = Math.PI/10;
		gridBackdrop.position.set(0, 0, -500);
		gridBackdrop.setColors(new THREE.Color(0x222222), new THREE.Color(0x222222));
		scene.add(gridBackdrop);
	}

	// Create all the images that will make up the grid tiling
	self.createImageTiling = function() {
		imageTiling = new ImageTiling(brain, self);
		scene.add(imageTiling.getGroup());
	}

	// Create the html overlay prompt that will instruct the user
	self.createPrompt = function() {
		promptContainer = document.querySelector("#promptContainer");
	}

	// Create the WebGL camera
	self.createCamera = function() {
		camera = new THREE.PerspectiveCamera(45, worldContainer.offsetWidth/worldContainer.offsetHeight, 1, 10000);
		camera.position.x = 0;
		camera.position.y = 0;
		camera.position.z = CAMERA_INIT_Z;
		scene.add(camera);
	}

	// Create the mouse camera controls
	// Used for debugging
	self.createOrbitControls = function() {
		orbitControls = new THREE.OrbitControls( camera );
		orbitControls.damping = 0.2;
		orbitControls.addEventListener("change", self.render);
	}

	// Create the framerate stats ui
	self.createStats = function() {
		stats = new Stats();
		stats.domElement.style.position = 'absolute';
		stats.domElement.style.top = '0px';
		worldContainer.appendChild(stats.domElement);
	}


	////////////////////////////////////
	// accessors
	////////////////////////////////////

	self.getScene = function() { return scene; }
	self.getFiducialPoints = function() { return fiducialPoints; }
	self.getCameraInitZ = function() { return CAMERA_INIT_Z; }
	self.getTilingParams = function() { return imageTiling.getTilingParams(); }
	self.getCameraPreviewZ = function() { return CAMERA_PREVIEW_Z; }
	

	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Fires when the latest image data has been received
	self.onImageUrlDataReceived = function(imageUrlData) {
		// Generate the points we use to determine tile size and position
		self.createFiducialPoints();
		// Tell the image tiling about the new image data
		imageTiling.createImageTiles(imageUrlData);
	}

	// Fires when a mobile client touch pad touch event has been received
	self.onImageTileTouchEventReceived = function(imageTileTouchEvent) {
		console.log("onImageTileTouchEventReceived");
		// Show or hide the prompt based on the event type
		self.updatePromptVisibilityOnTouchEvent(imageTileTouchEvent);

		// Extract the touch event data
		var type = imageTileTouchEvent["t"];
		var row = imageTileTouchEvent["r"];
		var column = imageTileTouchEvent["c"];
		// Reference the correlate image tile
		var imageTile = imageTiling.getImageTile(row, column);
		
		// Route the event based on event type
		if (type == "touchstart") {
			self.onImageTileTouchStart(imageTile);
		} else if (type == "touchmove") {
			self.onImageTileTouchMove(imageTile);
		} else if (type == "touchend") {
			self.onImageTileTouchEnd(imageTile);
		}
	}

	// Fires when a mobile client touch pad image tile touch event starts
	self.onImageTileTouchStart = function(imageTile) {
		console.log("worldManager onImageTileTouchStart");
		// Disable previewing (temporarily)
		canPreview = false;
		// Inform the tiling
		imageTiling.onImageTileTouchStart(imageTile);
	}

	// Fires when a mobile client touch pad image tile touch move event occurs
	self.onImageTileTouchMove = function(imageTile) {
		console.log("worldManager onImageTileTouchMove");
		// If the current tile can be previewed
		if (canPreview == true) {
			// Zoom into the tile
			self.previewImageTile(imageTile);
		}
		// Inform the tiling
		imageTiling.onImageTileTouchMove(imageTile);
	}

	// Fires when a mobile client touch pad image tile touch event ends
	self.onImageTileTouchEnd = function(imageTile) {
		console.log("worldManager onImageTileTouchEnd");
		self.unPreviewImageTile(imageTile);
		// Inform the tiling
		imageTiling.onImageTileTouchEnd(imageTile);
	}

	// Fires when new snapshot data is received
	self.onNewSnapShotDataReceived = function(newSnapShotData) {
		console.log("onNewSnapShotDataReceived", newSnapShotData);
		// Tell the image tiling about it
		imageTiling.onNewSnapShotDataReceived(newSnapShotData);
	}

	// Fires when the window resizes
	self.onWindowResize = function() {
		// Update the WebGL scene dimensions so the content renders properly
		windowHalfX = worldContainer.offsetWidth / 2;
		windowHalfY = worldContainer.offsetHeight / 2;
		camera.aspect = worldContainer.offsetWidth / worldContainer.offsetHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(worldContainer.offsetWidth, worldContainer.offsetHeight);
	}

	// Fires when all of the image tiles have returned to their original in-plane position
	self.onTouchStartImageTilesReturnedToPlane = function() {
		// Allow preview zooming
		canPreview = true;
		// Zoom in on the current tile
		self.previewImageTile(imageTiling.getCurrentImageTile());
	}

	// Fires when the mobile client user input event has been received
	self.onMobileClientUserInputEventReceived = function() {
		// Turn off preview zooming
		canPreview = false;
		self.updatePromptVisibilityOnMobileClientUserInputEvent();
		// Inform the tiling
		imageTiling.onMobileClientUserInputEventReceived();
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// Create the test points at the etremes of the screen so that we can determine
	// how big the image tiles should be
	// This is all based on projecting from screen coords to world coords
	self.createFiducialPoints = function() {
		topLeftPosition = self.convertScreenCoordsToWorldCoords(0, 0, imageTiling.getTilingInitZ());
		topRightPosition = self.convertScreenCoordsToWorldCoords(window.innerWidth, 0, imageTiling.getTilingInitZ());
		bottomLeftPosition = self.convertScreenCoordsToWorldCoords(0, window.innerHeight, imageTiling.getTilingInitZ());
		bottomRightPosition = self.convertScreenCoordsToWorldCoords(window.innerWidth, window.innerHeight, imageTiling.getTilingInitZ());

		fiducialPoints = {};
		fiducialPoints["topLeft"] = self.createFiducialPoint(topLeftPosition);
		fiducialPoints["topRight"] = self.createFiducialPoint(topRightPosition);
		fiducialPoints["bottomLeft"] = self.createFiducialPoint(bottomLeftPosition);
		fiducialPoints["bottomRight"] = self.createFiducialPoint(bottomRightPosition);
	}

	// Create a test point at the given position
	self.createFiducialPoint = function(position) {
		var fiducialPoint = new FiducialPoint(brain, self);
		scene.add(fiducialPoint.getObject());
		fiducialPoint.getPosition().x = position.x;
		fiducialPoint.getPosition().y = position.y;
		fiducialPoint.getPosition().z = position.z;
		return fiducialPoint;
	}

	// Only seems to work for worldZ of zero
	self.convertScreenCoordsToWorldCoords = function(screenX, screenY, worldZ) {
		var geometry = new THREE.PlaneBufferGeometry(5000, 5000, 32);
		var material = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide} );
		var plane = new THREE.Mesh( geometry, material );
		plane.position.z = worldZ;
		scene.add(plane);

		var screenPoint = new THREE.Vector2();
		screenPoint.x =	( screenX / window.innerWidth ) * 2 - 1;
		screenPoint.y =	-( screenY / window.innerHeight ) * 2 + 1;

		var raycaster = new THREE.Raycaster();
		raycaster.setFromCamera( screenPoint, camera );
		var intersects = raycaster.intersectObjects( scene.children );
		var intersectionPoint = intersects[0].point;

		scene.remove(plane);

		return intersectionPoint;
	}

	self.drawTinyPlane = function(position) {
		var geometry = new THREE.PlaneBufferGeometry(2, 2, 32);
		var material = new THREE.MeshBasicMaterial( {color: 0x00ff00, side: THREE.DoubleSide} );
		var plane = new THREE.Mesh(geometry, material);
		scene.add(plane);
		plane.position.x = position.x;
		plane.position.y = position.y;
		plane.position.z = position.z;
	}

	// The WebGL redraw method
	self.animate = function() {
		// Keep redrawing when the system is ready
		requestAnimationFrame(self.animate);
		// Render out the graphics
		self.render();
		// Update the framerate stats ui
		stats.update();
	}

	// Actually draw the scene
	self.render = function() {
		renderer.render(scene, camera);
	}

	// Zoom in to the given tile so it is more easily browsable
	self.previewImageTile = function(imageTile) {
		console.log("previewImageTile", imageTile, imageTile.getRow(), imageTile.getColumn());
		// Move camera above current image tile
		var newCameraPosition = new THREE.Vector3(
			imageTile.getGridPosition().x,
			imageTile.getGridPosition().y,
			CAMERA_PREVIEW_Z
			);
		self.moveCamera(newCameraPosition, CAMERA_PREVIEW_MOVE_TWEEN_DURATION);
		
		// Move the point light
		var newPointLightPosition = new THREE.Vector3(
			imageTile.getGridPosition().x,
			imageTile.getGridPosition().y,
			POINT_LIGHT_Z
			);
		self.movePointLight(newPointLightPosition, POINT_LIGHT_PREVIEW_MOVE_TWEEN_DURATION);

		// Turn on the point light
		var newPointLightIntensity = POINT_LIGHT_MAX_INTENSITY;
		self.fadePointLight(newPointLightIntensity, POINT_LIGHT_PREVIEW_FADE_TWEEN_DURATION);

		// Turn off the directional light
		var newDirectionalLightIntensity = 0;
		self.fadeDirectionalLight(newDirectionalLightIntensity, DIRECTIONAL_LIGHT_PREIVEW_FADE_TWEEN_DURATION);		
	}

	// Unzoom away from the given tile
	self.unPreviewImageTile = function(imageTile) {
		// Move camera back to initial position
		var newCameraPosition = new THREE.Vector3(
			0,
			0,
			CAMERA_INIT_Z
			);
		self.moveCamera(newCameraPosition, CAMERA_UNPREVIEW_MOVE_TWEEN_DURATION);
		
		// Move the point light
		var newPointLightPosition = new THREE.Vector3(
			imageTile.getGridPosition().x,
			imageTile.getGridPosition().y
			);
		self.movePointLight(newPointLightPosition, POINT_LIGHT_UNPREVIEW_MOVE_TWEEN_DURATION);

		// Turn off the point light
		var newPointLightIntensity = 0;
		self.fadePointLight(newPointLightIntensity, POINT_LIGHT_UNPREVIEW_FADE_TWEEN_DURATION);

		// Turn on the directional light
		var newDirectionalLightIntensity = DIRECTIONAL_LIGHT_MAX_INTENSITY;
		self.fadeDirectionalLight(newDirectionalLightIntensity, DIRECTIONAL_LIGHT_UNPREIVEW_FADE_TWEEN_DURATION);
	}

	// Move the camera to the given position via animation
	self.moveCamera = function(newPosition, duration) {
		console.log('moveCamera', newPosition.x, newPosition.y, newPosition.z);
		if (camera.position.equals(newPosition) == false) {
			console.log('moveCamera', 'a');
			moveCount += 1;
			console.log('moveCount:', moveCount);
			TweenLite.to(camera.position, duration, {
				x: newPosition.x,
				y: newPosition.y,
				z: newPosition.z,
				ease: Quint.easeOut,
				overwrite: true
			});
		}
	}

	// Move the point light to the given position via animation
	self.movePointLight = function(newPosition, duration) {
		if (pointLight.position.equals(newPosition) == false) {
			TweenLite.to(pointLight.position, duration, {
				x: newPosition.x,
				y: newPosition.y,
				ease:Quint.easeOut
			});			
		}
	}

	// Fade the point light to the new intensity via animation
	self.fadePointLight = function(newIntensity, duration) {
		if (pointLight.intensity != newIntensity) {
			TweenLite.to(pointLight, .6, {
				intensity: newIntensity,
				ease: Quint.easeOut
			});
		}
	}

	// Fade the directional light to the new intensity via animation
	self.fadeDirectionalLight = function(newIntensity, duration) {
		if (directionalLightA.intensity != newIntensity) {
			TweenLite.to(directionalLightA, duration, {
				intensity: newIntensity,
				ease: Quint.easeOut
			});
		}

		/*
		if (directionalLightB.intensity != newIntensity) {
			TweenLite.to(directionalLightB, duration, {
				intensity: newIntensity,
				ease: Quint.easeOut
			});
		}
		*/
	}

	// Update the prompt's visibility based on the type of mobile client touch event
	self.updatePromptVisibilityOnTouchEvent = function(imageTileTouchEvent) {
		var type = imageTileTouchEvent["t"];
		// If the event type is of type start of move
		if ((type == "touchstart") || (type == "touchmove")) {
			clearTimeout(showPromptTimeoutId);
			// Bring back the prompt after brief inactivity
			showPromptTimeoutId = setTimeout(self.showPrompt, PROMPT_INACTIVITY_THRESHOLD_DURATION);
			// If we are showing the prompt
			if (amShowingPrompt == true) {
				// Remove the prompt from view
				self.hidePrompt();
			}
		}
	}

	// Update the prompt's visibility
	self.updatePromptVisibilityOnMobileClientUserInputEvent = function() {
		clearTimeout(showPromptTimeoutId);
		// Bring back the prompt after brief inactivity
		showPromptTimeoutId = setTimeout(self.showPrompt, PROMPT_INACTIVITY_THRESHOLD_DURATION);
		// If we are showing the prompt
		if (amShowingPrompt == true) {
			self.hidePrompt();
		}
	}

	// Show the user instructional prompt
	self.showPrompt = function() {
		TweenLite.to(promptContainer, .6, {
			y:0, 
			ease:Quint.easeOut,
			opacity: 1
		});
	}

	// Hide the user instructional prompt
	self.hidePrompt = function() {
		TweenLite.to(promptContainer, .6, {
			y:promptContainer.offsetHeight,
			ease:Quint.easeOut,
			onComplete: function() {
				promptContainer.style.opacity = 0;
			}
		});
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

	 self.createObject = function() {
		var geometry = new THREE.PlaneBufferGeometry(1, 1, 1);
		var material = new THREE.MeshBasicMaterial({color: 0x00ff00});
		object = new THREE.Mesh(geometry, material);
		object.visible = false;
	 }


	////////////////////////////////////
	// accessors
	////////////////////////////////////

	 self.getObject = function() { return object; }
	 self.getPosition = function() { return object.position; }
	 self.setPosition = function(newPosition) {
	 	self.getPosition().x = newPosition.x;
	 	self.getPosition().y = newPosition.y;
	 	self.getPosition().z = newPosition.z;
	 }


	 self.init();
}




































