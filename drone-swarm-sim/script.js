// Конфигурация и состояние
const defaultParams = {
    droneCount: 50,
    separationWeight: 1.5,
    alignmentWeight: 1.0,
    cohesionWeight: 1.0,
    mouseAttraction: 2.0,
    maxSpeed: 4.0,
    perceptionRadius: 50,
    droneSize: 4,
    trailLength: 20
};

const params = { ...defaultParams };
const mouse = { x: 0, y: 0, active: false };
const drones = [];
let canvas, ctx, animationId;
let lastTime = performance.now();
let frameCount = 0;
let fps = 0;

// Класс дрона
class Drone {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.ax = 0;
        this.ay = 0;
        this.trail = [];
    }

    update(drones) {
        // Найти соседей в радиусе восприятия
        const neighbors = [];
        for (let other of drones) {
            if (other === this) continue;
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < params.perceptionRadius) {
                neighbors.push({ drone: other, dist, dx, dy });
            }
        }

        // Сбросить ускорение
        this.ax = 0;
        this.ay = 0;

        if (neighbors.length > 0) {
            // Разделение: избегать скопления
            let sepX = 0, sepY = 0;
            let alignX = 0, alignY = 0;
            let cohX = 0, cohY = 0;

            for (let n of neighbors) {
                // Разделение
                if (n.dist > 0 && n.dist < 25) {
                    sepX -= n.dx / n.dist;
                    sepY -= n.dy / n.dist;
                }

                // Выравнивание
                alignX += n.drone.vx;
                alignY += n.drone.vy;

                // Сплоченность
                cohX += n.drone.x;
                cohY += n.drone.y;
            }

            const count = neighbors.length;

            // Усреднить и применить веса
            if (params.separationWeight > 0) {
                sepX = (sepX / count) * params.separationWeight;
                sepY = (sepY / count) * params.separationWeight;
                this.ax += sepX;
                this.ay += sepY;
            }

            if (params.alignmentWeight > 0) {
                alignX = (alignX / count - this.vx) * params.alignmentWeight * 0.1;
                alignY = (alignY / count - this.vy) * params.alignmentWeight * 0.1;
                this.ax += alignX;
                this.ay += alignY;
            }

            if (params.cohesionWeight > 0) {
                cohX = (cohX / count - this.x) * params.cohesionWeight * 0.01;
                cohY = (cohY / count - this.y) * params.cohesionWeight * 0.01;
                this.ax += cohX;
                this.ay += cohY;
            }
        }

        // Притяжение к курсору
        if (mouse.active && params.mouseAttraction > 0) {
            const dx = mouse.x - this.x;
            const dy = mouse.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                this.ax += (dx / dist) * params.mouseAttraction * 0.1;
                this.ay += (dy / dist) * params.mouseAttraction * 0.1;
            }
        }

        // Обновить скорость
        this.vx += this.ax;
        this.vy += this.ay;

        // Ограничить скорость
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > params.maxSpeed) {
            this.vx = (this.vx / speed) * params.maxSpeed;
            this.vy = (this.vy / speed) * params.maxSpeed;
        }

        // Обновить след
        if (params.trailLength > 0) {
            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > params.trailLength) {
                this.trail.shift();
            }
        } else {
            this.trail = [];
        }

        // Обновить позицию
        this.x += this.vx;
        this.y += this.vy;

        // Перенос по краям
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }

    draw(ctx) {
        // Нарисовать след
        if (this.trail.length > 1) {
            ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }

        // Нарисовать дрон как треугольник, указывающий в направлении движения
        const angle = Math.atan2(this.vy, this.vx);
        const size = params.droneSize;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);

        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.moveTo(size * 2, 0);
        ctx.lineTo(-size, -size);
        ctx.lineTo(-size, size);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// Инициализация
function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    // Создать начальных дронов
    createDrones(params.droneCount);

    // Настроить обработчики событий
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseenter', () => mouse.active = true);
    canvas.addEventListener('mouseleave', () => mouse.active = false);

    setupControls();
    animate();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
}

function createDrones(count) {
    while (drones.length < count) {
        drones.push(new Drone(
            Math.random() * canvas.width,
            Math.random() * canvas.height
        ));
    }
    while (drones.length > count) {
        drones.pop();
    }
}

// Цикл анимации
function animate(currentTime = performance.now()) {
    // Вычислить FPS
    frameCount++;
    if (currentTime - lastTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;
        document.getElementById('fps').textContent = `FPS: ${fps}`;
    }

    // Очистить холст
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Обновить и нарисовать дронов
    for (let drone of drones) {
        drone.update(drones);
        drone.draw(ctx);
    }

    animationId = requestAnimationFrame(animate);
}

// Настройка панели управления
function setupControls() {
    // Количество дронов
    const droneCountSlider = document.getElementById('droneCount');
    const droneCountValue = document.getElementById('droneCountValue');
    droneCountSlider.addEventListener('input', (e) => {
        params.droneCount = parseInt(e.target.value);
        droneCountValue.textContent = params.droneCount;
        createDrones(params.droneCount);
    });

    // Максимальная скорость
    const maxSpeedSlider = document.getElementById('maxSpeed');
    const maxSpeedValue = document.getElementById('maxSpeedValue');
    maxSpeedSlider.addEventListener('input', (e) => {
        params.maxSpeed = parseFloat(e.target.value);
        maxSpeedValue.textContent = params.maxSpeed.toFixed(1);
    });

    // Радиус восприятия
    const perceptionRadiusSlider = document.getElementById('perceptionRadius');
    const perceptionRadiusValue = document.getElementById('perceptionRadiusValue');
    perceptionRadiusSlider.addEventListener('input', (e) => {
        params.perceptionRadius = parseInt(e.target.value);
        perceptionRadiusValue.textContent = params.perceptionRadius;
    });

    // Вес разделения
    const separationWeightSlider = document.getElementById('separationWeight');
    const separationWeightValue = document.getElementById('separationWeightValue');
    separationWeightSlider.addEventListener('input', (e) => {
        params.separationWeight = parseFloat(e.target.value);
        separationWeightValue.textContent = params.separationWeight.toFixed(1);
    });

    // Вес выравнивания
    const alignmentWeightSlider = document.getElementById('alignmentWeight');
    const alignmentWeightValue = document.getElementById('alignmentWeightValue');
    alignmentWeightSlider.addEventListener('input', (e) => {
        params.alignmentWeight = parseFloat(e.target.value);
        alignmentWeightValue.textContent = params.alignmentWeight.toFixed(1);
    });

    // Вес сплоченности
    const cohesionWeightSlider = document.getElementById('cohesionWeight');
    const cohesionWeightValue = document.getElementById('cohesionWeightValue');
    cohesionWeightSlider.addEventListener('input', (e) => {
        params.cohesionWeight = parseFloat(e.target.value);
        cohesionWeightValue.textContent = params.cohesionWeight.toFixed(1);
    });

    // Притяжение к курсору
    const mouseAttractionSlider = document.getElementById('mouseAttraction');
    const mouseAttractionValue = document.getElementById('mouseAttractionValue');
    mouseAttractionSlider.addEventListener('input', (e) => {
        params.mouseAttraction = parseFloat(e.target.value);
        mouseAttractionValue.textContent = params.mouseAttraction.toFixed(1);
    });

    // Размер дрона
    const droneSizeSlider = document.getElementById('droneSize');
    const droneSizeValue = document.getElementById('droneSizeValue');
    droneSizeSlider.addEventListener('input', (e) => {
        params.droneSize = parseInt(e.target.value);
        droneSizeValue.textContent = params.droneSize;
    });

    // Длина следа
    const trailLengthSlider = document.getElementById('trailLength');
    const trailLengthValue = document.getElementById('trailLengthValue');
    trailLengthSlider.addEventListener('input', (e) => {
        params.trailLength = parseInt(e.target.value);
        trailLengthValue.textContent = params.trailLength;
    });

    // Кнопка сброса
    document.getElementById('resetBtn').addEventListener('click', resetParameters);

    // Кнопки переключения панели
    const controlPanel = document.getElementById('controlPanel');
    const toggleBtn = document.getElementById('toggleBtn');
    const closeBtn = document.getElementById('closeBtn');

    closeBtn.addEventListener('click', () => {
        controlPanel.classList.add('hidden');
        toggleBtn.classList.remove('hidden');
    });

    toggleBtn.addEventListener('click', () => {
        controlPanel.classList.remove('hidden');
        toggleBtn.classList.add('hidden');
    });
}

function resetParameters() {
    // Сбросить все параметры
    Object.assign(params, defaultParams);

    // Обновить слайдеры
    document.getElementById('droneCount').value = params.droneCount;
    document.getElementById('droneCountValue').textContent = params.droneCount;
    document.getElementById('maxSpeed').value = params.maxSpeed;
    document.getElementById('maxSpeedValue').textContent = params.maxSpeed.toFixed(1);
    document.getElementById('perceptionRadius').value = params.perceptionRadius;
    document.getElementById('perceptionRadiusValue').textContent = params.perceptionRadius;
    document.getElementById('separationWeight').value = params.separationWeight;
    document.getElementById('separationWeightValue').textContent = params.separationWeight.toFixed(1);
    document.getElementById('alignmentWeight').value = params.alignmentWeight;
    document.getElementById('alignmentWeightValue').textContent = params.alignmentWeight.toFixed(1);
    document.getElementById('cohesionWeight').value = params.cohesionWeight;
    document.getElementById('cohesionWeightValue').textContent = params.cohesionWeight.toFixed(1);
    document.getElementById('mouseAttraction').value = params.mouseAttraction;
    document.getElementById('mouseAttractionValue').textContent = params.mouseAttraction.toFixed(1);
    document.getElementById('droneSize').value = params.droneSize;
    document.getElementById('droneSizeValue').textContent = params.droneSize;
    document.getElementById('trailLength').value = params.trailLength;
    document.getElementById('trailLengthValue').textContent = params.trailLength;

    // Пересоздать дронов
    createDrones(params.droneCount);
}

// Запустить приложение
init();