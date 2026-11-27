
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// ================================================
// DRIVING SCHOOL UA — CITY SIMULATOR 0.2
// ================================================

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let scene, camera, renderer;
let carInterior;
let wheelVisual;
let trafficLights = [];
let trafficCars = [];
let roadObjects = [];

let started = false;
let transmission = 'manual';
let selectedCar = 'sedan';

const car = {
    x: 2.25,
    z: 35,
    yaw: 0,
    speed: 0,
    rpm: 850,
    gear: '1',
    autoGear: 'P',
    steering: 0,
    handbrake: true,
    belt: false,
    engineOn: true,
    stalled: false
};

const input = {
    gas: false,
    brake: false,
    clutch: false,
    left: false,
    right: false
};

const state = {
    leftSignal: false,
    rightSignal: false,
    hazard: false,
    lights: false,
    message: '',
    messageTimer: 0,
    distance: 0,
    violations: 0,
    lastIntersection: null,
    lastSpeedWarning: 0
};

const keys = {};

const clock = new THREE.Clock();

const ROAD_WIDTH = 18;
const GRID = 100;
const CITY_LIMIT = 250;

// ================================================
// МЕНЮ И ВЫБОР КОРОБКИ
// ================================================

document.querySelectorAll('.trans-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.trans-btn')
            .forEach(b => b.classList.remove('active'));

        button.classList.add('active');
        transmission = button.dataset.mode;
    });
});

$('startBtn').addEventListener('click', () => {
    selectedCar = $('carSelect').value;

    $('menu').classList.add('hidden');
    $('game').classList.remove('hidden');

    if (!started) {
        initialize();
        started = true;
    }

    resetCar();
    clock.start();
});

$('exitBtn').addEventListener('click', () => {
    $('game').classList.add('hidden');
    $('menu').classList.remove('hidden');

    car.speed = 0;
    car.handbrake = true;

    Object.keys(input).forEach(k => input[k] = false);
});

function resetCar() {
    car.x = 2.25;
    car.z = 35;
    car.yaw = 0;
    car.speed = 0;
    car.rpm = 850;
    car.steering = 0;
    car.handbrake = true;
    car.belt = false;
    car.stalled = false;
    car.engineOn = true;

    car.gear = '1';
    car.autoGear = 'P';

    state.distance = 0;
    state.violations = 0;
    state.lastIntersection = null;

    if (transmission === 'manual') {
        $('manualPanel').classList.remove('hidden');
        $('autoPanel').classList.add('hidden');
        $('clutchBtn').style.display = 'block';
        $('gearMode').textContent = 'МЕХАНИКА';
    } else {
        $('manualPanel').classList.add('hidden');
        $('autoPanel').classList.remove('hidden');
        $('clutchBtn').style.display = 'none';
        $('gearMode').textContent = 'АВТОМАТ';
    }

    updateGear();
    updateHUD();

    message('Пристегни ремень, сними ручник и начинай движение.');
}

// ================================================
// ИНИЦИАЛИЗАЦИЯ 3D
// ================================================

function initialize() {
    scene = new THREE.Scene();

    scene.background = new THREE.Color(0x91b6c9);
    scene.fog = new THREE.Fog(0x91b6c9, 100, 380);

    camera = new THREE.PerspectiveCamera(
        72,
        innerWidth / innerHeight,
        0.1,
        600
    );

    scene.add(camera);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance'
    });

    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    $('scene').appendChild(renderer.domElement);

    const hemisphere = new THREE.HemisphereLight(
        0xe4f4ff,
        0x58634b,
        2.0
    );
    scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(-60, 100, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    createCity();
    createCockpit();
    createTraffic();
    createSigns();

    window.addEventListener('resize', resize);

    animate();
}

// ================================================
// МАТЕРИАЛЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ================================================

function material(color, roughness = 0.85) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness
    });
}

function box(w, h, d, color, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material(color)
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    parent.add(mesh);
    return mesh;
}

function groundPlane(w, d, color, x, z) {
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        material(color)
    );

    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, -0.05, z);
    mesh.receiveShadow = true;
    scene.add(mesh);

    return mesh;
}

// ================================================
// ГОРОД
// ================================================

function createCity() {
    // Земля
    groundPlane(900, 900, 0x63845b, 0, 0);

    // Дороги вдоль оси Z
    for (let x = -200; x <= 200; x += GRID) {
        createVerticalRoad(x);
    }

    // Дороги вдоль оси X
    for (let z = -200; z <= 200; z += GRID) {
        createHorizontalRoad(z);
    }

    // Перекрёстки
    for (let x = -200; x <= 200; x += GRID) {
        for (let z = -200; z <= 200; z += GRID) {
            createIntersection(x, z);
            createIntersectionLights(x, z);
            createCrosswalks(x, z);
        }
    }

    createBuildings();
}

function createVerticalRoad(x) {
    groundPlane(ROAD_WIDTH, 600, 0x343a3f, x, 0);

    // Боковые линии
    for (const side of [-1, 1]) {
        const line = box(
            0.15, 0.025, 600,
            0xece8d8,
            x + side * 8.3, 0.015, 0
        );
        line.receiveShadow = false;
    }

    // Разделитель направлений
    box(0.16, 0.03, 600, 0xe8d6a1, x, 0.02, 0);

    // Разделители полос
    for (const side of [-1, 1]) {
        for (let z = -295; z <= 295; z += 12) {
            box(
                0.12, 0.025, 5,
                0xdedbd0,
                x + side * 4.5, 0.025, z
            );
        }
    }

    // Тротуары
    for (const side of [-1, 1]) {
        groundPlane(
            4, 600, 0xa6a79d,
            x + side * 11, 0
        );

        box(
            0.25, 0.25, 600,
            0xd0cfc6,
            x + side * 9, 0.1, 0
        );
    }
}

function createHorizontalRoad(z) {
    groundPlane(600, ROAD_WIDTH, 0x343a3f, 0, z);

    for (const side of [-1, 1]) {
        box(
            600, 0.025, 0.15,
            0xece8d8,
            0, 0.015, z + side * 8.3
        );
    }

    box(600, 0.03, 0.16, 0xe8d6a1, 0, 0.02, z);

    for (const side of [-1, 1]) {
        for (let x = -295; x <= 295; x += 12) {
            box(
                5, 0.025, 0.12,
                0xdedbd0,
                x, 0.025, z + side * 4.5
            );
        }
    }

    for (const side of [-1, 1]) {
        groundPlane(
            600, 4, 0xa6a79d,
            0, z + side * 11
        );
    }
}

// ================================================
// ПЕРЕКРЁСТКИ И ПЕШЕХОДНЫЕ ПЕРЕХОДЫ
// ================================================

function createIntersection(x, z) {
    // Поверхность перекрёстка
    groundPlane(ROAD_WIDTH, ROAD_WIDTH, 0x343a3f, x, z);

    // Стоп-линии на четырёх подъездах
    for (const side of [-1, 1]) {
        box(
            8.8, 0.035, 0.25,
            0xf5f2e8,
            x + side * 4.25, 0.03, z + 11
        );

        box(
            0.25, 0.035, 8.8,
            0xf5f2e8,
            x - 11, 0.03, z + side * 4.25
        );
    }
}

function createCrosswalks(x, z) {
    // Зебры с каждой стороны
    for (const side of [-1, 1]) {
        for (let i = -4; i <= 4; i += 2) {
            box(
                0.9, 0.035, 0.7,
                0xf4f1e8,
                x + i, 0.03, z + side * 10
            );

            box(
                0.7, 0.035, 0.9,
                0xf4f1e8,
                x + side * 10, 0.03, z + i
            );
        }
    }
}

// ================================================
// СВЕТОФОРЫ
// ================================================

function createSignal(x, z, rotation, axis) {
    const group = new THREE.Group();

    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 5.3, 10),
        material(0x343a3c)
    );

    pole.position.y = 2.65;
    group.add(pole);

    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 1.9, 0.55),
        material(0x202528)
    );

    head.position.y = 5.1;
    group.add(head);

    const bulbs = [];

    const colors = [0xff3030, 0xffc52c, 0x35d86b];

    colors.forEach((color, i) => {
        const bulb = new THREE.Mesh(
            new THREE.CircleGeometry(0.2, 20),
            new THREE.MeshBasicMaterial({ color })
        );

        bulb.position.set(
            0,
            5.68 - i * 0.58,
            0.285
        );

        group.add(bulb);
        bulbs.push(bulb);
    });

    group.position.set(x, 0, z);
    group.rotation.y = rotation;

    scene.add(group);

    trafficLights.push({
        bulbs,
        axis
    });
}

function createIntersectionLights(x, z) {
    // Подъезд с юга, движение на север
    createSignal(x - 9.5, z + 12, 0, 'NS');

    // Подъезд с севера
    createSignal(x + 9.5, z - 12, Math.PI, 'NS');

    // Подъезд с запада
    createSignal(x - 12, z + 9.5, Math.PI / 2, 'EW');

    // Подъезд с востока
    createSignal(x + 12, z - 9.5, -Math.PI / 2, 'EW');
}

function updateTrafficLights() {
    const phase = Math.floor(performance.now() / 6000) % 4;

    trafficLights.forEach(light => {
        let active = 0;

        if (phase === 0) active = light.axis === 'NS' ? 2 : 0;
        if (phase === 1) active = light.axis === 'NS' ? 1 : 0;
        if (phase === 2) active = light.axis === 'EW' ? 2 : 0;
        if (phase === 3) active = light.axis === 'EW' ? 1 : 0;

        light.bulbs.forEach((bulb, i) => {
            bulb.material.opacity = i === active ? 1 : 0.18;
            bulb.material.transparent = i !== active;
        });
    });
}

function getLightForPlayer() {
    const intersectionZ = Math.round(car.z / GRID) * GRID;
    const intersectionX = Math.round(car.x / GRID) * GRID;

    const dx = intersectionX - car.x;
    const dz = intersectionZ - car.z;

    const forwardX = Math.sin(car.yaw);
    const forwardZ = -Math.cos(car.yaw);

    const ahead = dx * forwardX + dz * forwardZ;
    const lateral = Math.abs(dx * forwardZ - dz * forwardX);

    if (ahead < 0 || ahead > 28 || lateral > 12) return null;

    const phase = Math.floor(performance.now() / 6000) % 4;
    const axis = Math.abs(forwardX) > Math.abs(forwardZ) ? 'EW' : 'NS';

    let color = 'green';

    if (axis === 'NS') {
        if (phase === 0) color = 'green';
        if (phase === 1) color = 'yellow';
        if (phase === 2 || phase === 3) color = 'red';
    } else {
        if (phase === 2) color = 'green';
        if (phase === 3) color = 'yellow';
        if (phase === 0 || phase === 1) color = 'red';
    }

    return { color, distance: ahead, x: intersectionX, z: intersectionZ };
}

// ================================================
// ЗДАНИЯ
// ================================================

function createBuildings() {
    const colors = [
        0xc1b9a9, 0xb4c0c1, 0xc7c0ad,
        0xaab4aa, 0xb8b0a5, 0xd0c5b1
    ];

    for (let bx = -200; bx < 200; bx += GRID) {
        for (let bz = -200; bz < 200; bz += GRID) {
            for (let i = 0; i < 4; i++) {
                const x = bx + (i % 2 === 0 ? -27 : 27);
                const z = bz + (i < 2 ? -27 : 27);

                const w = 13 + Math.random() * 9;
                const d = 13 + Math.random() * 9;
                const h = 7 + Math.random() * 17;

                const building = box(
                    w, h, d,
                    colors[Math.floor(Math.random() * colors.length)],
                    x, h / 2, z
                );

                // Окна
                for (let wx = -1; wx <= 1; wx++) {
                    for (let wy = 0; wy < Math.floor(h / 3); wy++) {
                        const windowMesh = box(
                            1.3, 1.5, 0.06,
                            0x547c8e,
                            x + wx * 3,
                            2 + wy * 3,
                            z + d / 2 + 0.04
                        );

                        windowMesh.castShadow = false;
                    }
                }

                roadObjects.push(building);
            }
        }
    }
}

// ================================================
// ДОРОЖНЫЕ ЗНАКИ
// ================================================

function createRoadSign(x, z, text, color = 0xffffff) {
    const group = new THREE.Group();

    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8),
        material(0x777777)
    );

    pole.position.y = 1.6;
    group.add(pole);

    const sign = new THREE.Mesh(
        new THREE.CircleGeometry(0.65, 32),
        new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide
        })
    );

    sign.position.set(0, 3.3, 0);
    group.add(sign);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 105px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 130);

    const texture = new THREE.CanvasTexture(canvas);

    const number = new THREE.Mesh(
        new THREE.PlaneGeometry(1.05, 1.05),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true })
    );

    number.position.set(0, 3.3, 0.02);
    group.add(number);

    group.position.set(x, 0, z);
    scene.add(group);
}

function createSigns() {
    // Знаки вдоль стартовой улицы
    createRoadSign(10, 20, '50');
    createRoadSign(-10, -25, '!');
    createRoadSign(110, 20, '50');
    createRoadSign(-110, 20, '30');
}

// ================================================
// ДРУГИЕ АВТОМОБИЛИ
// ================================================

function makeTrafficCar(color) {
    const group = new THREE.Group();

    box(2.05, 0.75, 4.3, color, 0, 0.75, 0, group);
    box(1.7, 0.8, 2.1, 0x304e5d, 0, 1.5, -0.15, group);

    for (const x of [-0.85, 0.85]) {
        for (const z of [-1.4, 1.4]) {
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.38, 0.38, 0.22, 16),
                material(0x17191b)
            );

            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.4, z);
            group.add(wheel);
        }
    }

    return group;
}

function createTraffic() {
    const colors = [
        0xb83d35, 0x315f9b, 0xe0ddd3,
        0x20282e, 0x719b6b, 0xb9a44b
    ];

    // Машины впереди и на встречной полосе
    for (let i = 0; i < 12; i++) {
        const direction = i % 2 === 0 ? -1 : 1;

        const mesh = makeTrafficCar(
            colors[i % colors.length]
        );

        mesh.position.set(
            direction === -1 ? 2.25 : -2.25,
            0,
            -25 - Math.floor(i / 2) * 45
        );

        if (direction === 1) {
            mesh.rotation.y = Math.PI;
        }

        scene.add(mesh);

        trafficCars.push({
            mesh,
            direction,
            speed: 6 + Math.random() * 7
        });
    }
}

function updateTraffic(dt) {
    trafficCars.forEach(other => {
        const dx = Math.sin(0) * other.speed * dt;
        const dz = -other.direction * other.speed * dt;

        other.mesh.position.z += dz;

        if (other.mesh.position.z < -280) {
            other.mesh.position.z = 250 + Math.random() * 50;
        }

        if (other.mesh.position.z > 280) {
            other.mesh.position.z = -250 - Math.random() * 50;
        }

        const distance = Math.hypot(
            other.mesh.position.x - car.x,
            other.mesh.position.z - car.z
        );

        if (distance < 4.2 && car.speed > 0) {
            car.speed = Math.max(0, car.speed - 30 * dt);
            message('Осторожно! Слишком близко к другому автомобилю.');
        }
    });
}

// ================================================
// САЛОН
// ================================================

function createCockpit() {
    carInterior = new THREE.Group();
    camera.add(carInterior);

    const dark = material(0x171c20);

    function interiorBox(w, h, d, x, y, z, mat = dark) {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            mat
        );

        mesh.position.set(x, y, z);
        carInterior.add(mesh);
        return mesh;
    }

    // Передняя панель
    interiorBox(2.5, 0.42, 0.65, 0, -0.85, -1.05);
    interiorBox(2.6, 0.3, 0.7, 0, -1.1, -0.7);

    // Стойки лобового стекла
    interiorBox(0.12, 2.5, 0.15, -1.18, 0.3, -1.2);
    interiorBox(0.12, 2.5, 0.15, 1.18, 0.3, -1.2);

    // Крыша
    interiorBox(2.4, 0.12, 0.2, 0, 1.48, -1.2);

    // Зеркало
    interiorBox(
        0.55, 0.15, 0.08,
        0, 1.05, -1.05,
        material(0x647e87)
    );

    // Руль
    wheelVisual = new THREE.Group();
    wheelVisual.position.set(-0.52, -0.57, -1.15);

    const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.045, 12, 40),
        dark
    );

    wheelVisual.add(rim);

    const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.08, 20),
        dark
    );

    center.rotation.x = Math.PI / 2;
    wheelVisual.add(center);

    for (let i = 0; i < 3; i++) {
        const spoke = new THREE.Mesh(
            new THREE.BoxGeometry(0.055, 0.32, 0.06),
            dark
        );

        spoke.rotation.z = i * Math.PI * 2 / 3;
        wheelVisual.add(spoke);
    }

    carInterior.add(wheelVisual);

    // Центральная консоль
    interiorBox(0.45, 0.55, 0.4, 0.55, -1.05, -0.85);

    // Боковые зеркала
    for (const side of [-1, 1]) {
        interiorBox(
            0.2, 0.13, 0.32,
            side * 1.25, 0.12, -1.3,
            material(0x7394a2)
        );
    }

    // Козырёк приборной панели
    interiorBox(1.0, 0.13, 0.38, -0.55, -0.55, -1.12);
}

// ================================================
// УПРАВЛЕНИЕ ПЕДАЛЯМИ И РУЛЁМ
// ================================================

document.querySelectorAll('[data-control]').forEach(button => {
    const name = button.dataset.control;

    const change = value => {
        input[name] = value;
        button.classList.toggle('pressed', value);
    };

    button.addEventListener('pointerdown', e => {
        e.preventDefault();
        change(true);
        button.setPointerCapture(e.pointerId);
    });

    button.addEventListener('pointerup', () => change(false));
    button.addEventListener('pointercancel', () => change(false));
    button.addEventListener('lostpointercapture', () => change(false));
});

// ================================================
// КЛАВИАТУРА
// ================================================

window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }

    keys[e.code] = true;

    if (e.repeat) return;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') input.gas = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') input.brake = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;

    if (e.code.startsWith('Shift')) input.clutch = true;

    if (e.code === 'Space') {
        car.handbrake = !car.handbrake;
        message(car.handbrake ? 'Ручник включён.' : 'Ручник снят.');
    }

    if (e.code === 'KeyQ') toggleSignal('left');
    if (e.code === 'KeyE') toggleSignal('right');
    if (e.code === 'KeyH') toggleHazard();
    if (e.code === 'KeyL') toggleLights();
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') input.gas = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') input.brake = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;

    if (e.code.startsWith('Shift')) input.clutch = false;
});

// ================================================
// КНОПКИ АВТОМОБИЛЯ
// ================================================

function toggleSignal(side) {
    if (side === 'left') {
        state.leftSignal = !state.leftSignal;
        state.rightSignal = false;
    } else {
        state.rightSignal = !state.rightSignal;
        state.leftSignal = false;
    }

    state.hazard = false;
    updateButtons();
}

function toggleHazard() {
    state.hazard = !state.hazard;
    state.leftSignal = false;
    state.rightSignal = false;
    updateButtons();
}

function toggleLights() {
    state.lights = !state.lights;
    updateButtons();
}

$('leftSignal').onclick = () => toggleSignal('left');
$('rightSignal').onclick = () => toggleSignal('right');
$('hazardBtn').onclick = toggleHazard;
$('lightsBtn').onclick = toggleLights;

$('handbrakeBtn').onclick = () => {
    if (car.speed > 5) {
        message('Сначала снизь скорость!');
        return;
    }

    car.handbrake = !car.handbrake;
    updateButtons();
};

$('beltBtn').onclick = () => {
    car.belt = !car.belt;
    updateButtons();

    message(car.belt
        ? 'Ремень безопасности пристёгнут.'
        : 'Пристегни ремень перед поездкой.');
};

$('hornBtn').onclick = () => message('Звуковой сигнал!');

// ================================================
// КОРОБКА ПЕРЕДАЧ
// ================================================

function updateGear() {
    $('gearDisplay').textContent =
        transmission === 'manual' ? car.gear : car.autoGear;

    document.querySelectorAll('[data-gear]').forEach(button => {
        button.classList.toggle(
            'selected',
            button.dataset.gear === car.gear
        );
    });

    document.querySelectorAll('[data-auto]').forEach(button => {
        button.classList.toggle(
            'selected',
            button.dataset.auto === car.autoGear
        );
    });
}

document.querySelectorAll('[data-gear]').forEach(button => {
    button.onclick = () => {
        if (!input.clutch) {
            message('Выжми сцепление перед переключением передачи!');
            return;
        }

        if (button.dataset.gear === 'R' && car.speed > 1) {
            message('Нельзя включать заднюю передачу на ходу!');
            return;
        }

        car.gear = button.dataset.gear;
        car.stalled = false;
        updateGear();
    };
});

document.querySelectorAll('[data-auto]').forEach(button => {
    button.onclick = () => {
        if (car.speed > 1 && ['P', 'R'].includes(button.dataset.auto)) {
            message('Полностью остановись перед переключением!');
            return;
        }

        car.autoGear = button.dataset.auto;
        updateGear();
    };
});

// ================================================
// ФИЗИКА АВТОМОБИЛЯ
// ================================================

function updatePhysics(dt) {
    let direction = 1;
    let canDrive = false;

    if (transmission === 'manual') {
        direction = car.gear === 'R' ? -1 : 1;

        canDrive = car.engineOn &&
            !car.stalled &&
            !input.clutch &&
            !car.handbrake &&
            car.gear !== 'N';
    } else {
        direction = car.autoGear === 'R' ? -1 : 1;

        canDrive = car.engineOn &&
            !car.handbrake &&
            (car.autoGear === 'D' || car.autoGear === 'R');
    }

    let maxSpeed = 50;

    if (transmission === 'manual') {
        maxSpeed = ({
            '1': 35,
            '2': 55,
            '3': 80,
            '4': 110,
            '5': 150,
            'R': 20,
            'N': 0
        })[car.gear] || 0;
    }

    if (transmission === 'auto') {
        maxSpeed = car.autoGear === 'D' ? 150 : 20;
        if (car.autoGear === 'P' || car.autoGear === 'N') maxSpeed = 0;
    }

    if (input.brake) {
        car.speed -= 32 * dt;
    } else if (input.gas && canDrive) {
        car.speed += 12 * dt;
    } else {
        car.speed -= 2.3 * dt;
    }

    if (car.handbrake) car.speed -= 40 * dt;

    if (transmission === 'manual' && input.gas && !input.clutch &&
        car.gear === '1' && car.speed < 1 && car.rpm < 950) {
        car.stalled = true;
        car.speed = 0;
        message('Двигатель заглох! Выжми сцепление.');
    }

    if (input.gas && input.clutch && transmission === 'manual') {
        car.rpm += 1800 * dt;
    } else {
        const targetRPM = transmission === 'manual'
            ? 850 + car.speed * 65
            : 850 + car.speed * 38;

        car.rpm += (targetRPM - car.rpm) * Math.min(1, dt * 3);
    }

    car.speed = clamp(car.speed, 0, maxSpeed);
    car.rpm = clamp(car.rpm, 800, 6500);

    // Руль
    const steeringInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    car.steering += (steeringInput - car.steering) * Math.min(1, dt * 6);

    // Настоящий поворот автомобиля
    const speedFactor = Math.min(car.speed / 12, 1);

    if (car.speed > 0.5) {
        car.yaw += car.steering * 0.85 * speedFactor * dt * direction;
    }

    // Движение по координатам мира
    const forwardX = Math.sin(car.yaw);
    const forwardZ = -Math.cos(car.yaw);

    car.x += forwardX * car.speed * direction * dt / 3.6;
    car.z += forwardZ * car.speed * direction * dt / 3.6;

    state.distance += car.speed * dt / 3.6;

    // Границы города
    car.x = clamp(car.x, -CITY_LIMIT, CITY_LIMIT);
    car.z = clamp(car.z, -CITY_LIMIT, CITY_LIMIT);

    if (wheelVisual) {
        wheelVisual.rotation.z = -car.steering * 0.75;
    }

    updateCamera();
    updateHUD();
    checkRoadRules();
}

// ================================================
// КАМЕРА И ПОЛОЖЕНИЕ АВТОМОБИЛЯ
// ================================================

function updateCamera() {
    camera.position.set(car.x, 1.58, car.z);

    camera.rotation.order = 'YXZ';
    camera.rotation.y = car.yaw;

    // Лёгкое смещение взгляда при повороте
    camera.rotation.z = -car.steering * 0.018;
}

// ================================================
// ПРАВИЛА ДОРОЖНОГО ДВИЖЕНИЯ
// ================================================

function checkRoadRules() {
    const light = getLightForPlayer();

    if (light && light.color === 'red' && light.distance < 1.5 &&
        car.speed > 3 && state.lastIntersection !== `${light.x},${light.z}`) {

        state.violations++;
        state.lastIntersection = `${light.x},${light.z}`;

        message('Нарушение! Проезд на запрещающий сигнал светофора.');
    }

    if (!light) {
        state.lastIntersection = null;
    }

    if (car.speed > 50 && performance.now() - state.lastSpeedWarning > 5000) {
        state.lastSpeedWarning = performance.now();
        message('Внимание! Превышено ограничение скорости.');
        state.violations++;
    }

    // Предупреждение перед светофором
    if (light && light.distance < 24 && light.distance > 1) {
        if (light.color === 'red') {
            message('Красный сигнал! Остановись перед стоп-линией.');
        } else if (light.color === 'yellow') {
            message('Жёлтый сигнал светофора. Приготовься остановиться.');
        } else if (light.color === 'green') {
            message('Зелёный сигнал. Можно продолжать движение.');
        }
    }
}

// ================================================
// ИНТЕРФЕЙС
// ================================================

function message(text) {
    if (state.message === text) return;

    state.message = text;
    $('message').textContent = text;
}

function updateButtons() {
    $('leftSignal').classList.toggle('active', state.leftSignal);
    $('rightSignal').classList.toggle('active', state.rightSignal);
    $('hazardBtn').classList.toggle('active', state.hazard);
    $('lightsBtn').classList.toggle('active', state.lights);
    $('handbrakeBtn').classList.toggle('active', car.handbrake);
    $('beltBtn').classList.toggle('active', car.belt);

    const signalText = state.hazard
        ? '● АВАРИЙКА'
        : state.leftSignal
            ? '● ЛЕВЫЙ ПОВОРОТ'
            : state.rightSignal
                ? '● ПРАВЫЙ ПОВОРОТ'
                : '● ПОВОРОТНИКИ ВЫКЛ.';

    $('signalStatus').textContent = signalText;
    $('beltStatus').textContent = car.belt
        ? '● РЕМЕНЬ ПРИСТЁГНУТ'
        : '● РЕМЕНЬ НЕ ПРИСТЁГНУТ';

    $('brakeStatus').textContent = car.handbrake
        ? '● РУЧНИК ВКЛЮЧЁН'
        : '● РУЧНИК СНЯТ';
}

function updateHUD() {
    $('speed').textContent = Math.round(car.speed);
    $('rpm').textContent = Math.round(car.rpm);
    $('rpmBar').style.width = (car.rpm / 6500 * 100) + '%';

    $('gearDisplay').textContent =
        transmission === 'manual' ? car.gear : car.autoGear;
}

// ================================================
// ОСНОВНОЙ ЦИКЛ
// ================================================

function animate() {
    requestAnimationFrame(animate);

    if (!started || $('game').classList.contains('hidden')) return;

    const dt = Math.min(clock.getDelta(), 0.04);

    updatePhysics(dt);
    updateTraffic(dt);
    updateTrafficLights();

    renderer.render(scene, camera);
}

// ================================================
// ИЗМЕНЕНИЕ РАЗМЕРА
// ================================================

function resize() {
    if (!camera || !renderer) return;

    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
}
