import * as THREE from 'three';
import HQ from './HQ';
import earthmap from './8081_earthmap10k.jpg';
import earthbump from './8081_earthbump10k.jpg';
import fogTexture from './fog.png'; // Add your fog texture map here

class Earth {
  constructor(camera, players) {
    this.camera = camera;
    this.earthRadiusKm = 6371; // Earth's radius in kilometers
    this.geometry = new THREE.SphereGeometry(this.earthRadiusKm, 64, 64);
    this.material = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load(earthmap),
      bumpMap: new THREE.TextureLoader().load(earthbump),
      bumpScale: 0.05
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.scale.set(1, 1, 1); // Ensure it is a perfect sphere

    // Create cloud layer using fog.png
    this.cloudGeometry = new THREE.SphereGeometry(this.earthRadiusKm + 200, 512, 512); // Slightly larger than Earth
    this.cloudMaterial = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load(fogTexture),
      transparent: true,
      opacity: 0.9
    });
    this.cloudMesh = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);

    // Create a parent object to hold both the Earth and the spheres
    this.parentObject = new THREE.Object3D();
    this.parentObject.add(this.mesh);
    this.parentObject.add(this.cloudMesh);

    // Create a main canvas to dynamically update the fog texture
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.context = this.canvas.getContext('2d');

    this.fogTexture = new THREE.CanvasTexture(this.canvas);
    this.cloudMaterial.map = this.fogTexture;

    // Fill the canvas with the initial fog
    const ctx = this.context;
    ctx.fillStyle = 'rgba(255, 255, 255, 1.0)'; // Fully opaque initial fog
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Create off-screen canvases for each player
    this.playerCanvases = {};
    players.forEach(player => {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = 1024;
      offscreenCanvas.height = 512;
      const offscreenContext = offscreenCanvas.getContext('2d');
      offscreenContext.fillStyle = 'rgba(255, 255, 255, 1.0)'; // Fully opaque initial fog
      offscreenContext.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
      this.playerCanvases[player.id] = { canvas: offscreenCanvas, context: offscreenContext };
      console.log(`Initialized fog map for player ${player.id}`);
    });
   

    // Create latitude and longitude lines
    this.latLines = this.createLatLines();
    this.longLines = this.createLongLines();
    this.revealedPositions = {}; // Track revealed positions for each player
    this.lastLogTime = 0; // Timestamp of the last log
    this.DEBUG = false;
    this.currentPlayerID = null;
  }

  createLatLines() {
    const lines = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff }); // Blue for latitude

    // Latitude lines
    for (let lat = -80; lat <= 80; lat += 10) {
      const radius = this.earthRadiusKm * Math.cos(THREE.MathUtils.degToRad(lat));
      const latitudeGeometry = new THREE.CircleGeometry(radius, 64);
      latitudeGeometry.deleteAttribute('normal');
      latitudeGeometry.deleteAttribute('uv');
      const vertices = latitudeGeometry.attributes.position.array;
      const latitudeVertices = Array.from(vertices).slice(3); // Remove the center vertex
      const latitudeBufferGeometry = new THREE.BufferGeometry();
      latitudeBufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(latitudeVertices, 3));
      latitudeBufferGeometry.rotateX(THREE.MathUtils.degToRad(90));
      const latitudeLine = new THREE.Line(latitudeBufferGeometry, material);
      latitudeLine.position.y = this.earthRadiusKm * Math.sin(THREE.MathUtils.degToRad(lat));
      lines.add(latitudeLine);
    }

    this.parentObject.add(lines);
    return lines;
  }

  createLongLines() {
    const lines = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red for longitude

    // Longitude lines
    for (let lon = 0; lon < 360; lon += 10) {
      const longitudeGeometry = new THREE.BufferGeometry();
      const vertices = [];
      for (let lat = -90; lat <= 90; lat += 1) {
        const theta = THREE.MathUtils.degToRad(lat);
        const phi = THREE.MathUtils.degToRad(lon);
        vertices.push(
          this.earthRadiusKm * Math.cos(theta) * Math.sin(phi),
          this.earthRadiusKm * Math.sin(theta),
          this.earthRadiusKm * Math.cos(theta) * Math.cos(phi)
        );
      }
      longitudeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      const longitudeLine = new THREE.Line(longitudeGeometry, material);
      lines.add(longitudeLine);
    }

    this.parentObject.add(lines);
    return lines;
  }

    addHQSphere(position, hqSpheresRef, currentPlayerRef) {
        const newHQ = new HQ('hq-' + Math.floor(Math.random() * 1000), position, currentPlayerRef.current.id); // Pass a unique id
        hqSpheresRef.current.push(newHQ);
        this.parentObject.add(newHQ.sphere);
        currentPlayerRef.current.addHQ(newHQ);
        console.log("Added HQ sphere: ", hqSpheresRef.current.length);
        return newHQ;
      }

  update() {
    const rotScale = 8640000;
    this.parentObject.rotation.y += (2 * Math.PI) / rotScale; // Rotate the parent object
  }

    revealFog(position, fov, logPosition = false, radius, playerID) {
        const currentTime = Date.now();

        const vector = new THREE.Vector3(position.x, position.y, position.z);
        vector.normalize();

        const theta = Math.acos(-vector.y); // polar angle
        const phi = Math.atan2(-vector.z, vector.x); // azimuthal angle

        // Normalize phi to range [0, 1]
        const u = (phi + Math.PI) / (2 * Math.PI);
        // Normalize theta to range [0, 1]
        const v = 1.0 - (theta / Math.PI);

        // Log UV coordinates
        if (this.DEBUG && currentTime - this.lastLogTime > 1000) {
          this.lastLogTime = currentTime;
        }

        // Convert u, v to a string to use as a key
        const positionKey = `${u.toFixed(6)}-${v.toFixed(6)}`;

        // Ensure player-specific revealed positions and fog maps are initialized
        if (!this.revealedPositions[playerID.current]) {
          this.revealedPositions[playerID.current] = new Set();
        }

        if (!this.revealedPositions[playerID.current].has(positionKey)) {
          const offscreenContext = this.playerCanvases[playerID.current].context;
          offscreenContext.globalCompositeOperation = 'destination-out';
          offscreenContext.fillStyle = 'rgba(0, 0, 0, 0.5)';

          // Calculate the reveal area based on the FOV value
          const earthRadius = this.earthRadiusKm; // The Earth's radius in your scene scale
          const surfaceArea = 4 * Math.PI * Math.pow(earthRadius, 2);
          const revealArea = (fov / 100000000) * surfaceArea;
          const revealRadius = Math.sqrt(revealArea / Math.PI);

          offscreenContext.beginPath();
          offscreenContext.arc(u * this.canvas.width, v * this.canvas.height, revealRadius, 0, 2 * Math.PI);
          offscreenContext.fill();
          offscreenContext.globalCompositeOperation = 'source-over';

          this.revealedPositions[playerID.current].add(positionKey);
         // console.log(`Updated fog map for player ${playerID.current}`);

          // If the player is the current player, update the main canvas in real-time
          if (playerID.current === this.currentPlayerID) {
            this.updateFogMapForCurrentPlayer();
          }
        }
      }

      updateFogMapForCurrentPlayer() {
        if (this.context && this.playerCanvases[this.currentPlayerID]) {
          //console.log(`Updating fog map for player ${this.currentPlayerID}`);
          // Clear the entire main canvas
          this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
          // Draw the current player's off-screen canvas onto the main canvas
          this.context.drawImage(this.playerCanvases[this.currentPlayerID].canvas, 0, 0);
          // Mark the texture for an update
          this.fogTexture.needsUpdate = true;
        } else {
          console.error("Fog map for the player not found or context not initialized");
        }
      }
    

  setCurrentPlayer(playerID) {
    this.currentPlayerID = playerID;
    this.updateFogMapForCurrentPlayer();
  }

  render(scene) {
    scene.add(this.parentObject);
  }
}

export default Earth;
