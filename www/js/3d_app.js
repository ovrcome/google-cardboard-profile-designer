/*!
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/*global alert, document, screen, window, init,
  THREE, WURFL, screenfull, CARDBOARD, ga*/

// meter units
var CAMERA_HEIGHT = 0;
var CAMERA_NEAR = 0.1;
var CAMERA_FAR = 100;

var camera, scene, renderer, composer;
var controls;
var element, container;

var clock = new THREE.Clock();

// Update the message text if on iOS
if (!screenfull.enabled) {
  document.getElementById("title").innerHTML = "Rotate phone horizontally";
}

function setMessageVisible(id, is_visible) {
  var css_visibility = is_visible ? "block" : "none";
  document.getElementById(id).style.display = css_visibility;
}

function isFullscreen() {
  var screen_width = Math.max(window.screen.width, window.screen.height);
  var screen_height = Math.min(window.screen.width, window.screen.height);

  return (screen_width === window.innerWidth) &&
         (screen_height === window.innerHeight);
}

function resize() {
  var width = container.offsetWidth;
  var height = container.offsetHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setViewport(0, 0, width, height);

  composer.setSize(width, height);

  if (WURFL.is_mobile) {
    setMessageVisible('message_fullscreen', !isFullscreen());
  }
}

function animate(t) {
  var delta = clock.getDelta();
  camera.updateProjectionMatrix();
  controls.update(delta);
  composer.render();

  window.requestAnimationFrame(animate);
}

function setOrientationControls(e) {
  if (!e.alpha) {
    return;
  }

  controls = new THREE.DeviceOrientationControls(camera, true);
  controls.connect();
  controls.update();

  if (screenfull.enabled) {
    // Android
    window.addEventListener('click', function() {
      // Must be called here because initiated by user
      if (screenfull.isFullscreen) {
        screen.wakelock.release();
      } else {
        screen.wakelock.request();
      }

      screenfull.toggle();
    });

    document.addEventListener(screenfull.raw.fullscreenchange, function() {
      if (screenfull.isFullscreen) {
        // TODO: moz prefix for Firefox
        screen.orientation.lock('landscape');
      } else {
        screen.orientation.unlock();
      }
    });
  } else {
    // iOS
    screen.wakelock.request();
  }

  window.removeEventListener('deviceorientation', setOrientationControls, true);
}

function init_with_cardboard_device(cardboard_device) {
  console.log(`init_with_cardboard_device: ${cardboard_device}`);
  renderer = new THREE.WebGLRenderer();
  element = renderer.domElement;
  container = document.getElementById('example');
  container.appendChild(element);

  scene = new THREE.Scene();

  // NOTE: CardboardStereoPass will ignore camera FOV and aspect ratio
  camera = new THREE.PerspectiveCamera(90, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(0, CAMERA_HEIGHT, 0);
  scene.add(camera);

  controls = new THREE.OrbitControls(camera, element);
  controls.rotateUp(Math.PI / 4);
  controls.target.set(
    camera.position.x + 0.1,
    camera.position.y,
    camera.position.z
  );
  controls.noZoom = true;
  controls.noPan = true;

  window.addEventListener('deviceorientation', setOrientationControls, true);

  var light = new THREE.HemisphereLight(0x777777, 0x000000, 0.6);
  scene.add(light);

  // environment box with grid textures
  var box_width = 10;  // i.e. surfaces are box_width/2 from camera
  var texture = THREE.ImageUtils.loadTexture(
    'textures/patterns/box.png'
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(box_width, box_width);
  var face_colors = [0xA020A0, 0x20A020, 0x50A0F0, 0x404040, 0xA0A0A0, 0xA0A020];
  var materialArray = [];
  face_colors.forEach(function(c) {
      materialArray.push(new THREE.MeshBasicMaterial({
        map: texture,
        color: c,
        side: THREE.BackSide
      }));
    });
  var env_cube = new THREE.Mesh(
      new THREE.BoxGeometry(box_width, box_width, box_width),
      new THREE.MeshFaceMaterial(materialArray)
  );
  scene.add(env_cube);

  var screen_params = CARDBOARD.findScreenParams();
  var cardboard_view = new CARDBOARD.CardboardView(
      screen_params, cardboard_device);

  composer = new THREE.EffectComposer(renderer);

  composer.addPass(new THREE.CardboardStereoEffect(
      cardboard_view, scene, camera));

  var barrel_distortion = new THREE.ShaderPass(THREE.CardboardBarrelDistortion);
  // TODO: Consider having red background only when FOV angle fields
  // are in focus.
  barrel_distortion.uniforms.backgroundColor.value =
      new THREE.Vector4(1, 0, 0, 1);
  barrel_distortion.renderToScreen = true;
  composer.addPass(barrel_distortion);

  // Listen for device data updates
  WebSocketClient.on('deviceData', function(data) {
    if (data && data.params_uri) {
      cardboard_view.device = CARDBOARD.uriToParams(data.params_uri);
      console.log("updated params", cardboard_view.device);
      CARDBOARD.updateBarrelDistortion(barrel_distortion, cardboard_view, CAMERA_NEAR, CAMERA_FAR, true);
    }
  });

  window.addEventListener('resize', resize, false);
  window.setTimeout(resize, 1);

  animate();
}

function hasWebGl() {
  var canvas = document.createElement("canvas");
  try {
    return Boolean(canvas.getContext("webgl") ||
                   canvas.getContext("experimental-webgl"));
  } catch (x) {
    return false;
  }
}

function init() {
  if (!hasWebGl()) {
    console.log('WebGL not available');
    setMessageVisible('message_webgl', true);
    return;
  }
  var urlParams = new URLSearchParams(window.location.search);
  var userId = urlParams.get('u');
  if (userId) {
    // Set the user ID and get initial data
    WebSocketClient.channelId = userId;
    WebSocketClient.on('connected', function(isConnected) {
      if (isConnected) {
        WebSocketClient.getDeviceData();
      }
    });
    WebSocketClient.once('deviceData', function(data) {
      var device = CARDBOARD.uriToParams(data.params_uri);
      console.log("device", device);
      init_with_cardboard_device(device);
    });
  } else {
    console.log("URL is missing session info:", window.location);
  }
}

init();
