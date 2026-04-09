import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Satellite from './Satellite';
import Earth from './Earth';
import { sampleV2AtLatLonSigma } from './sensors/radar/radarSampleCpu';
import { DEFAULT_GROUND_DOPPLER_SPECS } from './sensors/radar/radarSpecs';
import HQ from './HQ';
import UplinkHub from './UplinkHub';
import Player from './Player';
import { UPKEEP_PER_SAT, INCOME_PER_COMM_IN_LINK, INCOME_PER_IMAGING_IN_LINK, BASE_INCOME_PER_TURN, MU_EARTH, RE_M, OMEGA_EARTH, LOSSES_MPS, DV_REF_MPS, DV_EXPONENT, COMM_RANGE_KM, SPACE_LOS_EPS, GROUND_LOS_EPS, CLOUD_WATCH_GRID_LON_OFFSET_RAD } from './constants';
import SimClock from './SimClock';
import { solarDeclination } from './weather/solar';
import { clampSimAdvanceByTruthBudget } from './weather/simAdvanceBudget';
import { loadNullschoolWind } from './weather/reference/loadNullschoolWind';

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
    FormControlLabel,
    Switch,
    Box,
    Typography,
    Paper,
    Tooltip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const WEATHER_DEBUG_OPTIONS = [
    { value: 'clouds', label: 'Clouds (normal)' },
    { value: 'ps', label: 'Pressure (ps)' },
    { value: 'T', label: 'Temp (T)' },
    { value: 'Ts', label: 'Surface Temp (Ts)' },
    { value: 'TU', label: 'Upper Temp (TU)' },
    { value: 'RHU', label: 'Upper RH (RHU)' },
    { value: 'sst', label: 'SST (climo)' },
    { value: 'seaIce', label: 'Sea Ice (climo)' },
    { value: 'albedo', label: 'Albedo (climo)' },
    { value: 'elev', label: 'Elevation (climo)' },
    { value: 'soilCap', label: 'Soil Capacity (climo)' },
    { value: 'soilW', label: 'Soil Water (soilW)' },
    { value: 'landMask', label: 'Land Mask' },
    { value: 'RH', label: 'RH' },
    { value: 'wind', label: 'Wind (arrows)' },
    { value: 'windUpper', label: 'Upper Wind (speed)' },
    { value: 'hUpper', label: 'Upper Thickness (hU)' },
    { value: 'omegaL', label: 'Omega (lower)' },
    { value: 'omegaU', label: 'Omega (upper)' },
    { value: 'phiMid', label: 'Geopotential Φ (mid)' },
    { value: 'tauLow', label: 'Tau (low)' },
    { value: 'tauHigh', label: 'Tau (high)' },
    { value: 'tauLowDelta', label: 'Tau Low Delta' },
    { value: 'cloudLow', label: 'Cloud Low' },
    { value: 'cloudHigh', label: 'Cloud High' },
    { value: 'cwpLow', label: 'CWP (low)' },
    { value: 'cwpHigh', label: 'CWP (high)' },
    { value: 'tcGenesis', label: 'TC Genesis' },
    { value: 'tcMask', label: 'TC Mask' },
    { value: 'div', label: 'Divergence' },
    { value: 'vort', label: 'Vorticity' },
    { value: 'cwp', label: 'Cloud Water Path' },
    { value: 'precip', label: 'Precip (mm/hr)' }
];

const WEATHER_DEBUG_SCALE = {
    clouds: { min: 0, max: 1 },
    ps: { min: 95000, max: 103000 },
    T: { min: 240, max: 320 },
    Ts: { min: 240, max: 320 },
    TU: { min: 180, max: 320 },
    RHU: { min: 0, max: 1.2 },
    sst: { min: 271, max: 307 },
    seaIce: { min: 0, max: 1 },
    albedo: { min: 0, max: 1 },
    elev: { min: 0, max: 5000 },
    soilCap: { min: 0, max: 1 },
    soilW: { min: 0, max: 200 },
    landMask: { min: 0, max: 1 },
    RH: { min: 0, max: 1.2 },
    wind: { min: 0, max: 30 },
    windUpper: { min: 0, max: 100 },
    hUpper: { min: 1000, max: 5000 },
    omegaL: { min: -0.2, max: 0.2, diverging: true },
    omegaU: { min: -0.2, max: 0.2, diverging: true },
    phiMid: { min: 0, max: 600000 },
    tauLow: { min: 0, max: 20 },
    tauHigh: { min: 0, max: 20 },
    tauLowDelta: { min: 0, max: 1 },
    cloudLow: { min: 0, max: 1 },
    cloudHigh: { min: 0, max: 1 },
    cwpLow: { min: 0, max: 0.5, log: true },
    cwpHigh: { min: 0, max: 0.5, log: true },
    tcGenesis: { min: 0, max: 0.2, log: true },
    tcMask: { min: 0, max: 1 },
    vort: { min: -5e-5, max: 5e-5, diverging: true },
    div: { min: -5e-5, max: 5e-5, diverging: true },
    cwp: { min: 0, max: 0.5, log: true },
    precip: { min: 0, max: 50, log: true }
};

const SIM_SPEED_DEFAULT = 600;
const SIM_SPEED_MAX = 14400;
const FIXED_SIM_STEP_SECONDS = 120;
const MAX_SIM_SUBSTEPS = 4;
const MAX_SIM_SUBSTEPS_BURST = 20;
const TRUTH_WORKER_DESYNC_BUDGET_SECONDS = 12 * 3600;
const MONTH_SECONDS = (365 * 86400) / 12;
const SELECTION_DOUBLE_CLICK_MS = 250;
const SELECTION_DOUBLE_CLICK_PX = 8;
const SELECTION_EDGE_SAMPLES = 24;
const COLLECT_LOOKAHEAD_SECONDS = 2 * 3600;
const COLLECT_STEP_SECONDS = 300;
const SIM_SPEED_MARKS = [
    { value: 0, label: '1x' },
    { value: 1, label: '10x' },
    { value: 2, label: '100x' },
    { value: 3, label: '1k' },
    { value: 4, label: '10k' },
    { value: Math.log10(SIM_SPEED_MAX), label: `${(SIM_SPEED_MAX / 1000).toFixed(1)}k` }
];

const WEATHER_LOG_CADENCE_OPTIONS = [
    { value: 600, label: '10 min' },
    { value: 3600, label: '1 hour' },
    { value: 21600, label: '6 hours' },
    { value: 86400, label: '1 day' }
];

const DEFAULT_FORECAST_LEADS = [1, 3, 6];
const MAX_DRAFTS_PER_HAZARD = 2;
const ALERTS_HISTORY_MAX = 500;
const FORECAST_PRODUCT_LABELS = {
    cloudTau: 'Clouds',
    precipRate: 'Rain',
    windSpeed: 'Wind',
    confidence: 'Confidence'
};
const HAZARD_LABELS = {
    heavyPrecip: 'Heavy Precip',
    highWinds: 'High Winds',
    severeStormRisk: 'Severe Storm Risk'
};
const HAZARD_TO_FORECAST_PRODUCT = {
    heavyPrecip: 'precipRate',
    highWinds: 'windSpeed',
    severeStormRisk: 'precipRate'
};
const AUTO_WARNING_CONFIG = {
    confidenceMin: 0.6,
    maxHitFracServiceArea: 0.25,
    minComponentCells: 40,
    maxPolygonsPerHazard: 3,
    maxAreaFracByHazardByLead: {
        heavyPrecip: { 1: 0.08, 3: 0.10, 6: 0.12, 12: 0.15, 24: 0.18 },
        highWinds: { 1: 0.08, 3: 0.10, 6: 0.12, 12: 0.15, 24: 0.18 },
        severeStormRisk: { 1: 0.07, 3: 0.09, 6: 0.11, 12: 0.14, 24: 0.17 }
    },
    hazards: {
        heavyPrecip: { kind: 'precipRate', threshold: 0.25 },
        highWinds: { kind: 'windSpeed', threshold: 35, requireStormy: true },
        severeStormRisk: { kind: 'stormRisk', threshold: 1.0 }
    }
};
const SERVICE_RADIUS_KM = 2500;
const RADAR_RADIUS_KM = 350;
const LOCAL_BACKHAUL_RADIUS_KM = 800;
const RADAR_CADENCE_SECONDS = 300;
const EVENT_SAMPLE_INTERVAL_SECONDS = 600;
const EVENT_GAP_SECONDS = EVENT_SAMPLE_INTERVAL_SECONDS * 2;
const MIN_EVENT_DURATION_SECONDS = 1800;
const EVENT_FOOTPRINT_RETENTION_SECONDS = 24 * 3600;
const EVENT_HISTORY_RETENTION_SECONDS = 30 * 3600;
const EVENT_THRESHOLDS = {
	heavyPrecip: 0.25,
	highWinds: 35,
	severeStormRisk: 1.0
};
const FORECAST_TECH_TIERS = [
    {
        tier: 0,
        name: 'CloudWatch Nowcaster',
        costMoney: 0,
        costAp: 0,
        unlockedLeads: [1, 3, 6]
    },
    {
        tier: 1,
        name: 'AMV Motion Vectors',
        costMoney: 35_000_000,
        costAp: 1,
        unlockedLeads: [1, 3, 6]
    },
    {
        tier: 2,
        name: 'Upper-Air Soundings',
        costMoney: 60_000_000,
        costAp: 1,
        unlockedLeads: [1, 3, 6, 12]
    },
    {
        tier: 3,
        name: 'Radar Nowcast Processor',
        costMoney: 45_000_000,
        costAp: 1,
        unlockedLeads: [1, 3, 6, 12]
    },
    {
        tier: 4,
        name: 'Dense Surface Network',
        costMoney: 80_000_000,
        costAp: 1,
        unlockedLeads: [1, 3, 6, 12, 24]
    }
];
const IOU_MATCH_MIN = 0.2;
const PAYOUT = {
    hitBase: {
        heavyPrecip: 5_000_000,
        highWinds: 3_000_000,
        severeStormRisk: 7_000_000
    }
};
const HIT_REP_BASE = {
    heavyPrecip: 3,
    highWinds: 2,
    severeStormRisk: 4
};
const PRECISION_BONUS_MAX = 0.5;
const PRECISION_CONF_START = 0.6;
const PRECISION_CONF_FULL = 0.9;
const PRECISION_AREA_FULL_FRAC = 0.05;
const PRECISION_AREA_NONE_FRAC = 0.20;
const POSTMORTEM_HINT_IOU = 0.05;
const TOO_BROAD_AREA_FRAC = 0.20;
const TIME_FUZZ_SECONDS = 1800;
const STREAK_BONUS_PER_HIT = 0.03;
const STREAK_BONUS_CAP = 0.15;
const DAILY_GOAL_HITS = 3;
const DAILY_GOAL_REP_BONUS = 5;
const FORECAST_REPORT_MAX_RUNS = 10;
const FORECAST_REPORT_WINDOW_HOURS = 6;
const PENALTY = {
    falseAlarmMoney: {
        heavyPrecip: 1_000_000,
        highWinds: 750_000,
        severeStormRisk: 1_500_000
    },
    falseAlarmRep: {
        heavyPrecip: -2,
        highWinds: -2,
        severeStormRisk: -3
    },
    missMoney: {
        heavyPrecip: 8_000_000,
        highWinds: 6_000_000,
        severeStormRisk: 12_000_000
    },
    missRep: {
        heavyPrecip: -6,
        highWinds: -5,
        severeStormRisk: -8
    }
};

const DEFAULT_TUNING = {
    iouMatchMin: IOU_MATCH_MIN,
    minComponentCells: AUTO_WARNING_CONFIG.minComponentCells,
    areaCapsByHazardByLead: JSON.parse(JSON.stringify(AUTO_WARNING_CONFIG.maxAreaFracByHazardByLead)),
    thresholdsByHazard: {
        heavyPrecip: AUTO_WARNING_CONFIG.hazards.heavyPrecip.threshold,
        highWinds: AUTO_WARNING_CONFIG.hazards.highWinds.threshold,
        severeStormRisk: AUTO_WARNING_CONFIG.hazards.severeStormRisk.threshold
    },
    confidence: {
        precisionBonusMax: PRECISION_BONUS_MAX,
        precisionConfStart: PRECISION_CONF_START,
        precisionConfFull: PRECISION_CONF_FULL
    }
};

const resolveInitialGameMode = () => {
    const mode = new URLSearchParams(window.location.search).get('mode');
    return mode === 'solo' || mode === 'pvp' ? mode : null;
};

const App = () => {
    const mountRef = useRef(null);
    const [gameMode, setGameMode] = useState(() => resolveInitialGameMode()); // 'solo' or 'pvp'
    const params = new URLSearchParams(window.location.search);
    const initialSeedParam = params.get('weatherSeed');
    const envSeedParam = process.env.REACT_APP_WEATHER_SEED;
    const fallbackSeed = Number.isFinite(Number.parseInt(envSeedParam, 10)) ? envSeedParam : '12345';
    const initialSeed = Number.isFinite(Number.parseInt(initialSeedParam, 10)) ? initialSeedParam : fallbackSeed;
    const windRefEnabled = params.get('windRef') === '1';
    const [showMenu, setShowMenu] = useState(false);
    const [showSatPanel, setShowSatPanel] = useState(false);
    const [showSatListPanel, setShowSatListPanel] = useState(true);
    const [showInfoPanel, setShowInfoPanel] = useState(true);
    const [showForecastPanel, setShowForecastPanel] = useState(true);
    const [showFogLayer, setShowFogLayer] = useState(true);
    const [showWeatherLayer, setShowWeatherLayer] = useState(true);
    const [showWindStreamlines, setShowWindStreamlines] = useState(true);
    const [windStreamlineSource, setWindStreamlineSource] = useState('analysis');
    const [windRefStatus, setWindRefStatus] = useState({ loading: false, loaded: false, error: null });
    const [weatherViewSource, setWeatherViewSource] = useState('truth');
    const [showStationObs, setShowStationObs] = useState(true);
    const [showCloudObs, setShowCloudObs] = useState(true);
    const [showRadarObs, setShowRadarObs] = useState(true);
    const [cloudObsProduct, setCloudObsProduct] = useState('tauTotal');
    const [showForecastOverlay, setShowForecastOverlay] = useState(false);
    const [forecastProduct, setForecastProduct] = useState('cloudTau');
    const [forecastLeadHours, setForecastLeadHours] = useState(1);
    const [forecastStatus, setForecastStatus] = useState({ running: false, progress01: 0, message: '', lastRunId: null });
    const [forecastBaseTimeSeconds, setForecastBaseTimeSeconds] = useState(null);
    const [showForecastAdvanced, setShowForecastAdvanced] = useState(false);
    const [warningDrawMode, setWarningDrawMode] = useState(false);
    const [warningDraft, setWarningDraft] = useState({
        hazardType: 'heavyPrecip',
        validStartHours: 1,
        validDurationHours: 6,
        vertices: []
    });
    const [warningsByPlayerId, setWarningsByPlayerId] = useState({});
    const [draftWarningsByPlayerId, setDraftWarningsByPlayerId] = useState({});
    const [autoWarningDiagnosticsByPlayerId, setAutoWarningDiagnosticsByPlayerId] = useState({});
	const [activePostmortem, setActivePostmortem] = useState(null);
	const [showPostmortemPanel, setShowPostmortemPanel] = useState(true);
	const [postmortemQueueVersion, setPostmortemQueueVersion] = useState(0);
    const [forecastReportVersion, setForecastReportVersion] = useState(0);
    const [tuningParams, setTuningParams] = useState(DEFAULT_TUNING);
	const [uplinkHubsVersion, setUplinkHubsVersion] = useState(0);
	const [selectedUplinkHubId, setSelectedUplinkHubId] = useState(null);
	const [alertsHistory, setAlertsHistory] = useState([]);
	const [alertsUnreadCount, setAlertsUnreadCount] = useState(0);
	const [showAlertsPanel, setShowAlertsPanel] = useState(false);
	const [showObservingNetwork, setShowObservingNetwork] = useState(false);
    const [showForecastReport, setShowForecastReport] = useState(false);
	const [showDebugPanel, setShowDebugPanel] = useState(true);
    const [cloudWatchDebugEnabled, setCloudWatchDebugEnabled] = useState(false);
    const [cloudWatchDebugInfo, setCloudWatchDebugInfo] = useState([]);
    const [windTargetsStatus, setWindTargetsStatus] = useState(null);
    const [windReferenceDiagnostics, setWindReferenceDiagnostics] = useState(null);
    const [windReferenceComparison, setWindReferenceComparison] = useState(null);
    const showFogLayerRef = useRef(true);
    const showWeatherLayerRef = useRef(true);
    const [weatherDebugMode, setWeatherDebugMode] = useState('clouds');
    const weatherDebugModeRef = useRef('clouds');
    const [simPausedUI, setSimPausedUI] = useState(false);
    const [simSpeedUI, setSimSpeedUI] = useState(SIM_SPEED_DEFAULT);
    const [simTimeLabel, setSimTimeLabel] = useState('Day 0, 00:00');
    const [skipDayHover, setSkipDayHover] = useState(false);
    const [weatherSeed, setWeatherSeed] = useState(initialSeed);
    const [weatherSeedInput, setWeatherSeedInput] = useState(initialSeed);
    const [weatherLogEnabled, setWeatherLogEnabled] = useState(true);
    const [weatherLogCadence, setWeatherLogCadence] = useState(21600);
    const [weatherLogCount, setWeatherLogCount] = useState(0);
    const [weatherV2ConvectionEnabled, setWeatherV2ConvectionEnabled] = useState(true);
    const [sensorOnlyWeather, setSensorOnlyWeather] = useState(false);
    const zonalCanvasRef = useRef(null);
    const seedEditedRef = useRef(false);
    const orbitPreviewRef = useRef(null); // Green orbit preview line
    const orbitHandlesRef = useRef([]);   // Draggable preview handle meshes
    const orbitArrowsRef = useRef([]); // little direction arrows
    const orbitPickMeshRef = useRef(null); // Invisible torus pick helper
    const orbitDragRef = useRef({ active: false, lastX: 0, mode: 'rotate' }); // Drag state
    const previewRAANRef = useRef(null);  // Current preview RAAN (rad), set by solver or drag
    const [satelliteType, setSatelliteType] = useState('communication');
    const [altitude, setAltitude] = useState('35785'); // Set default altitude
    const [speed, setSpeed] = useState('28800'); // Set default speed
    const [fieldOfView, setFieldOfView] = useState(7.95); // Set slider to max value
    const [angle, setAngle] = useState('0'); // Set default angle
    const [inclination, setInclination] = useState('11'); // Set default inclination
    const [satellites, setSatellites] = useState([]);
    const [selectedSatelliteId, setSelectedSatelliteId] = useState(null);
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
    const directionalLightRef = useRef(null);
    const controlsRef = useRef(null);
    const simClockRef = useRef(new SimClock({ startTimeSeconds: 0, simSpeed: SIM_SPEED_DEFAULT, paused: false }));
    const simAccumSecondsRef = useRef(0);
    const simAdvanceQueueSecondsRef = useRef(0);
    const simBurstActiveRef = useRef(false);
    const lastFrameMsRef = useRef(null);
    const sunDirRef = useRef(new THREE.Vector3());
    const orbitHoveringRef = useRef(false); // true while pointer over orbit gizmo
    // Live mirrors for state that global listeners read
    const showSatPanelRef = useRef(false);
    const altitudeRef = useRef(altitude);
    const inclinationRef = useRef(inclination);
    const previewNormalRef = useRef(null); // plane normal n (always ⟂ to HQ vector t)
    const showAlertsPanelRef = useRef(false);
    const alertsButtonRef = useRef(null);
    const cloudWatchDebugRef = useRef(false);
    const cloudWatchDebugInfoRef = useRef({ lastUpdateMs: 0 });
    const windTargetsStatusRef = useRef({ lastUpdateMs: 0 });
    const lastSensorGatingRef = useRef(null);
    const showForecastOverlayRef = useRef(false);
    const forecastProductRef = useRef('cloudTau');
    const forecastLeadHoursRef = useRef(1);
    const showCloudObsRef = useRef(showCloudObs);
    const sensorOnlyWeatherRef = useRef(sensorOnlyWeather);
	const warningOverlayFocusRef = useRef({
		activeHazardType: null,
		lastWarningId: null
	});
    const warningDrawModeRef = useRef(false);
    const warningDraftRef = useRef(warningDraft);
    const warningsByPlayerIdRef = useRef({});
    const draftWarningsByPlayerIdRef = useRef({});
    const autoWarningDiagnosticsByPlayerIdRef = useRef({});
    const postmortemQueueRef = useRef([]);
    const activePostmortemRef = useRef(null);
    const postmortemCanvasRef = useRef(null);
	const uplinkHubsByPlayerIdRef = useRef({});
	const eventsByPlayerIdRef = useRef({});
	const forecastSkillSummaryRef = useRef({});
    const forecastReportByPlayerIdRef = useRef({});
    const tuningParamsRef = useRef(DEFAULT_TUNING);
	const scoringMetaByPlayerIdRef = useRef({});
	const serviceMaskRef = useRef({ playerId: null, gridKey: '', hqCount: 0, mask: null });
    const lastEventSampleRef = useRef(null);
    const areaWeightsRef = useRef({ gridKey: '', weights: null });
    const cursorLatLonRef = useRef(null);
    const anchorLatLonRef = useRef(null);
    const anchorMeshRef = useRef(null);
    const anchorLockRef = useRef(null);
    const selectionActiveRef = useRef(false);
    const selectionAnchorRef = useRef(null);
    const selectionRectRef = useRef(null);
    const selectionOutlineRef = useRef(null);
    const selectionDataRef = useRef(null);
    const selectionControlsStateRef = useRef(null);
    const selectionPendingClickRef = useRef(null);
    const selectionRaycasterRef = useRef(new THREE.Raycaster());
    const selectionMenuRef = useRef(null);
    const forecastHintShownRef = useRef(false);
    const placeUplinkHubRef = useRef(false);
    const uplinkHubGhostRef = useRef(null);
    const selectedUplinkHubIdRef = useRef(null);


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
    const [runCounter, setRunCounter] = useState(0);
    const [runScore, setRunScore] = useState(0);
    const [bestScore, setBestScore] = useState(null);
    const [sensorHudInfo, setSensorHudInfo] = useState(null);
    const [focusedWarningInfo, setFocusedWarningInfo] = useState(null);
    const [cursorLatLon, setCursorLatLon] = useState(null);
    const [anchorLatLon, setAnchorLatLon] = useState(null);
    const [selectionDragRect, setSelectionDragRect] = useState(null);
    const [selectionMenu, setSelectionMenu] = useState(null);

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
        const simTimeSeconds = simClockRef.current?.simTimeSeconds;
        setAlertsHistory(prev => {
            const next = [...prev, {
                id,
                severity,
                message,
                simTimeSeconds,
                createdAtMs: Date.now()
            }];
            if (next.length > ALERTS_HISTORY_MAX) {
                next.splice(0, next.length - ALERTS_HISTORY_MAX);
            }
            return next;
        });
        if (!showAlertsPanelRef.current) {
            setAlertsUnreadCount(count => count + 1);
        }
        // auto-remove after ttl
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ttl + 200);
    };
    // Initialize the scene, camera, renderer, controls, and lights
    useEffect(() => {
        if (!gameMode) return;

        // Reset shared refs/state when switching modes
        satellitesRef.current = [];
        hqSpheresRef.current = [];
        Object.values(uplinkHubsByPlayerIdRef.current).forEach((hubs) => {
            hubs.forEach((hub) => {
                if (hub?.mesh) sceneRef.current?.remove(hub.mesh);
            });
        });
        uplinkHubsByPlayerIdRef.current = {};
        setSelectedUplinkHubId(null);
        placeUplinkHubRef.current = false;
        if (uplinkHubGhostRef.current) {
            sceneRef.current?.remove(uplinkHubGhostRef.current);
            uplinkHubGhostRef.current = null;
        }
        setUplinkHubsVersion(v => v + 1);
        syncUplinkHubsToEarth();
        knownEnemyHQsRef.current = {};
        compromisedHQIdsRef.current = new Set();
        pendingWarningsRef.current = {};
        setSatellites([]);
        setPlayers([]);
        setToasts([]);
	        setAlertsHistory([]);
	        setAlertsUnreadCount(0);
	        setShowAlertsPanel(false);
	        setShowObservingNetwork(false);
            setShowForecastReport(false);
            setWindTargetsStatus(null);
	        setWarningsByPlayerId({});
	        warningsByPlayerIdRef.current = {};
	        setDraftWarningsByPlayerId({});
	        draftWarningsByPlayerIdRef.current = {};
	        setAutoWarningDiagnosticsByPlayerId({});
	        autoWarningDiagnosticsByPlayerIdRef.current = {};
        postmortemQueueRef.current = [];
        activePostmortemRef.current = null;
        setActivePostmortem(null);
        setShowPostmortemPanel(true);
        setPostmortemQueueVersion(0);
	        eventsByPlayerIdRef.current = {};
            forecastReportByPlayerIdRef.current = {};
            setForecastReportVersion(0);
	        serviceMaskRef.current = { playerId: null, gridKey: '', hqCount: 0, mask: null };
        areaWeightsRef.current = { gridKey: '', weights: null };
        lastEventSampleRef.current = null;
        scoringMetaByPlayerIdRef.current = {};
        setActivePlayerId(null);
        setCurrentTurn(0);
        setActionPoints(AP_MAX);
        setShowMenu(false);
        setShowSatPanel(false);
        setShowSatListPanel(false);
        setShowDebugPanel(true);
        setShowStrikePad(false);
        setWarningDrawMode(false);
        setWarningDraft({
            hazardType: 'heavyPrecip',
            validStartHours: 1,
            validDurationHours: 6,
            vertices: []
        });
		warningOverlayFocusRef.current = {
			activeHazardType: null,
			lastWarningId: null
		};
        setFocusedWarningInfo(null);
        setSensorHudInfo(null);
        setShowForecastOverlay(false);
        setForecastProduct('cloudTau');
        setForecastLeadHours(1);
        setForecastStatus({ running: false, progress01: 0, message: '', lastRunId: null });
        setForecastBaseTimeSeconds(null);
        setShowForecastAdvanced(false);
        setRunScore(0);
        setWeatherLogEnabled(false);
        setWeatherLogCount(0);
        showHQSphereRef.current = false;
        forecastHintShownRef.current = false;

        const simClock = simClockRef.current;
        simClock.simTimeSeconds = 0;
        simClock.setSpeed(simSpeedUI);
        simClock.setPaused(simPausedUI);
        simAccumSecondsRef.current = 0;
        simAdvanceQueueSecondsRef.current = 0;
        simBurstActiveRef.current = false;
        lastFrameMsRef.current = null;
        setSimTimeLabel('Day 0, 00:00');

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

        // Initialize players based on mode
        const playersList = [new Player('player1')];
        if (gameMode === 'pvp') {
            playersList.push(new Player('player2'));
        }
        setPlayers(playersList);
        playersList.forEach(p => {
            applyTierToPlayer(p);
            playersMap[p.id] = p;
            knownEnemyHQsRef.current[p.id] = new Set();
            pendingWarningsRef.current[p.id] = false;
        });

        // Subscribe to turn and AP events for UI updates
        eventBus.on('TURN_STARTED', ({ playerId, turnNumber }) => {
            setActivePlayerId(playerId);
            setCurrentTurn(turnNumber);
            if (pendingWarningsRef.current[playerId]) {
                notify('warning', `The enemy has located your HQ!`);
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
            const repFactor = 0.5 + (player.reputation ?? 50) / 100;
            const income = (BASE_INCOME_PER_TURN + imagingCount * INCOME_PER_IMAGING_IN_LINK + commCount * INCOME_PER_COMM_IN_LINK) * repFactor;
            const upkeep = totalCount * UPKEEP_PER_SAT;
            player.funds += income - upkeep;
        });

        // Enemy HQ detection -> reveal to attacker; warn defender
        eventBus.on('DETECTION_HQ', ({ ownerId, enemyId, hqId, position }) => {
            // mark intel for attacker (if enemy exists in this mode)
            if (knownEnemyHQsRef.current[ownerId]) {
                knownEnemyHQsRef.current[ownerId].add(enemyId);
            }
            if (hqId) compromisedHQIdsRef.current.add(hqId);
            if (pendingWarningsRef.current[enemyId] !== undefined) {
                pendingWarningsRef.current[enemyId] = true;
            }

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
        scene.background = new THREE.Color(0x000005);
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.7, 100000);
        camera.position.set(0, 0, 20000); // Set camera far enough to view the entire Earth
        cameraRef.current = camera;
        scene.add(camera);
        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        const initialDpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(initialDpr);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.setClearColor(0x000005, 1);
        rendererRef.current = renderer;
        const mountNode = mountRef.current;
        if (mountNode) {
            mountNode.appendChild(renderer.domElement);
        }

        // Handle WebGL context lost and restore
        renderer.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            notify('error', 'WebGL context lost. If graphics freeze, try reloading or reducing load.');
        }, false);

        renderer.domElement.addEventListener('webglcontextrestored', () => {
            notify('info', 'WebGL context restored.');
            // Reinitialize the scene or handle the context restoration as needed
        }, false);

        // Create Earth
        const seedNum = Number.parseInt(weatherSeed, 10);
        const earth = new Earth(camera, playersList, {
            weatherSeed: Number.isFinite(seedNum) ? seedNum : undefined
        });
        earth.render(scene);
        earthRef.current = earth;
        earth.setTextureAnisotropy?.(renderer.capabilities?.getMaxAnisotropy?.() ?? 1);
        setSatellites([...satellitesRef.current]);
        const urlParams = new URLSearchParams(window.location.search);
        const radarDebug = process.env.NODE_ENV !== 'production' && urlParams.get('radarDebug') === '1';
        const cloudWatchDebug = process.env.NODE_ENV !== 'production' && urlParams.get('cloudWatchDebug') === '1';
        earth.initRadarVolume?.(renderer, { debug: radarDebug });
        earth.initWeatherSensors?.({ renderer });
        earth.setCloudWatchDebugEnabled?.(cloudWatchDebug);
        cloudWatchDebugRef.current = cloudWatchDebug;
        setCloudWatchDebugEnabled(cloudWatchDebug);
        earth.setWeatherVisible(false);
        earth.setCloudObsVisible(false);
        if (process.env.NODE_ENV !== 'production') {
            window.__sw = window.__sw || {};
            window.__sw.earth = earth;
            window.__sw.getSimProbeState = () => {
                const simClock = simClockRef.current;
                const core = earthRef.current?.weatherField?.core;
                const elev = core?.geo?.elev;
                let terrainMax = 0;
                if (elev?.length) {
                    for (let i = 0; i < elev.length; i += 1) {
                        terrainMax = Math.max(terrainMax, elev[i] || 0);
                    }
                }
                const simTimeSeconds = simClock?.simTimeSeconds ?? 0;
                return {
                    simTimeSeconds,
                    simTimeLabel: formatSimTime(simTimeSeconds),
                    simTimeLabelSeconds: simTimeSeconds,
                    simSpeed: simClock?.simSpeed ?? null,
                    paused: simClock?.paused ?? null,
                    queuedAdvanceSeconds: simAdvanceQueueSecondsRef.current ?? 0,
                    simAccumSeconds: simAccumSecondsRef.current ?? 0,
                    burstActive: simBurstActiveRef.current ?? false,
                    coreTimeUTC: core?.timeUTC ?? null,
                    weatherReady: Boolean(core?.ready),
                    terrainReady: terrainMax > 0,
                    terrainMax,
                    workerSyncStatus: earthRef.current?.getWeatherWorkerSyncStatus?.(simTimeSeconds) ?? null
                };
            };
            window.__sw.setSimProbePaused = (paused = true) => {
                simClockRef.current?.setPaused(Boolean(paused));
                return window.__sw.getSimProbeState?.() ?? null;
            };
            window.__sw.queueSimProbeAdvance = (deltaSeconds, options = {}) => {
                const delta = Number(deltaSeconds);
                if (Number.isFinite(delta) && delta > 0) {
                    queueSimAdvanceSeconds(delta, { burst: options?.burst !== false });
                }
                return window.__sw.getSimProbeState?.() ?? null;
            };
            window.__sw.advanceSimProbeTo = (targetSeconds, options = {}) => {
                const simClock = simClockRef.current;
                const current = simClock?.simTimeSeconds ?? 0;
                const target = Number(targetSeconds);
                if (!Number.isFinite(target)) {
                    return window.__sw.getSimProbeState?.() ?? null;
                }
                const delta = target - current;
                if (delta > 0) {
                    queueSimAdvanceSeconds(delta, { burst: options?.burst !== false });
                }
                return window.__sw.getSimProbeState?.() ?? null;
            };
            window.__sw.sampleRadarV2 = (lat, lon, sigma = 0.95) => sampleV2AtLatLonSigma(
                earth.weatherField?.core,
                lat,
                lon,
                sigma,
                { method: 'bilinear', returnMeta: true }
            );
            window.__sw.getRadarOrigin = () => {
                const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
                const origin = earth.getGroundRadarOriginLatLonRad?.(simTimeSeconds);
                if (!origin) return null;
                return {
                    latDeg: THREE.MathUtils.radToDeg(origin.latRad),
                    lonDeg: THREE.MathUtils.radToDeg(origin.lonRad),
                    source: origin.source ?? 'unknown'
                };
            };
            window.__sw.logRadarOrigin = () => {
                const info = window.__sw.getRadarOrigin?.();
                if (!info) {
                    console.log('[radar] origin unavailable');
                    return null;
                }
                console.log(`[radar] origin ${info.source} lat=${info.latDeg.toFixed(3)} lon=${info.lonDeg.toFixed(3)}`);
                return info;
            };
            window.__sw.setRadarZScale = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.zScale) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.zScale.value;
                pass.material.uniforms.zScale.value = v;
                return pass.material.uniforms.zScale.value;
            };
            window.__sw.setRadarZExponent = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.zExponent) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.zExponent.value;
                pass.material.uniforms.zExponent.value = v;
                return pass.material.uniforms.zExponent.value;
            };
            window.__sw.setRadarDbzMin = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.dbzMin) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.dbzMin.value;
                pass.material.uniforms.dbzMin.value = v;
                return pass.material.uniforms.dbzMin.value;
            };
            window.__sw.setRadarQMin = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.qMin) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.qMin.value;
                pass.material.uniforms.qMin.value = v;
                return pass.material.uniforms.qMin.value;
            };
            window.__sw.setRadarDbzAlphaSpan = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.dbzAlphaSpan) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.dbzAlphaSpan.value;
                pass.material.uniforms.dbzAlphaSpan.value = v;
                return pass.material.uniforms.dbzAlphaSpan.value;
            };
            window.__sw.radarDiskStats = () => {
                const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
                const origin = earth.getGroundRadarOriginLatLonRad?.(simTimeSeconds);
                const core = window.__sw.earth?.weatherField?.core;
                const grid = core?.grid;
                const state = core?.state;
                if (!origin || !core || !grid || !state) return null;

                const { nx, ny, latDeg, lonDeg } = grid;
                const N = nx * ny;
                if (!nx || !ny || !latDeg || !lonDeg) return null;

                const rangeMaxKm = DEFAULT_GROUND_DOPPLER_SPECS.rangeMaxKm;
                const rangeMaxM = rangeMaxKm * 1000;
                const cosLat0 = Math.cos(origin.latRad);
                const precip = state.precipRate;
                const qr = state.qr;
                const nz = state.nz ?? core.nz ?? 0;
                const base = Math.max(0, nz - 1) * N;

                const maxPrecip = { value: 0, distKm: null, latDeg: null, lonDeg: null };
                const maxQr = { value: 0, distKm: null, latDeg: null, lonDeg: null };

                for (let j = 0; j < ny; j += 1) {
                    const latRad = THREE.MathUtils.degToRad(latDeg[j]);
                    const dLat = latRad - origin.latRad;
                    const rowOffset = j * nx;
                    for (let i = 0; i < nx; i += 1) {
                        const lonRad = THREE.MathUtils.degToRad(lonDeg[i]);
                        const dLon = wrapRadToPi(lonRad - origin.lonRad);
                        const eastM = dLon * RE_M * cosLat0;
                        const northM = dLat * RE_M;
                        const rM = Math.hypot(eastM, northM);
                        if (rM > rangeMaxM) continue;

                        const k = rowOffset + i;
                        if (precip && precip.length === N) {
                            const val = precip[k];
                            if (val > maxPrecip.value) {
                                maxPrecip.value = val;
                                maxPrecip.distKm = rM / 1000;
                                maxPrecip.latDeg = latDeg[j];
                                maxPrecip.lonDeg = lonDeg[i];
                            }
                        }
                        if (qr && qr.length >= base + N) {
                            const val = qr[base + k];
                            if (val > maxQr.value) {
                                maxQr.value = val;
                                maxQr.distKm = rM / 1000;
                                maxQr.latDeg = latDeg[j];
                                maxQr.lonDeg = lonDeg[i];
                            }
                        }
                    }
                }

                const result = {
                    rangeKm: rangeMaxKm,
                    origin: {
                        latDeg: THREE.MathUtils.radToDeg(origin.latRad),
                        lonDeg: THREE.MathUtils.radToDeg(origin.lonRad),
                        source: origin.source ?? 'unknown'
                    },
                    maxPrecipRateMmHr: maxPrecip,
                    maxQrSurface: maxQr
                };
                console.log('[radar] disk stats', result);
                return result;
            };
            window.__sw.cloudSatProbe = () => earthRef.current?.debugCloudSatMappingProbe?.();
            window.__sw.weatherObsLatest = () => earthRef.current?.latestWeatherObservations;
            window.__sw.clearCloudIntel = () => {
                const pid = currentPlayerRef.current?.id;
                return earthRef.current?.clearCloudIntelForPlayer?.(pid);
            };
            window.__sw.cloudWatchCalibrate = (enabled = true) => {
                earthRef.current?.setCloudWatchCalibrationEnabled?.(enabled);
            };
        }
        earth.setWeatherDebugMode(weatherDebugModeRef.current);
        earth.setWeatherVisible(false);
        earth.setFogVisible(sensorOnlyWeather ? false : showFogLayerRef.current);
        earth.setCloudObsVisible(false);

        // Sync view and objects on turn start (after Earth exists)
        eventBus.on('TURN_STARTED', ({ playerId }) => {
            currentPlayerRef.current = playersMap[playerId];
            earthRef.current.setCurrentPlayer(playerId);
            renderPlayerObjects();
            // Reset orbit preview to this player's HQ
            previewNormalRef.current = null;
            previewRAANRef.current = null;
            if (showSatPanelRef.current) updateOrbitPreview();
        });
        // Now that Earth is ready, start the turn cycle, emitting initial TURN_STARTED
        turnManager.startGame(playersList.map(p => p.id));


        // Set up camera and orbit controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = true;
        controlsRef.current = controls;
        const handleControlStart = () => {
            if (anchorLockRef.current) anchorLockRef.current.isDragging = true;
        };
        const handleControlEnd = () => {
            if (anchorLockRef.current) anchorLockRef.current.isDragging = false;
        };
        controls.addEventListener('start', handleControlStart);
        controls.addEventListener('end', handleControlEnd);
        // Let canvas own pointer gestures for our gizmo drags
        renderer.domElement.style.touchAction = 'none';

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 0, 0);
        directionalLight.target.position.set(0, 0, 0);
        scene.add(directionalLight.target);
        scene.add(directionalLight);
        directionalLightRef.current = directionalLight;

        // Add AxesHelper to the scene
        const axesHelper = new THREE.AxesHelper(80);
        scene.add(axesHelper);

        // Input listeners (capture phase to override OrbitControls when needed)
        const onPointerDownCapture = (e) => {
            if (tryStartOrbitDrag(e)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        renderer.domElement.addEventListener('pointermove', handlePointerMoveCapture, { capture: true, passive: false });
        renderer.domElement.addEventListener('pointerdown', onPointerDownCapture,      { capture: true, passive: false });
        renderer.domElement.addEventListener('pointerup',   handlePointerUpCapture,     { capture: true });
        window.addEventListener('pointerup', handlePointerUpCapture, true);

        renderer.domElement.addEventListener('pointermove', handleMouseMove); // <— NEW, ensures drag updates fire
        renderer.domElement.addEventListener('contextmenu', handleRightClick);

        // Handle window resize
        const handleResize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            renderer.setPixelRatio(dpr);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        window.addEventListener('mousedown', handleMouseClick);
        window.addEventListener('keydown', handleKeyDown);


        // Initial player objects rendering is handled via TURN_STARTED event
        // renderPlayerObjects();

        // Cleanup on component unmount
        return () => {
            window.removeEventListener('resize', handleResize);
            renderer.domElement.removeEventListener('pointermove', handlePointerMoveCapture, true);
            renderer.domElement.removeEventListener('pointerdown', onPointerDownCapture, true);
            renderer.domElement.removeEventListener('pointerup', handlePointerUpCapture, true);
            window.removeEventListener('pointerup', handlePointerUpCapture, true);
            renderer.domElement.removeEventListener('pointermove', handleMouseMove);
            renderer.domElement.removeEventListener('contextmenu', handleRightClick);
            controls.removeEventListener('start', handleControlStart);
            controls.removeEventListener('end', handleControlEnd);
            window.removeEventListener('mousedown', handleMouseClick);
            window.removeEventListener('keydown', handleKeyDown);
            if (rendererRef.current) rendererRef.current.dispose();
            if (sceneRef.current) {
                sceneRef.current.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                    sceneRef.current.remove(child);
                });
            }
            if (mountNode && renderer.domElement.parentNode === mountNode) {
                mountNode.removeChild(renderer.domElement);
            }
        };
    }, [gameMode, runCounter]);

    // Orbit preview helpers
    const removeOrbitPreview = () => {
        const removeObj = (obj) => {
            if (obj?.parent) obj.parent.remove(obj);
        };

        if (orbitPreviewRef.current) {
            removeObj(orbitPreviewRef.current);
            orbitPreviewRef.current.geometry?.dispose?.();
            orbitPreviewRef.current.material?.dispose?.();
            orbitPreviewRef.current = null;
        }

        if (orbitHandlesRef.current.length) {
            orbitHandlesRef.current.forEach(h => {
                removeObj(h);
                h.geometry?.dispose?.();
                h.material?.dispose?.();
            });
            orbitHandlesRef.current = [];
        }

        if (orbitArrowsRef.current.length) {
            orbitArrowsRef.current.forEach(a => {
                removeObj(a);
                a.geometry?.dispose?.();
                a.material?.dispose?.();
            });
            orbitArrowsRef.current = [];
        }

        if (orbitPickMeshRef.current) {
            removeObj(orbitPickMeshRef.current);
            orbitPickMeshRef.current.geometry?.dispose?.();
            orbitPickMeshRef.current.material?.dispose?.();
            orbitPickMeshRef.current = null;
        }
    };

    function getMainHQ() {
        const me = currentPlayerRef.current;
        if (!me) return null;
        const list = (me.getHQs?.() || []);
        if (list.length) return list[0];
        // Fallback: find by ownership in the scene registry
        return hqSpheresRef.current.find(h => h.ownerID === me.id) || null;
    }

    function getHQUnitVector() {
        const hq = getMainHQ();
        if (!hq) return null;
        const hqWorld = new THREE.Vector3();
        hq.sphere.getWorldPosition(hqWorld);
        return hqWorld.normalize();
    }

    function solveRAANForInc(incRad, t) {
        const i = incRad;
        const lat = Math.asin(t.y);
        const sinI = Math.sin(i);
        const cosI = Math.cos(i);
        const EPS = 1e-8;

        let solved = false;
        let best = { err: Number.POSITIVE_INFINITY, raan: 0, nu: 0 };

        if (Math.abs(sinI) < 1e-6) {
            if (Math.abs(lat) <= 1e-3) {
                const Rx = new THREE.Matrix4().makeRotationX(i);
                const lon = Math.atan2(t.z, t.x);
                const Ry = new THREE.Matrix4().makeRotationY(lon);
                const a = new THREE.Vector3(1, 0, 0).applyMatrix4(Rx).applyMatrix4(Ry);
                const b = new THREE.Vector3(0, 0, 1).applyMatrix4(Rx).applyMatrix4(Ry);
                const nu = Math.atan2(t.clone().dot(b), t.clone().dot(a));
                const p = a.clone().multiplyScalar(Math.cos(nu)).add(b.clone().multiplyScalar(Math.sin(nu)));
                const err = p.angleTo(t);
                best = { err, raan: lon, nu };
                solved = true;
            }
        }

        if (!solved) {
            const A = t.x;
            const B = t.z;
            const M = Math.hypot(A, B);
            const lon = Math.atan2(t.z, t.x);
            if (M < EPS) {
                if (Math.abs(cosI) < 1e-6) {
                    const Omega = -lon;
                    const Rx = new THREE.Matrix4().makeRotationX(i);
                    const Ry = new THREE.Matrix4().makeRotationY(Omega);
                    const a = new THREE.Vector3(1, 0, 0).applyMatrix4(Rx).applyMatrix4(Ry);
                    const b = new THREE.Vector3(0, 0, 1).applyMatrix4(Rx).applyMatrix4(Ry);
                    const nu = Math.atan2(t.clone().dot(b), t.clone().dot(a));
                    const p = a.clone().multiplyScalar(Math.cos(nu)).add(b.clone().multiplyScalar(Math.sin(nu)));
                    const err = p.angleTo(t);
                    best = { err, raan: Omega, nu };
                    solved = true;
                }
            } else {
                const C = - (cosI / Math.max(sinI, EPS)) * t.y; // -cot(i)*t.y
                const ratio = C / M;
                if (ratio >= -1 - 1e-9 && ratio <= 1 + 1e-9) {
                    const clamp = Math.max(-1, Math.min(1, ratio));
                    const psi = Math.atan2(A, B);
                    const delta = Math.acos(clamp);
                    const candidates = [psi + delta, psi - delta];
                    const Rx = new THREE.Matrix4().makeRotationX(i);
                    for (const Omega of candidates) {
                        const Ry = new THREE.Matrix4().makeRotationY(Omega);
                        const a = new THREE.Vector3(1, 0, 0).applyMatrix4(Rx).applyMatrix4(Ry);
                        const b = new THREE.Vector3(0, 0, 1).applyMatrix4(Rx).applyMatrix4(Ry);
                        const nu = Math.atan2(t.clone().dot(b), t.clone().dot(a));
                        const p = a.clone().multiplyScalar(Math.cos(nu)).add(b.clone().multiplyScalar(Math.sin(nu)));
                        const err = p.angleTo(t);
                        if (err < best.err) best = { err, raan: Omega, nu };
                    }
                    solved = true;
                }
            }
        }
        return { solved, raan: best.raan, nu: best.nu };
    }

    function solveIncForRAAN(raan, t) {
        const A = t.x;
        const B = t.z;
        const denom = A * Math.sin(raan) + B * Math.cos(raan);
        if (Math.abs(denom) < 1e-8) return Math.PI / 2;
        const i = Math.atan(-t.y / denom);
        const iAbs = Math.abs(i);
        return Math.max(0, Math.min(Math.PI / 2, iAbs));
    }

    const updateOrbitPreview = () => {
        const scene = sceneRef.current;
        const earth = earthRef.current;
        if (!scene || !earth) return;

        // Remove any existing preview bits
        removeOrbitPreview();

        // Need an HQ to preview a launchable orbit
        const hq = getMainHQ();
        if (!hq) return;

        const previewParent = earth.parentObject ?? scene;

        // t = unit vector from Earth center to HQ (Earth-local space)
        const t = hq.sphere.position.clone().normalize();

        // n = plane normal, keep n·t = 0 (orbit plane must contain HQ)
        let n = previewNormalRef.current;
        if (!n) {
            const ref = Math.abs(t.x) < 0.8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
            n = t.clone().cross(ref).normalize(); // any perpendicular to t
        } else {
            // sanitize: force exact perpendicular to t
            n = n.clone().sub(t.clone().multiplyScalar(n.dot(t))).normalize();
        }
        // Keep prograde by convention
        if (n.y < 0) n.multiplyScalar(-1);

        // --- Elements derived from the plane normal (with snapping to reachable band) ---
        const lat = Math.asin(t.y); // site latitude (rad)

        // raw inclination from current normal
        let incRad = Math.acos(THREE.MathUtils.clamp(n.y, -1, 1));

        // clamp to physically reachable **prograde** band: i ∈ [|φ|, 90°]
        const incClamped = Math.max(Math.abs(lat), Math.min(incRad, Math.PI / 2));

        // If we had to clamp, rotate the plane normal n so the preview matches
        if (Math.abs(incClamped - incRad) > 1e-6) {
            const y = new THREE.Vector3(0, 1, 0);

            // u = projection of +Y onto plane ⟂ t  (direction that controls n.y)
            let u = y.clone().sub(t.clone().multiplyScalar(y.dot(t)));
            const ulen = u.length();
            if (ulen < 1e-6) {
                // At the pole: use X projected instead
                u = new THREE.Vector3(1, 0, 0).sub(t.clone().multiplyScalar(t.x)).normalize();
            } else {
                u.multiplyScalar(1 / ulen);
            }

            // v completes an orthonormal basis in the plane (t, u, v are mutually ⟂)
            const v = t.clone().cross(u).normalize();

            // Preserve around-t orientation (sign of the v component)
            const signV = Math.sign(n.dot(v)) || 1;

            // Choose γ so that n'.y = cos(incClamped); since v.y = 0, only u contributes to y
            const uy   = Math.abs(u.y);
            const cosG = uy < 1e-6 ? 0 : THREE.MathUtils.clamp(Math.cos(incClamped) / uy, -1, 1);
            const sinG = signV * Math.sqrt(Math.max(0, 1 - cosG * cosG));

            // New plane normal snapped to the band, still ⟂ t
            n = u.multiplyScalar(cosG).add(v.multiplyScalar(sinG)).normalize();
            incRad = incClamped;
        } else {
            incRad = incClamped;
        }

        // Update readouts derived from the (possibly adjusted) normal
        const raan   = Math.atan2(n.x, n.z);
        const newDeg = THREE.MathUtils.radToDeg(incRad).toFixed(2);
        if (Math.abs(parseFloat(inclination) - parseFloat(newDeg)) > 0.05) {
            setInclination(newDeg);
        }
        previewRAANRef.current   = raan;
        previewNormalRef.current = n;

        // Build ring in the plane using basis (a = t, b = n×a)
        const earthRadiusKm = earth.earthRadiusKm;
        const altKm = parseFloat(altitudeRef.current || altitude || '0');
        const radius = Math.max(earthRadiusKm + altKm, earthRadiusKm + 10);

        const a = t.clone(); // passes through HQ at θ=0
        const b = n.clone().cross(a).normalize(); // forward direction at θ=0

        // Green orbit ring
        const segments = 512;
        const pts = [];
        for (let s = 0; s <= segments; s++) {
            const theta = (s / segments) * Math.PI * 2;
            const p = a.clone().multiplyScalar(Math.cos(theta))
                .add(b.clone().multiplyScalar(Math.sin(theta)))
                .multiplyScalar(radius);
            pts.push(p);
        }
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat  = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const ringLine = new THREE.Line(geom, mat);
        previewParent.add(ringLine);
        orbitPreviewRef.current = ringLine;

        // Create 4 draggable node handles at 0°, 90°, 180°, 270° along the ring
        const nodeAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        // --- Handles (smaller) ---
          const handleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
          const handleR = Math.max(radius * 0.007, 60);   // smaller handles

        nodeAngles.forEach(theta => {
            const p = a.clone().multiplyScalar(Math.cos(theta))
                      .add(b.clone().multiplyScalar(Math.sin(theta)))
                  .multiplyScalar(radius);

            const m = new THREE.Mesh(new THREE.SphereGeometry(handleR, 16, 16), handleMaterial);
            m.position.copy(p);
            m.userData.kind = 'orbitHandle';
            previewParent.add(m);
            orbitHandlesRef.current.push(m);
        });

// --- Pick torus (thinner so it looks lighter but still easy to grab) ---
        const torusTube = Math.max(radius * 0.004, 40); // was 0.01, 80
        const torusGeo = new THREE.TorusGeometry(radius, torusTube, 12, 128);
        const torusMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.0 });
        const torus = new THREE.Mesh(torusGeo, torusMat);
// orient to plane: Y-axis → -n (same as your basis)
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
        torus.quaternion.copy(q);
        torus.material.depthWrite = false;
        torus.material.colorWrite = false;
        previewParent.add(torus);
        orbitPickMeshRef.current = torus;

// --- Direction arrows (smaller cones) ---
        const arrowCount = 10;
        const arrowH = Math.max(radius * 0.02, 220);  // height (smaller)
        const arrowR = Math.max(radius * 0.006, 60);  // base radius (smaller)
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

        for (let i = 0; i < arrowCount; i++) {
            const theta = (i / arrowCount) * Math.PI * 2;
            // point on ring
            const p = a.clone().multiplyScalar(Math.cos(theta))
                .add(b.clone().multiplyScalar(Math.sin(theta))).multiplyScalar(radius);

            // tangent = direction of motion (prograde): n × (r̂)
            const tangent = n.clone().cross(p.clone().normalize()).normalize();

            const cone = new THREE.Mesh(new THREE.ConeGeometry(arrowR, arrowH, 10), arrowMat);
            // Cone model points +Y; rotate so +Y aligns with tangent
            cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

            // place cone slightly “ahead” of the ring so it’s visible
            cone.position.copy(p).add(tangent.clone().multiplyScalar(arrowH * 0.35));

            previewParent.add(cone);
            orbitArrowsRef.current.push(cone);
        }

        // Invisible pick surface (thin ring) so clicking the ring starts a drag
        const pickWidth = Math.max(radius * 0.012, 150);
        const pick = new THREE.Mesh(
            new THREE.RingGeometry(radius - pickWidth, radius + pickWidth, 96),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
        );
        // Default RingGeometry faces +Z; rotate +Z → n
        pick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        previewParent.add(pick);
        orbitPickMeshRef.current = pick;
    };


    // ---- Orbit gizmo hit test (handles first, then pick ring) ----
    function hitOrbitGizmo(event) {
        if (!showSatPanelRef.current) return null;
        const scene = sceneRef.current;
        if (!scene || (!orbitHandlesRef.current.length && !orbitPickMeshRef.current)) return null;

        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        if (orbitHandlesRef.current.length) {
            const hit = raycaster.intersectObjects(orbitHandlesRef.current, false);
            if (hit.length) return hit[0];
        }
        if (orbitPickMeshRef.current) {
            const hit = raycaster.intersectObject(orbitPickMeshRef.current, false);
            if (hit.length) return hit[0];
        }
        return null;
    }

    // Capture-phase pointermove: toggle OrbitControls when hovering the gizmo
    function handlePointerMoveCapture(e) {
        if (!rendererRef.current) return;
        if (selectionActiveRef.current) {
            const controls = controlsRef.current;
            if (controls) {
                controls.enabled = false;
                controls.enableRotate = false;
                controls.enablePan = false;
                controls.enableZoom = false;
            }
            const dom = rendererRef.current.domElement;
            if (dom) dom.style.cursor = 'crosshair';
            return;
        }
        const hit = hitOrbitGizmo(e);
        const hovering = !!hit;
        orbitHoveringRef.current = hovering;

        const controls = controlsRef.current;
        const block = hovering || orbitDragRef.current.active;
        if (controls) {
            controls.enabled = !block;
            controls.enableRotate = !block;
            controls.enablePan = !block;
            controls.enableZoom = !block;
        }

        const dom = rendererRef.current.domElement;
        if (orbitDragRef.current.active) dom.style.cursor = 'grabbing';
        else if (hovering) dom.style.cursor = 'grab';
        else dom.style.cursor = '';
    }

    // Start orbit drag if the gizmo is hit (capture-phase on pointerdown)
    function tryStartOrbitDrag(event) {
        if (selectionActiveRef.current) return false;
        if (!showSatPanelRef.current) return false;
        const hit = hitOrbitGizmo(event);
        if (!hit) return false;

        event.preventDefault?.();
        event.stopPropagation?.();

        const dragMode = hit?.object?.userData?.kind === 'orbitHandle' ? 'radius' : 'rotate';

        // Compute baseline yaw around Y at the orbit preview radius
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(mouse, cameraRef.current);
        const cam = cameraRef.current;
        const origin = cam.position.clone();
        const dir = ray.ray.direction.clone();

        const earth = earthRef.current;
        const altKm = parseFloat(altitudeRef.current || '0');
        const radius = Math.max(earth.earthRadiusKm + altKm, earth.earthRadiusKm + 10);

        // Intersect ray with sphere of radius `radius`
        const A = dir.dot(dir);
        const B = 2 * origin.dot(dir);
        const C = origin.dot(origin) - radius * radius;
        const disc = B * B - 4 * A * C;
        if (disc < 0) return false;
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-B - sqrtDisc) / (2 * A);
        const t2 = (-B + sqrtDisc) / (2 * A);
        const tHit = t1 > 0 ? t1 : t2;
        if (tHit <= 0) return false;

        const hitPos = origin.clone().add(dir.multiplyScalar(tHit));
        const hitLocal = hitPos.clone();
        if (earth?.parentObject) {
            earth.parentObject.worldToLocal(hitLocal);
        }
        const yaw = Math.atan2(hitLocal.z, hitLocal.x);

        orbitDragRef.current.active = true;
        orbitDragRef.current.startYaw = yaw;
        orbitDragRef.current.startRAAN = (previewRAANRef.current ?? 0);
        orbitDragRef.current.radius = radius;
        orbitDragRef.current.mode = dragMode;

        const controls = controlsRef.current;
        if (controls) {
            controls.enabled = false;
            controls.enableRotate = false;
            controls.enablePan = false;
            controls.enableZoom = false;
        }

        const el = rendererRef.current?.domElement;
        if (el && el.setPointerCapture && event.pointerId != null) {
            try { el.setPointerCapture(event.pointerId); } catch (_) {}
        }
        if (el) el.style.cursor = 'grabbing';

        if (previewRAANRef.current == null) previewRAANRef.current = 0;
        return true;
    }

    // End drag, restore controls and cursor
    function handlePointerUpCapture() {
        orbitDragRef.current.active = false;
        orbitHoveringRef.current = false;
        orbitDragRef.current.mode = 'rotate';
        const controls = controlsRef.current;
        if (controls) {
            controls.enabled = true;
            controls.enableRotate = true;
            controls.enablePan = true;
            controls.enableZoom = true;
        }
        const el = rendererRef.current?.domElement;
        if (el) el.style.cursor = '';
    }

    // Collapse all UI panels + clean up any editor/ghost state
    function collapsePanels() {
        // hide panels
        setShowSatPanel(false);
        setShowStrikePad(false);

        // stop orbit preview / drag
        orbitDragRef.current.active = false;
        removeOrbitPreview();

        // remove HQ placement ghost
        showHQSphereRef.current = false;
        if (hqSphereRef.current) {
            sceneRef.current?.remove(hqSphereRef.current);
            hqSphereRef.current = null;
        }
        // remove uplink hub placement ghost
        placeUplinkHubRef.current = false;
        if (uplinkHubGhostRef.current) {
            uplinkHubGhostRef.current.parent?.remove?.(uplinkHubGhostRef.current);
            uplinkHubGhostRef.current = null;
        }

        // restore camera controls & cursor
        const controls = controlsRef.current;
        if (controls) {
            controls.enabled = true;
            controls.enableRotate = true;
            controls.enablePan = true;
            controls.enableZoom = true;
        }
        const el = rendererRef.current?.domElement;
        if (el) el.style.cursor = '';
    }

    const formatSimTime = (seconds) => {
        if (!Number.isFinite(seconds)) return 'Day 0, 00:00';
        const total = Math.max(0, Math.floor(seconds));
        const day = Math.floor(total / 86400);
        const hours = Math.floor((total % 86400) / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const pad = (value) => String(value).padStart(2, '0');
        return `Day ${day}, ${pad(hours)}:${pad(minutes)}`;
    };

    const formatHoursLabel = (hours) => {
        const h = Number(hours);
        if (!Number.isFinite(h)) return 'In ? hours';
        return `In ${h} hour${h === 1 ? '' : 's'}`;
    };

    const getAlertColor = (severity) => {
        switch (severity) {
            case 'success':
                return '#4ade80';
            case 'info':
                return '#60a5fa';
            case 'warning':
                return '#facc15';
            case 'error':
                return '#f87171';
            default:
                return '#e5e7eb';
        }
    };

    const getZonalScale = (values, mode) => {
        const config = WEATHER_DEBUG_SCALE[mode] || WEATHER_DEBUG_SCALE.clouds;
        const transform = config.log
            ? (v) => Math.log10(1 + Math.max(0, v))
            : (v) => v;
        let min = transform(config.min);
        let max = transform(config.max);
        if (values && values.length > 0) {
            const sorted = Array.from(values, (v) => {
                const t = transform(v);
                return Number.isFinite(t) ? t : 0;
            });
            sorted.sort((a, b) => a - b);
            const lo = Math.floor(0.05 * (sorted.length - 1));
            const hi = Math.floor(0.95 * (sorted.length - 1));
            const pMin = sorted[Math.max(0, lo)];
            const pMax = sorted[Math.min(sorted.length - 1, hi)];
            if (Number.isFinite(pMin) && Number.isFinite(pMax) && pMax > pMin) {
                min = pMin;
                max = pMax;
            }
        }
        if (config.diverging) {
            const maxAbs = Math.max(Math.abs(min), Math.abs(max)) || 1;
            min = -maxAbs;
            max = maxAbs;
        }
        if (!(max > min)) {
            min = 0;
            max = 1;
        }
        return { min, max, transform, diverging: Boolean(config.diverging) };
    };

    const drawZonalMean = (canvas, values, mode) => {
        if (!canvas || !values || values.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, w, h);
        const pad = 6;
        const plotW = w - pad * 2;
        const plotH = h - pad * 2;
        const { min, max, transform, diverging } = getZonalScale(values, mode);
        const denom = max - min || 1;

        if (diverging) {
            const zeroX = pad + ((transform(0) - min) / denom) * plotW;
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.moveTo(zeroX, pad);
            ctx.lineTo(zeroX, pad + plotH);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let j = 0; j < values.length; j++) {
            const t = Math.max(0, Math.min(1, (transform(values[j]) - min) / denom));
            const x = pad + t * plotW;
            const y = pad + (j / Math.max(1, values.length - 1)) * plotH;
            if (j === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(pad, pad, plotW, plotH);
    };

    function updateWeatherDebugNow() {
        const simTime = simClockRef.current?.simTimeSeconds ?? 0;
        setSimTimeLabel(formatSimTime(simTime));
        const earth = earthRef.current;
        if (!earth) return;
        const seed = earth.getWeatherSeed();
        if (seed !== undefined && seed !== null) {
            const seedText = String(seed);
            setWeatherSeed(seedText);
            if (!seedEditedRef.current) {
                setWeatherSeedInput(seedText);
            }
        }
        const canvas = zonalCanvasRef.current;
        if (canvas) {
            const zonal = earth.getWeatherZonalMean(weatherDebugModeRef.current);
            drawZonalMean(canvas, zonal, weatherDebugModeRef.current);
        }
        const logStatus = earth.getWeatherLogStatus?.();
        if (logStatus && Number.isFinite(logStatus.count)) {
            setWeatherLogCount(logStatus.count);
        }
        if (logStatus && typeof logStatus.enabled === 'boolean' && logStatus.enabled !== weatherLogEnabled) {
            setWeatherLogEnabled(logStatus.enabled);
        }
        if (
            logStatus &&
            Number.isFinite(logStatus.cadenceSeconds) &&
            logStatus.cadenceSeconds !== weatherLogCadence
        ) {
            setWeatherLogCadence(logStatus.cadenceSeconds);
        }

        const sensorStatus = earth.getSensorStatus?.();
        if (sensorStatus) {
            setSensorHudInfo(sensorStatus);
        }

        const player = currentPlayerRef.current;
        if (player) {
            const score = (player.funds ?? 0) + (player.reputation ?? 50) * 1_000_000;
            setRunScore(score);
            const key = `sw_bestScore_seed_${weatherSeed}`;
            try {
                const stored = Number(localStorage.getItem(key));
                if (!Number.isFinite(stored) || score > stored) {
                    localStorage.setItem(key, String(score));
                    setBestScore(score);
                } else {
                    setBestScore(stored);
                }
            } catch (err) {
                setBestScore(null);
            }
        }
    }

    const queueSimAdvanceSeconds = (deltaSeconds, { burst } = {}) => {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
        simAdvanceQueueSecondsRef.current += deltaSeconds;
        if (burst) simBurstActiveRef.current = true;
    };

    const skipToNextDay = () => {
        const simClock = simClockRef.current;
        if (!simClock) return;
        const current = simClock.simTimeSeconds ?? 0;
        const nextDayStart = (Math.floor(current / 86400) + 1) * 86400;
        const delta = nextDayStart - current;
        if (!(delta > 0)) return;
        queueSimAdvanceSeconds(delta, { burst: true });
    };

    const handleEndTurnClick = () => {
        turnManagerRef.current?.endTurn();
        if (gameMode === 'solo') {
            skipToNextDay();
        }
    };

    const startNewRun = (randomizeSeed = false) => {
        if (randomizeSeed) {
            const nextSeed = Math.floor(Math.random() * 1_000_000);
            setWeatherSeed(String(nextSeed));
            setWeatherSeedInput(String(nextSeed));
            seedEditedRef.current = false;
        }
        setRunCounter(prev => prev + 1);
    };

    const handleWeatherSeedChange = (event) => {
        setWeatherSeedInput(event.target.value);
        seedEditedRef.current = true;
    };

    const applyWeatherSeed = () => {
        const seed = Number.parseInt(weatherSeedInput, 10);
        if (!Number.isFinite(seed)) return;
        seedEditedRef.current = false;
        setWeatherSeed(String(seed));
        earthRef.current?.setWeatherSeed(seed);
        updateWeatherDebugNow();
    };

    const speedToSliderValue = (speed) => {
        if (!Number.isFinite(speed) || speed <= 0) return 0;
        return Math.log10(speed);
    };

    const sliderValueToSpeed = (value) => {
        const v = Number.isFinite(value) ? value : 0;
        return Math.min(SIM_SPEED_MAX, Math.pow(10, v));
    };

    const handleSimSpeedChange = (_, value) => {
        const raw = Array.isArray(value) ? value[0] : value;
        const nextSpeed = Math.round(sliderValueToSpeed(raw));
        setSimSpeedUI(nextSpeed);
    };

    const handleWeatherLogCadenceChange = (event) => {
        const nextCadence = Number(event.target.value);
        if (!Number.isFinite(nextCadence)) return;
        setWeatherLogCadence(nextCadence);
        const simTime = simClockRef.current?.simTimeSeconds ?? 0;
        earthRef.current?.setWeatherLogCadence(nextCadence, simTime);
    };

    const toggleWeatherLogCapture = () => {
        const earth = earthRef.current;
        if (!earth) return;
        const simClock = simClockRef.current;
        const nextEnabled = !weatherLogEnabled;
        setWeatherLogEnabled(nextEnabled);
        if (nextEnabled) {
            earth.startWeatherLogCapture({
                cadenceSeconds: weatherLogCadence,
                simTimeSeconds: simClock.simTimeSeconds
            });
        } else {
            earth.stopWeatherLogCapture();
        }
        updateWeatherDebugNow();
    };

    const handleV2ConvectionToggle = (_, checked) => {
        setWeatherV2ConvectionEnabled(checked);
        earthRef.current?.setWeatherV2ConvectionEnabled?.(checked);
    };

    const clearWeatherLogCapture = () => {
        earthRef.current?.clearWeatherLogCapture();
        setWeatherLogCount(0);
    };

    const downloadWeatherLogCapture = () => {
        earthRef.current?.downloadWeatherLogCapture(`weather-log-${Date.now()}.jsonl`);
    };


    useEffect(() => { showSatPanelRef.current = showSatPanel; }, [showSatPanel]);
    useEffect(() => { altitudeRef.current = altitude; }, [altitude]);
    useEffect(() => { inclinationRef.current = inclination; }, [inclination]);
    useEffect(() => {
        if (!cloudWatchDebugEnabled) setCloudWatchDebugInfo([]);
    }, [cloudWatchDebugEnabled]);
    const SAT_TYPE_DEFAULTS = {
        communication: { altitude: '35785', speed: '28800' }, // GEO comms
        imaging: { altitude: '700', speed: '28800' }, // LEO imaging
        cloudWatch: { altitude: '35786', speed: '11074' }, // GEO cloud watch
        sar: { altitude: '700', speed: '28800' } // LEO SAR
    };

    useEffect(() => {
        const defaults = SAT_TYPE_DEFAULTS[satelliteType];
        if (!defaults) return;
        setAltitude(defaults.altitude);
        setSpeed(defaults.speed);
    }, [satelliteType]);
    useEffect(() => { showForecastOverlayRef.current = showForecastOverlay; }, [showForecastOverlay]);
    useEffect(() => { forecastProductRef.current = forecastProduct; }, [forecastProduct]);
    useEffect(() => { forecastLeadHoursRef.current = forecastLeadHours; }, [forecastLeadHours]);
    useEffect(() => { showCloudObsRef.current = showCloudObs; }, [showCloudObs]);
    useEffect(() => { sensorOnlyWeatherRef.current = sensorOnlyWeather; }, [sensorOnlyWeather]);
    useEffect(() => { warningDrawModeRef.current = warningDrawMode; }, [warningDrawMode]);
    useEffect(() => { warningDraftRef.current = warningDraft; }, [warningDraft]);
	    useEffect(() => { warningsByPlayerIdRef.current = warningsByPlayerId; }, [warningsByPlayerId]);
	    useEffect(() => { draftWarningsByPlayerIdRef.current = draftWarningsByPlayerId; }, [draftWarningsByPlayerId]);
	    useEffect(() => { autoWarningDiagnosticsByPlayerIdRef.current = autoWarningDiagnosticsByPlayerId; }, [autoWarningDiagnosticsByPlayerId]);
        useEffect(() => { tuningParamsRef.current = tuningParams; }, [tuningParams]);
	    useEffect(() => { activePostmortemRef.current = activePostmortem; }, [activePostmortem]);
    useEffect(() => { selectedUplinkHubIdRef.current = selectedUplinkHubId; }, [selectedUplinkHubId]);
    useEffect(() => { selectionMenuRef.current = selectionMenu; }, [selectionMenu]);
    useEffect(() => {
        showAlertsPanelRef.current = showAlertsPanel;
        if (showAlertsPanel) {
            setAlertsUnreadCount(0);
        }
    }, [showAlertsPanel]);
    useEffect(() => {
        setSkipDayHover(false);
    }, [gameMode]);
    useEffect(() => {
        showFogLayerRef.current = showFogLayer;
    }, [showFogLayer, sensorOnlyWeather]);
    useEffect(() => {
        showWeatherLayerRef.current = showWeatherLayer;
    }, [showWeatherLayer, sensorOnlyWeather]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setWeatherViewSource?.(weatherViewSource);
    }, [weatherViewSource, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setStationObsVisible?.(showStationObs);
    }, [showStationObs, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setWindStreamlinesVisible?.(showWindStreamlines);
    }, [showWindStreamlines, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setWindStreamlineSource?.(windStreamlineSource);
    }, [windStreamlineSource, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        if (showCloudObs) {
            earthRef.current.logCloudSatStats?.('toggleOn');
        }
    }, [showCloudObs, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setRadarOverlayVisible?.(showRadarObs);
    }, [showRadarObs, gameMode]);

    const handleLoadWindReference = async () => {
        const earth = earthRef.current;
        if (!earth || windRefStatus.loading) return;
        setWindRefStatus({ loading: true, loaded: false, error: null });
        try {
            const { grid, u, v, meta } = await loadNullschoolWind(
                '/reference/wind/gfs10m/current-wind-surface-level-gfs-1.0.json'
            );
            earth.setWindReferenceWindCore?.({
                ready: true,
                grid,
                fields: { u, v },
                meta
            });
            earth.setWindStreamlineSource?.('reference');
            earth.windStreamlineRenderer?.reset?.();
            setWindStreamlineSource('reference');
            setWindRefStatus({ loading: false, loaded: true, error: null });
            notify('info', 'Loaded reference wind fixture.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load reference wind fixture.';
            setWindRefStatus({ loading: false, loaded: false, error: message });
            notify('error', 'Failed to load reference wind fixture.');
        }
    };
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setForecastOverlayVisible?.(showForecastOverlay);
    }, [showForecastOverlay, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setForecastDisplayProduct?.(forecastProduct);
    }, [forecastProduct, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setForecastDisplayLeadHours?.(forecastLeadHours);
    }, [forecastLeadHours, gameMode]);
    useEffect(() => {
        const player = currentPlayerRef.current;
        const unlockedLeads = getUnlockedForecastLeads(player);
        if (unlockedLeads.length && !unlockedLeads.includes(forecastLeadHours)) {
            setForecastLeadHours(unlockedLeads[0]);
        }
        const unlockedHazards = getUnlockedWarningHazards(player);
        setWarningDraft((prev) => {
            let next = prev;
            if (unlockedHazards.length && !unlockedHazards.includes(prev.hazardType)) {
                next = { ...next, hazardType: unlockedHazards[0] };
            }
            const startHours = Number(prev.validStartHours);
            if (unlockedLeads.length && !unlockedLeads.includes(startHours)) {
                next = { ...next, validStartHours: unlockedLeads[0] };
            }
            return next;
        });
    }, [activePlayerId, forecastLeadHours, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setCloudObsProduct?.(cloudObsProduct);
    }, [cloudObsProduct, gameMode]);
    useEffect(() => {
        const currentPlayer = currentPlayerRef.current;
        const list = currentPlayer?.getSatellites?.() ?? [];
        if (selectedSatelliteId && !list.some(sat => sat.id === selectedSatelliteId)) {
            setSelectedSatelliteId(null);
        }
        list.forEach(sat => sat.setHighlighted?.(sat.id === selectedSatelliteId));
    }, [selectedSatelliteId, activePlayerId, satellites, gameMode]);
    useEffect(() => {
        const earth = earthRef.current;
        const playerId = activePlayerId;
        if (!earth || !playerId) return;
        const warnings = warningsByPlayerId[playerId] || [];
        const visibleWarnings = warnings.filter(w => !w.outcome);
        const drafts = draftWarningsByPlayerId[playerId] || [];
        earth.setPlayerWarnings?.(playerId, [...visibleWarnings, ...drafts]);
    }, [warningsByPlayerId, draftWarningsByPlayerId, activePlayerId, gameMode]);
    useEffect(() => {
        const canvas = postmortemCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const grid = earthRef.current?.weatherField?.core?.grid;
        if (!activePostmortem || !grid || !showPostmortemPanel) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        const N = grid.nx * grid.ny;
        let warningMask = activePostmortem.warningMask;
        if (warningMask && warningMask.length !== N) warningMask = null;
        let eventMask = activePostmortem.eventMask;
        if (!eventMask && activePostmortem.eventIndices) {
            eventMask = makeMaskFromIndices(activePostmortem.eventIndices, N);
        }
        if (eventMask && eventMask.length !== N) eventMask = null;
        drawPostmortemMiniMap(canvas, grid, warningMask, eventMask);
    }, [activePostmortem, showPostmortemPanel, postmortemQueueVersion]);
    useEffect(() => {
        if (earthRef.current) {
            const seedNum = Number.parseInt(weatherSeed, 10);
            if (Number.isFinite(seedNum)) earthRef.current.setWeatherSeed(seedNum);
        }
    }, [weatherSeed]);
    useEffect(() => {
        weatherDebugModeRef.current = weatherDebugMode;
        if (earthRef.current) earthRef.current.setWeatherDebugMode(weatherDebugMode);
        updateWeatherDebugNow();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weatherDebugMode]);
    useEffect(() => {
        simClockRef.current.setPaused(simPausedUI);
    }, [simPausedUI]);
    useEffect(() => {
        simClockRef.current.setSpeed(Math.min(SIM_SPEED_MAX, Math.max(0, simSpeedUI)));
    }, [simSpeedUI]);
    useEffect(() => {
        if (!gameMode) return;
        const interval = setInterval(() => {
            updateWeatherDebugNow();
        }, 500);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameMode]);

    // When the Sat panel opens, default inclination to 90° (polar) and show preview.
    useEffect(() => {
        if (showSatPanel) {
            setInclination('90');
        } else {
            removeOrbitPreview();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSatPanel]);

    // Keep orbit preview synced with panel tweaks while open
    useEffect(() => {
        if (showSatPanel) updateOrbitPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSatPanel, altitude, speed, angle, inclination]);

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
            const speedInRadiansPerSecond = orbitalSpeedMPerS / orbitRadiusMeters;

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

    const vectorToLatLonRad = (vec) => {
        if (!vec) return null;
        const r = vec.length();
        if (!(r > 0)) return null;
        return {
            latRad: Math.asin(vec.y / r),
            lonRad: Math.atan2(vec.x, vec.z)
        };
    };

    const isCanvasEvent = (event) => {
        const canvas = rendererRef.current?.domElement;
        return !!canvas && event?.target === canvas;
    };

    const setSelectionControlsEnabled = (enabled) => {
        const controls = controlsRef.current;
        if (!controls) return;
        if (enabled) {
            const prev = selectionControlsStateRef.current;
            if (prev) {
                controls.enabled = prev.enabled;
                controls.enableRotate = prev.enableRotate;
                controls.enablePan = prev.enablePan;
                controls.enableZoom = prev.enableZoom;
            } else {
                controls.enabled = true;
                controls.enableRotate = true;
                controls.enablePan = true;
                controls.enableZoom = true;
            }
            selectionControlsStateRef.current = null;
        } else {
            selectionControlsStateRef.current = {
                enabled: controls.enabled,
                enableRotate: controls.enableRotate,
                enablePan: controls.enablePan,
                enableZoom: controls.enableZoom
            };
            controls.enabled = false;
            controls.enableRotate = false;
            controls.enablePan = false;
            controls.enableZoom = false;
        }
    };

    const clearSelectionOutline = () => {
        const earth = earthRef.current;
        const outline = selectionOutlineRef.current;
        if (outline && earth?.parentObject) {
            earth.parentObject.remove(outline);
            outline.geometry?.dispose?.();
            outline.material?.dispose?.();
        }
        selectionOutlineRef.current = null;
    };

    const clearSelection = () => {
        clearSelectionOutline();
        selectionActiveRef.current = false;
        selectionAnchorRef.current = null;
        selectionRectRef.current = null;
        selectionDataRef.current = null;
        setSelectionDragRect(null);
        setSelectionMenu(null);
        selectionMenuRef.current = null;
        setSelectionControlsEnabled(true);
        const dom = rendererRef.current?.domElement;
        if (dom) dom.style.cursor = '';
        if (selectionPendingClickRef.current?.timerId) {
            clearTimeout(selectionPendingClickRef.current.timerId);
        }
        selectionPendingClickRef.current = null;
    };

    const screenToEarthLocal = (clientX, clientY) => {
        const earth = earthRef.current;
        const camera = cameraRef.current;
        if (!earth?.mesh || !camera) return null;
        const mouse = new THREE.Vector2(
            (clientX / window.innerWidth) * 2 - 1,
            -(clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = selectionRaycasterRef.current;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(earth.mesh, false);
        if (!intersects.length) return null;
        const point = intersects[0].point.clone();
        earth.parentObject.worldToLocal(point);
        return point;
    };

    const buildSelectionOutlineFromRect = (rect) => {
        if (!rect) return null;
        const earth = earthRef.current;
        if (!earth?.parentObject) return null;
        const radius = earth.earthRadiusKm + 6;
        const points = [];
        const left = rect.left;
        const top = rect.top;
        const right = rect.left + rect.width;
        const bottom = rect.top + rect.height;
        const samples = Math.max(6, SELECTION_EDGE_SAMPLES);
        const sampleEdge = (x0, y0, x1, y1, includeEnd) => {
            const steps = includeEnd ? samples : samples - 1;
            for (let s = 0; s <= steps; s++) {
                const t = steps === 0 ? 0 : s / steps;
                const x = x0 + (x1 - x0) * t;
                const y = y0 + (y1 - y0) * t;
                const local = screenToEarthLocal(x, y);
                if (!local) continue;
                const p = local.clone().normalize().multiplyScalar(radius);
                points.push(p);
            }
        };
        sampleEdge(left, top, right, top, false);
        sampleEdge(right, top, right, bottom, false);
        sampleEdge(right, bottom, left, bottom, false);
        sampleEdge(left, bottom, left, top, true);
        if (points.length < 3) return null;
        return points;
    };

    const computeSelectionStats = (outlineLocalPoints) => {
        const earth = earthRef.current;
        if (!earth || !outlineLocalPoints || outlineLocalPoints.length < 3) return null;
        const center = new THREE.Vector3();
        outlineLocalPoints.forEach((p) => center.add(p.clone().normalize()));
        if (center.lengthSq() < 1e-6) return null;
        center.normalize();
        const latLon = vectorToLatLonRad(center);
        if (!latLon) return null;
        const earthRadiusKm = earth.earthRadiusKm;
        let maxAng = 0;
        outlineLocalPoints.forEach((p) => {
            const dot = THREE.MathUtils.clamp(center.dot(p.clone().normalize()), -1, 1);
            const ang = Math.acos(dot);
            if (ang > maxAng) maxAng = ang;
        });
        return {
            centroidLatLonDeg: {
                latDeg: THREE.MathUtils.radToDeg(latLon.latRad),
                lonDeg: THREE.MathUtils.radToDeg(latLon.lonRad)
            },
            boundingRadiusKm: maxAng * earthRadiusKm
        };
    };

    const getEarthRotationForTime = (simTimeSeconds) => {
        const daySeconds = 86400;
        const dayFrac = (((simTimeSeconds / daySeconds) % 1) + 1) % 1;
        return 2 * Math.PI * (dayFrac - 0.5);
    };

    const predictSatelliteSubpoint = (sat, baseSimTimeSeconds, targetSimTimeSeconds) => {
        const earth = earthRef.current;
        if (!sat?.orbit || !earth) return null;
        const dt = targetSimTimeSeconds - baseSimTimeSeconds;
        const { radius, speed, inclination, raan = 0, angle = 0 } = sat.orbit;
        if (!Number.isFinite(radius) || !Number.isFinite(speed)) return null;
        const nu = angle + speed * dt;
        const pos = new THREE.Vector3(
            radius * Math.cos(nu),
            0,
            radius * Math.sin(nu)
        );
        pos.applyMatrix4(new THREE.Matrix4().makeRotationX(inclination));
        pos.applyMatrix4(new THREE.Matrix4().makeRotationY(raan));
        const rotY = getEarthRotationForTime(targetSimTimeSeconds);
        pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotY);
        pos.normalize().multiplyScalar(earth.earthRadiusKm);
        return vectorToLatLonRad(pos);
    };

    const computeSelectionEligibility = (selection, simTimeSeconds) => {
        const playerId = currentPlayerRef.current?.id;
        if (!selection || !playerId) {
            return {
                image: { enabled: false, nextAccessSeconds: null, candidateIds: [] },
                sar: { enabled: false, nextAccessSeconds: null, candidateIds: [] }
            };
        }
        const centroid = selection.centroidLatLonDeg;
        if (!centroid) {
            return {
                image: { enabled: false, nextAccessSeconds: null, candidateIds: [] },
                sar: { enabled: false, nextAccessSeconds: null, candidateIds: [] }
            };
        }
        const centroidLatRad = THREE.MathUtils.degToRad(centroid.latDeg);
        const centroidLonRad = THREE.MathUtils.degToRad(centroid.lonDeg);
        const earthRadiusKm = earthRef.current?.earthRadiusKm ?? 6371;
        const selectionRadiusKm = selection.boundingRadiusKm ?? 0;
        const candidates = satellitesRef.current.filter(
            (sat) => sat.ownerId === playerId && sat.inHqRange === true
        );
        const evalSat = (sat, footprintRadiusKm) => {
            let earliest = null;
            for (let t = 0; t <= COLLECT_LOOKAHEAD_SECONDS; t += COLLECT_STEP_SECONDS) {
                const latLon = predictSatelliteSubpoint(sat, simTimeSeconds, simTimeSeconds + t);
                if (!latLon) continue;
                const dLat = latLon.latRad - centroidLatRad;
                const dLon = wrapRadToPi(latLon.lonRad - centroidLonRad);
                const sinDLat = Math.sin(dLat * 0.5);
                const sinDLon = Math.sin(dLon * 0.5);
                const a = sinDLat * sinDLat + Math.cos(latLon.latRad) * Math.cos(centroidLatRad) * sinDLon * sinDLon;
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distKm = earthRadiusKm * c;
                if (distKm <= footprintRadiusKm + selectionRadiusKm) {
                    earliest = t;
                    break;
                }
            }
            return earliest;
        };

        const imageCandidates = candidates.filter((sat) => sat.type === 'imaging');
        const sarCandidates = candidates.filter((sat) => sat.type === 'sar');
        const imageResult = { enabled: false, nextAccessSeconds: null, candidateIds: [] };
        const sarResult = { enabled: false, nextAccessSeconds: null, candidateIds: [] };

        imageCandidates.forEach((sat) => {
            const footprint = Number.isFinite(sat.revealRadius) ? sat.revealRadius : 0;
            if (!(footprint > 0)) return;
            const earliest = evalSat(sat, footprint);
            if (earliest == null) return;
            imageResult.candidateIds.push(sat.id);
            if (imageResult.nextAccessSeconds == null || earliest < imageResult.nextAccessSeconds) {
                imageResult.nextAccessSeconds = earliest;
            }
            imageResult.enabled = true;
        });

        sarCandidates.forEach((sat) => {
            const footprint = Number.isFinite(sat.sarFootprintRadiusKm)
                ? sat.sarFootprintRadiusKm
                : (Number.isFinite(sat.revealRadius) ? sat.revealRadius : 0);
            if (!(footprint > 0)) return;
            const earliest = evalSat(sat, footprint);
            if (earliest == null) return;
            sarResult.candidateIds.push(sat.id);
            if (sarResult.nextAccessSeconds == null || earliest < sarResult.nextAccessSeconds) {
                sarResult.nextAccessSeconds = earliest;
            }
            sarResult.enabled = true;
        });

        return { image: imageResult, sar: sarResult };
    };

    const getEarthClickLatLonDeg = (event) => {
        const earth = earthRef.current;
        if (!earth?.mesh || !cameraRef.current) return null;
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObject(earth.mesh);
        if (intersects.length === 0) return null;
        const localPoint = intersects[0].point.clone();
        earth.parentObject.worldToLocal(localPoint);
        const latLon = vectorToLatLonRad(localPoint);
        if (!latLon) return null;
        return {
            latDeg: THREE.MathUtils.radToDeg(latLon.latRad),
            lonDeg: THREE.MathUtils.radToDeg(latLon.lonRad)
        };
    };

    const updateCursorLatLon = (latLon) => {
        if (!latLon) {
            if (cursorLatLonRef.current) {
                cursorLatLonRef.current = null;
                setCursorLatLon(null);
            }
            return;
        }
        const prev = cursorLatLonRef.current;
        const next = { latDeg: latLon.latDeg, lonDeg: latLon.lonDeg };
        if (
            prev
            && Math.abs(prev.latDeg - next.latDeg) < 0.1
            && Math.abs(prev.lonDeg - next.lonDeg) < 0.1
        ) {
            return;
        }
        cursorLatLonRef.current = next;
        setCursorLatLon(next);
    };

    const createAnchorMesh = () => {
        const size = 80;
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });
        const geomX = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-size, 0, 0),
            new THREE.Vector3(size, 0, 0)
        ]);
        const geomY = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -size, 0),
            new THREE.Vector3(0, size, 0)
        ]);
        const lineX = new THREE.Line(geomX, material);
        const lineY = new THREE.Line(geomY, material);
        const group = new THREE.Group();
        group.add(lineX);
        group.add(lineY);
        group.renderOrder = 8;
        return group;
    };

    const clearAnchor = () => {
        const earth = earthRef.current;
        if (anchorMeshRef.current && earth?.parentObject) {
            earth.parentObject.remove(anchorMeshRef.current);
            anchorMeshRef.current.traverse((child) => {
                if (child.geometry?.dispose) child.geometry.dispose();
                if (child.material?.dispose) child.material.dispose();
            });
        }
        anchorMeshRef.current = null;
        anchorLatLonRef.current = null;
        anchorLockRef.current = null;
        setAnchorLatLon(null);
        if (controlsRef.current) {
            controlsRef.current.enableRotate = true;
            controlsRef.current.enablePan = true;
            const center = new THREE.Vector3();
            earth?.parentObject?.getWorldPosition?.(center);
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
        }
    };

    const setAnchorAtLatLon = (latDeg, lonDeg) => {
        const earth = earthRef.current;
        if (!earth?.parentObject || !earth?._latLonToVector3) return;
        const radius = earth.earthRadiusKm + 18;
        const localPos = earth._latLonToVector3(latDeg, lonDeg, radius);
        let anchor = anchorMeshRef.current;
        if (!anchor) {
            anchor = createAnchorMesh();
            anchorMeshRef.current = anchor;
            earth.parentObject.add(anchor);
        }
        const normal = localPos.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        anchor.position.copy(localPos);
        anchor.quaternion.copy(quat);
        const localDir = earth._latLonToVector3(latDeg, lonDeg, 1).normalize();
        const camera = cameraRef.current;
        const distance = camera ? Math.max(earth.earthRadiusKm + 300, camera.position.length()) : earth.earthRadiusKm + 3000;
        anchorLockRef.current = { localDir, distance, isDragging: false };
        if (controlsRef.current) {
            controlsRef.current.enableRotate = true;
            controlsRef.current.enablePan = true;
        }
        anchorLatLonRef.current = { latDeg, lonDeg };
        setAnchorLatLon({ latDeg, lonDeg });
    };

    const getForecastTier = (player) => {
        const tier = Number(player?.forecastTechTier);
        if (!Number.isFinite(tier)) return 0;
        return Math.max(0, Math.min(4, Math.floor(tier)));
    };

    const getTierSpec = (tier) => {
        const t = Number(tier);
        if (!Number.isFinite(t)) return FORECAST_TECH_TIERS[0];
        return FORECAST_TECH_TIERS.find(spec => spec.tier === t) || FORECAST_TECH_TIERS[0];
    };

    const applyTierToPlayer = (player) => {
        if (!player) return;
        const tier = getForecastTier(player);
        const spec = getTierSpec(tier);
        player.unlockedForecastLeadsHours = Array.isArray(spec?.unlockedLeads)
            ? spec.unlockedLeads.slice()
            : [1, 3, 6];
    };

    const segmentOccludedBySphere = (start, end, sphereRadius, epsilon = 1e-3) => {
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
    };

    const equirectDistanceKm = (lat0Rad, lon0Rad, lat1Rad, lon1Rad) => {
        const dLat = lat1Rad - lat0Rad;
        const dLon = wrapRadToPi(lon1Rad - lon0Rad);
        const x = dLon * Math.cos((lat0Rad + lat1Rad) * 0.5);
        const y = dLat;
        return (RE_M / 1000) * Math.sqrt(x * x + y * y);
    };

		const buildSensorGating = (simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0) => {
	        const earth = earthRef.current;
	        const player = currentPlayerRef.current;
	        if (!player || !earth) return null;
	        const playerId = player.id;
        const hqSites = hqSpheresRef.current
            .filter(hq => hq.ownerID === playerId && hq.hp > 0)
            .map(hq => {
                const pos = hq.position?.clone?.() ?? hq.sphere?.position?.clone?.();
                const latLon = vectorToLatLonRad(pos);
                return latLon ? { latRad: latLon.latRad, lonRad: latLon.lonRad } : null;
            })
            .filter(Boolean);
        const radarSites = [];

        const hasComms = satellitesRef.current.some(
            s => s.ownerId === playerId && s.type === 'communication' && s.inHqRange === true
        );
        const forecastTechTier = getForecastTier(player);
        const enabledWeatherSensors = {
            amv: forecastTechTier >= 1,
            soundings: forecastTechTier >= 2,
            radarNowcast: forecastTechTier >= 3,
            denseSurface: forecastTechTier >= 4
        };

        const uplinkHubSites = [];
        const surfaceSites = [];
        const radiosondeSites = [];
        const hubs = uplinkHubsByPlayerIdRef.current[playerId] || [];
        const earthRadiusKm = earth.earthRadiusKm;
        const tmpHubWorld = new THREE.Vector3();
        const tmpHubSurface = new THREE.Vector3();
        const tmpSatWorld = new THREE.Vector3();
        hubs.forEach((hub) => {
            if (!hub) return;
            const latRad = THREE.MathUtils.degToRad(hub.latDeg);
            const lonRad = THREE.MathUtils.degToRad(hub.lonDeg);
            const latDeg = hub.latDeg;
            const lonDeg = hub.lonDeg;
            if (hub.isHqHub) {
                hub.setOnline(true, 'HQ hub');
                uplinkHubSites.push({ latRad, lonRad });
                if (hub.modules?.surface) {
                    surfaceSites.push({
                        id: hub.id,
                        latDeg,
                        lonDeg,
                        denseSurface: hub.modules?.denseSurface === true && enabledWeatherSensors?.denseSurface === true
                    });
                }
                if (hub.modules?.radiosonde) {
                    radiosondeSites.push({ id: hub.id, latDeg, lonDeg });
                }
                if (hub.modules?.radar) {
                    radarSites.push({
                        latRad,
                        lonRad,
                        latDeg,
                        lonDeg,
                        radiusKm: RADAR_RADIUS_KM
                    });
                }
                return;
            }
            let online = false;
            let reason = '';
            for (let h = 0; h < hqSites.length; h++) {
                const hq = hqSites[h];
                const distKm = equirectDistanceKm(latRad, lonRad, hq.latRad, hq.lonRad);
                if (distKm <= LOCAL_BACKHAUL_RADIUS_KM) {
                    online = true;
                    reason = 'Terrestrial backhaul to HQ';
                    break;
                }
            }
            if (!online) {
                const hubWorld = hub.mesh?.getWorldPosition
                    ? hub.mesh.getWorldPosition(tmpHubWorld)
                    : null;
                if (hubWorld) {
                    tmpHubSurface.copy(hubWorld).normalize().multiplyScalar(earthRadiusKm);
                    for (let s = 0; s < satellitesRef.current.length; s++) {
                        const sat = satellitesRef.current[s];
                        if (!sat || sat.ownerId !== playerId) continue;
                        if (sat.type !== 'communication') continue;
                        if (sat.inHqRange !== true) continue;
                        if (!sat.mesh) continue;
                        if (sat.mesh.getWorldPosition) {
                            sat.mesh.getWorldPosition(tmpSatWorld);
                        } else {
                            tmpSatWorld.copy(sat.mesh.position);
                        }
                        const maxRange = sat.getHqRangeKm?.() ?? 0;
                        if (maxRange <= 0) continue;
                        if (tmpHubSurface.distanceTo(tmpSatWorld) > maxRange) continue;
                        const clear = !segmentOccludedBySphere(
                            tmpHubSurface,
                            tmpSatWorld,
                            earthRadiusKm,
                            GROUND_LOS_EPS
                        );
                        if (clear) {
                            online = true;
                            reason = 'Satellite backhaul';
                            break;
                        }
                    }
                }
            }
            if (!online) {
                reason = 'Offline: no backhaul (need comm sat visibility or be within 800 km of HQ)';
            }
            hub.setOnline(online, reason);
            if (online) {
                uplinkHubSites.push({ latRad, lonRad });
                if (hub.modules?.surface) {
                    surfaceSites.push({
                        id: hub.id,
                        latDeg,
                        lonDeg,
                        denseSurface: hub.modules?.denseSurface === true && enabledWeatherSensors?.denseSurface === true
                    });
                }
                if (hub.modules?.radiosonde) {
                    radiosondeSites.push({ id: hub.id, latDeg, lonDeg });
                }
                if (hub.modules?.radar) {
                    radarSites.push({
                        latRad,
                        lonRad,
                        latDeg,
                        lonDeg,
                        radiusKm: RADAR_RADIUS_KM
                    });
                }
            }
        });

			const imagingFootprints = [];
			const debugEntries = cloudWatchDebugRef.current ? [] : null;
			const tmpWorldPos = new THREE.Vector3();
			const tmpSubWorld = new THREE.Vector3();
			satellitesRef.current.forEach(sat => {
				if (sat.ownerId !== playerId) return;
				if (sat.type !== 'cloudWatch' || sat.inHqRange !== true) return;
				if (!sat.mesh?.getWorldPosition) return;
				sat.mesh.getWorldPosition(tmpWorldPos);
				const latLon = earth.worldToEarthFixedLatLonRad?.(tmpWorldPos, simTimeSeconds);
				if (!latLon) return;
				const lonRadWorld = wrapRadToPi(latLon.lonRad);
				const lonRadGrid = wrapRadToPi(lonRadWorld + CLOUD_WATCH_GRID_LON_OFFSET_RAD);
				const radiusKm = sat.cloudFootprintRadiusKm ?? 0;
				if (!(radiusKm > 0)) return;
				imagingFootprints.push({
				latRad: latLon.latRad,
                lonRad: lonRadGrid,
                radiusKm
            });
				if (debugEntries) {
					tmpSubWorld.copy(tmpWorldPos).normalize().multiplyScalar(earth.earthRadiusKm);
					const subLatLon = earth.worldToEarthFixedLatLonRad?.(tmpSubWorld, simTimeSeconds);
					const subLonRad = subLatLon ? wrapRadToPi(subLatLon.lonRad) : null;
					const toUnit = (latRad, lonRad) => {
						const cosLat = Math.cos(latRad);
						return new THREE.Vector3(
							cosLat * Math.sin(lonRad),
							Math.sin(latRad),
							cosLat * Math.cos(lonRad)
						);
					};
					let separationDeg = null;
					if (subLatLon) {
						const a = toUnit(latLon.latRad, lonRadWorld);
						const b = toUnit(subLatLon.latRad, subLonRad);
						const dot = Math.max(-1, Math.min(1, a.dot(b)));
						separationDeg = THREE.MathUtils.radToDeg(Math.acos(dot));
					}
					debugEntries.push({
						satId: sat.id,
						footprintLatRad: latLon.latRad,
						footprintLonRad: lonRadWorld,
						footprintLonRadGrid: lonRadGrid,
						subpointLatRad: subLatLon?.latRad ?? null,
						subpointLonRad: subLonRad,
						radiusKm,
						separationDeg
					});
				}
        });

        return {
            playerId,
            hasComms,
            hqSites,
            uplinkHubSites,
            surfaceSites,
            radiosondeSites,
            imagingFootprints,
            radarSites,
            radarCadenceSeconds: RADAR_CADENCE_SECONDS,
			cloudWatchDebugEntries: debugEntries,
            forecastTechTier,
            enabledWeatherSensors
        };
    };

    const applyCloudIntelVisibility = (sensorGating) => {
        const earth = earthRef.current;
        if (!earth) return;
        const hasCloudWatch = (sensorGating?.imagingFootprints?.length ?? 0) > 0;
        const showCloudIntel = showCloudObsRef.current && hasCloudWatch;
        if (sensorOnlyWeatherRef.current) {
            earth.setWeatherVisible(false);
            earth.setFogVisible(false);
        } else {
            earth.setWeatherVisible(false);
            earth.setFogVisible(showFogLayerRef.current);
        }
        earth.setCloudObsVisible(showCloudIntel);
    };

    const normalizeLonDeg = (lonDeg) => {
        let v = lonDeg;
        if (v >= 180) v -= 360;
        if (v < -180) v += 360;
        return v;
    };

    const wrapLonDeltaDeg = (lonDeg, refLonDeg) => {
        let d = lonDeg - refLonDeg;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        return d;
    };

    const getPlayerHasComms = (playerId) => {
        if (!playerId) return false;
        return satellitesRef.current.some(
            sat => sat.ownerId === playerId && sat.type === 'communication' && sat.inHqRange === true
        );
    };

    const getUplinkHubInventory = (earth, playerId) => {
        if (!earth || !playerId) {
            return {
                totalHubs: 0,
                onlineHubs: 0,
                modules: { metarTotal: 0, radiosondeTotal: 0, radarTotal: 0 }
            };
        }
        const hubsMap = earth.uplinkHubsByPlayerId;
        if (!hubsMap || typeof hubsMap.get !== 'function') {
            return {
                totalHubs: 0,
                onlineHubs: 0,
                modules: { metarTotal: 0, radiosondeTotal: 0, radarTotal: 0 }
            };
        }
        const hubs = hubsMap.get(String(playerId)) || [];
        const totalHubs = hubs.length;
        let onlineHubs = 0;
        let metarTotal = 0;
        let radiosondeTotal = 0;
        let radarTotal = 0;
        for (let i = 0; i < hubs.length; i++) {
            const hub = hubs[i];
            if (hub?.isOnline) onlineHubs += 1;
            if (hub?.modules?.metar || hub?.modules?.surface) metarTotal += 1;
            if (hub?.modules?.radiosonde) radiosondeTotal += 1;
            if (hub?.modules?.radar) radarTotal += 1;
        }
        return {
            totalHubs,
            onlineHubs,
            modules: { metarTotal, radiosondeTotal, radarTotal }
        };
    };

    const syncUplinkHubsToEarth = () => {
        const earth = earthRef.current;
        if (!earth) return;
        if (!(earth.uplinkHubsByPlayerId instanceof Map)) {
            earth.uplinkHubsByPlayerId = new Map();
        }
        earth.uplinkHubsByPlayerId.clear();
        Object.keys(uplinkHubsByPlayerIdRef.current).forEach((playerId) => {
            const hubs = uplinkHubsByPlayerIdRef.current[playerId] || [];
            earth.uplinkHubsByPlayerId.set(String(playerId), hubs);
        });
    };

    const getSelectedHubForPlayer = (playerId, hubId) => {
        if (!playerId || !hubId) return null;
        const hubs = uplinkHubsByPlayerIdRef.current[playerId] || [];
        return hubs.find(hub => hub?.id === hubId) || null;
    };

    const getPlayerHasOnlineRadiosondeSite = (playerId) => {
        if (!playerId) return false;
        const hubs = uplinkHubsByPlayerIdRef.current[playerId] || [];
        return hubs.some(hub => (
            hub?.modules?.radiosonde === true
            && (hub?.isHqHub === true || hub?.isOnline === true)
        ));
    };

    const canUse24hLead = (player) => {
        if (!player) return false;
        if (getForecastTier(player) < 4) return false;
        if (!getPlayerHasComms(player.id)) return false;
        const hubs = uplinkHubsByPlayerIdRef.current[player.id] || [];
        let onlineSurface = 0;
        let onlineRadiosonde = 0;
        hubs.forEach((hub) => {
            if (!hub?.isOnline) return;
            if (hub.modules?.surface) onlineSurface += 1;
            if (hub.modules?.radiosonde) onlineRadiosonde += 1;
        });
        if (onlineSurface < 3 || onlineRadiosonde < 2) return false;
        const inLinkCloudWatch = satellitesRef.current.filter(
            sat => sat.ownerId === player.id && sat.type === 'cloudWatch' && sat.inHqRange === true
        );
        if (inLinkCloudWatch.length >= 3) return true;
        const hasGeoLike = inLinkCloudWatch.some(
            sat => (sat.cloudFootprintRadiusKm ?? 0) >= 7000
        );
        return hasGeoLike;
    };

    const ensureHqRadiosondeModuleInstalled = (playerId) => {
        if (!playerId) return false;
        const hubs = uplinkHubsByPlayerIdRef.current[playerId] || [];
        const hqHub = hubs.find(hub => hub?.isHqHub === true);
        if (!hqHub || hqHub.modules?.radiosonde === true) return false;
        hqHub.modules = { ...hqHub.modules, radiosonde: true };
        setUplinkHubsVersion(v => v + 1);
        syncUplinkHubsToEarth();
        return true;
    };

    const getUnlockedForecastLeads = (player) => {
        const leads = player?.unlockedForecastLeadsHours;
        const base = Array.isArray(leads) && leads.length ? leads.slice() : DEFAULT_FORECAST_LEADS.slice();
        const hasComms = getPlayerHasComms(player?.id);
        const hasRadiosondeOnline = getPlayerHasOnlineRadiosondeSite(player?.id);
        let filtered = hasComms
            ? base
            : base.filter((h) => h !== 12 && h !== 24);
        if (!hasRadiosondeOnline) {
            filtered = filtered.filter((h) => h !== 12);
        }
        if (filtered.includes(24) && !canUse24hLead(player)) {
            filtered = filtered.filter((h) => h !== 24);
        }
        return filtered.sort((a, b) => a - b);
    };

    const getUnlockedWarningHazards = (player) => {
        const hazards = player?.unlockedWarningHazards;
        return Array.isArray(hazards) && hazards.length ? hazards.slice() : ['heavyPrecip', 'highWinds'];
    };

    const buildHazardHitMask = ({ hazardType, forecastResult, leadIdx, grid, config, serviceMask, mode }) => {
        if (!forecastResult || !grid || leadIdx < 0) return null;
        const hazardCfg = config.hazards[hazardType];
        if (!hazardCfg) return null;
        const { nx, ny } = grid;
        const N = nx * ny;
        if (!N) return null;
        if (!serviceMask || serviceMask.length !== N) return null;

        const precip = forecastResult.products.precipRateByLead?.[leadIdx];
        const wind = forecastResult.products.windSpeedByLead?.[leadIdx];
        const cloud = forecastResult.products.cloudTauByLead?.[leadIdx];
        const conf = forecastResult.products.confidenceByLead?.[leadIdx];

        let serviceCellCount = 0;
        let maxValueService = -Infinity;
        for (let k = 0; k < N; k++) {
            if (serviceMask[k] !== 1) continue;
            serviceCellCount += 1;
            const p = precip ? precip[k] : 0;
            const w = wind ? wind[k] : 0;
            const c = cloud ? cloud[k] : 0;
            let hazardVal = 0;
            if (hazardCfg.kind === 'precipRate') {
                hazardVal = p;
            } else if (hazardCfg.kind === 'windSpeed') {
                hazardVal = w;
            } else if (hazardCfg.kind === 'stormRisk') {
                hazardVal = (w / 50) * (p / 2) + (c / 20);
            }
            if (hazardVal > maxValueService) maxValueService = hazardVal;
        }

	        const tuningThr = tuningParamsRef.current?.thresholdsByHazard?.[hazardType];
	        const baseThr = Number.isFinite(tuningThr) ? tuningThr : hazardCfg.threshold;
	        let thresholdUsed = baseThr;
	        if (mode === 'draft' && hazardType === 'heavyPrecip') {
	            const maxP = Number.isFinite(maxValueService) ? maxValueService : null;
	            if (Number.isFinite(maxP) && maxP < baseThr) {
                thresholdUsed = Math.max(0.08, 0.6 * maxP);
            }
        }

        const mask = new Uint8Array(N);
        const values = new Float32Array(N);
        let hitCount = 0;
        let maxVal = -Infinity;
        let maxK = -1;

        for (let k = 0; k < N; k++) {
            if (serviceMask[k] !== 1) continue;
            const p = precip ? precip[k] : 0;
            const w = wind ? wind[k] : 0;
            const c = cloud ? cloud[k] : 0;
            const confVal = conf ? conf[k] : 0;
            const stormy = (p >= 0.1) || (c >= 4);

            let hazardVal = 0;
            if (hazardCfg.kind === 'precipRate') {
                hazardVal = p;
            } else if (hazardCfg.kind === 'windSpeed') {
                hazardVal = w;
            } else if (hazardCfg.kind === 'stormRisk') {
                hazardVal = (w / 50) * (p / 2) + (c / 20);
            }

            values[k] = hazardVal;

            let hit = hazardVal >= thresholdUsed;
            if (hazardCfg.requireStormy || hazardCfg.kind === 'stormRisk') {
                hit = hit && stormy;
            }
            if (conf && confVal < config.confidenceMin) {
                hit = false;
            }

            if (hit) {
                mask[k] = 1;
                hitCount += 1;
                if (hazardVal > maxVal) {
                    maxVal = hazardVal;
                    maxK = k;
                }
            }
        }

        return {
            mask,
            values,
            hitCount,
            serviceCellCount,
            hitFracService: serviceCellCount ? hitCount / serviceCellCount : 0,
            thresholdUsed,
            stormyGateUsed: Boolean(hazardCfg.requireStormy || hazardCfg.kind === 'stormRisk'),
            maxVal: Number.isFinite(maxVal) ? maxVal : null,
            maxK,
            maxValueService: Number.isFinite(maxValueService) ? maxValueService : null
        };
    };

    const labelConnectedComponents = (mask, nx, ny, values = null) => {
        const N = nx * ny;
        const labels = new Int32Array(N);
        const components = [];
        const queue = new Int32Array(N);
        let nextId = 0;

        for (let k = 0; k < N; k++) {
            if (!mask[k] || labels[k] !== 0) continue;
            nextId += 1;
            let head = 0;
            let tail = 0;
            queue[tail++] = k;
            labels[k] = nextId;

            let cellCount = 0;
            let maxVal = -Infinity;
            let maxK = -1;
            let minI = nx;
            let maxI = -1;
            let minJ = ny;
            let maxJ = -1;

            while (head < tail) {
                const idx = queue[head++];
                cellCount += 1;
                const j = Math.floor(idx / nx);
                const i = idx - j * nx;
                if (i < minI) minI = i;
                if (i > maxI) maxI = i;
                if (j < minJ) minJ = j;
                if (j > maxJ) maxJ = j;

                const v = values ? values[idx] : 1;
                if (v > maxVal) {
                    maxVal = v;
                    maxK = idx;
                }

                if (i > 0) {
                    const n = idx - 1;
                    if (mask[n] && labels[n] === 0) {
                        labels[n] = nextId;
                        queue[tail++] = n;
                    }
                }
                if (i < nx - 1) {
                    const n = idx + 1;
                    if (mask[n] && labels[n] === 0) {
                        labels[n] = nextId;
                        queue[tail++] = n;
                    }
                }
                if (j > 0) {
                    const n = idx - nx;
                    if (mask[n] && labels[n] === 0) {
                        labels[n] = nextId;
                        queue[tail++] = n;
                    }
                }
                if (j < ny - 1) {
                    const n = idx + nx;
                    if (mask[n] && labels[n] === 0) {
                        labels[n] = nextId;
                        queue[tail++] = n;
                    }
                }
            }

            components.push({
                id: nextId,
                cellCount,
                maxVal: Number.isFinite(maxVal) ? maxVal : null,
                maxK,
                bbox: { minI, maxI, minJ, maxJ }
            });
        }

        return { labels, components };
    };

    const traceBoundaryPolygonsFromLabels = (labels, nx, ny, componentId, grid) => {
        if (!labels || !nx || !ny) return null;
        const cornerStride = nx + 1;
        const edges = [];
        const addEdge = (i0, j0, i1, j1) => {
            edges.push({
                start: j0 * cornerStride + i0,
                end: j1 * cornerStride + i1
            });
        };

        for (let j = 0; j < ny; j++) {
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (labels[k] !== componentId) continue;

                if (j === 0 || labels[(j - 1) * nx + i] !== componentId) {
                    addEdge(i + 1, j, i, j);
                }
                if (j === ny - 1 || labels[(j + 1) * nx + i] !== componentId) {
                    addEdge(i, j + 1, i + 1, j + 1);
                }
                if (i === 0 || labels[row + i - 1] !== componentId) {
                    addEdge(i, j, i, j + 1);
                }
                if (i === nx - 1 || labels[row + i + 1] !== componentId) {
                    addEdge(i + 1, j + 1, i + 1, j);
                }
            }
        }

        if (edges.length === 0) return null;

        const byStart = new Map();
        edges.forEach((edge, idx) => {
            const list = byStart.get(edge.start);
            if (list) {
                list.push(idx);
            } else {
                byStart.set(edge.start, [idx]);
            }
        });

        const used = new Uint8Array(edges.length);
        const rings = [];

        for (let e = 0; e < edges.length; e++) {
            if (used[e]) continue;
            const startKey = edges[e].start;
            let currentKey = startKey;
            let currentIdx = e;
            const ringKeys = [];

            while (true) {
                const edge = edges[currentIdx];
                used[currentIdx] = 1;
                if (ringKeys.length === 0) ringKeys.push(edge.start);
                ringKeys.push(edge.end);
                currentKey = edge.end;
                if (currentKey === startKey) break;
                const nextList = byStart.get(currentKey);
                if (!nextList) break;
                let nextIdx = -1;
                for (let n = 0; n < nextList.length; n++) {
                    const candidate = nextList[n];
                    if (!used[candidate]) {
                        nextIdx = candidate;
                        break;
                    }
                }
                if (nextIdx < 0) break;
                currentIdx = nextIdx;
            }

            if (ringKeys.length < 4) continue;
            if (ringKeys[0] === ringKeys[ringKeys.length - 1]) {
                ringKeys.pop();
            }
            if (ringKeys.length >= 3) rings.push(ringKeys);
        }

        if (!rings.length) return null;

        const cellLatDeg = grid.cellLatDeg ?? (180 / ny);
        const cellLonDeg = grid.cellLonDeg ?? (360 / nx);
        const latEdge = (j) => 90 - j * cellLatDeg;
        const lonEdge = (i) => -180 + i * cellLonDeg;

        let bestRing = null;
        for (const ring of rings) {
            if (!bestRing || ring.length > bestRing.length) {
                bestRing = ring;
            }
        }
        if (!bestRing) return null;

        const vertices = [];
        for (let r = 0; r < bestRing.length; r++) {
            const key = bestRing[r];
            const j = Math.floor(key / cornerStride);
            const i = key - j * cornerStride;
            const latDeg = latEdge(j);
            const lonDeg = normalizeLonDeg(lonEdge(i));
            const prev = vertices[vertices.length - 1];
            if (!prev || prev.latDeg !== latDeg || prev.lonDeg !== lonDeg) {
                vertices.push({ latDeg, lonDeg });
            }
        }
        return vertices.length >= 3 ? vertices : null;
    };

    const pointLineDistance = (p, a, b) => {
        const x0 = p.lonDeg;
        const y0 = p.latDeg;
        const x1 = a.lonDeg;
        const y1 = a.latDeg;
        const x2 = b.lonDeg;
        const y2 = b.latDeg;
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
            return Math.hypot(x0 - x1, y0 - y1);
        }
        const num = Math.abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1);
        const den = Math.hypot(dx, dy);
        return num / den;
    };

    const simplifyRdp = (points, epsilon) => {
        if (points.length <= 2) return points;
        const first = points[0];
        const last = points[points.length - 1];
        let maxDist = -1;
        let idx = -1;
        for (let i = 1; i < points.length - 1; i++) {
            const d = pointLineDistance(points[i], first, last);
            if (d > maxDist) {
                maxDist = d;
                idx = i;
            }
        }
        if (maxDist > epsilon && idx > 0) {
            const left = simplifyRdp(points.slice(0, idx + 1), epsilon);
            const right = simplifyRdp(points.slice(idx), epsilon);
            return left.slice(0, -1).concat(right);
        }
        return [first, last];
    };

    const simplifyPolygon = (points, epsilon) => {
        if (!points || points.length < 4) return points;
        const first = points[0];
        const last = points[points.length - 1];
        let pts = points;
        if (first.latDeg === last.latDeg && first.lonDeg === last.lonDeg) {
            pts = points.slice(0, -1);
        }
        const simplified = simplifyRdp(pts, epsilon);
        if (simplified.length < 3) return pts;
        return simplified;
    };

	    const getAutoWarningAreaCap = (hazardType, leadHours) => {
	        const table = tuningParamsRef.current?.areaCapsByHazardByLead?.[hazardType]
	            ?? AUTO_WARNING_CONFIG.maxAreaFracByHazardByLead?.[hazardType];
	        if (!table) return AUTO_WARNING_CONFIG.maxHitFracServiceArea;
	        const leads = Object.keys(table)
	            .map(Number)
	            .filter((v) => Number.isFinite(v))
            .sort((a, b) => a - b);
        if (leads.length === 0) return AUTO_WARNING_CONFIG.maxHitFracServiceArea;
        let chosen = leads[0];
        for (let i = 0; i < leads.length; i++) {
            if (leadHours >= leads[i]) chosen = leads[i];
        }
        return table[chosen] ?? AUTO_WARNING_CONFIG.maxHitFracServiceArea;
    };

    const buildAutoWarningsFromForecast = ({
        forecastResult,
        grid,
        issuedAtSimTimeSeconds,
        leadHours,
        durationHours,
        allowedHazards,
        maxPolygonsPerHazard,
        mode = 'warning'
	    }) => {
	        const config = AUTO_WARNING_CONFIG;
	        const hazardTypes = Array.isArray(allowedHazards) && allowedHazards.length
	            ? allowedHazards
	            : Object.keys(config.hazards);
	        const maxPolygons = Number.isFinite(maxPolygonsPerHazard)
	            ? maxPolygonsPerHazard
	            : config.maxPolygonsPerHazard;
            const minComponentCells = Number.isFinite(Number(tuningParamsRef.current?.minComponentCells))
                ? Number(tuningParamsRef.current.minComponentCells)
                : config.minComponentCells;
	        const diagnostics = {
	            playerId: forecastResult?.playerId ?? null,
	            forecastRunId: forecastResult?.runId ?? null,
	            leadHours,
            serviceCellCount: 0,
            hazards: {},
            reason: null
        };
        hazardTypes.forEach((hazardType) => {
            diagnostics.hazards[hazardType] = {
                maxValue: null,
                cellsOverThreshold: 0,
                componentCount: 0,
	                componentsDroppedTooSmall: 0,
	                componentsDroppedAreaCap: 0,
	                draftCount: 0,
	                thresholdUsed: tuningParamsRef.current?.thresholdsByHazard?.[hazardType]
	                    ?? config.hazards[hazardType]?.threshold
	                    ?? null
	            };
	        });
        const logDiagnostics = () => {
            earthRef.current?.logWeatherEvent?.(
                'autoWarningDiagnostics',
                diagnostics,
                { simTimeSeconds: issuedAtSimTimeSeconds }
            );
        };
        if (!forecastResult) {
            diagnostics.reason = 'missingForecast';
            logDiagnostics();
            return { drafts: [], diagnostics };
        }
        if (!grid) {
            diagnostics.reason = 'missingGrid';
            logDiagnostics();
            return { drafts: [], diagnostics };
        }
        const leadIdx = forecastResult.leadHours.indexOf(leadHours);
        if (leadIdx < 0) {
            diagnostics.reason = 'leadNotFound';
            logDiagnostics();
            return { drafts: [], diagnostics };
        }
        const confValues = forecastResult.products?.confidenceByLead?.[leadIdx] ?? null;

        const nextWarnings = [];
        const serviceMask = getServiceMask(grid);
        if (!serviceMask || serviceMask.length !== grid.nx * grid.ny) {
            hazardTypes.forEach((hazardType) => {
                earthRef.current?.logWeatherEvent?.(
                    'autoWarningCandidate',
                    {
                        forecastRunId: forecastResult.runId,
                        playerId: forecastResult.playerId,
                        hazardType,
                        leadHours,
                        reason: 'noServiceMask',
                        grid: { nx: grid.nx, ny: grid.ny }
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );
            });
            diagnostics.reason = 'noServiceMask';
            logDiagnostics();
            return { drafts: [], diagnostics };
        }
        let serviceCellCount = 0;
        for (let k = 0; k < serviceMask.length; k++) {
            if (serviceMask[k] === 1) serviceCellCount += 1;
        }
        diagnostics.serviceCellCount = serviceCellCount;
        if (serviceCellCount === 0) {
            hazardTypes.forEach((hazardType) => {
                earthRef.current?.logWeatherEvent?.(
                    'autoWarningCandidate',
                    {
                        forecastRunId: forecastResult.runId,
                        playerId: forecastResult.playerId,
                        hazardType,
                        leadHours,
                        reason: 'noServiceMask',
                        grid: { nx: grid.nx, ny: grid.ny }
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );
            });
            diagnostics.reason = 'noServiceArea';
            logDiagnostics();
            return { drafts: [], diagnostics };
        }
        const weights = getAreaWeights(grid);
        let serviceAreaW = 0;
        if (weights) {
            const { nx, ny } = grid;
            for (let j = 0; j < ny; j++) {
                const row = j * nx;
                const w = weights[j] || 0;
                for (let i = 0; i < nx; i++) {
                    const k = row + i;
                    if (serviceMask[k] === 1) serviceAreaW += w;
                }
            }
        }

        const getLatLonFromK = (k) => {
            if (!(k >= 0) || !grid?.nx || !grid?.latDeg || !grid?.lonDeg) return null;
            const j = Math.floor(k / grid.nx);
            const i = k - j * grid.nx;
            return { latDeg: grid.latDeg[j], lonDeg: grid.lonDeg[i] };
        };

        hazardTypes.forEach((hazardType) => {
            const hazardCfg = config.hazards[hazardType];
            if (!hazardCfg) return;
            const maskResult = buildHazardHitMask({
                hazardType,
                forecastResult,
                leadIdx,
                grid,
                config,
                serviceMask,
                mode
            });
            if (!maskResult || !maskResult.mask) return;

            const hitFracService = maskResult.hitFracService ?? 0;
            let reason = null;
            if (!(maskResult.hitCount > 0)) {
                reason = 'noHit';
            } else if (hitFracService > config.maxHitFracServiceArea) {
                reason = 'tooBroadServiceArea';
            }

            const baseLog = {
                forecastRunId: forecastResult.runId,
                playerId: forecastResult.playerId,
                hazardType,
                leadHours,
                confidenceMin: config.confidenceMin,
                thresholdUsed: maskResult.thresholdUsed,
                stormyGateUsed: maskResult.stormyGateUsed,
                hitCount: maskResult.hitCount,
                serviceCellCount: maskResult.serviceCellCount,
                hitFracService,
                grid: { nx: grid.nx, ny: grid.ny }
            };
            const hazardDiag = {
                maxValue: maskResult.maxValueService,
                cellsOverThreshold: maskResult.hitCount,
                componentCount: 0,
                componentsDroppedTooSmall: 0,
                componentsDroppedAreaCap: 0,
                draftCount: 0,
                thresholdUsed: maskResult.thresholdUsed
            };
            diagnostics.hazards[hazardType] = hazardDiag;

            if (reason) {
                earthRef.current?.logWeatherEvent?.(
                    'autoWarningCandidate',
                    {
                        ...baseLog,
                        reason
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );
                return;
            }

            const { labels, components } = labelConnectedComponents(maskResult.mask, grid.nx, grid.ny, maskResult.values);
            const cap = getAutoWarningAreaCap(hazardType, leadHours);
            hazardDiag.componentCount = components.length;
            const filtered = [];
	            for (const component of components) {
	                if (component.cellCount < minComponentCells) {
	                    hazardDiag.componentsDroppedTooSmall += 1;
	                    continue;
	                }
                const { indices } = extractComponentMaskAndIndices(
                    labels,
                    component.id,
                    grid.nx * grid.ny,
                    component.cellCount
                );
                let compAreaW = 0;
                if (indices && weights && serviceAreaW > 0) {
                    for (let i = 0; i < indices.length; i++) {
                        const k = indices[i];
                        if (serviceMask[k] !== 1) continue;
                        const j = Math.floor(k / grid.nx);
                        compAreaW += weights[j] || 0;
                    }
                }
                const compFrac = serviceAreaW > 0 ? compAreaW / serviceAreaW : 0;
                if (compFrac > cap) {
                    hazardDiag.componentsDroppedAreaCap += 1;
                    earthRef.current?.logWeatherEvent?.(
                        'autoWarningCandidate',
                        {
                            ...baseLog,
                            reason: 'componentTooBroad',
                            compFrac,
                            cap,
                            componentCellCount: component.cellCount,
                            componentMaxVal: component.maxVal
                        },
                        { simTimeSeconds: issuedAtSimTimeSeconds }
                    );
                    continue;
                }
                filtered.push(component);
            }
            filtered.sort((a, b) => (b.maxVal ?? 0) - (a.maxVal ?? 0));
            const limited = filtered.slice(0, maxPolygons);

            if (limited.length === 0) {
                earthRef.current?.logWeatherEvent?.(
                    'autoWarningCandidate',
                    {
                        ...baseLog,
                        componentCount: components.length,
                        reason: 'allComponentsTooSmall'
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );
                return;
            }

            let polygonCount = 0;
            const isDraft = mode === 'draft';

            limited.forEach((component) => {
                const polygon = traceBoundaryPolygonsFromLabels(labels, grid.nx, grid.ny, component.id, grid);
                if (!polygon || polygon.length < 3) return;
                const simplified = simplifyPolygon(polygon, 0.75);
                if (!simplified || simplified.length < 3) return;

                const maxLoc = getLatLonFromK(component.maxK);
                const bbox = component.bbox;
                const cellLatDeg = grid.cellLatDeg ?? (180 / grid.ny);
                const cellLonDeg = grid.cellLonDeg ?? (360 / grid.nx);
                const cellLat = (j) => (grid.latDeg ? grid.latDeg[j] : 90 - (j + 0.5) * cellLatDeg);
                const cellLon = (i) => (grid.lonDeg ? grid.lonDeg[i] : -180 + (i + 0.5) * cellLonDeg);
                const minLat = Math.min(cellLat(bbox.minJ), cellLat(bbox.maxJ));
                const maxLat = Math.max(cellLat(bbox.minJ), cellLat(bbox.maxJ));
                const minLon = Math.min(cellLon(bbox.minI), cellLon(bbox.maxI));
                const maxLon = Math.max(cellLon(bbox.minI), cellLon(bbox.maxI));

                earthRef.current?.logWeatherEvent?.(
                    'autoWarningComponent',
                    {
                        ...baseLog,
                        componentCellCount: component.cellCount,
                        componentMaxVal: component.maxVal,
                        componentMaxLatLonDeg: maxLoc,
                        componentBbox: {
                            minLat,
                            maxLat,
                            minLon,
                            maxLon
                        },
                        polygonVertexCount: simplified.length
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );

                const maskResult = buildWarningGridMask(simplified, grid);
                let warningFrac = null;
                if (maskResult?.mask && weights && serviceAreaW > 0) {
                    let warningAreaW = 0;
                    const { mask } = maskResult;
                    const { nx, ny } = grid;
                    for (let j = 0; j < ny; j++) {
                        const row = j * nx;
                        const w = weights[j] || 0;
                        for (let i = 0; i < nx; i++) {
                            const k = row + i;
                            if (mask[k] === 1 && serviceMask[k] === 1) {
                                warningAreaW += w;
                            }
                        }
                    }
                    warningFrac = serviceAreaW > 0 ? warningAreaW / serviceAreaW : 0;
                    if (warningFrac > cap) {
                        hazardDiag.componentsDroppedAreaCap += 1;
                        earthRef.current?.logWeatherEvent?.(
                            'autoWarningCandidate',
                            {
                                ...baseLog,
                                reason: 'polygonTooBroad',
                                warningFrac,
                                cap,
                                polygonVertexCount: simplified.length
                            },
                            { simTimeSeconds: issuedAtSimTimeSeconds }
                        );
                        return;
                    }
                }
                if (isDraft) {
                    const meanConfidence = confValues
                        ? computeMeanConfidenceInWarning(confValues, maskResult?.mask, grid, serviceMask, weights)
                        : null;
                    const draft = {
                        id: `draft-${hazardType}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                        playerId: forecastResult.playerId,
                        createdAtSimTimeSeconds: issuedAtSimTimeSeconds,
                        hazardType,
                        polygonLatLonDeg: simplified,
                        forecastRunId: forecastResult.runId,
                        forecastLeadHours: leadHours,
                        status: 'draft',
                        areaFracService: warningFrac,
                        meanConfidence,
                        componentCellCount: component.cellCount,
                        componentMaxVal: component.maxVal,
                        componentMaxLatLonDeg: maxLoc,
                        _gridMask: maskResult?.mask ?? null,
                        _gridMaskNx: maskResult?.nx ?? null,
                        _gridMaskNy: maskResult?.ny ?? null
                    };
                    nextWarnings.push(draft);
                    hazardDiag.draftCount += 1;
                    earthRef.current?.logWeatherEvent?.(
                        'autoWarningDraftCreated',
                        {
                            forecastRunId: forecastResult.runId,
                            playerId: forecastResult.playerId,
                            hazardType,
                            leadHours,
                            areaFracService: warningFrac,
                            cellCount: component.cellCount
                        },
                        { simTimeSeconds: issuedAtSimTimeSeconds }
                    );
                } else {
                    nextWarnings.push({
                        id: `warn-${hazardType}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                        playerId: forecastResult.playerId,
                        issuedAtSimTimeSeconds,
                        validStartSimTimeSeconds: issuedAtSimTimeSeconds + leadHours * 3600,
                        validEndSimTimeSeconds: issuedAtSimTimeSeconds + (leadHours + durationHours) * 3600,
                        hazardType,
                        polygonLatLonDeg: simplified,
                        forecastRunId: forecastResult.runId,
                        forecastLeadHours: leadHours,
                        autoIssued: true,
                        componentCellCount: component.cellCount,
                        componentMaxVal: component.maxVal,
                        componentMaxLatLonDeg: maxLoc,
                        _gridMask: maskResult?.mask ?? null,
                        _gridMaskNx: maskResult?.nx ?? null,
                        _gridMaskNy: maskResult?.ny ?? null
                    });
                }
                polygonCount += 1;
            });

            earthRef.current?.logWeatherEvent?.(
                'autoWarningCandidate',
                {
                    ...baseLog,
                    componentCount: components.length,
                    polygonCount,
                    reason: polygonCount > 0 ? null : 'allComponentsTooSmall'
                },
                { simTimeSeconds: issuedAtSimTimeSeconds }
            );
        });
        earthRef.current?.logWeatherEvent?.(
            'autoWarningDiagnostics',
            diagnostics,
            { simTimeSeconds: issuedAtSimTimeSeconds }
        );

        return { drafts: nextWarnings, diagnostics };
    };

    const getServiceMask = (grid) => {
        const player = currentPlayerRef.current;
        if (!player || !grid?.nx || !grid?.ny) return null;
        const hqs = hqSpheresRef.current.filter(hq => hq.ownerID === player.id && hq.hp > 0);
        const gridKey = `${grid.nx}x${grid.ny}`;
        const cache = serviceMaskRef.current;
        if (cache.playerId === player.id && cache.gridKey === gridKey && cache.hqCount === hqs.length && cache.mask) {
            return cache.mask;
        }

        const N = grid.nx * grid.ny;
        const mask = new Uint8Array(N);
        if (hqs.length === 0) {
            serviceMaskRef.current = { playerId: player.id, gridKey, hqCount: 0, mask };
            return mask;
        }

        const hqLocs = hqs.map(hq => {
            if (Number.isFinite(hq.latitude) && Number.isFinite(hq.longitude)) {
                return { latDeg: hq.latitude, lonDeg: hq.longitude };
            }
            const pos = hq.position?.clone?.() ?? hq.sphere?.position?.clone?.();
            const latLon = vectorToLatLonRad(pos);
            if (!latLon) return null;
            return {
                latDeg: THREE.MathUtils.radToDeg(latLon.latRad),
                lonDeg: THREE.MathUtils.radToDeg(latLon.lonRad)
            };
        }).filter(Boolean);

        const latDeg = grid.latDeg;
        const lonDeg = grid.lonDeg;
        const reKm = RE_M / 1000;
        for (let j = 0; j < grid.ny; j++) {
            const lat = latDeg ? latDeg[j] : 90 - (j + 0.5) * (180 / grid.ny);
            const latRad = THREE.MathUtils.degToRad(lat);
            const cosLat = Math.cos(latRad);
            const row = j * grid.nx;
            for (let i = 0; i < grid.nx; i++) {
                const lon = lonDeg ? lonDeg[i] : -180 + (i + 0.5) * (360 / grid.nx);
                let inRange = false;
                for (let h = 0; h < hqLocs.length; h++) {
                    const hq = hqLocs[h];
                    const dLat = THREE.MathUtils.degToRad(lat - hq.latDeg);
                    const dLon = THREE.MathUtils.degToRad(wrapLonDeltaDeg(lon, hq.lonDeg));
                    const distKm = reKm * Math.sqrt(dLat * dLat + (cosLat * dLon) * (cosLat * dLon));
                    if (distKm <= SERVICE_RADIUS_KM) {
                        inRange = true;
                        break;
                    }
                }
                if (inRange) mask[row + i] = 1;
            }
        }

        serviceMaskRef.current = { playerId: player.id, gridKey, hqCount: hqs.length, mask };
        return mask;
    };

    const getPlayerHqLatLonDegList = (playerId) => {
        if (!playerId) return [];
        return hqSpheresRef.current
            .filter(hq => hq.ownerID === playerId && hq.hp > 0)
            .map(hq => {
                if (Number.isFinite(hq.latitude) && Number.isFinite(hq.longitude)) {
                    return { latDeg: hq.latitude, lonDeg: hq.longitude };
                }
                const pos = hq.position?.clone?.() ?? hq.sphere?.position?.clone?.();
                const latLon = vectorToLatLonRad(pos);
                if (!latLon) return null;
                return {
                    latDeg: THREE.MathUtils.radToDeg(latLon.latRad),
                    lonDeg: THREE.MathUtils.radToDeg(latLon.lonRad)
                };
            })
            .filter(Boolean);
    };

    const getPlayerRadarHubLatLonDegList = (playerId) => {
        if (!playerId) return [];
        const hubs = uplinkHubsByPlayerIdRef.current[playerId] || [];
        return hubs
            .filter(hub => hub?.isOnline && hub?.modules?.radar)
            .map(hub => ({ latDeg: hub.latDeg, lonDeg: hub.lonDeg }));
    };

    const buildRadarCoverageMask = (grid, radarLocs, radiusKm = RADAR_RADIUS_KM) => {
        if (!grid?.nx || !grid?.ny) return null;
        const N = grid.nx * grid.ny;
        const mask = new Uint8Array(N);
        if (!radarLocs || radarLocs.length === 0) return mask;
        const latDeg = grid.latDeg;
        const lonDeg = grid.lonDeg;
        const reKm = RE_M / 1000;
        for (let j = 0; j < grid.ny; j++) {
            const lat = latDeg ? latDeg[j] : 90 - (j + 0.5) * (180 / grid.ny);
            const latRad = THREE.MathUtils.degToRad(lat);
            const cosLat = Math.cos(latRad);
            const row = j * grid.nx;
            for (let i = 0; i < grid.nx; i++) {
                const lon = lonDeg ? lonDeg[i] : -180 + (i + 0.5) * (360 / grid.nx);
                let inRange = false;
                for (let h = 0; h < radarLocs.length; h++) {
                    const site = radarLocs[h];
                    const dLat = THREE.MathUtils.degToRad(lat - site.latDeg);
                    const dLon = THREE.MathUtils.degToRad(wrapLonDeltaDeg(lon, site.lonDeg));
                    const distKm = reKm * Math.sqrt(dLat * dLat + (cosLat * dLon) * (cosLat * dLon));
                    if (distKm <= radiusKm) {
                        inRange = true;
                        break;
                    }
                }
                if (inRange) mask[row + i] = 1;
            }
        }
        return mask;
    };

    const computeWeightedMeanWithMask = (values, weights, mask, nx, ny) => {
        if (!values || !weights || !mask) return null;
        let sum = 0;
        let sumW = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (mask[k] !== 1) continue;
                sum += w * (values[k] ?? 0);
                sumW += w;
            }
        }
        return sumW > 0 ? sum / sumW : null;
    };

    const buildTruthEventMask = ({ hazardType, grid, fields, serviceMask }) => {
        if (!grid?.nx || !grid?.ny || !fields) return null;
        const N = grid.nx * grid.ny;
        const mask = new Uint8Array(N);
        const values = new Float32Array(N);
        const threshold = hazardType === 'heavyPrecip'
            ? EVENT_THRESHOLDS.heavyPrecip
            : hazardType === 'severeStormRisk'
                ? EVENT_THRESHOLDS.severeStormRisk
                : EVENT_THRESHOLDS.highWinds;
        const precip = fields.precipRate;
        const u = fields.u;
        const v = fields.v;
        const tauLow = fields.tauLow;
        const tauHigh = fields.tauHigh;
        let hitCount = 0;
        let maxVal = -Infinity;
        let maxK = -1;
        for (let k = 0; k < N; k++) {
            if (serviceMask && serviceMask[k] !== 1) continue;
            let val = 0;
            if (hazardType === 'heavyPrecip') {
                val = precip ? precip[k] : 0;
            } else if (hazardType === 'highWinds') {
                const uVal = u ? u[k] : 0;
                const vVal = v ? v[k] : 0;
                val = Math.hypot(uVal, vVal);
            } else if (hazardType === 'severeStormRisk') {
                const p = precip ? precip[k] : 0;
                const uVal = u ? u[k] : 0;
                const vVal = v ? v[k] : 0;
                const w = Math.hypot(uVal, vVal);
                const c = (tauLow ? tauLow[k] : 0) + (tauHigh ? tauHigh[k] : 0);
                val = (w / 50) * (p / 2) + (c / 20);
            }
            values[k] = val;
            const stormy = hazardType === 'severeStormRisk'
                ? ((precip ? precip[k] : 0) >= 0.1)
                    || (((tauLow ? tauLow[k] : 0) + (tauHigh ? tauHigh[k] : 0)) >= 4)
                : true;
            if (val >= threshold && stormy) {
                mask[k] = 1;
                hitCount += 1;
                if (val > maxVal) {
                    maxVal = val;
                    maxK = k;
                }
            }
        }
        return {
            mask,
            values,
            hitCount,
            threshold,
            maxVal: Number.isFinite(maxVal) ? maxVal : null,
            maxK
        };
    };

	const extractComponentMask = (labels, componentId, N) => {
		const mask = new Uint8Array(N);
		for (let k = 0; k < N; k++) {
			if (labels[k] === componentId) mask[k] = 1;
		}
		return mask;
	};

	const extractComponentMaskAndIndices = (labels, componentId, N, expectedCount = null) => {
		const mask = new Uint8Array(N);
		const indices = expectedCount && expectedCount > 0 ? new Int32Array(expectedCount) : null;
		let cursor = 0;
		for (let k = 0; k < N; k++) {
			if (labels[k] !== componentId) continue;
			mask[k] = 1;
			if (indices) {
				if (cursor < indices.length) indices[cursor] = k;
				cursor += 1;
			}
		}
		if (indices && cursor !== indices.length) {
			return { mask, indices: indices.slice(0, cursor) };
		}
		return { mask, indices };
	};

	const computeWeightedAreaFromIndices = (indices, grid) => {
		if (!indices || !grid?.nx || !grid?.ny) return 0;
		const weights = getAreaWeights(grid);
		if (!weights) return 0;
		const nx = grid.nx;
		let area = 0;
		for (let i = 0; i < indices.length; i++) {
			const k = indices[i];
			const j = Math.floor(k / nx);
			area += weights[j] || 0;
		}
		return area;
	};

	const computeWeightedIoUFromIndices = (warningMask, warningArea, sample, grid) => {
		if (!warningMask || !sample?.indices || !grid?.nx || !grid?.ny) return 0;
		const weights = getAreaWeights(grid);
		if (!weights) return 0;
		const nx = grid.nx;
		const indices = sample.indices;
		let inter = 0;
		for (let i = 0; i < indices.length; i++) {
			const k = indices[i];
			if (warningMask[k] === 1) {
				const j = Math.floor(k / nx);
				inter += weights[j] || 0;
			}
		}
		const eventArea = Number.isFinite(sample.areaW) ? sample.areaW : computeWeightedAreaFromIndices(indices, grid);
		const union = warningArea + eventArea - inter;
		return union > 0 ? inter / union : 0;
	};

	const getWarningWeightedArea = (warning, warningMask, grid) => {
		if (!warning || !warningMask || !grid?.nx || !grid?.ny) return 0;
		const gridKey = `${grid.nx}x${grid.ny}`;
		if (Number.isFinite(warning._weightedArea) && warning._weightedAreaGridKey === gridKey) {
			return warning._weightedArea;
		}
		const weights = getAreaWeights(grid);
		if (!weights) return 0;
		const { nx, ny } = grid;
		let area = 0;
		for (let j = 0; j < ny; j++) {
			const w = weights[j] || 0;
			if (w <= 0) continue;
			const row = j * nx;
			for (let i = 0; i < nx; i++) {
				const k = row + i;
				if (warningMask[k] === 1) area += w;
			}
		}
		warning._weightedArea = area;
		warning._weightedAreaGridKey = gridKey;
		return area;
	};

	const computeBestEventIoUInWindow = (event, warningMask, warningArea, grid, windowStart, windowEnd) => {
		if (!event || !warningMask || !grid?.nx || !grid?.ny) return 0;
		const t0 = Number(windowStart);
		const t1 = Number(windowEnd);
		const start = Number.isFinite(t0) ? t0 : -Infinity;
		const end = Number.isFinite(t1) ? t1 : Infinity;
		let best = 0;
		const samples = event.footprintSamples;
		if (Array.isArray(samples) && samples.length > 0) {
			for (let i = 0; i < samples.length; i++) {
				const s = samples[i];
				if (!s) continue;
				const t = s.t;
				if (Number.isFinite(t) && (t < start || t > end)) continue;
				const iou = computeWeightedIoUFromIndices(warningMask, warningArea, s, grid);
				if (iou > best) best = iou;
			}
		}
		if (best > 0) return best;

		const masks = [];
		if (event.maskAtPeak && Number.isFinite(event.peakSimTimeSeconds) && event.peakSimTimeSeconds >= start && event.peakSimTimeSeconds <= end) {
			masks.push(event.maskAtPeak);
		}
		if (event.lastMask && Number.isFinite(event.lastSeenSimTimeSeconds) && event.lastSeenSimTimeSeconds >= start && event.lastSeenSimTimeSeconds <= end) {
			masks.push(event.lastMask);
		}
		for (let i = 0; i < masks.length; i++) {
			const iou = computeWeightedIoU(warningMask, masks[i], grid);
			if (iou > best) best = iou;
		}
		return best;
	};

    const computeBestEventOverlapInWindowDetailed = (event, warningMask, warningArea, grid, windowStart, windowEnd) => {
        if (!event || !warningMask || !grid?.nx || !grid?.ny) {
            return { bestIoU: 0, bestSimTimeSeconds: null, bestIndices: null, bestMaskFallback: null };
        }
        const t0 = Number(windowStart);
        const t1 = Number(windowEnd);
        const start = Number.isFinite(t0) ? t0 : -Infinity;
        const end = Number.isFinite(t1) ? t1 : Infinity;
        let bestIoU = 0;
        let bestSimTimeSeconds = null;
        let bestIndices = null;
        const samples = event.footprintSamples;
        if (Array.isArray(samples) && samples.length > 0) {
            for (let i = 0; i < samples.length; i++) {
                const s = samples[i];
                if (!s) continue;
                const t = s.t;
                if (Number.isFinite(t) && (t < start || t > end)) continue;
                const iou = computeWeightedIoUFromIndices(warningMask, warningArea, s, grid);
                if (iou > bestIoU) {
                    bestIoU = iou;
                    bestSimTimeSeconds = Number.isFinite(t) ? t : null;
                    bestIndices = s.indices || null;
                }
            }
        }
        if (bestIoU > 0) {
            return { bestIoU, bestSimTimeSeconds, bestIndices, bestMaskFallback: null };
        }

        let bestMaskFallback = null;
        let bestMaskTime = null;
        const masks = [];
        if (event.maskAtPeak && Number.isFinite(event.peakSimTimeSeconds) && event.peakSimTimeSeconds >= start && event.peakSimTimeSeconds <= end) {
            masks.push({ mask: event.maskAtPeak, t: event.peakSimTimeSeconds });
        }
        if (event.lastMask && Number.isFinite(event.lastSeenSimTimeSeconds) && event.lastSeenSimTimeSeconds >= start && event.lastSeenSimTimeSeconds <= end) {
            masks.push({ mask: event.lastMask, t: event.lastSeenSimTimeSeconds });
        }
        for (let i = 0; i < masks.length; i++) {
            const entry = masks[i];
            const iou = computeWeightedIoU(warningMask, entry.mask, grid);
            if (iou > bestIoU) {
                bestIoU = iou;
                bestMaskFallback = entry.mask;
                bestMaskTime = entry.t ?? null;
            }
        }
        return {
            bestIoU,
            bestSimTimeSeconds: bestMaskTime,
            bestIndices: null,
            bestMaskFallback
        };
    };

    const makeMaskFromIndices = (indices, N) => {
        if (!indices || !Number.isFinite(N) || N <= 0) return null;
        const mask = new Uint8Array(N);
        for (let i = 0; i < indices.length; i++) {
            const k = indices[i];
            if (k >= 0 && k < N) mask[k] = 1;
        }
        return mask;
    };

    const classifyFalseAlarm = ({ warning, warningMask, warningArea, grid, allEvents, simTimeSeconds, bestOverlapEvent, bestOverlapIoU }) => {
        const warningStart = warning.validStartSimTimeSeconds;
        const warningEnd = warning.validEndSimTimeSeconds;
        const detailLines = [];
        const weights = getAreaWeights(grid);
        const serviceMask = getServiceMask(grid);
        const areaFracService = Number.isFinite(warning.areaFracService)
            ? warning.areaFracService
            : (weights && serviceMask ? computeWarningAreaFracService(warningMask, grid, serviceMask, weights) : null);

        if (Number.isFinite(areaFracService) && areaFracService >= TOO_BROAD_AREA_FRAC) {
            detailLines.push(`Covered ${Math.round(areaFracService * 100)}% of service area; smaller polygons score better.`);
            return { primaryTag: 'tooBroad', detailLines, bestEvent: null, bestOverlap: null };
        }

        const sameHazardEvents = allEvents.filter(e => e.confirmed && e.hazardType === warning.hazardType);
        let overlapEvent = bestOverlapEvent ?? null;
        let overlapIoU = Number.isFinite(bestOverlapIoU) ? bestOverlapIoU : 0;
        if (!overlapEvent && sameHazardEvents.length) {
            sameHazardEvents.forEach((event) => {
                const eventEnd = event.endSimTimeSeconds ?? simTimeSeconds;
                if (event.startSimTimeSeconds > warningEnd || eventEnd < warningStart) return;
                const overlapStart = Math.max(warningStart, event.startSimTimeSeconds);
                const overlapEnd = Math.min(warningEnd, eventEnd);
                const iou = computeBestEventIoUInWindow(event, warningMask, warningArea, grid, overlapStart, overlapEnd);
                if (iou > overlapIoU) {
                    overlapIoU = iou;
                    overlapEvent = event;
                }
            });
        }

	        const iouMatchMin = tuningParamsRef.current?.iouMatchMin ?? IOU_MATCH_MIN;
	        if (overlapEvent && overlapIoU >= POSTMORTEM_HINT_IOU && overlapIoU < iouMatchMin) {
	            detailLines.push('Event occurred during your window but your polygon missed it.');
	            const overlapStart = Math.max(warningStart, overlapEvent.startSimTimeSeconds);
	            const overlapEnd = Math.min(warningEnd, overlapEvent.endSimTimeSeconds ?? simTimeSeconds);
	            const bestOverlap = computeBestEventOverlapInWindowDetailed(
                overlapEvent,
                warningMask,
                warningArea,
                grid,
                overlapStart,
                overlapEnd
            );
            return { primaryTag: 'misplaced', detailLines, bestEvent: overlapEvent, bestOverlap };
        }

        let bestOutsideEvent = null;
        let bestOutsideOverlap = null;
        let bestOutsideIoU = 0;
        sameHazardEvents.forEach((event) => {
            const eventEnd = event.endSimTimeSeconds ?? simTimeSeconds;
            if (eventEnd >= warningStart && event.startSimTimeSeconds <= warningEnd) return;
            const overlap = computeBestEventOverlapInWindowDetailed(
                event,
                warningMask,
                warningArea,
                grid,
                event.startSimTimeSeconds,
                eventEnd
            );
            if (overlap.bestIoU > bestOutsideIoU) {
                bestOutsideIoU = overlap.bestIoU;
                bestOutsideEvent = event;
                bestOutsideOverlap = overlap;
            }
        });

        if (bestOutsideEvent && bestOutsideOverlap && bestOutsideIoU >= POSTMORTEM_HINT_IOU) {
            const bestTime = bestOutsideOverlap.bestSimTimeSeconds;
            if (Number.isFinite(bestTime) && bestTime > warningEnd + TIME_FUZZ_SECONDS) {
                detailLines.push('Your window ended before the event.');
                return { primaryTag: 'tooEarly', detailLines, bestEvent: bestOutsideEvent, bestOverlap: bestOutsideOverlap };
            }
            if (Number.isFinite(bestTime) && bestTime < warningStart - TIME_FUZZ_SECONDS) {
                detailLines.push('The event had already occurred before your window.');
                return { primaryTag: 'tooLate', detailLines, bestEvent: bestOutsideEvent, bestOverlap: bestOutsideOverlap };
            }
        }

        let bestOtherEvent = null;
        let bestOtherOverlap = null;
        let bestOtherIoU = 0;
        const otherEvents = allEvents.filter(e => e.confirmed && e.hazardType !== warning.hazardType);
        otherEvents.forEach((event) => {
            const eventEnd = event.endSimTimeSeconds ?? simTimeSeconds;
            if (event.startSimTimeSeconds > warningEnd || eventEnd < warningStart) return;
            const overlapStart = Math.max(warningStart, event.startSimTimeSeconds);
            const overlapEnd = Math.min(warningEnd, eventEnd);
            const overlap = computeBestEventOverlapInWindowDetailed(
                event,
                warningMask,
                warningArea,
                grid,
                overlapStart,
                overlapEnd
            );
            if (overlap.bestIoU > bestOtherIoU) {
                bestOtherIoU = overlap.bestIoU;
                bestOtherEvent = event;
                bestOtherOverlap = overlap;
            }
        });
        if (bestOtherEvent && bestOtherOverlap && bestOtherIoU >= POSTMORTEM_HINT_IOU) {
            const hazardLabel = HAZARD_LABELS[bestOtherEvent.hazardType] ?? bestOtherEvent.hazardType;
            detailLines.push(`A different hazard occurred here: ${hazardLabel}.`);
            return { primaryTag: 'wrongHazard', detailLines, bestEvent: bestOtherEvent, bestOverlap: bestOtherOverlap };
        }

        detailLines.push('No matching event occurred in your service area during that window.');
        return { primaryTag: 'misplaced', detailLines, bestEvent: null, bestOverlap: null };
    };

    const classifyMissedEvent = ({ event, warnings, grid, simTimeSeconds }) => {
        if (!event || !grid) {
            return { primaryTag: 'misplaced', detailLines: ['No warning issued.'], warningMask: null, bestOverlapSimTimeSeconds: null };
        }
        const eventStart = event.startSimTimeSeconds;
        const eventEnd = event.endSimTimeSeconds ?? simTimeSeconds;
        const detailLines = [];
        const sameHazardWarnings = warnings.filter(w => w.hazardType === event.hazardType);

        let bestOverlapWarning = null;
        let bestOverlapIoU = 0;
        let bestOverlap = null;
        let bestOverlapWarningMask = null;
        sameHazardWarnings.forEach((warning) => {
            const warningEnd = warning.validEndSimTimeSeconds;
            const warningStart = warning.validStartSimTimeSeconds;
            if (warningStart > eventEnd || warningEnd < eventStart) return;
            const warningMask = getWarningMaskForScoring(warning, grid);
            if (!warningMask) return;
            const warningArea = getWarningWeightedArea(warning, warningMask, grid);
            const overlapStart = Math.max(eventStart, warningStart);
            const overlapEnd = Math.min(eventEnd, warningEnd);
            const iou = computeBestEventIoUInWindow(event, warningMask, warningArea, grid, overlapStart, overlapEnd);
            if (iou > bestOverlapIoU) {
                bestOverlapIoU = iou;
                bestOverlapWarning = warning;
                bestOverlapWarningMask = warningMask;
                bestOverlap = computeBestEventOverlapInWindowDetailed(
                    event,
                    warningMask,
                    warningArea,
                    grid,
                    overlapStart,
                    overlapEnd
                );
            }
        });

	        const iouMatchMin = tuningParamsRef.current?.iouMatchMin ?? IOU_MATCH_MIN;
	        if (bestOverlapWarning && bestOverlapIoU >= POSTMORTEM_HINT_IOU && bestOverlapIoU < iouMatchMin) {
	            detailLines.push('A warning was issued during the event but missed it.');
	            return {
	                primaryTag: 'misplaced',
	                detailLines,
	                warningMask: bestOverlapWarningMask,
                bestOverlapSimTimeSeconds: bestOverlap?.bestSimTimeSeconds ?? null
            };
        }

        let bestOutsideWarning = null;
        let bestOutsideIoU = 0;
        let bestOutsideOverlap = null;
        let bestOutsideWarningMask = null;
        sameHazardWarnings.forEach((warning) => {
            const warningEnd = warning.validEndSimTimeSeconds;
            const warningStart = warning.validStartSimTimeSeconds;
            if (warningStart <= eventEnd && warningEnd >= eventStart) return;
            const warningMask = getWarningMaskForScoring(warning, grid);
            if (!warningMask) return;
            const warningArea = getWarningWeightedArea(warning, warningMask, grid);
            const overlap = computeBestEventOverlapInWindowDetailed(
                event,
                warningMask,
                warningArea,
                grid,
                eventStart,
                eventEnd
            );
            if (overlap.bestIoU > bestOutsideIoU) {
                bestOutsideIoU = overlap.bestIoU;
                bestOutsideWarning = warning;
                bestOutsideWarningMask = warningMask;
                bestOutsideOverlap = overlap;
            }
        });
        if (bestOutsideWarning && bestOutsideOverlap && bestOutsideIoU >= POSTMORTEM_HINT_IOU) {
            const bestTime = bestOutsideOverlap.bestSimTimeSeconds;
            if (Number.isFinite(bestTime) && bestTime > bestOutsideWarning.validEndSimTimeSeconds + TIME_FUZZ_SECONDS) {
                detailLines.push('Warnings ended before the event.');
                return {
                    primaryTag: 'tooEarly',
                    detailLines,
                    warningMask: bestOutsideWarningMask,
                    bestOverlapSimTimeSeconds: bestTime
                };
            }
            if (Number.isFinite(bestTime) && bestTime < bestOutsideWarning.validStartSimTimeSeconds - TIME_FUZZ_SECONDS) {
                detailLines.push('Warnings came after the event.');
                return {
                    primaryTag: 'tooLate',
                    detailLines,
                    warningMask: bestOutsideWarningMask,
                    bestOverlapSimTimeSeconds: bestTime
                };
            }
        }

        let bestOtherWarning = null;
        let bestOtherIoU = 0;
        let bestOtherWarningMask = null;
        warnings.forEach((warning) => {
            if (warning.hazardType === event.hazardType) return;
            const warningEnd = warning.validEndSimTimeSeconds;
            const warningStart = warning.validStartSimTimeSeconds;
            if (warningStart > eventEnd || warningEnd < eventStart) return;
            const warningMask = getWarningMaskForScoring(warning, grid);
            if (!warningMask) return;
            const warningArea = getWarningWeightedArea(warning, warningMask, grid);
            const overlapStart = Math.max(eventStart, warningStart);
            const overlapEnd = Math.min(eventEnd, warningEnd);
            const iou = computeBestEventIoUInWindow(event, warningMask, warningArea, grid, overlapStart, overlapEnd);
            if (iou > bestOtherIoU) {
                bestOtherIoU = iou;
                bestOtherWarning = warning;
                bestOtherWarningMask = warningMask;
            }
        });
        if (bestOtherWarning && bestOtherIoU >= POSTMORTEM_HINT_IOU) {
            const hazardLabel = HAZARD_LABELS[bestOtherWarning.hazardType] ?? bestOtherWarning.hazardType;
            detailLines.push(`A warning for ${hazardLabel} was issued during this event.`);
            return {
                primaryTag: 'wrongHazard',
                detailLines,
                warningMask: bestOtherWarningMask,
                bestOverlapSimTimeSeconds: null
            };
        }

        detailLines.push('No warning issued.');
        return { primaryTag: 'misplaced', detailLines, warningMask: null, bestOverlapSimTimeSeconds: null };
    };

    const drawPostmortemMiniMap = (canvas, grid, warningMask, eventMask) => {
        if (!canvas || !grid?.nx || !grid?.ny) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const nx = grid.nx;
        const ny = grid.ny;
        const cellW = width / nx;
        const cellH = height / ny;

        if (eventMask) {
            ctx.fillStyle = 'rgba(0,255,255,0.35)';
            for (let j = 0; j < ny; j++) {
                const row = j * nx;
                const y = j * cellH;
                for (let i = 0; i < nx; i++) {
                    const k = row + i;
                    if (eventMask[k] === 1) {
                        ctx.fillRect(i * cellW, y, Math.ceil(cellW), Math.ceil(cellH));
                    }
                }
            }
        }

        if (warningMask) {
            ctx.fillStyle = 'rgba(255,0,255,0.85)';
            for (let j = 0; j < ny; j++) {
                const row = j * nx;
                const y = j * cellH;
                for (let i = 0; i < nx; i++) {
                    const k = row + i;
                    if (warningMask[k] !== 1) continue;
                    const north = j > 0 ? warningMask[k - nx] === 1 : false;
                    const south = j < ny - 1 ? warningMask[k + nx] === 1 : false;
                    const west = i > 0 ? warningMask[k - 1] === 1 : false;
                    const east = i < nx - 1 ? warningMask[k + 1] === 1 : false;
                    if (north && south && west && east) continue;
                    ctx.fillRect(i * cellW, y, Math.ceil(cellW), Math.ceil(cellH));
                }
            }
        }
    };

    const computeMaskCentroid = (mask, grid) => {
        const { nx, ny, latDeg, lonDeg } = grid;
        let count = 0;
        let sumLat = 0;
        let sumLon = 0;
        for (let j = 0; j < ny; j++) {
            const lat = latDeg ? latDeg[j] : 90 - (j + 0.5) * (180 / ny);
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (!mask[k]) continue;
                const lon = lonDeg ? lonDeg[i] : -180 + (i + 0.5) * (360 / nx);
                sumLat += lat;
                sumLon += lon;
                count += 1;
            }
        }
        if (count === 0) return { count: 0, centroid: null };
        return {
            count,
            centroid: { latDeg: sumLat / count, lonDeg: sumLon / count }
        };
    };

    const getGridLatLonFromIndex = (k, grid) => {
        if (!(k >= 0) || !grid?.nx || !grid?.ny) return null;
        const j = Math.floor(k / grid.nx);
        const i = k - j * grid.nx;
        const latDeg = grid.latDeg ? grid.latDeg[j] : 90 - (j + 0.5) * (180 / grid.ny);
        const lonDeg = grid.lonDeg ? grid.lonDeg[i] : -180 + (i + 0.5) * (360 / grid.nx);
        return { latDeg, lonDeg };
    };

    const computeMaskIoU = (maskA, maskB) => {
        let inter = 0;
        let union = 0;
        for (let k = 0; k < maskA.length; k++) {
            const a = maskA[k] === 1;
            const b = maskB[k] === 1;
            if (a || b) union += 1;
            if (a && b) inter += 1;
        }
        return union > 0 ? inter / union : 0;
    };

    const getAreaWeights = (grid) => {
        if (!grid?.ny || !grid?.nx) return null;
        const gridKey = `${grid.nx}x${grid.ny}`;
        const cache = areaWeightsRef.current;
        if (cache.gridKey === gridKey && Array.isArray(cache.weights)) {
            return cache.weights;
        }
        const weights = new Array(grid.ny);
        for (let j = 0; j < grid.ny; j++) {
            const latDeg = grid.latDeg ? grid.latDeg[j] : 90 - (j + 0.5) * (180 / grid.ny);
            const latRad = THREE.MathUtils.degToRad(latDeg);
            weights[j] = Math.max(0, Math.cos(latRad));
        }
        areaWeightsRef.current = { gridKey, weights };
        return weights;
    };

    const computeWeightedIoU = (maskA, maskB, grid) => {
        if (!maskA || !maskB || !grid?.nx || !grid?.ny) return 0;
        const weights = getAreaWeights(grid);
        if (!weights) return 0;
        let inter = 0;
        let union = 0;
        const { nx, ny } = grid;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                const a = maskA[k] === 1;
                const b = maskB[k] === 1;
                if (a || b) union += w;
                if (a && b) inter += w;
            }
        }
        return union > 0 ? inter / union : 0;
    };

    const computeServiceAreaW = (grid) => {
        const serviceMask = getServiceMask(grid);
        const weights = getAreaWeights(grid);
        if (!serviceMask || !weights || !grid?.nx || !grid?.ny) return 0;
        const { nx, ny } = grid;
        let areaW = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] === 1) areaW += w;
            }
        }
        return areaW;
    };

    const computeWarningAreaFracService = (warningMask, grid, serviceMask, weights) => {
        if (!warningMask || !grid?.nx || !grid?.ny || !serviceMask || !weights) return null;
        const { nx, ny } = grid;
        const serviceAreaW = computeServiceAreaW(grid);
        if (!(serviceAreaW > 0)) return null;
        let warningAreaW = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] === 1 && warningMask[k] === 1) warningAreaW += w;
            }
        }
        return warningAreaW / serviceAreaW;
    };

    const computeMeanConfidenceInWarning = (confValues, warningMask, grid, serviceMask, weights) => {
        if (!confValues || !warningMask || !grid?.nx || !grid?.ny || !serviceMask || !weights) return null;
        const { nx, ny } = grid;
        let sum = 0;
        let sumW = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1 || warningMask[k] !== 1) continue;
                const v = confValues[k] ?? 0;
                sum += w * v;
                sumW += w;
            }
        }
        if (sumW <= 0) return null;
        return sum / sumW;
    };

    const computeWeightedMetrics = (truth, forecast, weights, serviceMask, nx, ny) => {
        if (!truth || !forecast || !weights || !serviceMask) return null;
        let sumW = 0;
        let sumT = 0;
        let sumF = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const t = truth[k] ?? 0;
                const f = forecast[k] ?? 0;
                sumW += w;
                sumT += w * t;
                sumF += w * f;
            }
        }
        if (sumW <= 0) return null;
        const meanT = sumT / sumW;
        const meanF = sumF / sumW;
        let sumAbsErr = 0;
        let sumSqErr = 0;
        let cov = 0;
        let varT = 0;
        let varF = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const t = truth[k] ?? 0;
                const f = forecast[k] ?? 0;
                const err = f - t;
                sumAbsErr += w * Math.abs(err);
                sumSqErr += w * err * err;
                const dt = t - meanT;
                const df = f - meanF;
                cov += w * dt * df;
                varT += w * dt * dt;
                varF += w * df * df;
            }
        }
        const rmse = Math.sqrt(sumSqErr / sumW);
        const mae = sumAbsErr / sumW;
        const denom = Math.sqrt(varT * varF);
        const corr = denom > 0 ? cov / denom : null;
        return { rmse, mae, corr };
    };

    const computeWeightedWindMetrics = (uArr, vArr, forecast, weights, serviceMask, nx, ny) => {
        if (!uArr || !vArr || !forecast || !weights || !serviceMask) return null;
        let sumW = 0;
        let sumT = 0;
        let sumF = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const t = Math.hypot(uArr[k] ?? 0, vArr[k] ?? 0);
                const f = forecast[k] ?? 0;
                sumW += w;
                sumT += w * t;
                sumF += w * f;
            }
        }
        if (sumW <= 0) return null;
        const meanT = sumT / sumW;
        const meanF = sumF / sumW;
        let sumAbsErr = 0;
        let sumSqErr = 0;
        let cov = 0;
        let varT = 0;
        let varF = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const t = Math.hypot(uArr[k] ?? 0, vArr[k] ?? 0);
                const f = forecast[k] ?? 0;
                const err = f - t;
                sumAbsErr += w * Math.abs(err);
                sumSqErr += w * err * err;
                const dt = t - meanT;
                const df = f - meanF;
                cov += w * dt * df;
                varT += w * dt * dt;
                varF += w * df * df;
            }
        }
        const rmse = Math.sqrt(sumSqErr / sumW);
        const mae = sumAbsErr / sumW;
        const denom = Math.sqrt(varT * varF);
        const corr = denom > 0 ? cov / denom : null;
        return { rmse, mae, corr };
    };

    const computeWeightedMean = (values, weights, serviceMask, nx, ny) => {
        if (!values || !weights || !serviceMask) return null;
        let sumW = 0;
        let sum = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const v = values[k] ?? 0;
                sumW += w;
                sum += w * v;
            }
        }
        return sumW > 0 ? sum / sumW : null;
    };

    const getWarningMaskForScoring = (warning, grid) => {
        if (!warning) return null;
        if (warning._gridMask && warning._gridMaskNx === grid.nx && warning._gridMaskNy === grid.ny) {
            return warning._gridMask;
        }
        const maskResult = buildWarningGridMask(warning.polygonLatLonDeg, grid);
        if (!maskResult) return null;
        warning._gridMask = maskResult.mask;
        warning._gridMaskNx = maskResult.nx;
        warning._gridMaskNy = maskResult.ny;
        return warning._gridMask;
    };

    const clampReputation = (value) => Math.max(0, Math.min(100, value));
    const formatMoneyDelta = (delta) => {
        const sign = delta >= 0 ? '+' : '-';
        const amount = Math.round(Math.abs(delta) / 1_000_000);
        return `${sign}$${amount}M`;
    };
    const formatRepDelta = (delta) => `${delta >= 0 ? '+' : ''}${delta}`;

    const applyPlayerScoreDelta = (player, moneyDelta, repDelta) => {
        if (!player) return;
        if (Number.isFinite(moneyDelta)) {
            player.funds += moneyDelta;
        }
        if (Number.isFinite(repDelta)) {
            const next = clampReputation((player.reputation ?? 50) + repDelta);
            player.reputation = next;
        }
    };

    const getScoringMeta = (playerId, simTimeSeconds) => {
        if (!playerId) return null;
        const store = scoringMetaByPlayerIdRef.current;
        if (!store[playerId]) {
            store[playerId] = {
                hitStreak: 0,
                dayIndex: Number.isFinite(simTimeSeconds) ? Math.floor(simTimeSeconds / 86400) : 0,
                hitsToday: 0,
                dailyGoalAwardedDayIndex: null
            };
        }
        const meta = store[playerId];
        if (Number.isFinite(simTimeSeconds)) {
            const dayIndex = Math.floor(simTimeSeconds / 86400);
            if (meta.dayIndex !== dayIndex) {
                meta.dayIndex = dayIndex;
                meta.hitsToday = 0;
                meta.dailyGoalAwardedDayIndex = null;
            }
        }
        return meta;
    };

    const enqueuePostmortem = (entry) => {
        if (!entry) return;
        postmortemQueueRef.current.push(entry);
        if (!activePostmortemRef.current) {
            const next = postmortemQueueRef.current.shift() || null;
            setActivePostmortem(next);
        }
        setShowPostmortemPanel(true);
        setPostmortemQueueVersion(v => v + 1);
    };

    const nextPostmortem = () => {
        if (postmortemQueueRef.current.length > 0) {
            const next = postmortemQueueRef.current.shift();
            setActivePostmortem(next);
        } else {
            setActivePostmortem(null);
        }
        setPostmortemQueueVersion(v => v + 1);
    };

	    const clearPostmortems = () => {
	        postmortemQueueRef.current = [];
	        setActivePostmortem(null);
	        setPostmortemQueueVersion(v => v + 1);
	    };

        const getRecentForecastRuns = (playerId) => {
            const pid = playerId != null ? String(playerId) : null;
            if (!pid) return [];
            const earth = earthRef.current;
            const runs = earth?.getForecastHistory?.(pid) || [];
            return runs
                .slice()
                .sort((a, b) => (Number(b?.baseSimTimeSeconds) || 0) - (Number(a?.baseSimTimeSeconds) || 0))
                .slice(0, FORECAST_REPORT_MAX_RUNS);
        };

        const computeRunMetrics = ({ run, warnings, events, grid }) => {
            const runId = run?.runId ?? null;
            const baseSimTimeSeconds = Number(run?.baseSimTimeSeconds);
            const leadHoursList = Array.isArray(run?.leadHours) ? run.leadHours.slice() : [];
            const hazardTypes = Object.keys(HAZARD_LABELS);

            const output = {
                runId,
                baseSimTimeSeconds: Number.isFinite(baseSimTimeSeconds) ? baseSimTimeSeconds : null,
                leadHours: leadHoursList,
                byHazard: {}
            };

            if (!runId || !Number.isFinite(baseSimTimeSeconds) || !grid?.nx || !grid?.ny) {
                hazardTypes.forEach((hazardType) => {
                    output.byHazard[hazardType] = {};
                    leadHoursList.forEach((leadHours) => {
                        output.byHazard[hazardType][leadHours] = {
                            hits: 0,
                            falseAlarms: 0,
                            totalEvents: 0,
                            warnedEvents: 0,
                            misses: 0,
                            precision: 0,
                            recall: 0,
                            missRate: 0,
                            meanIoU: 0,
                            meanLeadHours: 0
                        };
                    });
                });
                return output;
            }

            const endedEvents = Array.isArray(events)
                ? events.filter(e => e && e.confirmed === true && Number.isFinite(e.endSimTimeSeconds))
                : [];
            const scoredWarnings = Array.isArray(warnings)
                ? warnings.filter(w => w && String(w.forecastRunId) === String(runId) && (w.outcome === 'hit' || w.outcome === 'falseAlarm'))
                : [];
            const warningsById = new Map(scoredWarnings.map(w => [w.id, w]));
            const windowDurationSeconds = FORECAST_REPORT_WINDOW_HOURS * 3600;

            hazardTypes.forEach((hazardType) => {
                output.byHazard[hazardType] = {};
                leadHoursList.forEach((leadHoursRaw) => {
                    const leadHours = Number(leadHoursRaw);
                    const leadKey = Number.isFinite(leadHours) ? leadHours : leadHoursRaw;
                    const warningsForBucket = scoredWarnings.filter(
                        w => w.hazardType === hazardType && Number(w.forecastLeadHours) === leadHours
                    );
                    const hits = warningsForBucket.filter(w => w.outcome === 'hit');
                    const falseAlarms = warningsForBucket.filter(w => w.outcome === 'falseAlarm');

                    const windowStart = baseSimTimeSeconds + leadHours * 3600;
                    const windowEnd = windowStart + windowDurationSeconds;
                    const eventsInWindow = endedEvents.filter((event) => {
                        if (event.hazardType !== hazardType) return false;
                        const start = event.startSimTimeSeconds;
                        const end = event.endSimTimeSeconds;
                        return start <= windowEnd && end >= windowStart;
                    });
                    const totalEvents = eventsInWindow.length;
                    const warnedEvents = eventsInWindow.reduce((count, event) => {
                        const wid = event.matchedWarningId;
                        if (!wid) return count;
                        const warning = warningsById.get(wid);
                        if (!warning) return count;
                        if (String(warning.forecastRunId) !== String(runId)) return count;
                        if (Number(warning.forecastLeadHours) !== leadHours) return count;
                        if (warning.outcome !== 'hit') return count;
                        return count + 1;
                    }, 0);
                    const misses = totalEvents - warnedEvents;

                    const hitsCount = hits.length;
                    const falseAlarmCount = falseAlarms.length;
                    const precisionDenom = hitsCount + falseAlarmCount;
                    const precision = precisionDenom > 0 ? hitsCount / precisionDenom : 0;
                    const recall = totalEvents > 0 ? warnedEvents / totalEvents : 0;
                    const missRate = totalEvents > 0 ? misses / totalEvents : 0;
                    const meanIoU = hitsCount > 0
                        ? hits.reduce((sum, w) => sum + (Number(w.iou) || 0), 0) / hitsCount
                        : 0;
                    const meanLeadHours = hitsCount > 0
                        ? hits.reduce((sum, w) => {
                            const h = Number.isFinite(w.advanceNoticeHours) ? w.advanceNoticeHours : Number(w.forecastLeadHours);
                            return sum + (Number.isFinite(h) ? h : 0);
                        }, 0) / hitsCount
                        : 0;

                    output.byHazard[hazardType][leadKey] = {
                        hits: hitsCount,
                        falseAlarms: falseAlarmCount,
                        totalEvents,
                        warnedEvents,
                        misses,
                        precision,
                        recall,
                        missRate,
                        meanIoU,
                        meanLeadHours
                    };
                });
            });

            return output;
        };

        const refreshForecastReport = (playerId) => {
            const pid = playerId != null ? String(playerId) : null;
            if (!pid) return;
            const earth = earthRef.current;
            const grid = earth?.weatherField?.core?.grid;
            if (!earth || !grid) return;

            const runs = getRecentForecastRuns(pid);
            const warnings = warningsByPlayerIdRef.current[pid] || [];
            const eventsHistory = eventsByPlayerIdRef.current[pid]?.history || [];
            const metrics = runs.map(run => computeRunMetrics({ run, warnings, events: eventsHistory, grid }));

            forecastReportByPlayerIdRef.current[pid] = metrics;
            setForecastReportVersion(v => v + 1);
        };

		const updateTruthEvents = (simTimeSeconds) => {
	        if (!Number.isFinite(simTimeSeconds)) return;
        const lastSample = lastEventSampleRef.current;
        if (Number.isFinite(lastSample) && simTimeSeconds - lastSample < EVENT_SAMPLE_INTERVAL_SECONDS) return;
        lastEventSampleRef.current = simTimeSeconds;

        const earth = earthRef.current;
        const playerId = currentPlayerRef.current?.id;
        const truthCore = earth?.weatherField?.core;
        if (!earth || !playerId || !truthCore?.ready) return;
        const grid = truthCore.grid;
        const fields = truthCore.fields;
        const serviceMask = getServiceMask(grid);
        if (!serviceMask) return;

        if (!eventsByPlayerIdRef.current[playerId]) {
            eventsByPlayerIdRef.current[playerId] = { active: [], history: [] };
        }
        const store = eventsByPlayerIdRef.current[playerId];
        const hazards = getUnlockedWarningHazards(currentPlayerRef.current);
        store.active = store.active.filter(e => hazards.includes(e.hazardType));
        store.history = store.history.filter(e => hazards.includes(e.hazardType));
	        const N = grid.nx * grid.ny;
	        const minCells = 25;
			const matchIoUMin = 0.12;
			const footprintCutoff = simTimeSeconds - EVENT_FOOTPRINT_RETENTION_SECONDS;
            let closedAnyEvent = false;

			hazards.forEach((hazardType) => {
				const maskResult = buildTruthEventMask({ hazardType, grid, fields, serviceMask });
				if (!maskResult) return;

			const { labels, components } = labelConnectedComponents(maskResult.mask, grid.nx, grid.ny, maskResult.values);
			const filtered = components.filter(c => c.cellCount >= minCells);
			const activeEvents = store.active.filter(e => e.hazardType === hazardType);
			const matchedEvents = new Set();

			filtered.forEach((component) => {
				const { mask: compMask, indices: compIndices } = extractComponentMaskAndIndices(labels, component.id, N, component.cellCount);
				let bestEvent = null;
				let bestIoU = 0;
				activeEvents.forEach((event) => {
					if (!event.lastMask) return;
					const iou = computeMaskIoU(compMask, event.lastMask);
                    if (iou > bestIoU) {
                        bestIoU = iou;
                        bestEvent = event;
                    }
                });

				if (bestEvent && bestIoU >= matchIoUMin) {
					matchedEvents.add(bestEvent.id);
					bestEvent.lastMask = compMask;
					bestEvent.lastCellCount = component.cellCount;
					bestEvent.lastSeenSimTimeSeconds = simTimeSeconds;
					if (compIndices) {
						if (!Array.isArray(bestEvent.footprintSamples)) bestEvent.footprintSamples = [];
						const sample = {
							t: simTimeSeconds,
							indices: compIndices,
							cellCount: component.cellCount,
							areaW: computeWeightedAreaFromIndices(compIndices, grid)
						};
						const samples = bestEvent.footprintSamples;
						if (samples.length > 0 && samples[samples.length - 1]?.t === simTimeSeconds) {
							samples[samples.length - 1] = sample;
						} else {
							samples.push(sample);
						}
						while (samples.length > 0 && Number.isFinite(samples[0]?.t) && samples[0].t < footprintCutoff) {
							samples.shift();
						}
					}
					if (Number.isFinite(component.maxVal) && (bestEvent.maxSeverityValue == null || component.maxVal > bestEvent.maxSeverityValue)) {
						bestEvent.maxSeverityValue = component.maxVal;
						bestEvent.maxSeverityLatLonDeg = getGridLatLonFromIndex(component.maxK, grid);
						bestEvent.maskAtPeak = compMask.slice();
						bestEvent.peakSimTimeSeconds = simTimeSeconds;
						bestEvent.cellCountAtPeak = component.cellCount;
					}
                    if (!bestEvent.confirmed && simTimeSeconds - bestEvent.startSimTimeSeconds >= MIN_EVENT_DURATION_SECONDS) {
                        bestEvent.confirmed = true;
                        const stats = computeMaskCentroid(bestEvent.maskAtPeak || compMask, grid);
                        earth.logWeatherEvent?.(
                            'truthEventStart',
                            {
                                id: bestEvent.id,
                                hazardType,
                                startSimTimeSeconds: bestEvent.startSimTimeSeconds,
                                cellCount: stats.count,
                                centroid: stats.centroid,
                                maxSeverityValue: bestEvent.maxSeverityValue,
                                maxSeverityLatLonDeg: bestEvent.maxSeverityLatLonDeg
                            },
                            { simTimeSeconds: bestEvent.startSimTimeSeconds }
                        );
                    }
                    if (bestEvent.confirmed) {
                        const stats = computeMaskCentroid(compMask, grid);
                        earth.logWeatherEvent?.(
                            'truthEventUpdate',
                            {
                                id: bestEvent.id,
                                hazardType,
                                simTimeSeconds,
                                cellCount: stats.count,
                                centroid: stats.centroid,
                                maxSeverityValue: bestEvent.maxSeverityValue,
                                maxSeverityLatLonDeg: bestEvent.maxSeverityLatLonDeg
                            },
                            { simTimeSeconds }
                        );
                    }
                    return;
                }

				const eventId = `evt-${hazardType}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
				const newEvent = {
					id: eventId,
					hazardType,
					startSimTimeSeconds: simTimeSeconds,
					lastSeenSimTimeSeconds: simTimeSeconds,
					confirmed: false,
					lastMask: compMask,
					lastCellCount: component.cellCount,
					maxSeverityValue: component.maxVal,
					maxSeverityLatLonDeg: getGridLatLonFromIndex(component.maxK, grid),
					maskAtPeak: compMask.slice(),
					peakSimTimeSeconds: simTimeSeconds,
					cellCountAtPeak: component.cellCount,
					footprintSamples: compIndices ? [{
						t: simTimeSeconds,
						indices: compIndices,
						cellCount: component.cellCount,
						areaW: computeWeightedAreaFromIndices(compIndices, grid)
					}] : [],
					endSimTimeSeconds: null
				};
				store.active.push(newEvent);
			});

            store.active = store.active.filter((event) => {
                if (event.hazardType !== hazardType) return true;
                if (matchedEvents.has(event.id)) return true;
                if (simTimeSeconds - event.lastSeenSimTimeSeconds < EVENT_GAP_SECONDS) return true;
                event.endSimTimeSeconds = event.lastSeenSimTimeSeconds;
                if (event.confirmed) {
                    const stats = computeMaskCentroid(event.maskAtPeak || event.lastMask, grid);
					let matchedWarningId = null;
					let bestIoU = 0;
					if (!event.matched) {
                        if (!hazards.includes(event.hazardType)) {
                            event.matched = true;
                            event.matchedWarningId = null;
                            event.moneyDelta = null;
                            event.repDelta = null;
                        } else {
                            const warnings = warningsByPlayerIdRef.current[playerId] || [];
                            warnings.forEach((warning) => {
                                if (warning.hazardType !== event.hazardType) return;
                                const warningMask = getWarningMaskForScoring(warning, grid);
                                if (!warningMask) return;
                                const warningArea = getWarningWeightedArea(warning, warningMask, grid);
                                const warningEnd = warning.validEndSimTimeSeconds;
                                const warningStart = warning.validStartSimTimeSeconds;
                                if (warningStart > event.endSimTimeSeconds || warningEnd < event.startSimTimeSeconds) return;
                                const overlapStart = Math.max(warningStart, event.startSimTimeSeconds);
                                const overlapEnd = Math.min(warningEnd, event.endSimTimeSeconds);
                                const iou = computeBestEventIoUInWindow(event, warningMask, warningArea, grid, overlapStart, overlapEnd);
                                if (iou > bestIoU) {
                                    bestIoU = iou;
                                    matchedWarningId = warning.id;
                                }
                            });
	                            const iouMatchMin = tuningParamsRef.current?.iouMatchMin ?? IOU_MATCH_MIN;
	                            if (bestIoU >= iouMatchMin) {
	                                event.matched = true;
	                                event.matchedWarningId = matchedWarningId;
	                            } else {
	                                const player = currentPlayerRef.current;
	                                const penaltyMoney = -(PENALTY.missMoney[event.hazardType] ?? 0);
                                const repDelta = PENALTY.missRep[event.hazardType] ?? 0;
                                applyPlayerScoreDelta(player, penaltyMoney, repDelta);
                                const meta = getScoringMeta(playerId, simTimeSeconds);
                                if (meta) {
                                    const prevStreak = meta.hitStreak ?? 0;
                                    if (prevStreak !== 0) {
                                        earth.logWeatherEvent?.(
                                            'hitStreak',
                                            { playerId, prevStreak, nextStreak: 0, streakMult: 1 },
                                            { simTimeSeconds }
                                        );
                                    }
                                    meta.hitStreak = 0;
                                }
                                event.outcome = 'miss';
                                event.moneyDelta = penaltyMoney;
                                event.repDelta = repDelta;
                                notify(
                                    'warning',
                                    `Missed event: ${event.hazardType}, ${formatMoneyDelta(penaltyMoney)}, ${formatRepDelta(repDelta)} rep`
                                );
                                const warnings = warningsByPlayerIdRef.current[playerId] || [];
                                const missClassification = classifyMissedEvent({
                                    event,
                                    warnings,
                                    grid,
                                    simTimeSeconds
                                });
                                let eventMask = event.maskAtPeak || event.lastMask || null;
                                if (!eventMask && Array.isArray(event.footprintSamples) && event.footprintSamples.length > 0) {
                                    const lastSample = event.footprintSamples[event.footprintSamples.length - 1];
                                    if (lastSample?.indices) {
                                        eventMask = makeMaskFromIndices(lastSample.indices, grid.nx * grid.ny);
                                    }
                                }
                                const eventCentroid = eventMask ? computeMaskCentroid(eventMask, grid).centroid : null;
                                const postmortemEntry = {
                                    kind: 'miss',
                                    playerId,
                                    eventId: event.id,
                                    hazardType: event.hazardType,
                                    outcome: 'miss',
                                    startSimTimeSeconds: event.startSimTimeSeconds,
                                    endSimTimeSeconds: event.endSimTimeSeconds,
                                    peakSimTimeSeconds: event.peakSimTimeSeconds ?? null,
                                    maxSeverityValue: event.maxSeverityValue ?? null,
                                    maxSeverityLatLonDeg: event.maxSeverityLatLonDeg ?? null,
                                    eventCentroid,
                                    bestOverlapSimTimeSeconds: missClassification.bestOverlapSimTimeSeconds ?? event.peakSimTimeSeconds ?? null,
                                    classification: {
                                        primaryTag: missClassification.primaryTag,
                                        detailLines: missClassification.detailLines
                                    },
                                    warningMask: missClassification.warningMask ?? null,
                                    eventMask
                                };
                                enqueuePostmortem(postmortemEntry);
                                earth.logWeatherEvent?.(
                                    'postmortem',
                                    {
                                        playerId,
                                        kind: 'miss',
                                        eventId: event.id,
                                        hazardType: event.hazardType,
                                        bestOverlapSimTimeSeconds: postmortemEntry.bestOverlapSimTimeSeconds,
                                        classificationTag: missClassification.primaryTag
                                    },
                                    { simTimeSeconds: event.endSimTimeSeconds ?? simTimeSeconds }
                                );
                            }
                        }
                    }
                    earth.logWeatherEvent?.(
                        'truthEventEnd',
                        {
                            id: event.id,
                            hazardType,
                            startSimTimeSeconds: event.startSimTimeSeconds,
                            endSimTimeSeconds: event.endSimTimeSeconds,
                            cellCount: stats.count,
                            centroid: stats.centroid,
                            maxSeverityValue: event.maxSeverityValue,
                            maxSeverityLatLonDeg: event.maxSeverityLatLonDeg,
                            matchedWarningId: event.matchedWarningId ?? null,
                            missed: event.outcome === 'miss',
                            moneyDelta: event.moneyDelta ?? null,
                            repDelta: event.repDelta ?? null
                        },
                        { simTimeSeconds: event.endSimTimeSeconds }
	                    );
	                }
					store.history.push(event);
                    closedAnyEvent = true;
					return false;
				});
			});

			if (Array.isArray(store.history) && store.history.length > 0) {
			const historyCutoff = simTimeSeconds - EVENT_HISTORY_RETENTION_SECONDS;
			store.history = store.history.filter((event) => {
				const tEnd = event.endSimTimeSeconds ?? event.lastSeenSimTimeSeconds;
				return !Number.isFinite(tEnd) || tEnd >= historyCutoff;
				});
			}
            if (closedAnyEvent) {
                refreshForecastReport(playerId);
            }
		};

    const updateForecastSkillTelemetry = () => {
        const earth = earthRef.current;
        const playerId = currentPlayerRef.current?.id;
        const truthCore = earth?.weatherField?.core;
        if (!earth || !playerId || !truthCore?.ready) return;
        const truthTimeSeconds = truthCore.timeUTC;
        if (!Number.isFinite(truthTimeSeconds)) return;
        const grid = truthCore.grid;
        const fields = truthCore.fields;
        if (!grid || !fields) return;
        const serviceMask = getServiceMask(grid);
        if (!serviceMask || serviceMask.length !== grid.nx * grid.ny) return;
        const weights = getAreaWeights(grid);
        if (!weights) return;

        let serviceCellCount = 0;
        for (let k = 0; k < serviceMask.length; k++) {
            if (serviceMask[k] === 1) serviceCellCount += 1;
        }
        if (serviceCellCount === 0) return;

        const history = earth.getForecastHistory?.(playerId) ?? [];
        if (!history.length) return;
        const summaries = forecastSkillSummaryRef.current;

        history.forEach((run) => {
            if (!run?.products || !run?.leadHours) return;
            const runId = run.runId;
            if (!runId) return;
            if (!summaries[runId]) {
                summaries[runId] = {
                    runId,
                    playerId: run.playerId,
                    baseSimTimeSeconds: run.baseSimTimeSeconds,
                    leads: {}
                };
            }
            const summary = summaries[runId];
            const leadList = Array.isArray(run.leadHours) ? run.leadHours : [];
            leadList.forEach((leadHours) => {
                const verifyTimeSeconds = run.baseSimTimeSeconds + leadHours * 3600;
                if (truthTimeSeconds < verifyTimeSeconds) return;
                run._skillVerifiedByLead = run._skillVerifiedByLead || {};
                if (run._skillVerifiedByLead[leadHours]) return;
                const leadIdx = run.leadHours.indexOf(leadHours);
                if (leadIdx < 0) return;

                const precipForecast = run.products.precipRateByLead?.[leadIdx];
                const windForecast = run.products.windSpeedByLead?.[leadIdx];
                const confForecast = run.products.confidenceByLead?.[leadIdx];
                if (!precipForecast || !windForecast || !confForecast) return;

                const precipMetrics = computeWeightedMetrics(
                    fields.precipRate,
                    precipForecast,
                    weights,
                    serviceMask,
                    grid.nx,
                    grid.ny
                );
                const windMetrics = computeWeightedWindMetrics(
                    fields.u,
                    fields.v,
                    windForecast,
                    weights,
                    serviceMask,
                    grid.nx,
                    grid.ny
                );
                const confidenceMean = computeWeightedMean(
                    confForecast,
                    weights,
                    serviceMask,
                    grid.nx,
                    grid.ny
                );
                if (!precipMetrics || !windMetrics) return;
                const skillPrecip01 = Math.max(0, Math.min(1, 1 - (precipMetrics.rmse - 0.06) / (0.22 - 0.06)));
                const skillWind01 = Math.max(0, Math.min(1, 1 - (windMetrics.rmse - 3.0) / (10.0 - 3.0)));
                const skillCombined01 = 0.6 * skillPrecip01 + 0.4 * skillWind01;
                const confMeanSafe = Math.max(0.15, Number.isFinite(confidenceMean) ? confidenceMean : 0);
                const targetScale = Math.max(0.5, Math.min(1.5, skillCombined01 / confMeanSafe));
                earth.updateConfidenceCalibration?.({ playerId: run.playerId, leadHours, targetScale });

                const payload = {
                    forecastRunId: runId,
                    playerId: run.playerId,
                    leadHours,
                    verifyTimeSeconds,
                    truthTimeSeconds,
                    serviceAreaCellCount: serviceCellCount,
                    precip: precipMetrics,
                    wind: windMetrics,
                    confidenceMean,
                    confidenceTargetScale: targetScale
                };
                earth.logWeatherEvent?.('forecastSkill', payload, { simTimeSeconds: truthTimeSeconds });

                summary.leads[leadHours] = {
                    verifyTimeSeconds,
                    truthTimeSeconds,
                    serviceAreaCellCount: serviceCellCount,
                    precip: precipMetrics,
                    wind: windMetrics,
                    confidenceMean
                };
                run._skillVerifiedByLead[leadHours] = true;
            });

            const allVerified = leadList.length > 0 && leadList.every((h) => run._skillVerifiedByLead?.[h]);
            if (allVerified && !summary.logged) {
                earth.logWeatherEvent?.(
                    'forecastSkillSummary',
                    {
                        forecastRunId: runId,
                        playerId: run.playerId,
                        baseSimTimeSeconds: run.baseSimTimeSeconds,
                        leadHours: leadList,
                        leads: summary.leads
                    },
                    { simTimeSeconds: truthTimeSeconds }
                );
                summary.logged = true;
            }
        });
    };

    const unwrapLonDeg = (lonDeg, refLonDeg) => {
        let v = lonDeg;
        while (v - refLonDeg > 180) v -= 360;
        while (v - refLonDeg < -180) v += 360;
        return v;
    };

    const unwrapPolygon = (polygon, refLonDeg) => polygon.map((p) => ({
        latDeg: p.latDeg,
        lonDeg: unwrapLonDeg(p.lonDeg, refLonDeg)
    }));

    const pointInPolygon = (latDeg, lonDeg, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const yi = polygon[i].latDeg;
            const xi = polygon[i].lonDeg;
            const yj = polygon[j].latDeg;
            const xj = polygon[j].lonDeg;
            const intersect = ((yi > latDeg) !== (yj > latDeg))
                && (lonDeg < (xj - xi) * (latDeg - yi) / Math.max(1e-6, (yj - yi)) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const polygonBBoxArea = (polygon) => {
        if (!polygon || polygon.length === 0) return Infinity;
        let minLat = 90;
        let maxLat = -90;
        let minLon = 180;
        let maxLon = -180;
        polygon.forEach((p) => {
            if (p.latDeg < minLat) minLat = p.latDeg;
            if (p.latDeg > maxLat) maxLat = p.latDeg;
            if (p.lonDeg < minLon) minLon = p.lonDeg;
            if (p.lonDeg > maxLon) maxLon = p.lonDeg;
        });
        return Math.max(0, maxLat - minLat) * Math.max(0, maxLon - minLon);
    };

    const findWarningAtPoint = (latDeg, lonDeg, warnings) => {
        if (!Array.isArray(warnings) || warnings.length === 0) return null;
        let best = null;
        warnings.forEach((warning) => {
            if (!Array.isArray(warning.polygonLatLonDeg) || warning.polygonLatLonDeg.length < 3) return;
            const refLon = warning.polygonLatLonDeg[0]?.lonDeg ?? 0;
            const polygon = unwrapPolygon(warning.polygonLatLonDeg, refLon);
            const lon = unwrapLonDeg(lonDeg, refLon);
            if (!pointInPolygon(latDeg, lon, polygon)) return;
            const area = polygonBBoxArea(polygon);
            if (!best || area < best.area) {
                best = { warning, area };
            }
        });
        return best ? best.warning : null;
    };

    const buildWarningGridMask = (polygonLatLonDeg, grid) => {
        if (!Array.isArray(polygonLatLonDeg) || polygonLatLonDeg.length < 3) return null;
        if (!grid?.nx || !grid?.ny) return null;
        const { nx, ny, latDeg, lonDeg } = grid;
        const N = nx * ny;
        const mask = new Uint8Array(N);
        const refLon = polygonLatLonDeg[0]?.lonDeg ?? 0;
        const polygon = unwrapPolygon(polygonLatLonDeg, refLon);
        for (let j = 0; j < ny; j++) {
            const lat = latDeg ? latDeg[j] : 90 - (j + 0.5) * (180 / ny);
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const lon = lonDeg ? lonDeg[i] : -180 + (i + 0.5) * (360 / nx);
                const lonUnwrapped = unwrapLonDeg(lon, refLon);
                if (pointInPolygon(lat, lonUnwrapped, polygon)) {
                    mask[row + i] = 1;
                }
            }
        }
        return { mask, nx, ny };
    };

    const getVisibleWarningsForPlayer = (playerId) => {
        if (!playerId) return [];
        const list = warningsByPlayerIdRef.current[playerId] || [];
        return list.filter(w => !w.outcome);
    };

    const sampleWarningMax = (warning, truthCore) => {
        const grid = truthCore?.grid;
        const fields = truthCore?.fields;
        if (!grid || !fields) return null;
        if (!Array.isArray(warning.polygonLatLonDeg) || warning.polygonLatLonDeg.length < 3) return null;
        const { nx, ny, latDeg, lonDeg } = grid;
        if (!nx || !ny || !latDeg || !lonDeg) return null;
        const refLon = warning.polygonLatLonDeg[0]?.lonDeg ?? 0;
        const polygon = unwrapPolygon(warning.polygonLatLonDeg, refLon);

        const precip = fields.precipRate;
        const u = fields.u;
        const v = fields.v;
        let maxVal = 0;

        for (let j = 0; j < ny; j++) {
            const lat = latDeg[j];
            const rowOffset = j * nx;
            for (let i = 0; i < nx; i++) {
                const lon = unwrapLonDeg(lonDeg[i], refLon);
                if (!pointInPolygon(lat, lon, polygon)) continue;
                const k = rowOffset + i;
                let val = 0;
                if (warning.hazardType === 'heavyPrecip' || warning.hazardType === 'severeStormRisk') {
                    val = precip ? precip[k] : 0;
                } else if (warning.hazardType === 'highWinds') {
                    const uVal = u ? u[k] : 0;
                    const vVal = v ? v[k] : 0;
                    val = Math.hypot(uVal, vVal);
                }
                if (val > maxVal) maxVal = val;
            }
        }
        return maxVal;
    };

	const evaluateWarnings = (simTimeSeconds) => {
        const player = currentPlayerRef.current;
        const playerId = player?.id;
        if (!playerId) return;
        const scoringMeta = getScoringMeta(playerId, simTimeSeconds);
        const warnings = warningsByPlayerIdRef.current[playerId];
        if (!warnings || warnings.length === 0) return;
        const truthCore = earthRef.current?.weatherField?.core;
        if (!truthCore?.ready) return;
        const grid = truthCore.grid;
        const store = eventsByPlayerIdRef.current[playerId];
        const allEvents = store ? [...store.active, ...store.history] : [];

        let changed = false;
		const nextWarnings = warnings.map((warning) => {
            if (warning.outcome) return warning;
            if (!Number.isFinite(simTimeSeconds)) return warning;
            if (simTimeSeconds < warning.validEndSimTimeSeconds) return warning;
            let warningMask = warning._gridMask;
            if (!warningMask || warning._gridMaskNx !== grid.nx || warning._gridMaskNy !== grid.ny) {
                const maskResult = buildWarningGridMask(warning.polygonLatLonDeg, grid);
                if (maskResult) {
                    warningMask = maskResult.mask;
                    warning._gridMask = maskResult.mask;
                    warning._gridMaskNx = maskResult.nx;
                    warning._gridMaskNy = maskResult.ny;
                }
            }
			if (!warningMask) return warning;
			const warningArea = getWarningWeightedArea(warning, warningMask, grid);

			const candidates = allEvents.filter((event) => {
				if (!event.confirmed) return false;
				if (event.hazardType !== warning.hazardType) return false;
                const eventEnd = event.endSimTimeSeconds ?? simTimeSeconds;
                return event.startSimTimeSeconds <= warning.validEndSimTimeSeconds
                    && eventEnd >= warning.validStartSimTimeSeconds;
            });

			let bestIoU = 0;
			let bestEvent = null;
			candidates.forEach((event) => {
				const eventEnd = event.endSimTimeSeconds ?? simTimeSeconds;
				const overlapStart = Math.max(warning.validStartSimTimeSeconds, event.startSimTimeSeconds);
				const overlapEnd = Math.min(warning.validEndSimTimeSeconds, eventEnd);
				if (overlapEnd < overlapStart) return;
				const iou = computeBestEventIoUInWindow(event, warningMask, warningArea, grid, overlapStart, overlapEnd);
				if (iou > bestIoU) {
					bestIoU = iou;
					bestEvent = event;
				}
			});

            const advanceNoticeHours = Math.max(
                0,
                (warning.validStartSimTimeSeconds - warning.issuedAtSimTimeSeconds) / 3600
            );
            const noticeFactor = Math.max(0, Math.min(1, advanceNoticeHours / 12));
            const iouFactor = Math.max(0, Math.min(1, bestIoU));

            let next = warning;
            let postmortemEntry = null;
	            const iouMatchMin = tuningParamsRef.current?.iouMatchMin ?? IOU_MATCH_MIN;
	            if (bestEvent && bestIoU >= iouMatchMin) {
	                const base = PAYOUT.hitBase[warning.hazardType] ?? 0;
	                let areaFracService = warning.areaFracService;
	                let meanConfidence = warning.meanConfidence;
                if (!Number.isFinite(areaFracService) || !Number.isFinite(meanConfidence)) {
                    const weights = getAreaWeights(grid);
                    const serviceMask = getServiceMask(grid);
                    if (weights && serviceMask) {
                        if (!Number.isFinite(areaFracService)) {
                            areaFracService = computeWarningAreaFracService(
                                warningMask,
                                grid,
                                serviceMask,
                                weights
                            );
                        }
                        if (!Number.isFinite(meanConfidence)) {
                            const leadHours = warning.forecastLeadHours;
                            const latestForecast = earthRef.current?.latestForecastByPlayerId?.get(String(playerId));
                            const leadIdx = latestForecast?.leadHours?.indexOf(leadHours) ?? -1;
                            const confValues = leadIdx >= 0 ? latestForecast?.products?.confidenceByLead?.[leadIdx] : null;
                            if (confValues) {
                                meanConfidence = computeMeanConfidenceInWarning(
                                    confValues,
                                    warningMask,
                                    grid,
                                    serviceMask,
                                    weights
                                );
                            }
                        }
                    }
	                }
	                const confValue = Number.isFinite(meanConfidence) ? meanConfidence : 0;
	                const areaValue = Number.isFinite(areaFracService) ? areaFracService : PRECISION_AREA_NONE_FRAC;
	                const confidenceTuning = tuningParamsRef.current?.confidence || {};
	                const precisionBonusMax = Number.isFinite(confidenceTuning.precisionBonusMax)
	                    ? confidenceTuning.precisionBonusMax
	                    : PRECISION_BONUS_MAX;
	                const precisionConfStart = Number.isFinite(confidenceTuning.precisionConfStart)
	                    ? confidenceTuning.precisionConfStart
	                    : PRECISION_CONF_START;
	                const precisionConfFull = Number.isFinite(confidenceTuning.precisionConfFull)
	                    ? confidenceTuning.precisionConfFull
	                    : PRECISION_CONF_FULL;
	                const confSpan = precisionConfFull - precisionConfStart;
	                const confFactor = Math.max(
	                    0,
	                    Math.min(1, confSpan > 0 ? (confValue - precisionConfStart) / confSpan : 0)
	                );
	                const areaFactor = Math.max(
	                    0,
	                    Math.min(1, (PRECISION_AREA_NONE_FRAC - areaValue) / (PRECISION_AREA_NONE_FRAC - PRECISION_AREA_FULL_FRAC))
	                );
	                const precisionMult = 1 + precisionBonusMax * confFactor * areaFactor;
	                let streakMult = 1;
                let nextStreak = scoringMeta?.hitStreak ?? 0;
                if (scoringMeta) {
                    const prevStreak = scoringMeta.hitStreak ?? 0;
                    nextStreak = prevStreak + 1;
                    streakMult = 1 + Math.min(STREAK_BONUS_PER_HIT * Math.max(0, nextStreak - 1), STREAK_BONUS_CAP);
                    scoringMeta.hitStreak = nextStreak;
                    earthRef.current?.logWeatherEvent?.(
                        'hitStreak',
                        { playerId, prevStreak, nextStreak, streakMult },
                        { simTimeSeconds }
                    );
                }
                const payout = base * Math.pow(iouFactor, 1.2) * (0.6 + 0.4 * noticeFactor) * precisionMult * streakMult;
                const repBase = HIT_REP_BASE[warning.hazardType] ?? 2;
                const repDelta = Math.round(repBase * iouFactor * (0.6 + 0.4 * noticeFactor));
                applyPlayerScoreDelta(player, payout, repDelta);
                if (scoringMeta) {
                    scoringMeta.hitsToday += 1;
                    if (scoringMeta.hitsToday >= DAILY_GOAL_HITS && scoringMeta.dailyGoalAwardedDayIndex !== scoringMeta.dayIndex) {
                        applyPlayerScoreDelta(player, 0, DAILY_GOAL_REP_BONUS);
                        scoringMeta.dailyGoalAwardedDayIndex = scoringMeta.dayIndex;
                        notify('success', `Daily goal achieved: ${DAILY_GOAL_HITS} hits today (+${DAILY_GOAL_REP_BONUS} rep).`);
                        earthRef.current?.logWeatherEvent?.(
                            'dailyGoalAchieved',
                            { playerId, dayIndex: scoringMeta.dayIndex, repBonus: DAILY_GOAL_REP_BONUS },
                            { simTimeSeconds }
                        );
                    }
                }
                bestEvent.matched = true;
                next = {
                    ...warning,
                    outcome: 'hit',
                    matchedEventId: bestEvent.id,
                    iou: bestIoU,
                    advanceNoticeHours,
                    moneyDelta: payout,
                    repDelta,
                    hitStreak: nextStreak,
                    streakMultiplier: streakMult,
                    areaFracService: Number.isFinite(areaFracService) ? areaFracService : null,
                    meanConfidence: Number.isFinite(meanConfidence) ? meanConfidence : null,
                    precisionMultiplier: precisionMult,
                    evaluatedAtSimTimeSeconds: simTimeSeconds
                };
                notify(
                    'success',
                    `Hit: ${warning.hazardType}, ${formatHoursLabel(Math.round(advanceNoticeHours))}, ${formatMoneyDelta(payout)}, ${formatRepDelta(repDelta)} rep, precision x${precisionMult.toFixed(2)}`
                );
                const classification = (() => {
                    const areaValueSafe = Number.isFinite(areaFracService) ? areaFracService : null;
                    if (Number.isFinite(areaValueSafe) && areaValueSafe >= TOO_BROAD_AREA_FRAC) {
                        return {
                            primaryTag: 'tooBroad',
                            detailLines: [`Covered ${Math.round(areaValueSafe * 100)}% of service area; smaller polygons score better.`]
                        };
                    }
                    return { primaryTag: null, detailLines: ['Clean hit.'] };
                })();
                const overlapStart = Math.max(warning.validStartSimTimeSeconds, bestEvent.startSimTimeSeconds);
                const overlapEnd = Math.min(warning.validEndSimTimeSeconds, bestEvent.endSimTimeSeconds ?? simTimeSeconds);
                const overlapDetail = computeBestEventOverlapInWindowDetailed(
                    bestEvent,
                    warningMask,
                    warningArea,
                    grid,
                    overlapStart,
                    overlapEnd
                );
                const eventMask = overlapDetail.bestMaskFallback
                    || (overlapDetail.bestIndices ? makeMaskFromIndices(overlapDetail.bestIndices, grid.nx * grid.ny) : null)
                    || bestEvent.maskAtPeak
                    || bestEvent.lastMask
                    || null;
                const eventCentroid = eventMask ? computeMaskCentroid(eventMask, grid).centroid : null;
                postmortemEntry = {
                    kind: 'warning',
                    playerId,
                    warningId: next.id,
                    hazardType: next.hazardType,
                    outcome: next.outcome,
                    issuedAtSimTimeSeconds: warning.issuedAtSimTimeSeconds,
                    validStartSimTimeSeconds: warning.validStartSimTimeSeconds,
                    validEndSimTimeSeconds: warning.validEndSimTimeSeconds,
                    forecastLeadHours: warning.forecastLeadHours,
                    iou: next.iou,
                    moneyDelta: next.moneyDelta,
                    repDelta: next.repDelta,
                    areaFracService: next.areaFracService ?? null,
                    meanConfidence: next.meanConfidence ?? null,
                    hitStreak: next.hitStreak ?? null,
                    streakMultiplier: next.streakMultiplier ?? null,
                    eventId: bestEvent.id,
                    eventHazardType: bestEvent.hazardType,
                    bestOverlapSimTimeSeconds: overlapDetail.bestSimTimeSeconds ?? bestEvent.peakSimTimeSeconds ?? null,
                    bestIoU: overlapDetail.bestIoU ?? null,
                    eventMaxSeverityValue: bestEvent.maxSeverityValue ?? null,
                    eventMaxSeverityLatLonDeg: bestEvent.maxSeverityLatLonDeg ?? null,
                    eventCentroid,
                    classification,
                    warningMask,
                    eventMask,
                    eventIndices: overlapDetail.bestIndices ?? null
                };
            } else {
                const penaltyMoney = -(PENALTY.falseAlarmMoney[warning.hazardType] ?? 0);
                const repDelta = PENALTY.falseAlarmRep[warning.hazardType] ?? 0;
                applyPlayerScoreDelta(player, penaltyMoney, repDelta);
                if (scoringMeta) {
                    const prevStreak = scoringMeta.hitStreak ?? 0;
                    if (prevStreak !== 0) {
                        scoringMeta.hitStreak = 0;
                        earthRef.current?.logWeatherEvent?.(
                            'hitStreak',
                            { playerId, prevStreak, nextStreak: 0, streakMult: 1 },
                            { simTimeSeconds }
                        );
                    }
                    scoringMeta.hitStreak = 0;
                }
                next = {
                    ...warning,
                    outcome: 'falseAlarm',
                    iou: bestIoU,
                    advanceNoticeHours,
                    moneyDelta: penaltyMoney,
                    repDelta,
                    evaluatedAtSimTimeSeconds: simTimeSeconds
                };
                notify(
                    'warning',
                    `False alarm: ${warning.hazardType}, ${formatMoneyDelta(penaltyMoney)}, ${formatRepDelta(repDelta)} rep`
                );
                const classification = classifyFalseAlarm({
                    warning,
                    warningMask,
                    warningArea,
                    grid,
                    allEvents,
                    simTimeSeconds,
                    bestOverlapEvent: bestEvent,
                    bestOverlapIoU: bestIoU
                });
                const altEvent = classification.bestEvent ?? null;
                let overlapDetail = classification.bestOverlap ?? null;
                if (altEvent && !overlapDetail) {
                    const altEventEnd = altEvent.endSimTimeSeconds ?? simTimeSeconds;
                    const overlapStart = Math.max(warning.validStartSimTimeSeconds, altEvent.startSimTimeSeconds);
                    const overlapEnd = Math.min(warning.validEndSimTimeSeconds, altEventEnd);
                    overlapDetail = computeBestEventOverlapInWindowDetailed(
                        altEvent,
                        warningMask,
                        warningArea,
                        grid,
                        overlapStart,
                        overlapEnd
                    );
                }
                const eventMask = overlapDetail?.bestMaskFallback
                    || (overlapDetail?.bestIndices ? makeMaskFromIndices(overlapDetail.bestIndices, grid.nx * grid.ny) : null)
                    || altEvent?.maskAtPeak
                    || altEvent?.lastMask
                    || null;
                const eventCentroid = eventMask ? computeMaskCentroid(eventMask, grid).centroid : null;
                postmortemEntry = {
                    kind: 'warning',
                    playerId,
                    warningId: next.id,
                    hazardType: next.hazardType,
                    outcome: next.outcome,
                    issuedAtSimTimeSeconds: warning.issuedAtSimTimeSeconds,
                    validStartSimTimeSeconds: warning.validStartSimTimeSeconds,
                    validEndSimTimeSeconds: warning.validEndSimTimeSeconds,
                    forecastLeadHours: warning.forecastLeadHours,
                    iou: next.iou,
                    moneyDelta: next.moneyDelta,
                    repDelta: next.repDelta,
                    areaFracService: warning.areaFracService ?? null,
                    meanConfidence: warning.meanConfidence ?? null,
                    eventId: altEvent?.id ?? null,
                    eventHazardType: altEvent?.hazardType ?? null,
                    bestOverlapSimTimeSeconds: overlapDetail?.bestSimTimeSeconds ?? null,
                    bestIoU: overlapDetail?.bestIoU ?? null,
                    eventMaxSeverityValue: altEvent?.maxSeverityValue ?? null,
                    eventMaxSeverityLatLonDeg: altEvent?.maxSeverityLatLonDeg ?? null,
                    eventCentroid,
                    classification: {
                        primaryTag: classification.primaryTag,
                        detailLines: classification.detailLines
                    },
                    warningMask,
                    eventMask,
                    eventIndices: overlapDetail?.bestIndices ?? null
                };
            }

            earthRef.current?.logWeatherEvent?.(
                'warningScored',
                {
                    warningId: next.id,
                    playerId,
                    hazardType: next.hazardType,
                    outcome: next.outcome,
                    iou: next.iou,
                    matchedEventId: next.matchedEventId ?? null,
                    advanceNoticeHours,
                    moneyDelta: next.moneyDelta,
                    repDelta: next.repDelta,
                    meanConfidence: next.meanConfidence ?? null,
                    areaFracService: next.areaFracService ?? null,
                    precisionMultiplier: next.precisionMultiplier ?? null
                },
                { simTimeSeconds }
            );
            if (postmortemEntry) {
                enqueuePostmortem(postmortemEntry);
                earthRef.current?.logWeatherEvent?.(
                    'postmortem',
                    {
                        playerId,
                        kind: 'warning',
                        warningId: next.id,
                        outcome: next.outcome,
                        hazardType: next.hazardType,
                        bestOverlapSimTimeSeconds: postmortemEntry.bestOverlapSimTimeSeconds ?? null,
                        iou: next.iou,
                        classificationTag: postmortemEntry.classification?.primaryTag ?? null
                    },
                    { simTimeSeconds }
                );
            }
            changed = true;
            return next;
        });

	        if (changed) {
	            setWarningsByPlayerId(prev => ({
	                ...prev,
	                [playerId]: nextWarnings
	            }));
	            warningsByPlayerIdRef.current = {
	                ...warningsByPlayerIdRef.current,
	                [playerId]: nextWarnings
	            };
                refreshForecastReport(playerId);
	        }
	    };

	useEffect(() => {
		const focus = warningOverlayFocusRef.current;
		const playerId = activePlayerId;
		if (!playerId) return;
		const warnings = warningsByPlayerId[playerId] || [];
		const visibleWarnings = warnings.filter(w => !w.outcome);
		if (focus.lastWarningId) {
			const stillVisible = visibleWarnings.some(w => w.id === focus.lastWarningId);
			if (!stillVisible) {
				focus.lastWarningId = null;
				setFocusedWarningInfo(null);
			}
		}
		if (focus.activeHazardType && showForecastOverlayRef.current) {
			const hasToggle = visibleWarnings.some(w => w.hazardType === focus.activeHazardType);
			if (!hasToggle) {
				focus.activeHazardType = null;
				setShowForecastOverlay(false);
			}
		}
	}, [warningsByPlayerId, activePlayerId, gameMode]);

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

    const syncSatCommLines = (sat, segments) => {
        const scene = sceneRef.current;
        if (!scene || !sat) return;
        if (!(sat.commLineMap instanceof Map)) {
            sat.commLineMap = new Map();
        }
        const keep = new Set();
        segments.forEach(({ key, startPos, endPos, color = 0xff00ff }) => {
            keep.add(key);
            let line = sat.commLineMap.get(key);
            if (!line) {
                const positions = new Float32Array(6);
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const material = new THREE.LineBasicMaterial({ color });
                line = new THREE.Line(geometry, material);
                line.frustumCulled = false;
                sat.commLineMap.set(key, line);
                scene.add(line);
            }
            const attr = line.geometry.getAttribute('position');
            const arr = attr.array;
            arr[0] = startPos.x; arr[1] = startPos.y; arr[2] = startPos.z;
            arr[3] = endPos.x; arr[4] = endPos.y; arr[5] = endPos.z;
            attr.needsUpdate = true;
            if (line.parent !== scene) scene.add(line);
        });

        for (const [key, line] of sat.commLineMap.entries()) {
            if (keep.has(key)) continue;
            if (line.parent === scene) scene.remove(line);
            line.geometry?.dispose?.();
            line.material?.dispose?.();
            sat.commLineMap.delete(key);
        }
        sat.commLines = Array.from(sat.commLineMap.values());
    };

    const drawCommLines = (sat /*, targets (unused) */) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const segments = [];
        const tmpA = new THREE.Vector3();
        const tmpB = new THREE.Vector3();

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

                const aPos = a.sphere ? a.sphere.getWorldPosition(tmpA.clone()) : a.mesh.getWorldPosition(tmpA.clone());
                const bPos = b.sphere ? b.sphere.getWorldPosition(tmpB.clone()) : b.mesh.getWorldPosition(tmpB.clone());
                segments.push({
                    key: `path:${pathIds[i]}->${pathIds[i + 1]}`,
                    startPos: aPos,
                    endPos: bPos
                });
            }

            syncSatCommLines(sat, segments);

            return; // imaging handled fully
        }

        // ---- COMM: draw neighbor edges (network view) ----
        const targets = Array.from(sat.neighbors)
            .map(id => byId(id))
            .filter(Boolean);

        targets.forEach(target => {
            const startPos = sat.mesh.getWorldPosition(tmpA.clone());
            const endPos = target.type === 'HQ'
                ? target.sphere.getWorldPosition(tmpB.clone())
                : target.mesh.getWorldPosition(tmpB.clone());
            segments.push({
                key: `edge:${target.id}`,
                startPos,
                endPos
            });
        });

        syncSatCommLines(sat, segments);
    };

    const wrapRadToPi = (rad) => {
        const twoPi = Math.PI * 2;
        let v = ((rad + Math.PI) % twoPi + twoPi) % twoPi;
        return v - Math.PI;
    };

    // Animation loop
    useEffect(() => {
        let rafId = null;
        let stopped = false;
        const animate = () => {
            if (stopped || !rendererRef.current) return;
            rafId = requestAnimationFrame(animate);

            const nowMs = performance.now();
            if (lastFrameMsRef.current === null) {
                lastFrameMsRef.current = nowMs;
            }
            const rawDtSeconds = (nowMs - lastFrameMsRef.current) / 1000;
            const realDtSeconds = Math.max(0, Math.min(rawDtSeconds, 0.1));
            lastFrameMsRef.current = nowMs;

            const simClock = simClockRef.current;
            let simAccumSeconds = simAccumSecondsRef.current;
            const visibleSimTimeSeconds = simClock.simTimeSeconds + simAccumSeconds;
            const workerSyncStatus = earthRef.current?.getWeatherWorkerSyncStatus?.(visibleSimTimeSeconds);
            let workerLeadSeconds = Number.isFinite(workerSyncStatus?.leadSeconds)
                ? workerSyncStatus.leadSeconds
                : null;
            const takeBudgetedAdvance = (requestedSeconds) => {
                if (!Number.isFinite(requestedSeconds) || requestedSeconds <= 0) return 0;
                if (!Number.isFinite(workerLeadSeconds)) return requestedSeconds;
                const allowedSeconds = clampSimAdvanceByTruthBudget(
                    requestedSeconds,
                    workerLeadSeconds,
                    TRUTH_WORKER_DESYNC_BUDGET_SECONDS
                );
                workerLeadSeconds += allowedSeconds;
                return allowedSeconds;
            };
            if (!simClock.paused) {
                simAccumSeconds += takeBudgetedAdvance(realDtSeconds * simClock.simSpeed);
            }
            const queuedAdvance = simAdvanceQueueSecondsRef.current;
            if (queuedAdvance > 0) {
                const allowedQueuedAdvance = takeBudgetedAdvance(queuedAdvance);
                simAccumSeconds += allowedQueuedAdvance;
                simAdvanceQueueSecondsRef.current = Math.max(0, queuedAdvance - allowedQueuedAdvance);
                simBurstActiveRef.current = true;
            }

            const stepsAvailable = Math.floor(simAccumSeconds / FIXED_SIM_STEP_SECONDS);
            const useBurst = simBurstActiveRef.current && simAccumSeconds >= FIXED_SIM_STEP_SECONDS;
            const maxSteps = useBurst ? MAX_SIM_SUBSTEPS_BURST : MAX_SIM_SUBSTEPS;
            const stepsToRun = Math.min(stepsAvailable, maxSteps);
            const stepsSkipped = Math.max(0, stepsAvailable - stepsToRun);
            simAccumSecondsRef.current = simAccumSeconds;
            if (simAccumSeconds < FIXED_SIM_STEP_SECONDS * 0.5) {
                simBurstActiveRef.current = false;
            }
            let simLagSeconds = simAccumSeconds;

            const deltaSimSeconds = stepsToRun * FIXED_SIM_STEP_SECONDS;
            let detectedSpheres = [];
            let lastSensorGating = null;
            let lastSimTimeSeconds = simClock.simTimeSeconds;

            if (deltaSimSeconds > 0) {
                simAccumSeconds -= deltaSimSeconds;
                simAccumSecondsRef.current = simAccumSeconds;
                simLagSeconds = simAccumSeconds;
                simClock.stepSeconds(deltaSimSeconds);
                lastSimTimeSeconds = simClock.simTimeSeconds;
            }

            const renderSimTimeSeconds = simClock.simTimeSeconds + simAccumSeconds;
            const didAdvanceSim = deltaSimSeconds > 0;
            if (earthRef.current) {
                earthRef.current.setRotationForSimTime?.(renderSimTimeSeconds);
            }
            if (didAdvanceSim) {
                satellitesRef.current.forEach(satellite => {
                    const detections = satellite.updateOrbit(
                        hqSpheresRef,
                        currentPlayerRef,
                        satellitesRef.current,
                        deltaSimSeconds
                    );
                    detectedSpheres = detectedSpheres.concat(detections);
                });
            }
            if (earthRef.current) {
                const earth = earthRef.current;
                const sensorGating = didAdvanceSim || !lastSensorGatingRef.current
                    ? buildSensorGating(lastSimTimeSeconds)
                    : lastSensorGatingRef.current;
                if (sensorGating) {
                    lastSensorGatingRef.current = sensorGating;
                }
                lastSensorGating = sensorGating;
                earth.update(lastSimTimeSeconds, realDtSeconds, {
                    simSpeed: simClock.simSpeed,
                    paused: simClock.paused,
                    sensorGating,
                    simStepsThisFrame: stepsToRun,
                    simStepsSkipped: stepsSkipped,
                    simLagSeconds,
                    flushAssimilation: didAdvanceSim,
                    renderSimTimeSeconds
                });
            }

            const directionalLight = directionalLightRef.current;
            if (directionalLight) {
                const dayOfYear = (((renderSimTimeSeconds / 86400) % 365) + 365) % 365;
                const decl = solarDeclination(dayOfYear);
                const sunDir = sunDirRef.current;
                sunDir.set(Math.cos(decl), Math.sin(decl), 0).normalize();
                directionalLight.position.copy(sunDir).multiplyScalar(100000);
            }

            if (earthRef.current) {
                applyCloudIntelVisibility(lastSensorGating);
                const earth = earthRef.current;
                if (cloudWatchDebugRef.current) {
                    const entries = lastSensorGating?.cloudWatchDebugEntries ?? [];
                    earth.setCloudWatchDebugMarkers?.(entries);
                    const nowMs = performance.now();
                    if (nowMs - cloudWatchDebugInfoRef.current.lastUpdateMs > 500) {
                        cloudWatchDebugInfoRef.current.lastUpdateMs = nowMs;
                        const uiEntries = entries.map((entry) => ({
                            satId: entry.satId,
                            footprintLatDeg: Number.isFinite(entry.footprintLatRad)
                                ? THREE.MathUtils.radToDeg(entry.footprintLatRad)
                                : null,
                            footprintLonDeg: Number.isFinite(entry.footprintLonRad)
                                ? THREE.MathUtils.radToDeg(entry.footprintLonRad)
                                : null,
                            subpointLatDeg: Number.isFinite(entry.subpointLatRad)
                                ? THREE.MathUtils.radToDeg(entry.subpointLatRad)
                                : null,
                            subpointLonDeg: Number.isFinite(entry.subpointLonRad)
                                ? THREE.MathUtils.radToDeg(entry.subpointLonRad)
                                : null,
                            separationDeg: entry.separationDeg
                        }));
                        setCloudWatchDebugInfo(uiEntries);
                    }
                }
                const nowMs = performance.now();
                if (nowMs - windTargetsStatusRef.current.lastUpdateMs > 500) {
                    windTargetsStatusRef.current.lastUpdateMs = nowMs;
                    setWindTargetsStatus(earth.getWindTargetsStatus?.() ?? null);
                    setWindReferenceDiagnostics(earth.getWindReferenceDiagnostics?.() ?? null);
                    setWindReferenceComparison(earth.getWindReferenceComparison?.() ?? null);
                }
            }

            if (didAdvanceSim) {
                updateTruthEvents(lastSimTimeSeconds);
                updateForecastSkillTelemetry();
                evaluateWarnings(lastSimTimeSeconds);
            }

            if (anchorLockRef.current && earthRef.current && cameraRef.current && controlsRef.current) {
                const earth = earthRef.current;
                const anchor = anchorLockRef.current;
                const camera = cameraRef.current;
                const controls = controlsRef.current;
                const currentDistance = camera.position.length();
                if (Number.isFinite(currentDistance) && currentDistance > 0) {
                    anchor.distance = currentDistance;
                }
                const camLocal = anchor.localDir.clone().multiplyScalar(anchor.distance);
                const camWorld = earth.parentObject.localToWorld(camLocal);
                const targetLocal = anchor.localDir.clone().multiplyScalar(earth.earthRadiusKm);
                const targetWorld = earth.parentObject.localToWorld(targetLocal);
                if (!anchor.isDragging) {
                    const alpha = 1 - Math.exp(-4 * realDtSeconds);
                    camera.position.lerp(camWorld, alpha);
                    controls.target.lerp(targetWorld, alpha);
                    controls.update();
                }
            }


            // Handle sphere detections
//      handleSphereDetections(detectedSpheres);
            if (didAdvanceSim) {
                handleCommSatDetections();
            }

            if (sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };

        animate();
        return () => {
            stopped = true;
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        };
    }, [satellites, gameMode]);

    function handleMouseMove(event) {
        if (selectionActiveRef.current) {
            updateSelectionDragRect(event);
            return;
        }
        // --- Orbit preview drag: rotate plane normal around HQ vector t ---
        if (orbitDragRef.current.active && showSatPanelRef.current) {
            if (!earthRef.current) return;
            const dragMode = orbitDragRef.current.mode || 'rotate';

            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current);

            const cam = cameraRef.current;
            const origin = cam.position.clone();
            const dir = raycaster.ray.direction.clone();

            if (dragMode === 'radius') {
                const n = previewNormalRef.current;
                if (!n) return;
                const earth = earthRef.current;

                const originLocal = origin.clone();
                const p1Local = origin.clone().add(dir);
                if (earth?.parentObject) {
                    earth.parentObject.worldToLocal(originLocal);
                    earth.parentObject.worldToLocal(p1Local);
                }
                const dirLocal = p1Local.sub(originLocal).normalize();
                const denom = dirLocal.dot(n);
                if (Math.abs(denom) < 1e-6) return;
                const tHit = -originLocal.dot(n) / denom;
                if (tHit <= 0) return;
                const hitLocal = originLocal.clone().add(dirLocal.multiplyScalar(tHit));
                const earthRadiusKm = earth.earthRadiusKm;
                const minRadius = earthRadiusKm + 10;
                const clampedRadius = Math.max(minRadius, hitLocal.length());
                const newAltKm = Math.max(0, clampedRadius - earthRadiusKm);
                if (Math.abs(parseFloat(altitudeRef.current || '0') - newAltKm) > 0.5) {
                    const nextAlt = String(Math.round(newAltKm));
                    altitudeRef.current = nextAlt;
                    setAltitude(nextAlt);
                }
                orbitDragRef.current.radius = clampedRadius;
                updateOrbitPreview();
                return;
            }

            const r = orbitDragRef.current.radius ||
                (earthRef.current.earthRadiusKm + parseFloat(altitudeRef.current || '0'));

            // Intersect ray with sphere of radius r
            const A = dir.dot(dir);
            const B = 2 * origin.dot(dir);
            const C = origin.dot(origin) - r * r;
            const disc = B * B - 4 * A * C;
            if (disc > 0) {
                const sqrtDisc = Math.sqrt(disc);
                const t1 = (-B - sqrtDisc) / (2 * A);
                const t2 = (-B + sqrtDisc) / (2 * A);
                const tHit = t1 > 0 ? t1 : t2;
                if (tHit > 0) {
                    const hit = origin.clone().add(dir.clone().multiplyScalar(tHit));
                    const hitLocal = hit.clone();
                    if (earthRef.current?.parentObject) {
                        earthRef.current.parentObject.worldToLocal(hitLocal);
                    }
                    hitLocal.normalize();

                    const hq = getMainHQ();
                    if (hq) {
                        const t = hq.sphere.position.clone().normalize();

                        // Tangent direction at HQ: project hit onto plane ⟂ t
                        let d = hitLocal.clone().sub(t.clone().multiplyScalar(hitLocal.dot(t)));
                        const len = d.length();
                        if (len > 1e-6) {
                            d.multiplyScalar(1 / len);
                            // New plane normal n = t × d  (guarantees n·t = 0)
                            let n = t.clone().cross(d).normalize();
                            if (n.y < 0) n.multiplyScalar(-1); // prograde

                            previewNormalRef.current = n;

                            // Update UI inclination readout
                            const incRad = Math.acos(THREE.MathUtils.clamp(n.y, -1, 1));
                            const newDeg = THREE.MathUtils.radToDeg(incRad).toFixed(2);
                            if (Math.abs(parseFloat(inclinationRef.current) - parseFloat(newDeg)) > 0.05) {
                                setInclination(newDeg);
                            }

                            updateOrbitPreview();
                        }
                    }
                    return; // while dragging, ignore HQ ghost updates
                }
            }
            return;
        }

        const earth = earthRef.current;
        if (!earth?.mesh) return;

        // --- HQ placement ghost follow (unchanged) ---
        if (showHQSphereRef.current && hqSphereRef.current) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current);

            const intersects = raycaster.intersectObject(earth.mesh);
            if (intersects.length > 0) {
                const intersectPoint = intersects[0].point;
                hqSphereRef.current.position.copy(intersectPoint);
                if (placeUplinkHubRef.current && uplinkHubGhostRef.current) {
                    const localPoint = intersectPoint.clone();
                    earth.parentObject.worldToLocal(localPoint);
                    const latLon = vectorToLatLonRad(localPoint);
                    if (latLon) {
                        const latDeg = THREE.MathUtils.radToDeg(latLon.latRad);
                        const lonDeg = THREE.MathUtils.radToDeg(latLon.lonRad);
                        positionUplinkHubMesh(uplinkHubGhostRef.current, latDeg, lonDeg, earth);
                    }
                }
            } else {
                const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(cameraRef.current);
                vector.sub(cameraRef.current.position).normalize();
                const distance = -cameraRef.current.position.z / vector.z;
                const pos = cameraRef.current.position.clone().add(vector.multiplyScalar(distance));
                hqSphereRef.current.position.copy(pos);
            }
        } else if (placeUplinkHubRef.current && uplinkHubGhostRef.current) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current);
            const intersects = raycaster.intersectObject(earth.mesh);
            if (intersects.length > 0) {
                const localPoint = intersects[0].point.clone();
                earth.parentObject.worldToLocal(localPoint);
                const latLon = vectorToLatLonRad(localPoint);
                if (latLon) {
                    const latDeg = THREE.MathUtils.radToDeg(latLon.latRad);
                    const lonDeg = THREE.MathUtils.radToDeg(latLon.lonRad);
                    positionUplinkHubMesh(uplinkHubGhostRef.current, latDeg, lonDeg, earth);
                }
            }
        }

        updateCursorLatLon(getEarthClickLatLonDeg(event));
    }





    const handleHQButtonClick = (event) => {
        // close other panels and orbit preview
        setShowSatPanel(false);
        setShowStrikePad(false);
        removeOrbitPreview();

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
        const speedInRadPerSec     = orbitalSpeedMPerS / orbitRadiusMeters;

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

        // 3) Choose plane from preview normal if available; else fall back to solver
        const hqWorld = new THREE.Vector3();
        mainHQ.sphere.getWorldPosition(hqWorld);
        const t = hqWorld.clone().normalize();

        if (previewNormalRef.current) {
            // Desired plane normal from the widget (prograde by convention)
            let n = previewNormalRef.current.clone().normalize();
            if (n.y < 0) n.multiplyScalar(-1);
            const earth = earthRef.current;
            if (earth?.parentObject) {
                n.applyQuaternion(earth.parentObject.quaternion);
                n.normalize();
            }

            // IMPORTANT: your Satellite basis uses a = Rx(i)→Ry(Ω)·X, b = Rx(i)→Ry(Ω)·Z.
            // Its plane normal is a×b = -[Ry(Ω)·Rx(i)·Y]. To make that equal our preview 'n',
            // we pick (i, Ω) that rotate +Y to -n:
            const raanForSat = Math.atan2(-n.x, -n.z);
            const incForSat  = Math.acos(THREE.MathUtils.clamp(-n.y, -1, 1));

            // Rebuild the *same* a,b basis the Satellite will use…
            const Rx = new THREE.Matrix4().makeRotationX(incForSat);
            const Ry = new THREE.Matrix4().makeRotationY(raanForSat);
            const a  = new THREE.Vector3(1, 0, 0).applyMatrix4(Rx).applyMatrix4(Ry);
            const b  = new THREE.Vector3(0, 0, 1).applyMatrix4(Rx).applyMatrix4(Ry);

            // …and solve ν so the satellite starts *exactly over the HQ*
            const nu = Math.atan2(t.dot(b), t.dot(a));

            // Commit elements
            orbit.inclination = incForSat;
            orbit.raan        = raanForSat;
            orbit.angle       = nu;   // ← guarantees start-over-HQ

        } else {
            // Fallback: previous Ω↔i solver (unchanged)
            let raan = previewRAANRef.current;
            if (raan == null) {
                let incRad = orbit.inclination;
                const lat = Math.asin(t.y);
                if (Math.abs(lat) > incRad + 1e-6) incRad = Math.abs(lat);
                const sol = solveRAANForInc(incRad, t);
                if (!sol.solved) {
                    notify('warning', 'Launch aborted: no valid orbital alignment found for this HQ and inclination.');
                    return;
                }
                orbit.inclination = incRad;
                orbit.raan = sol.raan;
                orbit.angle = sol.nu;
            } else {
                const earth = earthRef.current;
                const earthRot = earth?.parentObject?.rotation?.y ?? 0;
                const worldRaan = wrapRadToPi(raan + earthRot);
                const incRad = solveIncForRAAN(worldRaan, t);
                orbit.inclination = incRad;
                const Rx = new THREE.Matrix4().makeRotationX(incRad);
                const Ry = new THREE.Matrix4().makeRotationY(worldRaan);
                const a  = new THREE.Vector3(1,0,0).applyMatrix4(Rx).applyMatrix4(Ry);
                const b  = new THREE.Vector3(0,0,1).applyMatrix4(Rx).applyMatrix4(Ry);
                const nu = Math.atan2(t.dot(b), t.dot(a));
                orbit.raan  = worldRaan;
                orbit.angle = nu;
            }
        }

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

            // Remove orbit preview once the satellite is actually launched
            removeOrbitPreview();
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
            setShowSatPanel(false);
            setShowMenu(false);
            removeOrbitPreview();
        }
    };

    const runForecast = () => {
        const earth = earthRef.current;
        const player = currentPlayerRef.current;
        if (!earth || !player) return;
        if (forecastStatus.running) return;
        const runFn = async () => {
            setForecastStatus(prev => ({ ...prev, running: true, progress01: 0, message: 'Starting forecast...' }));
            const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
            const unlockedLeads = getUnlockedForecastLeads(player);
            const leadList = unlockedLeads.length ? unlockedLeads : DEFAULT_FORECAST_LEADS;
            const result = await earth.runForecastForPlayer?.({
                playerId: player.id,
                simTimeSeconds,
                leadHours: leadList,
                horizonHours: Math.max(...leadList),
                onProgress: ({ progress01, message }) => {
                    setForecastStatus(prev => ({
                        ...prev,
                        running: true,
                        progress01: Number.isFinite(progress01) ? progress01 : prev.progress01,
                        message: message || prev.message
                    }));
                }
            });
            if (!result || result.ok === false) {
                notify('warning', `Forecast failed: ${result?.reason || 'unknown'}`);
                setForecastStatus(prev => ({ ...prev, running: false, progress01: 0, message: '' }));
                return;
            }
            setForecastBaseTimeSeconds(result.baseSimTimeSeconds);
            setForecastStatus({
                running: false,
                progress01: 1,
                message: 'Forecast complete',
                lastRunId: result.runId
            });
            const nextLead = leadList.includes(forecastLeadHoursRef.current)
                ? forecastLeadHoursRef.current
                : leadList[0];
	            setForecastLeadHours(nextLead);
	            earth.setForecastDisplayLeadHours?.(nextLead);
	            earth.setForecastDisplayProduct?.(forecastProductRef.current);
	            earth.setForecastOverlayVisible?.(showForecastOverlayRef.current);
                refreshForecastReport(player.id);

	            const grid = earth.weatherField?.core?.grid;
	            const leadHours = result.leadHours.includes(nextLead) ? nextLead : result.leadHours[0];
	            const unlockedHazards = getUnlockedWarningHazards(player);
            const { drafts: autoDrafts = [], diagnostics } = buildAutoWarningsFromForecast({
                forecastResult: result,
                grid,
                issuedAtSimTimeSeconds: simTimeSeconds,
                leadHours,
                allowedHazards: unlockedHazards,
                maxPolygonsPerHazard: MAX_DRAFTS_PER_HAZARD,
                mode: 'draft'
            });
            if (diagnostics) {
                setAutoWarningDiagnosticsByPlayerId(prev => ({
                    ...prev,
                    [player.id]: diagnostics
                }));
                autoWarningDiagnosticsByPlayerIdRef.current = {
                    ...autoWarningDiagnosticsByPlayerIdRef.current,
                    [player.id]: diagnostics
                };
            }
            if (autoDrafts.length > 0) {
                setDraftWarningsByPlayerId(prev => ({
                    ...prev,
                    [player.id]: autoDrafts
                }));
                draftWarningsByPlayerIdRef.current = {
                    ...draftWarningsByPlayerIdRef.current,
                    [player.id]: autoDrafts
                };
            } else {
                setDraftWarningsByPlayerId(prev => ({
                    ...prev,
                    [player.id]: []
                }));
                draftWarningsByPlayerIdRef.current = {
                    ...draftWarningsByPlayerIdRef.current,
                    [player.id]: []
                };
            }

            const noDrafts = autoDrafts.length === 0;
            if (noDrafts) {
                const diag = diagnostics;
                const hazardsDiag = diag?.hazards || {};
                if (!diag || diag.reason === 'missingForecast') {
                    notify('info', 'No drafts: forecast data unavailable');
                } else if (diag.reason === 'missingGrid') {
                    notify('info', 'No drafts: forecast grid unavailable');
                } else if (diag.reason === 'leadNotFound') {
                    notify('info', 'No drafts: lead time not found in forecast');
                } else if (diag.serviceCellCount === 0) {
                    notify('info', 'No drafts: service area is empty (place an HQ)');
                } else {
                    const allZero = unlockedHazards.length > 0 && unlockedHazards.every((haz) => {
                        const h = hazardsDiag[haz];
                        return !h || h.cellsOverThreshold === 0;
                    });
                    if (allZero) {
                        notify('info', 'No drafts: hazard never exceeded threshold in service area');
                    } else {
                        const nonZeroHazards = unlockedHazards.filter((haz) => {
                            const h = hazardsDiag[haz];
                            return h && h.cellsOverThreshold > 0;
                        });
                        const allTooSmall = nonZeroHazards.length > 0 && nonZeroHazards.every((haz) => {
                            const h = hazardsDiag[haz];
                            return h.componentCount > 0
                                && h.draftCount === 0
                                && h.componentsDroppedTooSmall === h.componentCount;
                        });
                        if (allTooSmall) {
                            notify('info', 'No drafts: all components were below minimum size');
                        } else {
                            notify('info', 'No drafts: all components exceeded area cap');
                        }
                    }
                }
            } else {
                const weights = getAreaWeights(grid);
                const confValues = result.products.confidenceByLead?.[result.leadHours.indexOf(leadHours)];
                if (weights && confValues) {
                    const serviceMask = getServiceMask(grid);
                    const radarLocs = getPlayerRadarHubLatLonDegList(player.id);
                    const radarMask = buildRadarCoverageMask(grid, radarLocs, RADAR_RADIUS_KM);
                    const restMask = serviceMask ? new Uint8Array(serviceMask.length) : null;
                    if (serviceMask && restMask) {
                        for (let k = 0; k < serviceMask.length; k++) {
                            restMask[k] = serviceMask[k] === 1 && radarMask[k] !== 1 ? 1 : 0;
                        }
                    }
                    const radarMean = computeWeightedMeanWithMask(
                        confValues,
                        weights,
                        radarMask,
                        grid.nx,
                        grid.ny
                    );
                    const serviceMean = serviceMask
                        ? computeWeightedMeanWithMask(confValues, weights, serviceMask, grid.nx, grid.ny)
                        : null;
                    const serviceRestMean = restMask
                        ? computeWeightedMeanWithMask(confValues, weights, restMask, grid.nx, grid.ny)
                        : null;
                    if (Number.isFinite(radarMean) && Number.isFinite(serviceRestMean) && radarMean >= 0.75 && serviceRestMean < 0.55) {
                        notify('info', 'Radar confidence is high near HQ — issue a small 1–3h polygon there.');
                    } else if (Number.isFinite(serviceMean) && serviceMean >= 0.6) {
                        notify('info', 'Confidence is high — smaller polygons score better. Tighten your warning.');
                    } else {
                        notify('info', 'Confidence is low — stick to 1h and avoid over-precise polygons.');
                    }
                }
                if (!forecastHintShownRef.current) {
                    forecastHintShownRef.current = true;
                    notify('info', 'Draft warnings don’t score until you Issue them.');
                    notify('info', 'Use Confidence (Advanced) to find where small warnings pay more.');
                }
            }
        };

        const registry = actionRegistryRef.current;
        if (registry?.perform) {
            const ok = registry.perform('RUN_FORECAST', player.id, { runFn });
            if (!ok) {
                notify('warning', 'Forecast blocked: not your turn, insufficient AP, or insufficient funds.');
            }
        } else {
            runFn();
        }
    };

    const addRadiosondeModuleToSelectedHub = () => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player) return;
        const hub = getSelectedHubForPlayer(player.id, selectedUplinkHubIdRef.current);
        if (!hub || hub.ownerId !== player.id) {
            notify('warning', 'Select one of your hubs to add a radiosonde module.');
            return;
        }
        if (hub.modules?.radiosonde === true) return;
        const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
        const applyFn = () => {
            hub.modules = { ...hub.modules, radiosonde: true };
            setUplinkHubsVersion(v => v + 1);
            syncUplinkHubsToEarth();
            earth?.logWeatherEvent?.(
                'uplinkHubModuleAdded',
                { playerId: player.id, hubId: hub.id, module: 'radiosonde' },
                { simTimeSeconds }
            );
            notify('info', 'Radiosonde module installed.');
        };
        const registry = actionRegistryRef.current;
        if (registry?.perform) {
            const ok = registry.perform('ADD_RADIOSONDE_MODULE', player.id, { applyFn });
            if (!ok) {
                notify('warning', 'Upgrade blocked: not your turn, insufficient AP, or insufficient funds.');
            }
        } else {
            applyFn();
        }
    };

    const addRadarModuleToSelectedHub = () => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player) return;
        const hub = getSelectedHubForPlayer(player.id, selectedUplinkHubIdRef.current);
        if (!hub || hub.ownerId !== player.id) return;
        if (hub.isHqHub === true || hub.modules?.radar === true) return;
        hub.modules = { ...hub.modules, radar: true };
        const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
        syncUplinkHubsToEarth();
        setUplinkHubsVersion(v => v + 1);
        renderPlayerObjects();
        earth?.logWeatherEvent?.(
            'uplinkHubModuleAdded',
            { playerId: player.id, hubId: hub.id, module: 'radar' },
            { simTimeSeconds }
        );
    };

    const upgradeDenseSurfaceForSelectedHub = () => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player) return;
        if (getForecastTier(player) < 4) return;
        const hub = getSelectedHubForPlayer(player.id, selectedUplinkHubIdRef.current);
        if (!hub || hub.ownerId !== player.id) return;
        if (hub.modules?.denseSurface === true) return;
        hub.modules = { ...hub.modules, denseSurface: true };
        const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
        syncUplinkHubsToEarth();
        setUplinkHubsVersion(v => v + 1);
        renderPlayerObjects();
        earth?.logWeatherEvent?.(
            'uplinkHubModuleAdded',
            { playerId: player.id, hubId: hub.id, module: 'denseSurface' },
            { simTimeSeconds }
        );
    };

    const upgradeForecastTech = () => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player) return;
        if ((player.getHQs?.().length ?? 0) === 0) {
            notify('warning', 'Place an HQ before upgrading forecast tech.');
            return;
        }
        const currentTier = getForecastTier(player);
        if (currentTier >= 4) {
            notify('info', 'Forecast tech is fully upgraded.');
            return;
        }
        const nextTier = currentTier + 1;
        const nextSpec = getTierSpec(nextTier);
        const tierCostMoney = nextSpec?.costMoney ?? 0;
        const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
        const toastByTier = {
            1: 'AMVs online: storm track improves (reduces displacement errors).',
            2: 'Soundings online: intensity improves (fewer phantom storms).',
            3: 'Radar nowcast online: 1–3h precip near HQ is much more reliable.',
            4: 'Dense surface network online: synoptic skill improves. 24h unlocked with comms.'
        };
        const applyFn = () => {
            player.forecastTechTier = nextTier;
            applyTierToPlayer(player);
            setPlayers(prev => [...prev]);
            earth?.logWeatherEvent?.(
                'forecastTechUpgraded',
                { playerId: player.id, fromTier: currentTier, toTier: nextTier },
                { simTimeSeconds }
            );
            notify('info', toastByTier[nextTier] || 'Forecast tech upgraded.');
            if (nextTier === 2 && ensureHqRadiosondeModuleInstalled(player.id)) {
                notify('info', 'HQ begins scheduled radiosonde launches.');
            }
        };
        const registry = actionRegistryRef.current;
        if (registry?.perform) {
            const ok = registry.perform('UPGRADE_FORECAST_TECH', player.id, {
                moneyCost: tierCostMoney,
                applyFn
            });
            if (!ok) {
                notify('warning', 'Upgrade blocked: not your turn, insufficient AP, or insufficient funds.');
            }
        } else {
            applyFn();
        }
    };

    const issueWarning = () => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player || !earth) return;
        const draft = warningDraftRef.current;
        if (!draft || draft.vertices.length < 3) {
            notify('warning', 'Add at least 3 vertices to issue a warning.');
            return;
        }
        const allowedHazards = getUnlockedWarningHazards(player);
        if (allowedHazards.length && !allowedHazards.includes(draft.hazardType)) {
            notify('warning', 'This hazard is not unlocked yet.');
            return;
        }
        const startHours = Number(draft.validStartHours);
        const durHours = Number(draft.validDurationHours);
        if (!Number.isFinite(startHours) || !Number.isFinite(durHours) || durHours <= 0 || startHours < 0 || (startHours + durHours) > 24) {
            notify('warning', 'Invalid warning window (start >= 0, duration > 0, end <= 24h).');
            return;
        }
        const unlockedLeads = getUnlockedForecastLeads(player);
        if (unlockedLeads.length && !unlockedLeads.includes(startHours)) {
            notify('warning', 'This lead time is not unlocked yet.');
            return;
        }
        const latestForecast = earth.latestForecastByPlayerId?.get(String(player.id));
        if (!latestForecast) {
            notify('warning', 'Run a forecast before issuing a warning.');
            return;
        }
        const issuedAt = simClockRef.current?.simTimeSeconds ?? 0;
        const validStart = issuedAt + startHours * 3600;
        const validEnd = validStart + durHours * 3600;
        const warning = {
            id: `warn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            playerId: player.id,
            issuedAtSimTimeSeconds: issuedAt,
            validStartSimTimeSeconds: validStart,
            validEndSimTimeSeconds: validEnd,
            hazardType: draft.hazardType,
            polygonLatLonDeg: draft.vertices.slice(),
            forecastRunId: latestForecast.runId,
            forecastLeadHours: startHours
        };
        const grid = earth.weatherField?.core?.grid;
        const maskResult = buildWarningGridMask(warning.polygonLatLonDeg, grid);
        if (maskResult) {
            warning._gridMask = maskResult.mask;
            warning._gridMaskNx = maskResult.nx;
            warning._gridMaskNy = maskResult.ny;
        }
        if (warning._gridMask && grid) {
            const weights = getAreaWeights(grid);
            const serviceMask = getServiceMask(grid);
            const leadIdx = latestForecast.leadHours.indexOf(startHours);
            const confValues = latestForecast.products?.confidenceByLead?.[leadIdx];
            if (weights && serviceMask) {
                warning.areaFracService = computeWarningAreaFracService(
                    warning._gridMask,
                    grid,
                    serviceMask,
                    weights
                );
                warning.meanConfidence = confValues
                    ? computeMeanConfidenceInWarning(confValues, warning._gridMask, grid, serviceMask, weights)
                    : null;
            }
        }

        const addWarningFn = () => {
            setWarningsByPlayerId(prev => {
                const current = prev[player.id] || [];
                return {
                    ...prev,
                    [player.id]: [...current, warning]
                };
            });
            setWarningDrawMode(false);
            setWarningDraft(prev => ({ ...prev, vertices: [] }));
        };

        const registry = actionRegistryRef.current;
        if (registry?.perform) {
            const ok = registry.perform('ISSUE_WARNING', player.id, { addWarningFn });
            if (!ok) {
                notify('warning', 'Warning blocked: not your turn, insufficient AP, or insufficient funds.');
            }
        } else {
            addWarningFn();
        }
    };

    const issueDraftWarning = (draft) => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player || !earth || !draft) return;
        const issuedAt = simClockRef.current?.simTimeSeconds ?? 0;
        const leadHours = Number(draft.forecastLeadHours);
        if (!Number.isFinite(leadHours)) return;
        const durationHours = Number(warningDraftRef.current?.validDurationHours);
        const safeDuration = Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 6;
        const validStart = issuedAt + leadHours * 3600;
        const validEnd = validStart + safeDuration * 3600;
        const warning = {
            id: `warn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            playerId: player.id,
            issuedAtSimTimeSeconds: issuedAt,
            validStartSimTimeSeconds: validStart,
            validEndSimTimeSeconds: validEnd,
            hazardType: draft.hazardType,
            polygonLatLonDeg: draft.polygonLatLonDeg.slice(),
            forecastRunId: draft.forecastRunId ?? earth.latestForecastByPlayerId?.get(String(player.id))?.runId ?? null,
            forecastLeadHours: leadHours
        };
        if (draft._gridMask && draft._gridMaskNx && draft._gridMaskNy) {
            warning._gridMask = draft._gridMask;
            warning._gridMaskNx = draft._gridMaskNx;
            warning._gridMaskNy = draft._gridMaskNy;
        } else {
            const grid = earth.weatherField?.core?.grid;
            const maskResult = buildWarningGridMask(warning.polygonLatLonDeg, grid);
            if (maskResult) {
                warning._gridMask = maskResult.mask;
                warning._gridMaskNx = maskResult.nx;
                warning._gridMaskNy = maskResult.ny;
            }
        }
        if (Number.isFinite(draft.areaFracService)) {
            warning.areaFracService = draft.areaFracService;
        }
        if (Number.isFinite(draft.meanConfidence)) {
            warning.meanConfidence = draft.meanConfidence;
        }
        if (warning._gridMask && (!Number.isFinite(warning.areaFracService) || !Number.isFinite(warning.meanConfidence))) {
            const grid = earth.weatherField?.core?.grid;
            const weights = getAreaWeights(grid);
            const serviceMask = getServiceMask(grid);
            const latestForecast = earth.latestForecastByPlayerId?.get(String(player.id));
            const leadIdx = latestForecast?.leadHours?.indexOf(leadHours) ?? -1;
            const confValues = leadIdx >= 0 ? latestForecast?.products?.confidenceByLead?.[leadIdx] : null;
            if (weights && serviceMask && grid) {
                if (!Number.isFinite(warning.areaFracService)) {
                    warning.areaFracService = computeWarningAreaFracService(
                        warning._gridMask,
                        grid,
                        serviceMask,
                        weights
                    );
                }
                if (!Number.isFinite(warning.meanConfidence) && confValues) {
                    warning.meanConfidence = computeMeanConfidenceInWarning(
                        confValues,
                        warning._gridMask,
                        grid,
                        serviceMask,
                        weights
                    );
                }
            }
        }

        const addWarningFn = () => {
            setWarningsByPlayerId(prev => {
                const current = prev[player.id] || [];
                return {
                    ...prev,
                    [player.id]: [...current, warning]
                };
            });
            setDraftWarningsByPlayerId(prev => {
                const current = prev[player.id] || [];
                return {
                    ...prev,
                    [player.id]: current.filter(d => d.id !== draft.id)
                };
            });
            earth.logWeatherEvent?.(
                'autoWarningDraftIssued',
                {
                    draftId: draft.id,
                    warningId: warning.id,
                    playerId: player.id,
                    hazardType: draft.hazardType,
                    leadHours,
                    forecastRunId: draft.forecastRunId ?? null
                },
                { simTimeSeconds: issuedAt }
            );
        };

        const registry = actionRegistryRef.current;
        if (registry?.perform) {
            const ok = registry.perform('ISSUE_WARNING', player.id, { addWarningFn });
            if (!ok) {
                notify('warning', 'Warning blocked: not your turn, insufficient AP, or insufficient funds.');
            }
        } else {
            addWarningFn();
        }
    };

    const discardDraftWarning = (draft) => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player || !draft) return;
        const now = simClockRef.current?.simTimeSeconds ?? 0;
        setDraftWarningsByPlayerId(prev => {
            const current = prev[player.id] || [];
            return {
                ...prev,
                [player.id]: current.filter(d => d.id !== draft.id)
            };
        });
        earth?.logWeatherEvent?.(
            'autoWarningDraftDiscarded',
            {
                draftId: draft.id,
                playerId: player.id,
                hazardType: draft.hazardType,
                leadHours: draft.forecastLeadHours ?? null,
                forecastRunId: draft.forecastRunId ?? null
            },
            { simTimeSeconds: now }
        );
    };




// Derive launch azimuth A (measured from EAST toward NORTH) from site latitude φ and orbital inclination i.
// Prograde branch only (A ∈ [0, 90°]) — consistent with your preview.
    function deriveAzimuthFromInc(siteLatDeg, incRad) {
        const phi = THREE.MathUtils.degToRad(siteLatDeg);
        const cosphi = Math.cos(phi);
        if (Math.abs(cosphi) < 1e-6) return Math.PI / 2; // at the poles, it's effectively polar
        const ratio = Math.cos(incRad) / cosphi;         // prograde
        const clamped = Math.min(1, Math.max(0, ratio)); // keep within [0,1]
        return Math.acos(clamped);
    }

// Realistic Δv-based cost (returns **dollars**)
    function calculateLaunchCost(satelliteType, siteLatDeg, orbit) {
        // Base prices per type (dollars). Tweak to fit your economy.
        const BASE = {
            imaging:       50_000_000,
            communication: 60_000_000,
            cloudWatch:    55_000_000,
            sar:           50_000_000
        };

        const incRad = orbit?.inclination ?? 0;                  // radians
        const altKm = Math.max(0, (orbit?.radius ?? 6371) - 6371);
        const r_m   = (6371 + altKm) * 1000;                    // orbital radius (m)

        const v_c   = Math.sqrt(MU_EARTH / r_m);                // circular speed (m/s)
        const A     = deriveAzimuthFromInc(siteLatDeg, incRad); // rad, from EAST toward NORTH
        const v_rot = OMEGA_EARTH * RE_M * Math.cos(THREE.MathUtils.degToRad(siteLatDeg)); // m/s
        const boost = v_rot * Math.cos(A);                      // effective rotational help

        const deltaV = Math.max(0, v_c + LOSSES_MPS - boost);   // m/s

        const base = BASE[satelliteType] ?? 50_000_000;
        const cost = base * Math.pow(deltaV / DV_REF_MPS, DV_EXPONENT);
        return Math.round(cost); // dollars
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

    const startSelectionMode = (event) => {
        if (selectionActiveRef.current) return false;
        if (!isCanvasEvent(event)) return false;
        const latLon = getEarthClickLatLonDeg(event);
        if (!latLon) return false;
        if (selectionPendingClickRef.current?.timerId) {
            clearTimeout(selectionPendingClickRef.current.timerId);
            selectionPendingClickRef.current = null;
        }
        selectionActiveRef.current = true;
        selectionAnchorRef.current = {
            x: event.clientX,
            y: event.clientY,
            latDeg: latLon.latDeg,
            lonDeg: latLon.lonDeg
        };
        selectionRectRef.current = {
            left: event.clientX,
            top: event.clientY,
            width: 0,
            height: 0
        };
        setSelectionDragRect({ ...selectionRectRef.current });
        setSelectionControlsEnabled(false);
        const dom = rendererRef.current?.domElement;
        if (dom) dom.style.cursor = 'crosshair';
        clearSelectionOutline();
        setSelectionMenu(null);
        selectionMenuRef.current = null;
        return true;
    };

    const updateSelectionDragRect = (event) => {
        if (!selectionActiveRef.current || !selectionAnchorRef.current) return;
        const anchor = selectionAnchorRef.current;
        const left = Math.min(anchor.x, event.clientX);
        const top = Math.min(anchor.y, event.clientY);
        const width = Math.abs(event.clientX - anchor.x);
        const height = Math.abs(event.clientY - anchor.y);
        const rect = { left, top, width, height };
        selectionRectRef.current = rect;
        setSelectionDragRect(rect);
    };

    const finalizeSelectionPlacement = (event) => {
        if (!selectionActiveRef.current) return;
        if (!isCanvasEvent(event)) return;
        const rect = selectionRectRef.current;
        if (!rect || rect.width < 2 || rect.height < 2) {
            clearSelection();
            return;
        }
        selectionActiveRef.current = false;
        setSelectionDragRect(null);
        setSelectionControlsEnabled(true);
        const dom = rendererRef.current?.domElement;
        if (dom) dom.style.cursor = '';

        const outlinePoints = buildSelectionOutlineFromRect(rect);
        if (!outlinePoints) {
            notify('warning', 'Selection must cover the Earth surface.');
            clearSelectionOutline();
            return;
        }
        const earth = earthRef.current;
        if (!earth?.parentObject) return;
        clearSelectionOutline();
        const geometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
        const material = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 60,
            gapSize: 30,
            transparent: true,
            opacity: 0.9
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.frustumCulled = false;
        earth.parentObject.add(line);
        selectionOutlineRef.current = line;

        const stats = computeSelectionStats(outlinePoints);
        const selectionId = `sel-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const selection = {
            id: selectionId,
            anchorLatLonDeg: selectionAnchorRef.current
                ? { latDeg: selectionAnchorRef.current.latDeg, lonDeg: selectionAnchorRef.current.lonDeg }
                : null,
            anchorScreen: selectionAnchorRef.current
                ? { x: selectionAnchorRef.current.x, y: selectionAnchorRef.current.y }
                : null,
            rectScreen: { ...rect },
            outlineLocalPoints: outlinePoints,
            centroidLatLonDeg: stats?.centroidLatLonDeg ?? null,
            boundingRadiusKm: stats?.boundingRadiusKm ?? 0
        };
        selectionDataRef.current = selection;

        const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
        const eligibility = computeSelectionEligibility(selection, simTimeSeconds);
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const menuX = Math.min(Math.max(10, centerX - 90), window.innerWidth - 200);
        const menuY = Math.min(Math.max(10, centerY - 60), window.innerHeight - 160);
        setSelectionMenu({
            x: menuX,
            y: menuY,
            selection,
            eligibility
        });
    };

    const cancelSelectionDrag = () => {
        if (!selectionActiveRef.current) return;
        selectionActiveRef.current = false;
        selectionAnchorRef.current = null;
        selectionRectRef.current = null;
        setSelectionDragRect(null);
        setSelectionControlsEnabled(true);
        const dom = rendererRef.current?.domElement;
        if (dom) dom.style.cursor = '';
        if (selectionPendingClickRef.current?.timerId) {
            clearTimeout(selectionPendingClickRef.current.timerId);
        }
        selectionPendingClickRef.current = null;
    };

    const handleSelectionAction = (actionType) => {
        const selection = selectionDataRef.current;
        if (!selection) return;
        const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
        const eligibility = computeSelectionEligibility(selection, simTimeSeconds);
        const actionInfo = actionType === 'sar' ? eligibility.sar : eligibility.image;
        if (!actionInfo?.enabled) {
            notify('warning', 'No satellite can capture this area in the next 2 hours.');
            return;
        }
        const earliestMinutes = Number.isFinite(actionInfo.nextAccessSeconds)
            ? Math.round(actionInfo.nextAccessSeconds / 60)
            : null;
        const actionLabel = actionType === 'sar' ? 'SAR capture' : 'image capture';
        notify(
            'info',
            earliestMinutes != null
                ? `Requested ${actionLabel}. Next access ~${earliestMinutes}m.`
                : `Requested ${actionLabel}.`
        );
        const earth = earthRef.current;
        earth?.logWeatherEvent?.(
            'collectRequested',
            {
                actionType,
                selectionId: selection.id,
                centroidLatLonDeg: selection.centroidLatLonDeg,
                boundingRadiusKm: selection.boundingRadiusKm,
                candidateSatIds: actionInfo.candidateIds ?? [],
                earliestAccessSeconds: actionInfo.nextAccessSeconds ?? null
            },
            { simTimeSeconds }
        );
        clearSelection();
    };

    function handleSingleClick(event) {
        // Try orbit-handle drag first if Sat panel open
        if (tryStartOrbitDrag(event)) return;
        if (warningDrawModeRef.current) {
            const earth = earthRef.current;
            if (!earth?.mesh) {
                notify('error', 'Earth not ready yet.');
                return;
            }
            const latLon = getEarthClickLatLonDeg(event);
            if (!latLon) return;
            const { latDeg, lonDeg } = latLon;
            setWarningDraft(prev => ({
                ...prev,
                vertices: [...prev.vertices, { latDeg, lonDeg }]
            }));
            return;
        }
        if (placeUplinkHubRef.current) {
            const earth = earthRef.current;
            const player = currentPlayerRef.current;
            if (!earth?.mesh || !player) {
                notify('error', 'Earth not ready yet.');
                return;
            }
            const latLon = getEarthClickLatLonDeg(event);
            if (!latLon) {
                notify('warning', 'Click the Earth surface to place a hub.');
                return;
            }
            const { latDeg, lonDeg } = latLon;
            const buildFn = () => {
                const hub = new UplinkHub({
                    id: `uplink-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                    ownerId: player.id,
                    latDeg,
                    lonDeg,
                    earth,
                    modules: { surface: true, radiosonde: false, radar: false, denseSurface: false }
                });
                const list = uplinkHubsByPlayerIdRef.current[player.id] || [];
                uplinkHubsByPlayerIdRef.current[player.id] = [...list, hub];
                if (hub.mesh && earth.parentObject) {
                    earth.parentObject.add(hub.mesh);
                }
                syncUplinkHubsToEarth();
                setUplinkHubsVersion(v => v + 1);
                renderPlayerObjects();
            };
            const registry = actionRegistryRef.current;
            if (registry?.perform) {
                const ok = registry.perform('BUILD_UPLINK_HUB', player.id, { buildFn });
                if (!ok) {
                    notify('warning', 'Build blocked: not your turn, insufficient AP, or insufficient funds.');
                    return;
                }
            } else {
                buildFn();
            }
            placeUplinkHubRef.current = false;
            if (uplinkHubGhostRef.current) {
                uplinkHubGhostRef.current.parent?.remove?.(uplinkHubGhostRef.current);
                uplinkHubGhostRef.current = null;
            }
            return;
        }
		if (!showHQSphereRef.current && !orbitDragRef.current.active) {
			const latLon = getEarthClickLatLonDeg(event);
			if (latLon) {
                if (!warningDrawModeRef.current && !placeUplinkHubRef.current) {
                    const player = currentPlayerRef.current;
                    const hubs = player ? (uplinkHubsByPlayerIdRef.current[player.id] || []) : [];
                    if (hubs.length) {
                        const mouse = new THREE.Vector2(
                            (event.clientX / window.innerWidth) * 2 - 1,
                            -(event.clientY / window.innerHeight) * 2 + 1
                        );
                        const raycaster = new THREE.Raycaster();
                        raycaster.setFromCamera(mouse, cameraRef.current);
                        const meshes = hubs.map(hub => hub.mesh).filter(Boolean);
                        const intersects = raycaster.intersectObjects(meshes);
                        if (intersects.length > 0) {
                            const hitMesh = intersects[0].object;
                            const hitHub = hubs.find(hub => hub.id === hitMesh.userData.uplinkHubId || hub.mesh === hitMesh);
                            if (hitHub) {
                                setSelectedUplinkHubId(hitHub.id);
                                hubs.forEach(hub => {
                                    if (hub?.mesh) {
                                        const scale = hub.id === hitHub.id ? 1.25 : 1.0;
                                        hub.mesh.scale.set(scale, scale, scale);
                                    }
                                });
                                return;
                            }
                        } else if (selectedUplinkHubId) {
                            setSelectedUplinkHubId(null);
                            hubs.forEach(hub => {
                                if (hub?.mesh) {
                                    hub.mesh.scale.set(1, 1, 1);
                                }
                            });
                        }
                    } else if (selectedUplinkHubId) {
                        setSelectedUplinkHubId(null);
                    }
                }
				const playerId = currentPlayerRef.current?.id;
				const warnings = getVisibleWarningsForPlayer(playerId);
				const matched = findWarningAtPoint(latLon.latDeg, latLon.lonDeg, warnings);
				if (matched && matched.id) {
					const focus = warningOverlayFocusRef.current;
					const nextHazard = matched.hazardType;
					const nextProduct = HAZARD_TO_FORECAST_PRODUCT[nextHazard] || forecastProductRef.current;
					const nextHours = Number.isFinite(matched.forecastLeadHours)
						? matched.forecastLeadHours
						: forecastLeadHoursRef.current;
					const toggleMatches = showForecastOverlayRef.current && focus.activeHazardType === nextHazard;

					if (toggleMatches) {
						focus.activeHazardType = null;
						setShowForecastOverlay(false);
					} else {
						focus.activeHazardType = nextHazard;
						setForecastProduct(nextProduct);
						setForecastLeadHours(nextHours);
						setShowForecastOverlay(true);
					}

					focus.lastWarningId = matched.id;
					setFocusedWarningInfo({
						id: matched.id,
						hazardType: matched.hazardType,
						issuedAtSimTimeSeconds: matched.issuedAtSimTimeSeconds,
						validStartSimTimeSeconds: matched.validStartSimTimeSeconds,
                        validEndSimTimeSeconds: matched.validEndSimTimeSeconds,
                        forecastLeadHours: matched.forecastLeadHours,
                        forecastRunId: matched.forecastRunId ?? null,
                        autoIssued: Boolean(matched.autoIssued)
                    });
                    return;
                }
            }
        }
        if (!showHQSphereRef.current) return;
        const earth = earthRef.current;
        if (!earth?.mesh) {
            notify('error', 'Earth not ready yet.');
            return;
        }
        const latLon = getEarthClickLatLonDeg(event);
        if (!latLon) {
            notify('warning', 'Click the Earth surface to place an HQ.');
            return;
        }
        const { latDeg, lonDeg } = latLon;
        const localPoint = earth._latLonToVector3?.(latDeg, lonDeg, earth.earthRadiusKm);
        const point = localPoint ? localPoint.clone() : null;
        if (point) {
            earth.parentObject.localToWorld(point);
        }
        if (!point) {
            notify('warning', 'Click the Earth surface to place an HQ.');
            return;
        }
        // Place the HQ at the clicked point on Earth
        const newHQ = earth.addHQSphere(point, hqSpheresRef, currentPlayerRef);

        // Player-facing confirmation
        notify(
            'success',
            `HQ placed at lat ${newHQ.latitude.toFixed(1)}°, lon ${newHQ.longitude.toFixed(1)}°`
        );
        notify('info', 'Engineers deployed a starter observing site at HQ: surface instruments + Doppler radar.');

        const hqHub = new UplinkHub({
            id: `uplink-hq-${newHQ.id}`,
            ownerId: currentPlayerRef.current?.id,
            latDeg: newHQ.latitude,
            lonDeg: newHQ.longitude,
            earth,
            isHqHub: true,
            modules: { surface: true, radiosonde: false, radar: true, denseSurface: false }
        });
        const hubList = uplinkHubsByPlayerIdRef.current[currentPlayerRef.current?.id] || [];
        uplinkHubsByPlayerIdRef.current[currentPlayerRef.current?.id] = [...hubList, hqHub];
        if (hqHub.mesh && earth.parentObject) {
            earth.parentObject.add(hqHub.mesh);
        }
        syncUplinkHubsToEarth();
        setUplinkHubsVersion(v => v + 1);

        // Turn off placement preview + remove the draggable ghost sphere
        showHQSphereRef.current = false;
        if (hqSphereRef.current) {
            sceneRef.current.remove(hqSphereRef.current);
            hqSphereRef.current = null;
        }

        renderPlayerObjects();
    }

    const positionUplinkHubMesh = (mesh, latDeg, lonDeg, earth) => {
        if (!mesh || !earth?._latLonToVector3) return;
        const radius = earth.earthRadiusKm + 8;
        const localPos = earth._latLonToVector3(latDeg, lonDeg, radius);
        const normal = localPos.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        mesh.position.copy(localPos);
        mesh.quaternion.copy(quat);
    };

    const createUplinkHubGhostMesh = (earth, latDeg, lonDeg) => {
        const geometry = new THREE.PlaneGeometry(140, 140);
        const material = new THREE.MeshBasicMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0.45,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 5;
        positionUplinkHubMesh(mesh, latDeg, lonDeg, earth);
        return mesh;
    };

    function handleMouseClick(event) {
        if (event.button === 2) return;
        if (selectionActiveRef.current) {
            finalizeSelectionPlacement(event);
            return;
        }

        const selectionAllowed = !warningDrawModeRef.current
            && !showHQSphereRef.current
            && !orbitDragRef.current.active
            && !orbitHoveringRef.current
            && !selectionMenuRef.current;

        if (selectionAllowed && isCanvasEvent(event)) {
            const now = performance.now();
            const last = selectionPendingClickRef.current;
            const dx = last ? event.clientX - last.x : 0;
            const dy = last ? event.clientY - last.y : 0;
            const distSq = dx * dx + dy * dy;
            if (last && now - last.time < SELECTION_DOUBLE_CLICK_MS && distSq <= SELECTION_DOUBLE_CLICK_PX * SELECTION_DOUBLE_CLICK_PX) {
                if (last.timerId) clearTimeout(last.timerId);
                selectionPendingClickRef.current = null;
                if (startSelectionMode(event)) return;
            }
            const clickEvent = {
                clientX: event.clientX,
                clientY: event.clientY,
                button: event.button,
                target: event.target
            };
            const timerId = setTimeout(() => {
                selectionPendingClickRef.current = null;
                handleSingleClick(clickEvent);
            }, SELECTION_DOUBLE_CLICK_MS);
            selectionPendingClickRef.current = {
                time: now,
                x: event.clientX,
                y: event.clientY,
                timerId
            };
            return;
        }

        handleSingleClick(event);
    }

    function handleRightClick(event) {
        event.preventDefault();
        if (selectionActiveRef.current) {
            cancelSelectionDrag();
            return;
        }
        const latLon = getEarthClickLatLonDeg(event);
        if (!latLon) {
            clearAnchor();
            return;
        }
        setAnchorAtLatLon(latLon.latDeg, latLon.lonDeg);
    }

    function handleKeyDown(event) {
        if (event.key !== 'Escape') return;
        if (selectionActiveRef.current || selectionMenuRef.current) {
            clearSelection();
        }
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

        const hubMap = uplinkHubsByPlayerIdRef.current;
        Object.keys(hubMap).forEach((playerId) => {
            const hubs = hubMap[playerId] || [];
            const isMine = String(playerId) === String(currentPlayer.id);
            hubs.forEach((hub) => {
                if (!hub?.mesh) return;
                if (hub.mesh.parent !== earth.parentObject) earth.parentObject.add(hub.mesh);
                hub.mesh.visible = isMine;
                const selected = isMine && hub.id === selectedUplinkHubIdRef.current;
                const scale = selected ? 1.25 : 1.0;
                hub.mesh.scale.set(scale, scale, scale);
            });
        });

        // Add only the current player's satellites back (cones for imaging/cloudWatch/sar)
        currentPlayer.getSatellites().forEach(satellite => {
            scene.add(satellite.mesh);
            if (
                (satellite.type === 'imaging' || satellite.type === 'cloudWatch' || satellite.type === 'sar')
                && satellite.viewCone
                && satellite.coneEnabled !== false
            ) {
                satellite.viewCone.visible = true;
                scene.add(satellite.viewCone);
            } else if (satellite.viewCone) {
                satellite.viewCone.visible = false;
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
        const fmtCoord = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');

        return (
            <TableContainer
                component={Box}
                sx={{
                    maxHeight: 240,
                    overflowY: 'auto',
                    borderRadius: 2,
                    border: '1px solid rgba(148,163,184,0.2)',
                    backgroundColor: 'rgba(15,23,42,0.5)'
                }}
            >
                <Table size="small" aria-label="satellites table">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Sat ID</TableCell>
                            <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Owner</TableCell>
                            <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Lat/Lon</TableCell>
                            <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Neighbors</TableCell>
                            <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Cone</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {playerSatellites.map(sat => (
                            <TableRow
                                key={sat.id}
                                hover
                                onClick={() => setSelectedSatelliteId(prev => (prev === sat.id ? null : sat.id))}
                                sx={{
                                    cursor: 'pointer',
                                    backgroundColor: sat.id === selectedSatelliteId
                                        ? 'rgba(56,189,248,0.12)'
                                        : 'transparent'
                                }}
                            >
                                <TableCell sx={{ color: 'white', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>{sat.id}</TableCell>
                                <TableCell sx={{ color: 'rgba(226,232,240,0.85)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>{sat.ownerId}</TableCell>
                                <TableCell
                                    sx={{
                                        color: 'rgba(226,232,240,0.85)',
                                        borderBottom: '1px solid rgba(148,163,184,0.1)',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {`Lat: ${fmtCoord(sat.latitude)}°, Lon: ${fmtCoord(sat.longitude)}°`}
                                </TableCell>
                                <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                    {Array.from(sat.neighbors).join(', ') || '—'}
                                </TableCell>
                                <TableCell sx={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                    {(sat.type === 'imaging' || sat.type === 'cloudWatch' || sat.type === 'sar') && sat.viewCone ? (
                                        <Switch
                                            size="small"
                                            checked={sat.coneEnabled !== false}
                                            onClick={(event) => event.stopPropagation()}
                                            onChange={(_, checked) => {
                                                sat.coneEnabled = checked;
                                                if (sat.viewCone) sat.viewCone.visible = checked;
                                                renderPlayerObjects();
                                                setSatellites([...satellitesRef.current]);
                                            }}
                                            color="primary"
                                        />
                                    ) : (
                                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.6)' }}>—</Typography>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };



    const isSinglePlayer = gameMode === 'solo';
    const panelSurfaceStyle = {
        backgroundColor: 'rgba(12,16,24,0.92)',
        border: '1px solid rgba(148,163,184,0.22)',
        borderRadius: 12,
        boxShadow: '0 14px 30px rgba(0,0,0,0.45)',
        color: 'white'
    };
    const panelTitleStyle = {
        color: 'rgba(226,232,240,0.9)',
        fontWeight: 600,
        letterSpacing: 0.3
    };
    const panelButtonSx = {
        color: 'white',
        borderColor: 'rgba(148,163,184,0.4)',
        backgroundColor: 'rgba(15,23,42,0.6)',
        textTransform: 'none',
        fontWeight: 600,
        '&:hover': {
            backgroundColor: 'rgba(30,41,59,0.8)',
            borderColor: 'rgba(148,163,184,0.7)'
        }
    };
    const panelLabelSx = {
        color: 'rgba(226,232,240,0.8)'
    };
    const panelInputSx = {
        color: 'white',
        '.MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(148,163,184,0.35)'
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(148,163,184,0.6)'
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(56,189,248,0.9)'
        },
        '.MuiInputBase-input': {
            color: 'white'
        },
        '.MuiSelect-icon': {
            color: 'rgba(226,232,240,0.8)'
        }
    };
    const panelSliderSx = {
        color: 'rgba(125,211,252,0.9)'
    };
    const renderRightPanelSection = ({ title, open, onToggle, children }) => (
        <Paper style={{ padding: 10, ...panelSurfaceStyle }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={open ? 1 : 0}>
                <Typography variant="caption" style={panelTitleStyle}>{title}</Typography>
                <IconButton
                    size="small"
                    onClick={onToggle}
                    aria-label={`Toggle ${title} panel`}
                    sx={{
                        color: 'rgba(226,232,240,0.85)',
                        border: '1px solid rgba(148,163,184,0.3)',
                        borderRadius: 2,
                        padding: '2px',
                        '&:hover': { backgroundColor: 'rgba(30,41,59,0.8)' }
                    }}
                >
                    {open ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                </IconButton>
            </Box>
            {open && children}
        </Paper>
    );
	const overlayProductLabel = FORECAST_PRODUCT_LABELS[forecastProduct] ?? forecastProduct;
	const overlayLabelText = showForecastOverlay
		? `Overlay: ${overlayProductLabel} — ${formatHoursLabel(forecastLeadHours)}`
		: 'Overlay: Off';
	const alertsAnchorRect = alertsButtonRef.current?.getBoundingClientRect?.();
	const alertsPanelLeft = alertsAnchorRect
		? Math.max(10, Math.min(window.innerWidth - 350, Math.round(alertsAnchorRect.left)))
		: 10;
	const alertsPanelTop = alertsAnchorRect
		? Math.round(alertsAnchorRect.bottom + 8)
		: 64;
    const currentPlayer = currentPlayerRef.current;
    const unlockedForecastLeads = getUnlockedForecastLeads(currentPlayer);
    const unlockedWarningHazards = getUnlockedWarningHazards(currentPlayer);
    const currentTier = getForecastTier(currentPlayer);
    const currentTierSpec = getTierSpec(currentTier);
    const nextTierSpec = currentTier < 4 ? getTierSpec(currentTier + 1) : null;
    const tierUnlockStatus = {
        amv: currentTier >= 1,
        soundings: currentTier >= 2,
        radarNowcast: currentTier >= 3,
        denseSurface: currentTier >= 4
    };
    const playerHasComms = getPlayerHasComms(currentPlayer?.id);
    const playerHasRadiosondeOnline = getPlayerHasOnlineRadiosondeSite(currentPlayer?.id);
    const longRangeLocked = !playerHasComms && Array.isArray(currentPlayer?.unlockedForecastLeadsHours)
        && currentPlayer.unlockedForecastLeadsHours.some(h => h >= 12);
    const radiosonde12Locked = currentTier >= 2 && playerHasComms && !playerHasRadiosondeOnline;
    const canUpgradeForecast = Boolean(
        currentPlayer
        && nextTierSpec
        && actionRegistryRef.current?.canPerform?.('UPGRADE_FORECAST_TECH', currentPlayer.id, { moneyCost: nextTierSpec.costMoney, applyFn: () => {} })
    );
    const hasHqForUpgrade = (currentPlayer?.getHQs?.().length ?? 0) > 0;
    const draftWarnings = activePlayerId ? (draftWarningsByPlayerId[activePlayerId] || []) : [];
    const autoWarningDiagnostics = activePlayerId ? (autoWarningDiagnosticsByPlayerId[activePlayerId] || null) : null;
    const hasForecastRun = Boolean(forecastStatus.lastRunId);
    const observingPlayerId = activePlayerId ?? currentPlayer?.id ?? null;
    const playerSatellites = currentPlayer?.getSatellites?.() ?? [];
    const satCounts = playerSatellites.reduce((acc, sat) => {
        if (!sat) return acc;
        const inLink = sat.inHqRange === true;
        if (sat.type === 'cloudWatch') {
            acc.cloudWatchOwned += 1;
            if (inLink) acc.cloudWatchLinked += 1;
        } else if (sat.type === 'communication') {
            acc.commsOwned += 1;
            if (inLink) acc.commsLinked += 1;
        } else if (sat.type === 'imaging') {
            acc.imagingOwned += 1;
            if (inLink) acc.imagingLinked += 1;
        } else if (sat.type === 'sar') {
            acc.sarOwned += 1;
            if (inLink) acc.sarLinked += 1;
        }
        return acc;
    }, {
        cloudWatchOwned: 0,
        cloudWatchLinked: 0,
        commsOwned: 0,
        commsLinked: 0,
        imagingOwned: 0,
        imagingLinked: 0,
        sarOwned: 0,
        sarLinked: 0
    });
    const earth = earthRef.current;
    const sensorStatus = earth?.getSensorStatus?.() ?? null;
    const cloudCoverageFrac = Number.isFinite(sensorStatus?.cloudIntel?.coverageFrac)
        ? sensorStatus.cloudIntel.coverageFrac
        : null;
    const uplinkInventory = getUplinkHubInventory(earth, observingPlayerId);
    const grid = earth?.weatherField?.core?.grid ?? null;
    let radarCoverageFracService = null;
    if (grid && observingPlayerId) {
        const serviceMask = getServiceMask(grid);
        if (serviceMask && serviceMask.length) {
            const radarLocs = getPlayerRadarHubLatLonDegList(observingPlayerId);
            const radarMask = buildRadarCoverageMask(grid, radarLocs, RADAR_RADIUS_KM);
            let serviceCount = 0;
            let coveredCount = 0;
            for (let k = 0; k < serviceMask.length; k++) {
                if (serviceMask[k] === 1) {
                    serviceCount += 1;
                    if (radarMask && radarMask[k] === 1) coveredCount += 1;
                }
            }
            radarCoverageFracService = serviceCount > 0 ? coveredCount / serviceCount : null;
        }
    }
    const radiosondeLaunches24h = earth?.getRadiosondeLaunchesLast24h?.(observingPlayerId) ?? 0;
    const simTimeSecondsNow = simClockRef.current?.simTimeSeconds ?? 0;
    const dayIndexNow = Math.floor(simTimeSecondsNow / 86400);
    const scoringMetaNow = currentPlayer?.id ? scoringMetaByPlayerIdRef.current[currentPlayer.id] : null;
    const hitsTodayDisplay = scoringMetaNow && scoringMetaNow.dayIndex === dayIndexNow
        ? scoringMetaNow.hitsToday
        : 0;
    const tierUnlockedLeads = currentTierSpec?.unlockedLeads ?? [];
    const availableLeadsNow = getUnlockedForecastLeads(currentPlayer);
    const lead24Locked = Array.isArray(currentPlayer?.unlockedForecastLeadsHours)
        && currentPlayer.unlockedForecastLeadsHours.includes(24)
        && !availableLeadsNow.includes(24);
    const postmortemQueueSize = (() => {
        void postmortemQueueVersion;
        return postmortemQueueRef.current.length;
    })();
    const selectedUplinkHub = (() => {
        void uplinkHubsVersion;
        if (!selectedUplinkHubId || !observingPlayerId) return null;
        const hubs = uplinkHubsByPlayerIdRef.current[observingPlayerId] || [];
        return hubs.find(hub => hub.id === selectedUplinkHubId) || null;
    })();
    const postmortemLabel = (() => {
        if (!activePostmortem) return '';
        const hazardLabel = HAZARD_LABELS[activePostmortem.hazardType] ?? activePostmortem.hazardType;
        if (activePostmortem.kind === 'miss') {
            return `Missed event — ${hazardLabel}`;
        }
        const outcomeLabel = activePostmortem.outcome === 'hit' ? 'Hit' : 'False alarm';
        return `${outcomeLabel} — ${hazardLabel}`;
    })();
    const postmortemBestOverlapLabel = activePostmortem?.bestOverlapSimTimeSeconds != null
        ? formatSimTime(activePostmortem.bestOverlapSimTimeSeconds)
        : '—';
    const postmortemClassLabel = formatPostmortemTag(activePostmortem?.classification?.primaryTag ?? null);
    const postmortemDetailLines = Array.isArray(activePostmortem?.classification?.detailLines)
        ? activePostmortem.classification.detailLines
        : [];
    const canAddRadiosondeModule = (() => {
        if (!currentPlayer || !selectedUplinkHub || selectedUplinkHub.ownerId !== currentPlayer.id) return false;
        if (selectedUplinkHub.modules?.radiosonde === true) return false;
        return Boolean(
            actionRegistryRef.current?.canPerform?.(
                'ADD_RADIOSONDE_MODULE',
                currentPlayer.id,
                { applyFn: () => {} }
            )
        );
    })();
    const canAddRadarModule = (() => {
        if (!currentPlayer || !selectedUplinkHub || selectedUplinkHub.ownerId !== currentPlayer.id) return false;
        if (selectedUplinkHub.isHqHub || selectedUplinkHub.modules?.radar === true) return false;
        return Boolean(
            actionRegistryRef.current?.canPerform?.(
                'ADD_RADAR_MODULE',
                currentPlayer.id,
                { applyFn: () => {}, moneyCost: 22_000_000 }
            )
        );
    })();
    const canUpgradeDenseSurface = (() => {
        if (!currentPlayer || !selectedUplinkHub || selectedUplinkHub.ownerId !== currentPlayer.id) return false;
        if (getForecastTier(currentPlayer) < 4) return false;
        if (selectedUplinkHub.modules?.denseSurface === true) return false;
        return Boolean(
            actionRegistryRef.current?.canPerform?.(
                'UPGRADE_DENSE_SURFACE',
                currentPlayer.id,
                { applyFn: () => {}, moneyCost: 30_000_000 }
            )
        );
    })();
    const formatLatLonText = (latLon) => {
        if (!latLon || !Number.isFinite(latLon.latDeg) || !Number.isFinite(latLon.lonDeg)) return '—';
        return `${latLon.latDeg.toFixed(1)}°, ${latLon.lonDeg.toFixed(1)}°`;
    };
    function formatPostmortemTag(tag) {
        switch (tag) {
            case 'tooEarly':
                return 'Too early';
            case 'tooLate':
                return 'Too late';
            case 'misplaced':
                return 'Misplaced';
            case 'tooBroad':
                return 'Too broad';
            case 'wrongHazard':
                return 'Wrong hazard';
            default:
                return 'Clean hit';
        }
    }
    const formatDiagNumber = (value, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : '—');
    const formatDiagCount = (value) => (Number.isFinite(value) ? Math.round(value).toString() : '—');
    const formatDebugDeg = (value) => (Number.isFinite(value) ? value.toFixed(1) : '—');
    const formatDebugSep = (value) => (Number.isFinite(value) ? value.toFixed(2) : '—');
    const cursorReadout = `Cursor: ${formatLatLonText(cursorLatLon)}`;
    const anchorReadout = `Anchor: ${formatLatLonText(anchorLatLon)}`;
    const sensorHudText = (() => {
        if (!sensorHudInfo) return null;
        const cloud = sensorHudInfo.cloudIntel;
        const active = Array.isArray(sensorHudInfo.activeSensors) ? sensorHudInfo.activeSensors : [];
        const surfaceObs = earth?.getLatestWeatherObservation?.('surfaceStations');
        const surfaceCount = Number.isFinite(surfaceObs?.products?.ps?.meta?.N_STATIONS)
            ? Math.round(surfaceObs.products.ps.meta.N_STATIONS)
            : null;
        const surfaceLabel = Number.isFinite(surfaceCount)
            ? `Surface sites (${surfaceCount})`
            : 'Surface sites';
        const labels = {
            surfaceStations: surfaceLabel,
            cloudSat: 'CloudWatch',
            soundings: 'Soundings',
            amv: 'AMVs',
            hqRadar: 'HQ Radar'
        };
        const preferred = ['surfaceStations', 'cloudSat', 'soundings', 'amv', 'hqRadar'];
        const activeLabel = preferred
            .filter(id => active.includes(id))
            .map(id => labels[id])
            .filter(Boolean)
            .join(', ') || 'None';
        if (!cloud || !Number.isFinite(cloud.coverageFrac) || !Number.isFinite(cloud.observedFrac)) {
            return `Sensors: ${activeLabel}`;
        }
        const cov = Math.round(cloud.coverageFrac * 100);
        const seen = Math.round(cloud.observedFrac * 100);
        return `CloudWatch: ${cov}% live, ${seen}% seen • Sensors: ${activeLabel}`;
    })();
    const runScoreLabel = Number.isFinite(runScore)
        ? `Run: $${Math.round(runScore / 1_000_000)}M`
        : null;
	const bestScoreLabel = Number.isFinite(bestScore)
	    ? `Best: $${Math.round(bestScore / 1_000_000)}M`
	    : null;
    const windTargets = windTargetsStatus?.targets ?? null;
    const windStatusPass = windTargetsStatus?.pass ?? null;
    const windFailReasons = windTargetsStatus?.failingReasons ?? [];
    const windRefComparison = windReferenceComparison;
    const windRefModel = windRefComparison?.model ?? null;
    const windRef = windRefComparison?.reference ?? null;
    const windRefDelta = windRefComparison?.delta ?? null;
    const formatWindDelta = (value) => {
        if (!Number.isFinite(value)) return '—';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}`;
    };

    if (!gameMode) {
        return (
            <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: '#0b1020', color: 'white' }}>
                <Typography variant="h4" gutterBottom>Satellite Wars</Typography>
                <Typography variant="body1" gutterBottom>Select a mode to begin:</Typography>
                <Box display="flex" gap={2}>
                    <Button variant="contained" color="primary" onClick={() => setGameMode('solo')}>Single Player</Button>
                    <Button variant="outlined" color="secondary" onClick={() => setGameMode('pvp')}>Player vs Player</Button>
                </Box>
            </div>
        );
    }

	    return (
	        <div>
	            <Box
	                sx={{
	                    position: 'absolute',
	                    top: 20,
	                    left: 10,
	                    zIndex: 1100,
	                    display: 'flex',
	                    alignItems: 'center',
	                    gap: 1
	                }}
	            >
	                <IconButton
	                    size="small"
	                    onClick={() => {
	                        setShowMenu(prev => {
	                            const next = !prev;
	                            if (!next) collapsePanels();   // collapsing -> hide everything
	                            return next;
	                        });
	                    }}
	                    sx={{
	                        backgroundColor: 'rgba(12,16,24,0.9)',
	                        color: 'white',
	                        border: '1px solid rgba(148,163,184,0.35)',
	                        '&:hover': {
	                            backgroundColor: 'rgba(30,41,59,0.9)'
	                        }
	                    }}
	                >
	                    {showMenu ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
	                </IconButton>
	                <Button
	                    variant="outlined"
	                    onClick={handleEndTurnClick}
	                    onMouseEnter={() => {
	                        if (isSinglePlayer) setSkipDayHover(true);
	                    }}
	                    onMouseLeave={() => {
	                        if (isSinglePlayer) setSkipDayHover(false);
	                    }}
	                    sx={{
	                        color: 'white',
	                        borderColor: 'rgba(148,163,184,0.5)',
	                        backgroundColor: 'rgba(10,14,22,0.85)',
	                        textTransform: 'none',
	                        fontWeight: 600,
	                        minWidth: isSinglePlayer ? 170 : 120,
	                        '&:hover': {
	                            backgroundColor: 'rgba(30,41,59,0.9)',
	                            borderColor: 'rgba(148,163,184,0.8)'
	                        }
	                    }}
	                >
	                    {isSinglePlayer ? (skipDayHover ? 'Skip to Next Day' : simTimeLabel) : 'End Turn'}
	                </Button>
	                <Button
	                    variant="outlined"
	                    color="inherit"
	                    ref={alertsButtonRef}
	                    onClick={() => setShowAlertsPanel(prev => !prev)}
	                    sx={{
	                        color: 'white',
	                        borderColor: 'rgba(255,255,255,0.6)',
	                        backgroundColor: 'rgba(0,0,0,0.4)',
	                        textTransform: 'none',
	                        fontWeight: 600
	                    }}
	                >
	                    Alerts{alertsUnreadCount > 0 ? ` (${alertsUnreadCount})` : ''}
	                </Button>
		                <Button
		                    variant="outlined"
		                    color="inherit"
		                    onClick={() => setShowObservingNetwork(true)}
		                    sx={{
		                        color: 'white',
		                        borderColor: 'rgba(255,255,255,0.6)',
		                        backgroundColor: 'rgba(0,0,0,0.4)',
		                        textTransform: 'none',
		                        fontWeight: 600
		                    }}
		                >
		                    Observing Network
		                </Button>
                        <Button
                            variant="outlined"
                            color="inherit"
                            onClick={() => setShowForecastReport(prev => !prev)}
                            sx={{
                                color: 'white',
                                borderColor: 'rgba(255,255,255,0.6)',
                                backgroundColor: 'rgba(0,0,0,0.4)',
                                textTransform: 'none',
                                fontWeight: 600
                            }}
                        >
                            Forecast Report
                        </Button>
		            </Box>
            {showAlertsPanel && (
                <Paper
                    style={{
                        position: 'absolute',
                        top: alertsPanelTop,
                        left: alertsPanelLeft,
	                        width: 340,
	                        maxHeight: '50vh',
	                        overflowY: 'auto',
	                        padding: 10,
                        zIndex: 1200,
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        color: 'white'
                    }}
                >
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="caption" style={{ color: 'white', fontWeight: 600 }}>
                            Alerts
                        </Typography>
                        <Box display="flex" gap={1}>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => setAlertsHistory([])}
                            >
                                Clear
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => setShowAlertsPanel(false)}
                            >
                                Close
                            </Button>
                        </Box>
                    </Box>
                    {alertsHistory.length === 0 ? (
                        <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            No alerts yet.
                        </Typography>
                    ) : (
                        alertsHistory.slice().reverse().map((entry) => {
                            const color = getAlertColor(entry.severity);
                            const timeLabel = Number.isFinite(entry.simTimeSeconds)
                                ? formatSimTime(entry.simTimeSeconds)
                                : 'Time unknown';
                            return (
                                <Box key={entry.id} mb={1}>
                                    <Typography variant="caption" style={{ color, fontWeight: 600 }}>
                                        {String(entry.severity || 'info').toUpperCase()}
                                    </Typography>
                                    <Typography variant="caption" style={{ color: 'white', display: 'block' }}>
                                        {entry.message}
                                    </Typography>
                                    <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                        {timeLabel}
                                    </Typography>
                                </Box>
                            );
                        })
                    )}
                </Paper>
            )}
            {showObservingNetwork && (
                <Paper
                    style={{
                        position: 'absolute',
                        top: 120,
                        right: 10,
                        width: 360,
                        maxHeight: '70vh',
                        overflowY: 'auto',
                        padding: 12,
                        zIndex: 1200,
                        pointerEvents: 'auto',
                        ...panelSurfaceStyle
                    }}
                >
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="subtitle2" style={panelTitleStyle}>
                            Observing Network
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => setShowObservingNetwork(false)}
                            sx={{
                                color: 'rgba(226,232,240,0.85)',
                                border: '1px solid rgba(148,163,184,0.3)',
                                borderRadius: 2,
                                padding: '2px',
                                '&:hover': { backgroundColor: 'rgba(30,41,59,0.8)' }
                            }}
                        >
                            <RemoveIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    <Box mb={1.5}>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                            Satellites
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            CloudWatch: {satCounts.cloudWatchOwned} owned, {satCounts.cloudWatchLinked} in link
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Comms: {satCounts.commsOwned} owned, {satCounts.commsLinked} in link
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Imaging: {satCounts.imagingOwned} owned, {satCounts.imagingLinked} in link
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            SAR: {satCounts.sarOwned} owned, {satCounts.sarLinked} in link
                        </Typography>
                    </Box>

                    <Box mb={1.5}>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                            Ground Assets
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Uplink Hubs: {uplinkInventory.totalHubs} total, {uplinkInventory.onlineHubs} online
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Modules: METAR {uplinkInventory.modules.metarTotal}, Radiosonde {uplinkInventory.modules.radiosondeTotal}, Radar {uplinkInventory.modules.radarTotal}
                        </Typography>
                    </Box>

                    <Box mb={1.5}>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                            Live Coverage
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            CloudWatch live coverage: {Number.isFinite(cloudCoverageFrac) ? `${Math.round(cloudCoverageFrac * 100)}%` : '—'}
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Radar coverage: {Number.isFinite(radarCoverageFracService) ? `${Math.round(radarCoverageFracService * 100)}%` : '—'} of service area
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Radiosonde launches (24h): {radiosondeLaunches24h}
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            <Tooltip title="Confidence = analysis certainty; increases where observations recently constrained analysis.">
                                <span>Confidence</span>
                            </Tooltip>{' '}
                            is shown in Forecast overlays.
                        </Typography>
                    </Box>

                    <Box mb={1.5}>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                            Wind realism targets
                        </Typography>
                        {!windTargetsStatus || !windTargets ? (
                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                                Waiting for wind diagnostics…
                            </Typography>
                        ) : (
                            <>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: windStatusPass?.model?.mean ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                                        display: 'block'
                                    }}
                                >
                                    Mean: {Number.isFinite(windTargetsStatus.model?.meanSpeed) ? windTargetsStatus.model.meanSpeed.toFixed(2) : '—'} (target {windTargets.model.meanMin}–{windTargets.model.meanMax})
                                </Typography>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: windStatusPass?.model?.p90 ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                                        display: 'block'
                                    }}
                                >
                                    P90: {Number.isFinite(windTargetsStatus.model?.p90) ? windTargetsStatus.model.p90.toFixed(2) : '—'} (target {windTargets.model.p90Min}–{windTargets.model.p90Max})
                                </Typography>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: windStatusPass?.model?.p99 ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                                        display: 'block'
                                    }}
                                >
                                    P99: {Number.isFinite(windTargetsStatus.model?.p99) ? windTargetsStatus.model.p99.toFixed(2) : '—'} (target {windTargets.model.p99Min}–{windTargets.model.p99Max})
                                </Typography>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: windStatusPass?.model?.max ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                                        display: 'block'
                                    }}
                                >
                                    Max: {Number.isFinite(windTargetsStatus.model?.maxSpeed) ? windTargetsStatus.model.maxSpeed.toFixed(2) : '—'} (max ≤ {windTargets.model.maxMax})
                                </Typography>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: windStatusPass?.viz?.stepMean ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                                        display: 'block',
                                        marginTop: 4
                                    }}
                                >
                                    Step mean: {Number.isFinite(windTargetsStatus.viz?.stepMeanPx) ? windTargetsStatus.viz.stepMeanPx.toFixed(2) : '—'}px (target {windTargets.viz.stepMeanMinPx}–{windTargets.viz.stepMeanMaxPx}px)
                                </Typography>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: windStatusPass?.viz?.stepP99 ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                                        display: 'block'
                                    }}
                                >
                                    Step P99: {Number.isFinite(windTargetsStatus.viz?.stepP99Px) ? windTargetsStatus.viz.stepP99Px.toFixed(2) : '—'}px (max ≤ {windTargets.viz.stepP99MaxPx}px)
                                </Typography>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: windStatusPass?.viz?.churn ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                                        display: 'block'
                                    }}
                                >
                                    Out-of-bounds: {Number.isFinite(windTargetsStatus.viz?.outOfBoundsFrac) ? `${Math.round(windTargetsStatus.viz.outOfBoundsFrac * 100)}%` : '—'} (max {Math.round(windTargets.viz.outOfBoundsMaxFrac * 100)}%)
                                </Typography>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: windStatusPass?.viz?.clipped ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                                        display: 'block'
                                    }}
                                >
                                    Clipped: {Number.isFinite(windTargetsStatus.viz?.clippedFrac) ? `${Math.round(windTargetsStatus.viz.clippedFrac * 100)}%` : '—'} (max {Math.round(windTargets.viz.clippedMaxFrac * 100)}%)
                                </Typography>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: windStatusPass?.overall ? 'rgba(74,222,128,0.9)' : 'rgba(248,113,113,0.9)',
                                        display: 'block',
                                        marginTop: 4
                                    }}
                                >
                                    Status: {windStatusPass?.overall ? 'PASS' : 'FAIL'}{windStatusPass?.overall
                                        ? ''
                                        : windFailReasons.length ? ` (${windFailReasons.join(', ')})` : ''}
                                </Typography>
                                {windRefModel && windRef && (
                                    <>
                                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)', display: 'block', marginTop: 6 }}>
                                            Reference vs Model (Δ = model − ref)
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                                            Mean: {Number.isFinite(windRefModel.meanSpeed) ? windRefModel.meanSpeed.toFixed(2) : '—'} / {Number.isFinite(windRef.meanSpeed) ? windRef.meanSpeed.toFixed(2) : '—'} (Δ {formatWindDelta(windRefDelta?.meanSpeed)})
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                                            P90: {Number.isFinite(windRefModel.p90) ? windRefModel.p90.toFixed(2) : '—'} / {Number.isFinite(windRef.p90) ? windRef.p90.toFixed(2) : '—'} (Δ {formatWindDelta(windRefDelta?.p90)})
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                                            P99: {Number.isFinite(windRefModel.p99) ? windRefModel.p99.toFixed(2) : '—'} / {Number.isFinite(windRef.p99) ? windRef.p99.toFixed(2) : '—'} (Δ {formatWindDelta(windRefDelta?.p99)})
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                                            Max: {Number.isFinite(windRefModel.maxSpeed) ? windRefModel.maxSpeed.toFixed(2) : '—'} / {Number.isFinite(windRef.maxSpeed) ? windRef.maxSpeed.toFixed(2) : '—'} (Δ {formatWindDelta(windRefDelta?.maxSpeed)})
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                                            EKE: {Number.isFinite(windRefModel.ekeMean) ? windRefModel.ekeMean.toFixed(2) : '—'} / {Number.isFinite(windRef.ekeMean) ? windRef.ekeMean.toFixed(2) : '—'} (Δ {formatWindDelta(windRefDelta?.ekeMean)})
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                                            Roughness: {Number.isFinite(windRefModel.roughness) ? windRefModel.roughness.toFixed(2) : '—'} / {Number.isFinite(windRef.roughness) ? windRef.roughness.toFixed(2) : '—'} (Δ {formatWindDelta(windRefDelta?.roughness)})
                                        </Typography>
                                    </>
                                )}
                            </>
                        )}
                    </Box>

                    <Box mb={1.5}>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                            Tier Summary
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Current tier: Tier {currentTier} — {currentTierSpec?.name ?? 'Unknown'}
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block', marginTop: 2 }}>
                            Unlocked capabilities:
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                            AMVs: {tierUnlockStatus.amv ? 'On' : 'Off'} · Soundings: {tierUnlockStatus.soundings ? 'On' : 'Off'}
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                            Radar nowcast: {tierUnlockStatus.radarNowcast ? 'On' : 'Off'} · Dense surface: {tierUnlockStatus.denseSurface ? 'On' : 'Off'}
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Unlocked lead times: {tierUnlockedLeads.map(h => formatHoursLabel(h)).join(', ') || '—'}
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Available lead times now: {availableLeadsNow.map(h => formatHoursLabel(h)).join(', ') || '—'}
                        </Typography>
                        {nextTierSpec && (
                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.75)', display: 'block', marginTop: 2 }}>
                                Next tier unlocks: {currentTier + 1} — {nextTierSpec.name} (leads {nextTierSpec.unlockedLeads.map(h => formatHoursLabel(h)).join(', ')})
                            </Typography>
                        )}
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block', marginTop: 2 }}>
                            12h requires: Tier ≥ 2 AND Comms Online
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                            24h requires: Tier ≥ 4 AND Comms Online
                        </Typography>
                    </Box>

                    <Box>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                            What these do
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            CloudWatch: observes cloud optical depth/coverage → improves “what’s happening now.”
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            AMVs: derived winds in cloudy regions → improves storm motion (reduces displacement errors).
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Radiosondes: vertical profiles → improves intensity/structure (reduces phantom storms).
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Radar: precip structure now → improves 0–3h precip nowcast/verification near radar.
                        </Typography>
                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                            Surface sites primarily constrain pressure patterns (synoptic).
                        </Typography>
                    </Box>
                </Paper>
            )}

            <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
            {selectionDragRect && (
                <div
                    style={{
                        position: 'absolute',
                        left: selectionDragRect.left,
                        top: selectionDragRect.top,
                        width: selectionDragRect.width,
                        height: selectionDragRect.height,
                        border: '1px dashed rgba(255,255,255,0.9)',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        pointerEvents: 'none',
                        zIndex: 1500
                    }}
                />
            )}
            {selectionMenu && (
                <Paper
                    style={{
                        position: 'absolute',
                        left: selectionMenu.x,
                        top: selectionMenu.y,
                        padding: 10,
                        zIndex: 1600,
                        minWidth: 180,
                        ...panelSurfaceStyle
                    }}
                >
                    <Typography variant="caption" style={panelTitleStyle}>
                        Area Actions
                    </Typography>
                    <Box mt={1} display="flex" flexDirection="column" gap={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            sx={panelButtonSx}
                            disabled={!selectionMenu.eligibility?.image?.enabled}
                            onClick={() => handleSelectionAction('image')}
                        >
                            Image
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            sx={panelButtonSx}
                            disabled={!selectionMenu.eligibility?.sar?.enabled}
                            onClick={() => handleSelectionAction('sar')}
                        >
                            SAR Capture
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            sx={{
                                color: 'rgba(226,232,240,0.75)',
                                textTransform: 'none'
                            }}
                            onClick={clearSelection}
                        >
                            Cancel
                        </Button>
                    </Box>
                </Paper>
            )}
            <Paper
                style={{
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                    padding: showDebugPanel ? 10 : 6,
                    zIndex: 1200,
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    color: 'white',
                    maxHeight: '70vh',
                    overflow: 'hidden'
                }}
            >
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={showDebugPanel ? 1 : 0}>
                    <Typography variant="caption" style={{ color: 'white', fontWeight: 600 }}>Debug Layers</Typography>
                    <IconButton
                        size="small"
                        onClick={() => setShowDebugPanel(prev => !prev)}
                        aria-label="Toggle debug panel"
                        style={{ color: 'white' }}
                    >
                        {showDebugPanel ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                    </IconButton>
                </Box>
                {showDebugPanel && (
                    <Box style={{ maxHeight: 'calc(70vh - 28px)', overflowY: 'auto', paddingRight: 6 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={showFogLayer}
                                    onChange={(_, v) => setShowFogLayer(v)}
                                    color="primary"
                                />
                            }
                            label={<Typography variant="caption" style={{ color: 'white' }}>Fog of War</Typography>}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={showWeatherLayer}
                                    onChange={(_, v) => setShowWeatherLayer(v)}
                                    color="primary"
                                />
                            }
                            label={<Typography variant="caption" style={{ color: 'white' }}>Weather</Typography>}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={showWindStreamlines}
                                    onChange={(_, v) => setShowWindStreamlines(v)}
                                    color="primary"
                                />
                            }
                            label={<Typography variant="caption" style={{ color: 'white' }}>Wind Streamlines</Typography>}
                        />
                        {windRefEnabled && (
                            <Box mt={0.5} ml={1}>
                                <Typography variant="caption" style={{ color: 'white', fontWeight: 600 }}>
                                    Wind Source
                                </Typography>
                                <ToggleButtonGroup
                                    size="small"
                                    exclusive
                                    value={windStreamlineSource}
                                    onChange={(_, value) => {
                                        if (!value) return;
                                        if (value === 'reference' && !windRefStatus.loaded) return;
                                        setWindStreamlineSource(value);
                                        earthRef.current?.setWindStreamlineSource?.(value);
                                        earthRef.current?.windStreamlineRenderer?.reset?.();
                                    }}
                                    sx={{ mt: 0.5 }}
                                >
                                    <ToggleButton value="analysis" sx={{ color: 'white' }}>
                                        Model
                                    </ToggleButton>
                                    <ToggleButton value="reference" disabled={!windRefStatus.loaded} sx={{ color: 'white' }}>
                                        Reference (GFS)
                                    </ToggleButton>
                                </ToggleButtonGroup>
                                <Box mt={0.5}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={handleLoadWindReference}
                                        disabled={windRefStatus.loading}
                                        sx={{
                                            color: 'white',
                                            borderColor: 'rgba(255,255,255,0.4)'
                                        }}
                                    >
                                        {windRefStatus.loading ? 'Loading...' : 'Load Reference Fixture'}
                                    </Button>
                                </Box>
                                {windRefStatus.error && (
                                    <Typography variant="caption" style={{ color: '#ff8080', display: 'block', marginTop: 4 }}>
                                        {windRefStatus.error}
                                    </Typography>
                                )}
                            </Box>
                        )}
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={weatherViewSource === 'analysis'}
                                    onChange={(_, v) => setWeatherViewSource(v ? 'analysis' : 'truth')}
                                    color="primary"
                                />
                            }
                            label={<Typography variant="caption" style={{ color: 'white' }}>Analysis View</Typography>}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={sensorOnlyWeather}
                                    onChange={(_, v) => setSensorOnlyWeather(v)}
                                    color="primary"
                                />
                            }
                            label={<Typography variant="caption" style={{ color: 'white' }}>Sensor-Only Weather</Typography>}
                        />
                        <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>
                            Hide clouds; show only sensor detections.
                        </Typography>
                        <Box mt={1}>
                            <Typography variant="caption" style={{ color: 'white', fontWeight: 600 }}>
                                Sensors
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={showStationObs}
                                        onChange={(_, v) => setShowStationObs(v)}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>Surface sites</Typography>}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={showCloudObs}
                                        onChange={(_, v) => setShowCloudObs(v)}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>Cloud Sat</Typography>}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={showRadarObs}
                                        onChange={(_, v) => setShowRadarObs(v)}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>Ground Radar</Typography>}
                            />
                            <FormControl size="small" fullWidth variant="outlined" sx={{ mt: 0.5 }}>
                                <InputLabel style={{ color: 'white' }}>Cloud Product</InputLabel>
                                <Select
                                    value={cloudObsProduct}
                                    onChange={(e) => setCloudObsProduct(e.target.value)}
                                    label="Cloud Product"
                                    sx={{
                                        color: 'white',
                                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                    }}
                                >
                                    <MenuItem value="tauTotal">Tau Total</MenuItem>
                                    <MenuItem value="tauHigh">Tau High</MenuItem>
                                    <MenuItem value="tauLow">Tau Low</MenuItem>
                                    <MenuItem value="cloudHigh">Cloud High</MenuItem>
                                    <MenuItem value="cloudLow">Cloud Low</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                        <Box mt={1}>
                            <Typography variant="caption" style={{ color: 'white', fontWeight: 600 }}>
                                Warnings
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={warningDrawMode}
                                        onChange={(_, v) => setWarningDrawMode(v)}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>Draw Warning</Typography>}
                            />
                            <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                Vertices: {warningDraft.vertices.length}
                            </Typography>
                            <Box mt={0.5} display="flex" gap={1} flexWrap="wrap">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => setWarningDraft(prev => ({ ...prev, vertices: prev.vertices.slice(0, -1) }))}
                                    disabled={warningDraft.vertices.length === 0}
                                >
                                    Undo
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => setWarningDraft(prev => ({ ...prev, vertices: [] }))}
                                    disabled={warningDraft.vertices.length === 0}
                                >
                                    Clear
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => setWarningDrawMode(false)}
                                >
                                    Finish
                                </Button>
                            </Box>
                            <FormControl size="small" fullWidth variant="outlined" sx={{ mt: 0.5 }}>
                                <InputLabel style={{ color: 'white' }}>Hazard</InputLabel>
                                <Select
                                    value={warningDraft.hazardType}
                                    onChange={(e) => setWarningDraft(prev => ({ ...prev, hazardType: e.target.value }))}
                                    label="Hazard"
                                    sx={{
                                        color: 'white',
                                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                    }}
                                >
                                    {unlockedWarningHazards.map((hazard) => (
                                        <MenuItem key={hazard} value={hazard}>
                                            {HAZARD_LABELS[hazard] ?? hazard}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Box mt={0.5} display="flex" gap={1}>
                                <FormControl size="small" fullWidth variant="outlined" sx={{ flex: 1 }}>
                                    <InputLabel style={{ color: 'white' }}>Start (h)</InputLabel>
                                    <Select
                                        value={warningDraft.validStartHours}
                                        onChange={(e) => setWarningDraft(prev => ({ ...prev, validStartHours: Number(e.target.value) }))}
                                        label="Start (h)"
                                        sx={{
                                            color: 'white',
                                            '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                        }}
                                    >
                                        {unlockedForecastLeads.map((h) => (
                                            <MenuItem key={h} value={h}>{formatHoursLabel(h)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    size="small"
                                    label="Duration (h)"
                                    value={warningDraft.validDurationHours}
                                    onChange={(e) => setWarningDraft(prev => ({ ...prev, validDurationHours: e.target.value }))}
                                    InputLabelProps={{ style: { color: 'white' } }}
                                    inputProps={{ style: { color: 'white' } }}
                                    sx={{ flex: 1, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' } }}
                                />
                            </Box>
                            <Box mt={0.5}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={issueWarning}
                                >
                                    Issue Warning
                                </Button>
                            </Box>
                            <Box mt={0.5}>
                                {(warningsByPlayerId[activePlayerId] || []).map((w) => (
                                    <Typography key={w.id} variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                        {w.hazardType} {w.outcome ? `(${w.outcome})` : ''}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                        <Box mt={1}>
                            <FormControl size="small" fullWidth variant="outlined">
                                <InputLabel style={{ color: 'white' }}>Weather Debug</InputLabel>
                                <Select
                                    value={weatherDebugMode}
                                    onChange={(e) => setWeatherDebugMode(e.target.value)}
                                    label="Weather Debug"
                                    sx={{
                                        color: 'white',
                                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                    }}
                                >
                                    {WEATHER_DEBUG_OPTIONS.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                        <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => setSimPausedUI(prev => !prev)}
                            >
                                {simPausedUI ? 'Resume Sim' : 'Pause Sim'}
                            </Button>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={weatherV2ConvectionEnabled}
                                        onChange={handleV2ConvectionToggle}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>V2 Convection</Typography>}
                            />
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    queueSimAdvanceSeconds(3600, { burst: true });
                                }}
                            >
                                Step +1 hour
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    queueSimAdvanceSeconds(86400, { burst: true });
                                }}
                            >
                                Step +1 day
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    queueSimAdvanceSeconds(MONTH_SECONDS, { burst: true });
                                }}
                            >
                                Step +1 month
                            </Button>
                        </Box>
                        <Box mt={1}>
                            <Typography variant="caption" display="block" style={{ color: 'white' }}>
                                Sim speed: {simSpeedUI.toLocaleString()}x
                            </Typography>
                            <Slider
                                size="small"
                                min={0}
                                max={Math.log10(SIM_SPEED_MAX)}
                                step={0.1}
                                marks={SIM_SPEED_MARKS}
                                value={speedToSliderValue(simSpeedUI)}
                                onChange={handleSimSpeedChange}
                                sx={{ color: 'white' }}
                            />
                        </Box>
                        <Typography variant="caption" display="block" style={{ color: 'white', marginTop: 6 }}>
                            Sim time: {simTimeLabel}{simPausedUI ? ' (paused)' : ''}
                        </Typography>
                        <Box mt={1}>
                            <Typography variant="caption" display="block" style={{ color: 'white' }}>
                                Weather Log Capture
                            </Typography>
                            <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={toggleWeatherLogCapture}
                                >
                                    {weatherLogEnabled ? 'Stop Capture' : 'Start Capture'}
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={clearWeatherLogCapture}
                                >
                                    Clear
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={downloadWeatherLogCapture}
                                    disabled={weatherLogCount === 0}
                                >
                                    Download
                                </Button>
                            </Box>
                            <Box mt={1}>
                                <FormControl size="small" fullWidth variant="outlined">
                                    <InputLabel style={{ color: 'white' }}>Log Cadence</InputLabel>
                                    <Select
                                        value={weatherLogCadence}
                                        onChange={handleWeatherLogCadenceChange}
                                        label="Log Cadence"
                                        sx={{
                                            color: 'white',
                                            '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                        }}
                                    >
                                        {WEATHER_LOG_CADENCE_OPTIONS.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                            <Typography variant="caption" display="block" style={{ color: 'white', marginTop: 4 }}>
                                Entries: {weatherLogCount}{weatherLogEnabled ? ' (capturing)' : ''}
                            </Typography>
                        </Box>
                        <Box mt={1}>
                            <Typography variant="caption" display="block" style={{ color: 'white' }}>
                                Zonal Mean ({weatherDebugMode})
                            </Typography>
                            <canvas
                                ref={zonalCanvasRef}
                                width={180}
                                height={120}
                                style={{ width: 180, height: 120, border: '1px solid rgba(255,255,255,0.2)' }}
                            />
                        </Box>
                        <Box display="flex" gap={1} mt={1} alignItems="center">
                            <TextField
                                size="small"
                                variant="outlined"
                                label="Seed"
                                value={weatherSeedInput}
                                onChange={handleWeatherSeedChange}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        applyWeatherSeed();
                                    }
                                }}
                                InputLabelProps={{ style: { color: 'white' } }}
                                inputProps={{ style: { color: 'white' } }}
                            />
                            <Button size="small" variant="outlined" color="inherit" onClick={applyWeatherSeed}>
                                Apply
                            </Button>
                        </Box>
                        <Typography variant="caption" display="block" style={{ color: 'white', marginTop: 4 }}>
                            Current seed: {weatherSeed || '...'}
                        </Typography>
                    </Box>
                )}
            </Paper>

	            <Box
	                sx={{
	                    position: 'absolute',
	                    top: 20,
	                    right: 10,
	                    zIndex: 1000,
	                    display: 'flex',
	                    flexDirection: 'column',
	                    alignItems: 'flex-end',
	                    textAlign: 'right',
	                    pointerEvents: 'none'
	                }}
	            >
	                <Box sx={{ display: 'flex', gap: 4, alignItems: 'baseline', justifyContent: 'flex-end' }}>
	                    <Typography variant="h6" style={{ color: 'white' }}>
	                        Funds: {'$'}{Math.round((currentPlayerRef.current?.funds ?? 0) / 1_000_000)}M
	                    </Typography>
	                    <Typography variant="h6" style={{ color: 'white' }}>
	                        Turn: {currentTurn} | AP: {actionPoints}
	                    </Typography>
	                </Box>
	                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)', marginTop: 4 }}>
	                    {overlayLabelText}
	                </Typography>
	                {runScoreLabel && (
	                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', marginTop: 2 }}>
	                        {runScoreLabel}
	                    </Typography>
	                )}
	                {bestScoreLabel && (
	                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.75)', marginTop: 2 }}>
	                        {bestScoreLabel}
	                    </Typography>
	                )}
                {sensorHudText && (
                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.7)', marginTop: 2, maxWidth: 520 }}>
                        {sensorHudText}
                    </Typography>
                )}
                {cloudWatchDebugEnabled && cloudWatchDebugInfo.length > 0 && (
                    <Box sx={{ marginTop: 1, maxWidth: 520 }}>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)' }}>
                            CloudWatch debug
                        </Typography>
                        {cloudWatchDebugInfo.map((entry) => (
                            <Typography
                                key={entry.satId}
                                variant="caption"
                                style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}
                            >
                                {entry.satId}: sub({formatDebugDeg(entry.subpointLatDeg)},{formatDebugDeg(entry.subpointLonDeg)})
                                {' '}fp({formatDebugDeg(entry.footprintLatDeg)},{formatDebugDeg(entry.footprintLonDeg)})
                                {' '}d={formatDebugSep(entry.separationDeg)}°
                            </Typography>
                        ))}
                    </Box>
                )}
            </Box>
            <Box
                sx={{
                    position: 'absolute',
                    bottom: 10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    padding: '4px 12px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(10,14,22,0.75)',
                    border: '1px solid rgba(148,163,184,0.35)'
                }}
            >
                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.9)' }}>
                    {cursorReadout} · {anchorReadout}
                </Typography>
            </Box>

	            {showMenu && (
	                <Paper style={{ position: 'absolute', top: 64, left: 10, padding: 12, zIndex: 1100, minWidth: 160, ...panelSurfaceStyle }}>
	                    <Typography variant="caption" style={panelTitleStyle}>
	                        Operations
	                    </Typography>
	                    <Box display="flex" flexDirection="column" gap={1} mt={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            sx={panelButtonSx}
                            onClick={(e) => {
                                // entering HQ placement hides other panels + preview
                                setShowSatPanel(false);
                                setShowStrikePad(false);
                                removeOrbitPreview();
                                handleHQButtonClick(e);
                            }}
                        >
                            HQ
                        </Button>

                        <Button
                            size="small"
                            variant="outlined"
                            sx={panelButtonSx}
                            onClick={() => {
                                setShowSatPanel(prev => {
                                    const next = !prev;
                                    if (next) {
                                        // opening SAT editor closes Strike Pad
                                        setShowStrikePad(false);
                                    } else {
                                        // closing SAT editor clears preview
                                        removeOrbitPreview();
                                    }
                                    return next;
                                });
                            }}
                        >
                            Satellites
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            sx={panelButtonSx}
                            onClick={(event) => {
                                setShowSatPanel(false);
                                setShowStrikePad(false);
                                removeOrbitPreview();
                                showHQSphereRef.current = false;
                                if (hqSphereRef.current) {
                                    sceneRef.current?.remove(hqSphereRef.current);
                                    hqSphereRef.current = null;
                                }
                                const next = !placeUplinkHubRef.current;
                                placeUplinkHubRef.current = next;
                                const earth = earthRef.current;
                                if (next) {
                                    const latLon = getEarthClickLatLonDeg(event) || { latDeg: 0, lonDeg: 0 };
                                    if (earth?.parentObject) {
                                        const ghost = createUplinkHubGhostMesh(earth, latLon.latDeg, latLon.lonDeg);
                                        uplinkHubGhostRef.current = ghost;
                                        earth.parentObject.add(ghost);
                                    }
                                } else if (uplinkHubGhostRef.current) {
                                    uplinkHubGhostRef.current.parent?.remove?.(uplinkHubGhostRef.current);
                                    uplinkHubGhostRef.current = null;
                                }
                            }}
                        >
                            Build Uplink Hub
                        </Button>

                        {gameMode === 'pvp' && (
                            <Button
                                size="small"
                                variant="outlined"
                                sx={panelButtonSx}
                                onClick={() => {
                                    setShowStrikePad(prev => {
                                        const next = !prev;
                                        if (next) {
                                            // opening Strike Pad closes SAT editor & clears preview
                                            setShowSatPanel(false);
                                            removeOrbitPreview();
                                        }
                                        return next;
                                    });
                                }}
                            >
                                Strike
                            </Button>
                        )}
                    </Box>
                </Paper>
            )}

            {gameMode && (
                <Box
                    style={{
                        position: 'absolute',
                        top: 120,
                        right: 10,
                        width: 260,
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        maxHeight: 'calc(100vh - 140px)',
                        overflowY: 'auto',
                        pointerEvents: 'auto'
                    }}
                >
                    {activePostmortem && renderRightPanelSection({
                        title: 'Postmortem',
                        open: showPostmortemPanel,
                        onToggle: () => setShowPostmortemPanel(prev => !prev),
                        children: (
                            <Box display="flex" flexDirection="column" gap={0.6}>
                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.9)' }}>
                                    {postmortemLabel}
                                </Typography>
                                <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)' }}>
                                    Best overlap: {postmortemBestOverlapLabel}
                                </Typography>
                                <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.7)' }}>
                                    Event footprint vs warning outline
                                </Typography>
                                <Box
                                    sx={{
                                        border: '1px solid rgba(148,163,184,0.35)',
                                        borderRadius: 1,
                                        overflow: 'hidden',
                                        width: 240,
                                        height: 120
                                    }}
                                >
                                    <canvas ref={postmortemCanvasRef} width={240} height={120} />
                                </Box>
                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)', marginTop: 4 }}>
                                    Classification: {postmortemClassLabel}
                                </Typography>
                                {postmortemDetailLines.map((line, idx) => (
                                    <Typography key={`postmortem-detail-${idx}`} variant="caption" style={{ color: 'rgba(148,163,184,0.8)' }}>
                                        {line}
                                    </Typography>
                                ))}
                                <Box display="flex" gap={0.5} mt={0.5}>
                                    {postmortemQueueSize > 0 && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            sx={panelButtonSx}
                                            onClick={() => {
                                                setShowPostmortemPanel(true);
                                                nextPostmortem();
                                            }}
                                        >
                                            Next
                                        </Button>
                                    )}
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        sx={panelButtonSx}
                                        onClick={() => {
                                            clearPostmortems();
                                            setShowPostmortemPanel(false);
                                        }}
                                    >
                                        Close
                                    </Button>
                                </Box>
                            </Box>
                        )
                    })}
                    {renderRightPanelSection({
                        title: 'Satellites',
                        open: showSatListPanel,
                        onToggle: () => setShowSatListPanel(prev => !prev),
                        children: renderSatellitesPanel()
                    })}
                    {renderRightPanelSection({
                        title: 'Info',
                        open: showInfoPanel,
                        onToggle: () => setShowInfoPanel(prev => !prev),
                        children: (
                            <Box display="flex" flexDirection="column" gap={1}>
                                {!selectedUplinkHub && !focusedWarningInfo && (
                                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)' }}>
                                        No hub or warning selected.
                                    </Typography>
                                )}
                                {selectedUplinkHub && (
                                    <Box>
                                        <Typography variant="caption" style={panelTitleStyle}>
                                            Uplink Hub
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)', display: 'block' }}>
                                            Lat {selectedUplinkHub.latDeg.toFixed(1)}°, Lon {selectedUplinkHub.lonDeg.toFixed(1)}°
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                                            Surface: {selectedUplinkHub.modules?.surface ? 'On' : 'Off'} · Radiosonde: {selectedUplinkHub.modules?.radiosonde ? 'On' : 'Off'}
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                                            Radar: {selectedUplinkHub.modules?.radar ? 'On' : 'Off'} · Dense Surface: {selectedUplinkHub.modules?.denseSurface ? 'On' : 'Off'}
                                        </Typography>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            sx={{ ...panelButtonSx, marginTop: 0.5 }}
                                            disabled={!canAddRadiosondeModule}
                                            onClick={addRadiosondeModuleToSelectedHub}
                                        >
                                            Add Radiosonde Module ($18M, 1 AP)
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            sx={{ ...panelButtonSx, marginTop: 0.5 }}
                                            disabled={!canAddRadarModule}
                                            onClick={() => {
                                                const player = currentPlayerRef.current;
                                                const registry = actionRegistryRef.current;
                                                if (!player) return;
                                                if (registry?.perform) {
                                                    const ok = registry.perform('ADD_RADAR_MODULE', player.id, {
                                                        applyFn: addRadarModuleToSelectedHub,
                                                        moneyCost: 22_000_000
                                                    });
                                                    if (!ok) {
                                                        notify('warning', 'Upgrade blocked: not your turn, insufficient AP, or insufficient funds.');
                                                    }
                                                } else {
                                                    addRadarModuleToSelectedHub();
                                                }
                                            }}
                                        >
                                            Add Radar Module ($22M, 1 AP)
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            sx={{ ...panelButtonSx, marginTop: 0.5 }}
                                            disabled={!canUpgradeDenseSurface}
                                            onClick={() => {
                                                const player = currentPlayerRef.current;
                                                const registry = actionRegistryRef.current;
                                                if (!player) return;
                                                if (registry?.perform) {
                                                    const ok = registry.perform('UPGRADE_DENSE_SURFACE', player.id, {
                                                        applyFn: upgradeDenseSurfaceForSelectedHub,
                                                        moneyCost: 30_000_000
                                                    });
                                                    if (!ok) {
                                                        notify('warning', 'Upgrade blocked: not your turn, insufficient AP, or insufficient funds.');
                                                    }
                                                } else {
                                                    upgradeDenseSurfaceForSelectedHub();
                                                }
                                            }}
                                        >
                                            Upgrade Dense Surface ($30M, 1 AP)
                                        </Button>
                                        {!selectedUplinkHub.isOnline && (
                                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.7)', display: 'block', marginTop: 2 }}>
                                                Hub is offline — modules won't contribute until backhaul is online.
                                            </Typography>
                                        )}
                                        <Typography
                                            variant="caption"
                                            style={{
                                                color: selectedUplinkHub.isOnline ? 'rgba(74,222,128,0.9)' : 'rgba(148,163,184,0.7)',
                                                display: 'block'
                                            }}
                                        >
                                            {selectedUplinkHub.isOnline ? 'Online' : 'Offline'} — {selectedUplinkHub.onlineReason || 'Status unknown'}
                                        </Typography>
                                    </Box>
                                )}
                                {focusedWarningInfo && (
                                    <Box>
                                        <Typography variant="caption" style={panelTitleStyle}>
                                            Warning Focus
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)', display: 'block' }}>
                                            {HAZARD_LABELS[focusedWarningInfo.hazardType] || focusedWarningInfo.hazardType}
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)', display: 'block' }}>
                                            Issued: {formatSimTime(focusedWarningInfo.issuedAtSimTimeSeconds)}
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)', display: 'block' }}>
                                            Valid: {formatSimTime(focusedWarningInfo.validStartSimTimeSeconds)} → {formatSimTime(focusedWarningInfo.validEndSimTimeSeconds)}
                                        </Typography>
                                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)', display: 'block' }}>
                                            {formatHoursLabel(focusedWarningInfo.forecastLeadHours)} {focusedWarningInfo.autoIssued ? '(auto)' : ''}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        )
                    })}
                    {renderRightPanelSection({
                        title: 'Forecast',
                        open: showForecastPanel,
                        onToggle: () => setShowForecastPanel(prev => !prev),
                        children: (
                            <>
                                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                                    <InputLabel sx={panelLabelSx}>In X hours</InputLabel>
                                    <Select
                                        value={forecastLeadHours}
                                        onChange={(e) => setForecastLeadHours(Number(e.target.value))}
                                        label="In X hours"
                                        sx={panelInputSx}
                                    >
                                        {unlockedForecastLeads.map((h) => (
                                            <MenuItem key={h} value={h}>{formatHoursLabel(h)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={forecastStatus.running}
                                        onClick={runForecast}
                                        sx={panelButtonSx}
                                    >
                                        {forecastStatus.running ? 'Running...' : 'Run Forecast'}
                                    </Button>
                                    <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.7)' }}>
                                        {forecastStatus.running
                                            ? `${Math.round((forecastStatus.progress01 || 0) * 100)}% ${forecastStatus.message || ''}`
                                            : formatHoursLabel(forecastLeadHours)}
                                    </Typography>
                                </Box>
                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.7)', marginTop: 6, display: 'block' }}>
                                    Base: {forecastBaseTimeSeconds != null ? formatSimTime(forecastBaseTimeSeconds) : 'n/a'}
                                </Typography>
                                <Box mt={1}>
                                    <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                                        Forecast Tech: Tier {currentTier} — {currentTierSpec?.name ?? 'Unknown'}
                                    </Typography>
                                    {nextTierSpec ? (
                                        <>
                                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.9)', display: 'block', marginTop: 2 }}>
                                                Next: Tier {currentTier + 1} — {nextTierSpec.name} (${Math.round((nextTierSpec.costMoney ?? 0) / 1_000_000)}M, 1 AP)
                                            </Typography>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                sx={{ ...panelButtonSx, marginTop: 0.5 }}
                                                onClick={upgradeForecastTech}
                                                disabled={!canUpgradeForecast || !hasHqForUpgrade}
                                            >
                                                Upgrade
                                            </Button>
                                        </>
                                    ) : (
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.9)', display: 'block', marginTop: 2 }}>
                                            Forecast tech is fully upgraded.
                                        </Typography>
                                    )}
                                </Box>
                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)', marginTop: 4, display: 'block' }}>
                                    Confidence = analysis certainty here; better sensors raise it.
                                </Typography>
                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.7)', marginTop: 2, display: 'block' }}>
                                    Daily goal: {hitsTodayDisplay}/{DAILY_GOAL_HITS} hits today
                                </Typography>
                                <Typography
                                    variant="caption"
                                    style={{
                                        color: playerHasComms ? 'rgba(74,222,128,0.9)' : 'rgba(251,191,36,0.9)',
                                        marginTop: 2,
                                        display: 'block'
                                    }}
                                >
                                    Comms: {playerHasComms ? 'Online' : 'Offline'}
                                </Typography>
                                {longRangeLocked && (
                                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', marginTop: 2, display: 'block' }}>
                                        Long-range (12–24h) requires a comm satellite in link.
                                    </Typography>
                                )}
                                {radiosonde12Locked && (
                                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', marginTop: 2, display: 'block' }}>
                                        12h requires an online radiosonde site.
                                    </Typography>
                                )}
                                {lead24Locked && (
                                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', marginTop: 2, display: 'block' }}>
                                        24h requires: broader network (surface + radiosondes) + sustained CloudWatch coverage.
                                    </Typography>
                                )}
                                <Box mt={1}>
                                    <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>
                                        Drafts
                                    </Typography>
                                    {draftWarnings.length === 0 ? (
                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                                            No draft warnings yet.
                                        </Typography>
                                    ) : (
                                        <Box mt={0.5} display="flex" flexDirection="column" gap={0.5}>
                                            {draftWarnings.map((draft) => (
                                                <Box key={draft.id} display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                                                    <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>
                                                        {HAZARD_LABELS[draft.hazardType] ?? draft.hazardType} · {formatHoursLabel(draft.forecastLeadHours)} · {Number.isFinite(draft.areaFracService) ? `${Math.round(draft.areaFracService * 100)}%` : '—'}
                                                    </Typography>
                                                    <Box display="flex" gap={0.5}>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            sx={panelButtonSx}
                                                            onClick={() => issueDraftWarning(draft)}
                                                        >
                                                            Issue
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            sx={panelButtonSx}
                                                            onClick={() => discardDraftWarning(draft)}
                                                        >
                                                            Discard
                                                        </Button>
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    )}
                                </Box>
                                {hasForecastRun && (
                                    <Box mt={1}>
                                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>
                                            Auto-warning diagnostics
                                        </Typography>
                                        {autoWarningDiagnostics ? (
                                            <Box mt={0.5} display="flex" flexDirection="column" gap={0.5}>
                                                <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)' }}>
                                                    Service area cells: {formatDiagCount(autoWarningDiagnostics.serviceCellCount)}
                                                </Typography>
                                                {unlockedWarningHazards.map((hazardType) => {
                                                    const diag = autoWarningDiagnostics.hazards?.[hazardType];
                                                    return (
                                                        <Box key={hazardType} display="flex" flexDirection="column" gap={0.2}>
                                                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>
                                                                {HAZARD_LABELS[hazardType] ?? hazardType}
                                                            </Typography>
                                                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)' }}>
                                                                max {formatDiagNumber(diag?.maxValue)} · thr {formatDiagNumber(diag?.thresholdUsed)} · cells {formatDiagCount(diag?.cellsOverThreshold)}
                                                            </Typography>
                                                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.75)' }}>
                                                                comps {formatDiagCount(diag?.componentCount)} · drop&lt;min {formatDiagCount(diag?.componentsDroppedTooSmall)} · drop&gt;cap {formatDiagCount(diag?.componentsDroppedAreaCap)} · drafts {formatDiagCount(diag?.draftCount)}
                                                            </Typography>
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        ) : (
                                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                                                Run a forecast to see auto-warning diagnostics.
                                            </Typography>
                                        )}
                                    </Box>
                                )}
                                <Box mt={1}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => setShowForecastAdvanced(prev => !prev)}
                                        endIcon={showForecastAdvanced ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                                        sx={panelButtonSx}
                                    >
                                        Advanced
                                    </Button>
                                </Box>
                                {showForecastAdvanced && (
                                    <Box mt={1}>
                                        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                                            <InputLabel sx={panelLabelSx}>Product</InputLabel>
                                            <Select
                                                value={forecastProduct}
                                                onChange={(e) => {
                                                    warningOverlayFocusRef.current.activeHazardType = null;
                                                    setForecastProduct(e.target.value);
                                                }}
                                                label="Product"
                                                sx={panelInputSx}
                                            >
                                                {['precipRate', 'windSpeed', 'cloudTau', 'confidence'].map((value) => (
                                                    <MenuItem key={value} value={value}>
                                                        {FORECAST_PRODUCT_LABELS[value] ?? value}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={showForecastOverlay}
                                                    onChange={(_, v) => {
                                                        warningOverlayFocusRef.current.activeHazardType = null;
                                                        setShowForecastOverlay(v);
                                                    }}
                                                    color="primary"
                                                />
                                            }
                                            label={<Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>Show overlay</Typography>}
                                        />
                                    </Box>
	                                )}
	                            </>
	                        )
	                    })}
                        {showForecastReport && renderRightPanelSection({
                            title: 'Forecast Report',
                            open: true,
                            onToggle: () => setShowForecastReport(false),
                            children: (() => {
                                const pid = currentPlayer?.id != null ? String(currentPlayer.id) : null;
                                const reportRuns = pid ? (forecastReportByPlayerIdRef.current[pid] || []) : [];
                                const hubs = pid ? (uplinkHubsByPlayerIdRef.current[pid] || []) : [];
                                const totalHubs = hubs.length;
                                const onlineHubs = hubs.filter(h => h?.isOnline).length;
                                const onlineSurface = hubs.filter(h => h?.isOnline && h?.modules?.surface).length;
                                const onlineRadiosonde = hubs.filter(h => h?.isOnline && h?.modules?.radiosonde).length;
                                const onlineRadar = hubs.filter(h => h?.isOnline && h?.modules?.radar).length;
                                const onlineDenseSurface = hubs.filter(h => h?.isOnline && h?.modules?.denseSurface).length;
                                const fmtPct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—');
                                const fmtNum = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : '—');

                                const unlockedLeads = Array.isArray(currentTierSpec?.unlockedLeads)
                                    ? currentTierSpec.unlockedLeads
                                    : [];

                                return (
                                    <Box key={`forecast-report-${forecastReportVersion}`} display="flex" flexDirection="column" gap={1}>
                                        <Box>
                                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                                                Tier {currentTier}: {currentTierSpec?.name ?? 'Unknown'}
                                            </Typography>
                                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                                                Unlocked leads: {unlockedLeads.length ? unlockedLeads.map(formatHoursLabel).join(', ') : '—'}
                                            </Typography>
                                        </Box>

                                        <Box>
                                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                                                Sensor network
                                            </Typography>
                                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                                                Hubs: {totalHubs} total, {onlineHubs} online
                                            </Typography>
                                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', display: 'block' }}>
                                                Online modules: Surface {onlineSurface}, Radiosonde {onlineRadiosonde}, Radar {onlineRadar}, Dense {onlineDenseSurface}
                                            </Typography>
                                        </Box>

	                                        <Box>
	                                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
	                                                Last {FORECAST_REPORT_MAX_RUNS} forecasts
	                                            </Typography>
                                            {reportRuns.length === 0 ? (
                                                <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                                                    Run a forecast to generate metrics.
                                                </Typography>
                                            ) : (
                                                <Box mt={0.5} display="flex" flexDirection="column" gap={1}>
                                                    {reportRuns.map((run) => {
                                                        const baseLabel = Number.isFinite(run.baseSimTimeSeconds)
                                                            ? formatSimTime(run.baseSimTimeSeconds)
                                                            : 'Time unknown';
                                                        const hazards = run.byHazard || {};
                                                        const leadList = Array.isArray(run.leadHours) ? run.leadHours : [];
                                                        return (
                                                            <Box key={run.runId || baseLabel}>
                                                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>
                                                                    Run {baseLabel}
                                                                </Typography>
                                                                {Object.keys(HAZARD_LABELS).map((hazardType) => {
                                                                    const hazardLabel = HAZARD_LABELS[hazardType] ?? hazardType;
                                                                    const byLead = hazards[hazardType] || {};
                                                                    return (
                                                                        <Box key={`${run.runId}-${hazardType}`} mt={0.25}>
                                                                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.9)' }}>
                                                                                {hazardLabel}
                                                                            </Typography>
                                                                            {leadList.map((leadHours) => {
                                                                                const bucket = byLead[leadHours] || null;
                                                                                if (!bucket) return null;
                                                                                return (
                                                                                    <Typography
                                                                                        key={`${run.runId}-${hazardType}-${leadHours}`}
                                                                                        variant="caption"
                                                                                        style={{ color: 'rgba(148,163,184,0.75)', display: 'block' }}
                                                                                    >
                                                                                        {formatHoursLabel(leadHours)} · P {fmtPct(bucket.precision)} / R {fmtPct(bucket.recall)} · IoU {fmtNum(bucket.meanIoU)} · Lead {fmtNum(bucket.meanLeadHours, 1)}h · Miss {fmtPct(bucket.missRate)}
                                                                                    </Typography>
                                                                                );
                                                                            })}
                                                                        </Box>
                                                                    );
                                                                })}
                                                            </Box>
                                                        );
                                                    })}
                                                </Box>
	                                            )}
	                                        </Box>
                                        {process.env.NODE_ENV !== 'production' && (
                                            <Box mt={1}>
                                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                                                    Tuning (dev)
                                                </Typography>
                                                <Box mt={0.5} display="flex" flexDirection="column" gap={0.75}>
                                                    <TextField
                                                        size="small"
                                                        type="number"
                                                        label="IoU match min"
                                                        value={tuningParams.iouMatchMin}
                                                        onChange={(e) => {
                                                            const next = Number(e.target.value);
                                                            if (!Number.isFinite(next)) return;
                                                            setTuningParams(prev => ({ ...prev, iouMatchMin: next }));
                                                        }}
                                                        sx={panelInputSx}
                                                        InputLabelProps={{ sx: panelLabelSx }}
                                                    />
                                                    <TextField
                                                        size="small"
                                                        type="number"
                                                        label="Min component cells"
                                                        value={tuningParams.minComponentCells}
                                                        onChange={(e) => {
                                                            const next = Math.round(Number(e.target.value));
                                                            if (!Number.isFinite(next)) return;
                                                            setTuningParams(prev => ({ ...prev, minComponentCells: next }));
                                                        }}
                                                        sx={panelInputSx}
                                                        InputLabelProps={{ sx: panelLabelSx }}
                                                    />
                                                    <Box>
                                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.9)' }}>
                                                            Hazard thresholds
                                                        </Typography>
                                                        {Object.keys(HAZARD_LABELS).map((hazardType) => (
                                                            <TextField
                                                                key={`thr-${hazardType}`}
                                                                size="small"
                                                                type="number"
                                                                label={HAZARD_LABELS[hazardType] ?? hazardType}
                                                                value={tuningParams.thresholdsByHazard?.[hazardType] ?? ''}
                                                                onChange={(e) => {
                                                                    const next = Number(e.target.value);
                                                                    if (!Number.isFinite(next)) return;
                                                                    setTuningParams(prev => ({
                                                                        ...prev,
                                                                        thresholdsByHazard: {
                                                                            ...(prev.thresholdsByHazard || {}),
                                                                            [hazardType]: next
                                                                        }
                                                                    }));
                                                                }}
                                                                sx={{ ...panelInputSx, mt: 0.5 }}
                                                                InputLabelProps={{ sx: panelLabelSx }}
                                                            />
                                                        ))}
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.9)' }}>
                                                            Area caps (service fraction)
                                                        </Typography>
                                                        {Object.keys(HAZARD_LABELS).map((hazardType) => (
                                                            <Box key={`caps-${hazardType}`} mt={0.5}>
                                                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>
                                                                    {HAZARD_LABELS[hazardType] ?? hazardType}
                                                                </Typography>
                                                                <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.25}>
                                                                    {[1, 3, 6, 12, 24].map((lead) => (
                                                                        <TextField
                                                                            key={`cap-${hazardType}-${lead}`}
                                                                            size="small"
                                                                            type="number"
                                                                            label={formatHoursLabel(lead)}
                                                                            value={tuningParams.areaCapsByHazardByLead?.[hazardType]?.[lead] ?? ''}
                                                                            onChange={(e) => {
                                                                                const next = Number(e.target.value);
                                                                                if (!Number.isFinite(next)) return;
                                                                                setTuningParams(prev => ({
                                                                                    ...prev,
                                                                                    areaCapsByHazardByLead: {
                                                                                        ...(prev.areaCapsByHazardByLead || {}),
                                                                                        [hazardType]: {
                                                                                            ...((prev.areaCapsByHazardByLead || {})[hazardType] || {}),
                                                                                            [lead]: next
                                                                                        }
                                                                                    }
                                                                                }));
                                                                            }}
                                                                            sx={{ ...panelInputSx, width: 110 }}
                                                                            InputLabelProps={{ sx: panelLabelSx }}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                    <Box>
                                                        <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.9)' }}>
                                                            Confidence multipliers
                                                        </Typography>
                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            label="Precision bonus max"
                                                            value={tuningParams.confidence?.precisionBonusMax ?? ''}
                                                            onChange={(e) => {
                                                                const next = Number(e.target.value);
                                                                if (!Number.isFinite(next)) return;
                                                                setTuningParams(prev => ({
                                                                    ...prev,
                                                                    confidence: { ...(prev.confidence || {}), precisionBonusMax: next }
                                                                }));
                                                            }}
                                                            sx={{ ...panelInputSx, mt: 0.5 }}
                                                            InputLabelProps={{ sx: panelLabelSx }}
                                                        />
                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            label="Precision conf start"
                                                            value={tuningParams.confidence?.precisionConfStart ?? ''}
                                                            onChange={(e) => {
                                                                const next = Number(e.target.value);
                                                                if (!Number.isFinite(next)) return;
                                                                setTuningParams(prev => ({
                                                                    ...prev,
                                                                    confidence: { ...(prev.confidence || {}), precisionConfStart: next }
                                                                }));
                                                            }}
                                                            sx={{ ...panelInputSx, mt: 0.5 }}
                                                            InputLabelProps={{ sx: panelLabelSx }}
                                                        />
                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            label="Precision conf full"
                                                            value={tuningParams.confidence?.precisionConfFull ?? ''}
                                                            onChange={(e) => {
                                                                const next = Number(e.target.value);
                                                                if (!Number.isFinite(next)) return;
                                                                setTuningParams(prev => ({
                                                                    ...prev,
                                                                    confidence: { ...(prev.confidence || {}), precisionConfFull: next }
                                                                }));
                                                            }}
                                                            sx={{ ...panelInputSx, mt: 0.5 }}
                                                            InputLabelProps={{ sx: panelLabelSx }}
                                                        />
                                                    </Box>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        sx={panelButtonSx}
                                                        onClick={() => setTuningParams(DEFAULT_TUNING)}
                                                    >
                                                        Reset to defaults
                                                    </Button>
                                                </Box>
                                            </Box>
                                        )}
	                                    </Box>
	                                );
	                            })()
	                        })}
	                </Box>
	            )}

            {showSatPanel && (
                <Paper style={{ position: 'absolute', top: gameMode === 'pvp' ? 270 : 240, left: 10, padding: 12, width: 260, zIndex: 1000, ...panelSurfaceStyle }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="subtitle2" style={panelTitleStyle}>
                            Satellite Ops
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => setShowSatPanel(false)}
                            sx={{
                                color: 'rgba(226,232,240,0.85)',
                                border: '1px solid rgba(148,163,184,0.3)',
                                borderRadius: 2,
                                padding: '2px',
                                '&:hover': { backgroundColor: 'rgba(30,41,59,0.8)' }
                            }}
                        >
                            <RemoveIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                        <InputLabel sx={panelLabelSx}>Type</InputLabel>
                        <Select
                            value={satelliteType}
                            onChange={(e) => setSatelliteType(e.target.value)}
                            label="Type"
                            sx={panelInputSx}
                        >
                            <MenuItem value="communication">Communication</MenuItem>
                            <MenuItem value="imaging">Recon Imaging</MenuItem>
                            <MenuItem value="cloudWatch">Cloud-Watch</MenuItem>
                            <MenuItem value="sar">SAR</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        size="small"
                        label="Altitude (km)"
                        type="number"
                        fullWidth
                        value={altitude}
                        onChange={(e) => {
                            const next = e.target.value;
                            altitudeRef.current = next;
                            setAltitude(next);
                        }}
                        sx={{ mb: 1, ...panelInputSx }}
                        InputLabelProps={{ sx: panelLabelSx }}
                    />
                    <TextField
                        size="small"
                        label="Speed (km/h)"
                        type="number"
                        fullWidth
                        value={speed}
                        onChange={(e) => setSpeed(e.target.value)}
                        sx={{ mb: 1, ...panelInputSx }}
                        InputLabelProps={{ sx: panelLabelSx }}
                    />
                    <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" style={panelLabelSx}>
                            Field of View
                        </Typography>
                        <Slider
                            value={fieldOfView}
                            onChange={(e, val) => setFieldOfView(val)}
                            step={0.01}
                            min={1.69}
                            max={7.95}
                            valueLabelDisplay="auto"
                            sx={panelSliderSx}
                        />
                    </Box>
                    <TextField
                        size="small"
                        label="Initial Angle"
                        type="number"
                        fullWidth
                        value={angle}
                        onChange={(e) => setAngle(e.target.value)}
                        sx={{ mb: 1, ...panelInputSx }}
                        InputLabelProps={{ sx: panelLabelSx }}
                    />
                    <TextField
                        size="small"
                        label="Inclination"
                        type="number"
                        fullWidth
                        value={inclination}
                        onChange={(e) => setInclination(e.target.value)}
                        sx={{ mb: 1, ...panelInputSx }}
                        InputLabelProps={{ sx: panelLabelSx }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleAddSatellite}
                        sx={{
                            backgroundColor: 'rgba(13,148,136,0.9)',
                            color: 'white',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': {
                                backgroundColor: 'rgba(15,118,110,1)'
                            }
                        }}
                    >
                        Launch (${Math.round(launchCost / 1_000_000)}M)
                    </Button>
                    <Typography variant="caption" display="block" style={{ marginTop: 8, color: 'rgba(226,232,240,0.75)' }}>
                        Uses AP and funds. AP left: {actionPoints}; Funds: {'$'}{Math.round((currentPlayerRef.current?.funds ?? 0) / 1_000_000)}M
                    </Typography>
                </Paper>
            )}

            {/* Strike Pad */}
            {gameMode === 'pvp' && showStrikePad && (
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

        </div>
    );


};

export default App;
