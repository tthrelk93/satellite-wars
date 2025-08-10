import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Satellite from './Satellite';
import Earth from './Earth';
import HQ from './HQ';
import Player from './Player';

import { EventBus } from './EventBus';
import { TurnManager, AP_MAX } from './TurnManager';
import { DetectionLog } from './DetectionLog';
import { ActionRegistry } from './ActionRegistry';

import {
  Button,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Slider,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const App = () => {
  const mountRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showSatPanel, setShowSatPanel] = useState(false);
  const [satelliteType, setSatelliteType] = useState('communication');
  const [altitude, setAltitude] = useState('705'); // Set default altitude
  const [speed, setSpeed] = useState('21078'); // Set default speed
  const [fieldOfView, setFieldOfView] = useState(7.95); // Set slider to max value
  const [angle, setAngle] = useState('0'); // Set default angle
  const [inclination, setInclination] = useState('11'); // Set default inclination
  const [satellites, setSatellites] = useState([]);
  const satellitesRef = useRef([]); // Use ref to keep track of satellites
  const showHQSphereRef = useRef(false);
  const hqSphereRef = useRef(null);
  const hqSpheresRef = useRef([]); // Manage HQ spheres in App.js

  const [players, setPlayers] = useState([]);
  const currentPlayerRef = useRef(null);
  // Reference for minimap (fog-of-war overlay)
  const miniRef = useRef(null);

  const sceneRef = useRef(null);
  const earthRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
    
  const [launchCost, setLaunchCost] = useState(0);

  // Core game system instances
  const eventBusRef = useRef(null);
  const turnManagerRef = useRef(null);
  const detectionLogRef = useRef(null);
  const actionRegistryRef = useRef(null);

  // UI state for turn and action points
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [actionPoints, setActionPoints] = useState(AP_MAX);


  // Initialize the scene, camera, renderer, controls, and lights
  useEffect(() => {
    // Core systems setup
    const eventBus = new EventBus();
    const turnManager = new TurnManager(eventBus);
    const detectionLog = new DetectionLog(eventBus);
    const playersMap = {};
    const actionRegistry = new ActionRegistry({ eventBus, turnManager, players: playersMap });
    eventBusRef.current = eventBus;
    turnManagerRef.current = turnManager;
    detectionLogRef.current = detectionLog;
    actionRegistryRef.current = actionRegistry;
    // Subscribe to turn and AP events for UI updates
    eventBus.on('TURN_STARTED', ({ playerId, turnNumber }) => {
      setActivePlayerId(playerId);
      setCurrentTurn(turnNumber);
    });
    eventBus.on('AP_CHANGED', ({ playerId, ap }) => {
      setActionPoints(ap);
    });

    // Economy tick: apply income and upkeep after a turn ends
    eventBus.on('ECONOMY_TICK', ({ playerId }) => {
      const player = playersMap[playerId];
      if (!player) return;
      const sats = player.getSatellites();
      const inLink = sats.filter(sat => sat.inHqRange);
      const imagingCount = inLink.filter(sat => sat.type === 'imaging').length;
      const commCount = inLink.filter(sat => sat.type === 'communication').length;
      const totalCount = sats.length;
      const income = imagingCount * INCOME_PER_IMAGING_IN_LINK + commCount * INCOME_PER_COMM_IN_LINK;
      const upkeep = totalCount * UPKEEP_PER_SAT;
      player.funds += income - upkeep;
    });

    // Handle ground strike resolution and victory
    eventBus.on('ACTION_STRIKE_RESOLVED', ({ attackerId, targetId, remainingHp }) => {
      console.log(`Ground strike resolved on ${targetId} by ${attackerId}, remaining HP: ${remainingHp}`);
    });
    eventBus.on('VICTORY', ({ winner }) => {
      console.log(`Game over: winner is ${winner}`);
      // TODO: disable inputs and show victory UI
    });

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.7, 100000);
    camera.position.set(0, 0, 20000); // Set camera far enough to view the entire Earth
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;
    const mountNode = mountRef.current;
    mountNode.appendChild(renderer.domElement);

    // Handle WebGL context lost and restore
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.error('WebGL context lost');
    }, false);

    renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
      // Reinitialize the scene or handle the context restoration as needed
    }, false);

    // Initialize players
    const player1 = new Player('player1');
    const player2 = new Player('player2');
    setPlayers([player1, player2]);
    // Map of playerId to Player
    playersMap[player1.id] = player1;
    playersMap[player2.id] = player2;
    // Start the turn cycle
    // Start the turn cycle (initial TURN_STARTED will fire once earth is ready)
    // turnManager.startGame will be called after Earth is created below

    // Create Earth
    const earth = new Earth(camera, [player1, player2]);
    earth.render(scene);
    earthRef.current = earth;

    // Sync view and objects on turn start (after Earth exists)
    eventBus.on('TURN_STARTED', ({ playerId }) => {
      currentPlayerRef.current = playersMap[playerId];
      earthRef.current.setCurrentPlayer(playerId);
      renderPlayerObjects();
    });
    // Now that Earth is ready, start the turn cycle, emitting initial TURN_STARTED
    turnManager.startGame([player1.id, player2.id]);


    // Set up camera and orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Add AxesHelper to the scene
    const axesHelper = new THREE.AxesHelper(80);
    scene.add(axesHelper);

    window.addEventListener('mousemove', handleMouseMove);

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    window.addEventListener('mousedown', handleMouseClick);

    // Initial player objects rendering is handled via TURN_STARTED event
    // renderPlayerObjects();

    // Cleanup on component unmount
    return () => {
        window.removeEventListener('resize', handleResize);
             window.removeEventListener('mousemove', handleMouseMove);
             window.removeEventListener('mousedown', handleMouseClick);
             //if (cameraRef.current) cameraRef.current.dispose(); // Dispose of controls
             if (rendererRef.current) rendererRef.current.dispose();
             if (sceneRef.current) {
               sceneRef.current.children.forEach(child => {
                 if (child.geometry) child.geometry.dispose();
                 if (child.material) child.material.dispose();
                 sceneRef.current.remove(child);
               });
             }
             mountNode.removeChild(renderer.domElement);
    };
  }, []);
    
    useEffect(() => {
      if (currentPlayerRef.current && currentPlayerRef.current.getHQs().length > 0) {
        const curPlayerMainHQ = currentPlayerRef.current.getHQs()[0];
        const kmToMeters = 1000;
        const hoursToSeconds = 3600;
        const degreesToRadians = Math.PI / 180;
        const earthRadiusKm = 6371; // Earth's radius in kilometers

        // Convert the speed from km/h to radians per second
        const orbitalSpeedKmPerH = parseFloat(speed);
        const orbitalSpeedMPerS = (orbitalSpeedKmPerH * kmToMeters) / hoursToSeconds;
        const orbitRadiusMeters = (parseFloat(altitude) + earthRadiusKm) * kmToMeters; // Altitude + Earth's radius in meters
        const orbitalCircumference = 2 * Math.PI * orbitRadiusMeters;
        const speedInRadiansPerSecond = orbitalSpeedMPerS / orbitalCircumference;

        const orbit = {
          radius: orbitRadiusMeters / kmToMeters, // Convert back to kilometers
          speed: speedInRadiansPerSecond, // Speed in radians per second
          angle: THREE.MathUtils.degToRad(parseFloat(angle)), // Convert degrees to radians
          inclination: THREE.MathUtils.degToRad(parseFloat(inclination)), // Convert degrees to radians
        };

        const cost = calculateLaunchCost(satelliteType, curPlayerMainHQ.latitude, orbit);
        setLaunchCost(cost);
      }
}, [satelliteType, altitude, speed, angle, inclination]);

  // Minimap overlay: continuously draw fog-of-war canvas from Earth
  useEffect(() => {
    let frameId;
    const drawMini = () => {
      const mini = miniRef.current;
      const earth = earthRef.current;
      if (mini && earth && earth.canvas) {
        const ctx = mini.getContext('2d');
        ctx.clearRect(0, 0, mini.width, mini.height);
        ctx.drawImage(earth.canvas, 0, 0, mini.width, mini.height);
      }
      frameId = requestAnimationFrame(drawMini);
    };
    drawMini();
    return () => cancelAnimationFrame(frameId);
  }, []);
    

  const slerp = (start, end, t) => {
    const omega = Math.acos(start.dot(end));
    const sinOmega = Math.sin(omega);

    const scale0 = Math.sin((1 - t) * omega) / sinOmega;
    const scale1 = Math.sin(t * omega) / sinOmega;

    const result = new THREE.Vector3().addVectors(
      start.clone().multiplyScalar(scale0),
      end.clone().multiplyScalar(scale1)
    );

    return result;
  };

  const handleCommSatDetections = () => {
    const commSats = satellitesRef.current.filter(sat => sat.type === 'communication' && sat.ownerId === currentPlayerRef.current.id);
    const groundStations = hqSpheresRef.current.filter(hq => hq.ownerID === currentPlayerRef.current.id);
    // Use the neighbor graph (range + LoS in updateNeighbors) as the SR-CRT for links
    const byId = id =>
      satellitesRef.current.find(s => s.id === id) ||
      hqSpheresRef.current.find(h => h.id === id);

    commSats.forEach(sat => {
      const targets = Array.from(sat.neighbors).map(byId).filter(Boolean);
      drawCommLines(sat, targets);
    });
  };

  const drawCommLines = (sat, targets) => {
      // Clear existing lines
        sat.commLines.forEach(line => {
          sceneRef.current.remove(line);
          if (line.geometry) line.geometry.dispose();
          if (line.material) line.material.dispose();
        });
        sat.commLines = [];

    const earthRadius = earthRef.current.earthRadiusKm;

    /**
     * Returns true if the segment from start->end passes through the sphere (excluding endpoints).
     * Sphere at origin with given radius.
     */
    function segmentOccludedBySphere(start, end, sphereRadius, epsilon = 1e-3) {
      const d = new THREE.Vector3().subVectors(end, start);
      const f = start.clone();
      const a = d.dot(d);
      const b = 2 * f.dot(d);
      const c = f.dot(f) - sphereRadius * sphereRadius;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return false;
      const sqrtDisc = Math.sqrt(disc);
      const t1 = (-b - sqrtDisc) / (2 * a);
      const t2 = (-b + sqrtDisc) / (2 * a);
      return (t1 > epsilon && t1 < 1 - epsilon) || (t2 > epsilon && t2 < 1 - epsilon);
    }

      // Draw new lines
    targets.forEach(target => {
      let endPos;
      if (target.type === 'HQ') {
        endPos = new THREE.Vector3();
        target.sphere.getWorldPosition(endPos);
      } else {
        endPos = target.mesh.position.clone();
      }
      const startPos = sat.mesh.position.clone();
      const eps = (target.type === 'HQ') ? 1e-2 : 1e-3;
      if (!segmentOccludedBySphere(startPos, endPos, earthRef.current.earthRadiusKm, eps)) {
        const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
        const geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
        const line = new THREE.Line(geometry, material);
        sceneRef.current.add(line);
        sat.commLines.push(line);
      }
    });
  };

  // Animation loop
  useEffect(() => {
    const animate = () => {
      if (!rendererRef.current) return;
      requestAnimationFrame(animate);

      // Update Earth
      if (earthRef.current) {
        earthRef.current.update();
      }

      let detectedSpheres = [];
      satellitesRef.current.forEach(satellite => { // Update all satellites, regardless of player
        const detections = satellite.updateOrbit(hqSpheresRef, currentPlayerRef, satellitesRef.current); // Pass the current HQ spheres
        detectedSpheres = detectedSpheres.concat(detections);
      });
        

      // Handle sphere detections
      handleSphereDetections(detectedSpheres);
      handleCommSatDetections();

      if (sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
  }, [satellites]);

  function handleMouseMove(event) {
    if (!showHQSphereRef.current || !hqSphereRef.current) return;

    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObject(earthRef.current.mesh);
    if (intersects.length > 0) {
      const intersectPoint = intersects[0].point;
      hqSphereRef.current.position.copy(intersectPoint);
    } else {
      const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(cameraRef.current);
      vector.sub(cameraRef.current.position).normalize();
      const distance = -cameraRef.current.position.z / vector.z;
      const pos = cameraRef.current.position.clone().add(vector.multiplyScalar(distance));
      hqSphereRef.current.position.copy(pos);
    }
  }



  const handleHQButtonClick = (event) => {
    const newShowHQSphere = !showHQSphereRef.current;
    showHQSphereRef.current = newShowHQSphere;

    if (newShowHQSphere) {
      const sphereGeometry = new THREE.SphereGeometry(100, 32, 32);
      const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );
      const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(cameraRef.current);
      vector.sub(cameraRef.current.position).normalize();
      const distance = -cameraRef.current.position.z / vector.z;
      const pos = cameraRef.current.position.clone().add(vector.multiplyScalar(distance));

      sphere.position.copy(pos);
      sceneRef.current.add(sphere);
      hqSphereRef.current = sphere;
    } else {
      if (hqSphereRef.current) {
        sceneRef.current.remove(hqSphereRef.current);
        hqSphereRef.current = null;
      }
    }
  };


    const handleAddSatellite = () => {
      if (earthRef.current) {
        const kmToMeters = 1000;
        const hoursToSeconds = 3600;
        const degreesToRadians = Math.PI / 180;
        const earthRadiusKm = 6371; // Earth's radius in kilometers

        // Convert the speed from km/h to radians per second
        const orbitalSpeedKmPerH = parseFloat(speed);
        const orbitalSpeedMPerS = (orbitalSpeedKmPerH * kmToMeters) / hoursToSeconds;
        const orbitRadiusMeters = (parseFloat(altitude) + earthRadiusKm) * kmToMeters; // Altitude + Earth's radius in meters
        const orbitalCircumference = 2 * Math.PI * orbitRadiusMeters;
        const speedInRadiansPerSecond = orbitalSpeedMPerS / orbitalCircumference;

        const orbit = {
          radius: orbitRadiusMeters / kmToMeters, // Convert back to kilometers
          speed: speedInRadiansPerSecond, // Speed in radians per second
          angle: THREE.MathUtils.degToRad(parseFloat(angle)), // Convert degrees to radians
          inclination: THREE.MathUtils.degToRad(parseFloat(inclination)), // Convert degrees to radians
        };
          if(currentPlayerRef.current.getHQs().length > 0){
              
              let curPlayerMainHQ = currentPlayerRef.current.getHQs()[0];
              const costToLaunchFromHQ = calculateLaunchCost(satelliteType, curPlayerMainHQ.latitude, orbit);
              if(currentPlayerRef.current.funds >= costToLaunchFromHQ){
                  
                  const newSatellite = new Satellite(
                    'sat' + Math.floor(Math.random() * 1000),
                    currentPlayerRef.current.id, // player ID
                    satelliteType,
                    orbit,
                    earthRef.current,
                    fieldOfView,
                    eventBusRef.current
                  );
                  newSatellite.render(sceneRef.current);
                  
                  currentPlayerRef.current.addSatellite(newSatellite);
                  setSatellites((prevSatellites) => {
                      const updatedSatellites = [...prevSatellites, newSatellite];
                      satellitesRef.current = updatedSatellites;
                      return updatedSatellites;
                      
                      
                  });
                  currentPlayerRef.current.funds -= costToLaunchFromHQ; //subtract cost to launch from funds
              } else {
                  //Show error message that not enough funds
              }
          } else {
              //show error message that no HQs have been placed
          }


      }
    };
    
    function calculateLaunchCost(satelliteType, latitude, orbit) {
      const baseCosts = {
        imaging: 50, // in million dollars
        communication: 150, // in million dollars
      };

      const locationMultiplier = (lat) => {
        if (Math.abs(lat) <= 30) return 0.8;
        if (Math.abs(lat) <= 60) return 1.0;
        return 1.2;
      };

      const inclinationMultiplier = (inclination) => {
        if (Math.abs(inclination) < THREE.MathUtils.degToRad(30)) return 1.0;
        if (Math.abs(inclination) < THREE.MathUtils.degToRad(60)) return 1.2;
        return 1.4; // High inclination (near polar orbits) are more expensive
      };

      const altitudeMultiplier = (altitude) => {
        if (altitude < 2000) return 1.0; // Low Earth Orbit (LEO)
        if (altitude < 35786) return 1.3; // Medium Earth Orbit (MEO)
        return 1.5; // Geostationary Orbit (GEO) and beyond
      };

      const speedMultiplier = (speed) => {
        if (speed < 7500) return 1.0; // Lower speed
        if (speed < 15000) return 1.2; // Medium speed
        return 1.4; // High speed
      };

      const baseCost = baseCosts[satelliteType];
      const locMultiplier = locationMultiplier(latitude);
      const inclMultiplier = inclinationMultiplier(orbit.inclination);
      const altMultiplier = altitudeMultiplier(orbit.radius - 6371); // Subtract Earth's radius to get altitude
      const spdMultiplier = speedMultiplier(orbit.speed * (2 * Math.PI * (orbit.radius * 1000)) * 3600 / 1000); // Convert back to km/h for simplicity

      return baseCost * locMultiplier * inclMultiplier * altMultiplier * spdMultiplier;
    }

    const addNeighborsInRange = (satelliteOrHQ, neighbors) => {

      neighbors.forEach(neighbor => {
        let neighborPosition;
        if (neighbor instanceof Satellite) {
          neighborPosition = neighbor.mesh.position.clone();
        } else {
          neighborPosition = new THREE.Vector3();
          neighbor.sphere.getWorldPosition(neighborPosition);
        }
         
          let isHQ = false;
          if(satelliteOrHQ.type === "HQ"){
              isHQ = true;
          }
          console.log("neighborPos: ", neighborPosition, satelliteOrHQ.isInRange(neighborPosition));
        if (satelliteOrHQ.isInRange(neighborPosition, isHQ)) {
          satelliteOrHQ.addNeighbor(neighbor.id);
          neighbor.addNeighbor(satelliteOrHQ.id);
        }
      });
    };
    
    function handleMouseClick(event) {
      if (!showHQSphereRef.current) return;

      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      const intersects = raycaster.intersectObject(earthRef.current.mesh);
      if (intersects.length > 0) {
        const intersectPoint = intersects[0].point;
        console.log("intersect point: ", intersectPoint);
        const newHQ = earthRef.current.addHQSphere(intersectPoint, hqSpheresRef, currentPlayerRef); // Directly add the sphere
        console.log("hqSpheresRef after addHQSphere:", hqSpheresRef.current);
        showHQSphereRef.current = false;
        if (hqSphereRef.current) {
          sceneRef.current.remove(hqSphereRef.current);
          hqSphereRef.current = null;
        }

        // Add neighbors to the new HQ
        const neighbors = satellitesRef.current.filter(sat => sat.ownerId === currentPlayerRef.current.id);
        addNeighborsInRange(newHQ, neighbors);
      }
    }

    function handleSphereDetections(detections) {
    // Reset all sphere colors to default
    hqSpheresRef.current.forEach(hq => {
      hq.sphere.material.color.set(0xff0000);
      hq.sphere.material.needsUpdate = true;
    });

    // Update detected spheres to the detection color
    detections.forEach(sphere => {
      sphere.material.color.set(0x00ff00);
      sphere.material.needsUpdate = true;
    });
  };

  


    function renderPlayerObjects() {
      // Remove all objects from the scene
      satellitesRef.current.forEach(satellite => {
        sceneRef.current.remove(satellite.mesh);
        if (satellite.viewCone) sceneRef.current.remove(satellite.viewCone);
        satellite.commLines.forEach(line => sceneRef.current.remove(line));
      });
      // Keep ALL HQs parented to the rotating Earth; just toggle visibility per owner.
      hqSpheresRef.current.forEach(hq => {
        if (hq.sphere.parent !== earthRef.current.parentObject) {
          earthRef.current.parentObject.add(hq.sphere);
        }
        hq.sphere.visible = (hq.ownerID === currentPlayer.id);
      });

      // Add only the current player's objects
      const currentPlayer = currentPlayerRef.current;
      currentPlayer.getSatellites().forEach(satellite => {
        sceneRef.current.add(satellite.mesh);
        // Only imaging sats render view cones
        if (satellite.type === 'imaging' && satellite.viewCone) {
          sceneRef.current.add(satellite.viewCone);
        }
        satellite.commLines.forEach(line => sceneRef.current.add(line));
        satellite.checkInHqRange(hqSpheresRef.current, currentPlayerRef, satellitesRef.current); // Update inHqRange status
      });
      earthRef.current.currentPlayerID = currentPlayer.id;
      // Update the fog map for the current player
      earthRef.current.updateFogMapForCurrentPlayer();
    }

    const renderSatellitesPanel = () => {
        const currentPlayer = currentPlayerRef.current;

        if (!currentPlayer) {
          return null; // or some placeholder content if desired
        }

        const playerSatellites = currentPlayer.getSatellites();

      return (
        <div style={{
            position: 'absolute',
            top: '5%',
            right: '1%',
            width: '22%',
            height: '40%',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            padding: '10px',
            overflowY: 'auto',
            zIndex: 1000
          }}>
          <TableContainer component={Paper}>
            <Table size="small" aria-label="satellites table">
              <TableHead>
                <TableRow>
                  <TableCell>Sat ID</TableCell>
                  <TableCell>Owner ID</TableCell>
                  <TableCell>Lat/Lon</TableCell>
                  <TableCell>Neighbors</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {playerSatellites.map(sat => (
                  <TableRow key={sat.id}>
                    <TableCell>{sat.id}</TableCell>
                    <TableCell>{sat.ownerId}</TableCell>
                    <TableCell>{`Lat: ${sat.latitude}, Lon: ${sat.longitude}`}</TableCell>
                    <TableCell>{Array.from(sat.neighbors).join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      );
    };



  return (
          <div>
            {/* End Turn button controlled by TurnManager */}
            <Button
              variant="contained"
              color="primary"
              onClick={() => turnManagerRef.current && turnManagerRef.current.endTurn()}
              style={{ position: 'absolute', top: 20, left: 10, zIndex: 1000 }}
            >
              End Turn
            </Button>
            <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
            
            <Typography
              variant="h6"
              style={{ position: 'absolute', top: 20, right: 430, zIndex: 1000, color: 'white' }}>
              Funds: {currentPlayerRef.current ? currentPlayerRef.current.funds : 0}
            </Typography>
            <Typography
              variant="h6"
              style={{ position: 'absolute', top: 20, right: 250, zIndex: 1000, color: 'white' }}>
              Turn: {currentTurn} | AP: {actionPoints}
            </Typography>

            <IconButton
              onClick={() => setShowMenu(!showMenu)}
              style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, backgroundColor: 'white' }}
            >
              {showMenu ? <RemoveIcon /> : <AddIcon />}
            </IconButton>

            {showMenu && (
              <Paper style={{ position: 'absolute', top: 50, left: 10, padding: 10, zIndex: 1000, backgroundColor: 'white' }}>
                <Button onClick={() => setShowSatPanel(!showSatPanel)}>Sat</Button>
                <Button onClick={handleHQButtonClick}>HQ</Button>
              </Paper>
            )}
            {showSatPanel && (
              <Paper style={{ position: 'absolute', top: 100, left: 10, padding: 10, width: 200, zIndex: 1000, backgroundColor: 'white' }}>
                <Typography variant="h6">Create Satellite</Typography>
                <FormControl fullWidth style={{ marginBottom: 10 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={satelliteType}
                    onChange={(e) => setSatelliteType(e.target.value)}
                  >
                    <MenuItem value="communication">Communication</MenuItem>
                    <MenuItem value="imaging">Imaging</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Altitude"
                  type="number"
                  fullWidth
                  value={altitude}
                  onChange={(e) => setAltitude(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <TextField
                  label="Speed"
                  type="number"
                  fullWidth
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <Box style={{ marginBottom: 10 }}>
                  <Typography>Field of View</Typography>
                  <Slider
                    value={fieldOfView}
                    onChange={(e, val) => setFieldOfView(val)}
                    step={0.01}
                    min={1.69}
                    max={7.95}
                    valueLabelDisplay="auto"
                  />
                </Box>
                <TextField
                  label="Initial Angle"
                  type="number"
                  fullWidth
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <TextField
                  label="Inclination"
                  type="number"
                  fullWidth
                  value={inclination}
                  onChange={(e) => setInclination(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                              <Button
                                variant="contained"
                                color="primary"
                                onClick={handleAddSatellite}
                              >
                                Launch (${launchCost}M)
                              </Button>
              </Paper>
            )}
            {/* Minimap overlay */}
            <canvas
              ref={miniRef}
              width={200}
              height={100}
              style={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                border: '1px solid white',
                zIndex: 1000,
                backgroundColor: 'black'
              }}
            />

            {renderSatellitesPanel()}
          </div>
  );
};

export default App;
// Economy constants
const INCOME_PER_IMAGING_IN_LINK = 1_000_000;
const INCOME_PER_COMM_IN_LINK    =   300_000;
const UPKEEP_PER_SAT             =   200_000;
