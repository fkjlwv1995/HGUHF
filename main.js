document.addEventListener('DOMContentLoaded', function() {
  const ACTIVE_SESSION_KEY = 'weblinActiveGameSession_v2';
  const currentSessionId = 'sess_' + Date.now() + Math.random().toString(16).slice(2);
  const activeSessionMessageDiv = document.getElementById('activeSessionMessage');
  let sessionCheckTimeout;

  function checkSession() {
    const existingSession = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (existingSession && existingSession !== currentSessionId) {
        try {
            const sessionData = JSON.parse(existingSession);
            if (sessionData && (Date.now() - sessionData.timestamp < 120000)) {
                activeSessionMessageDiv.style.display = 'flex';
                document.getElementById('authModal').style.display = 'none';
                return true;
            } else { localStorage.removeItem(ACTIVE_SESSION_KEY); }
        } catch (e) { localStorage.removeItem(ACTIVE_SESSION_KEY); }
    }
    return false;
  }

  if (checkSession()) { return; }

  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ id: currentSessionId, timestamp: Date.now() }));
  sessionCheckTimeout = setInterval(() => {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ id: currentSessionId, timestamp: Date.now() }));
  }, 60000);

  window.addEventListener('beforeunload', () => {
      clearInterval(sessionCheckTimeout);
      if(currencyInterval) clearInterval(currencyInterval);
      if(fishingInterval) clearInterval(fishingInterval);
      if(fishingEventInterval) clearInterval(fishingEventInterval);
      const storedSession = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (storedSession) {
          try {
            const sessionData = JSON.parse(storedSession);
            if (sessionData.id === currentSessionId) { localStorage.removeItem(ACTIVE_SESSION_KEY); }
          } catch (e) { /* ignore */ }
      }
      if (localPlayerRef) {
        if (localPlayerCurrentRoomId) {
            updateActiveRoomPlayerCount(localPlayerCurrentRoomId, null, false);
        }
        localPlayerRef.remove().catch(err => console.warn("Error removing player on beforeunload:", err));
      }
  });

  const firebaseConfig = {
    apiKey: "AIzaSyDwN2wGMZIKhEPgEW9sMofCxlrm2BvBL90",
    authDomain: "chat-ff274.firebaseapp.com",
    databaseURL: "https://chat-ff274-default-rtdb.firebaseio.com",
    projectId: "chat-ff274",
    storageBucket: "chat-ff274.appspot.com",
    messagingSenderId: "851944863055",
    appId: "1:851944863055:web:3572ddcdc636dccc11c13a",
    measurementId: "G-X8QW3RY4FK"
  };
  if (!firebase.apps.length) try { firebase.initializeApp(firebaseConfig); } catch (e) { console.error("Firebase init error:", e); return; }
  const database = firebase.database();
  const auth = firebase.auth();
  
  const npcs = [
    {
        id: 'npc_avatar_shop',
        name: 'متجر الأفاتارات 👕',
        x: 1500, y: 1000,
        width: 220, height: 330,
        imageUrl: 'https://i.imgur.com/ndqT7ML.gif',
        minimapColor: '#00FFFF',
        interactionRadius: 300,
        shopUrl: 'https://puipoipiopi.blogspot.com/2025/10/blog-post_17.html',
        promptText: 'شراء أفاتار'
    },
    {
        id: 'npc_pet_shop',
        name: 'متجر الحيوانات الأليفة 🐾',
        x: 2500, y: 1000,
        width: 220, height: 330,
        imageUrl: 'https://i.imgur.com/zLZ6lVB.gif',
        minimapColor: '#FFD700',
        interactionRadius: 300,
        shopUrl: 'https://puipoipiopi.blogspot.com/2025/10/blog-post_18.html',
        promptText: 'شراء حيوان أليف'
    },
    {
        id: 'npc_title_shop',
        name: 'متجر الألقاب 👑',
        x: 500, y: 1500,
        width: 220, height: 330,
        imageUrl: 'https://i.imgur.com/QQR24uw.gif',
        minimapColor: '#9B59B6',
        interactionRadius: 300,
        shopUrl: 'https://puipoipiopi.blogspot.com/2025/10/blog-post_20.html',
        promptText: 'شراء لقب'
    }
  ];

  let localPlayerAvatarUrl = 'https://cdn.everskies.com/render/WzBd.png?a=1';
  let currencyInterval = null;

  let localPlayerId = null, localPlayerName = "لاعب";
  let localPlayerRef = null, pageUsersRef = null;

  function sanitizeFirebaseKey(text) { return text.replace(/[.#$[\]\/]/g, '_'); }
  let currentPageId = sanitizeFirebaseKey(window.location.pathname + window.location.search || 'homepage_main_world');
  document.body.setAttribute('data-page-id', currentPageId);
  const mainWorldPageId = currentPageId;
  let localPlayerCurrentRoomId = null;
  let currentInvitationData = null;
  let localPlayerUiInitialized = false;
  const ADMIN_MONITOR_CODE = "superadmin";
  let isMonitoringRooms = false;
  const roomsMonitorListElement = document.createElement('ul');
  roomsMonitorListElement.id = 'roomsMonitorList';
  roomsMonitorListElement.style.display = 'none';

  const gameArea = document.getElementById('weblinGameArea');
  const WORLD_WIDTH = 3000, WORLD_HEIGHT = 2000;
  gameArea.style.width = WORLD_WIDTH + 'px'; gameArea.style.height = WORLD_HEIGHT + 'px';

  let localPlayerX = Math.floor(Math.random() * (WORLD_WIDTH - 100)) + 50;
  let localPlayerY = Math.floor(Math.random() * (WORLD_HEIGHT - 100)) + 50;
  const DEFAULT_PLAYER_SPEED = 3;
  const activePlayers = {};
  let cameraX = 0, cameraY = 0; const CAMERA_SMOOTHING = 0.08;

  const settingsBtn = document.getElementById('settingsBtn');
  const secretCodeModal = document.getElementById('secretCodeModal');
  const chatInput = document.getElementById('localWeblinEntry');
  const sendChatBtn = document.getElementById('localWeblinSendBtn');
  const emoteBtn = document.getElementById('emoteBtn');
  const emotePicker = document.getElementById('emotePicker');
  const playerListElement = document.getElementById('playerList');
  const minimapContainer = document.getElementById('minimapContainer');
  const secretCodeInput = document.getElementById('secretCodeInput');
  const submitSecretCodeBtn = document.getElementById('submitSecretCodeBtn');
  const closeSecretCodeModalBtn = document.getElementById('closeSecretCodeModalBtn');
  const secretCodeStatus = document.getElementById('secretCodeStatus');
  const cancelFollowBtn = document.getElementById('cancelFollowBtn');
  const gameSidebar = document.getElementById('gameSidebar');
  const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
  const rotateDeviceBtn = document.getElementById('rotateDeviceBtn');
  const targetSelectorModal = document.getElementById('targetSelectorModal');
  const targetSelectorTitle = document.getElementById('targetSelectorTitle');
  const targetPlayerList = document.getElementById('targetPlayerList');
  const closeTargetSelectorModalBtn = document.getElementById('closeTargetSelectorModalBtn');
  const joystickContainer = document.getElementById('virtualJoystickContainer');
  const joystickKnob = document.getElementById('joystickKnob');
  let joystickActive = false;
  let joystickKnobX = 0, joystickKnobY = 0;
  const joystickMaxDistance = joystickContainer.offsetWidth / 2 - joystickKnob.offsetWidth / 2;
  const currentRoomIndicator = document.getElementById('currentRoomIndicator');
  const roomIndicatorText = document.getElementById('roomIndicatorText');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const invitationModal = document.getElementById('invitationModal');
  const invitationModalText = document.getElementById('invitationModalText');
  const acceptInvitationBtn = document.getElementById('acceptInvitationBtn');
  const declineInvitationBtn = document.getElementById('declineInvitationBtn');
  const myRoomBtn = document.getElementById('myRoomBtn');
  const closeNpcShopModalBtn = document.getElementById('closeNpcShopModalBtn');
  const transferCurrencyModal = document.getElementById('transferCurrencyModal');
  const transferModalTitle = document.getElementById('transferModalTitle');
  const transferAmountInput = document.getElementById('transferAmountInput');
  const transferStatus = document.getElementById('transferStatus');
  const confirmTransferBtn = document.getElementById('confirmTransferBtn');
  const cancelTransferBtn = document.getElementById('cancelTransferBtn');
  let transferTarget = { id: null, name: null };

  const portals = [];
  const PORTAL_ACTIVATION_TIME = 2500;
  let playerInsidePortalSince = null, currentActivePortalId = null, isTransitioningPortal = false;
  const IDLE_TIMEOUT_DURATION = 120000, PLAYER_ACTIVITY_CHECK_INTERVAL = 2500;
  const MAX_RECENT_MESSAGES = 3, BUBBLE_TIMEOUT_DURATION = 7000, HISTORICAL_BUBBLE_TIMEOUT_MODIFIER = 0.7;

  const SECRET_CODE_VALUE = "01001000123";
  const CURRENCY_CODE = "givemecash1000"; 
  let secretCodeUnlocked = false;
  let currentlyFollowingPlayerId = null;

  const fishingStatusIndicator = document.getElementById('fishingStatusIndicator');
  const FISHING_ZONE = { x: 0, y: 0, width: WORLD_WIDTH, height: 250 };
  const FISHING_DURATION = 60;
  let fishingInterval = null;
  let fishingCountdown = FISHING_DURATION;
  
  const FISHING_EVENT_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  let isFishingActive = false;
  let fishingEventInterval = null;
  
  const availableEmotes = ['😀', '😂', '😍', '🤔', '😭', '😮', '👍', '👎', '❤️', '🎉', '👋', '👀', '🔥', '💯', '🙏', '🥳', '🤯', '😴', '💰', '🚀', '🌟', '💡', '👻', '💀', '👽', '🤖', '👑', '💎'];
  availableEmotes.forEach(emoji => {
      const span = document.createElement('span'); span.textContent = emoji;
      span.addEventListener('click', () => { sendEmote(emoji); emotePicker.classList.remove('show'); });
      emotePicker.appendChild(span);
  });
  emoteBtn.addEventListener('click', (event) => {
      event.stopPropagation(); emotePicker.classList.toggle('show');
      const btnRect = emoteBtn.getBoundingClientRect();
      const pickerWidth = emotePicker.offsetWidth;
      emotePicker.style.left = Math.max(0, Math.min(window.innerWidth - pickerWidth, btnRect.left - (pickerWidth / 2) + (btnRect.width / 2))) + 'px';
      emotePicker.style.bottom = (window.innerHeight - btnRect.top + 10) + 'px';
  });
  document.body.addEventListener('click', (event) => {
      if (emotePicker.classList.contains('show') && !emotePicker.contains(event.target) && event.target !== emoteBtn) {
          emotePicker.classList.remove('show');
      }
      if (window.innerWidth <= 768 && gameSidebar.classList.contains('show') && !gameSidebar.contains(event.target) && event.target !== toggleSidebarBtn) {
          gameSidebar.classList.remove('show');
      }
  });
  function sendEmote(emoji) {
      if (localPlayerRef && !isTransitioningPortal) { localPlayerRef.update({ emote: emoji, lastEmoteTime: firebase.database.ServerValue.TIMESTAMP,
            lastActivityTime: firebase.database.ServerValue.TIMESTAMP });
      if (activePlayers[localPlayerId] && activePlayers[localPlayerId].data) {
            showPlayerEmote(activePlayers[localPlayerId].ui, emoji);
            activePlayers[localPlayerId].data.lastActivityTime = Date.now();
            if(activePlayers[localPlayerId].ui.avatarImg) activePlayers[localPlayerId].ui.avatarImg.classList.remove('idle'); } }
  }

// ===============================================
// ==   منطق المصادقة وبدء اللعبة الجديد   ==
// ===============================================

const authModal = document.getElementById('authModal');
const authTitle = document.getElementById('authTitle');
const authError = document.getElementById('authError');
const authNameInput = document.getElementById('authNameInput');
const authEmailInput = document.getElementById('authEmailInput');
const authPasswordInput = document.getElementById('authPasswordInput');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const authToggle = document.getElementById('authToggle');
const logoutBtn = document.getElementById('logoutBtn');

let isRegisterMode = false;

authToggle.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    authError.textContent = '';
    if (isRegisterMode) {
        authTitle.textContent = 'تسجيل حساب جديد';
        authNameInput.style.display = 'block';
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'block';
        authToggle.textContent = 'لديك حساب بالفعل؟ سجل الدخول';
    } else {
        authTitle.textContent = 'تسجيل الدخول';
        authNameInput.style.display = 'none';
        loginBtn.style.display = 'block';
        registerBtn.style.display = 'none';
        authToggle.textContent = 'ليس لديك حساب؟ سجل الآن';
    }
});

registerBtn.addEventListener('click', () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;
    const name = authNameInput.value.trim();

    if (!name || !email || !password) {
        authError.textContent = 'يرجى ملء جميع الحقول.';
        return;
    }
    if (password.length < 6) {
        authError.textContent = 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.';
        return;
    }

    authError.textContent = '';
    registerBtn.disabled = true;
    registerBtn.textContent = 'جاري التسجيل...';

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            const initialPlayerData = {
                name: name.substring(0, 10),
                x: Math.floor(Math.random() * (WORLD_WIDTH - 100)) + 50,
                y: Math.floor(Math.random() * (WORLD_HEIGHT - 100)) + 50,
                avatarUrl: 'https://cdn.everskies.com/render/WzBd.png?a=1',
                currency: 10,
                activePet: null,
                activeTitle: null,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            };
            database.ref(`players_data/${user.uid}`).set(initialPlayerData);
        })
        .catch((error) => {
            if (error.code === 'auth/email-already-in-use') {
                authError.textContent = 'هذا البريد الإلكتروني مسجل بالفعل.';
            } else {
                authError.textContent = 'حدث خطأ. حاول مرة أخرى.';
            }
            console.error("Register Error:", error);
            registerBtn.disabled = false;
            registerBtn.textContent = '📝 تسجيل حساب جديد';
        });
});

loginBtn.addEventListener('click', () => {
    const email = authEmailInput.value;
    const password = authPasswordInput.value;

    if (!email || !password) {
        authError.textContent = 'يرجى إدخال البريد وكلمة المرور.';
        return;
    }
    
    authError.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'جاري الدخول...';

    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            authError.textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
            console.error("Login Error:", error);
            loginBtn.disabled = false;
            loginBtn.textContent = '🔑 تسجيل الدخول';
        });
});

logoutBtn.addEventListener('click', () => {
    if (confirm("هل أنت متأكد من أنك تريد تسجيل الخروج؟")) {
        secretCodeModal.classList.remove('show');
        auth.signOut();
    }
});

auth.onAuthStateChanged(user => {
    if (user) {
        authModal.classList.remove('show');
        localPlayerId = user.uid;
        initializeGameForUser(user);
    } else {
        if (localPlayerRef) localPlayerRef.remove();
        Object.keys(activePlayers).forEach(pId => handlePlayerRemoved({key: pId}));
        localPlayerId = null;
        localPlayerRef = null;
        authModal.classList.add('show');
        if(currencyInterval) clearInterval(currencyInterval);
        if(fishingInterval) clearInterval(fishingInterval);
        if(fishingEventInterval) clearInterval(fishingEventInterval);
        loginBtn.disabled = false;
        loginBtn.textContent = '🔑 تسجيل الدخول';
        registerBtn.disabled = false;
        registerBtn.textContent = '📝 تسجيل حساب جديد';
    }
});

async function initializeGameForUser(user) {
    const playerDataSnapshot = await database.ref(`players_data/${user.uid}`).once('value');
    if (playerDataSnapshot.exists()) {
        const playerData = playerDataSnapshot.val();
        localPlayerName = playerData.name;
        localPlayerAvatarUrl = playerData.avatarUrl;
        
        localPlayerX = playerData.x || Math.floor(Math.random() * (WORLD_WIDTH - 100)) + 50;
        localPlayerY = playerData.y || Math.floor(Math.random() * (WORLD_HEIGHT - 100)) + 50;
        
        initializeGame(playerData);

        const playerPermanentDataRef = database.ref(`players_data/${user.uid}`);
        playerPermanentDataRef.child('currency').on('value', (snapshot) => {
            const newAmount = snapshot.val() || 0;
            updateCurrencyUI(newAmount);
            if (activePlayers[localPlayerId]?.data) {
                activePlayers[localPlayerId].data.currency = newAmount;
            }
        });
        
    } else {
         console.error("بيانات اللاعب غير موجودة! سيتم إنشاء بيانات افتراضية.");
         localPlayerName = "لاعب جديد";
         initializeGame({});
    }
}


  settingsBtn.addEventListener('click', () => {
      secretCodeInput.value = ''; secretCodeStatus.textContent = '';
      secretCodeModal.classList.add('show');
  });
  closeSecretCodeModalBtn.addEventListener('click', () => {
      secretCodeModal.classList.remove('show');
  });

  submitSecretCodeBtn.addEventListener('click', () => {
    const enteredCode = secretCodeInput.value.trim();
    const sidebar = document.getElementById('gameSidebar');
    let monitorTitleElement = document.getElementById('monitorTitle');

    if (enteredCode === ADMIN_MONITOR_CODE) {
        isMonitoringRooms = !isMonitoringRooms;
        secretCodeStatus.textContent = isMonitoringRooms ? '👁️ وضع مراقبة الغرف مفعل!' : '👁️ وضع مراقبة الغرف معطل.';
        secretCodeStatus.style.color = isMonitoringRooms ? '#3498db' : '#7f8c8d';

        if (isMonitoringRooms) {
            if (sidebar && !monitorTitleElement) {
                monitorTitleElement = document.createElement('h3');
                monitorTitleElement.textContent = "الغرف المراقبة 👁️";
                monitorTitleElement.id = "monitorTitle";
                const refElement = document.getElementById('cancelFollowBtn') || sidebar.lastElementChild;
                if (refElement) sidebar.insertBefore(monitorTitleElement, refElement); else sidebar.appendChild(monitorTitleElement);
            }
            if (sidebar && !sidebar.contains(roomsMonitorListElement)) {
                 if (monitorTitleElement && monitorTitleElement.nextSibling) sidebar.insertBefore(roomsMonitorListElement, monitorTitleElement.nextSibling);
                 else sidebar.appendChild(roomsMonitorListElement);
            }
            if(monitorTitleElement) monitorTitleElement.style.display = 'block';
            roomsMonitorListElement.style.display = 'block';
            displayMonitoredRooms();
        } else {
            if(monitorTitleElement) monitorTitleElement.style.display = 'none';
            roomsMonitorListElement.style.display = 'none';
            roomsMonitorListElement.innerHTML = '';
            const activeRoomsRef = database.ref('active_rooms');
            activeRoomsRef.off('value');
        }
    } else if (enteredCode === SECRET_CODE_VALUE) {
        secretCodeUnlocked = true; secretCodeStatus.textContent = '🎉 تم فتح ميزات المتابعة!';
        secretCodeStatus.style.color = '#2ecc71'; updatePlayerListStyling();
    } else if (enteredCode === CURRENCY_CODE) { 
        const playerPermanentDataRef = database.ref(`players_data/${localPlayerId}`);
        playerPermanentDataRef.child('currency').transaction((currentCurrency) => {
            return (currentCurrency || 0) + 1000;
        }).then(() => {
            secretCodeStatus.textContent = '🎉 تم إضافة 1000 عملة!';
            secretCodeStatus.style.color = '#2ecc71';
        }).catch((error) => {
            secretCodeStatus.textContent = '⚠️ فشل تحديث العملات.';
            secretCodeStatus.style.color = '#e74c3c';
        });
    } else if (enteredCode) {
         secretCodeStatus.textContent = '⚠️ كود خاطئ.'; secretCodeStatus.style.color = '#e74c3c';
    }
    secretCodeInput.value = '';
  });
  cancelFollowBtn.addEventListener('click', () => {
      currentlyFollowingPlayerId = null; cancelFollowBtn.style.display = 'none';
      updatePlayerListStyling();
      if(activePlayers[localPlayerId] && activePlayers[localPlayerId].data) {
          cameraX = activePlayers[localPlayerId].data.x - (window.innerWidth / 2);
          cameraY = activePlayers[localPlayerId].data.y - (window.innerHeight / 2);
          applyCameraTransform(); }
  });

  if (toggleSidebarBtn && gameSidebar) {
      toggleSidebarBtn.addEventListener('click', (event) => { event.stopPropagation(); gameSidebar.classList.toggle('show'); });
  }
  if (rotateDeviceBtn) {
      rotateDeviceBtn.addEventListener('click', () => {
          alert('يرجى تدوير جهازك يدويًا. يمكن محاولة وضع ملء الشاشة بعد التدوير.');
      });
  }

  closeTargetSelectorModalBtn.addEventListener('click', () => {
      targetSelectorModal.classList.remove('show');
  });
  targetSelectorModal.addEventListener('click', (event) => {
      if (event.target === targetSelectorModal) {
          targetSelectorModal.classList.remove('show');
      }
  });
  
  closeNpcShopModalBtn.addEventListener('click', () => {
    document.getElementById('npcShopModal').classList.remove('show');
  });

  myRoomBtn.addEventListener('click', () => {
    if (localPlayerCurrentRoomId === `room_${localPlayerId}`) {
        alert("أنت بالفعل في غرفتك!");
        return;
    }
    changeLocation(`room_${localPlayerId}`, localPlayerName);
  });

  leaveRoomBtn.addEventListener('click', () => {
    if (localPlayerCurrentRoomId) {
        changeLocation(mainWorldPageId);
    }
  });

  acceptInvitationBtn.addEventListener('click', () => {
    if (currentInvitationData && currentInvitationData.id && currentInvitationData.roomId) {
        const invitationToProcess = { ...currentInvitationData };
        invitationModal.classList.remove('show');
        currentInvitationData = null;

        database.ref(`invitations/${localPlayerId}/${invitationToProcess.id}`).update({ status: 'accepted' })
            .then(() => {
                changeLocation(invitationToProcess.roomId, invitationToProcess.fromPlayerName);
            })
            .catch(err => {
                console.error("Error accepting invitation:", err);
                alert("حدث خطأ أثناء قبول الدعوة.");
            });
    } else {
        alert("الدعوة لم تعد صالحة.");
        invitationModal.classList.remove('show');
        currentInvitationData = null;
    }
  });

  declineInvitationBtn.addEventListener('click', () => {
    if (currentInvitationData && currentInvitationData.id) {
        const invitationIdToDecline = currentInvitationData.id;
        currentInvitationData = null;
        invitationModal.classList.remove('show');

        database.ref(`invitations/${localPlayerId}/${invitationIdToDecline}`).update({ status: 'declined' })
            .then(() => database.ref(`invitations/${localPlayerId}/${invitationIdToDecline}`).remove())
            .catch(err => console.error("Error declining invitation:", err));
    } else {
        alert("الدعوة لم تعد صالحة.");
        invitationModal.classList.remove('show');
        currentInvitationData = null;
    }
  });
  
  function setupFirebaseReferencesAndListeners() {
    if (pageUsersRef) {
        pageUsersRef.off('child_added', handlePlayerAdded);
        pageUsersRef.off('child_changed', handlePlayerChanged);
        pageUsersRef.off('child_removed', handlePlayerRemoved);
    }

    pageUsersRef = database.ref(`pages_v3/${currentPageId}/players`);
    localPlayerRef = pageUsersRef.child(localPlayerId);

    localPlayerRef.onDisconnect().remove().then(() => {
        if (localPlayerCurrentRoomId) {
            const roomRef = database.ref(`active_rooms/${localPlayerCurrentRoomId}`);
            roomRef.transaction(currentData => {
                if (currentData === null) return null;
                if (currentData.playerCount > 1) return { ...currentData, playerCount: currentData.playerCount - 1, lastActivity: firebase.database.ServerValue.TIMESTAMP };
                else return null;
            });
        }
    });

    pageUsersRef.on('child_added', handlePlayerAdded);
    pageUsersRef.on('child_changed', handlePlayerChanged);
    pageUsersRef.on('child_removed', handlePlayerRemoved);

    console.log("Switched Firebase context to: ", currentPageId);
  }

  async function changeLocation(newLocationId, targetRoomOwnerName = null, newX = null, newY = null) {
    if (isTransitioningPortal) return;
    isTransitioningPortal = true;
    
    const oldRoomId = localPlayerCurrentRoomId;

    if (localPlayerRef) {
        await localPlayerRef.remove().catch(err => console.warn("Error removing player from old location:", err));
    }
    if (oldRoomId) {
        await updateActiveRoomPlayerCount(oldRoomId, null, false);
    }

    Object.keys(activePlayers).forEach(pId => {
        if (pId !== localPlayerId) {
            if (activePlayers[pId] && activePlayers[pId].ui && activePlayers[pId].ui.element) {
                if (gameArea.contains(activePlayers[pId].ui.element)) gameArea.removeChild(activePlayers[pId].ui.element);
                if (minimapContainer.contains(activePlayers[pId].ui.minimapDot)) minimapContainer.removeChild(activePlayers[pId].ui.minimapDot);
                if (activePlayers[pId].ui.bubbleTimeouts) activePlayers[pId].ui.bubbleTimeouts.forEach(clearTimeout);
                clearTimeout(activePlayers[pId].ui.emoteTimeout); clearTimeout(activePlayers[pId].ui.speakingTimeout);
            }
            delete activePlayers[pId];
        }
    });
    updatePlayerListAndMinimap();

    currentPageId = newLocationId;
    document.body.setAttribute('data-page-id', currentPageId);
    localPlayerCurrentRoomId = (currentPageId === mainWorldPageId) ? null : currentPageId;
    setupFirebaseReferencesAndListeners();

    localPlayerX = newX !== null ? newX : Math.floor(Math.random() * (WORLD_WIDTH - 100)) + 50;
    localPlayerY = newY !== null ? newY : Math.floor(Math.random() * (WORLD_HEIGHT - 100)) + 50;

    if (activePlayers[localPlayerId] && activePlayers[localPlayerId].data && activePlayers[localPlayerId].ui.element) {
        const preservedData = {
            name: activePlayers[localPlayerId].data.name || localPlayerName,
            recentMessages: activePlayers[localPlayerId].data.recentMessages || [],
            emote: activePlayers[localPlayerId].data.emote || "",
            avatarUrl: localPlayerAvatarUrl,
            activePet: activePlayers[localPlayerId].data.activePet || null,
            activeTitle: activePlayers[localPlayerId].data.activeTitle || null,
            currency: activePlayers[localPlayerId].data.currency || 0,
        };
        activePlayers[localPlayerId].data = {
            ...preservedData,
            x: localPlayerX,
            y: localPlayerY,
            currentRoomId: localPlayerCurrentRoomId
        };
        activePlayers[localPlayerId].ui.element.style.left = localPlayerX + 'px';
        activePlayers[localPlayerId].ui.element.style.top = localPlayerY + 'px';
        if (!gameArea.contains(activePlayers[localPlayerId].ui.element)) gameArea.appendChild(activePlayers[localPlayerId].ui.element);
        activePlayers[localPlayerId].ui.element.classList.add('show');
        createOrUpdatePlayerAvatar(localPlayerId, activePlayers[localPlayerId].data, true);
    } else {
        console.error("CRITICAL ERROR in changeLocation: local player object is missing!");
    }

    const playerDataForFirebase = {
        ...(activePlayers[localPlayerId]?.data || {}),
        lastActivityTime: firebase.database.ServerValue.TIMESTAMP,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    };
    for (const key in playerDataForFirebase) {
        if (playerDataForFirebase[key] === undefined) playerDataForFirebase[key] = null;
    }
    if (playerDataForFirebase.recentMessages === undefined) playerDataForFirebase.recentMessages = [];

    await localPlayerRef.set(playerDataForFirebase).catch(err => console.error("Error setting player in new location:", err));

    if (localPlayerCurrentRoomId) {
        const roomOwnerForCount = targetRoomOwnerName || (localPlayerCurrentRoomId === `room_${localPlayerId}` ? localPlayerName : "Unknown");
        await updateActiveRoomPlayerCount(localPlayerCurrentRoomId, roomOwnerForCount, true);
    }

    if (localPlayerCurrentRoomId) {
        const ownerId = localPlayerCurrentRoomId.replace('room_', '');
        const ownerName = targetRoomOwnerName || (ownerId === localPlayerId ? localPlayerName : "Someone");
        roomIndicatorText.textContent = `أنت في غرفة: ${ownerName}`;
        currentRoomIndicator.style.display = 'flex';
    } else {
        currentRoomIndicator.style.display = 'none';
    }

    cameraX = localPlayerX - (window.innerWidth / 2);
    cameraY = localPlayerY - (window.innerHeight / 2);
    applyCameraTransform(); updateMinimap();

    loadRoomSpecificContent(currentPageId);

    if (currentPageId === mainWorldPageId) { 
        drawPortals(); 
        drawNpcs(); 
        document.getElementById('fishingAreaCanvas').style.display = 'block';
    } else { 
        clearPortalsVisuals(); 
        document.getElementById('fishingAreaCanvas').style.display = 'none';
    }
    
    cancelFollow();
    isTransitioningPortal = false;
    if (isMonitoringRooms) displayMonitoredRooms();
  }

  function loadRoomSpecificContent(roomId) {
      const roomElementsContainer = document.getElementById('room-specific-elements');
      if (!roomElementsContainer) return;
      roomElementsContainer.innerHTML = '';

      if (roomId === 'p_shadow-roomhtml') {
          const statue = document.createElement('div');
          statue.className = 'room-object shadow-statue';
          Object.assign(statue.style, { left: '300px', top: '400px', width: '100px', height: '150px' });
          statue.textContent = 'تمثال الظل';
          statue.addEventListener('click', () => alert("تمثال قديم، يهمس بأسرار الظلام..."));
          roomElementsContainer.appendChild(statue);
      } else if (roomId === 'p_mad-labhtml') {
          const labTable = document.createElement('div');
          labTable.className = 'room-object mad-lab-table';
          Object.assign(labTable.style, { left: '700px', top: '500px', width: '250px', height: '120px' });
          labTable.innerHTML = '🧪 طاولة المختبر 🧪';
          labTable.addEventListener('click', () => alert("إنها طاولة أبحاث..."));
          roomElementsContainer.appendChild(labTable);
      }
  }

  function sendRoomInvitation(targetPlayerId, targetPlayerName) {
    if (!localPlayerId) {
        alert("خطأ: لم يتم تحديد هوية اللاعب.");
        return;
    }
    if (localPlayerCurrentRoomId !== `room_${localPlayerId}`) {
        alert("يجب أن تكون في غرفتك الخاصة لإرسال الدعوات!");
        return;
    }
    if (targetPlayerId === localPlayerId) {
        alert("لا يمكنك دعوة نفسك!");
        return;
    }

    const invitationId = database.ref().push().key;
    const invitationData = {
        id: invitationId,
        fromPlayerId: localPlayerId,
        fromPlayerName: localPlayerName,
        roomId: `room_${localPlayerId}`, 
        status: 'pending',
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    database.ref(`invitations/${targetPlayerId}/${invitationId}`).set(invitationData)
        .then(() => alert(`تم إرسال دعوة إلى ${targetPlayerName} للانضمام إلى غرفتك.`))
        .catch(err => console.error("Error sending invitation:", err));
  }

  function listenForInvitations() {
    if (!localPlayerId) return;
    const invitationsRef = database.ref(`invitations/${localPlayerId}`);

    invitationsRef.on('child_added', (snapshot) => {
        const invData = snapshot.val();
        if (invData && invData.status === 'pending') {
            if (localPlayerCurrentRoomId === invData.roomId || (invitationModal.classList.contains('show'))) return;
            currentInvitationData = invData;
            invitationModalText.textContent = `${invData.fromPlayerName} يدعوك للانضمام إلى غرفته!`;
            invitationModal.classList.add('show');
        }
    });

    invitationsRef.on('child_removed', (snapshot) => {
        const removedInvId = snapshot.key;
        if (currentInvitationData && currentInvitationData.id === removedInvId) {
            invitationModal.classList.remove('show');
            currentInvitationData = null;
        }
    });

     invitationsRef.on('child_changed', (snapshot) => {
        const changedInvData = snapshot.val();
        if (changedInvData && currentInvitationData && currentInvitationData.id === changedInvData.id) {
            if (changedInvData.status === 'declined' || changedInvData.status === 'accepted') {
                invitationModal.classList.remove('show');
                currentInvitationData = null;
                if (changedInvData.status === 'declined') {
                     database.ref(`invitations/${localPlayerId}/${changedInvData.id}`).remove();
                }
            }
        } else if (changedInvData && changedInvData.status !== 'pending') {
             database.ref(`invitations/${localPlayerId}/${changedInvData.id}`).remove();
        }
    });
  }

  function initializeGame(permanentPlayerData = {}) {
      if (!localPlayerId) {
          console.error("InitializeGame called without a localPlayerId!");
          return;
      }

      if (!activePlayers[localPlayerId]) {
        const container = document.createElement('div'); container.className = 'weblin-avatar-container'; container.id = 'player-' + localPlayerId;
        const bubbleStackContainer = document.createElement('div'); bubbleStackContainer.className = 'weblin-avatar-bubble-stack';
        const emoteDisplay = document.createElement('div'); emoteDisplay.className = 'weblin-avatar-emote';
        const avatarImg = document.createElement('div'); avatarImg.className = 'weblin-avatar-image';
        const nameContainer = document.createElement('div'); nameContainer.className = 'weblin-avatar-name-container';
        const titleLabel = document.createElement('div'); titleLabel.className = 'weblin-avatar-title'; 
        const nameLabel = document.createElement('div'); nameLabel.className = 'weblin-avatar-name';
        nameContainer.appendChild(titleLabel);
        nameContainer.appendChild(nameLabel);
        container.appendChild(bubbleStackContainer); container.appendChild(emoteDisplay); container.appendChild(avatarImg); container.appendChild(nameContainer);
        gameArea.appendChild(container);

        const listItem = document.createElement('li'); listItem.id = 'playerlist-' + localPlayerId;
        const colorIndicator = document.createElement('span'); colorIndicator.className = 'player-list-color-indicator';
        listItem.appendChild(colorIndicator);
        const listNameDetails = document.createElement('div'); listNameDetails.className = 'player-list-name-details';
        const listNameSpan = document.createElement('span'); listNameSpan.className = 'player-list-name-main';
        listNameDetails.appendChild(listNameSpan);
        listItem.appendChild(listNameDetails);
        const minimapDot = document.createElement('div'); minimapDot.className = 'minimap-player-dot local'; minimapDot.id = 'minimapdot-' + localPlayerId;

        let initialData = {
            name: localPlayerName, x: localPlayerX, y: localPlayerY,
            avatarUrl: localPlayerAvatarUrl,
            activePet: permanentPlayerData.activePet || null,
            activeTitle: permanentPlayerData.activeTitle || null,
            currency: permanentPlayerData.currency || 0,
            currentRoomId: null, recentMessages: [], emote: ""
        };
        
        activePlayers[localPlayerId] = {
            data: initialData,
            ui: {
                element: container, bubbleStackContainer, emoteDisplay, avatarImg, nameLabel, titleLabel,
                bubbleTimeouts: [], emoteTimeout: null, speakingTimeout: null,
                listItem, listNameSpan: listNameSpan, colorIndicator, minimapDot,
                lastProcessedMessagesTimestamp: 0
            }
        };
        localPlayerUiInitialized = true;
        activePlayers[localPlayerId].ui.element.style.left = localPlayerX + 'px';
        activePlayers[localPlayerId].ui.element.style.top = localPlayerY + 'px';
        activePlayers[localPlayerId].ui.element.classList.add('show');
        createOrUpdatePlayerAvatar(localPlayerId, activePlayers[localPlayerId].data, true);
      }

      setupFirebaseReferencesAndListeners();

      const initialLocalPlayerDataForFirebase = {
          ...(activePlayers[localPlayerId]?.data || {}),
          name: localPlayerName,
          avatarUrl: localPlayerAvatarUrl,
          x: localPlayerX,
          y: localPlayerY,
          lastActivityTime: firebase.database.ServerValue.TIMESTAMP,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
      };
      for (const key in initialLocalPlayerDataForFirebase) {
          if (initialLocalPlayerDataForFirebase[key] === undefined) initialLocalPlayerDataForFirebase[key] = null;
      }
      if (!initialLocalPlayerDataForFirebase.recentMessages) initialLocalPlayerDataForFirebase.recentMessages = [];

      updateLocalPlayerPresence(initialLocalPlayerDataForFirebase);
      startCurrencyTimer();

      cameraX = localPlayerX - (window.innerWidth / 2); cameraY = localPlayerY - (window.innerHeight / 2);
      applyCameraTransform();

      loadRoomSpecificContent(currentPageId);
      if (currentPageId === mainWorldPageId) { 
          drawPortals(); 
          drawNpcs(); 
          initFishingArea();
          startFishingEventTimer();
      }
      else { clearPortalsVisuals(); }

      setupMovementControls();
      listenForInvitations();
      setupTransferControls();
      
      setInterval(updateLocalPlayerPositionIfChanged, 80);
      setInterval(() => { if (localPlayerRef && !isTransitioningPortal) localPlayerRef.update({ lastSeen: firebase.database.ServerValue.TIMESTAMP }); }, 45000);
      setInterval(checkPlayerActivity, PLAYER_ACTIVITY_CHECK_INTERVAL);
  } 

  function clearPortalsVisuals() {
      portals.forEach(portal => {
          if (portal.visualElement && gameArea.contains(portal.visualElement)) {
              gameArea.removeChild(portal.visualElement);
              portal.visualElement = null;
          }
          if (portal.activationBar) portal.activationBar.style.width = '0%';
          if (portal.activationBarContainer) portal.activationBarContainer.style.display = 'none';
      });
      currentActivePortalId = null;
      playerInsidePortalSince = null;
  }
  
  let lastSentX = localPlayerX, lastSentY = localPlayerY;

  function updateLocalPlayerPositionIfChanged() {
      if (!localPlayerRef || isTransitioningPortal) return;
      if (Math.abs(localPlayerX - lastSentX) > 0.1 || Math.abs(localPlayerY - lastSentY) > 0.1) {
          localPlayerRef.update({ x: localPlayerX, y: localPlayerY, lastActivityTime: firebase.database.ServerValue.TIMESTAMP });
          lastSentX = localPlayerX; lastSentY = localPlayerY;
          if(activePlayers[localPlayerId] && activePlayers[localPlayerId].data) {
              activePlayers[localPlayerId].data.lastActivityTime = Date.now();
          }
      }
  }

  function updateLocalPlayerPresence(dataToSet = null) {
      if (!localPlayerRef || isTransitioningPortal) return;
      let playerData;

      if (!dataToSet) {
        const localPData = (activePlayers[localPlayerId] && activePlayers[localPlayerId].data) ? activePlayers[localPlayerId].data : {};
        playerData = {
            name: localPlayerName, x: localPlayerX, y: localPlayerY,
            avatarUrl: localPlayerAvatarUrl,
            activePet: localPData.activePet || null,
            activeTitle: localPData.activeTitle || null,
            currency: localPData.currency || 0,
            recentMessages: localPData.recentMessages || [],
            currentRoomId: localPlayerCurrentRoomId,
            lastActivityTime: firebase.database.ServerValue.TIMESTAMP,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        };
      } else {
          playerData = { ...dataToSet };
          playerData.lastSeen = firebase.database.ServerValue.TIMESTAMP;
          if (!playerData.lastActivityTime) playerData.lastActivityTime = firebase.database.ServerValue.TIMESTAMP;
          if (playerData.currentRoomId === undefined) playerData.currentRoomId = localPlayerCurrentRoomId;
          if (!playerData.recentMessages) playerData.recentMessages = [];
      }

      for (const key in playerData) {
        if (playerData[key] === undefined) playerData[key] = null;
      }

      localPlayerRef.set(playerData).catch(err => console.error("Firebase set error (updateLocalPlayerPresence):", err));
  }

  const keysPressed = { 'w': false, 'a': false, 's': false, 'd': false, 'arrowup': false, 'arrowleft': false, 'arrowdown': false, 'arrowright': false };
  let joystickMovement = { dx: 0, dy: 0 };
  
  function setupMovementControls() {
      document.addEventListener('keydown', (e) => {
          if (authModal.classList.contains('show') || secretCodeModal.classList.contains('show') || targetSelectorModal.classList.contains('show') || invitationModal.classList.contains('show') || transferCurrencyModal.classList.contains('show') || document.activeElement === chatInput || document.activeElement === authEmailInput || document.activeElement === secretCodeInput || document.activeElement === transferAmountInput || isTransitioningPortal) return;
          const key = e.key.toLowerCase();
          if (keysPressed.hasOwnProperty(key)) {
              keysPressed[key] = true;
              if (activePlayers[localPlayerId] && activePlayers[localPlayerId].data) activePlayers[localPlayerId].data.lastActivityTime = Date.now();
          }
      });
      document.addEventListener('keyup', (e) => {
          const key = e.key.toLowerCase();
          if (keysPressed.hasOwnProperty(key)) keysPressed[key] = false;
      });

      const handleJoystickStart = (event) => {
          event.preventDefault(); joystickActive = true;
          joystickKnob.style.transition = 'none';
          if (activePlayers[localPlayerId] && activePlayers[localPlayerId].data) activePlayers[localPlayerId].data.lastActivityTime = Date.now();
          document.body.style.overflow = 'hidden';
      };
      const handleJoystickMove = (event) => {
          if (!joystickActive) return;
          event.preventDefault();
          const touch = event.touches ? event.touches[0] : event;
          const baseRect = joystickContainer.getBoundingClientRect();
          const knobRect = joystickKnob.getBoundingClientRect();
          const baseCenterX = baseRect.left + baseRect.width / 2;
          const baseCenterY = baseRect.top + baseRect.height / 2;
          let deltaX = touch.clientX - baseCenterX;
          let deltaY = touch.clientY - baseCenterY;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          const maxDist = baseRect.width / 2 - knobRect.width / 2;
          if (distance > maxDist) { deltaX = (deltaX / distance) * maxDist; deltaY = (deltaY / distance) * maxDist; }
          joystickKnob.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
          if (maxDist > 0) { joystickMovement.dx = deltaX / maxDist; joystickMovement.dy = deltaY / maxDist; }
          else { joystickMovement.dx = 0; joystickMovement.dy = 0; }
          joystickMovement.dx = Math.max(-1, Math.min(1, joystickMovement.dx));
          joystickMovement.dy = Math.max(-1, Math.min(1, joystickMovement.dy));
      };
      const handleJoystickEnd = (event) => {
          if (!joystickActive) return;
          joystickActive = false;
          joystickKnob.style.transition = 'transform 0.1s ease-out';
          joystickKnob.style.transform = 'translate(-50%, -50%)';
          joystickMovement = { dx: 0, dy: 0 };
      };
      joystickKnob.addEventListener('mousedown', handleJoystickStart);
      document.addEventListener('mousemove', handleJoystickMove);
      document.addEventListener('mouseup', handleJoystickEnd);
      joystickKnob.addEventListener('touchstart', handleJoystickStart, { passive: false });
      document.addEventListener('touchmove', handleJoystickMove, { passive: false });
      document.addEventListener('touchend', handleJoystickEnd);
      document.addEventListener('touchcancel', handleJoystickEnd);
      gameLoop();
  } 

  function gameLoop() {
      if (isTransitioningPortal) { requestAnimationFrame(gameLoop); return; }
      let dx = 0, dy = 0;
      let speed = DEFAULT_PLAYER_SPEED;
      
      if (joystickMovement.dx !== 0 || joystickMovement.dy !== 0) { dx += joystickMovement.dx; dy += joystickMovement.dy; }
      else {
          if (keysPressed['arrowup'] || keysPressed['w']) dy -= 1;
          if (keysPressed['arrowdown'] || keysPressed['s']) dy += 1;
          if (keysPressed['arrowleft'] || keysPressed['a']) dx -= 1;
          if (keysPressed['arrowright'] || keysPressed['d']) dx += 1;
      }

      if (dx !== 0 || dy !== 0) {
        let len = Math.sqrt(dx*dx + dy*dy) || 1;
        localPlayerX += (dx / len) * speed;
        localPlayerY += (dy / len) * speed;
        if (activePlayers[localPlayerId]?.data) {
            activePlayers[localPlayerId].data.lastActivityTime = Date.now();
        }
      }

      let targetX = (currentlyFollowingPlayerId && activePlayers[currentlyFollowingPlayerId]?.data) ? activePlayers[currentlyFollowingPlayerId].data.x : localPlayerX;
      let targetY = (currentlyFollowingPlayerId && activePlayers[currentlyFollowingPlayerId]?.data) ? activePlayers[currentlyFollowingPlayerId].data.y : localPlayerY;
      const avatarWidth = activePlayers[localPlayerId]?.ui?.avatarImg?.offsetWidth || 50;
      const avatarHeight = activePlayers[localPlayerId]?.ui?.avatarImg?.offsetHeight || 80;
      localPlayerX = Math.max(0, Math.min(WORLD_WIDTH - avatarWidth, localPlayerX));
      localPlayerY = Math.max(0, Math.min(WORLD_HEIGHT - (avatarHeight + 30), localPlayerY));
      if (activePlayers[localPlayerId]?.ui.element) {
          activePlayers[localPlayerId].ui.element.style.left = localPlayerX + 'px';
          activePlayers[localPlayerId].ui.element.style.top = localPlayerY + 'px';
      }
      const finalCamX = targetX - (window.innerWidth / 2) + (avatarWidth / 2);
      const finalCamY = targetY - (window.innerHeight / 2) + (avatarHeight / 2);
      cameraX += (finalCamX - cameraX) * CAMERA_SMOOTHING;
      cameraY += (finalCamY - cameraY) * CAMERA_SMOOTHING;
      cameraX = Math.max(0, Math.min(WORLD_WIDTH - window.innerWidth, cameraX));
      cameraY = Math.max(0, Math.min(WORLD_HEIGHT - window.innerHeight, cameraY));

      applyCameraTransform();

      updateMinimap();
      if (currentPageId === mainWorldPageId) { 
          checkPortals(); 
          checkNpcInteractions();
          checkFishingZone();
      }
      requestAnimationFrame(gameLoop);
  } 

  function applyCameraTransform() { if (gameArea) gameArea.style.transform = `translate(${-cameraX.toFixed(2)}px, ${-cameraY.toFixed(2)}px)`; }
  
  sendChatBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });

  function sendChatMessage() {
      const msg = chatInput.value.trim();
      if (msg && localPlayerRef && !isTransitioningPortal) {
          const currentMessages = activePlayers[localPlayerId]?.data?.recentMessages || [];
          const newMessageObj = { text: msg.substring(0, 100), timestamp: firebase.database.ServerValue.TIMESTAMP };
          const updatedMessages = [newMessageObj, ...currentMessages].slice(0, MAX_RECENT_MESSAGES);
          localPlayerRef.update({ recentMessages: updatedMessages, lastActivityTime: firebase.database.ServerValue.TIMESTAMP });
          chatInput.value = '';
          if(activePlayers[localPlayerId]?.data) {
              activePlayers[localPlayerId].data.recentMessages = updatedMessages.map(m => ({...m, timestamp: Date.now()}));
              displayPlayerBubbles(localPlayerId, activePlayers[localPlayerId].data.recentMessages);
              activePlayers[localPlayerId].data.lastActivityTime = Date.now();
          }
      }
  } 
  function handlePlayerAdded(snapshot) {
      const pId = snapshot.key;
      const pData = snapshot.val();
      if (!pData || typeof pData.x === 'undefined') return;
      pData.currency = pData.currency || 0;

      if (pId === localPlayerId) {
        if (activePlayers[localPlayerId]?.data) {
            const serverData = { ...pData };
            delete serverData.lastActivityTime; delete serverData.lastSeen;
            activePlayers[localPlayerId].data = { ...activePlayers[localPlayerId].data, ...serverData, x: pData.x, y: pData.y };
            localPlayerName = activePlayers[localPlayerId].data.name;
            localPlayerAvatarUrl = activePlayers[localPlayerId].data.avatarUrl || localPlayerAvatarUrl;
            localPlayerCurrentRoomId = activePlayers[localPlayerId].data.currentRoomId || null;
            if (localPlayerCurrentRoomId) {
                 const ownerName = localPlayerCurrentRoomId.replace('room_', '') === localPlayerId ? localPlayerName : (activePlayers[localPlayerCurrentRoomId.replace('room_', '')]?.data?.name || "Someone");
                 roomIndicatorText.textContent = `أنت في غرفة: ${ownerName}`;
                 currentRoomIndicator.style.display = 'flex';
            } else currentRoomIndicator.style.display = 'none';
            createOrUpdatePlayerAvatar(pId, activePlayers[localPlayerId].data, true);
        } else createOrUpdatePlayerAvatar(pId, pData, true);
      } else {
          createOrUpdatePlayerAvatar(pId, pData, false);
          if (activePlayers[pId]?.ui.element) {
              setTimeout(() => { if (activePlayers[pId]?.ui.element) activePlayers[pId].ui.element.classList.add('show'); }, 50 + Math.random() * 200);
          }
      }
      updatePlayerListAndMinimap();
  } 

  function handlePlayerChanged(snapshot) {
      const pId = snapshot.key;
      const pData = snapshot.val();
      if (!pData || typeof pData.x === 'undefined' || !activePlayers[pId]) return;
      pData.currency = pData.currency || 0;

      const serverData = { ...pData };
      delete serverData.lastActivityTime; delete serverData.lastSeen;
      activePlayers[pId].data = { ...activePlayers[pId].data, ...serverData, name: pData.name || activePlayers[pId].data.name, x: pData.x, y: pData.y };
      createOrUpdatePlayerAvatar(pId, activePlayers[pId].data, pId === localPlayerId);

      if (pId === localPlayerId) {
          localPlayerName = activePlayers[pId].data.name;
          localPlayerAvatarUrl = activePlayers[pId].data.avatarUrl || localPlayerAvatarUrl;
          localPlayerCurrentRoomId = activePlayers[pId].data.currentRoomId || null;
          if (localPlayerCurrentRoomId) {
              const ownerName = localPlayerCurrentRoomId.replace('room_', '') === localPlayerId ? localPlayerName : (activePlayers[localPlayerCurrentRoomId.replace('room_', '')]?.data?.name || "Someone");
              roomIndicatorText.textContent = `أنت في غرفة: ${ownerName}`;
              currentRoomIndicator.style.display = 'flex';
          } else currentRoomIndicator.style.display = 'none';
      }
      updatePlayerListAndMinimap();
  } 
  
  function handlePlayerRemoved(snapshot) {
      const pId = snapshot.key;
      const removedPlayerData = snapshot.val();
      if (pId === localPlayerId && isTransitioningPortal) return;
      if (removedPlayerData?.currentRoomId && removedPlayerData.currentRoomId !== mainWorldPageId) {
          updateActiveRoomPlayerCount(removedPlayerData.currentRoomId, removedPlayerData.name, false);
      }
      if (activePlayers[pId]?.ui.element) {
          activePlayers[pId].ui.element.classList.remove('show');
          setTimeout(() => {
            if (activePlayers[pId]) {
                if (gameArea.contains(activePlayers[pId].ui.element)) gameArea.removeChild(activePlayers[pId].ui.element);
                if (minimapContainer.contains(activePlayers[pId].ui.minimapDot)) minimapContainer.removeChild(activePlayers[pId].ui.minimapDot);
                if (playerListElement.contains(activePlayers[pId].ui.listItem)) playerListElement.removeChild(activePlayers[pId].ui.listItem);
                if (activePlayers[pId].ui.bubbleTimeouts) activePlayers[pId].ui.bubbleTimeouts.forEach(clearTimeout);
                clearTimeout(activePlayers[pId].ui.emoteTimeout); clearTimeout(activePlayers[pId].ui.speakingTimeout);
                delete activePlayers[pId];
                updatePlayerListAndMinimap();
            }
          }, 500);
      } else {
        if (activePlayers[pId]) delete activePlayers[pId];
        updatePlayerListAndMinimap();
      }
      if (isMonitoringRooms) displayMonitoredRooms();
  } 
  
  function createOrUpdatePlayerAvatar(playerId, playerData, isLocal = false) {
      let playerEntry = activePlayers[playerId];
      if (!playerEntry?.ui?.element) {
         if (isLocal && !localPlayerUiInitialized) { console.error("Local player UI not initialized!"); return; }
         if (!playerEntry && !isLocal) {
            const container = document.createElement('div'); container.className = 'weblin-avatar-container'; container.id = 'player-' + playerId;
            const bubbleStackContainer = document.createElement('div'); bubbleStackContainer.className = 'weblin-avatar-bubble-stack';
            const emoteDisplay = document.createElement('div'); emoteDisplay.className = 'weblin-avatar-emote';
            const avatarImg = document.createElement('div'); avatarImg.className = 'weblin-avatar-image';
            const nameContainer = document.createElement('div'); nameContainer.className = 'weblin-avatar-name-container';
            const titleLabel = document.createElement('div'); titleLabel.className = 'weblin-avatar-title';
            const nameLabel = document.createElement('div'); nameLabel.className = 'weblin-avatar-name';
            nameContainer.appendChild(titleLabel);
            nameContainer.appendChild(nameLabel);
            container.appendChild(bubbleStackContainer); container.appendChild(emoteDisplay); container.appendChild(avatarImg); container.appendChild(nameContainer);
            if (!document.getElementById(container.id)) gameArea.appendChild(container);

            const minimapDot = document.createElement('div'); minimapDot.className = 'minimap-player-dot'; minimapDot.id = 'minimapdot-' + playerId;
            
            activePlayers[playerId] = {
                data: {}, ui: {
                    element: container, bubbleStackContainer, emoteDisplay, avatarImg, nameLabel, titleLabel, minimapDot,
                    bubbleTimeouts: [], emoteTimeout: null, speakingTimeout: null,
                    lastProcessedMessagesTimestamp: 0
                }
            };
            playerEntry = activePlayers[playerId];
         } else { return; }
      }
      playerEntry.data = {...(playerEntry.data || {}), ...(playerData || {})};
      const pData = playerEntry.data; const playerUI = playerEntry.ui;
      if (!playerUI || !playerUI.element || !playerUI.avatarImg || !playerUI.nameLabel || !playerUI.titleLabel) return;
      if (!gameArea.contains(playerUI.element)) gameArea.appendChild(playerUI.element);
      
      playerUI.avatarImg.style.backgroundImage = `url('${pData.avatarUrl || (playerId === localPlayerId ? localPlayerAvatarUrl : 'https://cdn.everskies.com/render/WzBd.png?a=1')}')`;
      playerUI.nameLabel.textContent = pData.name || playerId.substring(0,10);
      playerUI.element.style.left = (pData.x || 0) + 'px'; playerUI.element.style.top = (pData.y || 0) + 'px';
      if (!playerUI.element.classList.contains('show')) playerUI.element.classList.add('show');
      
      if (pData.activeTitle && pData.activeTitle.text) {
          playerUI.titleLabel.textContent = pData.activeTitle.text;
          playerUI.titleLabel.className = 'weblin-avatar-title ' + pData.activeTitle.cssClass;
          if (pData.activeTitle.cssClass === 'title-effect-glitch') {
              playerUI.titleLabel.setAttribute('data-text', pData.activeTitle.text);
          } else {
              playerUI.titleLabel.removeAttribute('data-text');
          }
      } else {
          playerUI.titleLabel.textContent = '';
          playerUI.titleLabel.className = 'weblin-avatar-title';
          playerUI.titleLabel.removeAttribute('data-text');
      }

      createOrUpdatePlayerPet(playerUI.element, pData.activePet);

      if (pData.recentMessages && Array.isArray(pData.recentMessages) && pData.recentMessages.length > 0) {
          if (pData.recentMessages[0].timestamp !== playerUI.lastProcessedMessagesTimestamp) {
              displayPlayerBubbles(playerId, pData.recentMessages);
              playerUI.lastProcessedMessagesTimestamp = pData.recentMessages[0].timestamp;
          }
      } else if (pData.recentMessages?.length === 0 && playerUI.bubbleStackContainer.hasChildNodes()) {
          displayPlayerBubbles(playerId, []); playerUI.lastProcessedMessagesTimestamp = 0;
      }
      if (pData.emote && (!playerUI.lastEmoteTime || pData.lastEmoteTime < pData.lastEmoteTime)) {
          showPlayerEmote(playerUI, pData.emote); playerUI.lastEmoteTime = pData.lastEmoteTime;
      }
  } 
  
  function createOrUpdatePlayerPet(playerElement, petUrl) {
    let petElement = playerElement.querySelector('.player-pet');
    if (petUrl) {
        if (!petElement) {
            petElement = document.createElement('div');
            petElement.className = 'player-pet';
            playerElement.appendChild(petElement);
        }
        petElement.style.backgroundImage = `url('${petUrl}')`;
    } else {
        if (petElement) {
            playerElement.removeChild(petElement);
        }
    }
  }

  function displayPlayerBubbles(playerId, messages) {
      const playerEntry = activePlayers[playerId];
      if (!playerEntry || !playerEntry.ui || !playerEntry.ui.bubbleStackContainer) return;
      
      const stack = playerEntry.ui.bubbleStackContainer;
      const ui = playerEntry.ui;

      if (ui.speakingTimeout) clearTimeout(ui.speakingTimeout);
      if (ui.avatarImg) ui.avatarImg.classList.add('speaking');
      ui.speakingTimeout = setTimeout(() => {
          if (ui.avatarImg) ui.avatarImg.classList.remove('speaking');
      }, BUBBLE_TIMEOUT_DURATION);
      
      if (ui.bubbleTimeouts) ui.bubbleTimeouts.forEach(clearTimeout);
      ui.bubbleTimeouts = [];
      stack.innerHTML = '';
      
      messages.forEach((msg, index) => {
          const bubble = document.createElement('div');
          bubble.innerHTML = msg.text;
          bubble.className = 'weblin-avatar-bubble';
          if (index > 0) bubble.classList.add('historical', `h${index - 1}`);
          
          stack.appendChild(bubble);
          
          setTimeout(() => { bubble.classList.add('show'); }, 50);

          const timeoutDuration = BUBBLE_TIMEOUT_DURATION * Math.pow(HISTORICAL_BUBBLE_TIMEOUT_MODIFIER, index);
          const timeout = setTimeout(() => {
              bubble.classList.remove('show');
              setTimeout(() => { if (stack.contains(bubble)) stack.removeChild(bubble); }, 300);
          }, timeoutDuration);
          ui.bubbleTimeouts.push(timeout);
      });
  }

  function showPlayerEmote(ui, emoji) {
      if (!ui || !ui.emoteDisplay) return;
      const emote = ui.emoteDisplay;
      
      emote.textContent = emoji;
      emote.classList.add('show');
      
      if (ui.emoteTimeout) clearTimeout(ui.emoteTimeout);
      ui.emoteTimeout = setTimeout(() => {
          emote.classList.remove('show');
      }, 3000);
  }
  
  function updatePlayerListAndMinimap() {
      renderPlayerList();
      updateMinimap();
  }

  async function renderPlayerList() {
      const invitablePlayersContainer = document.getElementById('invitable-players-container');
      playerListElement.innerHTML = '';
      invitablePlayersContainer.style.display = 'none';
      document.getElementById('invitablePlayerList').innerHTML = '';

      const sortedPlayerIds = Object.keys(activePlayers).sort((a, b) => (activePlayers[a].data.name || a).localeCompare(activePlayers[b].data.name || b));
      sortedPlayerIds.forEach(pId => {
          const pData = activePlayers[pId].data;
          if (!pData) return;
          const listItem = createPlayerListItem(pId, pData, false);
          playerListElement.appendChild(listItem);
      });

      if (localPlayerCurrentRoomId === `room_${localPlayerId}`) {
          invitablePlayersContainer.style.display = 'block';
          const invitablePlayerList = document.getElementById('invitablePlayerList');
          invitablePlayerList.innerHTML = '<li>جاري تحميل اللاعبين...</li>';

          try {
              const snapshot = await database.ref(`pages_v3/${mainWorldPageId}/players`).once('value');
              invitablePlayerList.innerHTML = '';
              if (snapshot.exists()) {
                  let foundPlayers = false;
                  snapshot.forEach(childSnapshot => {
                      const pId = childSnapshot.key;
                      const pData = childSnapshot.val();
                      if (pId !== localPlayerId && !activePlayers[pId]) {
                          const listItem = createPlayerListItem(pId, pData, true);
                          invitablePlayerList.appendChild(listItem);
                          foundPlayers = true;
                      }
                  });
                  if (!foundPlayers) {
                      invitablePlayerList.innerHTML = '<li>لا يوجد لاعبون آخرون للدعوة.</li>';
                  }
              } else {
                  invitablePlayerList.innerHTML = '<li>لا يوجد لاعبون آخرون للدعوة.</li>';
              }
          } catch (error) {
              console.error("Error fetching invitable players:", error);
              invitablePlayerList.innerHTML = '<li>خطأ في تحميل القائمة.</li>';
          }
      }
  }
  
  function createPlayerListItem(pId, pData, isInvitable) {
      const listItem = document.createElement('li');
      listItem.id = 'playerlist-' + pId;

      const colorIndicator = document.createElement('span');
      colorIndicator.className = 'player-list-color-indicator';
      colorIndicator.style.backgroundColor = pData.color || '#888';
      listItem.appendChild(colorIndicator);

      const listNameDetails = document.createElement('div');
      listNameDetails.className = 'player-list-name-details';
      const listNameSpan = document.createElement('span');
      listNameSpan.className = 'player-list-name-main';
      listNameSpan.textContent = pData.name || pId.substring(0, 10);
      listNameDetails.appendChild(listNameSpan);
      listItem.appendChild(listNameDetails);
      
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'player-list-actions';
      listItem.appendChild(actionsContainer);

      if (isInvitable) {
          const inviteButton = document.createElement('button');
          inviteButton.textContent = 'ادعُ';
          inviteButton.className = 'invite-to-room-btn';
          inviteButton.onclick = (e) => { e.stopPropagation(); sendRoomInvitation(pId, pData.name); };
          actionsContainer.appendChild(inviteButton);
      } else if (pId !== localPlayerId) {
          const transferButton = document.createElement('button');
          transferButton.textContent = '💰';
          transferButton.title = 'تحويل عملات';
          transferButton.className = 'transfer-currency-btn';
          transferButton.onclick = (e) => { e.stopPropagation(); openTransferModal(pId, pData.name); };
          actionsContainer.appendChild(transferButton);
      }

      updatePlayerListItemInteractivity(listItem, pId);
      return listItem;
  }

  function updatePlayerListItemInteractivity(item, pId) {
      const nameDetails = item.querySelector('.player-list-name-details');
      if (secretCodeUnlocked && pId !== localPlayerId && nameDetails) {
          item.classList.add('followable');
          nameDetails.onclick = () => followPlayer(pId);
      } else if (nameDetails) {
          item.classList.remove('followable');
          nameDetails.onclick = null;
      }
  }

  function updatePlayerListStyling() {
      const listItems = document.querySelectorAll('#playerList li, #invitablePlayerList li');
      listItems.forEach(item => {
          const pId = item.id.replace('playerlist-', '');
          item.classList.remove('following');
          if (pId === currentlyFollowingPlayerId) {
              item.classList.add('following');
          }
      });
  }
  
  function updateMinimap() {
      if (!minimapContainer) return;
      const mapW = minimapContainer.offsetWidth, mapH = minimapContainer.offsetHeight;
      if (mapW === 0 || mapH === 0) return;
      const scaleX = mapW / WORLD_WIDTH, scaleY = mapH / WORLD_HEIGHT;
      
      Object.keys(activePlayers).forEach(pId => {
          const pEntry = activePlayers[pId];
          if (pEntry?.ui.minimapDot && pEntry.data) {
              if (!minimapContainer.contains(pEntry.ui.minimapDot)) {
                 minimapContainer.appendChild(pEntry.ui.minimapDot);
              }
              pEntry.ui.minimapDot.style.backgroundColor = pEntry.data.color || '#888';
              const dotSize = pId === localPlayerId ? 8 : 6;
              pEntry.ui.minimapDot.style.left = `${Math.max(0, Math.min(pEntry.data.x * scaleX - (dotSize/2), mapW - dotSize))}px`;
              pEntry.ui.minimapDot.style.top = `${Math.max(0, Math.min(pEntry.data.y * scaleY - (dotSize/2), mapH - dotSize))}px`;
              pEntry.ui.minimapDot.style.width = `${dotSize}px`;
              pEntry.ui.minimapDot.style.height = `${dotSize}px`;
          }
      });
      
      npcs.forEach(npc => {
        let npcDot = document.getElementById('minimapdot-' + npc.id);
        if (!npcDot) {
            npcDot = document.createElement('div');
            npcDot.id = 'minimapdot-' + npc.id;
            npcDot.className = 'minimap-player-dot';
            npcDot.style.boxShadow = '0 0 5px ' + npc.minimapColor;
            minimapContainer.appendChild(npcDot);
        }
        npcDot.style.backgroundColor = npc.minimapColor;
        npcDot.style.left = `${Math.max(0, Math.min(npc.x * scaleX - 4, mapW - 8))}px`;
        npcDot.style.top = `${Math.max(0, Math.min(npc.y * scaleY - 4, mapH - 8))}px`;
        npcDot.style.width = '8px';
        npcDot.style.height = '8px';
      });
  } 
  
  function drawPortals() {
    portals.forEach(portal => {
        if (!portal.visualElement) {
            const p = document.createElement('div');
            p.className = 'portal-visual';
            p.id = portal.id;
            p.style.left = portal.x + 'px';
            p.style.top = portal.y + 'px';
            p.style.width = portal.width + 'px';
            p.style.height = portal.height + 'px';

            const iconSpan = document.createElement('span');
            iconSpan.textContent = portal.icon;
            iconSpan.style.fontSize = '2em';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = portal.name;
            nameSpan.style.fontSize = '0.8em';

            const barContainer = document.createElement('div');
            barContainer.className = 'portal-activation-bar-container';
            const bar = document.createElement('div');
            bar.className = 'portal-activation-bar';
            barContainer.appendChild(bar);

            p.appendChild(iconSpan);
            p.appendChild(nameSpan);
            p.appendChild(barContainer);

            gameArea.appendChild(p);
            portal.visualElement = p;
            portal.activationBarContainer = barContainer;
            portal.activationBar = bar;
        } else {
             if (!gameArea.contains(portal.visualElement)) {
                gameArea.appendChild(portal.visualElement);
             }
        }
    });
  }

  function checkPortals() {
      if (!localPlayerId || isTransitioningPortal) return;
      let playerIsInsideAnyPortal = false;
      const localPlayer = activePlayers[localPlayerId];
      if (!localPlayer) return;

      const playerCenterX = localPlayerX + 25;
      const playerBottomY = localPlayerY + 80;

      for (const portal of portals) {
          const portalLeft = portal.x;
          const portalRight = portal.x + portal.width;
          const portalTop = portal.y;
          const portalBottom = portal.y + portal.height;

          if (playerCenterX > portalLeft && playerCenterX < portalRight &&
              playerBottomY > portalTop && playerBottomY < portalBottom) {
              
              playerIsInsideAnyPortal = true;
              portal.visualElement.classList.add('portal-hovered');

              if (currentActivePortalId !== portal.id) {
                  playerInsidePortalSince = Date.now();
                  currentActivePortalId = portal.id;
                  if(portal.activationBarContainer) portal.activationBarContainer.style.display = 'block';
              }

              const timeInside = Date.now() - playerInsidePortalSince;
              const progress = Math.min(100, (timeInside / PORTAL_ACTIVATION_TIME) * 100);
              if(portal.activationBar) portal.activationBar.style.width = progress + '%';

              if (timeInside >= PORTAL_ACTIVATION_TIME) {
                  isTransitioningPortal = true;
                  window.location.href = portal.targetUrl;
              }
              break; 
          } else {
              portal.visualElement.classList.remove('portal-hovered');
              if (currentActivePortalId === portal.id) {
                  if(portal.activationBar) portal.activationBar.style.width = '0%';
                  if(portal.activationBarContainer) portal.activationBarContainer.style.display = 'none';
              }
          }
      }

      if (!playerIsInsideAnyPortal) {
          playerInsidePortalSince = null;
          currentActivePortalId = null;
      }
  }
  
  function checkPlayerActivity() {
    if (!localPlayerRef) return;
    const now = Date.now();
    const localPlayerData = activePlayers[localPlayerId]?.data;
    if (localPlayerData) {
      if ((now - (localPlayerData.lastActivityTime || 0)) > IDLE_TIMEOUT_DURATION) {
         if (!localPlayerData.idle) localPlayerRef.update({ idle: true });
      } else {
         if (localPlayerData.idle) localPlayerRef.update({ idle: false });
      }
    }
  }

  function followPlayer(pIdToFollow) {
      if (activePlayers[pIdToFollow]) {
          currentlyFollowingPlayerId = pIdToFollow;
          cancelFollowBtn.style.display = 'block';
          updatePlayerListStyling();
      }
  }

  function updateActiveRoomPlayerCount(roomId, ownerName, increment = true) {
    if (!roomId) return;
    const roomRef = database.ref(`active_rooms/${roomId}`);
    roomRef.transaction(currentData => {
        if (increment) {
            if (currentData === null) {
                return { ownerName: ownerName || "Unknown", playerCount: 1, lastActivity: firebase.database.ServerValue.TIMESTAMP };
            } else {
                return { ...currentData, playerCount: (currentData.playerCount || 0) + 1, lastActivity: firebase.database.ServerValue.TIMESTAMP };
            }
        } else {
            if (currentData === null) {
                return null;
            }
            if (currentData.playerCount > 1) {
                return { ...currentData, playerCount: currentData.playerCount - 1, lastActivity: firebase.database.ServerValue.TIMESTAMP };
            } else {
                return null;
            }
        }
    });
  }

  function displayMonitoredRooms() {
    if (!isMonitoringRooms) return;
    const activeRoomsRef = database.ref('active_rooms');
    activeRoomsRef.on('value', snapshot => {
        roomsMonitorListElement.innerHTML = '';
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const roomData = childSnapshot.val();
                const roomId = childSnapshot.key;
                const listItem = document.createElement('li');
                listItem.textContent = `غرفة ${roomData.ownerName}: ${roomData.playerCount} لاعب(ين)`;
                listItem.onclick = () => {
                    if (confirm(`هل تريد الانتقال إلى غرفة ${roomData.ownerName}؟`)) {
                        changeLocation(roomId, roomData.ownerName);
                    }
                };
                roomsMonitorListElement.appendChild(listItem);
            });
        } else {
            roomsMonitorListElement.innerHTML = '<li>لا توجد غرف نشطة حاليًا.</li>';
        }
    });
  }

  function cancelFollow() {
      currentlyFollowingPlayerId = null;
      cancelFollowBtn.style.display = 'none';
      updatePlayerListStyling();
  }

  // ===================================
  // ==   نظام العملات والشراء والمتاجر   ==
  // ===================================

  function updateCurrencyUI(amount) {
    const currencyAmountElement = document.getElementById('currency-amount');
    if (currencyAmountElement) {
        currencyAmountElement.textContent = amount;
    }
  }

  function startCurrencyTimer() {
    if (currencyInterval) clearInterval(currencyInterval);
    
    const timerElement = document.getElementById('currency-timer');
    let countdown = 60;

    const playerPermanentDataRef = database.ref(`players_data/${localPlayerId}`);

    currencyInterval = setInterval(() => {
        countdown--;
        if (timerElement) {
            const minutes = Math.floor(countdown / 60);
            const seconds = countdown % 60;
            timerElement.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }

        if (countdown <= 0) {
            countdown = 60;
            playerPermanentDataRef.child('currency').transaction((currentCurrency) => {
                return (currentCurrency || 0) + 1;
            });
        }
    }, 1000);
  }

  function drawNpcs() {
      npcs.forEach(npc => {
        let npcElement = document.getElementById(npc.id);
        if (!npcElement) {
            npcElement = document.createElement('div');
            npcElement.id = npc.id;
            npcElement.className = 'npc-character';
            npcElement.style.left = npc.x + 'px';
            npcElement.style.top = npc.y + 'px';
            npcElement.style.backgroundImage = `url('${npc.imageUrl}')`;
            
            const prompt = document.createElement('div');
            prompt.className = 'interaction-prompt';
            prompt.id = 'prompt-' + npc.id;
            prompt.textContent = npc.promptText || 'تفاعل';
            npcElement.appendChild(prompt);

            npcElement.addEventListener('click', () => {
                const distance = Math.sqrt(Math.pow(localPlayerX - (npc.x + npc.width / 2), 2) + Math.pow(localPlayerY - (npc.y + npc.height / 2), 2));
                if (distance < npc.interactionRadius) {
                    openNpcShop(npc);
                } else {
                    alert('يجب أن تقترب أكثر من البائع!');
                }
            });

            gameArea.appendChild(npcElement);
        }
      });
  }

  function checkNpcInteractions() {
      if (!localPlayerId || isTransitioningPortal) return;
      npcs.forEach(npc => {
        const prompt = document.getElementById('prompt-' + npc.id);
        if (!prompt) return;
        const distance = Math.sqrt(Math.pow(localPlayerX - (npc.x + npc.width/2), 2) + Math.pow(localPlayerY - (npc.y + npc.height/2), 2));
        if (distance < npc.interactionRadius) {
            prompt.style.display = 'block';
        } else {
            prompt.style.display = 'none';
        }
      });
  }

  function openNpcShop(npc) {
      const shopModal = document.getElementById('npcShopModal');
      const shopContent = document.getElementById('npcShopContent');
      const shopTitle = document.getElementById('npcShopTitle');

      if (shopModal.classList.contains('show')) return;
      
      shopTitle.textContent = npc.name;
      shopModal.classList.add('show');
      
      shopContent.innerHTML = '<p>جاري تحميل المنتجات...</p>';
      const blogAddress = new URL(npc.shopUrl).origin;
      const postLink = npc.shopUrl;
      fetchShopContent(blogAddress, postLink);
  }
  
  function fetchShopContent(blogURL, postURL) {
      const shopContentElement = document.getElementById('npcShopContent');
      const callbackName = 'processShopData' + Date.now();

      window[callbackName] = function(json) {
          if (json.feed && json.feed.entry && json.feed.entry.length > 0) {
              const entry = json.feed.entry[0];
              if (entry.content && entry.content.$t) {
                  parseAndDisplayShopItems(entry.content.$t);
              } else {
                  shopContentElement.innerHTML = "<p>المشاركة فارغة أو لا تحتوي على محتوى.</p>";
              }
          } else {
              shopContentElement.innerHTML = "<p>لم يتم العثور على المشاركة. تأكد من أن الرابط صحيح وأن تاريخ المشاركة ليس في المستقبل.</p>";
          }
          document.body.removeChild(document.getElementById(callbackName));
          delete window[callbackName];
      };

      const postPath = new URL(postURL).pathname;
      const apiUrl = `${blogURL}/feeds/posts/default?alt=json-in-script&path=${postPath}&callback=${callbackName}`;

      const script = document.createElement('script');
      script.id = callbackName;
      script.src = apiUrl;
      script.onerror = function() {
          shopContentElement.innerHTML = "<p>فشل في الوصول إلى بيانات بلوجر. تأكد من أن الروابط صحيحة.</p>";
          if (document.getElementById(callbackName)) {
              document.body.removeChild(document.getElementById(callbackName));
          }
          delete window[callbackName];
      };
      document.body.appendChild(script);
  }

  function parseAndDisplayShopItems(htmlContent) {
      const shopContent = document.getElementById('npcShopContent');
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const shopItems = doc.querySelectorAll('.shop-item');

      if (shopItems.length > 0) {
          shopContent.innerHTML = '';
          shopItems.forEach(item => {
              const image = item.querySelector('.shop-item-image');
              const title = item.querySelector('.shop-item-title')?.textContent || 'منتج';
              const priceText = item.querySelector('.shop-item-price')?.textContent || '💰 0';
              const buyButton = item.querySelector('.shop-item-buy-button');
              
              if (buyButton) {
                  const itemType = buyButton.getAttribute('data-item-type');
                  let itemData = null;

                  if (itemType === 'avatar' || itemType === 'pet') {
                     if (image) {
                        itemData = {
                            type: itemType,
                            url: buyButton.getAttribute('data-avatar-url') || buyButton.getAttribute('data-pet-url'),
                            price: parseInt(buyButton.getAttribute('data-price')) || 0
                        };
                     }
                  } else if (itemType === 'title') {
                     itemData = {
                        type: 'title',
                        price: parseInt(buyButton.getAttribute('data-price')) || 0,
                        text: buyButton.getAttribute('data-title-text'),
                        cssClass: buyButton.getAttribute('data-title-class')
                     };
                  }

                  if (itemData) {
                      const shopItemCard = document.createElement('div');
                      shopItemCard.className = 'game-shop-item';
                      shopItemCard.title = `شراء: ${title}`;
                      shopItemCard.addEventListener('click', () => attemptPurchase(itemData));

                      if (image) {
                        const itemImg = document.createElement('img');
                        itemImg.src = image.src;
                        shopItemCard.appendChild(itemImg);
                      } else if (itemType === 'title') {
                        const titlePreview = item.querySelector('.shop-item-title-preview')?.cloneNode(true);
                        if (titlePreview) shopItemCard.appendChild(titlePreview);
                      }

                      const itemTitle = document.createElement('p');
                      itemTitle.className = 'item-title';
                      itemTitle.textContent = title;

                      const itemPrice = document.createElement('p');
                      itemPrice.className = 'item-price';
                      itemPrice.textContent = priceText;

                      shopItemCard.appendChild(itemTitle);
                      shopItemCard.appendChild(itemPrice);
                      shopContent.appendChild(shopItemCard);
                  }
              }
          });

          if (shopContent.children.length === 0) {
             shopContent.innerHTML = '<p>لم يتم العثور على منتجات قابلة للشراء في صفحة المتجر.</p>';
          }
      } else {
          shopContent.innerHTML = '<p>فشل في تحليل محتوى المتجر. تأكد من أن هيكل الصفحة صحيح.</p>';
      }
  }
  
  function attemptPurchase(itemData) {
    if (!localPlayerRef) return;
    const playerPermanentDataRef = database.ref(`players_data/${localPlayerId}`);
    
    playerPermanentDataRef.child('currency').once('value', (snapshot) => {
        const currentCurrency = snapshot.val() || 0;

        if (currentCurrency >= itemData.price) {
            const newCurrency = currentCurrency - itemData.price;
            let updates = { currency: newCurrency };
            let successMessage = '';

            if (itemData.type === 'avatar') {
                updates.avatarUrl = itemData.url;
                successMessage = 'تم شراء الأفاتار بنجاح!';
            } else if (itemData.type === 'pet') {
                updates.activePet = itemData.url;
                successMessage = 'تم شراء الحيوان الأليف بنجاح!';
            } else if (itemData.type === 'title') {
                updates.activeTitle = { text: itemData.text, cssClass: itemData.cssClass };
                successMessage = 'تم تجهيز اللقب بنجاح!';
            } else {
                alert('نوع المنتج غير معروف.');
                return;
            }
            
            playerPermanentDataRef.update(updates).then(() => {
                localPlayerRef.update(updates);
                
                if (itemData.type === 'avatar') {
                    localPlayerAvatarUrl = itemData.url;
                }
                if (itemData.type === 'pet' && activePlayers[localPlayerId]?.data) {
                    activePlayers[localPlayerId].data.activePet = itemData.url;
                }
                if (itemData.type === 'title' && activePlayers[localPlayerId]?.data) {
                    activePlayers[localPlayerId].data.activeTitle = updates.activeTitle;
                }
                alert(successMessage);
                document.getElementById('npcShopModal').classList.remove('show');
            }).catch((error) => {
                alert('حدث خطأ أثناء عملية الشراء. يرجى المحاولة مرة أخرى.');
                console.error("Purchase error:", error);
            });

        } else {
            alert(`ليس لديك عملات كافية!\nتحتاج إلى: ${itemData.price}\nرصيدك الحالي: ${currentCurrency}`);
        }
    });
  }

  function openTransferModal(targetId, targetName) {
      transferTarget = { id: targetId, name: targetName };
      transferModalTitle.textContent = `تحويل عملات إلى ${targetName}`;
      transferAmountInput.value = '';
      transferStatus.textContent = '';
      transferCurrencyModal.classList.add('show');
  }

  function setupTransferControls() {
      cancelTransferBtn.addEventListener('click', () => {
          transferCurrencyModal.classList.remove('show');
      });

      confirmTransferBtn.addEventListener('click', () => {
          const amount = parseInt(transferAmountInput.value);
          if (isNaN(amount) || amount <= 0) {
              transferStatus.textContent = '⚠️ الرجاء إدخال مبلغ صحيح.';
              transferStatus.style.color = '#e74c3c';
              return;
          }

          const senderRef = database.ref(`players_data/${localPlayerId}`);
          const receiverRef = database.ref(`players_data/${transferTarget.id}`);

          confirmTransferBtn.disabled = true;
          transferStatus.textContent = 'جاري التحويل...';
          transferStatus.style.color = '#3498db';

          senderRef.child('currency').once('value', (snapshot) => {
              const senderBalance = snapshot.val() || 0;
              if (senderBalance < amount) {
                  transferStatus.textContent = '⚠️ ليس لديك رصيد كافي!';
                  transferStatus.style.color = '#e74c3c';
                  confirmTransferBtn.disabled = false;
                  return;
              }

              senderRef.child('currency').set(senderBalance - amount)
                  .then(() => {
                      receiverRef.child('currency').transaction((currentBalance) => {
                          return (currentBalance || 0) + amount;
                      }).then(() => {
                          transferStatus.textContent = `✅ تم تحويل ${amount} عملة بنجاح إلى ${transferTarget.name}.`;
                          transferStatus.style.color = '#2ecc71';
                          setTimeout(() => transferCurrencyModal.classList.remove('show'), 2000);
                      }).catch((error) => {
                            senderRef.child('currency').set(senderBalance);
                            transferStatus.textContent = '⚠️ فشل التحويل. لم يتم خصم المبلغ.';
                            transferStatus.style.color = '#e74c3c';
                      });
                  })
                  .catch((error) => {
                       transferStatus.textContent = '⚠️ حدث خطأ أثناء الخصم. حاول مرة أخرى.';
                       transferStatus.style.color = '#e74c3c';
                  })
                  .finally(() => {
                       confirmTransferBtn.disabled = false;
                  });
          });
      });
  }

  // NEW/UPDATED: Fishing System Functions
  function initFishingArea() {
      const canvas = document.getElementById('fishingAreaCanvas');
      if (!canvas || !window.THREE) return;

      canvas.style.left = FISHING_ZONE.x + 'px';
      canvas.style.top = FISHING_ZONE.y + 'px';

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, FISHING_ZONE.width / FISHING_ZONE.height, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true });
      renderer.setSize(FISHING_ZONE.width, FISHING_ZONE.height);

      const geometry = new THREE.PlaneGeometry(60, 5, 128, 128); // Stretched for wide view
      const material = new THREE.ShaderMaterial({
          uniforms: { time: { value: 1.0 } },
          vertexShader: `
              uniform float time;
              varying vec2 vUv;
              void main() {
                  vUv = uv;
                  vec3 pos = position;
                  pos.z += sin(pos.x * 5.0 + time * 1.5) * 0.05 + sin(pos.y * 10.0 + time * 2.0) * 0.05;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
              }
          `,
          fragmentShader: `
              varying vec2 vUv;
              void main() {
                  vec3 color = vec3(0.1, 0.3, 0.7);
                  gl_FragColor = vec4(color, 0.8);
              }
          `,
          transparent: true
      });

      const water = new THREE.Mesh(geometry, material);
      water.rotation.x = -Math.PI / 2;
      scene.add(water);

      camera.position.z = 1.5;
      camera.position.y = 2.5;
      camera.rotation.x = -0.8;

      const clock = new THREE.Clock();
      let animationFrameId;

      function animate() {
          animationFrameId = requestAnimationFrame(animate);
          material.uniforms.time.value = clock.getElapsedTime();
          renderer.render(scene, camera);
      }
      animate();
  }

  function startFishingEventTimer() {
    if (fishingEventInterval) clearInterval(fishingEventInterval);
    
    const checkTime = () => {
        const now = new Date();
        const hours = now.getUTCHours();
        const cycleHour = hours % 6; // 0-5 for a 6-hour cycle

        isFishingActive = cycleHour < 3; // Active for the first 3 hours of the cycle
        
        const canvas = document.getElementById('fishingAreaCanvas');
        if (isFishingActive) {
            canvas.classList.add('visible');
        } else {
            canvas.classList.remove('visible');
        }
        updateFishingStatusMessage();
    };

    checkTime(); // Initial check
    fishingEventInterval = setInterval(checkTime, 1000); // Check every second
  }
  
  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function updateFishingStatusMessage() {
      const now = new Date();
      const totalSecondsInDay = (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds();
      const totalSecondsInCycle = 6 * 3600;
      const secondsIntoCurrentCycle = totalSecondsInDay % totalSecondsInCycle;
      let timeRemaining;
      
      fishingStatusIndicator.style.display = 'block';

      if (isFishingActive) {
          timeRemaining = (3 * 3600) - secondsIntoCurrentCycle;
          fishingStatusIndicator.style.backgroundColor = 'rgba(0, 120, 200, 0.85)';
          fishingStatusIndicator.textContent = `البحيرة متاحة! تختفي خلال: ${formatTime(timeRemaining)}`;
      } else {
          timeRemaining = totalSecondsInCycle - secondsIntoCurrentCycle;
          fishingStatusIndicator.style.backgroundColor = 'rgba(100, 100, 100, 0.85)';
          fishingStatusIndicator.textContent = `البحيرة ستظهر خلال: ${formatTime(timeRemaining)}`;
      }
  }

  function checkFishingZone() {
      if (!localPlayerId || !isFishingActive) {
          // If fishing is not active globally, stop any local fishing timers
          if (fishingInterval) {
              clearInterval(fishingInterval);
              fishingInterval = null;
          }
          return;
      }

      const playerCenterX = localPlayerX + 25;
      const playerBottomY = localPlayerY + 80;

      const isInside = playerCenterX > FISHING_ZONE.x && 
                       playerCenterX < FISHING_ZONE.x + FISHING_ZONE.width &&
                       playerBottomY > FISHING_ZONE.y && 
                       playerBottomY < FISHING_ZONE.y + FISHING_ZONE.height;

      if (isInside) {
          if (fishingInterval === null) {
              fishingCountdown = FISHING_DURATION;
              fishingInterval = setInterval(() => {
                  fishingCountdown--;
                  // Update main fishing status indicator if player is fishing
                  fishingStatusIndicator.textContent = `🎣 جاري الصيد... (${fishingCountdown} ثانية)`;
                  if (fishingCountdown <= 0) {
                      awardFishingPrize();
                      fishingCountdown = FISHING_DURATION; // Reset for the next catch
                  }
              }, 1000);
          }
      } else {
          if (fishingInterval !== null) {
              clearInterval(fishingInterval);
              fishingInterval = null;
              updateFishingStatusMessage(); // Revert to event status message
          }
      }
  }

  function awardFishingPrize() {
    const playerPermanentDataRef = database.ref(`players_data/${localPlayerId}`);
    playerPermanentDataRef.child('currency').transaction((currentCurrency) => {
        return (currentCurrency || 0) + 1;
    });

    const playerElement = document.getElementById(`player-${localPlayerId}`);
    if (playerElement) {
        const rewardPopup = document.createElement('div');
        rewardPopup.className = 'reward-popup';
        rewardPopup.textContent = '🎣 +1';
        playerElement.appendChild(rewardPopup);
        setTimeout(() => {
            if(playerElement.contains(rewardPopup)) {
                playerElement.removeChild(rewardPopup);
            }
        }, 2000);
    }
  }
  
  window.addEventListener('resize', () => {
      if(activePlayers[localPlayerId]?.data) {
         cameraX = localPlayerX - (window.innerWidth / 2);
         cameraY = localPlayerY - (window.innerHeight / 2);
         applyCameraTransform();
      }
  });

});
