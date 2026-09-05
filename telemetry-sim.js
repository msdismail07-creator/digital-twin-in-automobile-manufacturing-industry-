// EV Digital Twin: Telemetry Simulation Engine
// Computes real-time physics, vehicle dynamics, safety metrics, and anomaly states.

class TelemetrySimulationEngine {
  constructor() {
    this.speedKmh = 72;
    this.simSpeed = 1.0;
    this.isPaused = false;
    
    // State of the 6 Subsystems
    this.state = {
      // 1. Gravity & Physics
      physics: {
        massKg: 2150,
        gravityG: 1.0,
        dropHeight: 0.0, // meters
        isDropping: false,
        dropVelocity: 0.0,
        peakImpactG: 1.0,
        chassisPitch: 0.0,
        chassisRoll: 0.0,
        gVector: { x: 0, y: -1.0, z: 0 },
        chassisIntegrity: 100, // %
        status: 'pass',
        errorMsg: null
      },

      // 2. Slip & Road Banking
      slip: {
        speedKmh: 75,
        curveRadiusM: 120,
        bankAngle: 8, // degrees
        frictionMu: 0.75, // 0.05 to 1.0
        escActive: true,
        slipRatio: 0.04,
        centrifugalForceKN: 7.8,
        requiredMu: 0.28,
        escInterventionPercent: 0,
        rollAngle: 0.5,
        status: 'pass',
        errorMsg: null
      },

      // 3. Airbag Deployment System
      airbag: {
        crashArmed: false,
        crashPulseG: 0.0,
        targetCrashSpeedKmh: 55,
        deploymentLatencyMs: 24, // target <= 35ms
        squibFired: false,
        squibResistanceOhm: 2.15, // nominal 2.0 - 2.5 ohm
        occupantPosition: 'optimal', // 'optimal', 'reclined', 'out_of_position'
        chassisDisplacementMm: 12, // frontal crumple
        sensorRedundancyOk: true,
        status: 'pass',
        errorMsg: null
      },

      // 4. Driver Drowsiness Dashboard
      drowsiness: {
        perclos: 0.06, // % of eye closure, target < 0.15
        blinkRatePerMin: 18,
        headPitchDeg: 2.5, // downward nod
        headYawDeg: 1.0,
        eyeClosureScore: 0.05, // 0 (open) to 1 (closed)
        steeringJitterEntropy: 0.35,
        alertnessScore: 92, // 0 to 100%
        microsleepDetected: false,
        alertLevel: 'nominal', // 'nominal', 'warning', 'critical'
        status: 'pass',
        errorMsg: null
      },

      // 5. Critical Terrain Tyre Conditioning
      tyre: {
        terrain: 'potholes', // 'potholes', 'hills', 'river_rocks'
        wheelTravel: { FL: 0, FR: 0, RL: 0, RR: 0 },
        pressurePsi: { FL: 34.2, FR: 34.5, RL: 35.0, RR: 34.8 },
        tempC: { FL: 38.5, FR: 39.2, RL: 41.0, RR: 40.5 },
        treadWearPercent: { FL: 94, FR: 93, RL: 92, RR: 92 },
        hydroplaningRiskPercent: 12,
        punctureDetected: false,
        suspensionBottoming: false,
        status: 'pass',
        errorMsg: null
      },

      // 6. Predictive Battery Capacity Calculator
      battery: {
        soc: 54.0, // %
        soh: 96.5, // %
        packCapacityKwh: 82.0,
        chargerType: 'dc_150', // 'ac_7', 'ac_11', 'ac_22', 'dc_50', 'dc_150', 'dc_350'
        chargerPowerKw: 150.0,
        actualPowerKw: 138.5,
        chargingCurrentA: 175.0,
        packVoltageV: 792.0,
        packTempC: 32.5,
        cellThermalGradientC: 2.4, // delta T between hottest and coolest cell
        internalResistanceMilliOhm: 24.2,
        timeTo80Min: 14.5,
        timeTo100Min: 38.2,
        cellTemps: new Array(24).fill(32.5),
        status: 'pass',
        errorMsg: null
      }
    };

    this.initDmsCanvas();
  }

  // --- Subsystem 1: Gravity & Physics Update ---
  updatePhysics(dt) {
    const p = this.state.physics;
    
    // Free-fall drop simulation
    if (p.isDropping) {
      p.dropVelocity += 9.81 * p.gravityG * dt;
      p.dropHeight -= p.dropVelocity * dt;

      if (p.dropHeight <= 0) {
        p.dropHeight = 0;
        p.isDropping = false;
        
        // Impact Deceleration G-force calculation
        const impactStroke = 0.22; // suspension + crumple stroke (m)
        const decel = (p.dropVelocity * p.dropVelocity) / (2 * impactStroke);
        p.peakImpactG = parseFloat((decel / 9.81 + p.gravityG).toFixed(2));
        
        // Chassis integrity degradation on severe impact
        if (p.peakImpactG > 2.5) {
          p.chassisIntegrity = Math.max(15, p.chassisIntegrity - (p.peakImpactG * 12));
          if (window.soundFX) window.soundFX.playImpact();
        } else {
          if (window.soundFX) window.soundFX.playBeep(440, 0.1);
        }
        p.dropVelocity = 0;
      }
    }

    // Dynamic G-vector calculation
    const baseG = p.gravityG;
    const dynamicLat = Math.sin(Date.now() * 0.002) * 0.12;
    p.gVector = {
      x: parseFloat(dynamicLat.toFixed(3)),
      y: parseFloat((-baseG * (p.isDropping ? 0.05 : 1.0)).toFixed(3)),
      z: parseFloat((Math.cos(Date.now() * 0.0015) * 0.08).toFixed(3))
    };

    // Safety Threshold Evaluation
    if (p.peakImpactG > 2.5) {
      p.status = 'fail';
      p.errorMsg = `G-Force Limit Exceeded (${p.peakImpactG}G > 2.50G). Chassis Structural Compromise.`;
    } else if (p.gravityG > 2.0) {
      p.status = 'fail';
      p.errorMsg = `Gravitational Anomaly (${p.gravityG}G). Suspension bottomed out.`;
    } else {
      p.status = 'pass';
      p.errorMsg = null;
    }
  }

  // --- Subsystem 2: Slip & Road Banking Update ---
  updateSlip(dt) {
    const s = this.state.slip;
    const vMs = (s.speedKmh * 1000) / 3600;
    const R = s.curveRadiusM;
    const thetaRad = (s.bankAngle * Math.PI) / 180;
    const g = 9.81;

    // Centrifugal Force: Fc = m * v^2 / R
    const mass = this.state.physics.massKg;
    s.centrifugalForceKN = parseFloat(((mass * vMs * vMs) / (R * 1000)).toFixed(2));

    // Ideal Neutral Speed on banked road (where lateral friction = 0)
    const idealVms = Math.sqrt(g * R * Math.tan(thetaRad));
    const idealKmh = (idealVms * 3600) / 1000;

    // Required friction coefficient:
    // mu_req = |v^2 - g*R*tan(theta)| / (g*R + v^2*tan(theta))
    const num = Math.abs(vMs * vMs - g * R * Math.tan(thetaRad));
    const den = g * R + vMs * vMs * Math.tan(thetaRad);
    s.requiredMu = parseFloat((num / den).toFixed(3));

    // Slip ratio
    if (s.requiredMu > s.frictionMu) {
      // Traction broken!
      const excess = s.requiredMu - s.frictionMu;
      if (s.escActive) {
        s.slipRatio = parseFloat((0.08 + excess * 0.25).toFixed(3));
        s.escInterventionPercent = Math.min(100, Math.round(excess * 150));
      } else {
        s.slipRatio = parseFloat((0.22 + excess * 0.75).toFixed(3));
        s.escInterventionPercent = 0;
      }
    } else {
      s.slipRatio = parseFloat((0.02 + Math.random() * 0.02).toFixed(3));
      s.escInterventionPercent = 0;
    }

    // Safety Threshold Evaluation
    if (s.slipRatio > 0.18) {
      s.status = 'fail';
      s.errorMsg = `Vehicle Traction Loss! Slip Ratio (${s.slipRatio.toFixed(2)}) > 0.18 Threshold. Severe Skid.`;
    } else if (!s.escActive && s.requiredMu > s.frictionMu * 0.9) {
      s.status = 'fail';
      s.errorMsg = `ESC Disabled under low-traction condition (μ=${s.frictionMu}). Dynamic stability lost.`;
    } else {
      s.status = 'pass';
      s.errorMsg = null;
    }
  }

  // --- Subsystem 3: Airbag Deployment Update ---
  updateAirbag(dt) {
    const a = this.state.airbag;

    // Safety Threshold Evaluation
    if (a.squibFired) {
      if (a.deploymentLatencyMs > 35) {
        a.status = 'fail';
        a.errorMsg = `Squib Deployment Latency (${a.deploymentLatencyMs}ms) exceeded critical 35ms safety threshold.`;
      } else if (!a.sensorRedundancyOk) {
        a.status = 'fail';
        a.errorMsg = `Airbag Redundant Accelerometer Sensor Divergence. Deployment integrity unverified.`;
      } else if (a.occupantPosition === 'out_of_position') {
        a.status = 'fail';
        a.errorMsg = `Occupant Out-of-Position (OOP). High neck injury risk during high-energy inflation.`;
      } else {
        a.status = 'pass';
        a.errorMsg = null;
      }
    } else {
      // Nominal armed standby check
      if (a.squibResistanceOhm < 1.8 || a.squibResistanceOhm > 2.8) {
        a.status = 'fail';
        a.errorMsg = `Squib Ignition Loop Resistance Fault (${a.squibResistanceOhm}Ω). Circuit open/short.`;
      } else {
        a.status = 'pass';
        a.errorMsg = null;
      }
    }
  }

  // --- Subsystem 4: Driver Drowsiness Dashboard Update ---
  updateDrowsiness(dt) {
    const d = this.state.drowsiness;

    // Periodic organic eye blinking
    const time = Date.now() * 0.001;
    if (d.microsleepDetected) {
      d.eyeClosureScore = 0.95; // eyes closed shut
      d.perclos = Math.min(0.45, d.perclos + dt * 0.08);
      d.headPitchDeg = Math.min(22, d.headPitchDeg + dt * 4);
      d.alertnessScore = Math.max(18, d.alertnessScore - dt * 15);
      d.alertLevel = 'critical';
    } else {
      // Natural blink cycle
      const blinkCycle = Math.sin(time * 3.5);
      d.eyeClosureScore = blinkCycle > 0.85 ? 0.9 : 0.08;
      d.headPitchDeg = 2.0 + Math.sin(time * 0.8) * 1.5;
      d.headYawDeg = Math.cos(time * 0.5) * 2.0;
      d.alertLevel = d.perclos > 0.15 ? 'warning' : 'nominal';
    }

    // Safety Threshold Evaluation
    if (d.microsleepDetected || d.perclos > 0.20 || d.headPitchDeg > 18) {
      d.status = 'fail';
      d.errorMsg = `Driver Drowsiness Alert! PERCLOS (${(d.perclos * 100).toFixed(1)}%) > 20% or Head Nodding detected.`;
    } else if (d.alertnessScore < 60) {
      d.status = 'fail';
      d.errorMsg = `Driver Alertness (${d.alertnessScore.toFixed(0)}%) below safety threshold. Attention diverted.`;
    } else {
      d.status = 'pass';
      d.errorMsg = null;
    }

    // Render Simulated DMS AI Vision Mesh on canvas
    this.renderDmsFeed();
  }

  // --- Subsystem 5: Critical Terrain Tyre Conditioning Update ---
  updateTyre(dt) {
    const t = this.state.tyre;
    const time = Date.now() * 0.003;

    // Simulate suspension travel based on terrain
    if (t.terrain === 'potholes') {
      const shakeFL = Math.sin(time * 12) * 24 + (Math.random() > 0.94 ? 65 : 0);
      const shakeFR = Math.cos(time * 11) * 22 + (Math.random() > 0.95 ? -55 : 0);
      const shakeRL = Math.sin(time * 10) * 18;
      const shakeRR = Math.cos(time * 13) * 19;
      
      t.wheelTravel.FL = shakeFL;
      t.wheelTravel.FR = shakeFR;
      t.wheelTravel.RL = shakeRL;
      t.wheelTravel.RR = shakeRR;

      t.suspensionBottoming = Math.abs(shakeFL) > 75 || Math.abs(shakeFR) > 75;
    } else if (t.terrain === 'hills') {
      // Incline weight transfer to rear
      t.wheelTravel.FL = -15;
      t.wheelTravel.FR = -15;
      t.wheelTravel.RL = 35 + Math.sin(time * 4) * 8;
      t.wheelTravel.RR = 35 + Math.cos(time * 4) * 8;
      
      // Increased rear tire temperature from torque
      t.tempC.RL = Math.min(95, t.tempC.RL + dt * 0.3);
      t.tempC.RR = Math.min(95, t.tempC.RR + dt * 0.3);
    } else if (t.terrain === 'river_rocks') {
      t.hydroplaningRiskPercent = 68;
      t.wheelTravel.FL = Math.sin(time * 18) * 38;
      t.wheelTravel.FR = Math.cos(time * 16) * 42;
    }

    // Safety Threshold Evaluation
    const minPressure = Math.min(t.pressurePsi.FL, t.pressurePsi.FR, t.pressurePsi.RL, t.pressurePsi.RR);
    const maxTemp = Math.max(t.tempC.FL, t.tempC.FR, t.tempC.RL, t.tempC.RR);

    if (t.punctureDetected || minPressure < 25.0) {
      t.status = 'fail';
      t.errorMsg = `Tire Puncture / Severe Pressure Loss (${minPressure.toFixed(1)} PSI). Imminent rim damage!`;
    } else if (maxTemp > 88.0) {
      t.status = 'fail';
      t.errorMsg = `Tire Overheating (${maxTemp.toFixed(1)}°C > 88°C). Tread blister and blowout risk.`;
    } else if (t.suspensionBottoming) {
      t.status = 'fail';
      t.errorMsg = `Severe Pothole Impact! Damper Bottomed Out (>80mm travel). Structural suspension hazard.`;
    } else {
      t.status = 'pass';
      t.errorMsg = null;
    }
  }

  // --- Subsystem 6: Predictive Battery Capacity Update ---
  updateBattery(dt) {
    const b = this.state.battery;

    // Charger power map
    const powerMap = {
      'ac_7': 7.4,
      'ac_11': 11.0,
      'ac_22': 22.0,
      'dc_50': 50.0,
      'dc_150': 150.0,
      'dc_350': 350.0
    };
    b.chargerPowerKw = powerMap[b.chargerType] || 150.0;

    // Dynamic charging taper curve (Constant Current / Constant Voltage)
    if (b.soc < 80) {
      b.actualPowerKw = b.chargerPowerKw * 0.94;
    } else {
      // Taper down from 80% to 100%
      const taperFactor = Math.max(0.12, 1.0 - ((b.soc - 80) / 20) * 0.85);
      b.actualPowerKw = parseFloat((b.chargerPowerKw * taperFactor).toFixed(1));
    }

    // Realistic time-to-full calculation based on energy delta
    const energyNeeded80 = Math.max(0, (0.80 - b.soc / 100) * b.packCapacityKwh);
    const energyNeeded100 = Math.max(0, (1.0 - b.soc / 100) * b.packCapacityKwh);

    b.timeTo80Min = b.soc >= 80 ? 0 : parseFloat(((energyNeeded80 / b.actualPowerKw) * 60).toFixed(1));
    // Taper adds ~30% time for last 20%
    const avgTaperPower = Math.max(22, b.actualPowerKw * 0.45);
    const last20Time = (0.20 * b.packCapacityKwh / avgTaperPower) * 60;
    b.timeTo100Min = parseFloat((b.timeTo80Min + (b.soc < 80 ? last20Time : ((energyNeeded100 / avgTaperPower) * 60))).toFixed(1));

    // Cell thermal gradient calculation
    if (b.actualPowerKw > 140) {
      b.packTempC = Math.min(62, b.packTempC + dt * 0.15);
      b.cellThermalGradientC = 4.2 + (b.actualPowerKw / 100) * 1.5;
    } else {
      b.packTempC = Math.max(28, b.packTempC - dt * 0.05);
      b.cellThermalGradientC = 2.1;
    }

    // Update 24 cell mock temps
    for (let i = 0; i < 24; i++) {
      const cellOffset = (i % 6) * 0.4 - 1.2;
      b.cellTemps[i] = parseFloat((b.packTempC + cellOffset + (Math.sin(i + Date.now() * 0.001) * 0.6)).toFixed(1));
    }

    // Safety Threshold Evaluation
    if (b.packTempC >= 52.0) {
      b.status = 'fail';
      b.errorMsg = `Battery Pack Thermal Overheat (${b.packTempC.toFixed(1)}°C >= 52°C). High Thermal Runaway Hazard!`;
    } else if (b.cellThermalGradientC > 7.5) {
      b.status = 'fail';
      b.errorMsg = `Cell Temperature Gradient Divergence (Δ${b.cellThermalGradientC.toFixed(1)}°C > 7.5°C). Cooling channel blockage.`;
    } else {
      b.status = 'pass';
      b.errorMsg = null;
    }
  }

  // --- Main Simulation Tick ---
  tick(dt) {
    if (this.isPaused) return;

    const effectiveDt = dt * this.simSpeed;
    this.updatePhysics(effectiveDt);
    this.updateSlip(effectiveDt);
    this.updateAirbag(effectiveDt);
    this.updateDrowsiness(effectiveDt);
    this.updateTyre(effectiveDt);
    this.updateBattery(effectiveDt);
  }

  // --- DMS Canvas Facial AI Mesh Visualizer ---
  initDmsCanvas() {
    this.dmsCanvas = document.getElementById('dms-canvas');
    if (this.dmsCanvas) {
      this.dmsCtx = this.dmsCanvas.getContext('2d');
    }
  }

  renderDmsFeed() {
    if (!this.dmsCtx || !this.dmsCanvas) {
      this.dmsCanvas = document.getElementById('dms-canvas');
      if (this.dmsCanvas) this.dmsCtx = this.dmsCanvas.getContext('2d');
      if (!this.dmsCtx) return;
    }

    const ctx = this.dmsCtx;
    const w = this.dmsCanvas.width = this.dmsCanvas.clientWidth;
    const h = this.dmsCanvas.height = this.dmsCanvas.clientHeight;
    const d = this.state.drowsiness;

    // Dark infrared camera feed background
    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, w, h);

    // Subtle scanlines
    ctx.fillStyle = 'rgba(0, 240, 255, 0.025)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 2);
    }

    // Center coordinates
    const cx = w * 0.5 + (d.headYawDeg * 2.5);
    const cy = h * 0.52 + (d.headPitchDeg * 2.8);
    const faceRadius = 38;

    // Head bounding contour (mesh lines)
    ctx.strokeStyle = d.alertLevel === 'critical' ? '#ff0055' : '#00f0ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, faceRadius * 0.75, faceRadius, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Landmark mesh points (simulated 468 facial mesh wireframe)
    const meshColor = d.alertLevel === 'critical' ? 'rgba(255, 0, 85, 0.4)' : 'rgba(0, 240, 255, 0.35)';
    ctx.strokeStyle = meshColor;
    ctx.lineWidth = 0.8;

    // Forehead and jaw triangulation
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy - 25);
    ctx.lineTo(cx, cy - 35);
    ctx.lineTo(cx + 22, cy - 25);
    ctx.lineTo(cx + 26, cy);
    ctx.lineTo(cx, cy + 34);
    ctx.lineTo(cx - 26, cy);
    ctx.closePath();
    ctx.stroke();

    // Eyes Tracking
    const eyeY = cy - 8;
    const leftEyeX = cx - 14;
    const rightEyeX = cx + 14;
    const eyeOpening = Math.max(1, 7 * (1 - d.eyeClosureScore));

    // Left Eye
    ctx.fillStyle = d.alertLevel === 'critical' ? '#ff0055' : '#00ff88';
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(leftEyeX, eyeY, 7, eyeOpening, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    // Right Eye
    ctx.beginPath();
    ctx.ellipse(rightEyeX, eyeY, 7, eyeOpening, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    // Pupil Gaze Vector (Ray)
    if (eyeOpening > 2) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(leftEyeX, eyeY, 2, 0, Math.PI * 2);
      ctx.arc(rightEyeX, eyeY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nose bridge
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(cx, eyeY);
    ctx.lineTo(cx, cy + 10);
    ctx.lineTo(cx - 5, cy + 14);
    ctx.lineTo(cx + 5, cy + 14);
    ctx.stroke();

    // Mouth
    ctx.beginPath();
    ctx.ellipse(cx, cy + 22, 10, d.microsleepDetected ? 4 : 2, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Bounding Box with tracking HUD brackets
    const bColor = d.alertLevel === 'critical' ? '#ff0055' : '#00f0ff';
    ctx.strokeStyle = bColor;
    ctx.lineWidth = 1.5;
    const bw = 70;
    const bh = 95;
    const bx = cx - bw / 2;
    const by = cy - bh / 2;
    const blen = 10;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(bx, by + blen); ctx.lineTo(bx, by); ctx.lineTo(bx + blen, by);
    // Top-right
    ctx.moveTo(bx + bw - blen, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + blen);
    // Bottom-left
    ctx.moveTo(bx, by + bh - blen); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + blen, by + bh);
    // Bottom-right
    ctx.moveTo(bx + bw - blen, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - blen);
    ctx.stroke();

    // Live AI Confidence text
    ctx.fillStyle = bColor;
    ctx.font = '9px monospace';
    ctx.fillText(`DMS-AI: 98.4% CONF | PERCLOS: ${(d.perclos * 100).toFixed(1)}%`, 10, h - 10);
    if (d.microsleepDetected) {
      ctx.fillStyle = '#ff0055';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('⚠ MICROSLEEP DETECTED', w - 160, 20);
    }
  }
}
