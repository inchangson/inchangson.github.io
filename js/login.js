// 로그인 기능 (함수 기반)

// 전역 변수들
let loginPopup;
let loginForm;
let closePopupBtn;
let welcomeUser;
let userNameSpan;
let logoutBtn;
let isLoggedIn = false;
let currentUser = null;

// DOM 요소 초기화
function initLoginElements() {
    loginPopup = document.getElementById('login-popup');
    loginForm = document.getElementById('login-form');
    closePopupBtn = document.getElementById('close-popup');
    welcomeUser = document.getElementById('welcome-user');
    userNameSpan = document.getElementById('user-name');
    logoutBtn = document.getElementById('logout-btn');
}

// 로그인 상태 확인
function checkLoginStatus() {
    const savedUser = localStorage.getItem('italianBrainrotUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isLoggedIn = true;
        showWelcomeMessage();
    }
}

// 로그인 처리
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    
    // 간단한 인증 (실제로는 서버에서 처리해야 함)
    if (username) {
        currentUser = {
            username: username,
            loginTime: new Date().toISOString()
        };
        
        // 로컬 스토리지에 사용자 정보 저장
        localStorage.setItem('italianBrainrotUser', JSON.stringify(currentUser));
        
        isLoggedIn = true;
        closePopup();
        showWelcomeMessage();
        
        // 폼 초기화
        loginForm.reset();
    } else {
        alert('Please enter username!');
    }
}

// 팝업 표시
function showPopup() {
    if (loginPopup) {
        loginPopup.classList.add('active');
    }
}

// 팝업 닫기
function closePopup() {
    if (loginPopup) {
        loginPopup.classList.remove('active');
    }
}

// 환영 메시지 표시
function showWelcomeMessage() {
    if (currentUser && welcomeUser && userNameSpan) {
        userNameSpan.textContent = currentUser.username;
        welcomeUser.classList.remove('hidden');
    }
}

// 로그아웃
function logout() {
    localStorage.removeItem('italianBrainrotUser');
    isLoggedIn = false;
    currentUser = null;
    if (welcomeUser) {
        welcomeUser.classList.add('hidden');
    }
    showPopup();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (closePopupBtn) {
        closePopupBtn.addEventListener('click', closePopup);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // 팝업 외부 클릭 시 닫기
    if (loginPopup) {
        loginPopup.addEventListener('click', (e) => {
            if (e.target === loginPopup) {
                closePopup();
            }
        });
    }
}

// 초기화 함수
function initLogin() {
    initLoginElements();
    checkLoginStatus();
    setupEventListeners();
    
    // 페이지 로드 시 로그인 팝업 표시 (로그인되지 않은 경우)
    if (!isLoggedIn) {
        setTimeout(() => {
            showPopup();
        }, 1000);
    }
}

// 페이지 로드 시 로그인 매니저 초기화
document.addEventListener('DOMContentLoaded', initLogin); 