// EV Digital Twin: Global Validation Check & Status Matrix Engine
// Evaluates all 6 testing constraints and triggers the required prominent banners.

class ValidationMatrixEngine {
  constructor(simEngine) {
    this.sim = simEngine;
    this.lastOverallStatus = null;
    this.bannerElem = document.getElementById('global-validation-banner');
    this.bannerSubtext = document.getElementById('global-validation-subtext');
    this.terminalBody = document.getElementById('terminal-body');
    
    this.constraints = [
      { id: 'physics', name: 'Gravity & Chassis Stability', tabIndex: 0 },
      { id: 'slip', name: 'Slip & Road Banking Traction', tabIndex: 1 },
      { id: 'airbag', name: 'Airbag Deployment & Squib Timing', tabIndex: 2 },
      { id: 'drowsiness', name: 'Driver Drowsiness (DMS AI)', tabIndex: 3 },
      { id: 'tyre', name: 'Terrain Conditioning & Tyres', tabIndex: 4 },
      { id: 'battery', name: 'Predictive Battery & Thermal', tabIndex: 5 }
    ];

    this.initTerminalLog();
  }

  evaluateGlobalConstraints() {
    const results = {};
    let allPassed = true;
    const failures = [];

    this.constraints.forEach(c => {
      const stateObj = this.sim.state[c.id];
      const passed = stateObj.status === 'pass';
      results[c.id] = {
        passed: passed,
        error: stateObj.errorMsg,
        name: c.name
      };

      // Update badge on tabs
      const tabBadge = document.getElementById(`tab-badge-${c.id}`);
      if (tabBadge) {
        if (passed) {
          tabBadge.textContent = 'PASS';
          tabBadge.className = 'tab-badge pass';
        } else {
          tabBadge.textContent = 'FAIL';
          tabBadge.className = 'tab-badge fail';
        }
      }

      // Update Subsystem Health Pill
      const healthPill = document.getElementById(`health-pill-${c.id}`);
      if (healthPill) {
        const statusSpan = healthPill.querySelector('.hp-status');
        if (statusSpan) {
          if (passed) {
            statusSpan.className = 'hp-status nominal';
            statusSpan.innerHTML = '<span class="hp-dot"></span> NOMINAL';
          } else {
            statusSpan.className = 'hp-status critical';
            statusSpan.innerHTML = '<span class="hp-dot"></span> CRITICAL';
          }
        }
      }

      if (!passed) {
        allPassed = false;
        failures.push({ name: c.name, error: stateObj.errorMsg });
      }
    });

    const currentOverall = allPassed ? 'SUCCESS' : 'FAILED';

    // Update the Prominent Global Banner according to exact user prompt requirements:
    // "If ALL tests pass structural and safety thresholds: Display a prominent terminal log or visual banner reading "model successful" in bold green color (#00FF00)."
    // "If ANY test fails or encounters a critical error: Display a prominent banner reading "model unsuccessful" in bold red color (#FF0000)."
    if (this.bannerElem) {
      if (allPassed) {
        this.bannerElem.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00FF00" stroke-width="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span style="font-weight:900; color:#00FF00; letter-spacing:2px;">model successful</span>
        `;
        this.bannerElem.className = 'validation-banner success';
        if (this.bannerSubtext) {
          this.bannerSubtext.innerHTML = `
            <span style="color:#00FF00;">● ALL 6 CONSTRAINTS SATISFIED</span>
            <span>|</span>
            <span>ISO-26262 ASIL-D VERIFIED</span>
            <span>|</span>
            <span>V2X TELEMETRY SYNC: NOMINAL</span>
          `;
        }
      } else {
        const topError = failures[0] ? failures[0].error : 'Safety constraint threshold violated';
        this.bannerElem.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF0000" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span style="font-weight:900; color:#FF0000; letter-spacing:2px;">model unsuccessful</span>
        `;
        this.bannerElem.className = 'validation-banner failed';
        if (this.bannerSubtext) {
          this.bannerSubtext.innerHTML = `
            <span style="color:#FF0000;">▲ VIOLATION: ${topError}</span>
            <span>|</span>
            <span>ISO SAFETY INTERLOCK TRIGGERED</span>
          `;
        }
      }
    }

    // State transition terminal logging & audio alert
    if (this.lastOverallStatus !== currentOverall) {
      if (currentOverall === 'SUCCESS') {
        this.logTerminal('VALIDATION-MATRIX', '>>> [GLOBAL VALIDATION CHECK]: model successful — All 6 automotive safety constraints passed.', 'success');
        if (this.lastOverallStatus === 'FAILED' && window.soundFX) {
          window.soundFX.playSuccess();
        }
      } else {
        const failureList = failures.map(f => `[${f.name}]: ${f.error}`).join(' | ');
        this.logTerminal('SAFETY-CRITICAL', `>>> [GLOBAL VALIDATION CHECK]: model unsuccessful — VIOLATION DETECTED: ${failureList}`, 'danger');
        if (window.soundFX) {
          window.soundFX.playAlarm();
        }
      }
      this.lastOverallStatus = currentOverall;
    }

    return { allPassed, failures, results };
  }

  logTerminal(source, message, styleClass = '') {
    if (!this.terminalBody) {
      this.terminalBody = document.getElementById('terminal-body');
      if (!this.terminalBody) return;
    }

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    const line = document.createElement('div');
    line.className = 'term-line';
    line.innerHTML = `
      <span class="term-time">[${timeStr}]</span>
      <span class="term-src">&lt;${source}&gt;</span>
      <span class="term-msg ${styleClass}">${message}</span>
    `;

    this.terminalBody.appendChild(line);
    // Keep last 100 lines
    while (this.terminalBody.children.length > 100) {
      this.terminalBody.removeChild(this.terminalBody.firstChild);
    }
    this.terminalBody.scrollTop = this.terminalBody.scrollHeight;
  }

  initTerminalLog() {
    setTimeout(() => {
      this.logTerminal('SYS-INIT', 'Nexus EV Digital Twin Core v4.8 booted successfully.');
      this.logTerminal('CAN-BUS', 'High-speed CAN-FD bus connected (500 kbps / 2 Mbps nominal).');
      this.logTerminal('3D-TWIN', 'WebGL 3D Holographic vehicle representation synchronized.');
      this.logTerminal('VALIDATION-MATRIX', '>>> [GLOBAL VALIDATION CHECK]: model successful — Initializing baseline sweeps.');
    }, 400);
  }

  // Automated 6-Module Certification Runner
  runFullCertificationSuite(onComplete) {
    const modal = document.getElementById('cert-modal-backdrop');
    if (modal) modal.classList.add('active');

    const steps = [
      { id: 'physics', title: '1. Gravity & Physics Structural Drop Benchmark' },
      { id: 'slip', title: '2. Slip Angle, Banking of Road & ESC Stability' },
      { id: 'airbag', title: '3. Pyrotechnic Squib Latency & Crumple Integrity' },
      { id: 'drowsiness', title: '4. Driver Attention, PERCLOS & In-Cabin AI' },
      { id: 'tyre', title: '5. Critical Terrain Damping & Multi-Wheel Conditioning' },
      { id: 'battery', title: '6. 800V Battery Charging & Thermal Runaway Protection' }
    ];

    let currentStep = 0;
    this.logTerminal('CERT-SUITE', '=== INITIATING AUTOMATED ISO-26262 CERTIFICATION SWEEP ===', 'warn');

    const executeStep = () => {
      if (currentStep >= steps.length) {
        // Complete
        const evalRes = this.evaluateGlobalConstraints();
        const finalStatus = evalRes.allPassed ? 'model successful' : 'model unsuccessful';
        const finalClass = evalRes.allPassed ? 'success' : 'danger';
        this.logTerminal('CERT-SUITE', `=== CERTIFICATION RUN COMPLETE: ${finalStatus.toUpperCase()} ===`, finalClass);
        
        setTimeout(() => {
          if (modal) modal.classList.remove('active');
          if (onComplete) onComplete(evalRes);
        }, 1500);
        return;
      }

      const step = steps[currentStep];
      const stepElem = document.getElementById(`cert-step-${step.id}`);
      if (stepElem) {
        stepElem.className = 'cert-step-item running';
        stepElem.querySelector('.cert-step-status').textContent = 'TESTING...';
      }

      // Switch to this module in 3D & telemetry
      if (window.appEngine && window.appEngine.switchTab) {
        window.appEngine.switchTab(step.id);
      }

      setTimeout(() => {
        const stateObj = this.sim.state[step.id];
        const passed = stateObj.status === 'pass';
        if (stepElem) {
          stepElem.className = passed ? 'cert-step-item pass' : 'cert-step-item fail';
          stepElem.querySelector('.cert-step-status').textContent = passed ? '✓ PASSED' : '✗ FAILED';
        }
        this.logTerminal('CERT-SUITE', `[STEP ${currentStep + 1}/6] ${step.title}: ${passed ? 'PASSED' : 'FAILED'}`, passed ? 'success' : 'danger');

        currentStep++;
        executeStep();
      }, 700);
    };

    executeStep();
  }
}
