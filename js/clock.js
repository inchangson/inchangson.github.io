// 시계 기능 (함수 기반)

// 전역 변수들
let clockElement;
let dateElement;
let clockInterval;

// DOM 요소 초기화
function initClockElements() {
    clockElement = document.getElementById('clock');
    dateElement = document.getElementById('date');
}

// 요일 가져오기 함수
function getDayOfWeek(day) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
}

// 시간 업데이트 함수
function updateTime() {
    const now = new Date();
    
    // 시간 포맷팅
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    // 날짜 포맷팅
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dayOfWeek = getDayOfWeek(now.getDay());
    
    // 시간 표시
    if (clockElement) {
        clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
    
    // 날짜 표시
    if (dateElement) {
        dateElement.textContent = `${year}-${month}-${day} ${dayOfWeek}`;
    }
}

// 시계 시작 함수
function startClock() {
    updateTime();
    // 1초마다 시간 업데이트
    clockInterval = setInterval(updateTime, 1000);
}

// 초기화 함수
function initClock() {
    initClockElements();
    startClock();
}

// 페이지 로드 시 시계 초기화
document.addEventListener('DOMContentLoaded', initClock);
