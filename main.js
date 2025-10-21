// ===================================
// تهيئة المشهد والإعدادات الأساسية
// ===================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// الإضاءة
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

// الأرضية
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ===================================
// إعدادات اللاعب
// ===================================
const playerGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 16);
const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x3498db });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 1, 15);
player.castShadow = true;
scene.add(player);

let playerHealth = 100;
const PLAYER_MAX_HEALTH = 100;
const PLAYER_SPEED = 5;

// ===================================
// إعدادات الوحش
// ===================================
const monsterGeometry = new THREE.BoxGeometry(2, 4, 2);
const monsterMaterial = new THREE.MeshStandardMaterial({ color: 0xe74c3c });
const monster = new THREE.Mesh(monsterGeometry, monsterMaterial);
monster.position.set(0, 2, -10);
monster.castShadow = true;
scene.add(monster);

let monsterHealth = 200;
const MONSTER_MAX_HEALTH = 200;
const MONSTER_SPEED = 2.5;
let monsterState = 'IDLE'; // 'IDLE', 'CHASING', 'ATTACKING'
const MONSTER_ATTACK_RANGE = 3;
const MONSTER_AGGRO_RANGE = 20;
let monsterAttackCooldown = 0;

// ===================================
// إعدادات التحكم والقتال
// ===================================
const keys = {};
const projectiles = [];
let healCooldown = 0;
const HEAL_AMOUNT = 20;

document.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

const attack1Btn = document.getElementById('attack1-btn');
const attack2Btn = document.getElementById('attack2-btn');

// الهجوم الأول: كرة نارية
attack1Btn.addEventListener('click', () => {
    const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
    
    const startPos = player.position.clone();
    startPos.y = 1.5; // تظهر من منتصف اللاعب
    projectile.position.copy(startPos);

    const direction = new THREE.Vector3();
    monster.getWorldPosition(direction);
    direction.sub(player.position).normalize();
    
    projectile.velocity = direction.multiplyScalar(15);
    projectiles.push(projectile);
    scene.add(projectile);
});

// الهجوم الثاني: علاج
attack2Btn.addEventListener('click', () => {
    if (healCooldown <= 0) {
        playerHealth = Math.min(PLAYER_MAX_HEALTH, playerHealth + HEAL_AMOUNT);
        healCooldown = 5; // 5 ثواني انتظار
        
        // تأثير بصري للعلاج
        const healEffect = new THREE.PointLight(0x4caf50, 5, 5);
        healEffect.position.copy(player.position);
        scene.add(healEffect);
        setTimeout(() => scene.remove(healEffect), 500);
    }
});


// ===================================
// عناصر الواجهة الرسومية (UI)
// ===================================
const playerHealthFill = document.getElementById('player-health-fill');
const monsterHealthFill = document.getElementById('monster-health-fill');
const gameOverScreen = document.getElementById('game-over-screen');
const endMessage = document.getElementById('end-message');
const restartBtn = document.getElementById('restart-btn');

restartBtn.addEventListener('click', () => window.location.reload());

// ===================================
// حلقة اللعبة الرئيسية (Game Loop)
// ===================================
const clock = new THREE.Clock();
let isGameOver = false;

function animate() {
    if (isGameOver) return;

    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    // -- تحديث حركة اللاعب --
    const moveDirection = new THREE.Vector3();
    if (keys['w']) moveDirection.z -= 1;
    if (keys['s']) moveDirection.z += 1;
    if (keys['a']) moveDirection.x -= 1;
    if (keys['d']) moveDirection.x += 1;
    
    if (moveDirection.length() > 0) {
        moveDirection.normalize().multiplyScalar(PLAYER_SPEED * deltaTime);
        player.position.add(moveDirection);
    }

    // -- تحديث حركة الكاميرا --
    camera.position.x = player.position.x;
    camera.position.y = player.position.y + 10;
    camera.position.z = player.position.z + 12;
    camera.lookAt(player.position);

    // -- تحديث المقذوفات (كرات النار) --
    projectiles.forEach((p, index) => {
        p.position.add(p.velocity.clone().multiplyScalar(deltaTime));

        // التحقق من الاصطدام بالوحش
        if (p.position.distanceTo(monster.position) < 2) {
            monsterHealth -= 15;
            scene.remove(p);
            projectiles.splice(index, 1);

            // تأثير بصري للاصطدام
            monster.material.color.set(0xffffff);
            setTimeout(() => monster.material.color.set(0xe74c3c), 100);
        }

        // إزالة المقذوفات البعيدة
        if (p.position.distanceTo(player.position) > 100) {
            scene.remove(p);
            projectiles.splice(index, 1);
        }
    });

    // -- تحديث الذكاء الاصطناعي للوحش --
    const distanceToPlayer = player.position.distanceTo(monster.position);
    
    if (distanceToPlayer <= MONSTER_ATTACK_RANGE) {
        monsterState = 'ATTACKING';
    } else if (distanceToPlayer <= MONSTER_AGGRO_RANGE) {
        monsterState = 'CHASING';
    } else {
        monsterState = 'IDLE';
    }

    if (monsterState === 'CHASING') {
        const direction = player.position.clone().sub(monster.position).normalize();
        monster.position.add(direction.multiplyScalar(MONSTER_SPEED * deltaTime));
        monster.lookAt(player.position);
    }
    
    if (monsterState === 'ATTACKING') {
        monster.lookAt(player.position);
        monsterAttackCooldown -= deltaTime;
        if (monsterAttackCooldown <= 0) {
            playerHealth -= 10;
            monsterAttackCooldown = 2; // يهاجم كل ثانيتين
             // تأثير بصري لهجوم الوحش
            player.material.color.set(0xff0000);
            setTimeout(() => player.material.color.set(0x3498db), 100);
        }
    }
    
    // -- تحديث Cooldowns --
    if (healCooldown > 0) healCooldown -= deltaTime;
    
    // -- تحديث واجهة المستخدم --
    playerHealthFill.style.width = `${(playerHealth / PLAYER_MAX_HEALTH) * 100}%`;
    monsterHealthFill.style.width = `${(monsterHealth / MONSTER_MAX_HEALTH) * 100}%`;

    // -- التحقق من نهاية اللعبة --
    if (monsterHealth <= 0) {
        endMessage.textContent = '🎉 لقد انتصرت! 🎉';
        endMessage.style.color = '#2ecc71';
        gameOverScreen.classList.remove('hidden');
        isGameOver = true;
    }
    
    if (playerHealth <= 0) {
        endMessage.textContent = 'GAME OVER';
        endMessage.style.color = '#e74c3c';
        gameOverScreen.classList.remove('hidden');
        isGameOver = true;
    }

    renderer.render(scene, camera);
}

// بدء اللعبة
animate();

// تعديل حجم الشاشة عند تغيير حجم النافذة
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
