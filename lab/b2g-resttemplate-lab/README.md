# B2G RestTemplate Java 8 Lab

legacy-service 종료점의 외부 호출 구조를 민감정보 없이 축소 복제하고, 확인 질문별로 테스트하는 독립 애플리케이션이다.

> 안전장치: 목적지는 코드에서 `localhost`, `127.0.0.1`, `::1`만 허용한다. 실제 PARTNER_B·PartnerA 주소와 인증 정보는 설정에 존재하지 않으며, 그 밖의 URL은 HTTP 연결 전에 거부한다.

Compose 실행 네트워크도 `internal: true`로 외부 통신을 차단하고, 데모 포트는 호스트의 `127.0.0.1`에만 공개한다. HTTP redirect는 비활성화한다. 이 설정은 과거 운영 구현이 아니라 실험의 안전장치다.

## 버전

| 항목 | 버전 |
|---|---|
| Java | Temurin 8u452, class major 52 |
| Spring Boot | 1.5.12.RELEASE |
| Spring Framework | 4.3.16.RELEASE |
| Apache HttpClient | 4.5.5 |
| Maven | 3.9.9 |

## 실행

```bash
docker compose build
docker compose up
```

개별 테스트는 다음과 같이 실행한다.

```bash
docker run --rm --network none --entrypoint mvn b2g-resttemplate-lab-lab -o test
```

애플리케이션 실행 뒤 다음 API로 수동 확인할 수 있다.

```bash
curl -X POST 'http://127.0.0.1:18080/lab/legacy/partnera/business-failure?timeoutMs=1000'
curl -X POST 'http://127.0.0.1:18080/lab/legacy/partnerb/business-failure?timeoutMs=1000'
curl -X POST 'http://127.0.0.1:18080/lab/legacy/partnera/delay-300?timeoutMs=50'
```

## 실험 기록

| 순서 | 질문 | 기록 |
|---:|---|---|
| 1 | HTTP 성공과 업무 성공은 같은가 | [결과·Lesson Learned](./lessons/01-http-and-business-outcome.md) |
| 2 | 새 RestTemplate이면 timeout도 독립적인가 | [결과·Lesson Learned](./lessons/02-shared-request-factory-timeout.md) |
| 3 | 풀 Bean이 있으면 연결을 재사용하는가 | [결과·Lesson Learned](./lessons/03-pool-and-connection-close.md) |
| 4 | timeout도 같은 결과·로그 규격으로 남는가 | [결과·Lesson Learned](./lessons/04-explicit-result-and-log.md) |

수치는 운영 성과가 아니라 구조와 실패 경로를 이해하기 위한 로컬 재현 결과다.
