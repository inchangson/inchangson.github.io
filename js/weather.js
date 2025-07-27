// 날씨 정보 기능 (함수 기반)

// 전역 변수들
let weatherInfo;
let weatherLocation;
let weatherTemp;
let weatherDesc;
const apiKey = 'c87ee07d6a4c08a4532f96689beb0d20'; // 실제 API 키로 교체 필요
const baseUrl = 'https://api.openweathermap.org/data/2.5/weather';

// DOM 요소 초기화
function initWeatherElements() {
    weatherInfo = document.getElementById('weather-info');
    weatherLocation = document.querySelector('.weather-location');
    weatherTemp = document.querySelector('.weather-temp');
    weatherDesc = document.querySelector('.weather-desc');
}

// 현재 위치 가져오기
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                getWeatherData(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                console.error('Unable to get location information:', error);
                showDefaultWeather();
            }
        );
    } else {
        console.error('Browser does not support geolocation.');
        showDefaultWeather();
    }
}

// 날씨 데이터 가져오기
async function getWeatherData(lat, lon) {
    try {
        // API 키가 없는 경우 기본 데이터 표시
        // if (apiKey === 'YOUR_API_KEY') {
        //     showDefaultWeather();
        //     return;
        // }
        
        const url = `${baseUrl}?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=en`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Unable to fetch weather data.');
        }
        
        const data = await response.json();
        displayWeather(data);
        
    } catch (error) {
        console.error('Weather information error:', error);
        showDefaultWeather();
    }
}

// 날씨 표시
function displayWeather(data) {
    const location = data.name;
    const temp = Math.round(data.main.temp);
    const description = data.weather[0].description;
    
    if (weatherLocation) weatherLocation.textContent = location;
    if (weatherTemp) weatherTemp.textContent = `${temp}°C`;
    if (weatherDesc) weatherDesc.textContent = description;
}

// 기본 날씨 표시
function showDefaultWeather() {
    if (weatherLocation) weatherLocation.textContent = 'Seoul, South Korea';
    if (weatherTemp) weatherTemp.textContent = '22°C';
    if (weatherDesc) weatherDesc.textContent = 'Clear';
}

// 수동으로 위치 설정 (테스트용)
function setCustomLocation(city) {
    // API call to find coordinates by city name (actual implementation)
    console.log(`Fetching weather information for ${city}.`);
    if (weatherLocation) weatherLocation.textContent = city;
}

// 초기화 함수
function initWeather() {
    initWeatherElements();
    getCurrentLocation();
}

// 페이지 로드 시 날씨 매니저 초기화
document.addEventListener('DOMContentLoaded', initWeather);