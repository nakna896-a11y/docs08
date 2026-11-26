
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

// ========================================
// DRIVING SCHOOL UA — VERSION 0.1
// ========================================

const $ = (id) => document.getElementById(id);

const menu = $('menu');
const game = $('game');
const sceneContainer = $('scene');

let transmission = 'manual';
let selectedCar = 'sedan';
let started = false;

let speed = 0;
let rpm = 850;
let gear = '1';
let autoGear = 'D';
let steering = 0;

let gas = false;
let brake = false;
let clutch = false;
let handbrake = true;
let seatbelt = false;

let leftSignal = false;
let rightSignal = false;
let hazard = false;
let headlights = false;
let wipers = false;

let steeringLeft = false;
let steeringRight = false;

let engineOn = true;
let engineStalled = false;

let lastTime = 0;
let distance = 0;
let lessonTimer = 0;
let lastInstructorMessage = '';

const keys = {};

let renderer, scene, camera;
let roadMarks = [];
let trafficCars = [];
let trees = [];
let signs = [];
let steeringWheel;
let wheelGroup;
let dashboardGroup;
let trafficLight;
let lightBulbs = [];
let world;

const clock = new THREE.Clock();

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function instructor(message) {
    if (message === lastInstructorMessage) return;
    lastInstructorMessage = message;
    $('instructorText').textContent = message;
}

// ========================================
// ВЫБОР КОРОБКИ ПЕРЕДАЧ
// ========================================

document.querySelectorAll('.trans-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.trans-btn')
            .forEach(b => b.classList.remove('active'));

        button.classList.add('active');
        transmission = button.dataset.mode;
    });
});

// ========================================
// ЗАПУСК И ВЫХОД
// ========================================

$('startBtn').addEventListener('click', () => {
    selectedCar = $('carSelect').value;

    menu.classList.add('hidden');
    game.classList.remove('hidden');

    if (!started) {
        init3D();
        started = true;
    }

    handbrake = true;
    speed = 0;
    engineOn = true;
    engineStalled = false;

    if (transmission === 'manual') {
        gear = '1';
        autoGear = 'D';
        $('gearPanel').classList.remove('hidden');
        $('autoPanel').classList.add('hidden');
        $('gearMode').textContent = 'МЕХАНИКА';
        $('clutchBtn').style.display = 'flex';
    } else {
        autoGear = 'P';
        gear = '1';
        $('gearPanel').classList.add('hidden');
        $('autoPanel').classList.remove('hidden');
        $('gearMode').textContent = 'АВТОМАТ';
        $('clutchBtn').style.display = 'none';
    }

    seatbelt = false;
    $('seatbeltIndicator').classList.remove('active');

    updateGearUI();
    instructor('Добро пожаловать! Пристегни ремень, сними ручник и начинай движение.');
    clock.start();
});

$('backBtn').addEventListener('click', () => {
    game.classList.add('hidden');
    menu.classList.remove('hidden');

    speed = 0;
    gas = false;
    brake = false;
    handbrake = true;
});

// ========================================
// THREE.JS — СОЗДАНИЕ МИРА
// ========================================

function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9bbacb);
    scene.fog = new THREE.Fog(0x9bbacb, 75, 210);

    camera = new THREE.PerspectiveCamera(
        72,
        window.innerWidth / window.innerHeight,
        0.1,
        300
    );

    camera.position.set(0, 1.55, 0);
    camera.lookAt(0, 1.45, -30);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance'
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    sceneContainer.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x63765d, 2.0);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-30, 60, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    world = new THREE.Group();
    scene.add(world);

    createEnvironment();
    createRoad();
    createRoadSigns();
    createTraffic();
    createCockpit();
    createTrafficLight();

    window.addEventListener('resize', onResize);

    animate();
}

// ========================================
// ОКРУЖЕНИЕ
// ========================================

function createEnvironment() {
    const grass = new THREE.Mesh(
        new THREE.PlaneGeometry(500, 500),
        new THREE.MeshStandardMaterial({ color: 0x56824c })
    );

    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.06;
    grass.position.z = -150;
    world.add(grass);

    const buildingsColors = [
        0xb5b1a2, 0xd0c6b0, 0x9daeb0,
        0xc4b8a7, 0xa6b2a5
    ];

    for (let i = 0; i < 35; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const z = -15 - Math.floor(i / 2) * 10;
        const x = side * (17 + Math.random() * 20);
        const h = 5 + Math.random() * 15;
        const w = 5 + Math.random() * 8;

        const building = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, 7),
            new THREE.MeshStandardMaterial({
                color: buildingsColors[i % buildingsColors.length]
            })
        );

        building.position.set(x, h / 2, z);
        building.castShadow = true;
        world.add(building);

        for (let j = 0; j < 4; j++) {
            const windowMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.9, 1.2, 0.08),
                new THREE.MeshStandardMaterial({ color: 0x55798b })
            );

            windowMesh.position.set(
                x - w / 3 + j * 1.5,
                h / 2 + 0.5,
                z - 3.55
            );

            world.add(windowMesh);
        }
    }

    // Деревья
    for (let i = 0; i < 38; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const z = -10 - Math.floor(i / 2) * 10;
        const x = side * (10 + Math.random() * 9);

        const tree = new THREE.Group();

        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.22, 2, 7),
            new THREE.MeshStandardMaterial({ color: 0x65452d })
        );
        trunk.position.y = 1;
        tree.add(trunk);

        const crown = new THREE.Mesh(
            new THREE.SphereGeometry(1.4 + Math.random() * 0.6, 9, 8),
            new THREE.MeshStandardMaterial({ color: 0x326b39 })
        );
        crown.position.y = 3;
        tree.add(crown);

        tree.position.set(x, 0, z);
        world.add(tree);
        trees.push(tree);
    }
}

// ========================================
// ДОРОГА И РАЗМЕТКА
// ========================================

function createRoad() {
    const road = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 350),
        new THREE.MeshStandardMaterial({
            color: 0x343a40,
            roughness: 1
        })
    );

    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -150);
    world.add(road);

    // Обочины
    for (const x of [-6.3, 6.3]) {
        const edge = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.18, 350),
            new THREE.MeshStandardMaterial({ color: 0xc3c2b8 })
        );

        edge.position.set(x, 0.04, -150);
        world.add(edge);
    }

    // Линии краёв дороги
    for (const x of [-5.3, 5.3]) {
        const line = new THREE.Mesh(
            new THREE.BoxGeometry(0.13, 0.02, 350),
            new THREE.MeshBasicMaterial({ color: 0xf4f0df })
        );

        line.position.set(x, 0.02, -150);
        world.add(line);
    }

    // Прерывистая центральная разметка
    for (let i = 0; i < 24; i++) {
        const mark = new THREE.Mesh(
            new THREE.BoxGeometry(0.13, 0.025, 4),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );

        mark.position.set(0, 0.025, -i * 12 - 4);
        world.add(mark);
        roadMarks.push(mark);
    }
}

// ========================================
// ДОРОЖНЫЕ ЗНАКИ
// ========================================

function createSign(x, z, type) {
    const group = new THREE.Group();

    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3, 8),
        new THREE.MeshStandardMaterial({ color: 0x999999 })
    );

    pole.position.y = 1.5;
    group.add(pole);

    let sign;

    if (type === 'limit') {
        sign = new THREE.Mesh(
            new THREE.CylinderGeometry(0.65, 0.65, 0.12, 32),
            new THREE.MeshStandardMaterial({
                color: 0xffffff,
                roughness: 0.5
            })
        );

        sign.rotation.x = Math.PI / 2;
        sign.position.y = 3.1;

        const redBorder = new THREE.Mesh(
            new THREE.TorusGeometry(0.56, 0.075, 8, 32),
            new THREE.MeshStandardMaterial({ color: 0xd52e2e })
        );

        redBorder.position.y = 3.1;
        group.add(redBorder);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#202020';
        ctx.font = 'bold 100px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('50', 128, 128);

        const texture = new THREE.CanvasTexture(canvas);

        const number = new THREE.Mesh(
            new THREE.PlaneGeometry(1.05, 1.05),
            new THREE.MeshBasicMaterial({ map: texture })
        );

        number.position.set(0, 3.1, 0.08);
        group.add(number);
    } else {
        sign = new THREE.Mesh(
            new THREE.CircleGeometry(0.55, 3),
            new THREE.MeshStandardMaterial({
                color: 0xe5c34b,
                side: THREE.DoubleSide
            })
        );

        sign.position.y = 3;
    }

    if (sign) group.add(sign);

    group.position.set(x, 0, z);
    world.add(group);
    signs.push(group);
}

function createRoadSigns() {
    createSign(8, -32, 'limit');
    createSign(-8, -95, 'warning');
    createSign(8, -155, 'limit');
}

// ========================================
// ДРУГИЕ АВТОМОБИЛИ
// ========================================

function createCarModel(color) {
    const car = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 0.8, 4.2),
        new THREE.MeshStandardMaterial({
            color,
            metalness: 0.25,
            roughness: 0.5
        })
    );

    body.position.y = 0.75;
    body.castShadow = true;
    car.add(body);

    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.75, 2.1),
        new THREE.MeshStandardMaterial({
            color: 0x263e4b,
            metalness: 0.3
        })
    );

    roof.position.set(0, 1.45, -0.1);
    car.add(roof);

    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.55, 0.05),
        new THREE.MeshStandardMaterial({
            color: 0x91c6dc,
            metalness: 0.2,
            roughness: 0.2
        })
    );

    glass.position.set(0, 1.45, -1.18);
    car.add(glass);

    for (const x of [-0.8, 0.8]) {
        for (const z of [-1.35, 1.35]) {
            const wheel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.38, 0.38, 0.22, 16),
                new THREE.MeshStandardMaterial({ color: 0x171717 })
            );

            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.4, z);
            car.add(wheel);
        }
    }

    return car;
}

function createTraffic() {
    const colors = [0xc23e34, 0x315caa, 0xd3d2c9, 0x202a32, 0x6e9b65];

    for (let i = 0; i < 5; i++) {
        const car = createCarModel(colors[i]);

        car.position.set(
            i % 2 === 0 ? -2.2 : 2.2,
            0,
            -35 - i * 32
        );

        world.add(car);

        trafficCars.push({
            mesh: car,
            baseSpeed: 5 + Math.random() * 7,
            lane: i % 2 === 0 ? -2.2 : 2.2
        });
    }
}

// ========================================
// СВЕТОФОР
// ========================================

function createTrafficLight() {
    trafficLight = new THREE.Group();

    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 7, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
    );

    pole.position.y = 3.5;
    trafficLight.add(pole);

    const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 2.2, 0.65),
        new THREE.MeshStandardMaterial({ color: 0x20252a })
    );

    box.position.set(0, 5.4, 0);
    trafficLight.add(box);

    const colors = [0xff2929, 0xffd12d, 0x35db62];

    colors.forEach((color, i) => {
        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 16, 16),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.25
            })
        );

        bulb.position.set(0, 6.1 - i * 0.65, 0.34);
        trafficLight.add(bulb);
        lightBulbs.push(bulb);
    });

    trafficLight.position.set(8, 0, -85);
    world.add(trafficLight);

    setInterval(() => {
        const phase = Math.floor(Date.now() / 5000) % 3;

        lightBulbs.forEach((bulb, i) => {
            bulb.material.opacity = i === phase ? 1 : 0.2;
        });
    }, 500);
}

// ========================================
// САЛОН АВТОМОБИЛЯ
// ========================================

function createCockpit() {
    dashboardGroup = new THREE.Group();
    camera.add(dashboardGroup);

    const darkMaterial = new THREE.MeshStandardMaterial({
        color: 0x171c20,
        roughness: 0.65
    });

    // Приборная панель
    const dashboard = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.5, 0.65),
        darkMaterial
    );

    dashboard.position.set(0, -0.82, -1.1);
    dashboardGroup.add(dashboard);

    // Нижняя часть салона
    const lower = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.4, 0.9),
        darkMaterial
    );

    lower.position.set(0, -1.1, -0.65);
    dashboardGroup.add(lower);

    // Руль
    wheelGroup = new THREE.Group();
    wheelGroup.position.set(-0.52, -0.55, -1.15);

    const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.045, 12, 40),
        new THREE.MeshStandardMaterial({
            color: 0x101010,
            roughness: 0.55
        })
    );

    wheelGroup.add(wheel);

    const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24),
        new THREE.MeshStandardMaterial({ color: 0x252a2d })
    );

    center.rotation.x = Math.PI / 2;
    wheelGroup.add(center);

    for (let i = 0; i < 3; i++) {
        const spoke = new THREE.Mesh(
            new THREE.BoxGeometry(0.055, 0.32, 0.055),
            darkMaterial
        );

        spoke.rotation.z = i * Math.PI * 2 / 3;
        wheelGroup.add(spoke);
    }

    dashboardGroup.add(wheelGroup);
    steeringWheel = wheelGroup;

    // Стойки лобового стекла
    for (const x of [-1.15, 1.15]) {
        const pillar = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 2.5, 0.16),
            darkMaterial
        );

        pillar.position.set(x, 0.35, -1.15);
        dashboardGroup.add(pillar);
    }

    // Верхняя рамка
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.13, 0.18),
        darkMaterial
    );

    roof.position.set(0, 1.45, -1.15);
    dashboardGroup.add(roof);

    // Зеркало заднего вида
    const mirror = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.17, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x293d47 })
    );

    mirror.position.set(0, 1.05, -1.0);
    dashboardGroup.add(mirror);

    // Боковые зеркала
    for (const x of [-1.18, 1.18]) {
        const sideMirror = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.14, 0.32),
            new THREE.MeshStandardMaterial({
                color: 0x9ebac7,
                metalness: 0.5
            })
        );

        sideMirror.position.set(x, 0.15, -1.35);
        dashboardGroup.add(sideMirror);
    }

    // Центральная консоль
    const consoleMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.55, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x252c30 })
    );

    consoleMesh.position.set(0.55, -1.03, -0.9);
    dashboardGroup.add(consoleMesh);
}

// ========================================
// КОРОБКА ПЕРЕДАЧ
// ========================================

function updateGearUI() {
    document.querySelectorAll('[data-gear]').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.gear === gear);
    });

    document.querySelectorAll('[data-auto]').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.auto === autoGear);
    });

    $('gearDisplay').textContent =
        transmission === 'manual' ? gear : autoGear;
}

document.querySelectorAll('[data-gear]').forEach(button => {
    button.addEventListener('click', () => {
        if (transmission !== 'manual') return;

        if (!clutch) {
            instructor('Для переключения передачи сначала нажми сцепление!');
            return;
        }

        if (speed > 5 && button.dataset.gear === 'R') {
            instructor('Нельзя включать заднюю передачу на ходу!');
            return;
        }

        gear = button.dataset.gear;
        engineStalled = false;
        updateGearUI();
    });
});

document.querySelectorAll('[data-auto]').forEach(button => {
    button.addEventListener('click', () => {
        if (transmission !== 'auto') return;

        if (speed > 2 && ['P', 'R'].includes(button.dataset.auto)) {
            instructor('Сначала полностью остановись!');
            return;
        }

        autoGear = button.dataset.auto;
        updateGearUI();
    });
});

// ========================================
// КНОПКИ АВТОМОБИЛЯ
// ========================================

function toggleButton(id, callback) {
    $(id).addEventListener('click', callback);
}

toggleButton('leftSignal', () => {
    leftSignal = !leftSignal;
    rightSignal = false;
    hazard = false;
    updateIndicators();
});

toggleButton('rightSignal', () => {
    rightSignal = !rightSignal;
    leftSignal = false;
    hazard = false;
    updateIndicators();
});

toggleButton('hazardBtn', () => {
    hazard = !hazard;
    leftSignal = false;
    rightSignal = false;
    updateIndicators();
});

toggleButton('lightsBtn', () => {
    headlights = !headlights;
    $('lightsBtn').classList.toggle('active', headlights);
    $('headlightIndicator').classList.toggle('active', headlights);
});

toggleButton('wiperBtn', () => {
    wipers = !wipers;
    $('wiperBtn').classList.toggle('active', wipers);
});

toggleButton('handbrakeBtn', () => {
    if (speed > 5) {
        instructor('Осторожно! Не используй ручник на высокой скорости!');
        return;
    }

    handbrake = !handbrake;
    $('handbrakeBtn').classList.toggle('active', handbrake);
    instructor(handbrake ? 'Стояночный тормоз включён.' : 'Стояночный тормоз снят.');
});

toggleButton('beltBtn', () => {
    seatbelt = !seatbelt;
    $('beltBtn').classList.toggle('active', seatbelt);
    $('seatbeltIndicator').classList.toggle('active', seatbelt);

    instructor(seatbelt
        ? 'Отлично! Ремень безопасности пристёгнут.'
        : 'Внимание! Не забудь пристегнуть ремень.');
});

toggleButton('hornBtn', () => {
    instructor('Ты нажала на звуковой сигнал!');
});

function updateIndicators() {
    $('leftIndicator').classList.toggle('active', leftSignal || hazard);
    $('rightIndicator').classList.toggle('active', rightSignal || hazard);
    $('hazardIndicator').classList.toggle('active', hazard);
}

function updateSignalButtons() {
    $('leftSignal').classList.toggle('active', leftSignal);
    $('rightSignal').classList.toggle('active', rightSignal);
    $('hazardBtn').classList.toggle('active', hazard);
}

// ========================================
// ПЕДАЛИ И РУЛЬ
// ========================================

document.querySelectorAll('[data-control]').forEach(button => {
    const control = button.dataset.control;

    const setValue = (value) => {
        if (control === 'gas') gas = value;
        if (control === 'brake') brake = value;
        if (control === 'clutch') clutch = value;
        if (control === 'left') steeringLeft = value;
        if (control === 'right') steeringRight = value;

        button.classList.toggle('pressed', value);
    };

    button.addEventListener('pointerdown', e => {
        e.preventDefault();
        setValue(true);
        button.setPointerCapture(e.pointerId);
    });

    button.addEventListener('pointerup', () => setValue(false));
    button.addEventListener('pointercancel', () => setValue(false));
    button.addEventListener('lostpointercapture', () => setValue(false));
});

// ========================================
// КЛАВИАТУРА
// ========================================

window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }

    keys[e.code] = true;

    if (e.repeat) return;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') gas = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') brake = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') clutch = true;
    if (e.code === 'Space') handbrake = !handbrake;

    if (e.code === 'KeyA' || e.code === 'ArrowLeft') steeringLeft = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') steeringRight = true;

    if (e.code === 'KeyQ') {
        leftSignal = !leftSignal;
        rightSignal = false;
        hazard = false;
        updateIndicators();
        updateSignalButtons();
    }

    if (e.code === 'KeyE') {
        rightSignal = !rightSignal;
        leftSignal = false;
        hazard = false;
        updateIndicators();
        updateSignalButtons();
    }

    if (e.code === 'KeyH') {
        hazard = !hazard;
        leftSignal = false;
        rightSignal = false;
        updateIndicators();
        updateSignalButtons();
    }

    if (e.code === 'KeyL') {
        headlights = !headlights;
        $('lightsBtn').classList.toggle('active', headlights);
        $('headlightIndicator').classList.toggle('active', headlights);
    }

    if (e.code === 'KeyB') {
        seatbelt = !seatbelt;
        $('seatbeltIndicator').classList.toggle('active', seatbelt);
        $('beltBtn').classList.toggle('active', seatbelt);
    }

    if (transmission === 'manual' && e.code.startsWith('Digit')) {
        const selected = e.code.replace('Digit', '');

        if (['1', '2', '3', '4', '5'].includes(selected) && clutch) {
            gear = selected;
            engineStalled = false;
            updateGearUI();
        }
    }
});

window.addEventListener('keyup', e => {
    keys[e.code] = false;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') gas = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') brake = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') clutch = false;

    if (e.code === 'KeyA' || e.code === 'ArrowLeft') steeringLeft = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') steeringRight = false;
});

// ========================================
// ФИЗИКА АВТОМОБИЛЯ
// ========================================

function updatePhysics(dt) {
    const maxSpeed = transmission === 'manual'
        ? ({ '1': 35, '2': 55, '3': 80, '4': 105, '5': 140, 'R': 20, 'N': 0 }[gear] || 0)
        : (autoGear === 'D' ? 140 : autoGear === 'R' ? 20 : 0);

    let acceleration = 0;

    if (transmission === 'manual') {
        if (gas && !clutch && !handbrake && !engineStalled &&
            gear !== 'N' && speed < maxSpeed) {
            acceleration = 14;
        }

        if (gas && clutch && !handbrake) {
            rpm = Math.min(4000, rpm + 1800 * dt);
        }

        if (!clutch && gas && gear === '1' && speed < 2 && rpm < 950) {
            engineStalled = true;
            engineOn = false;
            instructor('Двигатель заглох! Выжми сцепление, чтобы снова начать движение.');
        }

        if (engineStalled) acceleration = 0;

    } else {
        if (gas && !handbrake && ['D', 'R'].includes(autoGear) && speed < maxSpeed) {
            acceleration = 12;
        }
    }

    if (brake) {
        speed = Math.max(0, speed - 24 * dt);
    } else if (acceleration > 0) {
        speed = Math.min(maxSpeed, speed + acceleration * dt);
    } else {
        speed = Math.max(0, speed - 1.5 * dt);
    }

    if (handbrake) {
        speed = Math.max(0, speed - 35 * dt);
    }

    if (transmission === 'manual' && gear === 'R') {
        if (gas && !clutch && !handbrake && !engineStalled) {
            speed = Math.min(20, speed + 8 * dt);
        }
    }

    if (transmission === 'auto' && autoGear === 'R') {
        if (gas && !handbrake) {
            speed = Math.min(20, speed + 8 * dt);
        }
    }

    if (transmission === 'manual') {
        const ratio = ({ '1': 115, '2': 82, '3': 58, '4': 43, '5': 34, 'R': 100, 'N': 0 }[gear] || 0);

        const targetRPM = clutch || gear === 'N'
            ? 850 + (gas ? 2600 : 0)
            : 850 + speed * ratio;

        rpm += (clamp(targetRPM, 850, 6500) - rpm) * Math.min(1, dt * 4);
    } else {
        const targetRPM = autoGear === 'P' || autoGear === 'N'
            ? 850 + (gas ? 1800 : 0)
            : 850 + speed * 35;

        rpm += (clamp(targetRPM, 850, 5500) - rpm) * Math.min(1, dt * 3);
    }

    if (steeringLeft) steering = Math.max(-1, steering - 2.4 * dt);
    else if (steeringRight) steering = Math.min(1, steering + 2.4 * dt);
    else steering *= Math.pow(0.05, dt);

    distance += speed * dt / 3.6;

    // Обновление интерфейса
    $('speed').textContent = Math.round(speed);
    $('rpm').textContent = Math.round(rpm);
    $('rpmBar').style.width = (rpm / 6500 * 100) + '%';

    $('gearDisplay').textContent =
        transmission === 'manual' ? gear : autoGear;

    if (speed > 50) {
        if (lessonTimer <= 0) {
            instructor('Внимание! Ты превысила ограничение скорости 50 км/ч.');
            lessonTimer = 4;
        }
    }

    lessonTimer = Math.max(0, lessonTimer - dt);

    // Вращение руля
    if (steeringWheel) {
        steeringWheel.rotation.z = -steering * 0.65;
    }

    // Наклон камеры
    camera.rotation.z = -steering * 0.025;
    camera.position.x += (steering * Math.min(speed / 45, 0.8) * 0.4 - camera.position.x) * dt * 2;
}

// ========================================
// ДВИЖЕНИЕ МИРА
// ========================================

function updateWorld(dt) {
    const direction =
        transmission === 'manual'
            ? (gear === 'R' ? -1 : 1)
            : (autoGear === 'R' ? -1 : 1);

    const movement = speed * direction * dt / 3.6;

    roadMarks.forEach(mark => {
        mark.position.z += movement;

        if (mark.position.z > 8) {
            mark.position.z -= 288;
        }

        if (mark.position.z < -290) {
            mark.position.z += 288;
        }
    });

    trees.forEach(tree => {
        tree.position.z += movement;

        if (tree.position.z > 12) {
            tree.position.z -= 210;
        }
    });

    signs.forEach(sign => {
        sign.position.z += movement;

        if (sign.position.z > 10) {
            sign.position.z -= 210;
        }
    });

    trafficCars.forEach(car => {
        car.mesh.position.z += movement - car.baseSpeed * dt / 3.6;

        if (car.mesh.position.z > 12) {
            car.mesh.position.z = -180 - Math.random() * 60;
            car.mesh.position.x = Math.random() > 0.5 ? -2.2 : 2.2;
        }

        if (car.mesh.position.z < -240) {
            car.mesh.position.z = -160;
        }
    });

    // Небольшой наклон при повороте
    if (camera) {
        camera.position.x += steering * speed * dt * 0.006;
        camera.position.x = clamp(camera.position.x, -1.1, 1.1);
    }
}

// ========================================
// ОБНОВЛЕНИЕ КАДРА
// ========================================

function animate() {
    requestAnimationFrame(animate);

    if (!started || game.classList.contains('hidden')) return;

    const dt = Math.min(clock.getDelta(), 0.05);

    updatePhysics(dt);
    updateWorld(dt);
    updateIndicators();
    updateSignalButtons();

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ========================================
// ИЗМЕНЕНИЕ РАЗМЕРА ОКНА
// ========================================

function onResize() {
    if (!camera || !renderer) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
}
