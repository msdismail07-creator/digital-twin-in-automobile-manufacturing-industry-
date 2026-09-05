// EV Digital Twin: Three.js 3D Holographic Vehicle Twin Engine
// Implements real-time procedural vehicle geometry, physics visualization, and part inspection.

class EVVehicleTwin {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    
    this.selectedPart = null;
    this.highlightedPart = null;
    this.viewMode = 'holographic'; // 'holographic', 'xray', 'thermal', 'exploded'
    this.explodedFactor = 0;
    this.targetExplodedFactor = 0;
    
    this.airbagInflation = 0; // 0 to 1
    this.targetAirbagInflation = 0;
    
    this.roadBankAngle = 0; // radians
    this.terrainType = 'flat';
    
    this.initScene();
    this.initLights();
    this.buildEVModel();
    this.initInteraction();
    this.animate();
    
    window.addEventListener('resize', () => this.onWindowResize());
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x060913, 0.025);

    this.camera = new THREE.PerspectiveCamera(42, this.width / this.height, 0.1, 1000);
    this.camera.position.set(5.8, 3.2, 7.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // allow slight undercarriage peek
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 20;
    this.controls.target.set(0, 0.6, 0);

    // Dynamic Ground Group
    this.groundGroup = new THREE.Group();
    this.scene.add(this.groundGroup);

    // Holographic Grid
    const gridHelper = new THREE.GridHelper(30, 40, 0x00f0ff, 0x1a2b4a);
    gridHelper.position.y = -0.01;
    this.groundGroup.add(gridHelper);

    // Glowing Holographic Target Rings
    const ringGeo = new THREE.RingGeometry(2.8, 2.9, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.005;
    this.groundGroup.add(ringMesh);

    const outerRingGeo = new THREE.RingGeometry(4.5, 4.56, 64);
    const outerRingMat = new THREE.MeshBasicMaterial({ color: 0x2563eb, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
    const outerRingMesh = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRingMesh.rotation.x = -Math.PI / 2;
    outerRingMesh.position.y = 0.005;
    this.groundGroup.add(outerRingMesh);
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.2);
    dirLight1.position.set(10, 15, 10);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xa855f7, 0.8);
    dirLight2.position.set(-10, 10, -10);
    this.scene.add(dirLight2);

    // Undercarriage Battery Glow
    this.batteryPointLight = new THREE.PointLight(0x00f0ff, 1.5, 6);
    this.batteryPointLight.position.set(0, 0.2, 0);
    this.scene.add(this.batteryPointLight);

    // Headlight Spotlights
    this.headlightL = new THREE.SpotLight(0xe0f2fe, 2, 18, Math.PI / 6, 0.5);
    this.headlightL.position.set(-0.7, 0.65, 2.2);
    this.headlightL.target.position.set(-0.7, 0.2, 8);
    this.scene.add(this.headlightL);
    this.scene.add(this.headlightL.target);

    this.headlightR = new THREE.SpotLight(0xe0f2fe, 2, 18, Math.PI / 6, 0.5);
    this.headlightR.position.set(0.7, 0.65, 2.2);
    this.headlightR.target.position.set(0.7, 0.2, 8);
    this.scene.add(this.headlightR);
    this.scene.add(this.headlightR.target);
  }

  buildEVModel() {
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);

    // Materials Palette
    this.materials = {
      bodyHolo: new THREE.MeshPhysicalMaterial({
        color: 0x07152b,
        emissive: 0x002244,
        roughness: 0.15,
        metalness: 0.85,
        transmission: 0.45,
        transparent: true,
        opacity: 0.75,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        wireframe: false
      }),
      bodyWireframe: new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.35
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        roughness: 0.05,
        transmission: 0.85,
        transparent: true,
        opacity: 0.45,
        reflectivity: 0.9
      }),
      chassisFrame: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.9,
        roughness: 0.3
      }),
      batteryCasing: new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.8,
        roughness: 0.4
      }),
      batteryCellNominal: new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00a3cc,
        emissiveIntensity: 0.6,
        roughness: 0.2
      }),
      motorMetal: new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.9,
        roughness: 0.2
      }),
      fluxRing: new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.7
      }),
      tireRubber: new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.9,
        metalness: 0.1
      }),
      alloyRim: new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.95,
        roughness: 0.15
      }),
      brakeDisc: new THREE.MeshStandardMaterial({
        color: 0x64748b,
        metalness: 0.98,
        roughness: 0.25
      }),
      brakeCaliper: new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x005522,
        roughness: 0.3
      }),
      airbagFabric: new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.7,
        metalness: 0.05,
        side: THREE.DoubleSide
      }),
      lidarGlow: new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      })
    };

    // 1. Chassis Main Structure
    this.buildChassis();

    // 2. High-Voltage Battery Pack & Individual Cells
    this.buildBatteryPack();

    // 3. Dual Electric Motors (Front & Rear e-Axles)
    this.buildElectricPowertrain();

    // 4. Active Suspension & 4 Individual Wheels
    this.buildSuspensionAndWheels();

    // 5. Airbag Deployment System (Driver, Passenger, Side Curtains)
    this.buildAirbags();

    // 6. ADAS Sensor Suite (LIDAR, DMS Camera, Radar)
    this.buildSensors();

    // 7. Physics Vector Gizmos (Center of Mass, G-Force Vector)
    this.buildPhysicsGizmos();
  }

  buildChassis() {
    this.chassisGroup = new THREE.Group();
    this.chassisGroup.name = 'Chassis_Assembly';
    this.carGroup.add(this.chassisGroup);

    // Aerodynamic Monocoque Body
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-1.0, 0);
    bodyShape.lineTo(1.0, 0);
    bodyShape.lineTo(0.95, 0.45);
    bodyShape.lineTo(0.75, 0.85);
    bodyShape.lineTo(-0.75, 0.85);
    bodyShape.lineTo(-0.95, 0.45);
    bodyShape.closePath();

    // Main Body Extrusion along Z-axis
    const extrudeSettings = {
      steps: 8,
      depth: 4.2,
      bevelEnabled: true,
      bevelThickness: 0.2,
      bevelSize: 0.15,
      bevelSegments: 5
    };
    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
    bodyGeometry.center();

    this.bodyMesh = new THREE.Mesh(bodyGeometry, this.materials.bodyHolo);
    this.bodyMesh.position.set(0, 0.7, 0);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.userData = { partName: 'Aerodynamic Monocoque Chassis', category: 'physics', desc: 'Lightweight carbon-aluminum composite body with integrated crumple zones.' };
    this.chassisGroup.add(this.bodyMesh);

    // Wireframe Overlay
    this.bodyWireMesh = new THREE.Mesh(bodyGeometry, this.materials.bodyWireframe);
    this.bodyMesh.add(this.bodyWireMesh);

    // Glass Canopy (Windshield, Panoramic Roof, Rear Hatch)
    const glassGeo = new THREE.CylinderGeometry(0.72, 0.88, 2.2, 16, 1, false, 0, Math.PI);
    glassGeo.rotateZ(Math.PI / 2);
    glassGeo.rotateY(Math.PI / 2);
    this.glassMesh = new THREE.Mesh(glassGeo, this.materials.glass);
    this.glassMesh.position.set(0, 1.05, 0.1);
    this.chassisGroup.add(this.glassMesh);

    // Aerodynamic Front Splitter & Rear Diffuser
    const splitterGeo = new THREE.BoxGeometry(1.85, 0.08, 0.6);
    const splitterMesh = new THREE.Mesh(splitterGeo, this.materials.chassisFrame);
    splitterMesh.position.set(0, 0.32, 2.2);
    this.chassisGroup.add(splitterMesh);

    const diffuserGeo = new THREE.BoxGeometry(1.8, 0.15, 0.5);
    const diffuserMesh = new THREE.Mesh(diffuserGeo, this.materials.chassisFrame);
    diffuserMesh.position.set(0, 0.36, -2.15);
    diffuserMesh.rotation.x = 0.2;
    this.chassisGroup.add(diffuserMesh);
  }

  buildBatteryPack() {
    this.batteryGroup = new THREE.Group();
    this.batteryGroup.name = 'Battery_Pack';
    this.carGroup.add(this.batteryGroup);

    // Heavy Aluminum Protective Enclosure Underfloor
    const casingGeo = new THREE.BoxGeometry(1.5, 0.22, 2.7);
    this.batteryCasingMesh = new THREE.Mesh(casingGeo, this.materials.batteryCasing);
    this.batteryCasingMesh.position.set(0, 0.34, 0);
    this.batteryCasingMesh.userData = { 
      partName: 'Liquid-Cooled 800V Battery Enclosure', 
      category: 'battery', 
      desc: 'Structural battery pack with multi-channel bottom cooling plate and thermal runaway isolation barrier.' 
    };
    this.batteryGroup.add(this.batteryCasingMesh);

    // 48 Individual Battery Cell Modules (arranged in 4 Banks of 12)
    this.batteryCells = [];
    const cellGeo = new THREE.BoxGeometry(0.24, 0.14, 0.35);

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        const cellMat = this.materials.batteryCellNominal.clone();
        const cellMesh = new THREE.Mesh(cellGeo, cellMat);
        
        const x = (col - 1.5) * 0.32;
        const z = (row - 2.5) * 0.42;
        cellMesh.position.set(x, 0.42, z);
        cellMesh.userData = {
          partName: `Cell Module [B${row + 1}-C${col + 1}]`,
          category: 'battery',
          index: row * 4 + col,
          voltage: 3.85,
          temp: 28.5
        };
        this.batteryGroup.add(cellMesh);
        this.batteryCells.push(cellMesh);
      }
    }
  }

  buildElectricPowertrain() {
    this.powertrainGroup = new THREE.Group();
    this.powertrainGroup.name = 'Electric_Powertrain';
    this.carGroup.add(this.powertrainGroup);

    // Front e-Axle (150kW Permanent Magnet Synchronous Motor)
    const frontMotorGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.55, 24);
    frontMotorGeo.rotateZ(Math.PI / 2);
    this.frontMotor = new THREE.Mesh(frontMotorGeo, this.materials.motorMetal);
    this.frontMotor.position.set(0, 0.42, 1.45);
    this.frontMotor.userData = { partName: 'Front Permanent Magnet E-Motor (150 kW)', category: 'physics', desc: 'Front direct-drive reduction axle with SiC inverter.' };
    this.powertrainGroup.add(this.frontMotor);

    // Rear Dual e-Axle (300kW High-Performance Induction Motor)
    const rearMotorGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.65, 24);
    rearMotorGeo.rotateZ(Math.PI / 2);
    this.rearMotor = new THREE.Mesh(rearMotorGeo, this.materials.motorMetal);
    this.rearMotor.position.set(0, 0.42, -1.45);
    this.rearMotor.userData = { partName: 'Rear Dual E-Motor (300 kW)', category: 'physics', desc: 'Rear torque-vectoring dual motor unit.' };
    this.powertrainGroup.add(this.rearMotor);

    // Rotating Electromagnetic Flux Rings
    const fluxGeo = new THREE.TorusGeometry(0.32, 0.02, 16, 32);
    this.rearFluxRing = new THREE.Mesh(fluxGeo, this.materials.fluxRing);
    this.rearFluxRing.position.copy(this.rearMotor.position);
    this.powertrainGroup.add(this.rearFluxRing);
  }

  buildSuspensionAndWheels() {
    this.suspensionGroup = new THREE.Group();
    this.suspensionGroup.name = 'Suspension_And_Wheels';
    this.carGroup.add(this.suspensionGroup);

    this.wheels = {};
    const wheelPositions = [
      { id: 'FL', name: 'Front Left Assembly', x: -0.96, y: 0.42, z: 1.45, isFront: true },
      { id: 'FR', name: 'Front Right Assembly', x: 0.96, y: 0.42, z: 1.45, isFront: true },
      { id: 'RL', name: 'Rear Left Assembly', x: -0.96, y: 0.42, z: -1.45, isFront: false },
      { id: 'RR', name: 'Rear Right Assembly', x: 0.96, y: 0.42, z: -1.45, isFront: false }
    ];

    wheelPositions.forEach(pos => {
      const cornerGroup = new THREE.Group();
      cornerGroup.position.set(pos.x, pos.y, pos.z);
      cornerGroup.name = `Corner_${pos.id}`;

      // 1. Suspension Damper Strut & Spring
      const strutGroup = new THREE.Group();
      const strutCylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.4, 16),
        this.materials.chassisFrame
      );
      strutCylinder.position.set(pos.x > 0 ? -0.15 : 0.15, 0.25, 0);
      strutCylinder.rotation.z = pos.x > 0 ? -0.2 : 0.2;
      strutGroup.add(strutCylinder);

      const springGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.28, 12, 6, true);
      const springMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
      const springMesh = new THREE.Mesh(springGeo, springMat);
      springMesh.position.copy(strutCylinder.position);
      springMesh.rotation.copy(strutCylinder.rotation);
      strutGroup.add(springMesh);
      cornerGroup.add(strutGroup);

      // 2. Wheel Rotation Hub
      const wheelHub = new THREE.Group();
      wheelHub.name = `WheelHub_${pos.id}`;

      // Tire (Rubber Torus / Cylinder)
      const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.26, 32);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeo, this.materials.tireRubber);
      tireMesh.castShadow = true;
      tireMesh.userData = {
        partName: `${pos.name} [Tire]`,
        category: 'tyre',
        wheelId: pos.id,
        desc: 'EV low-rolling-resistance silica tire with embedded acoustic foam and pressure sensor.'
      };
      wheelHub.add(tireMesh);

      // Alloy Rim
      const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.27, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, this.materials.alloyRim);
      wheelHub.add(rimMesh);

      // Ventilated Brake Disc
      const discGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.03, 24);
      discGeo.rotateZ(Math.PI / 2);
      const discMesh = new THREE.Mesh(discGeo, this.materials.brakeDisc);
      discMesh.position.set(pos.x > 0 ? -0.09 : 0.09, 0, 0);
      wheelHub.add(discMesh);

      // Caliper (Fixed on corner, not rotating)
      const caliperGeo = new THREE.BoxGeometry(0.08, 0.14, 0.12);
      const caliperMat = this.materials.brakeCaliper.clone();
      const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
      caliperMesh.position.set(pos.x > 0 ? -0.09 : 0.09, 0.16, 0);
      caliperMesh.userData = {
        partName: `${pos.name} [ESC Caliper]`,
        category: 'slip',
        wheelId: pos.id,
        desc: 'Electro-mechanical regenerative braking caliper linked to Electronic Stability Control (ESC).'
      };
      cornerGroup.add(caliperMesh);

      cornerGroup.add(wheelHub);
      this.suspensionGroup.add(cornerGroup);

      this.wheels[pos.id] = {
        group: cornerGroup,
        hub: wheelHub,
        strut: strutGroup,
        spring: springMesh,
        caliper: caliperMesh,
        caliperMat: caliperMat,
        tire: tireMesh,
        baseY: pos.y,
        isFront: pos.isFront
      };
    });
  }

  buildAirbags() {
    this.airbagGroup = new THREE.Group();
    this.airbagGroup.name = 'Airbag_Safety_System';
    this.carGroup.add(this.airbagGroup);

    // 1. Driver Steering Wheel Airbag
    const driverAirbagGeo = new THREE.SphereGeometry(0.32, 24, 24);
    driverAirbagGeo.scale(1.0, 0.7, 0.8);
    this.driverAirbagMesh = new THREE.Mesh(driverAirbagGeo, this.materials.airbagFabric);
    this.driverAirbagMesh.position.set(-0.38, 0.88, 0.38);
    this.driverAirbagMesh.scale.set(0.001, 0.001, 0.001); // starts compact
    this.driverAirbagMesh.userData = { 
      partName: 'Driver Front Steering Squib Airbag', 
      category: 'airbag', 
      desc: 'Dual-stage pyrotechnic squib inflation airbag with adaptive tethering.' 
    };
    this.airbagGroup.add(this.driverAirbagMesh);

    // 2. Passenger Dashboard Airbag
    const passAirbagGeo = new THREE.SphereGeometry(0.42, 24, 24);
    passAirbagGeo.scale(1.2, 0.8, 0.9);
    this.passengerAirbagMesh = new THREE.Mesh(passAirbagGeo, this.materials.airbagFabric);
    this.passengerAirbagMesh.position.set(0.38, 0.92, 0.45);
    this.passengerAirbagMesh.scale.set(0.001, 0.001, 0.001);
    this.passengerAirbagMesh.userData = { 
      partName: 'Front Passenger Dual-Chamber Airbag', 
      category: 'airbag', 
      desc: 'Top-mount instrument panel airbag with occupant out-of-position suppression.' 
    };
    this.airbagGroup.add(this.passengerAirbagMesh);

    // 3. Side Inflatable Curtains (Left & Right)
    const curtainGeoL = new THREE.BoxGeometry(0.04, 0.35, 1.6);
    this.curtainMeshL = new THREE.Mesh(curtainGeoL, this.materials.airbagFabric);
    this.curtainMeshL.position.set(-0.85, 1.05, 0.1);
    this.curtainMeshL.scale.set(0.001, 0.001, 0.001);
    this.airbagGroup.add(this.curtainMeshL);

    const curtainGeoR = new THREE.BoxGeometry(0.04, 0.35, 1.6);
    this.curtainMeshR = new THREE.Mesh(curtainGeoR, this.materials.airbagFabric);
    this.curtainMeshR.position.set(0.85, 1.05, 0.1);
    this.curtainMeshR.scale.set(0.001, 0.001, 0.001);
    this.airbagGroup.add(this.curtainMeshR);
  }

  buildSensors() {
    this.sensorGroup = new THREE.Group();
    this.sensorGroup.name = 'ADAS_Sensor_Suite';
    this.carGroup.add(this.sensorGroup);

    // 1. Roof LIDAR Puck
    const lidarPuckGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.08, 24);
    this.lidarPuck = new THREE.Mesh(lidarPuckGeo, this.materials.chassisFrame);
    this.lidarPuck.position.set(0, 1.58, 0.3);
    this.lidarPuck.userData = { partName: 'Solid-State Roof LIDAR (300m Range)', category: 'physics', desc: 'High-frequency 360-degree point-cloud laser scanner.' };
    this.sensorGroup.add(this.lidarPuck);

    // 360 Scan Cone Sweep
    const lidarBeamGeo = new THREE.ConeGeometry(2.5, 0.1, 32, 1, true);
    this.lidarBeam = new THREE.Mesh(lidarBeamGeo, this.materials.lidarGlow);
    this.lidarBeam.position.set(0, 1.58, 0.3);
    this.sensorGroup.add(this.lidarBeam);

    // 2. Driver Monitoring System (DMS) In-Cabin Infrared Camera
    const dmsCameraGeo = new THREE.BoxGeometry(0.08, 0.05, 0.06);
    this.dmsCamera = new THREE.Mesh(dmsCameraGeo, this.materials.chassisFrame);
    this.dmsCamera.position.set(-0.25, 1.28, 0.5);
    this.dmsCamera.rotation.x = -0.35;
    this.dmsCamera.userData = { 
      partName: 'Cabin DMS Infrared Vision Sensor', 
      category: 'drowsiness', 
      desc: 'Near-infrared 940nm optical camera tracking eye-gaze vector, pupil dilation, and PERCLOS.' 
    };
    this.sensorGroup.add(this.dmsCamera);

    // DMS Tracking Cone onto driver position
    const dmsConeGeo = new THREE.ConeGeometry(0.28, 0.65, 16, 1, true);
    dmsConeGeo.rotateX(Math.PI / 2 + 0.35);
    this.dmsCone = new THREE.Mesh(dmsConeGeo, new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    this.dmsCone.position.set(-0.35, 1.05, 0.2);
    this.sensorGroup.add(this.dmsCone);
  }

  buildPhysicsGizmos() {
    this.physicsGroup = new THREE.Group();
    this.physicsGroup.name = 'Physics_Telemetry_Gizmos';
    this.carGroup.add(this.physicsGroup);

    // Center of Mass (CoM) Marker
    const comGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const comMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
    this.comMarker = new THREE.Mesh(comGeo, comMat);
    this.comMarker.position.set(0, 0.48, 0.05); // low EV battery-centered CoM
    this.comMarker.userData = { partName: 'Vehicle Center of Mass (CoM)', category: 'physics', desc: 'Optimal low CoM enabled by structural underbody skate pack.' };
    this.physicsGroup.add(this.comMarker);

    // Dynamic G-Force Vector Arrow
    const arrowDir = new THREE.Vector3(0, -1, 0);
    this.gVectorArrow = new THREE.ArrowHelper(arrowDir, this.comMarker.position, 1.2, 0x00f0ff, 0.25, 0.15);
    this.physicsGroup.add(this.gVectorArrow);
  }

  initInteraction() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.container.addEventListener('mousemove', (e) => {
      const rect = this.container.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / this.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / this.height) * 2 + 1;
      this.checkHover();
    });

    this.container.addEventListener('click', (e) => {
      this.checkClick();
    });
  }

  checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.carGroup.children, true);

    if (intersects.length > 0) {
      let hitPart = null;
      for (let i = 0; i < intersects.length; i++) {
        if (intersects[i].object.userData && intersects[i].object.userData.partName) {
          hitPart = intersects[i].object;
          break;
        }
      }

      if (hitPart) {
        this.container.style.cursor = 'pointer';
        return;
      }
    }
    this.container.style.cursor = 'grab';
  }

  checkClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.carGroup.children, true);

    if (intersects.length > 0) {
      let hitObj = null;
      for (let i = 0; i < intersects.length; i++) {
        if (intersects[i].object.userData && intersects[i].object.userData.partName) {
          hitObj = intersects[i].object;
          break;
        }
      }

      if (hitObj) {
        this.selectPart(hitObj);
      }
    }
  }

  selectPart(obj) {
    this.selectedPart = obj;
    const data = obj.userData;
    
    // Show HUD Overlay
    const overlay = document.getElementById('part-inspector-overlay');
    if (overlay) {
      document.getElementById('pio-title').textContent = data.partName;
      document.getElementById('pio-cat').textContent = `Subsystem: ${data.category ? data.category.toUpperCase() : 'TELEMETRY'}`;
      document.getElementById('pio-desc').textContent = data.desc || 'Active physical component mapped to CAN-bus telemetry.';
      overlay.classList.add('visible');
    }

    // Switch active module tab if matching
    if (data.category && window.appEngine && window.appEngine.switchTab) {
      window.appEngine.switchTab(data.category);
    }

    // Play tactile sound
    if (window.soundFX) window.soundFX.playBeep(880, 0.08);
  }

  highlightCategory(category) {
    // Dynamically highlight components belonging to a module category
    const isBattery = (category === 'battery');
    const isAirbag = (category === 'airbag');
    const isTyre = (category === 'tyre');
    const isSlip = (category === 'slip');
    const isPhysics = (category === 'physics');
    const isDms = (category === 'drowsiness');

    // Pulse battery light
    if (this.batteryPointLight) {
      this.batteryPointLight.intensity = isBattery ? 3.5 : 1.2;
    }

    // Set DMS Cone visibility
    if (this.dmsCone) {
      this.dmsCone.visible = isDms || this.viewMode === 'xray';
    }

    // Calipers glow for slip/ESC
    Object.values(this.wheels).forEach(w => {
      if (isSlip) {
        w.caliperMat.emissive.setHex(0xffb800);
        w.caliperMat.emissiveIntensity = 0.9;
      } else {
        w.caliperMat.emissive.setHex(0x005522);
        w.caliperMat.emissiveIntensity = 0.3;
      }
    });
  }

  setViewPreset(preset) {
    const coords = {
      iso: { pos: [5.8, 3.2, 7.2], target: [0, 0.6, 0] },
      top: { pos: [0.01, 9.5, 0], target: [0, 0.5, 0] },
      battery: { pos: [0, -1.8, 5.2], target: [0, 0.3, 0] },
      cockpit: { pos: [-0.35, 1.25, -0.2], target: [-0.35, 0.9, 1.8] },
      suspension: { pos: [-1.8, 0.6, 2.2], target: [-0.96, 0.42, 1.45] }
    };

    const targetPreset = coords[preset] || coords.iso;
    this.tweenCamera(targetPreset.pos, targetPreset.target);
  }

  tweenCamera(targetPos, targetLookAt) {
    const startPos = this.camera.position.clone();
    const endPos = new THREE.Vector3(...targetPos);
    const startTarget = this.controls.target.clone();
    const endTarget = new THREE.Vector3(...targetLookAt);

    let progress = 0;
    const animateCamera = () => {
      progress += 0.04;
      this.camera.position.lerpVectors(startPos, endPos, progress);
      this.controls.target.lerpVectors(startTarget, endTarget, progress);
      this.controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(animateCamera);
      }
    };
    animateCamera();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    if (mode === 'exploded') {
      this.targetExplodedFactor = 1.0;
    } else {
      this.targetExplodedFactor = 0.0;
    }

    if (mode === 'xray') {
      this.materials.bodyHolo.opacity = 0.15;
      this.materials.bodyHolo.wireframe = true;
    } else if (mode === 'thermal') {
      this.materials.bodyHolo.opacity = 0.5;
      this.materials.bodyHolo.wireframe = false;
      this.materials.bodyHolo.emissive.setHex(0xff3300);
    } else {
      // default holographic
      this.materials.bodyHolo.opacity = 0.75;
      this.materials.bodyHolo.wireframe = false;
      this.materials.bodyHolo.emissive.setHex(0x002244);
    }
  }

  deployAirbags(immediate = false) {
    this.targetAirbagInflation = 1.0;
    if (immediate) this.airbagInflation = 1.0;

    // Flash screen
    const flash = document.getElementById('crash-flash');
    if (flash) {
      flash.classList.add('active');
      setTimeout(() => flash.classList.remove('active'), 120);
    }
  }

  resetAirbags() {
    this.targetAirbagInflation = 0.0;
    this.airbagInflation = 0.0;
  }

  updatePhysicalState(telemetry) {
    // 1. Gravity & Drop Physics
    if (telemetry.physics) {
      const dropOffset = telemetry.physics.dropHeight || 0;
      this.carGroup.position.y = dropOffset;
      
      // Update G-vector arrow
      if (this.gVectorArrow && telemetry.physics.gVector) {
        const { x, y, z } = telemetry.physics.gVector;
        const dir = new THREE.Vector3(x, y, z).normalize();
        const mag = Math.sqrt(x*x + y*y + z*z);
        this.gVectorArrow.setDirection(dir);
        this.gVectorArrow.setLength(Math.min(mag * 0.8, 3.0), 0.2, 0.1);
        
        // Color based on G-load safety
        const arrowColor = mag > 2.5 ? 0xff0055 : 0x00f0ff;
        this.gVectorArrow.setColor(arrowColor);
      }
    }

    // 2. Slip & Road Banking Angle
    if (telemetry.slip) {
      const bankRad = (telemetry.slip.bankAngle || 0) * (Math.PI / 180);
      this.groundGroup.rotation.z = bankRad;
      this.carGroup.rotation.z = bankRad; // car rolls with banked road

      // Chassis roll angle from lateral force
      const rollRad = (telemetry.slip.rollAngle || 0) * (Math.PI / 180);
      this.carGroup.rotation.x = rollRad;
    }

    // 3. Wheel Rotation & Active Suspension
    if (telemetry.tyre) {
      const { speed, wheelTravel } = telemetry.tyre;
      const rotDelta = (speed || 60) * 0.0004;

      // Rotate wheel hubs
      Object.keys(this.wheels).forEach(id => {
        const w = this.wheels[id];
        w.hub.rotation.x += rotDelta;

        // Apply suspension compression
        if (wheelTravel && wheelTravel[id] !== undefined) {
          const travelM = (wheelTravel[id] / 1000); // mm to meters
          w.group.position.y = w.baseY + travelM;
          w.spring.scale.y = 1 - (travelM * 2.5);
        }
      });
    }

    // 4. Battery Thermal Heatmap
    if (telemetry.battery && telemetry.battery.cellTemps) {
      const temps = telemetry.battery.cellTemps;
      for (let i = 0; i < this.batteryCells.length; i++) {
        const temp = temps[i] || 30;
        const cell = this.batteryCells[i];
        
        // Color gradient: 25C (Cyan) -> 45C (Yellow) -> 60C+ (Red)
        if (temp < 40) {
          cell.material.emissive.setHex(0x00f0ff);
          cell.material.color.setHex(0x00a3cc);
        } else if (temp < 50) {
          cell.material.emissive.setHex(0xffb800);
          cell.material.color.setHex(0xcc8800);
        } else {
          cell.material.emissive.setHex(0xff0055);
          cell.material.color.setHex(0xcc0033);
        }
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Rotate LIDAR beam
    if (this.lidarPuck && this.lidarBeam) {
      this.lidarBeam.rotation.y += 0.08;
    }

    // Motor flux animation
    if (this.rearFluxRing) {
      this.rearFluxRing.rotation.x += 0.05;
    }

    // Airbag Smooth Interpolation
    if (Math.abs(this.airbagInflation - this.targetAirbagInflation) > 0.005) {
      this.airbagInflation += (this.targetAirbagInflation - this.airbagInflation) * 0.25;
      const s = Math.max(0.001, this.airbagInflation);
      this.driverAirbagMesh.scale.set(s, s * 0.8, s);
      this.passengerAirbagMesh.scale.set(s * 1.1, s * 0.9, s * 1.1);
      this.curtainMeshL.scale.set(s, s, s);
      this.curtainMeshR.scale.set(s, s, s);
    }

    // Exploded View Smooth Interpolation
    if (Math.abs(this.explodedFactor - this.targetExplodedFactor) > 0.005) {
      this.explodedFactor += (this.targetExplodedFactor - this.explodedFactor) * 0.1;
      
      // Separate components
      if (this.bodyMesh) this.bodyMesh.position.y = 0.7 + (this.explodedFactor * 1.6);
      if (this.batteryGroup) this.batteryGroup.position.y = -(this.explodedFactor * 0.8);
      if (this.powertrainGroup) this.powertrainGroup.position.z = -(this.explodedFactor * 0.7);
      if (this.wheels.FL) this.wheels.FL.group.position.x = -0.96 - (this.explodedFactor * 0.6);
      if (this.wheels.FR) this.wheels.FR.group.position.x = 0.96 + (this.explodedFactor * 0.6);
      if (this.wheels.RL) this.wheels.RL.group.position.x = -0.96 - (this.explodedFactor * 0.6);
      if (this.wheels.RR) this.wheels.RR.group.position.x = 0.96 + (this.explodedFactor * 0.6);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }
}
