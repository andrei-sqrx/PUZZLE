// ============================================================
//  NEXUS GT — Interactive 3D Automotive Showroom
//  Built with Three.js r160 + GSAP ScrollTrigger
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// ────────────────────────────────────────────────────────────
//  0 · GLOBALS & CONFIG
// ────────────────────────────────────────────────────────────
const CONFIG = {
    colors: {
        modenaYellow:   new THREE.Color(0xeebb00),
        obsidianBlack:  new THREE.Color(0x1a1a2e),
        glacierWhite:   new THREE.Color(0xe8e8e8),
        rossoCorsa:     new THREE.Color(0x8b1a1a),
        atlanticBlue:   new THREE.Color(0x1a3a5c),
        racingGreen:    new THREE.Color(0x2d4a2d),
    },
    cameraPositions: [
        { pos: [8, 3.5, 10],   target: [0, 0.6, 0], fov: 42 },   // 0 Hero
        { pos: [5.5, 1.8, 4],  target: [0, 0.6, 0], fov: 38 },   // 1 Front ¾
        { pos: [0, 1.4, 6.5],  target: [0, 0.6, 0], fov: 36 },   // 2 Side
        { pos: [1.2, 2.0, 1.8],target: [0.2, 0.8, -0.2], fov: 52},// 3 Interior
        { pos: [-5, 2, 4.5],   target: [0, 0.6, 0], fov: 38 },   // 4 Rear
        { pos: [4, 2.5, 6],    target: [0, 0.6, 0], fov: 40 },   // 5 Config
        { pos: [6, 2, 8],      target: [0, 0.4, 0], fov: 42 },   // 6 CTA
    ],
    hotspots: [
        { pos: [2.25, 0.65, 0.75], title: 'Adaptive LED Matrix Headlights', desc: 'Intelligent high-beam assist with 84 individually controlled LEDs per unit. The system reads the road ahead and shapes the beam to illuminate without dazzling oncoming traffic — delivering up to 650 metres of visibility in complete darkness.' },
        { pos: [1.45, 0.40, 1.05],  title: '21″ Forged Carbon-Ceramic Brakes', desc: 'Lightweight forged alloy wheels paired with carbon-ceramic brake discs provide relentless stopping power, shedding 18 kg of unsprung mass compared to conventional steel brakes. Track-proven endurance with road-car refinement.' },
        { pos: [0.0, 1.62, 0.0],   title: 'Carbon Fibre Panoramic Roof', desc: 'A single-piece carbon fibre panel replaces the traditional steel roof, lowering the centre of gravity by 12 mm while flooding the cabin with natural light through the electrochromic glass section.' },
        { pos: [-2.35, 0.95, 0.0], title: 'Active Aerodynamic Rear Spoiler', desc: 'Deploys automatically above 120 km/h and adjusts angle through three positions — Comfort, Sport, and Track — to balance downforce and drag. Generates up to 80 kg of additional rear-axle load at top speed.' },
    ],
};

// ────────────────────────────────────────────────────────────
//  Environment art direction
//  Keep the scene tunable from one place so the background stays
//  restrained while the car remains the visual focal point.
// ────────────────────────────────────────────────────────────
const ENVIRONMENT = {
    sky: {
        top: 0x040716,
        mid: 0x101f3e,
        horizon: 0x9b4c2d,
        bottom: 0x080b12,
    },
    fog: {
        density: 0.011,
        color: 0x07101c,
        glow: 0x25170d,
        opacity: 0.24,
    },
    stars: {
        count: 260,
        lowPerfCount: 90,
        minSize: 0.55,
        maxSize: 1.65,
    },
    particles: {
        count: 320,
        lowPerfCount: 90,
        opacity: 0.11,
    },
    floor: {
        size: 64,
        color: 0x101316,
        roughness: 0.42,
        metalness: 0.38,
    },
};

let renderer, scene, camera, controls;
let carGroup, paintMeshes = [], paintMaterials = [], glassMeshes = [];
let headlightL, headlightR, tailLightEmissive = [], lightMaterials = [];
let frontLightMaterials = [], rearLightMaterials = [];
let headlightsOn = false, ambientMode = false;
let envMap;
let currentSection = 0, scrollProgress = 0;
let mouseX = 0, mouseY = 0;
let orbiting = false;
let isLowPerf = false;

// Alpine background dynamic elements
let skyDomeMat = null;
let mountainGroups = [];       // [{group, depth}] for parallax
let fogPlaneMat = null;
let fogPlane = null;
let atmosphericParticles = null;
let atmosphericParticlePositions = null;
let atmosphericParticleVelocities = null;
let starField = null;
let starTwinkleData = null;

const clock = new THREE.Clock();
const tmpVec = new THREE.Vector3();
const lerpCamPos  = new THREE.Vector3();
const lerpCamTgt  = new THREE.Vector3();
let lerpFov = 42;

// ────────────────────────────────────────────────────────────
//  1 · RENDERER & SCENE
// ────────────────────────────────────────────────────────────
function initRenderer() {
    const canvas = document.getElementById('scene-canvas');
    if (!canvas || !window.WebGLRenderingContext) {
        document.getElementById('fallback').style.display = 'flex';
        return false;
    }
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: !isLowPerf,
            powerPreference: 'high-performance',
            alpha: false,
        });
    } catch {
        document.getElementById('fallback').style.display = 'flex';
        return false;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isLowPerf ? 1 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isLowPerf;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(ENVIRONMENT.fog.color, ENVIRONMENT.fog.density);

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
    const cp = CONFIG.cameraPositions[0];
    camera.position.set(...cp.pos);
    lerpCamPos.set(...cp.pos);
    lerpCamTgt.set(...cp.target);
    camera.lookAt(new THREE.Vector3(...cp.target));

    return true;
}

// ────────────────────────────────────────────────────────────
//  2 · ENVIRONMENT MAP (Procedural)
// ────────────────────────────────────────────────────────────
function createEnvMap() {
    const pmremGen = new THREE.PMREMGenerator(renderer);
    pmremGen.compileEquirectangularShader();

    const envScene = new THREE.Scene();

    // ── Alpine twilight sky for PMREM (static snapshot for reflections) ──
    const envSkyGeo = new THREE.SphereGeometry(50, 32, 16);
    const envSkyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
            topColor:     { value: new THREE.Color(ENVIRONMENT.sky.top) },
            midColor:     { value: new THREE.Color(ENVIRONMENT.sky.mid) },
            horizonColor: { value: new THREE.Color(ENVIRONMENT.sky.horizon) },
            bottomColor:  { value: new THREE.Color(ENVIRONMENT.sky.bottom) },
        },
        vertexShader: `
            varying vec3 vWorldPos;
            void main(){
                vec4 wp = modelMatrix * vec4(position,1.0);
                vWorldPos = wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform vec3 topColor, midColor, horizonColor, bottomColor;
            varying vec3 vWorldPos;
            void main(){
                float h = normalize(vWorldPos).y;
                // Below horizon
                vec3 col = mix(bottomColor, horizonColor, smoothstep(-0.15, 0.0, h));
                // Horizon glow band
                col = mix(col, horizonColor, smoothstep(-0.02, 0.0, h) * smoothstep(0.12, 0.0, h));
                // Mid sky
                col = mix(col, midColor, smoothstep(0.0, 0.35, h));
                // Upper sky
                col = mix(col, topColor, smoothstep(0.3, 0.7, h));
                gl_FragColor = vec4(col, 1.0);
            }
        `,
    });
    envScene.add(new THREE.Mesh(envSkyGeo, envSkyMat));

    // Warm horizon glow panels (baked into env reflections for the car)
    const panelGeo = new THREE.PlaneGeometry(24, 3.2);
    const warmPanelMat = new THREE.MeshBasicMaterial({ color: 0xb86636, side: THREE.DoubleSide });
    const warmPanel = new THREE.Mesh(panelGeo, warmPanelMat);
    warmPanel.position.set(-3, 2.2, -34);
    warmPanel.lookAt(0, 1.2, 0);
    envScene.add(warmPanel);

    // A second, narrower warm card creates a controlled reflection band
    // across the shoulder line instead of illuminating the whole body evenly.
    const reflectionBandGeo = new THREE.PlaneGeometry(18, 1.4);
    const reflectionBandMat = new THREE.MeshBasicMaterial({ color: 0x7e3822, side: THREE.DoubleSide });
    const reflectionBand = new THREE.Mesh(reflectionBandGeo, reflectionBandMat);
    reflectionBand.position.set(4, 3.8, -28);
    reflectionBand.lookAt(0, 1.0, 0);
    envScene.add(reflectionBand);

    // Subtle overhead cool fill panel
    const topPanelGeo = new THREE.PlaneGeometry(14, 8);
    const topPanelMat = new THREE.MeshBasicMaterial({ color: 0x2b3c5b, side: THREE.DoubleSide });
    const topPanel = new THREE.Mesh(topPanelGeo, topPanelMat);
    topPanel.position.set(0, 12, 0);
    topPanel.rotation.x = Math.PI / 2;
    envScene.add(topPanel);

    // Side fill panels (subtle cool)
    const sidePanelGeo = new THREE.PlaneGeometry(8, 5);
    const sidePanelMat = new THREE.MeshBasicMaterial({ color: 0x14243c, side: THREE.DoubleSide });
    const sideL = new THREE.Mesh(sidePanelGeo, sidePanelMat.clone());
    sideL.position.set(-12, 3, 0);
    sideL.rotation.y = Math.PI / 2;
    envScene.add(sideL);
    const sideR = new THREE.Mesh(sidePanelGeo, sidePanelMat.clone());
    sideR.position.set(12, 3, 0);
    sideR.rotation.y = -Math.PI / 2;
    envScene.add(sideR);

    envMap = pmremGen.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    scene.background = new THREE.Color(0x030308);
    pmremGen.dispose();

    // ── Visible animated sky dome (will be updated each frame) ──
    const visibleSkyGeo = new THREE.SphereGeometry(120, 64, 32);
    skyDomeMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
            uTime:        { value: 0.0 },
            uNightMix:    { value: 0.0 },
            topColor:     { value: new THREE.Color(ENVIRONMENT.sky.top) },
            midColor:     { value: new THREE.Color(ENVIRONMENT.sky.mid) },
            horizonColor: { value: new THREE.Color(ENVIRONMENT.sky.horizon) },
            bottomColor:  { value: new THREE.Color(ENVIRONMENT.sky.bottom) },
        },
        vertexShader: `
            varying vec3 vWorldPos;
            varying vec2 vUv;
            void main(){
                vec4 wp = modelMatrix * vec4(position,1.0);
                vWorldPos = wp.xyz;
                vUv = uv;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }
        `,
        fragmentShader: `
            uniform vec3 topColor, midColor, horizonColor, bottomColor;
            uniform float uTime, uNightMix;
            varying vec3 vWorldPos;
            varying vec2 vUv;

            // Simple 2D hash for subtle cloud wisps
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            float noise2D(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }
            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for(int i = 0; i < 4; i++){
                    v += a * noise2D(p);
                    p *= 2.0;
                    a *= 0.5;
                }
                return v;
            }

            void main(){
                float h = normalize(vWorldPos).y;

                // Base gradient
                vec3 col = mix(bottomColor, horizonColor, smoothstep(-0.15, 0.0, h));
                // Warm horizon glow band with subtle time pulsation
                float glowPulse = 1.0 + 0.08 * sin(uTime * 0.15);
                col = mix(col, horizonColor * glowPulse, smoothstep(-0.02, 0.0, h) * smoothstep(0.12, 0.0, h));
                col = mix(col, midColor, smoothstep(0.0, 0.35, h));
                col = mix(col, topColor, smoothstep(0.3, 0.7, h));

                // High-altitude wispy cloud bands drifting across the sky.
                // Keep the contrast low so the sky reads as atmosphere, not texture.
                if(h > 0.05 && h < 0.45){
                    float angle = atan(vWorldPos.z, vWorldPos.x);
                    vec2 cloudUV = vec2(angle * 2.0 + uTime * 0.012, h * 8.0);
                    float cloud = fbm(cloudUV * 3.0);
                    cloud = smoothstep(0.47, 0.72, cloud);
                    float cloudFade = smoothstep(0.05, 0.15, h) * smoothstep(0.45, 0.25, h);
                    col = mix(col, midColor * 1.35, cloud * cloudFade * 0.12);
                }

                // Ambient mode cools the sky slightly for a night-drive mood.
                col = mix(col, col * vec3(0.58, 0.72, 1.08), uNightMix * 0.45);

                gl_FragColor = vec4(col, 1.0);
            }
        `,
        depthWrite: false,
    });
    const visibleSky = new THREE.Mesh(visibleSkyGeo, skyDomeMat);
    scene.add(visibleSky);

    // ── Twinkling Starfield ──
    createStarField();
}

// Stars as a separate Points system above the sky dome
function createStarField() {
    const starCount = isLowPerf ? ENVIRONMENT.stars.lowPerfCount : ENVIRONMENT.stars.count;
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const twinklePhases = new Float32Array(starCount);
    const twinkleSpeeds = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        // Distribute stars only in the upper hemisphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.pow(Math.random(), 0.82) * 0.82; // keep the horizon mostly clear
        const r = 115;
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi); // y = up
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        sizes[i] = ENVIRONMENT.stars.minSize +
            Math.random() * (ENVIRONMENT.stars.maxSize - ENVIRONMENT.stars.minSize);
        twinklePhases[i] = Math.random() * Math.PI * 2;
        twinkleSpeeds[i] = 0.5 + Math.random() * 2.5;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const starMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uNightMix: { value: 0.0 },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        },
        vertexShader: `
            attribute float aSize;
            uniform float uTime;
            uniform float uPixelRatio;
            varying float vTwinkle;
            void main(){
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                // Slow, irregular twinkle; the field should feel nearly still.
                vTwinkle = 0.62 + 0.38 * abs(sin(uTime * 0.22 + position.z * 0.14));
                gl_PointSize = aSize * uPixelRatio * (80.0 / -mvPos.z);
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            uniform float uNightMix;
            varying float vTwinkle;
            void main(){
                float d = length(gl_PointCoord - 0.5);
                float alpha = smoothstep(0.5, 0.15, d) * vTwinkle * mix(0.58, 0.92, uNightMix);
                gl_FragColor = vec4(0.78, 0.84, 1.0, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);
}

// ────────────────────────────────────────────────────────────
//  3 · LIGHTING
// ────────────────────────────────────────────────────────────
function setupLighting() {
    // Deep twilight blue ambient — fills the shadow side with cool mountain air tones
    const amb = new THREE.AmbientLight(0x172440, 0.36);
    scene.add(amb);

    // Hemisphere light: warm below (ground bounce from sunset), cool above (twilight sky)
    const hemi = new THREE.HemisphereLight(0x0a1530, 0x342013, 0.32);
    scene.add(hemi);

    // Low-angle warm sunset key light — casts dramatic long vehicle shadows
    const key = new THREE.DirectionalLight(0xff9a52, 1.2);
    key.position.set(-6, 3, -8);  // low-angle from behind-left (sunset direction)
    key.castShadow = !isLowPerf;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.001;
    scene.add(key);

    // Overhead softbox — dimmed for twilight, subtle cool tone
    RectAreaLightUniformsLib.init();
    const rect1 = new THREE.RectAreaLight(0xc0d0e8, 3.0, 14, 4);
    rect1.position.set(0, 4.5, 0);
    rect1.lookAt(0, 0, 0);
    scene.add(rect1);

    // Rear overhead softbox — subtle warm fill for the rear haunches
    const rect2 = new THREE.RectAreaLight(0xe8c090, 1.0, 8, 2.5);
    rect2.position.set(-4, 3, 0);
    rect2.lookAt(0, 0, 0);
    scene.add(rect2);

    // Cool fill from the front-right (mountain blue ambient bounce)
    const fill = new THREE.DirectionalLight(0x6080b0, 0.22);
    fill.position.set(4, 3, 3);
    scene.add(fill);

    // Golden rim light — grazes the roofline, wheel arches, and rear haunches from behind
    const rim = new THREE.DirectionalLight(0xd4a040, 0.55);
    rim.position.set(-2, 2.5, -6);
    scene.add(rim);

    // Headlights (initially off)
    headlightL = new THREE.SpotLight(0xfff8e8, 0, 25, Math.PI / 5, 0.6, 1.2);
    headlightL.userData.excludeAmbientControl = true;
    headlightL.position.set(2.45, 0.65, 0.75);
    headlightL.target.position.set(9.0, -0.2, 0.75);
    scene.add(headlightL);
    scene.add(headlightL.target);

    headlightR = new THREE.SpotLight(0xfff8e8, 0, 25, Math.PI / 5, 0.6, 1.2);
    headlightR.userData.excludeAmbientControl = true;
    headlightR.position.set(2.45, 0.65, -0.75);
    headlightR.target.position.set(9.0, -0.2, -0.75);
    scene.add(headlightR);
    scene.add(headlightR.target);
}

function createFloor() {
    // ── Broad wet asphalt terrace ──
    // The larger plane lets the environment dissolve into fog instead of
    // revealing a hard circular display platform around the vehicle.
    const geo = new THREE.PlaneGeometry(ENVIRONMENT.floor.size, ENVIRONMENT.floor.size, 2, 2);
    const asphaltTexture = createAsphaltRoughnessTexture();
    const mat = new THREE.MeshStandardMaterial({
        color: ENVIRONMENT.floor.color,
        metalness: ENVIRONMENT.floor.metalness,
        roughness: ENVIRONMENT.floor.roughness,
        roughnessMap: asphaltTexture,
        bumpMap: asphaltTexture,
        bumpScale: 0.018,
        envMapIntensity: 0.95,
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    scene.add(floor);

    // A soft, elliptical wet patch gives the car a controlled reflection
    // without turning the entire terrace into a mirror.
    createReflectionPool();

    // ── Alpine Mountain Silhouettes ──
    createAlpineMountains();

    // ── Rolling Valley Fog ──
    createDynamicFog();

    // ── Atmospheric Moisture Motes ──
    createAtmosphericParticles();
}

function createAsphaltRoughnessTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(size, size);

    // Fine grain keeps the asphalt from looking like a flat black plane.
    for (let i = 0; i < image.data.length; i += 4) {
        const value = 112 + Math.floor(Math.random() * 108);
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);

    // Larger darker patches represent irregular damp areas and break up the
    // repeated grain at a distance.
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 24; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = 12 + Math.random() * 34;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(45, 55, 68, 0.65)');
        gradient.addColorStop(1, 'rgba(160, 170, 180, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, radius * 1.5, radius * 0.65, Math.random(), 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3.5, 3.5);
    texture.needsUpdate = true;
    return texture;
}

function createReflectionPool() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(0.45, 'rgba(170, 195, 225, 0.62)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const alphaMap = new THREE.CanvasTexture(canvas);
    const pool = new THREE.Mesh(
        new THREE.PlaneGeometry(7.2, 3.4),
        new THREE.MeshStandardMaterial({
            color: 0x384b67,
            metalness: 0.92,
            roughness: 0.08,
            envMapIntensity: 1.25,
            alphaMap,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
        })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.004, 0.15);
    pool.renderOrder = 1;
    scene.add(pool);
}

// ── Guardrail along the cliff edge ──
function createGuardrail() {
    const postCount = 16;
    const radius = 7.8;
    const arcAngle = Math.PI * 1.2;  // partial arc
    const startAngle = -Math.PI * 0.1;

    const postGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8);
    const postMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        metalness: 0.85,
        roughness: 0.25,
    });

    // Cable rail: use a thin tube along the arc
    const cablePoints = [];
    for (let i = 0; i <= postCount; i++) {
        const angle = startAngle + (i / postCount) * arcAngle;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        cablePoints.push(new THREE.Vector3(x, 0.65, z));
    }
    const cableCurve = new THREE.CatmullRomCurve3(cablePoints);
    const cableGeo = new THREE.TubeGeometry(cableCurve, 64, 0.018, 6, false);
    const cableMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.9,
        roughness: 0.15,
    });
    scene.add(new THREE.Mesh(cableGeo, cableMat));

    // Lower cable
    const lowerCablePoints = cablePoints.map(p => new THREE.Vector3(p.x, 0.35, p.z));
    const lowerCurve = new THREE.CatmullRomCurve3(lowerCablePoints);
    const lowerCableGeo = new THREE.TubeGeometry(lowerCurve, 64, 0.012, 6, false);
    scene.add(new THREE.Mesh(lowerCableGeo, cableMat));

    // Posts
    for (let i = 0; i <= postCount; i++) {
        const angle = startAngle + (i / postCount) * arcAngle;
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(
            Math.cos(angle) * radius,
            0.40,
            Math.sin(angle) * radius
        );
        post.castShadow = !isLowPerf;
        scene.add(post);
    }
}

// ── Procedural Mountain Ridgelines ──
function createAlpineMountains() {
    // Helper: generate a jagged mountain ridge path
    function generateRidgePath(segCount, baseRadius, heightMin, heightMax, jaggedness, seed) {
        const points = [];
        for (let i = 0; i <= segCount; i++) {
            const angle = (i / segCount) * Math.PI * 2;
            const jitter = Math.sin(i * 13.37 + seed) * jaggedness;
            const peakHeight = heightMin + (heightMax - heightMin) *
                (0.5 + 0.5 * Math.sin(i * 2.7 + seed * 0.3) * Math.cos(i * 1.3 + seed));
            points.push({
                angle,
                radius: baseRadius + jitter,
                height: Math.max(heightMin, peakHeight),
            });
        }
        return points;
    }

    function buildMountainMesh(ridgePath, baseY, color, rimColor, rimPower, opacity) {
        const verts = [];
        const indices = [];

        // Each ridge point generates 2 vertices: bottom and peak
        ridgePath.forEach(p => {
            const x = Math.cos(p.angle) * p.radius;
            const z = Math.sin(p.angle) * p.radius;
            verts.push(x, baseY, z);          // bottom vertex
            verts.push(x, p.height, z);       // peak vertex
        });

        for (let i = 0; i < ridgePath.length - 1; i++) {
            const bl = i * 2;
            const tl = i * 2 + 1;
            const br = (i + 1) * 2;
            const tr = (i + 1) * 2 + 1;
            indices.push(bl, br, tl);
            indices.push(tl, br, tr);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uBaseColor: { value: new THREE.Color(color) },
                uRimColor:  { value: new THREE.Color(rimColor) },
                uRimPower:  { value: rimPower },
                uOpacity:   { value: opacity },
                uSunDir:    { value: new THREE.Vector3(-0.5, 0.15, -0.7).normalize() },
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                varying float vHeight;
                void main(){
                    vNormal = normalize(normalMatrix * normal);
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    vHeight = position.y;
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,
            fragmentShader: `
                uniform vec3 uBaseColor, uRimColor, uSunDir;
                uniform float uRimPower, uOpacity;
                varying vec3 vNormal, vWorldPos;
                varying float vHeight;
                void main(){
                    // Silhouette darkening
                    vec3 col = uBaseColor;

                    // Rim/fresnel horizon glow from sunset behind peaks
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), uRimPower);
                    float sunFacing = max(dot(vNormal, uSunDir), 0.0);
                    col = mix(col, uRimColor, fresnel * 0.5 + sunFacing * 0.2);

                    // Height-based atmospheric fade
                    float heightFade = smoothstep(-1.0, 12.0, vHeight);
                    col = mix(uBaseColor * 0.6, col, heightFade);

                    gl_FragColor = vec4(col, uOpacity * mix(0.72, 1.0, heightFade));
                }
            `,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
        });

        return new THREE.Mesh(geo, mat);
    }

    // Far range (deep, hazy, blueish silhouettes)
    const farRidge = generateRidgePath(80, 96, 2, 20, 7, 42.0);
    const farMtn = buildMountainMesh(farRidge, -3, 0x0d1524, 0x394568, 2.5, 0.54);
    farMtn.renderOrder = 0;
    scene.add(farMtn);
    mountainGroups.push({ mesh: farMtn, depth: 0.95, baseRotY: 0 });

    // Mid range (sharper, darker peaks)
    const midRidge = generateRidgePath(60, 58, 1, 12, 4.5, 17.5);
    const midMtn = buildMountainMesh(midRidge, -2, 0x080d17, 0x61402c, 3.0, 0.72);
    midMtn.renderOrder = 1;
    scene.add(midMtn);
    mountainGroups.push({ mesh: midMtn, depth: 0.65, baseRotY: 0 });

    // Near range (close crags, very dark)
    const nearRidge = generateRidgePath(40, 31, -1, 5.5, 2.5, 7.2);
    const nearMtn = buildMountainMesh(nearRidge, -2, 0x04060a, 0x392915, 4.0, 0.90);
    nearMtn.renderOrder = 2;
    scene.add(nearMtn);
    mountainGroups.push({ mesh: nearMtn, depth: 0.3, baseRotY: 0 });
}

// ── Rolling Valley Fog ──
function createDynamicFog() {
    const fogGeo = new THREE.PlaneGeometry(200, 200, 1, 1);
    fogPlaneMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uNightMix: { value: 0.0 },
            uOpacity: { value: ENVIRONMENT.fog.opacity },
            uFogColor:  { value: new THREE.Color(ENVIRONMENT.fog.color) },
            uGlowColor: { value: new THREE.Color(ENVIRONMENT.fog.glow) },
        },
        vertexShader: `
            varying vec2 vUv;
            void main(){
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime, uNightMix, uOpacity;
            uniform vec3 uFogColor, uGlowColor;
            varying vec2 vUv;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            float noise2D(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                    f.y
                );
            }
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5;
                for(int i = 0; i < 5; i++){
                    v += a * noise2D(p);
                    p *= 2.0;
                    a *= 0.5;
                }
                return v;
            }

            void main(){
                vec2 uv = vUv;

                // Drift the fog
                vec2 drift = vec2(uTime * 0.008, uTime * 0.003);
                float fog = fbm((uv * 4.0) + drift);
                fog = smoothstep(0.3, 0.75, fog);

                // Breathing billow: fog swells and recedes
                float breathe = 0.7 + 0.3 * sin(uTime * 0.12);
                fog *= breathe;

                // Radial fade: less fog near camera, more at edges
                float dist = length(uv - 0.5) * 2.0;
                float radialFade = smoothstep(0.1, 0.7, dist);
                fog *= radialFade;

                // Color: mix between cool fog and a restrained sunset glow near
                // the horizon, while keeping the immediate foreground clear.
                float warmth = smoothstep(0.3, 0.9, uv.y);
                vec3 col = mix(uFogColor, uGlowColor, warmth * 0.4);
                col = mix(col, col * vec3(0.58, 0.72, 1.08), uNightMix * 0.35);

                gl_FragColor = vec4(col, fog * uOpacity);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    fogPlane = new THREE.Mesh(fogGeo, fogPlaneMat);
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.y = -0.42;  // below the terrace, filling the valley
    fogPlane.renderOrder = 3;
    scene.add(fogPlane);
}

// ── Atmospheric Moisture Motes ──
function createAtmosphericParticles() {
    const count = isLowPerf ? ENVIRONMENT.particles.lowPerfCount : ENVIRONMENT.particles.count;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        // Keep most motes at the edge of the scene so the air feels alive
        // without putting a layer of noise directly over the bodywork.
        const angle = Math.random() * Math.PI * 2;
        const distance = 5.5 + Math.random() * 6.5;
        positions[i * 3]     = Math.cos(angle) * distance;
        positions[i * 3 + 1] = Math.random() * 3.5 + 0.45;
        positions[i * 3 + 2] = Math.sin(angle) * distance;

        // Gentle wind drift (mostly lateral with slight upward thermal)
        velocities.push(
            (Math.random() - 0.3) * 0.3,    // x: slight eastward bias (wind)
            (Math.random() - 0.4) * 0.05,    // y: slight upward thermal
            (Math.random() - 0.5) * 0.2      // z: gentle cross-wind
        );

        sizes[i] = 0.5 + Math.random() * 1.5;
    }

    atmosphericParticlePositions = positions;
    atmosphericParticleVelocities = velocities;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uHeadlightsOn: { value: 0.0 },
            uBaseOpacity: { value: ENVIRONMENT.particles.opacity },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        },
        vertexShader: `
            attribute float aSize;
            uniform float uTime;
            uniform float uPixelRatio;
            uniform float uHeadlightsOn, uBaseOpacity;
            varying float vAlpha;
            varying float vLit;
            void main(){
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);

                // Flicker: subtle per-mote oscillation
                float flicker = 0.5 + 0.5 * sin(uTime * 1.5 + position.x * 10.0 + position.z * 7.0);
                vAlpha = uBaseOpacity + uBaseOpacity * flicker;

                // Headlight illumination: motes in front of car glow brighter
                float inBeam = step(0.0, position.x) * smoothstep(5.0, 0.0, abs(position.z)) * smoothstep(6.0, 0.0, position.x);
                vLit = inBeam * uHeadlightsOn;
                vAlpha += vLit * 0.4;

                gl_PointSize = aSize * uPixelRatio * (40.0 / -mvPos.z);
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            varying float vAlpha;
            varying float vLit;
            void main(){
                float d = length(gl_PointCoord - 0.5);
                float alpha = smoothstep(0.5, 0.1, d) * vAlpha;
                // Warm white when lit by headlights, cool blue-grey otherwise
                vec3 col = mix(vec3(0.55, 0.6, 0.7), vec3(1.0, 0.95, 0.85), vLit);
                gl_FragColor = vec4(col, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    atmosphericParticles = new THREE.Points(geo, mat);
    scene.add(atmosphericParticles);
}

// ────────────────────────────────────────────────────────────
//  5 · 3D MODEL LOADER (Ferrari Purosangue GLB)
// ────────────────────────────────────────────────────────────
function createContactShadow() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(256, 128, 30, 256, 128, 220);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
    grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.55)');
    grad.addColorStop(0.8, 'rgba(0, 0, 0, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    const texture = new THREE.CanvasTexture(canvas);
    const planeGeo = new THREE.PlaneGeometry(5.4, 2.6);
    const planeMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.93,
        depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(planeGeo, planeMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = 0.002;
    scene.add(shadowMesh);
}

function loadCarModel() {
    return new Promise((resolve) => {
        const fill = document.getElementById('loader-fill');
        const text = document.getElementById('loader-text');
        const loader = new GLTFLoader();

        loader.load(
            encodeURI('ferrari_purosangue (3).glb'),
            (gltf) => {
                if (text) text.textContent = 'Finalizing showroom...';
                if (fill) fill.style.width = '100%';

                carGroup = new THREE.Group();

                // Detach root_559 (the clean, untransformed Ferrari model root)
                const root559 = gltf.scene.getObjectByName('root_559');

                if (root559) {
                    // Rotate Blender coordinates into Three.js showroom space:
                    // X_blender -> Z_showroom, Y_blender -> X_showroom, Z_blender -> Y_showroom
                    const rotMatrix = new THREE.Matrix4().set(
                        0, 1, 0, 0,
                        0, 0, 1, 0,
                        1, 0, 0, 0,
                        0, 0, 0, 1
                    );
                    root559.applyMatrix4(rotMatrix);
                    carGroup.add(root559);
                } else {
                    // Fallback: hide Hintze Hall scan meshes
                    gltf.scene.traverse((child) => {
                        const name = (child.name || '').toLowerCase();
                        if (name.includes('hintze') || name.includes('hall')) {
                            child.visible = false;
                        }
                    });
                    carGroup.add(gltf.scene);
                }

                // Compute bounding box to center car and ground tires on floor
                carGroup.updateMatrixWorld(true);
                const bbox = new THREE.Box3().setFromObject(carGroup);
                const center = bbox.getCenter(new THREE.Vector3());

                // Offset car inside carGroup so carGroup origin remains at (0, 0, 0)
                if (root559) {
                    root559.position.x = -center.x;
                    root559.position.z = -center.z;
                    root559.position.y = -bbox.min.y;
                } else {
                    carGroup.position.x = -center.x;
                    carGroup.position.z = -center.z;
                    carGroup.position.y = -bbox.min.y;
                }
                carGroup.updateMatrixWorld(true);

                // Traverse meshes for lighting, envMap reflections, and paint materials
                carGroup.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = !isLowPerf;
                        child.receiveShadow = !isLowPerf;

                        if (child.material) {
                            if (envMap) {
                                child.material.envMap = envMap;
                                child.material.envMapIntensity = 1.3;
                            }

                            // Accent materials (Wing, Wheels, Interior Seats)
                            const accentMatNames = ['x3_63_m_02_b_52', 'x3_63_m_02_b_30', 'x3_63_m_02_b_42'];
                            if (accentMatNames.includes(child.material.name)) {
                                paintMeshes.push(child);
                                if (!paintMaterials.includes(child.material)) {
                                    paintMaterials.push(child.material);
                                    // Remove base color texture so color picker controls appearance
                                    child.material.map = null;
                                    
                                    if (child.material.name === 'x3_63_m_02_b_52') {
                                        // Interior seats (matte leather)
                                        child.material.roughness = 0.7;
                                        child.material.metalness = 0.0;
                                        child.material.clearcoat = 0.0;
                                    } else {
                                        // Wheels and wing (glossy)
                                        child.material.clearcoat = 1.0;
                                        child.material.clearcoatRoughness = 0.05;
                                        child.material.metalness = 0.8;
                                        child.material.roughness = 0.2;
                                    }
                                    child.material.color.copy(CONFIG.colors.modenaYellow);
                                    child.material.needsUpdate = true;
                                }
                            }

                            // ── Light materials: fix green emissive textures ──
                            // All x3_00_l_01* materials have green-tinted emissive textures from the GLB.
                            // We clone per-mesh, strip the emissive map, and set correct colors
                            // based on world-space X position (front = white, rear = red).
                            if (child.material.name && child.material.name.startsWith('x3_00_l_01')) {
                                // Get world-space center X of this mesh
                                child.updateMatrixWorld(true);
                                const meshBox = new THREE.Box3().setFromObject(child);
                                const meshCenter = meshBox.getCenter(new THREE.Vector3());
                                const isFront = meshCenter.x > 0;

                                // Clone material so front and rear can have independent colors
                                const clonedMat = child.material.clone();
                                child.material = clonedMat;

                                // Strip the green emissive texture, use solid emissive color instead
                                clonedMat.emissiveMap = null;

                                if (isFront) {
                                    // Front headlights: white
                                    clonedMat.emissive = new THREE.Color(0xffffff);
                                    clonedMat.emissiveIntensity = 0.15;
                                    frontLightMaterials.push(clonedMat);
                                } else {
                                    // Rear taillights: red
                                    clonedMat.emissive = new THREE.Color(0xff2200);
                                    clonedMat.emissiveIntensity = 0.3;
                                    rearLightMaterials.push(clonedMat);
                                }
                                lightMaterials.push(clonedMat);
                                clonedMat.needsUpdate = true;
                            }

                            // Red taillight lens material — add red emissive glow
                            if (child.material.name === 'x3_63_m_02_b_40') {
                                child.material.emissive = new THREE.Color(0x660000);
                                child.material.emissiveIntensity = 0.3;
                                rearLightMaterials.push(child.material);
                            }
                        }
                    }
                });

                // Ground contact shadow
                createContactShadow();

                scene.add(carGroup);
                window.carGroup = carGroup;
                window.paintMaterials = paintMaterials;
                window.paintMeshes = paintMeshes;
                window.lightMaterials = lightMaterials;

                setTimeout(resolve, 350);
            },
            (xhr) => {
                if (xhr.lengthComputable && xhr.total > 0) {
                    const pct = Math.min(100, Math.round((xhr.loaded / xhr.total) * 100));
                    if (fill) fill.style.width = pct + '%';
                    if (text) text.textContent = `Loading Ferrari Purosangue (${pct}%)`;
                } else if (xhr.loaded) {
                    const mb = (xhr.loaded / (1024 * 1024)).toFixed(1);
                    if (text) text.textContent = `Loading Ferrari Purosangue (${mb} MB)`;
                }
            },
            (err) => {
                console.warn('Could not load GLB directly, using fallback:', err);
                if (text) text.textContent = 'Loading fallback experience...';
                buildCar();
                setTimeout(resolve, 400);
            }
        );
    });
}

// ────────────────────────────────────────────────────────────
//  5b · PROCEDURAL CAR (Fallback)
// ────────────────────────────────────────────────────────────
function buildCar() {
    carGroup = new THREE.Group();

    // ── Materials ──
    const paintMat = new THREE.MeshPhysicalMaterial({
        color: CONFIG.colors.obsidianBlack,
        metalness: 0.85,
        roughness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.2,
        reflectivity: 1.0,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x111122,
        metalness: 0.0,
        roughness: 0.05,
        transmission: 0.85,
        transparent: true,
        opacity: 0.4,
        ior: 1.5,
        thickness: 0.1,
        envMapIntensity: 0.8,
        side: THREE.DoubleSide,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.95,
        roughness: 0.08,
        envMapIntensity: 1.5,
    });
    const darkMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.3,
        roughness: 0.7,
    });
    const tireMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        metalness: 0.0,
        roughness: 0.9,
    });
    const headlightMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0x000000,
        emissiveIntensity: 0,
        metalness: 0.1,
        roughness: 0.1,
        transmission: 0.6,
        transparent: true,
        opacity: 0.6,
    });
    const taillightMat = new THREE.MeshStandardMaterial({
        color: 0x660000,
        emissive: 0x330000,
        emissiveIntensity: 0.3,
        metalness: 0.2,
        roughness: 0.3,
    });
    const interiorMat = new THREE.MeshStandardMaterial({
        color: 0x1a1210,
        metalness: 0.1,
        roughness: 0.8,
    });

    // ── Lower Body ──
    const lowerShape = new THREE.Shape();
    lowerShape.moveTo(-2.35, 0.18);
    lowerShape.lineTo(2.35, 0.18);
    lowerShape.lineTo(2.40, 0.22);
    lowerShape.lineTo(2.45, 0.40);
    lowerShape.quadraticCurveTo(2.45, 0.72, 2.20, 0.74);
    lowerShape.lineTo(0.70, 0.78);
    lowerShape.lineTo(0.68, 0.78);
    lowerShape.lineTo(-1.40, 0.78);
    lowerShape.lineTo(-2.10, 0.76);
    lowerShape.quadraticCurveTo(-2.40, 0.74, -2.45, 0.40);
    lowerShape.lineTo(-2.40, 0.22);
    lowerShape.lineTo(-2.35, 0.18);

    const lowerExt = { depth: 1.84, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 };
    const lowerGeo = new THREE.ExtrudeGeometry(lowerShape, lowerExt);
    lowerGeo.translate(0, 0, -0.92);
    const lowerBody = new THREE.Mesh(lowerGeo, paintMat);
    lowerBody.castShadow = true;
    carGroup.add(lowerBody);
    paintMeshes.push(lowerBody);

    // ── Upper Cabin ──
    const cabinShape = new THREE.Shape();
    cabinShape.moveTo(0.68, 0.78);
    cabinShape.quadraticCurveTo(0.85, 0.80, 1.00, 1.10);
    cabinShape.quadraticCurveTo(1.05, 1.28, 0.60, 1.34);
    cabinShape.lineTo(-0.50, 1.36);
    cabinShape.quadraticCurveTo(-0.90, 1.36, -1.05, 1.15);
    cabinShape.quadraticCurveTo(-1.15, 1.00, -1.30, 0.82);
    cabinShape.lineTo(-1.40, 0.78);
    cabinShape.lineTo(0.68, 0.78);

    const cabinExt = { depth: 1.56, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 };
    const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, cabinExt);
    cabinGeo.translate(0, 0, -0.78);
    const cabin = new THREE.Mesh(cabinGeo, paintMat);
    cabin.castShadow = true;
    carGroup.add(cabin);
    paintMeshes.push(cabin);

    // ── Windshield ──
    const wsGeo = new THREE.PlaneGeometry(1.48, 0.72);
    const ws = new THREE.Mesh(wsGeo, glassMat);
    ws.position.set(0.82, 1.06, 0);
    ws.rotation.set(0, 0, Math.PI * 0.22);
    ws.rotation.order = 'YXZ';
    carGroup.add(ws);
    glassMeshes.push(ws);

    // ── Rear window ──
    const rwGeo = new THREE.PlaneGeometry(1.36, 0.50);
    const rw = new THREE.Mesh(rwGeo, glassMat);
    rw.position.set(-1.10, 1.06, 0);
    rw.rotation.set(0, 0, -Math.PI * 0.18);
    carGroup.add(rw);
    glassMeshes.push(rw);

    // ── Side windows (left & right) ──
    const swShape = new THREE.Shape();
    swShape.moveTo(0.58, 0.82);
    swShape.lineTo(0.85, 1.08);
    swShape.lineTo(0.50, 1.30);
    swShape.lineTo(-0.50, 1.32);
    swShape.lineTo(-0.95, 1.10);
    swShape.lineTo(-1.20, 0.82);
    swShape.lineTo(0.58, 0.82);

    const swGeoL = new THREE.ShapeGeometry(swShape);
    const swL = new THREE.Mesh(swGeoL, glassMat);
    swL.position.set(0, 0, 0.82);
    carGroup.add(swL);
    glassMeshes.push(swL);

    const swGeoR = new THREE.ShapeGeometry(swShape);
    const swR = new THREE.Mesh(swGeoR, glassMat);
    swR.position.set(0, 0, -0.82);
    swR.rotation.y = Math.PI;
    carGroup.add(swR);
    glassMeshes.push(swR);

    // ── Headlights ──
    const hlGeo = new THREE.BoxGeometry(0.18, 0.12, 0.28);
    const hlL = new THREE.Mesh(hlGeo, headlightMat.clone());
    hlL.position.set(2.38, 0.55, 0.55);
    carGroup.add(hlL);

    const hlR = new THREE.Mesh(hlGeo, headlightMat.clone());
    hlR.position.set(2.38, 0.55, -0.55);
    carGroup.add(hlR);

    // Headlight lens strips
    const lensGeo = new THREE.BoxGeometry(0.02, 0.04, 0.22);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const lensL = new THREE.Mesh(lensGeo, lensMat.clone());
    lensL.position.set(2.47, 0.55, 0.55);
    carGroup.add(lensL);
    const lensR = new THREE.Mesh(lensGeo, lensMat.clone());
    lensR.position.set(2.47, 0.55, -0.55);
    carGroup.add(lensR);

    // Store headlight refs for toggle
    hlL.userData.headlight = true;
    hlR.userData.headlight = true;
    lensL.userData.headlightLens = true;
    lensR.userData.headlightLens = true;

    // ── Taillights (full-width bar) ──
    const tlGeo = new THREE.BoxGeometry(0.06, 0.10, 1.60);
    const tl = new THREE.Mesh(tlGeo, taillightMat);
    tl.position.set(-2.42, 0.56, 0);
    carGroup.add(tl);
    tailLightEmissive.push(tl);

    // Tail-light accent strips
    const tsGeo = new THREE.BoxGeometry(0.04, 0.04, 0.35);
    const tsMat = new THREE.MeshStandardMaterial({ color: 0x990000, emissive: 0x440000, emissiveIntensity: 0.5 });
    const tsL = new THREE.Mesh(tsGeo, tsMat);
    tsL.position.set(-2.46, 0.56, 0.55);
    carGroup.add(tsL);
    tailLightEmissive.push(tsL);

    const tsR = new THREE.Mesh(tsGeo, tsMat.clone());
    tsR.position.set(-2.46, 0.56, -0.55);
    carGroup.add(tsR);
    tailLightEmissive.push(tsR);

    // ── Front grille ──
    const grilleGeo = new THREE.BoxGeometry(0.05, 0.22, 1.2);
    const grille = new THREE.Mesh(grilleGeo, darkMat);
    grille.position.set(2.44, 0.38, 0);
    carGroup.add(grille);

    // Grille chrome accent
    const gAccGeo = new THREE.BoxGeometry(0.02, 0.02, 1.24);
    const gAcc = new THREE.Mesh(gAccGeo, chromeMat);
    gAcc.position.set(2.46, 0.49, 0);
    carGroup.add(gAcc);

    // ── Splitter ──
    const splitGeo = new THREE.BoxGeometry(0.35, 0.025, 1.90);
    const splitter = new THREE.Mesh(splitGeo, darkMat);
    splitter.position.set(2.30, 0.18, 0);
    carGroup.add(splitter);

    // ── Rear diffuser ──
    const diffGeo = new THREE.BoxGeometry(0.30, 0.025, 1.70);
    const diffuser = new THREE.Mesh(diffGeo, darkMat);
    diffuser.position.set(-2.30, 0.18, 0);
    carGroup.add(diffuser);

    // Exhaust pipes
    const exhGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.12, 16);
    const exhMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.15 });
    [[-2.44, 0.22, 0.35], [-2.44, 0.22, 0.18], [-2.44, 0.22, -0.18], [-2.44, 0.22, -0.35]].forEach(p => {
        const exh = new THREE.Mesh(exhGeo, exhMat);
        exh.position.set(...p);
        exh.rotation.z = Math.PI / 2;
        carGroup.add(exh);
    });

    // ── Side mirrors ──
    const mirGeo = new THREE.BoxGeometry(0.15, 0.08, 0.10);
    const mirL = new THREE.Mesh(mirGeo, paintMat);
    mirL.position.set(0.55, 0.88, 0.90);
    carGroup.add(mirL);
    paintMeshes.push(mirL);

    const mirR = new THREE.Mesh(mirGeo, paintMat);
    mirR.position.set(0.55, 0.88, -0.90);
    carGroup.add(mirR);
    paintMeshes.push(mirR);

    // ── Side skirts ──
    const skirtGeo = new THREE.BoxGeometry(3.0, 0.04, 0.06);
    const skirtL = new THREE.Mesh(skirtGeo, darkMat);
    skirtL.position.set(0, 0.19, 0.93);
    carGroup.add(skirtL);

    const skirtR = new THREE.Mesh(skirtGeo, darkMat);
    skirtR.position.set(0, 0.19, -0.93);
    carGroup.add(skirtR);

    // ── Roof line accent ──
    const roofAccGeo = new THREE.BoxGeometry(1.5, 0.012, 0.02);
    const roofAcc = new THREE.Mesh(roofAccGeo, chromeMat);
    roofAcc.position.set(-0.05, 1.375, 0);
    carGroup.add(roofAcc);

    // ── Interior (simplified) ──
    const intFloorGeo = new THREE.BoxGeometry(1.5, 0.02, 1.30);
    const intFloor = new THREE.Mesh(intFloorGeo, interiorMat);
    intFloor.position.set(-0.15, 0.79, 0);
    carGroup.add(intFloor);

    // Dashboard
    const dashGeo = new THREE.BoxGeometry(0.20, 0.28, 1.30);
    const dash = new THREE.Mesh(dashGeo, interiorMat);
    dash.position.set(0.60, 0.93, 0);
    carGroup.add(dash);

    // Dashboard screen
    const screenGeo = new THREE.PlaneGeometry(0.35, 0.12);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x0044aa, transparent: true, opacity: 0.7 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0.51, 1.00, 0.15);
    screen.rotation.y = Math.PI / 2 + 0.1;
    carGroup.add(screen);

    // Steering wheel
    const steerGeo = new THREE.TorusGeometry(0.12, 0.015, 8, 24);
    const steer = new THREE.Mesh(steerGeo, darkMat);
    steer.position.set(0.38, 0.98, 0.35);
    steer.rotation.y = Math.PI / 2;
    steer.rotation.x = Math.PI * 0.08;
    carGroup.add(steer);

    // Seats
    const seatGeo = new THREE.BoxGeometry(0.45, 0.45, 0.42);
    const seatMatL = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.85, metalness: 0.05 });
    const seatL = new THREE.Mesh(seatGeo, seatMatL);
    seatL.position.set(-0.05, 0.98, 0.35);
    carGroup.add(seatL);

    const seatR = new THREE.Mesh(seatGeo, seatMatL.clone());
    seatR.position.set(-0.05, 0.98, -0.35);
    carGroup.add(seatR);

    // ── Wheels ──
    const wheelPositions = [
        [1.50, 0.33, 1.00],   // FL
        [1.50, 0.33, -1.00],  // FR
        [-1.45, 0.33, 1.00],  // RL
        [-1.45, 0.33, -1.00], // RR
    ];
    wheelPositions.forEach(wp => {
        const wheelGroup = createWheel(tireMat, chromeMat, darkMat);
        wheelGroup.position.set(...wp);
        if (wp[2] < 0) wheelGroup.rotation.y = Math.PI;
        carGroup.add(wheelGroup);
    });

    // ── Wheel arches (dark covers) ──
    const archGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 24, 1, false, 0, Math.PI);
    wheelPositions.forEach(wp => {
        const arch = new THREE.Mesh(archGeo, darkMat);
        arch.position.set(wp[0], wp[1] + 0.08, wp[2] > 0 ? 0.90 : -0.90);
        arch.rotation.x = wp[2] > 0 ? -Math.PI / 2 : Math.PI / 2;
        arch.rotation.z = Math.PI / 2;
        carGroup.add(arch);
    });

    carGroup.position.y = 0;
    scene.add(carGroup);
}

function createWheel(tireMat, chromeMat, darkMat) {
    const g = new THREE.Group();

    // Tire
    const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.33, 0.12, 12, 32),
        tireMat
    );
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    g.add(tire);

    // Rim (outer)
    const rimOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.16, 32),
        chromeMat
    );
    rimOuter.rotation.x = Math.PI / 2;
    g.add(rimOuter);

    // Rim face
    const rimFace = new THREE.Mesh(
        new THREE.CircleGeometry(0.27, 32),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.12 })
    );
    rimFace.position.z = 0.081;
    g.add(rimFace);

    // Spokes
    const spokeGeo = new THREE.BoxGeometry(0.03, 0.22, 0.02);
    for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(spokeGeo, chromeMat);
        const angle = (i / 5) * Math.PI * 2;
        spoke.position.set(Math.sin(angle) * 0.11, Math.cos(angle) * 0.11, 0.082);
        spoke.rotation.z = -angle;
        g.add(spoke);
    }

    // Centre cap
    const capGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16);
    const cap = new THREE.Mesh(capGeo, darkMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.09;
    g.add(cap);

    // Brake disc (visible behind spokes)
    const discGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.02, 32);
    const discMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.3 });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = 0.04;
    g.add(disc);

    // Brake caliper
    const calGeo = new THREE.BoxGeometry(0.06, 0.08, 0.04);
    const calMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, metalness: 0.3, roughness: 0.5 });
    const cal = new THREE.Mesh(calGeo, calMat);
    cal.position.set(0, 0.16, 0.06);
    g.add(cal);

    return g;
}

// ────────────────────────────────────────────────────────────
//  6 · ORBIT CONTROLS (for configurator section)
// ────────────────────────────────────────────────────────────
function setupOrbitControls() {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.target.set(0, 0.6, 0);
    controls.enabled = false;
}

// ────────────────────────────────────────────────────────────
//  7 · SCROLL-DRIVEN CAMERA & TEXT SECTIONS
// ────────────────────────────────────────────────────────────
function setupScroll() {
    gsap.registerPlugin(ScrollTrigger);

    const sections = document.querySelectorAll('.scroll-section');

    sections.forEach((sec, i) => {
        ScrollTrigger.create({
            trigger: sec,
            start: 'top center',
            end: 'bottom center',
            onEnter: () => activateSection(i),
            onEnterBack: () => activateSection(i),
        });

        // Text reveal
        const content = sec.querySelector('.section-content');
        if (content) {
            ScrollTrigger.create({
                trigger: sec,
                start: 'top 70%',
                end: 'bottom 30%',
                onEnter: () => content.classList.add('visible'),
                onLeave: () => content.classList.remove('visible'),
                onEnterBack: () => content.classList.add('visible'),
                onLeaveBack: () => content.classList.remove('visible'),
            });
        }
    });

    // Scroll progress bar
    ScrollTrigger.create({
        trigger: '#scroll-container',
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: self => {
            scrollProgress = self.progress;
            document.getElementById('scroll-progress-fill').style.width = (scrollProgress * 100) + '%';
        },
    });

    // Navbar scroll class
    ScrollTrigger.create({
        trigger: '#scroll-container',
        start: '80px top',
        onEnter: () => document.getElementById('navbar').classList.add('scrolled'),
        onLeaveBack: () => document.getElementById('navbar').classList.remove('scrolled'),
    });
}

function activateSection(index) {
    currentSection = index;
    const picker   = document.getElementById('color-picker');
    const lightCtl = document.getElementById('light-controls');

    // Show colour picker & light controls only in config + CTA sections
    if (index === 5 || index === 6) {
        picker.classList.add('visible');
        lightCtl.classList.add('visible');
    } else {
        picker.classList.remove('visible');
        lightCtl.classList.remove('visible');
    }

    // Orbit controls only active in config section
    if (index === 5) {
        controls.enabled = true;
        orbiting = true;
    } else {
        controls.enabled = false;
        orbiting = false;
    }

    // Update hotspot visibility
    updateHotspotVisibility(index);
}

// ────────────────────────────────────────────────────────────
//  8 · HOTSPOTS
// ────────────────────────────────────────────────────────────
let hotspotEls = [];

function createHotspots() {
    const container = document.getElementById('hotspot-container');
    CONFIG.hotspots.forEach((hs, i) => {
        const el = document.createElement('div');
        el.className = 'hotspot-marker';
        el.dataset.index = i;
        
        // Create inner card
        const card = document.createElement('div');
        card.className = 'hotspot-card';
        card.innerHTML = `<h4>${hs.title}</h4><p>${hs.desc}</p>`;
        el.appendChild(card);
        
        el.addEventListener('click', () => {
            // Toggle this hotspot, close others
            const isOpen = el.classList.contains('open');
            hotspotEls.forEach(h => h.classList.remove('open'));
            if (!isOpen) el.classList.add('open');
        });
        
        container.appendChild(el);
        hotspotEls.push(el);
    });
}

function updateHotspotVisibility(sectionIdx) {
    // Show hotspots only in sections 1–4
    const show = sectionIdx >= 1 && sectionIdx <= 4;
    hotspotEls.forEach(el => {
        if (show) el.classList.add('visible');
        else { 
            el.classList.remove('visible'); 
            el.classList.remove('open'); 
        }
    });
}

function projectHotspots() {
    if (!camera || !renderer) return;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;

    hotspotEls.forEach((el, i) => {
        const hs = CONFIG.hotspots[i];
        tmpVec.set(...hs.pos);
        if (carGroup) tmpVec.applyMatrix4(carGroup.matrixWorld);
        tmpVec.project(camera);
        const x = (tmpVec.x *  0.5 + 0.5) * w;
        const y = (tmpVec.y * -0.5 + 0.5) * h;
        // Hide if behind camera
        if (tmpVec.z > 1) {
            el.style.display = 'none';
        } else {
            el.style.display = 'block';
            el.style.left = x + 'px';
            el.style.top  = y + 'px';
        }
    });
}

// ────────────────────────────────────────────────────────────
//  9 · COLOUR CONFIGURATOR
// ────────────────────────────────────────────────────────────
function setupColourPicker() {
    const swatches = document.querySelectorAll('.colour-swatch');
    const nameEl = document.getElementById('colour-name');

    swatches.forEach(sw => {
        sw.addEventListener('click', () => {
            swatches.forEach(s => s.classList.remove('active'));
            sw.classList.add('active');
            nameEl.textContent = sw.dataset.name;
            const target = new THREE.Color(sw.dataset.color);
            animatePaintColour(target);
        });
    });
}

function animatePaintColour(targetColor) {
    if (!paintMaterials.length && !paintMeshes.length) return;
    const startColor = (paintMaterials[0] || paintMeshes[0].material).color.clone();
    const dur = { t: 0 };
    gsap.to(dur, {
        t: 1,
        duration: 0.9,
        ease: 'power2.inOut',
        onUpdate: () => {
            const c = startColor.clone().lerp(targetColor, dur.t);
            paintMaterials.forEach(mat => { mat.color.copy(c); });
            paintMeshes.forEach(m => { if (m.material) m.material.color.copy(c); });
        },
    });
}

// ────────────────────────────────────────────────────────────
// 10 · HEADLIGHT & AMBIENT CONTROLS
// ────────────────────────────────────────────────────────────
function setupLightControls() {
    const hlBtn = document.getElementById('headlight-toggle');
    const amBtn = document.getElementById('ambient-toggle');

    hlBtn.addEventListener('click', () => {
        headlightsOn = !headlightsOn;
        hlBtn.classList.toggle('active', headlightsOn);
        const targetI = headlightsOn ? 60 : 0;
        gsap.to(headlightL, { intensity: targetI, duration: 0.6 });
        gsap.to(headlightR, { intensity: targetI, duration: 0.6 });

        // Front headlights: white emissive glow
        const frontTarget = headlightsOn ? 4.0 : 0.15;
        frontLightMaterials.forEach(mat => {
            gsap.to(mat, { emissiveIntensity: frontTarget, duration: 0.5 });
        });

        // Rear taillights: red emissive glow
        const rearTarget = headlightsOn ? 3.0 : 0.3;
        rearLightMaterials.forEach(mat => {
            gsap.to(mat, { emissiveIntensity: rearTarget, duration: 0.5 });
        });

        // Fallback procedural car toggles
        if (carGroup) {
            carGroup.traverse(child => {
                if (child.userData.headlight) {
                    gsap.to(child.material, { emissiveIntensity: headlightsOn ? 2 : 0, duration: 0.5 });
                    child.material.emissive = new THREE.Color(headlightsOn ? 0xfff8e0 : 0x000000);
                }
                if (child.userData.headlightLens) {
                    child.material.opacity = headlightsOn ? 1.0 : 0.3;
                }
            });
        }
        tailLightEmissive.forEach(m => {
            if (m.material) gsap.to(m.material, { emissiveIntensity: headlightsOn ? 1.5 : 0.3, duration: 0.6 });
        });
    });

    amBtn.addEventListener('click', () => {
        ambientMode = !ambientMode;
        amBtn.classList.toggle('active', ambientMode);
        gsap.to(renderer, {
            toneMappingExposure: ambientMode ? 0.72 : 1.1,
            duration: 0.9,
            ease: 'power2.inOut',
        });

        // Dim all environment lights together for a coherent night-drive
        // mood, while leaving the independent headlight toggle untouched.
        scene.traverse(child => {
            if (child.isLight && child.intensity !== undefined && !child.userData.excludeAmbientControl) {
                if (child.userData.baseIntensity === undefined) {
                    child.userData.baseIntensity = child.intensity;
                }
                const targetIntensity = child.userData.baseIntensity * (ambientMode ? 0.46 : 1.0);
                gsap.to(child, { intensity: targetIntensity, duration: 0.9, ease: 'power2.inOut' });
            }
        });

        const nightMix = ambientMode ? 1 : 0;
        if (skyDomeMat?.uniforms.uNightMix) {
            gsap.to(skyDomeMat.uniforms.uNightMix, { value: nightMix, duration: 0.9 });
        }
        if (starField?.material.uniforms.uNightMix) {
            gsap.to(starField.material.uniforms.uNightMix, { value: nightMix, duration: 0.9 });
        }
        if (fogPlaneMat?.uniforms.uNightMix) {
            gsap.to(fogPlaneMat.uniforms.uNightMix, { value: nightMix, duration: 0.9 });
        }
    });
}

// ────────────────────────────────────────────────────────────
// 11 · MOUSE PARALLAX
// ────────────────────────────────────────────────────────────
function setupMouse() {
    window.addEventListener('mousemove', e => {
        mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });
}

// ────────────────────────────────────────────────────────────
// 12 · RESPONSIVE
// ────────────────────────────────────────────────────────────
function setupResize() {
    const onResize = () => {
        if (!renderer || !camera) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
}

// ────────────────────────────────────────────────────────────
// 13 · PERFORMANCE DETECTION
// ────────────────────────────────────────────────────────────
function detectPerformance() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (gl) {
        const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbgInfo) {
            const gpuStr = gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
            if (gpuStr.includes('intel') && !gpuStr.includes('iris')) isLowPerf = true;
            if (gpuStr.includes('mali') || gpuStr.includes('adreno 5')) isLowPerf = true;
        }
    }
    // Mobile heuristic
    if (window.innerWidth < 768) isLowPerf = true;
}

// ────────────────────────────────────────────────────────────
// 14 · ANIMATION LOOP
// ────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    // ── Camera interpolation (skip if orbiting) ──
    if (!orbiting && CONFIG.cameraPositions[currentSection]) {
        const cp = CONFIG.cameraPositions[currentSection];
        const targetPos = new THREE.Vector3(...cp.pos);
        const targetTgt = new THREE.Vector3(...cp.target);

        lerpCamPos.lerp(targetPos, 3.5 * dt);
        lerpCamTgt.lerp(targetTgt, 3.5 * dt);
        lerpFov += (cp.fov - lerpFov) * 3.0 * dt;

        // Apply mouse parallax
        const px = mouseX * 0.25;
        const py = mouseY * 0.15;

        camera.position.set(
            lerpCamPos.x + px,
            lerpCamPos.y - py,
            lerpCamPos.z
        );
        camera.fov = lerpFov;
        camera.updateProjectionMatrix();
        camera.lookAt(lerpCamTgt);
    }

    if (orbiting && controls.enabled) {
        controls.update();
    }

    // ── Project hotspots ──
    projectHotspots();

    // ── Subtle car idle motion ──
    if (carGroup) {
        carGroup.rotation.y = Math.sin(t * 0.15) * 0.01;
    }

    // ── Alpine Background Dynamic Updates ──

    // Sky dome: animate cloud drift and horizon glow pulsation
    if (skyDomeMat) {
        skyDomeMat.uniforms.uTime.value = t;
    }

    // Starfield: animate twinkling
    if (starField) {
        starField.material.uniforms.uTime.value = t;
        // Very slow celestial rotation
        starField.rotation.y = t * 0.002;
    }

    // Valley fog: animate rolling billow
    if (fogPlaneMat) {
        fogPlaneMat.uniforms.uTime.value = t;
    }

    // Atmospheric particles: drift with wind and wrap around bounds
    if (atmosphericParticles && atmosphericParticlePositions) {
        const positions = atmosphericParticlePositions;
        const velocities = atmosphericParticleVelocities;
        const count = positions.length / 3;
        const bounds = 12;

        for (let i = 0; i < count; i++) {
            positions[i * 3]     += velocities[i * 3]     * dt;
            positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
            positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;

            // Wrap around bounding volume
            if (positions[i * 3] > bounds) positions[i * 3] = -bounds;
            if (positions[i * 3] < -bounds) positions[i * 3] = bounds;
            if (positions[i * 3 + 1] > 4.5) positions[i * 3 + 1] = 0.2;
            if (positions[i * 3 + 1] < 0.1) positions[i * 3 + 1] = 4.0;
            if (positions[i * 3 + 2] > bounds) positions[i * 3 + 2] = -bounds;
            if (positions[i * 3 + 2] < -bounds) positions[i * 3 + 2] = bounds;
        }
        atmosphericParticles.geometry.attributes.position.needsUpdate = true;
        atmosphericParticles.material.uniforms.uTime.value = t;
        atmosphericParticles.material.uniforms.uHeadlightsOn.value = headlightsOn ? 1.0 : 0.0;
    }

    // Mountain parallax: shift mountain layers based on mouse/camera offset
    if (mountainGroups.length > 0) {
        const parallaxX = mouseX * 0.003;
        mountainGroups.forEach(mg => {
            mg.mesh.rotation.y = mg.baseRotY + parallaxX * mg.depth;
        });
    }

    renderer.render(scene, camera);
}

// ────────────────────────────────────────────────────────────
// 15 · LOADING & INIT
// ────────────────────────────────────────────────────────────
async function init() {
    detectPerformance();

    if (!initRenderer()) return;

    createEnvMap();
    setupLighting();
    createFloor();
    setupOrbitControls();
    setupScroll();
    setupColourPicker();
    setupLightControls();
    setupMouse();
    setupResize();

    // Load the 3D model (Ferrari Purosangue) with real loading progress
    await loadCarModel();
    createHotspots();

    // Dismiss loader screen and activate hero section
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('hidden');
    const heroContent = document.querySelector('#hero-section .section-content');
    if (heroContent) heroContent.classList.add('visible');

    animate();
}

init();
