# 실험 3. 풀 Bean이 있으면 연결을 재사용하는가

풀은 연결을 빌려주고 돌려받는 관리 객체다. 반환된 연결을 다시 사용할 수 있는지는 HTTP 응답과 연결 상태에도 달려 있다.

## 측정 조건

Java 8u452, Spring 4.3.16, HttpClient 4.5.5의 동일한 RestTemplate과 풀을 사용했다. 동일한 로컬 JDK HttpServer로 POST를 순차 20회씩 보냈다. 첫 구간은 레거시 유틸의 `Connection: close`, 두 번째는 해당 헤더 없는 요청이다. 두 구간 사이에 서버가 기록한 원격 포트 집합을 비웠다. 이는 동시 부하나 운영 처리량 측정이 아니다.

## 실제 결과

2026-09-07 `docker compose build`의 `ConnectionReuseTest` 출력:

```text
CONNECTION_REUSE calls=20 close=20 keepAlive=1 available=1
Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
```

| 관찰 항목 | close 헤더 있음 | close 헤더 없음 |
|---|---:|---:|
| 서버가 본 서로 다른 클라이언트 포트 | 20 | 1 |
| 완료 뒤 풀의 available | 0 | 1 |

서버의 원격 포트는 이 짧은 순차 실험에서 연결 식별의 대용값이다. 패킷 캡처로 SYN을 센 결과는 아니다. HTTPS/TLS 비용이나 실제 지연 개선율은 여기서 측정하지 않았다.

## Lesson Learned

1. 풀의 존재만으로 커넥션 재사용을 성과로 주장할 수 없다. 요청 헤더, 서버의 keep-alive 정책, 응답 소비와 연결 반환을 함께 확인해야 한다.
2. 비공개 레거시 서비스에는 C1 이전부터 풀 Bean이 있었다. 이번 변경을 “풀 신규 도입”으로 표현하지 않는다.
3. close 제거 시 서버 idle timeout과 stale connection 처리도 검토해야 한다. 재시도로 POST를 중복 실행할 수 있으므로 무조건 재시도를 추가하지 않는다.
4. 풀 대기 timeout, TCP 연결 timeout, 응답 read timeout은 서로 다른 대기를 제한한다. 다음 실험에서는 시작 시 고정한 설정과 실패 결과를 함께 다룬다.

## 직접 확인

```bash
docker run --rm --network none --entrypoint mvn b2g-resttemplate-lab-lab -o -Dtest=ConnectionReuseTest test
```

## 근거

- [Apache HttpClient 4.5 connection management](https://hc.apache.org/httpcomponents-client-4.5.x/current/tutorial/html/connmgmt.html)
