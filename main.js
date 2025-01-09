import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import CannonDebugger from 'cannon-es-debugger';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Membuat scene dan renderer
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Inisialisasi dunia Cannon.js
const world = new CANNON.World();
world.gravity.set(0, -9.82 * 5, 0);

// Kamera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 10);

// HDRI
const rgbeLoader = new RGBELoader();
rgbeLoader.load('aset/world.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
});

// OrbitControls untuk navigasi
// const controls = new OrbitControls(camera, renderer.domElement);
// controls.update();

const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load('music/music.mp3', (buffer) => {
    sound.setBuffer(buffer);
    sound.setLoop(true); // Atur true untuk pengulangan
    sound.setVolume(0.5); // Atur volume (0.0 hingga 1.0)
    sound.play(); // Putar musik
});

// Memuat peta (map) dengan collider
const gltfLoader = new GLTFLoader();
gltfLoader.load('aset/Map.glb', (gltf) => {
    const mapMesh = gltf.scene;
    scene.add(mapMesh);

    mapMesh.traverse((child) => {
        if (child.isMesh && child.geometry.attributes.position) {
            // Dapatkan ukuran bounding box dari geometry
            child.geometry.computeBoundingBox();
            const boundingBox = child.geometry.boundingBox;

            // Hitung ukuran box collider berdasarkan bounding box
            const width = boundingBox.max.x - boundingBox.min.x;
            const height = boundingBox.max.y - boundingBox.min.y;
            const depth = boundingBox.max.z - boundingBox.min.z;

            // Buat collider box
            const boxShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));

            // Buat body fisika dengan posisi dan rotasi sesuai mesh
            const body = new CANNON.Body({ mass: 0 });
            body.addShape(boxShape);
            body.position.copy(child.position);
            body.quaternion.copy(child.quaternion);
            world.addBody(body);
        }
    });
});

// Memuat Rumah
gltfLoader.load('aset/rumah.glb', (gltf) => {
    const rumahMesh = gltf.scene;
    scene.add(rumahMesh);

    rumahMesh.traverse((child) => {
        if (child.isMesh && child.geometry.attributes.position) {
            const vertices = Array.from(child.geometry.attributes.position.array);
            const indices = child.geometry.index ? Array.from(child.geometry.index.array) : Object.keys(vertices).map(Number);
            const shape = new CANNON.Trimesh(vertices, indices);

            const body = new CANNON.Body({ mass: 0, shape });
            body.position.copy(child.position);
            body.quaternion.copy(child.quaternion);
            world.addBody(body);
        }
    });
});

// Memuat Hiasan
gltfLoader.load('aset/hiasan.glb', (gltf) => {
    const objects = gltf.scene;
    scene.add(objects);

    objects.traverse((child) => {
        if (child.isMesh) {
            // Pastikan geometri valid
            if (!child.geometry) {
                console.warn('Mesh tanpa geometri:', child.name);
                return;
            }

            // Hitung bounding sphere untuk setiap mesh
            child.geometry.computeBoundingSphere();
            const boundingSphere = child.geometry.boundingSphere;

            // Pastikan boundingSphere valid
            if (!boundingSphere) {
                console.warn('Bounding sphere tidak dapat dihitung untuk:', child.name);
                return;
            }

            // Ambil radius bounding sphere dan sesuaikan menjadi setengah
            const radius = boundingSphere.radius / 2;

            // Ambil posisi dunia objek
            const worldPosition = new THREE.Vector3();
            child.getWorldPosition(worldPosition);

            // Buat body fisika untuk collider sphere tanpa memengaruhi posisi mesh
            const body = new CANNON.Body({
                mass: 0, // Massa 0 untuk objek statis
                shape: new CANNON.Sphere(radius),
            });
            body.position.set(worldPosition.x, worldPosition.y, worldPosition.z);

            // Tambahkan body ke dunia fisika
            world.addBody(body);

            // Simpan referensi antara mesh dan body untuk sinkronisasi
            //child.userData.physicsBody = body;

            //console.log(`Collider ditambahkan untuk: ${child.name}, Radius: ${radius}`);
        }
    });
});

// Memuat Gunung
gltfLoader.load('aset/gunung.glb', (gltf) => {
    const objects = gltf.scene;
    scene.add(objects);

    objects.traverse((child) => {
        if (child.isMesh) {
            // Pastikan geometri valid
            if (!child.geometry) {
                console.warn('Mesh tanpa geometri:', child.name);
                return;
            }

            // Hitung bounding box untuk setiap mesh
            child.geometry.computeBoundingBox();
            const boundingBox = child.geometry.boundingBox;

            // Pastikan boundingBox valid
            if (!boundingBox) {
                console.warn('Bounding box tidak dapat dihitung untuk:', child.name);
                return;
            }

            // Hitung ukuran bounding box
            const size = new THREE.Vector3();
            boundingBox.getSize(size);

            // Ambil posisi dunia objek
            const worldPosition = new THREE.Vector3();
            child.getWorldPosition(worldPosition);

            // Buat shape kotak (ukuran setengah untuk Cannon.js)
            const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
            const shape = new CANNON.Box(halfExtents);

            // Buat body fisika untuk collider kotak
            const body = new CANNON.Body({
                mass: 0, // Massa 0 untuk objek statis
                shape: shape,
            });
            body.position.set(worldPosition.x, worldPosition.y, worldPosition.z);

            // Tambahkan body ke dunia fisika
            world.addBody(body);

            //console.log(`Collider kotak ditambahkan untuk: ${child.name}`);
        }
    });
});

let playerMesh, playerBody;
// Memuat pemain (player) dengan collider
gltfLoader.load('aset/Player.glb', (gltf) => {
    playerMesh = gltf.scene;
    scene.add(playerMesh);

    // Ukuran kapsul
    const playerHeight = 4; // tinggi kapsul
    const playerWidth = 2;  // lebar kapsul
    const radius = playerWidth / 2; // radius sphere

    // Posisi pusat player
    const centerY = playerHeight / 2;

    // Membuat body fisika player
    playerBody = new CANNON.Body({
        mass: 1, // Massa player
        position: new CANNON.Vec3(0, centerY, 0), // Posisi player di dunia fisika
        angularFactor: new CANNON.Vec3(0, 0, 0), // Hanya rotasi pada sumbu Y yang diizinkan
    });

    // Collider sphere untuk player yang merapat ke bawah
    // Posisikan collider lebih dekat ke bawah (dengan menggeser posisi pada sumbu Y)
    const colliderOffsetBottom = -(centerY - radius); // Geser collider ke bawah
    const playerColliderBottom = new CANNON.Sphere(radius);
    playerBody.addShape(playerColliderBottom, new CANNON.Vec3(0, colliderOffsetBottom, 0)); // Menambahkan collider di posisi baru

    const playerColliderCylinder = new CANNON.Cylinder(radius, radius, playerHeight - 2 * radius, 16);
    const quaternion = new CANNON.Quaternion();
    quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 0), Math.PI / 2); // Rotasi 90 derajat pada sumbu X
    playerBody.addShape(playerColliderCylinder, new CANNON.Vec3(0, 0, 0), quaternion);

    const colliderOffsetTop = (centerY - radius); // Geser collider ke bawah
    const playerColliderTop = new CANNON.Sphere(radius);
    playerBody.addShape(playerColliderTop, new CANNON.Vec3(0, colliderOffsetTop, 0)); // Menambahkan collider di posisi baru

    playerBody.position.set(0, 7, 0);
    // Menambahkan playerBody ke dunia fisika
    world.addBody(playerBody);
});

const controls = new PointerLockControls(camera, document.body);
document.body.addEventListener('click', () => {
  controls.lock();
});

// Variabel global untuk raycaster
const raycaster = new THREE.Raycaster();
const downDirection = new THREE.Vector3(0, -1, 0); // Arah raycaster ke bawah

const keysPressed = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
};

// Kecepatan gerak
let moveSpeed = 1;
let jumpHeight = 1;

function updateSpeed(value) {
	moveSpeed = Number(value) * 100;
	document.getElementById("speedValue").textContent = value;
}

function updateJump(value) {
	jumpHeight = Number(value) * 10;
	document.getElementById("jumpValue").textContent = value;
}

const moveDirection = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const rightDirection = new THREE.Vector3();

// Event listeners untuk keyboard
window.addEventListener('keydown', (event) => {
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            keysPressed.forward = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            keysPressed.backward = true;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            keysPressed.left = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keysPressed.right = true;
            break;
        case 'Space':
            keysPressed.jump = true;
            break;
    }
});

window.addEventListener('keyup', (event) => {
    switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
            keysPressed.forward = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            keysPressed.backward = false;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            keysPressed.left = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            keysPressed.right = false;
            break;
        case 'Space':
            keysPressed.jump = false;
            break;
    }
});

let isOnGround = false;

function checkIfOnGround() {
    if (!playerMesh) return;

    // Set raycaster dari posisi pemain
    raycaster.set(playerMesh.position, downDirection);

    // Tentukan objek yang akan diuji (misalnya semua objek di scene)
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const distance = intersects[0].distance;

        //console.log(distance);
        
        // Jika jarak ke permukaan lebih kecil dari toleransi tertentu, pemain dianggap di tanah
        isOnGround = distance <= 2.1; // Toleransi jarak 1.1 unit
    } else {
        
        isOnGround = false;
    }
}

// Fungsi untuk memperbarui gerakan pemain
function updatePlayerMovement(deltaTime) {
    if (!playerBody) return;

    // Ambil arah kamera
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Abaikan gerakan vertikal
    cameraDirection.normalize();

    // Hitung arah kanan berdasarkan kamera
    rightDirection.crossVectors(camera.up, cameraDirection).normalize();

    // Reset moveDirection
    moveDirection.set(0, 0, 0);

    // Perbarui arah gerak berdasarkan input
    if (keysPressed.forward) moveDirection.add(cameraDirection);
    if (keysPressed.backward) moveDirection.sub(cameraDirection);
    if (keysPressed.left) moveDirection.add(rightDirection);
    if (keysPressed.right) moveDirection.sub(rightDirection);

    // Terapkan kecepatan gerakan
    if (moveDirection.length() > 0) {
        moveDirection.normalize().multiplyScalar(moveSpeed * deltaTime);
        playerBody.velocity.x = moveDirection.x;
        playerBody.velocity.z = moveDirection.z;

        // Rotasi pemain sesuai arah gerak
        const angle = Math.atan2(moveDirection.x, moveDirection.z);
        playerBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
    }

    // Periksa apakah pemain berada di tanah
    checkIfOnGround();

    // Tangani lompatan
    if (keysPressed.jump && isOnGround) {
        playerBody.velocity.y = jumpHeight; // Memberikan kecepatan vertikal untuk lompat
    }

    // Sinkronisasi posisi dan rotasi antara Three.js dan Cannon.js
    if (playerMesh && playerBody) {
        playerMesh.position.copy(playerBody.position);
        playerMesh.quaternion.copy(playerBody.quaternion);

        camera.position.set(
            playerBody.position.x,
            playerBody.position.y + 1.5,
            playerBody.position.z
        );
    }
}

const cannonDebugger = new CannonDebugger(scene, world, {color: 0xff0000});
const clock = new THREE.Clock();


// Fungsi animasi
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta(); // Waktu antara frame (dalam detik)
    
    //cannonDebugger.update();
    world.step(1 /60);
    updatePlayerMovement(deltaTime);

    updateSpeed(document.getElementById("speed").value);
    updateJump(document.getElementById("jump").value);

    renderer.render(scene, camera);
}

// Menjalankan animasi
animate();
