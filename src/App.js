import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Satellite from './Satellite';
import Earth from './Earth';
import HQ from './HQ';
import Player from './Player';
import { COMM_RANGE_KM, HQ_RANGE_KM, SPACE_LOS_EPS, GROUND_LOS_EPS } from './constants';

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

    const [showStrikePad, setShowStrikePad] = useState(false);

  // Enemy intel & warnings
  const knownEnemyHQsRef = useRef({});          // { [playerId]: Set<enemyPlayerId> }
  const compromisedHQIdsRef = useRef(new Set()); // Set<hqId> flagged as detected
  const pendingWarningsRef = useRef({});        // { [playerId]: true } => toast next turn
  const [selectedTargetHQ, setSelectedTargetHQ] = useState(null);

// --- Toasts (player-facing warnings/info) ---
    const [toasts, setToasts] = useState([]);
    const notify = (severity, message, ttl = 4500) => {
      const id = Date.now() + Math.random();
      setToasts(t => [...t, { id, severity, message, ttl }]);
      // auto-remove after ttl
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ttl + 200);
    };
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
      if (pendingWarningsRef.current[playerId]) {
       notify('warning', `Your HQ has been detected!`);
       pendingWarningsRef.current[playerId] = false;
     }
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
      const income = BASE_INCOME_PER_TURN + imagingCount * INCOME_PER_IMAGING_IN_LINK + commCount * INCOME_PER_COMM_IN_LINK;
      const upkeep = totalCount * UPKEEP_PER_SAT;
      player.funds += income - upkeep;
    });

   // Enemy HQ detection -> reveal to attacker; warn defender
   eventBus.on('DETECTION_HQ', ({ ownerId, enemyId, hqId, position }) => {
     // mark intel for attacker
     if (!knownEnemyHQsRef.current[ownerId]) knownEnemyHQsRef.current[ownerId] = new Set();
     knownEnemyHQsRef.current[ownerId].add(enemyId);
     if (hqId) compromisedHQIdsRef.current.add(hqId);
     pendingWarningsRef.current[enemyId] = true;

     // attacker toast (only if currently viewing the attacker)
    const latDeg = THREE.MathUtils.radToDeg(Math.asin(position.clone().normalize().y)).toFixed(1);
    if (currentPlayerRef.current?.id === ownerId) {
     notify('success', `You detected an enemy HQ (≈lat ${latDeg}°). You can ground‑strike when you have enough AP & comms.`);
    }
     // If attacker is the active view, immediately reveal
     if (currentPlayerRef.current?.id === ownerId) renderPlayerObjects();
   });

    // Handle ground strike resolution and victory
    eventBus.on('ACTION_STRIKE_RESOLVED', ({ attackerId, targetId, remainingHp }) => {
      notify('info', `Ground strike resolved on ${targetId} by ${attackerId} — remaining HP: ${remainingHp}`);
    });
    eventBus.on('VICTORY', ({ winner }) => {
      notify('success', `Game over — winner: ${winner}`);
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
      notify('error', 'WebGL context lost. If graphics freeze, try reloading or reducing load.');
    }, false);

    renderer.domElement.addEventListener('webglcontextrestored', () => {
      notify('info', 'WebGL context restored.');
      // Reinitialize the scene or handle the context restoration as needed
    }, false);

    // Initialize players
    const player1 = new Player('player1');
    const player2 = new Player('player2');
    setPlayers([player1, player2]);
    // Map of playerId to Player
    playersMap[player1.id] = player1;
    playersMap[player2.id] = player2;
    knownEnemyHQsRef.current[player1.id] = new Set();
    knownEnemyHQsRef.current[player2.id] = new Set();
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

    // Keep comm-lines & FoW perfectly in sync:
// - For IMAGING sats: draw the BFS path to any friendly HQ (if reachable).
// - For COMM sats: draw simple neighbor edges (network view).
const handleCommSatDetections = () => {
  if (!currentPlayerRef.current) return;

  const mySats = satellitesRef.current.filter(
    s => s.ownerId === currentPlayerRef.current.id
  );

  mySats.forEach(sat => {
    drawCommLines(sat); // we compute everything from the neighbor graph
  });
};

const drawCommLines = (sat /*, targets (unused) */) => {
  // Clear existing lines
  sat.commLines.forEach(line => {
    if (sceneRef.current) sceneRef.current.remove(line);
    if (line.geometry) line.geometry.dispose();
    if (line.material) line.material.dispose();
  });
  sat.commLines = [];

  const scene = sceneRef.current;
  if (!scene) return;

  // Helper: resolve an ID to a node (Satellite or HQ)
  const byId = (id) =>
    satellitesRef.current.find(s => s.id === id) ||
    hqSpheresRef.current.find(h => h.id === id);

  // ---- IMAGING: draw the actual path to HQ (if any) ----
  if (sat.type === 'imaging') {
    const myHqs = hqSpheresRef.current.filter(h => h.ownerID === sat.ownerId);
    if (myHqs.length === 0) return;

    const hqIds = new Set(myHqs.map(h => h.id));

    // BFS over the same neighbor graph maintained in Satellite.updateNeighbors
    const prev = new Map();      // childId -> parentId (for path reconstruction)
    const visited = new Set([sat.id]);
    const queue = [sat.id];
    let foundHq = null;

    while (queue.length) {
      const id = queue.shift();
      if (hqIds.has(id)) { foundHq = id; break; }
      const node = byId(id);
      if (!node || !node.neighbors) continue;
      node.neighbors.forEach(nid => {
        if (!visited.has(nid)) {
          visited.add(nid);
          prev.set(nid, id);
          queue.push(nid);
        }
      });
    }

    // Not reachable => no path => no lines
    if (!foundHq) return;

    // Reconstruct path sat -> ... -> HQ
    const pathIds = [];
    for (let at = foundHq; at !== undefined; at = prev.get(at)) {
      pathIds.push(at);
      if (at === sat.id) break;
    }
    pathIds.reverse();

    // Draw segments along the path
    for (let i = 0; i < pathIds.length - 1; i++) {
      const a = byId(pathIds[i]);
      const b = byId(pathIds[i + 1]);
      if (!a || !b) continue;

      const aPos = a.type === 'HQ'
        ? a.sphere.getWorldPosition(new THREE.Vector3())
        : a.mesh.position.clone();

      const bPos = b.type === 'HQ'
        ? b.sphere.getWorldPosition(new THREE.Vector3())
        : b.mesh.position.clone();

      const geometry = new THREE.BufferGeometry().setFromPoints([aPos, bPos]);
      const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
      const line = new THREE.Line(geometry, material);
      scene.add(line);
      sat.commLines.push(line);
    }

    return; // imaging handled fully
  }

  // ---- COMM: draw neighbor edges (network view) ----
  const targets = Array.from(sat.neighbors)
    .map(id => byId(id))
    .filter(Boolean);

  targets.forEach(target => {
    const startPos = sat.mesh.position.clone();
    const endPos = target.type === 'HQ'
      ? target.sphere.getWorldPosition(new THREE.Vector3())
      : target.mesh.position.clone();

    const geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
    const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    sat.commLines.push(line);
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
//      handleSphereDetections(detectedSpheres);
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
  if (!earthRef.current || !actionRegistryRef.current || !currentPlayerRef.current) return;

  const kmToMeters = 1000;
  const hoursToSeconds = 3600;
  const earthRadiusKm = 6371;

  // 1) Orbit numbers from UI (unchanged math)
  const orbitalSpeedKmPerH   = parseFloat(speed);
  const orbitalSpeedMPerS    = (orbitalSpeedKmPerH * kmToMeters) / hoursToSeconds;
  const orbitRadiusMeters    = (parseFloat(altitude) + earthRadiusKm) * kmToMeters;
  const orbitalCircumference = 2 * Math.PI * orbitRadiusMeters;
  const speedInRadPerSec     = orbitalSpeedMPerS / orbitalCircumference;

  const orbit = {
    radius: orbitRadiusMeters / kmToMeters,                         // km
    speed:  speedInRadPerSec,                                       // rad/s
    angle:  0,                                                      // true anomaly ν (solved below)
    inclination: THREE.MathUtils.degToRad(parseFloat(inclination)), // rad
    raan:   0                                                       // Ω (solved below)
  };
    const player = currentPlayerRef.current;

     // Need an HQ to launch from
    if (player.getHQs().length === 0) {
      notify('warning', 'No HQ placed yet — cannot launch.');
      return;
    }
  const mainHQ = player.getHQs()[0];

  // 3) Solve RAAN (Ω) and true anomaly (ν) so the sat starts directly above HQ
  const hqWorld = new THREE.Vector3();
  mainHQ.sphere.getWorldPosition(hqWorld);

  // Target unit vector from Earth center to the HQ in world space
  const t = hqWorld.clone().normalize();

  const i   = orbit.inclination;
  const lat = Math.asin(t.y);              // geocentric latitude φ
  const lon = Math.atan2(t.z, t.x);        // longitude λ

    // Feasibility: |latitude| <= inclination
    if (Math.abs(lat) > i + 1e-6) {
      const latDeg = THREE.MathUtils.radToDeg(lat).toFixed(2);
      const incDeg = THREE.MathUtils.radToDeg(i).toFixed(2);
      notify('warning',
        `Inclination ${incDeg}° < |site latitude| ${latDeg}°. This orbit plane cannot pass over the HQ (realistic).`
      );
      // return; // uncomment to hard-block infeasible launches
    }

  // We want the plane normal n ⟂ t. With your update order p = Ry(Ω)·Rx(i)·[cosν,0,sinν],
  // the plane normal is n = Ry(Ω)·Rx(i)·ŷ. Enforcing n·t = 0 yields:
  //   A·sinΩ + B·cosΩ = C, with A = t.x, B = t.z, C = -cot(i)*t.y
  const sinI = Math.sin(i);
  const cosI = Math.cos(i);
  const EPS  = 1e-8;

  let solved = false;
  let best = { err: Number.POSITIVE_INFINITY, raan: 0, nu: 0 };

  if (Math.abs(sinI) < 1e-6) {
    // Equatorial case (i ≈ 0): only sites near the equator are possible.
    if (Math.abs(lat) <= 1e-3) {
      // Use Ω = λ; then compute ν from projection
      const Rx = new THREE.Matrix4().makeRotationX(i);
      const Ry = new THREE.Matrix4().makeRotationY(lon);
      const a  = new THREE.Vector3(1,0,0).applyMatrix4(Rx).applyMatrix4(Ry);
      const b  = new THREE.Vector3(0,0,1).applyMatrix4(Rx).applyMatrix4(Ry);
      const nu = Math.atan2(t.dot(b), t.dot(a));
      const p  = a.clone().multiplyScalar(Math.cos(nu)).add(b.clone().multiplyScalar(Math.sin(nu)));
      const err = p.angleTo(t);
      best = { err, raan: lon, nu };
      solved = true;
      } else {
      notify('warning', 'Equatorial orbit cannot overfly a non-equatorial HQ (realistic).');
      // fall through; we’ll still try the general path which will likely be infeasible
    }
  }

  if (!solved) {
    const A = t.x;
    const B = t.z;
    const M = Math.hypot(A, B);

    if (M < EPS) {
      // HQ at (near) the pole. If i≈90° (polar), any Ω works; pick Ω = −λ.
      if (Math.abs(cosI) < 1e-6) {
        const Omega = -lon;
        const Rx = new THREE.Matrix4().makeRotationX(i);
        const Ry = new THREE.Matrix4().makeRotationY(Omega);
        const a  = new THREE.Vector3(1,0,0).applyMatrix4(Rx).applyMatrix4(Ry);
        const b  = new THREE.Vector3(0,0,1).applyMatrix4(Rx).applyMatrix4(Ry);
        const nu = Math.atan2(t.dot(b), t.dot(a));
        const p  = a.clone().multiplyScalar(Math.cos(nu)).add(b.clone().multiplyScalar(Math.sin(nu)));
        const err = p.angleTo(t);
        best = { err, raan: Omega, nu };
        solved = true;
        } else {
          notify('warning', 'Non-polar inclination cannot pass exactly over the pole.');
        }
    } else {
      // General solution
      const C = - (cosI / Math.max(sinI, EPS)) * t.y;  // -cot(i)*t.y
      const ratio = C / M;

  // No RAAN solution for chosen i / latitude
    if (ratio < -1 - 1e-9 || ratio > 1 + 1e-9) {
      notify('warning', 'Latitude outside the reach of this inclination (no RAAN solution).');
    } else {
        const clamp = Math.max(-1, Math.min(1, ratio));
        const psi   = Math.atan2(A, B);               // phase for A*sinΩ + B*cosΩ
        const delta = Math.acos(clamp);               // two symmetric RAAN solutions

        const candidates = [psi + delta, psi - delta];

        // For each RAAN candidate, compute ν = atan2(t·b , t·a) and pick the better match.
        const Rx = new THREE.Matrix4().makeRotationX(i);
        for (const Omega of candidates) {
          const Ry = new THREE.Matrix4().makeRotationY(Omega);
          const a  = new THREE.Vector3(1,0,0).applyMatrix4(Rx).applyMatrix4(Ry);
          const b  = new THREE.Vector3(0,0,1).applyMatrix4(Rx).applyMatrix4(Ry);

          const nu = Math.atan2(t.dot(b), t.dot(a));
          const p  = a.clone().multiplyScalar(Math.cos(nu)).add(b.clone().multiplyScalar(Math.sin(nu)));
          const err = p.angleTo(t);

          if (err < best.err) best = { err, raan: Omega, nu };
        }
        solved = true;
      }
    }
  }

    if (!solved) {
      // Nothing viable found — bail out gracefully.
      notify('warning', 'Launch aborted: no valid orbital alignment found for this HQ and inclination.');
      return;
    }

  orbit.raan  = best.raan;
  orbit.angle = best.nu;

  // 4) Launch cost (unchanged)
  const costToLaunchFromHQ = calculateLaunchCost(satelliteType, mainHQ.latitude, orbit);

  // 5) Launch (unchanged)
  const launchFn = () => {
    const newSatellite = new Satellite(
      'sat' + Math.floor(Math.random() * 1000),
      player.id,
      satelliteType,
      orbit,
      earthRef.current,
      fieldOfView,
      eventBusRef.current
    );

    newSatellite.render(sceneRef.current);
    player.addSatellite(newSatellite);

    setSatellites(prev => {
      const updated = [...prev, newSatellite];
      satellitesRef.current = updated;
      return updated;
    });
  };

  // 6) Gate via ActionRegistry (turn, AP, funds)
  const ok = actionRegistryRef.current.perform('LAUNCH_SAT', player.id, {
    moneyCost: Math.round(costToLaunchFromHQ),
    launchFn,
    launchArgs: []
  });

  if (!ok) {
    notify('warning', 'Launch blocked: not your turn, insufficient AP, or insufficient funds.');
  } else {
    // Ensure scene/UI state reflects the new satellite immediately
    renderPlayerObjects();
  }
};



    
    function calculateLaunchCost(satelliteType, latitude, orbit) {
      const baseCosts = {
        imaging: 50, // in million dollars
        communication: 60, // reduced to make early comms accessible
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

     const millions = baseCost * locMultiplier * inclMultiplier * altMultiplier * spdMultiplier;
     return Math.round(millions * 1_000_000); // return dollars
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
         const inRange = satelliteOrHQ.isInRange(neighborPosition, isHQ);
        if (inRange) {
          const lhs = satelliteOrHQ.type === 'HQ' ? `HQ ${satelliteOrHQ.id}` : `Sat ${satelliteOrHQ.id}`;
          const rhs = neighbor instanceof Satellite ? `Sat ${neighbor.id}` : `HQ ${neighbor.id}`;
          notify('info', `Link in range: ${lhs} ↔ ${rhs}`);
        }
        if (inRange) {
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

          const earth = earthRef.current;
          if (!earth?.mesh) {
            notify('error', 'Earth not ready yet.');
            return;
          }

          const intersects = raycaster.intersectObject(earth.mesh);
          if (intersects.length === 0) {
            notify('warning', 'Click the Earth surface to place an HQ.');
            return;
          }

          // Place the HQ at the clicked point on Earth
          const intersectPoint = intersects[0].point;
          const newHQ = earth.addHQSphere(intersectPoint, hqSpheresRef, currentPlayerRef);

          // Player-facing confirmation
          notify(
            'success',
            `HQ placed at lat ${newHQ.latitude.toFixed(1)}°, lon ${newHQ.longitude.toFixed(1)}°`
          );

          // Turn off placement preview + remove the draggable ghost sphere
          showHQSphereRef.current = false;
          if (hqSphereRef.current) {
            sceneRef.current.remove(hqSphereRef.current);
            hqSphereRef.current = null;
          }

          renderPlayerObjects();
    }


//    function handleSphereDetections(detections) {
//    // Reset all sphere colors to default
//    hqSpheresRef.current.forEach(hq => {
//      hq.sphere.material.color.set(0xff0000);
//      hq.sphere.material.needsUpdate = true;
//    });
//
//    // Update detected spheres to the detection color
//    detections.forEach(sphere => {
//      sphere.material.color.set(0x00ff00);
//      sphere.material.needsUpdate = true;
//    });
//  };

    function renderPlayerObjects() {
      const earth = earthRef.current;
      const scene = sceneRef.current;
      const currentPlayer = currentPlayerRef.current;
      if (!earth || !scene || !currentPlayer) return;

      // Remove all satellites/cones/lines from the scene
      satellitesRef.current.forEach(satellite => {
        scene.remove(satellite.mesh);
        if (satellite.viewCone) scene.remove(satellite.viewCone);
        satellite.commLines.forEach(line => scene.remove(line));
      });

      // Keep ALL HQs parented; visible if it's mine OR I have intel on that enemy
      hqSpheresRef.current.forEach(hq => {
        if (hq.sphere.parent !== earth.parentObject) earth.parentObject.add(hq.sphere);
        const isMine = (hq.ownerID === currentPlayer.id);
        const IKnowEnemy = knownEnemyHQsRef.current[currentPlayer.id]?.has(hq.ownerID);
        hq.sphere.visible = isMine || !!IKnowEnemy;

        // colors:
        // - my HQ: red (or yellow if compromised)
        // - known enemy HQ: cyan
        if (isMine) {
          const compromised = compromisedHQIdsRef.current.has(hq.id);
          hq.sphere.material.color.set(compromised ? 0xffff00 : 0xff0000);
        } else if (IKnowEnemy) {
          hq.sphere.material.color.set(0x00ffff);
        }
        hq.sphere.material.needsUpdate = true;
      });

      // Add only the current player's satellites back (cones for imaging only)
      currentPlayer.getSatellites().forEach(satellite => {
        scene.add(satellite.mesh);
        if (satellite.type === 'imaging' && satellite.viewCone) {
          scene.add(satellite.viewCone);
        }
        satellite.commLines.forEach(line => scene.add(line));
        // keep inHqRange updated for economy/fog
        satellite.checkInHqRange(hqSpheresRef, currentPlayerRef, satellitesRef.current);
      });

      earth.currentPlayerID = currentPlayer.id;
      earth.updateFogMapForCurrentPlayer();
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

<Typography variant="h6" style={{ position: 'absolute', top: 20, right: 430, zIndex: 1000, color: 'white' }}>
  Funds: {'$'}{Math.round((currentPlayerRef.current?.funds ?? 0) / 1_000_000)}M
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
        <Button onClick={handleHQButtonClick}>HQ</Button>
        <Button onClick={() => setShowSatPanel(!showSatPanel)}>Sat</Button>
        <Button onClick={() => setShowStrikePad(v => !v)}>Strike</Button>
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
          Launch (${Math.round(launchCost / 1_000_000)}M)
        </Button>
        <Typography variant="caption" display="block" style={{ marginTop: 6 }}>
  Uses AP and funds. AP left: {actionPoints}; Funds: {'$'}{Math.round((currentPlayerRef.current?.funds ?? 0) / 1_000_000)}M
</Typography>
      </Paper>
    )}

    {/* Strike Pad */}
    {showStrikePad && (
      <Paper style={{ position: 'absolute', top: 100, left: 230, padding: 12, width: 280, zIndex: 1000, backgroundColor: 'white' }}>
        <Typography variant="h6" gutterBottom>Strike Pad</Typography>

        {(() => {
          const me = currentPlayerRef.current;
          if (!me) return <Typography variant="body2">No active player.</Typography>;

         const log = detectionLogRef.current?.forPlayer?.(me.id) || [];
         const knownHQIds = new Set(
           log.filter(e => e.type === 'HQ_DETECTED').map(e => e.targetId)
         );
         const knownHQs = hqSpheresRef.current.filter(
           h => knownHQIds.has(h.id) && h.ownerID !== me.id
         );
          if (knownHQs.length === 0) {
            return <Typography variant="body2">No known enemy HQs yet.</Typography>;
          }

          // simple comms gate: any of my satellites currently reachable from HQ
          const hasComms = satellitesRef.current.some(s => s.ownerId === me.id && s.inHqRange === true);

          return (
            <div>
              {!hasComms && (
                <Typography variant="caption" color="error" style={{ display: 'block', marginBottom: 8 }}>
                  No comms link to your HQ — strikes are disabled.
                </Typography>
              )}

              {knownHQs.map(hq => {
             const canAPFunds = !!actionRegistryRef.current?.canPerform?.(
               'GROUND_STRIKE',
               me.id,
               { targetHQ: hq, hasComms }
             );
              const canStrike = hasComms && canAPFunds;

                return (
                  <Box key={hq.id} style={{ border: '1px solid #ddd', borderRadius: 6, padding: 8, marginBottom: 8 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Enemy HQ ({hq.ownerID}) — {hq.id}
                    </Typography>
                    <Typography variant="caption" display="block" gutterBottom>
                      HP: {hq.hp}
                    </Typography>
                    <Box display="flex" gap={8}>
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        disabled={!canStrike}
                         onClick={() => {
                           const ok = actionRegistryRef.current.perform('GROUND_STRIKE', me.id, {
                             targetHQ: hq,
                             hasComms
                           });
                          if (ok) {
                            notify('success', 'Strike launched. Impact in ~90s.');
                          } else {
                            notify('error', 'Cannot launch strike (AP/funds/turn).');
                          }
                        }}
                      >
                        Launch Strike
                      </Button>
                      {!canAPFunds && (
                        <Typography variant="caption" color="textSecondary" style={{ alignSelf: 'center' }}>
                          Need more AP/funds
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </div>
          );
        })()}
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

    {/* Toasts (player-facing notifications) */}
    {toasts.map((t, i) => (
      <div
        key={t.id}
        style={{
          position: 'fixed',
          top: 16 + i * 64,
          right: 16,
          zIndex: 2000
        }}
      >
        <Paper
          elevation={6}
          style={{
            padding: '8px 12px',
            background: '#1f1f1f',
            color: 'white',
            maxWidth: 360
          }}
        >
          <strong style={{ textTransform: 'capitalize' }}>{t.severity}</strong>: {t.message}
        </Paper>
      </div>
    ))}

    {renderSatellitesPanel()}
  </div>
);


};

export default App;
// Economy constants
const BASE_INCOME_PER_TURN       = 2_000_000;
const INCOME_PER_IMAGING_IN_LINK = 1_500_000;
const INCOME_PER_COMM_IN_LINK    =   500_000;
const UPKEEP_PER_SAT             =   200_000;
