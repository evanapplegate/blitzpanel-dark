import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

class AssemblyAnimation {
    constructor() {
        this.scene = new THREE.Scene();

        // Setup Orthographic Camera
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 1000; // Initial size, will be adjusted by frameModel
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            10000
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.components = [];
        this.componentGroups = [];
        this.originalPositions = new Map();
        this.originalRotations = new Map();
        this.originalScales = new Map();
        this.scatteredPositions = new Map();
        this.scatteredRotations = new Map();
        this.scatteredScales = new Map();
        this.modelBounds = new THREE.Box3();

        this.init();
    }

    init() {
        // Setup renderer
        const container = document.getElementById('animation-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Lower pixel ratio for performance
        this.renderer.shadowMap.enabled = true; // Enable shadows
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x111111, 1); // Dark background
        this.renderer.sortObjects = false; // Disable sorting for performance
        container.appendChild(this.renderer.domElement);

        // Setup camera
        // Use actual container aspect ratio to prevent squishing
        const aspect = width / height;
        const frustumSize = 40; // Initial size, will be adjusted by frameModel

        // Update camera with correct aspect
        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();

        this.camera.position.set(100, 100, 100);
        this.camera.lookAt(0, 0, 0);

        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = false; // Disable zoom for scroll animation
        this.controls.enablePan = false;  // Disable pan
        this.controls.enableRotate = false; // Fix view at isometric
        this.controls.autoRotateSpeed = 1.0; // Slow spin (25% of 4.0)

        // Minimal lighting for wireframe style
        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        this.scene.add(ambientLight);

        // No directional light or shadows for flat hidden-line look

        // No grid for clean wireframe look

        // No post-processing for clean wireframe

        // Load model
        this.loadModel();

        // Setup UI
        this.setupUI();

        // Handle resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Animation loop
        this.animate();
    }


    async loadModel() {
        const loader = new GLTFLoader();

        // Load standard GLB
        loader.load(
            './enclosure4.glb',
            (gltf) => {
                this.processModel(gltf.scene);
            },
            (progress) => {
                const percent = (progress.loaded / progress.total) * 100;
                document.getElementById('loading').textContent = `Loading: ${percent.toFixed(0)}%`;
            },
            (error) => {
                console.error('Error loading GLTF:', error);
                document.getElementById('loading').textContent = 'Error loading model. Check console.';
            }
        );
    }

    async loadStepFile() {
        // STEP file loading requires conversion
        // We'll create a system that can work with converted files
        // For production, convert STEP to GLTF/GLB offline or via API

        try {
            const response = await fetch('./Montagem_final.STEP');
            const stepText = await response.text();

            // Note: Browser-side STEP parsing is complex
            // Recommend converting to GLTF/GLB first using:
            // - FreeCAD (export as GLTF)
            // - CAD Exchanger Cloud API
            // - OpenCASCADE.js (browser-based, but large)

            console.log('STEP file loaded, but needs conversion to GLTF/GLB');
            document.getElementById('loading').textContent =
                'STEP file detected. Please convert to GLTF/GLB format first.';

            // Create placeholder geometry for demonstration
            this.createPlaceholderComponents();
        } catch (error) {
            console.error('Error loading STEP file:', error);
            document.getElementById('loading').textContent = 'Error loading file';
        }
    }

    createPlaceholderComponents() {
        // Create multiple components as placeholders
        // Replace this with actual model loading once converted
        const componentCount = 8;
        const colors = [
            0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xffa07a,
            0x98d8c8, 0xf7dc6f, 0xbb8fce, 0x85c1e2
        ];

        for (let i = 0; i < componentCount; i++) {
            const geometry = new THREE.BoxGeometry(
                10 + Math.random() * 10,
                10 + Math.random() * 10,
                10 + Math.random() * 10
            );
            const material = new THREE.MeshStandardMaterial({
                color: colors[i % colors.length],
                metalness: 0.7,
                roughness: 0.3
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Position components scattered around
            const angle = (i / componentCount) * Math.PI * 2;
            const radius = 50 + Math.random() * 30;
            mesh.position.set(
                Math.cos(angle) * radius,
                (Math.random() - 0.5) * 40,
                Math.sin(angle) * radius
            );

            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            this.scene.add(mesh);
            this.components.push(mesh);
            this.originalPositions.set(mesh, mesh.position.clone());
            this.originalRotations.set(mesh, mesh.rotation.clone());
            this.originalScales.set(mesh, mesh.scale.clone());
        }

        document.getElementById('loading').style.display = 'none';
        document.getElementById('controls').style.display = 'block';
    }

    processModel(model) {
        // Calculate model bounds BEFORE processing
        this.modelBounds.makeEmpty(); // Will be calculated after filtering

        // Smart component detection - Treat every mesh as a separate component
        // This ensures parts like enclosure and rails are separated
        const MAX_COMPONENTS = 500; // Increased limit
        const componentMap = new Map();

        model.traverse((child) => {
            if (componentMap.size >= MAX_COMPONENTS) return;

            if (child.isMesh) {
                // Treat every mesh as a unique component
                componentMap.set(child, [child]);
            }
        });

        console.log(`Processing ${componentMap.size} components (limited from larger set)`);

        // Recalculate model bounds based on all components
        this.modelBounds.makeEmpty();
        componentMap.forEach((meshes, node) => {
            const box = new THREE.Box3();
            meshes.forEach(mesh => {
                mesh.updateWorldMatrix(true, false);
                if (mesh.geometry.boundingBox === null) mesh.geometry.computeBoundingBox();
                const meshBox = mesh.geometry.boundingBox.clone();
                meshBox.applyMatrix4(mesh.matrixWorld);
                box.union(meshBox);
            });
            this.modelBounds.union(box);
        });
        const center = this.modelBounds.getCenter(new THREE.Vector3());
        const size = this.modelBounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        const minComponentSize = maxDimension * 0.02; // Filter out objects smaller than 2% of model

        // Create component groups with solid materials
        componentMap.forEach((meshes, node) => {
            // Calculate component size first
            const componentBox = new THREE.Box3();
            meshes.forEach(mesh => {
                if (mesh.geometry.boundingBox === null) mesh.geometry.computeBoundingBox();
                const meshBox = mesh.geometry.boundingBox.clone();
                meshBox.applyMatrix4(mesh.matrixWorld);
                componentBox.union(meshBox);
            });

            const componentSize = componentBox.min.distanceTo(componentBox.max);

            // Skip small components
            if (componentSize < minComponentSize) {
                return;
            }

            const group = new THREE.Group();
            const componentMeshes = [];

            meshes.forEach((mesh) => {
                // Simplify geometry if it's too complex
                let geometry = mesh.geometry;

                // Disable simplification for now to debug missing surfaces
                /*
                // If geometry has too many vertices, simplify it
                if (geometry.attributes.position && geometry.attributes.position.count > 5000) {
                    // Create simplified version (reduce to 30% for very large meshes)
                    geometry = this.simplifyGeometry(geometry, 0.3);
                } else if (geometry.attributes.position && geometry.attributes.position.count > 2000) {
                    // Moderate simplification for medium meshes
                    geometry = this.simplifyGeometry(geometry, 0.5);
                }
                */

                // 1. Create Occluder Mesh (Solid background color)
                // This blocks the view of lines behind it
                const occluderMaterial = new THREE.MeshBasicMaterial({
                    color: 0x111111, // Match dark background color
                    side: THREE.DoubleSide,
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                    polygonOffsetUnits: 1
                });
                const occluderMesh = new THREE.Mesh(geometry, occluderMaterial);
                // Since the group will be placed at the mesh's world position,
                // and this mesh IS the node, we keep this at identity
                occluderMesh.position.set(0, 0, 0);
                occluderMesh.rotation.set(0, 0, 0);
                occluderMesh.scale.set(1, 1, 1);
                group.add(occluderMesh);

                // 2. Create Wireframe Mesh (Visible edges only)
                // EdgesGeometry finds edges where the angle between faces exceeds the threshold
                // This visually "merges" coplanar polygons, removing diagonal triangulation lines
                const edgesGeometry = new THREE.EdgesGeometry(geometry, 15); // 15 degree threshold
                const wireframeMaterial = new THREE.LineBasicMaterial({
                    color: 0x464646
                });
                const wireframeMesh = new THREE.LineSegments(edgesGeometry, wireframeMaterial);
                wireframeMesh.position.set(0, 0, 0);
                wireframeMesh.rotation.set(0, 0, 0);
                wireframeMesh.scale.set(1, 1, 1);
                group.add(wireframeMesh);

                componentMeshes.push(wireframeMesh);
            });

            // Store original transform from the node (relative to model center)
            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            const worldScale = new THREE.Vector3();

            node.getWorldPosition(worldPos);
            node.getWorldQuaternion(worldQuat);
            node.getWorldScale(worldScale);

            // Convert quaternion to euler
            const worldRot = new THREE.Euler().setFromQuaternion(worldQuat);

            // Center positions relative to model center
            worldPos.sub(center);

            group.position.copy(worldPos);
            group.rotation.copy(worldRot);
            group.scale.copy(worldScale);

            // Store original transforms
            this.originalPositions.set(group, group.position.clone());
            this.originalRotations.set(group, group.rotation.clone());
            this.originalScales.set(group, group.scale.clone());

            this.scene.add(group);
            this.components.push(group);
            this.componentGroups.push({ group, meshes: componentMeshes });
        });

        // Remove original model from scene (we've cloned what we need)
        if (model.parent) {
            model.parent.remove(model);
        }

        // Update bounds to be centered at origin
        this.modelBounds.translate(center.clone().multiplyScalar(-1));

        // Sort components by size (Largest to Smallest)
        this.components.sort((a, b) => {
            const boxA = new THREE.Box3().setFromObject(a);
            const boxB = new THREE.Box3().setFromObject(b);

            // Use diagonal length as size metric
            const sizeA = boxA.min.distanceTo(boxA.max);
            const sizeB = boxB.min.distanceTo(boxB.max);

            return sizeB - sizeA; // Descending order
        });

        // Auto-frame camera
        this.frameModel();

        // Initial scatter
        this.scatterComponents('spiral');

        document.getElementById('loading').style.display = 'none';
        console.log(`Loaded ${this.components.length} components`);

        // Start auto-play animation
        this.startAnimation();
    }

    simplifyGeometry(geometry, ratio = 0.5) {
        // Simple decimation: take every Nth vertex
        const positions = geometry.attributes.position;
        if (!positions) return geometry;

        const vertexCount = positions.count;
        const targetCount = Math.max(100, Math.floor(vertexCount * ratio));
        const step = Math.max(1, Math.floor(vertexCount / targetCount));

        const newPositions = [];
        const newIndices = [];
        const indexMap = new Map();
        let newIndex = 0;

        // Sample vertices
        for (let i = 0; i < vertexCount; i += step) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            newPositions.push(x, y, z);
            indexMap.set(i, newIndex++);
        }

        // Rebuild indices if they exist
        if (geometry.index) {
            const indices = geometry.index.array;
            for (let i = 0; i < indices.length; i += 3) {
                const i0 = indices[i];
                const i1 = indices[i + 1];
                const i2 = indices[i + 2];

                if (indexMap.has(i0) && indexMap.has(i1) && indexMap.has(i2)) {
                    newIndices.push(
                        indexMap.get(i0),
                        indexMap.get(i1),
                        indexMap.get(i2)
                    );
                }
            }
        }

        // Create new geometry
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));

        if (newIndices.length > 0) {
            newGeometry.setIndex(newIndices);
        }

        return newGeometry;
    }

    frameModel() {
        if (this.modelBounds.isEmpty()) return;

        const center = this.modelBounds.getCenter(new THREE.Vector3());
        const size = this.modelBounds.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Center controls
        this.controls.target.copy(center);

        // Adjust camera position (isometric-ish angle)
        const distance = maxDim * 2; // Far enough back
        this.camera.position.set(
            center.x - distance, // Rotated 90 degrees (was +)
            center.y + distance,
            center.z + distance
        );
        this.camera.lookAt(center);

        // Adjust Orthographic Frustum/Zoom to fit object
        // Add some padding (1.5x), then make 2x larger by halving frustum
        const padding = 1.5;
        const frustumSize = (maxDim * padding) / 2; // Halved to make 2x larger
        const container = document.getElementById('animation-container');
        const aspect = container ? container.clientWidth / container.clientHeight : window.innerWidth / window.innerHeight;

        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;

        this.camera.zoom = 1; // Reset zoom
        this.camera.updateProjectionMatrix();

        this.controls.update();
    }


    scatterComponents(pattern = 'spiral') {
        const size = this.modelBounds.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scatterRadius = maxDim * 10; // Increased to ensure off-screen

        this.components.forEach((component, index) => {
            // Keep the largest component (index 0) in place
            if (index === 0) {
                this.scatteredPositions.set(component, this.originalPositions.get(component).clone());
                this.scatteredRotations.set(component, this.originalRotations.get(component).clone());
                this.scatteredScales.set(component, this.originalScales.get(component).clone());
                return;
            }

            const t = index / this.components.length;
            let x, y, z;

            switch (pattern) {
                case 'spiral':
                    const angle = t * Math.PI * 4;
                    const radius = scatterRadius * (0.3 + t * 0.7);
                    x = Math.cos(angle) * radius;
                    y = (t - 0.5) * scatterRadius * 1.5;
                    z = Math.sin(angle) * radius;
                    break;
                case 'sphere':
                    const phi = Math.acos(2 * t - 1);
                    const theta = Math.PI * 2 * index * 0.618; // Golden angle
                    x = scatterRadius * Math.sin(phi) * Math.cos(theta);
                    y = scatterRadius * Math.sin(phi) * Math.sin(theta);
                    z = scatterRadius * Math.cos(phi);
                    break;
                case 'explosion':
                default:
                    const dir = new THREE.Vector3(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        Math.random() - 0.5
                    ).normalize();
                    const dist = scatterRadius * (0.5 + Math.random() * 0.5);
                    x = dir.x * dist;
                    y = dir.y * dist;
                    z = dir.z * dist;
            }

            const scatterPos = new THREE.Vector3(x, y, z);
            const scatterRot = new THREE.Euler(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            const scatterScale = new THREE.Vector3(0.01, 0.01, 0.01);

            component.position.copy(scatterPos);
            component.rotation.copy(scatterRot);
            component.scale.copy(scatterScale);

            // Store scattered transforms
            this.scatteredPositions.set(component, scatterPos.clone());
            this.scatteredRotations.set(component, scatterRot.clone());
            this.scatteredScales.set(component, scatterScale.clone());
        });
    }

    updateAssemblyProgress(scrollProgress) {
        // scrollProgress: 0 to 1
        // Each component animates as we scroll through its "slot"
        const totalSlots = this.components.length;

        // Use full range for auto-play
        const effectiveProgress = scrollProgress;

        this.components.forEach((component, index) => {
            // Calculate when this component should start and finish animating
            const slotStart = index / totalSlots;
            const slotEnd = (index + 1) / totalSlots;

            // Component progress: 0 when scroll is before slot, 1 when after slot
            let componentProgress = 0;
            if (effectiveProgress >= slotEnd) {
                componentProgress = 1;
            } else if (effectiveProgress >= slotStart) {
                componentProgress = (effectiveProgress - slotStart) / (slotEnd - slotStart);
            }

            // Smooth easing
            const eased = componentProgress === 0 ? 0 :
                componentProgress === 1 ? 1 :
                    1 - Math.pow(2, -10 * componentProgress);

            // Get start and end positions
            const startPos = this.scatteredPositions.get(component) || new THREE.Vector3();
            const targetPos = this.originalPositions.get(component) || new THREE.Vector3();
            const startRot = this.scatteredRotations.get(component) || new THREE.Euler();
            const targetRot = this.originalRotations.get(component) || new THREE.Euler();
            const startScale = this.scatteredScales.get(component) || new THREE.Vector3(0.01, 0.01, 0.01);
            const targetScale = this.originalScales.get(component) || new THREE.Vector3(1, 1, 1);

            // Animate position
            component.position.lerpVectors(startPos, targetPos, eased);

            // Animate rotation
            const startQuat = new THREE.Quaternion().setFromEuler(startRot);
            const endQuat = new THREE.Quaternion().setFromEuler(targetRot);
            const currentQuat = new THREE.Quaternion().slerpQuaternions(startQuat, endQuat, eased);
            component.rotation.setFromQuaternion(currentQuat);

            // Animate scale
            component.scale.lerpVectors(startScale, targetScale, eased);
        });
    }

    reset() {
        this.components.forEach((component) => {
            const originalPos = this.originalPositions.get(component);
            const originalRot = this.originalRotations.get(component);
            const originalScale = this.originalScales.get(component);

            if (originalPos) component.position.copy(originalPos);
            if (originalRot) component.rotation.copy(originalRot);
            if (originalScale) component.scale.copy(originalScale);
        });
    }

    setupUI() {
        // No UI needed for auto-play
    }

    startAnimation() {
        this.isAnimating = true;
        this.startTime = performance.now();
        this.animationDuration = 4000; // 4 seconds
    }

    onWindowResize() {
        const container = document.getElementById('animation-container');
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;
        // Use actual container aspect ratio to prevent squishing
        const aspect = width / height;

        const frustumSize = (this.camera.top - this.camera.bottom) / this.camera.zoom; // Preserve current scale

        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;

        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Handle assembly animation
        if (this.isAnimating) {
            const elapsed = performance.now() - this.startTime;
            const progress = Math.min(elapsed / this.animationDuration, 1.0);

            // Use an ease-out curve for the whole assembly
            // 1 - (1-x)^3
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            this.updateAssemblyProgress(easedProgress);

            if (progress >= 1.0) {
                this.isAnimating = false;
                this.controls.autoRotate = true;
                this.controls.enableRotate = true; // Allow user interaction
            }
        }

        // Smoothly update controls if damping is enabled
        this.controls.update();

        this.renderer.render(this.scene, this.camera);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize
new AssemblyAnimation();

