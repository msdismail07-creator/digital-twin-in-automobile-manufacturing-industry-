// EV Digital Twin: Main Application Controller
// Orchestrates 3D WebGL Rendering, UI Bindings, Telemetry Loop, and Validation Checks.

class EVAppEngine {
  constructor() {
    this.sim = new TelemetrySimulationEngine();
    this.twin = new EVVehicleTwin('three-canvas-container');
    this.validator = new ValidationMatrixEngine(this.sim);

    this.activeTab = 'physics';
    this.lastTime = performance.now();

    this.bindUIEvents();
    this.bindSliders();
    this.bindPresets();
    this.bindViewControls();
    
    // Start RAF Telemetry & Validation Loop
    this.loop();
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update Tab Buttons
    document.querySelectorAll('.mod-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update Panes
    document.querySelectorAll('.module-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `pane-${tabId}`);
    });

    // Highlight 3D part corresponding to this subsystem
    this.twin.highlightCategory(tabId);

    // Camera auto-focus on relevant view
    if (tabId === 'battery') this.twin.setViewPreset('battery');
    else if (tabId === 'tyre') this.twin.setViewPreset('suspension');
    else if (tabId === 'drowsiness') this.twin.setViewPreset('cockpit');
    else if (tabId === 'airbag') this.twin.setViewPreset('cockpit');
    else if (tabId === 'slip') this.twin.setViewPreset('top');
    else if (tabId === 'physics') this.twin.setViewPreset('iso');

    if (window.soundFX) window.soundFX.playBeep(640, 0.05);
  }

  bindUIEvents() {
    // Tab Clicks
    document.querySelectorAll('.mod-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Subsystem Health Pills Click to switch tab
    document.querySelectorAll('.health-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const tab = pill.dataset.targetTab;
        if (tab) this.switchTab(tab);
      });
    });

    // Global Certification Suite Modal Trigger
    const runCertBtn = document.getElementById('btn-run-cert');
    if (runCertBtn) {
      runCertBtn.addEventListener('click', () => {
        this.validator.runFullCertificationSuite((results) => {
          // completion callback
        });
      });
    }

    // Modal Close
    const closeCertModal = document.getElementById('cert-modal-close');
    if (closeCertModal) {
      closeCertModal.addEventListener('click', () => {
        document.getElementById('cert-modal-backdrop').classList.remove('active');
      });
    }

    // Reset Simulation to Defaults
    const resetBtn = document.getElementById('btn-reset-sim');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetAllToNominal();
      });
    }

    // Audio Mute Toggle
    const muteBtn = document.getElementById('btn-toggle-sound');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        window.soundFX.muted = !window.soundFX.muted;
        muteBtn.textContent = window.soundFX.muted ? '🔇 SOUND OFF' : '🔊 SOUND ON';
        muteBtn.classList.toggle('primary', !window.soundFX.muted);
      });
    }

    // Sim Speed Controls
    document.querySelectorAll('.sim-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sim-speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseFloat(btn.dataset.speed);
        if (speed === 0) {
          this.sim.isPaused = true;
        } else {
          this.sim.isPaused = false;
          this.sim.simSpeed = speed;
        }
      });
    });

    // Close Part Inspector
    const pioClose = document.getElementById('pio-close-btn');
    if (pioClose) {
      pioClose.addEventListener('click', () => {
        document.getElementById('part-inspector-overlay').classList.remove('visible');
      });
    }
  }

  bindViewControls() {
    // 3D Camera Presets
    document.querySelectorAll('.view-preset-btn[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-preset-btn[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.twin.setViewPreset(btn.dataset.preset);
        if (window.soundFX) window.soundFX.playBeep(750, 0.05);
      });
    });

    // 3D Render Modes
    document.querySelectorAll('.view-preset-btn[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-preset-btn[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.twin.setViewMode(btn.dataset.mode);
        if (window.soundFX) window.soundFX.playBeep(700, 0.05);
      });
    });
  }

  bindSliders() {
    // 1. Gravity & Physics
    const gravSlider = document.getElementById('slider-gravity');
    if (gravSlider) {
      gravSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.state.physics.gravityG = val;
        document.getElementById('val-gravity').textContent = `${val.toFixed(2)} G`;
      });
    }

    const dropSlider = document.getElementById('slider-drop-height');
    if (dropSlider) {
      dropSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.state.physics.dropHeight = val;
        document.getElementById('val-drop-height').textContent = `${val.toFixed(1)} m`;
      });
    }

    // 2. Slip & Road Banking
    const speedSlider = document.getElementById('slider-speed');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.state.slip.speedKmh = val;
        this.sim.speedKmh = val;
        document.getElementById('val-speed').textContent = `${val} km/h`;
      });
    }

    const bankSlider = document.getElementById('slider-bank-angle');
    if (bankSlider) {
      bankSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.state.slip.bankAngle = val;
        document.getElementById('val-bank-angle').textContent = `${val}°`;
      });
    }

    const muSlider = document.getElementById('slider-friction-mu');
    if (muSlider) {
      muSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.state.slip.frictionMu = val;
        document.getElementById('val-friction-mu').textContent = `${val.toFixed(2)} μ`;
      });
    }

    const escToggle = document.getElementById('toggle-esc');
    if (escToggle) {
      escToggle.addEventListener('change', (e) => {
        this.sim.state.slip.escActive = e.target.checked;
        document.getElementById('val-esc-state').textContent = e.target.checked ? 'ENABLED (ACTIVE)' : 'DISABLED (OFF)';
      });
    }

    // 3. Airbags
    const crashSpeedSlider = document.getElementById('slider-crash-speed');
    if (crashSpeedSlider) {
      crashSpeedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.state.airbag.targetCrashSpeedKmh = val;
        document.getElementById('val-crash-speed').textContent = `${val} km/h`;
      });
    }

    // 4. Driver Drowsiness
    const eyeSlider = document.getElementById('slider-eye-closure');
    if (eyeSlider) {
      eyeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.state.drowsiness.perclos = val;
        document.getElementById('val-eye-closure').textContent = `${(val * 100).toFixed(0)}%`;
      });
    }

    const pitchSlider = document.getElementById('slider-head-pitch');
    if (pitchSlider) {
      pitchSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.state.drowsiness.headPitchDeg = val;
        document.getElementById('val-head-pitch').textContent = `${val.toFixed(1)}°`;
      });
    }

    // 5. Tyre & Terrain
    const pressSlider = document.getElementById('slider-tyre-press');
    if (pressSlider) {
      pressSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const t = this.sim.state.tyre.pressurePsi;
        t.FL = t.FR = t.RL = t.RR = val;
        document.getElementById('val-tyre-press').textContent = `${val.toFixed(1)} PSI`;
      });
    }

    const tempSlider = document.getElementById('slider-tyre-temp');
    if (tempSlider) {
      tempSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const t = this.sim.state.tyre.tempC;
        t.FL = t.FR = t.RL = t.RR = val;
        document.getElementById('val-tyre-temp').textContent = `${val.toFixed(0)} °C`;
      });
    }

    // 6. Battery
    const socSlider = document.getElementById('slider-battery-soc');
    if (socSlider) {
      socSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.state.battery.soc = val;
        document.getElementById('val-battery-soc').textContent = `${val.toFixed(1)}%`;
      });
    }

    const chargerSelect = document.getElementById('select-charger-type');
    if (chargerSelect) {
      chargerSelect.addEventListener('change', (e) => {
        this.sim.state.battery.chargerType = e.target.value;
      });
    }
  }

  bindPresets() {
    // 1. Gravity Presets
    document.getElementById('preset-drop-normal')?.addEventListener('click', () => {
      this.sim.state.physics.dropHeight = 0.8;
      this.sim.state.physics.isDropping = true;
      this.sim.state.physics.peakImpactG = 1.45;
      document.getElementById('slider-drop-height').value = 0.8;
      document.getElementById('val-drop-height').textContent = '0.8 m';
      this.validator.logTerminal('PHYSICS', 'Initiating standard 0.8m chassis drop impact test.');
    });

    document.getElementById('preset-drop-extreme')?.addEventListener('click', () => {
      this.sim.state.physics.dropHeight = 2.4;
      this.sim.state.physics.isDropping = true;
      this.sim.state.physics.peakImpactG = 3.25;
      document.getElementById('slider-drop-height').value = 2.4;
      document.getElementById('val-drop-height').textContent = '2.4 m';
      this.validator.logTerminal('PHYSICS', 'ANOMALY TEST: 2.4m High-Impact Drop (Expected G > 2.5G).', 'danger');
    });

    document.getElementById('preset-zero-g')?.addEventListener('click', () => {
      this.sim.state.physics.gravityG = 0.05;
      document.getElementById('slider-gravity').value = 0.05;
      document.getElementById('val-gravity').textContent = '0.05 G';
      this.validator.logTerminal('PHYSICS', 'Zero-G anomaly field activated.');
    });

    // 2. Slip Presets
    document.getElementById('preset-slip-ice')?.addEventListener('click', () => {
      this.sim.state.slip.frictionMu = 0.09;
      document.getElementById('slider-friction-mu').value = 0.09;
      document.getElementById('val-friction-mu').textContent = '0.09 μ';
      this.validator.logTerminal('SLIP-LAB', 'Injected Black Ice surface condition (μ=0.09). High skid hazard.', 'danger');
    });

    document.getElementById('preset-banked-turn')?.addEventListener('click', () => {
      this.sim.state.slip.bankAngle = 28;
      this.sim.state.slip.speedKmh = 145;
      this.sim.state.slip.frictionMu = 0.95;
      document.getElementById('slider-bank-angle').value = 28;
      document.getElementById('val-bank-angle').textContent = '28°';
      document.getElementById('slider-speed').value = 145;
      document.getElementById('val-speed').textContent = '145 km/h';
      this.validator.logTerminal('SLIP-LAB', 'High-Speed Banked Oval Simulation (28° Banking @ 145 km/h).');
    });

    // 3. Airbag Presets
    document.getElementById('preset-crash-fire')?.addEventListener('click', () => {
      this.sim.state.airbag.squibFired = true;
      this.sim.state.airbag.deploymentLatencyMs = 23;
      this.twin.deployAirbags();
      if (window.soundFX) {
        window.soundFX.playImpact();
        window.soundFX.playAirbagHiss();
      }
      this.validator.logTerminal('SAFETY-SYS', 'CRASH PULSE DETECTED: 58G Deceleration. Dual squibs fired at 23ms.', 'success');
    });

    document.getElementById('preset-squib-anomaly')?.addEventListener('click', () => {
      this.sim.state.airbag.squibFired = true;
      this.sim.state.airbag.deploymentLatencyMs = 46; // exceeds 35ms limit!
      this.twin.deployAirbags();
      if (window.soundFX) window.soundFX.playAlarm();
      this.validator.logTerminal('SAFETY-SYS', 'SQUIB TIMING FAULT: Fire latency 46ms > 35ms allowed!', 'danger');
    });

    document.getElementById('preset-airbag-reset')?.addEventListener('click', () => {
      this.sim.state.airbag.squibFired = false;
      this.sim.state.airbag.deploymentLatencyMs = 24;
      this.sim.state.airbag.occupantPosition = 'optimal';
      this.twin.resetAirbags();
      this.validator.logTerminal('SAFETY-SYS', 'Airbag pyrotechnic module reset to standby armed.');
    });

    // 4. Drowsiness Presets
    document.getElementById('preset-dms-microsleep')?.addEventListener('click', () => {
      this.sim.state.drowsiness.microsleepDetected = true;
      this.sim.state.drowsiness.perclos = 0.38;
      this.sim.state.drowsiness.headPitchDeg = 21.0;
      this.sim.state.drowsiness.alertnessScore = 22;
      this.validator.logTerminal('DMS-AI', 'CRITICAL FATIGUE: Driver Micro-Sleep event confirmed (Eyes shut >2.5s).', 'danger');
    });

    document.getElementById('preset-dms-alert')?.addEventListener('click', () => {
      this.sim.state.drowsiness.microsleepDetected = false;
      this.sim.state.drowsiness.perclos = 0.05;
      this.sim.state.drowsiness.headPitchDeg = 1.5;
      this.sim.state.drowsiness.alertnessScore = 95;
      this.validator.logTerminal('DMS-AI', 'Driver attention normalized: High alertness, nominal gaze tracking.', 'success');
    });

    // 5. Terrain Presets
    document.getElementById('preset-terrain-pothole')?.addEventListener('click', () => {
      this.sim.state.tyre.terrain = 'potholes';
      this.sim.state.tyre.suspensionBottoming = true;
      this.validator.logTerminal('TERRAIN', 'Severe Pothole Cluster: Damping stroke saturation detected.', 'warn');
    });

    document.getElementById('preset-terrain-hills')?.addEventListener('click', () => {
      this.sim.state.tyre.terrain = 'hills';
      this.validator.logTerminal('TERRAIN', '32% Steep Mountain Incline: High rear-axle torque & thermal stress.');
    });

    document.getElementById('preset-terrain-rocks')?.addEventListener('click', () => {
      this.sim.state.tyre.terrain = 'river_rocks';
      this.validator.logTerminal('TERRAIN', 'Riverbed Big Rocks: High water planar drag and puncture risk.');
    });

    document.getElementById('preset-tyre-puncture')?.addEventListener('click', () => {
      this.sim.state.tyre.punctureDetected = true;
      this.sim.state.tyre.pressurePsi.FL = 13.5;
      document.getElementById('slider-tyre-press').value = 13.5;
      document.getElementById('val-tyre-press').textContent = '13.5 PSI';
      this.validator.logTerminal('TYRE-TPMS', 'TPMS HARD FAULT: Front-Left rapid pressure loss (13.5 PSI)!', 'danger');
    });

    // 6. Battery Presets
    document.getElementById('preset-batt-overheat')?.addEventListener('click', () => {
      this.sim.state.battery.packTempC = 57.5;
      this.sim.state.battery.cellThermalGradientC = 9.8;
      this.validator.logTerminal('BMS-THERMAL', 'CRITICAL OVERHEAT: Pack Temp 57.5°C >= 52°C. Thermal runaway threshold breached!', 'danger');
    });

    document.getElementById('preset-batt-hypercharge')?.addEventListener('click', () => {
      this.sim.state.battery.chargerType = 'dc_350';
      document.getElementById('select-charger-type').value = 'dc_350';
      this.sim.state.battery.soc = 18.0;
      document.getElementById('slider-battery-soc').value = 18.0;
      document.getElementById('val-battery-soc').textContent = '18.0%';
      this.validator.logTerminal('BMS-CHARGER', 'DC Ultra 350kW HyperCharge handshake negotiated (800V Architecture).', 'success');
    });

    document.getElementById('preset-batt-cool')?.addEventListener('click', () => {
      this.sim.state.battery.packTempC = 30.5;
      this.sim.state.battery.cellThermalGradientC = 1.9;
      this.validator.logTerminal('BMS-THERMAL', 'Active refrigerant chill loop engaged. Cell thermal gradient normalized.', 'success');
    });
  }

  resetAllToNominal() {
    // Reset Physics
    this.sim.state.physics.gravityG = 1.0;
    this.sim.state.physics.dropHeight = 0.0;
    this.sim.state.physics.peakImpactG = 1.0;
    this.sim.state.physics.chassisIntegrity = 100;
    document.getElementById('slider-gravity').value = 1.0;
    document.getElementById('val-gravity').textContent = '1.00 G';
    document.getElementById('slider-drop-height').value = 0.0;
    document.getElementById('val-drop-height').textContent = '0.0 m';

    // Reset Slip
    this.sim.state.slip.speedKmh = 75;
    this.sim.state.slip.bankAngle = 8;
    this.sim.state.slip.frictionMu = 0.75;
    this.sim.state.slip.escActive = true;
    document.getElementById('slider-speed').value = 75;
    document.getElementById('val-speed').textContent = '75 km/h';
    document.getElementById('slider-bank-angle').value = 8;
    document.getElementById('val-bank-angle').textContent = '8°';
    document.getElementById('slider-friction-mu').value = 0.75;
    document.getElementById('val-friction-mu').textContent = '0.75 μ';
    document.getElementById('toggle-esc').checked = true;

    // Reset Airbag
    this.sim.state.airbag.squibFired = false;
    this.sim.state.airbag.deploymentLatencyMs = 24;
    this.sim.state.airbag.occupantPosition = 'optimal';
    this.twin.resetAirbags();

    // Reset Drowsiness
    this.sim.state.drowsiness.microsleepDetected = false;
    this.sim.state.drowsiness.perclos = 0.06;
    this.sim.state.drowsiness.headPitchDeg = 2.5;
    this.sim.state.drowsiness.alertnessScore = 92;

    // Reset Tyre
    this.sim.state.tyre.terrain = 'potholes';
    this.sim.state.tyre.punctureDetected = false;
    this.sim.state.tyre.suspensionBottoming = false;
    const tP = this.sim.state.tyre.pressurePsi;
    tP.FL = tP.FR = tP.RL = tP.RR = 34.5;
    const tT = this.sim.state.tyre.tempC;
    tT.FL = tT.FR = tT.RL = tT.RR = 38.0;
    document.getElementById('slider-tyre-press').value = 34.5;
    document.getElementById('val-tyre-press').textContent = '34.5 PSI';

    // Reset Battery
    this.sim.state.battery.packTempC = 31.5;
    this.sim.state.battery.cellThermalGradientC = 2.1;
    this.sim.state.battery.soc = 55.0;
    document.getElementById('slider-battery-soc').value = 55.0;
    document.getElementById('val-battery-soc').textContent = '55.0%';

    this.validator.logTerminal('SYS-RESET', '=== All 6 subsystems restored to factory nominal baselines ===', 'success');
  }

  updateDOMMetrics() {
    const s = this.sim.state;

    // 1. Gravity Pane Metrics
    document.getElementById('metric-peak-g').textContent = s.physics.peakImpactG.toFixed(2);
    document.getElementById('metric-chassis-int').textContent = `${Math.round(s.physics.chassisIntegrity)}%`;
    document.getElementById('metric-gvec').textContent = `${s.physics.gVector.y.toFixed(2)} G`;

    // 2. Slip Pane Metrics
    document.getElementById('metric-slip-ratio').textContent = s.slip.slipRatio.toFixed(3);
    document.getElementById('metric-centrif-f').textContent = `${s.slip.centrifugalForceKN} kN`;
    document.getElementById('metric-req-mu').textContent = s.slip.requiredMu.toFixed(3);
    document.getElementById('metric-esc-interv').textContent = `${s.slip.escInterventionPercent}%`;

    // 3. Airbag Pane Metrics
    document.getElementById('metric-deploy-lat').textContent = `${s.airbag.deploymentLatencyMs} ms`;
    document.getElementById('metric-squib-status').textContent = s.airbag.squibFired ? 'DEPLOYED' : 'ARMED';
    document.getElementById('metric-occupant-pos').textContent = s.airbag.occupantPosition.toUpperCase();

    // 4. Drowsiness Pane Metrics
    document.getElementById('metric-perclos').textContent = `${(s.drowsiness.perclos * 100).toFixed(1)}%`;
    document.getElementById('metric-alertness').textContent = `${Math.round(s.drowsiness.alertnessScore)}%`;
    document.getElementById('metric-head-pitch').textContent = `${s.drowsiness.headPitchDeg.toFixed(1)}°`;

    // 5. Tyre Pane Metrics
    const minP = Math.min(s.tyre.pressurePsi.FL, s.tyre.pressurePsi.FR, s.tyre.pressurePsi.RL, s.tyre.pressurePsi.RR);
    const maxT = Math.max(s.tyre.tempC.FL, s.tyre.tempC.FR, s.tyre.tempC.RL, s.tyre.tempC.RR);
    document.getElementById('metric-min-psi').textContent = `${minP.toFixed(1)} PSI`;
    document.getElementById('metric-max-tire-temp').textContent = `${maxT.toFixed(1)} °C`;
    document.getElementById('metric-susp-travel').textContent = `${Math.round(Math.abs(s.tyre.wheelTravel.FL))} mm`;

    // 6. Battery Pane Metrics
    document.getElementById('metric-actual-kw').textContent = `${s.battery.actualPowerKw.toFixed(1)} kW`;
    document.getElementById('metric-ttf-80').textContent = `${s.battery.timeTo80Min.toFixed(0)} min`;
    document.getElementById('metric-ttf-100').textContent = `${s.battery.timeTo100Min.toFixed(0)} min`;
    document.getElementById('metric-pack-temp').textContent = `${s.battery.packTempC.toFixed(1)} °C`;
    document.getElementById('metric-cell-grad').textContent = `Δ${s.battery.cellThermalGradientC.toFixed(1)} °C`;

    // Speedometer HUD in 3D canvas
    const speedElem = document.getElementById('hud-speed-val');
    if (speedElem) speedElem.textContent = Math.round(s.slip.speedKmh);
    const gElem = document.getElementById('hud-g-val');
    if (gElem) gElem.textContent = `${s.physics.peakImpactG.toFixed(2)} G`;
  }

  loop() {
    requestAnimationFrame(() => this.loop());

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Tick Telemetry Physics Engine
    this.sim.tick(dt);

    // Sync Telemetry to 3D Vehicle Twin
    this.twin.updatePhysicalState(this.sim.state);

    // Evaluate Global Safety Constraints
    this.validator.evaluateGlobalConstraints();

    // Update UI Elements
    this.updateDOMMetrics();
  }
}

// Global initialization on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.appEngine = new EVAppEngine();
});
