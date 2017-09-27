/*
cameraInterface.js

Manages camera video feed
flipping between front and rear cameras
along with taking stills
*/

function CameraInterface(brain) {

	var self = this;
	var cameraContainer;
	var cameraVideo;
	var cameraCanvas;
	var cameraCanvasContext;
	var videoStream;
  	var videoSources;
  	var videoIntrinsicDimensions;
  	var currentVideoSourceId;
	var snapShotContainer;
	var snapShot;
	var takeSnapShotButton;
	var toggleVideoSourceButton;
	var toggleVideoSourceButtonIcon;
  	var cameraControlsContainer;
  	var SNAPSHOT_WIDTH = 720;
  	var SNAPSHOT_HEIGHT = 720;
  	var snapShotReviewContainer;
  	var snapShotReview;
  	var acceptSnapShotButton;
  	var rejectSnapShotButton;
  	var toggleVideoSourceButton;
  	var reviewSnapShotImageString;
  	var toast;
  	var frontFacingVideoSource = null;
  	var backFacingVideoSource = null;
  	var mediaCaptureInput;

	self.init = function() {
		self.initSnapShot();
		self.initToast();
		self.initCamera();
		self.initVideoSourceToggle();		
		self.initCameraControlsContainer();
		self.listenForWindowResize();
		self.listenForVisibilityStateChange();
	}


	self.initCamera = function() {
		// Bind to the camera and camera video containers
		cameraContainer = document.querySelector("cameraContainer");
		cameraVideo = document.querySelector("#cameraVideo");
		// Listen for when the camera meta data has loaded so we can set up appropriately
		cameraVideo.addEventListener("loadedmetadata", self.onCameraVideoMetadataLoaded, false);
		cameraVideo.src = null;
		cameraCanvas = document.querySelector("#cameraCanvas");
		cameraCanvasContext = cameraCanvas.getContext("2d");
		// Bind to the button that toggles the front or rear camera feed
		toggleVideoSourceButton = document.querySelector("#toggleVideoSourceButton");
		videoSources = [];
		videoStream = null;
		mediaCaptureInput = document.querySelector("#mediaCaptureInput");
		// Listen for when photo has been taken
		mediaCaptureInput.addEventListener("change", self.onMediaCaptureInputChange)
		// Consolidate the getUserMedia vendor objects
		navigator.getUserMedia  = navigator.getUserMedia || 
			navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia;
        // Gather all possible video sources
		self.getVideoSources();
	}

	// Initialize the button that toggles front and rear camera
	self.initVideoSourceToggle = function() {
		toggleVideoSourceButton = document.querySelector("#toggleVideoSourceButton");;
  		toggleVideoSourceButtonIcon = document.querySelector("#toggleVideoSourceButtonIcon");
		toggleVideoSourceButton.addEventListener("click", self.onToggleVideoSourceButtonClick);
	}
	
	// Initialize the container where snapshots are drawn
	self.initSnapShot = function() {
		snapShotContainer = document.querySelector("#snapShotContainer");
  		takeSnapShotButton = document.querySelector("#takeSnapShotButton");
  		takeSnapShotButton.addEventListener("click", self.onTakeSnapShotButtonClick);
  		snapShotReviewContainer = document.querySelector("#snapShotReviewContainer");
  		snapShotReview = document.querySelector("#snapShotReview");
  		acceptSnapShotButton = document.querySelector("#acceptSnapShotButton");
  		acceptSnapShotButton.addEventListener("click", self.onAcceptSnapShotButtonClick);
  		rejectSnapShotButton = document.querySelector("#rejectSnapShotButton");
  		rejectSnapShotButton.addEventListener("click", self.onRejectSnapShotButtonClick);
	}

	// Initialize the container that houses the camera controls
	self.initCameraControlsContainer = function() {
		cameraControlsContainer = document.querySelector("#cameraControlsContainer");
	}

	// Initialize a toast that can message various events
	self.initToast = function() {
		toast = document.querySelector("#toast");
	}

	// Bind to the window resize event
	self.listenForWindowResize = function() {
		window.addEventListener("resize", self.onWindowResize);
	}

	// Make sure we know when the app becomes active
	// so we can inform the mural client
	self.listenForVisibilityStateChange = function() {
		// window.onBlur doesn't seem to be called 
		// when user sleeps phone or presses home button
		// so we use webkitvisibilitychange instead
		document.addEventListener('webkitvisibilitychange', self.onWebKitVisibilityChange);
	}


	////////////////////////////////////
	// callbacks
	////////////////////////////////////

	// Fires when the interactive state of the app has changed
	self.onWebKitVisibilityChange = function(event) {
		console.log("onWebKitVisibilityChange", event.srcElement.visibilityState);

		// If the browser doesn't support camera video feed 
		if (self.checkIfBrowserSupportsMediaStreamTrack() == false) {
			return;
		}

		// Toggle the video logic and ui accordingly based on current visibility
		var visibilityState = event.srcElement.visibilityState;
		if (visibilityState == "hidden") {
			// stop the video streaming
			self.stopVideoStream();
		} else if (visibilityState == "visible") {
			//start the video streaming
			self.startVideoStream();
		}
	}

	// Fires when all the possible ideo sources have been determined
	self.onGetSourcesComplete = function(sources) {
		console.log("onGetSourcesComplete");
		// Store the sources
  		for (var i = 0; i !== sources.length; ++i) {
    		var source = sources[i];
    		if (source.kind === 'video') {
      			videoSources.push(source);
    		}
  		}

  		var numVideoSources = videoSources.length;
  		if (numVideoSources > 0) {
  			// Bind to the front and rear cameras
  			self.assignCameraVideoSources(videoSources);
  			if (frontFacingVideoSource != null) {
  				currentVideoSourceId = frontFacingVideoSource.id;
  			} else if (backFacingVideoSource != null) {
  				currentVideoSourceId = backFacingVideoSource.id;
  			} else {
  				currentVideoSourceId = videoSources[0].id;
  			}
  			// Kick off the video
  			self.startVideoStream();
  		}

  		// If we only have one source
  		// don't show the toggle button
  		if (numVideoSources == 1) {
  			self.hideToggleVideoSourcesButton();
  		}
	}

	// Fires when the camera has been successfully interfaced with
	self.onGetUserMediaComplete = function(stream) {
		console.log("onGetUserMediaComplete");
		// Bind to the given stream and set the video container's video to be that stream
		videoStream = stream;
		cameraVideo.src = window.URL.createObjectURL(stream);
	}

	// Fires when the camera's video metadata has been discovered
	self.onCameraVideoMetadataLoaded = function(event) {
		console.log("onCameraVideoMetadataLoaded");
		// Store the native dimensions
		videoIntrinsicDimensions = {
			"width":cameraVideo.videoWidth,
			"height":cameraVideo.videoHeight
		};

		// Delay the camera feed briefly since without
		// the delay, the feed sometimes freezes at startup
		setTimeout(function() {
			// Start the ui video
			cameraVideo.play();
			// Update the container dimensions now that we can measure it
			self.onWindowResize();
			// Show the camera feed
			cameraVideoContainer.style.visibility = "visible";
			// Tell the parent about the video being ready
			brain.onVideoReady();
		}, 100);
	}

	// Fires when an error occurs when trying
	// to interface with the camera
	self.onGetUserMediaError = function(error) {
		console.log("onGetUserMediaError", error);
	}

	// Fires when the toggle video button is clicked
	self.onToggleVideoSourceButtonClick = function(event) {
		// Tell the server about it
		brain.getServerManager().sendUserInputEventToServer();
		// Toggle the video source
		self.toggleVideoSource();
	}

	// Fires when the window is resized
	self.onWindowResize = function() {
		// Fit everything on the screen

		videoIntrinsicDimensions = {
			"width":cameraVideo.videoWidth,
			"height":cameraVideo.videoHeight
		};

		if (self.checkIfInPortraitMode() == true) {
			// Set the video width (needs to be smaller than full
			// width to accomadate touchpad size when in portrait mode)
			cameraVideo.width = .85*window.innerWidth;
			cameraVideoContainer.style.left = "7.5%";

			// Resize the snapShot review container
			snapShotReviewContainer.style.width = window.innerWidth + "px";
			snapShotReviewContainer.style.height = window.innerHeight + "px";
			snapShotReview.style.width = window.innerWidth + "px";
			rejectSnapShotButton.style.top = "82%";//window.innerWidth + 60 + "px";
			rejectSnapShotButton.style.left = "28%";
			acceptSnapShotButton.style.top = "82%";//window.innerWidth + 600 + "px";
			acceptSnapShotButton.style.left = "62%";

			// Position the camera controls
			var separatorY =  .85*window.innerWidth;
			if (self.checkIfBrowserSupportsMediaStreamTrack() == true) {
				takeSnapShotButton.style.top = separatorY - 80 + "px";
				takeSnapShotButton.style.left = window.innerWidth - 110 + "px";
			} else {
				takeSnapShotButton.style.top = window.innerWidth/2 - 28 + "px";
				takeSnapShotButton.style.left = window.innerWidth/2 - 28 + "px";
			}
			toggleVideoSourceButton.style.top = separatorY - 65 + "px";
			toggleVideoSourceButton.style.left = window.innerWidth - 160 + "px";

			// Position the toast
			toast.style.top = window.innerHeight + "px";
		} else {
			// Nearly fill in the video horizontally
			cameraVideo.width = .85*window.innerWidth;
			cameraVideoContainer.style.left = "0";

			//Resize the snapShot review container
			snapShotReviewContainer.style.width = window.innerWidth + "px";
			snapShotReviewContainer.style.height = window.innerHeight + "px";
			snapShotReview.style.width = window.innerHeight + "px";
			rejectSnapShotButton.style.top = window.innerHeight/2 - 20 + "px";
			rejectSnapShotButton.style.left = "60%";
			acceptSnapShotButton.style.top =  window.innerHeight/2 - 20 + "px";
			acceptSnapShotButton.style.left = "80%";

			// Position the camera controls
			if (self.checkIfBrowserSupportsMediaStreamTrack() == true) {
				takeSnapShotButton.style.top = window.innerHeight - 80 + "px";
				takeSnapShotButton.style.left = window.innerWidth/2 - 100 + "px";
			} else {
				takeSnapShotButton.style.top = window.innerHeight/2 - 28 + "px";
				takeSnapShotButton.style.left = window.innerHeight/2 - 28 + "px";
			}
			toggleVideoSourceButton.style.top = window.innerHeight - 65 + "px";
			toggleVideoSourceButton.style.left = window.innerWidth/2 - 150 + "px";

			// Position the toast
			toast.style.top = window.innerHeight + "px";
		}
	}

	// Fires when the take snapshot button is clicked
	self.onTakeSnapShotButtonClick = function() {
		// If the browser supports camera video feed
		if (self.checkIfBrowserSupportsMediaStreamTrack() == true) {
			// Tell the server about a user input event 
			brain.getServerManager().sendUserInputEventToServer();
			// Grab the current frame from the video feed
			self.takeSnapShot();
		} else {
			// Otherwise, tell the browser to take a still
			// This is so that we can still get photos from those browsers
			// that won't let us show a video feed
			mediaCaptureInput.click();
		}
	}

	// Fires when the toggle video button hide animation completes
	self.onHideToggleVideoSourcesButtonComplete = function() {
		// Don't allow for any touches on it
		toggleVideoSourceButton.visibility = "hidden";
	}

	// Fires when the user taps the accept snapshot button
	self.onAcceptSnapShotButtonClick = function() {
		// Tell the server about a user input event
		brain.getServerManager().sendUserInputEventToServer();
		// Send the snapshot to the server
		self.sendSnapShotToServer(reviewSnapShotImageString);
		// Hide the preview container
		self.hideSnapShotReviewContainer();
	}

	// Fires when the user taps the reject snapshot button
	self.onRejectSnapShotButtonClick = function() {
		// Tell the server about the input event
		brain.getServerManager().sendUserInputEventToServer();
		// Hide the preview container
		self.hideSnapShotReviewContainer();
	}

	// Fires when the hide snapshot preview container animation completes
	self.onHideSnapShotReviewContainerComplete = function() {
		// Don't draw the element 
		snapShotReviewContainer.style.display = "none";
		// Start the camear video back up
		cameraVideo.play();
	}

	// Fires when the server responds with info about the snapshot upload
	self.onImageSavedMessageReceived = function(wasSuccessful) {
		// If the image save failed
		if (wasSuccessful == false) {
			// Tell the user about it briefly
			toastText.innerText = "Photo upload failed";
			self.showToast();
			setTimeout(self.hideToast, 3000);
		}
	}

	// Fires when a camera snapshot has occurred
	self.onMediaCaptureInputChange = function(event) {
		if (this.files.length == 0) {
			return;
		}
		// Get the returned image
		var imageFile = this.files[0];
		var image = new Image();
		// Listen for the image load
		image.addEventListener("load", function() {
			// Get the image exif data
			EXIF.getData(image, function() {
				self.onGetMediaCaptureInputImageExifData(image);
			});
		});
		// Load the image
		var url = window.URL ? window.URL : window.webkitURL;
		image.src = url.createObjectURL(imageFile);
	}

	// Fires when the image exif data has been retrieved
	self.onGetMediaCaptureInputImageExifData = function(image) {
		//alert(EXIF.pretty(image));
		var exifOrientation = parseInt(image.exifdata.Orientation);

		var imageWidth;
		var imageHeight;
		var transform;
		
		// Update the dimensions to use based on
		// the given exif orientation
		if(exifOrientation == 8) {
            imageWidth = image.height;
            imageHeight = image.width;
            transform = "left";
        } else if(exifOrientation == 6) {
            imageWidth = image.height;
            imageHeight = image.width;
            transform = "right";
        } else if(exifOrientation == 1) {
            imageWidth = image.width;
            imageHeight = image.height;
        } else if(exifOrientation == 3) {
            imageWidth = image.width;
            imageHeight = image.height;
            transform = "flip";
        } else {
            imageWidth = image.width;
            imageHeight = image.height;
        }

        // Bound the dimensions
        var MAX_WIDTH = SNAPSHOT_WIDTH;
        var MAX_HEIGHT = SNAPSHOT_HEIGHT;
        if (imageWidth/MAX_WIDTH > imageHeight/MAX_HEIGHT) {
            if (imageWidth > MAX_WIDTH) {
                imageHeight *= MAX_WIDTH / imageWidth;
                imageWidth = MAX_WIDTH;
            }
        } else {
            if (imageHeight > MAX_HEIGHT) {
                imageWidth *= MAX_HEIGHT / imageHeight;
                imageHeight = MAX_HEIGHT;
            }
        }

        // Draw the resultant image into a temporary canvas
        // so we can then crop it in another canvas
        self.drawMediaCaptureInputImageToTempCanvas(image, imageWidth, imageHeight, transform);
	}

	// Take the given image and first draw into a temporary canvas
	// and then we take the data url from that canvas 
	// and load a cropped version into the cameraCanvas
	// The transform needed was determined by examining the exif data
	self.drawMediaCaptureInputImageToTempCanvas = function(image, imageWidth, imageHeight, transform) {
       	var tempCanvas = document.createElement("canvas");
        var tempCanvasContext = tempCanvas.getContext("2d");
        tempCanvas.width = imageWidth;
        tempCanvas.height = imageHeight;
		if(transform == 'left') {
            tempCanvasContext.setTransform(0, -1, 1, 0, 0, imageHeight);
            tempCanvasContext.drawImage(image, 0, 0, imageHeight, imageWidth);
        } else if(transform == 'right') {
            tempCanvasContext.setTransform(0, 1, -1, 0, imageWidth, 0);
            tempCanvasContext.drawImage(image, 0, 0, imageHeight, imageWidth);
        } else if(transform == 'flip') {
            tempCanvasContext.setTransform(1, 0, 0, -1, 0, imageHeight);
            tempCanvasContext.drawImage(image, 0, 0, imageWidth, imageHeight);
        } else {
            tempCanvasContext.setTransform(1, 0, 0, 1, 0, 0);
            tempCanvasContext.drawImage(image, 0, 0, imageWidth, imageHeight);
        }
        tempCanvasContext.setTransform(1, 0, 0, 1, 0, 0);

        // Listen for the temp image load
        var tempImage = document.createElement("img");
        tempImage.addEventListener("load", function() {
        	self.onMediaCaptureInputTempImageLoad(tempImage);
        });
        // Load the temp image
        var tempBase64ImageString = tempCanvas.toDataURL('image/jpeg');
        tempImage.setAttribute("src", tempBase64ImageString);

        // Release the src data
        var url = window.URL ? window.URL : window.webkitURL;
		url.revokeObjectURL(image.src);
	}

	// Fires when the snapshot has been loaded into the temp image container
	self.onMediaCaptureInputTempImageLoad = function(tempImage) {
        cameraCanvas.width = SNAPSHOT_WIDTH;
        cameraCanvas.height = SNAPSHOT_HEIGHT;

        var startX;
        var startY;
		var sourceDrawWidth;
		var sourceDrawHeight;         

		// Specify the final crop parameters
		// based on being in portrait or landscape
		if (tempImage.naturalHeight >= tempImage.naturalWidth) {
            startX = 0;
            startY = (tempImage.naturalHeight - tempImage.naturalWidth)/2;
            sourceDrawWidth = tempImage.naturalWidth;
            sourceDrawHeight = tempImage.naturalWidth;
		} else {
			startX = (tempImage.naturalWidth - tempImage.naturalHeight)/2;
			startY = 0;
			sourceDrawWidth = tempImage.naturalHeight;
			sourceDrawHeight = tempImage.naturalHeight;
		}

		// Draw the final image, cropping appropriately
        cameraCanvasContext.drawImage(
  			tempImage, 
			startX,
			startY, 
			sourceDrawWidth,
			sourceDrawHeight,
			0,
			0,
			SNAPSHOT_WIDTH, 
			SNAPSHOT_HEIGHT
        );
        // Extract the final cropped image from the canvas
		var base64ImageString = cameraCanvas.toDataURL('image/jpeg');
		reviewSnapShotImageString = base64ImageString;
		// Load the image into the review image
		snapShotReview.setAttribute("src", base64ImageString);
		// Show the review container
		self.showSnapShotReviewContainer();

		// Release the src data
		var url = window.URL ? window.URL : window.webkitURL;
		url.revokeObjectURL(tempImage.src);
	}


	////////////////////////////////////
	// utilities
	////////////////////////////////////

	// Check if the browser supports camera video feed
	self.checkIfBrowserSupportsMediaStreamTrack = function() {
		if (typeof MediaStreamTrack === 'undefined') {
			return false;
		}
		return true;
	}

	// Get a list of all the possible video feeds
	self.getVideoSources = function() {
		// If camera video feed is not supported
		if (self.checkIfBrowserSupportsMediaStreamTrack() == false) {
			console.log("MediaStreamTrack camera interface not supported");
			// Hide the video container and relevant controls
			document.querySelector("#cameraVideo").style.visibility = "hidden";
			//document.querySelector("#errorTextContainer").style.display = "block";
			document.querySelector("#toast").style.display = "none";
			document.querySelector("#toggleVideoSourceButton").style.display = "none"
			// Fire off a resize event to readjust the elements
			self.onWindowResize();
			// Tell the brain that the camera is ready to take snapshots
			brain.onMediaCaptureInputReady();
		} else {
			// Otherwise kick off the camera query
  			//MediaStreamTrack.getSources(self.onGetSourcesComplete);
  			navigator.mediaDevices.enumerateDevices();
		}
	}

	// Loop through the video sources and bind 
	// to the front and rear cameras
	self.assignCameraVideoSources = function(videoSources) {
		console.log('assignCameraVideoSources');
		// Find the front and back cameras
		for (var i=0; i<videoSources.length; i++) {
			var videoSource = videoSources[i];
			var videoSourceLabel = videoSource.label;
			if (videoSourceLabel.indexOf("front") != -1) {
				frontFacingVideoSource = videoSource;
			}
			else if (videoSourceLabel.indexOf("back") != -1) {
				backFacingVideoSource = videoSource;
			}
		}
	}

	// Kick off the camera video
	self.startVideoStream = function() {
		console.log("startVideoStream");
		// Check that the browser supports getUserMedia
		if (navigator.getUserMedia) {
			// Specify requisite and optional specs
			var constraints = {
				video: {
			    	mandatory: {minWidth: 1280, minHeight: 720},
					optional: [{sourceId: currentVideoSourceId}]
  				}
			};
			// Fire the query and pass the callbacks
			navigator.getUserMedia(constraints, self.onGetUserMediaComplete, self.onGetUserMediaError);
		} else {
			console.log("could not find any streams");
		}		
	}

	// Stop the camera video feed
	self.stopVideoStream = function() {
		console.log("stopVideoStream");
		if (videoStream != null) {	
			videoStream.getTracks()[0].stop();
		}
		cameraVideo.src = null;
	}

	// Flip between the front and rear camera
	self.toggleVideoSource = function() {
		if ((frontFacingVideoSource != null) && (backFacingVideoSource != null)) {
			if (currentVideoSourceId == frontFacingVideoSource.id) {
				currentVideoSourceId = backFacingVideoSource.id;
				toggleVideoSourceButtonIcon.innerText = "camera_rear";
			} else {
				currentVideoSourceId = frontFacingVideoSource.id;
				toggleVideoSourceButtonIcon.innerText = "camera_front";
			}
		} else {
			for (var i=0; i<videoSources.length; i++) {
				var videoSource = videoSources[i];
				if (currentVideoSourceId != videoSource.id) {
					currentVideoSourceId = videoSource.id;
					if (toggleVideoSourceButtonIcon.innerText == "camera_rear") {
						toggleVideoSourceButtonIcon.innerText = "camera_front";
					} else {
						toggleVideoSourceButtonIcon.innerText = "camera_rear";
					}
					return;
				}
			}
		}

		self.stopVideoStream();
		self.startVideoStream();
	}

	// Hide the button that toggles the front and rear camera feed
	self.hideToggleVideoSourcesButton = function() {
		TweenLite.to(toggleVideoSourceButton, .6, {opacity:0, onComplete:self.onHideToggleVideoSourcesButtonComplete})
	}

	// Take a snapshot of the current video feed
	// and store it as a base64 string
	self.takeSnapShot = function() {
		var base64ImageString = self.createImageFromCurrentVideoFrame();
		if (base64ImageString == null) {
			console.log("error:  base64ImageString is null");
			return;
		}
		reviewSnapShotImageString = base64ImageString;
		cameraVideo.pause();
		snapShotReview.setAttribute("src", base64ImageString);
		self.showSnapShotReviewContainer();
	}

	// Grab the still photo from the current frame of the camera video feed
	self.createImageFromCurrentVideoFrame = function() {
		// If we have bound to a camera video stream
		if (videoStream) {
			// Draw the snapshot of the video to the canvas
			cameraCanvas.width = SNAPSHOT_WIDTH;
			cameraCanvas.height = SNAPSHOT_HEIGHT;
			cameraCanvasContext = cameraCanvas.getContext("2d");
			cameraCanvasContext.drawImage(
				cameraVideo, 
				0, 
				0, 
				SNAPSHOT_WIDTH, 
				SNAPSHOT_HEIGHT, 
				0, 
				0, 
				SNAPSHOT_WIDTH, 
				SNAPSHOT_HEIGHT
			);

			// Create the image string from the canvas
			var base64ImageString = cameraCanvas.toDataURL('image/jpeg');

			return base64ImageString;
		}

		return null;
	}

	// Show the container that contains a preview of the snapshot
	// along with accept/reject controls
	self.showSnapShotReviewContainer = function() {
		TweenLite.fromTo(snapShotReviewContainer, .6, {
			y:window.innerHeight, 
			display:"none"}, {
				y:0, 
				ease:Quint.easeOut, 
				display:"block"
			});
	}

	// Hide the snapshot preview container
	self.hideSnapShotReviewContainer = function() {
		TweenLite.to(snapShotReviewContainer, .6, {
			y:window.innerHeight, 
			ease:Quint.easeOut,
			onComplete: self.onHideSnapShotReviewContainerComplete
		});
	}

	// Send the given snapshot to the server
	self.sendSnapShotToServer = function(imageString) {
		var base64ImageStringForTransfer = imageString.replace(/^data:image\/jpeg;base64,/,'');
		brain.getServerManager().sendSnapShotToServer(base64ImageStringForTransfer);		
	}

	// Show a toast to the user
	self.showToast = function() {
		toast.style.display = "block";
		TweenLite.to(toast, .6, {
			y:-toast.offsetHeight, 
			ease:Quint.easeOut, 
			//display: "block"
		});
	}

	// Hide the toast
	self.hideToast = function() {
		TweenLite.to(toast, .6, {
			y:0, 
			ease:Quint.easeOut, 
			onComplete:function() { 
				toast.style.display = "none"; 
			}
		});
	}

	// Determine if the device is in portrait mode
	self.checkIfInPortraitMode = function() {
		if (window.innerWidth <= window.innerHeight) {
			return true;
		}
		return false;
	}

	self.init();
}
