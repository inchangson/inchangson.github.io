// Italian Brainrot 배경 이미지 및 명언 관리 (함수 기반)

// 전역 변수들
let backgroundContainer;
let quoteElement;
let quoteMeaningElement;
let currentImageElement;
let currentIndex = 0;
const changeInterval = 30000; // 30초마다 이미지 변경

// Italian Brainrot 이미지와 명언 데이터
const italianBrainrotData = [
    {
        image: './img/BrrBrrPatapim.webp',
        quote: { text: "Brr Brr Patapim", meaning: "Brr brr Patapim, il mio cappello è pieno di Slim!" }
    },
    {
        image: './img/BonecaAmbalabu.webp',
        quote: { text: "Boneca Ambalabu", meaning: "Boneca Ambalabu. Entitas jahat yang banyak meresahkan masyarakat akhir-akhir ini. Membuat para ilmuwan berpikir keras untuk mencari cara menanganinya. Salah satunya ilmuwan terkenal yaitu profesor rusdi, mengungkapkan hasil penelitiannya terhadap boneka ambalabu ini." }
    },
    {
        image: './img/LiriliLarila.webp',
        quote: { text: "Lirilì Larilà", meaning: "Lirilí Larilà, elefante nel deserto che cammina quà e là con la sua conchiglia e l'orologio che fa tic tac." }
    },
    {
        image: './img/TungTung.webp',
        quote: { text: "Tung Tung Tung Tung Tung Tung Tung Tung Tung Sahur", meaning: "Tung Tung Tung Tung Tung Tung Tung Tung Tung Sahur. Anomali mengerikan yang hanya keluar pada sahur." }
    },
    {
        image: './img/BombardiroCrocodilo.webp',
        quote: { text: "Bombardiro Crocodilo", meaning: "Bombardiro Crocodilo, un fottuto alligatore volante che vola e bombarda i bambini a Gaza e in Palestina, Non crede in Allah e ama le bombe." }
    },
    {
        image: './img/TralaleroTralala.webp',
        quote: { text: "Tralalero Tralala", meaning: "Tralalero Tralala, porco Dio e porco Allah." }
    }
];

// DOM 요소 초기화
function initElements() {
    backgroundContainer = document.getElementById('background-container');
    quoteElement = document.getElementById('quote-text');
    quoteMeaningElement = document.getElementById('quote-meaning');
    currentImageElement = document.getElementById('current-image');
}

// 명언 표시 함수
function displayQuote(quote) {
    if (quoteElement && quoteMeaningElement) {
        quoteElement.textContent = quote.text;
        quoteMeaningElement.textContent = quote.meaning;
    }
}

// 배경 이미지 표시 함수
function displayBackground(imageUrl) {
    if (!backgroundContainer) return;
    
    // 이미지 프리로드
    const img = new Image();
    img.onload = () => {
        backgroundContainer.style.backgroundImage = `url(${imageUrl})`;
    };
    img.onerror = () => {
        console.error('Failed to load image:', imageUrl);
        // 기본 배경색으로 폴백
        backgroundContainer.style.backgroundImage = 'none';
        backgroundContainer.style.backgroundColor = '#667eea';
    };
    img.src = imageUrl;
}

// 이미지 박스 표시 함수
function displayImageBox(imageUrl) {
    if (!currentImageElement) return;
    
    currentImageElement.src = imageUrl;
    currentImageElement.onerror = () => {
        console.error('Failed to load image for box:', imageUrl);
        currentImageElement.style.display = 'none';
    };
    currentImageElement.onload = () => {
        currentImageElement.style.display = 'block';
    };
}

// 랜덤 배경과 명언 설정
function setRandomBackground() {
    currentIndex = localStorage.getItem('currentIndex');
    currentIndex = (currentIndex + Math.ceil(Math.random() * (italianBrainrotData.length - 1))) % italianBrainrotData.length;
    const randomData = italianBrainrotData[currentIndex];
    localStorage.setItem('currentIndex', currentIndex);

    displayBackground(randomData.image);
    displayImageBox(randomData.image);
    displayQuote(randomData.quote);
}

// 초기화 함수
function init() {
    initElements();
    
    // 초기 배경 이미지 설정
    setRandomBackground();
    
    // 주기적으로 배경 이미지 변경
    setInterval(() => {
        setRandomBackground();
    }, changeInterval);
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init); 