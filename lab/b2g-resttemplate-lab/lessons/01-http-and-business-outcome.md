# 실험 1. HTTP 성공과 업무 성공은 같은가

## 가설

문자열 Map과 boolean만 사용하면 “HTTP 응답을 받음”, “업무가 승인됨”, “적용 대상이 아님”을 한 값에 섞기 쉽다. 같은 응답도 Sender별 구현에 따라 다르게 해석될 수 있다.

## 프로덕션 근거

- 파트너 A 종료점 코드는 주로 HTTP `200`을 성공으로 판정한다.
- 파트너 B 종료점 코드는 HTTP 상태와 body의 업무 결과 코드를 나눠 읽는다.
- `HttpConnectionUtils`는 HTTP 오류 응답은 Map으로 바꾸지만 read timeout처럼 HTTP 상태가 없는 실패는 그대로 전파한다.

## 재현 조건과 관찰 결과

아래 표는 축소 데모의 결과다. 데모의 파트너 A Sender는 **공통 전송·로그 함수 경계**를 드러내기 위해 실제 public Sender의 바깥 catch를 생략했다. 실제 B2G public Sender는 전송 예외를 서버 로그에 기록하고 false로 반환하는 경로가 있다. 데모에서 예외가 전파됐다고 운영 API까지 같은 예외가 전파됐다고 해석하면 안 된다. 파트너 B 데모의 boolean 반환도 비교용이다. 실제 파트너 B의 일부 public 발신 메서드는 void이며 내부 오류 코드·로그 경로를 사용한다.

| 입력 | 파트너 A | 파트너 B | 로그 |
|---|---|---|---|
| 200 + 업무 거절 | `true` | `false` | REQUEST, RESPONSE |
| HTTP 500 | `false` | N/A | REQUEST, RESPONSE |
| read timeout | 예외 전파 | N/A | REQUEST만 존재 |

2026-09-07 Docker 실행에서 네 테스트가 모두 통과했다. 실행 JVM은 Temurin `1.8.0_452` ARM64이고, 생성된 `DemoApplication.class`의 major version은 52였다. Spring Boot `1.5.12.RELEASE`가 관리하는 Spring Framework `4.3.16.RELEASE`, 명시한 HttpClient `4.5.5` 조합으로 실행했다.

```text
Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
openjdk version "1.8.0_452"
major version: 52
```

## Lesson Learned

1. HTTP status는 transport 사실이고 외부 업무 코드는 공급자 계약이다.
2. 공통 함수가 있어도 반환 Map과 boolean의 의미가 Sender마다 다르면 예외 규격이 표준화된 것은 아니다.
3. 장애 복원용 로그라면 정상 응답보다 응답이 없는 경로를 먼저 설계해야 한다.
4. 이 결과는 로컬 구조 재현이며 2023년 운영 장애가 실제로 발생했다는 증거가 아니다.
