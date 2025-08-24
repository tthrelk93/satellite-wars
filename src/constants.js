// src/constants.js
export const COMM_RANGE_KM  = 40000; // sat <-> sat
export const HQ_RANGE_KM    = 3000;  // sat <-> HQ
export const SPACE_LOS_EPS  = 1e-3;  // both endpoints in space
// LoS epsilon when one endpoint is on the ground. Slightly relaxed to avoid edge-case false occlusions
export const GROUND_LOS_EPS = 5e-2;
