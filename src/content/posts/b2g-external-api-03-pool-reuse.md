---
title: "커넥션 풀이 있는데 왜 매번 새 연결을 만들었을까"
description: "Connection close 비교와 실제 Java 8 프로파일에서 연결 수와 처리 시간을 구분한다"
pubDate: 2026-09-07
updatedDate: 2026-09-08
draft: true
category: backend
subcategory: api-integration
series: external-api-integration
seriesOrder: 3
seriesLabel: "3편"
tags: [java, spring, resttemplate, retrospective]
---

풀 Bean이 존재해도 연결이 재사용된다고 단정할 수 없다. B2G 종료점의 HTTP utility는 모든 요청에 `Connection: close`를 설정했다. 풀 설정만 보고 “커넥션 재사용을 도입했다”고 설명하면 코드의 다른 절반을 놓치게 된다.

## 무엇을 비교했나

비공개 레거시 서비스의 풀은 C1 이전부터 있던 설정이다. 이를 Java 8, Boot 1.5.12, HttpClient 4.5.5 데모에 축소 복제하고 로컬 JDK HttpServer를 사용했다. 실제 파트너 A·B 주소와 인증 정보는 없다.

동일한 RestTemplate과 동일한 풀로 POST 20회를 순차 실행했다. 먼저 레거시 utility를 거쳐 close 헤더를 넣고, 다음 구간에서는 헤더 없이 호출했다. 서버가 본 클라이언트 포트 집합과 완료 뒤 풀의 유휴 연결을 기록했다.

## 실제 관찰값

`ConnectionReuseTest` 실행 결과는 다음과 같다.

| 관찰 항목 | close 있음 | close 없음 |
|---|---:|---:|
| 호출 횟수 | 20 | 20 |
| 서로 다른 원격 포트 | 20 | 1 |
| 풀의 available 연결 | 0 | 1 |

20회라는 작은 순차 실험에서 원격 포트는 연결을 구분하는 대용값이다. TCP SYN을 패킷 캡처로 센 결과는 아니다. 그럼에도 같은 풀을 두고 헤더 유무에 따라 연결 재사용이 달라짐을 확인했다.

풀은 연결을 빌려주는 구조이고, keep-alive는 연결을 다음 요청에 쓸 수 있도록 유지하는 동작이다. 서버가 연결을 닫거나 응답을 소비하지 못하면 풀에 재사용 가능한 연결이 남지 않을 수 있다.

## 실제 프로파일도 수집했다

별도 workload에서는 각 JVM이 20ms 지연 스텁을 200회 호출했다. async-profiler 4.0의 `event=wall,interval=10ms`로 JVM 시작부터 종료까지 수집했다. 실행 컨테이너는 `--network none`이며 내부 loopback만 사용했다.

| 항목 | 레거시 | 고정 client |
|---|---:|---:|
| 서로 다른 원격 포트 | 200 | 1 |
| JUnit 클래스 전체 시간 | 6.074초 | 15.604초 |

**고정 client가 더 오래 걸렸다.** 이 값은 요청별 p95가 아니며, 수집 실행이 일부 겹쳤고 초기화·스텁·결과 파싱과 로그 작업도 포함한다. 연결 수가 줄었다는 사실을 속도 향상률로 바꿀 수 없는 이유다.

로컬 서버의 TCP 동작이나 delayed ACK를 원인으로 의심할 수는 있어도, 패킷 캡처 없이 확정하지 않는다. 다음 진단에서는 호출부 작업을 같게 하고 한 변수씩 바꾸며 요청 latency와 패킷 시점을 함께 봐야 한다.

## flame graph 검증 상태

프로파일과 재현 명령 (`lab/b2g-resttemplate-lab/lessons/05-wall-clock-profile.md`)에 실제 HTML 두 개와 SHA-256을 보존했다. 내부 심볼에는 workload, RestTemplate, HttpClient 관련 경로와 socket read가 들어 있다.

현재 실행 환경에 연결된 브라우저가 없어 **화면 검증은 미완료**다. 그래프를 눈으로 확인했다거나 특정 프레임의 비율을 측정했다고 쓰지 않는다. 직접 열 때는 workload 프레임을 검색하고 초기화·서버 스레드를 분리해서 읽어야 한다. wall-clock 표본은 CPU 사용률과 다르다.

## pool은 연결을 미리 모두 만들어 두는 설정이 아니다

최대 연결 수를 100으로 설정했다고 시작할 때 소켓 100개가 모두 생성되는 것은 아니다. 요청이 연결을 요구하면 pool은 해당 route에서 재사용 가능한 연결을 찾아 빌려주거나, 여유 한도 안에서 새 연결을 제공한다. 이 설명은 이 Lab의 Apache HttpClient 4.5 기반 HTTP/1.1 호출 기준이다.

route는 연결 경로다. 단순 직접 연결에서는 대상 호스트·포트·scheme으로 생각할 수 있지만 프록시나 터널이 들어가면 경로도 고려한다. 전체 한도 `maxTotal`이 남아 있어도 특정 route 한도에 도달했다면 해당 목적지의 요청은 기다릴 수 있다.

| pool 상태 | 뜻 | 장애 분석에서 볼 점 |
|---|---|---|
| leased | 요청에 빌려준 연결 | 응답이 느리거나 반환되지 않는가 |
| available | 재사용 가능한 유휴 연결 | 서버가 이미 닫은 연결이 남는가 |
| pending | 연결 대기 요청 | route 한도·응답 지연 때문에 대기하는가 |

이 구분과 route별 제한은 [Apache 연결 관리 문서](https://hc.apache.org/httpcomponents-client-4.5.x/current/tutorial/html/connmgmt.html)의 pooling·multithreaded execution 절에서 확인할 수 있다.

## 응답을 받은 뒤 연결은 어디로 돌아가는가

정상적인 재사용은 “요청 전송 → 응답 body 소비 → 연결 반환 → 다음 요청에 대여”까지 이어져야 한다. close 헤더를 사용하면 그 요청에 쓴 연결을 다음 요청에 계속 쓰지 않게 된다. manager가 객체로 남아 있는 것과 실제 연결이 살아 돌아오는 것은 별개다.

현재 Demo는 `String.class`로 응답을 받으므로 반환 전에 응답 body를 문자열로 읽는다. 대용량 다운로드를 위해 스트림을 직접 다루는 코드에서는 누가 body를 읽고 닫는지 따로 봐야 한다. 이번 작은 JSON 응답의 결과를 모든 streaming 호출에 일반화하지 않는다.

### 코드로 보는 관측 지점

`ConnectionReuseTest`는 두 구간에서 동일한 manager를 사용하고 스텁의 포트 집합만 초기화한다. 마지막에 다음을 확인한다.

```java
assertThat(closedConnections).isEqualTo(20);
assertThat(reusedConnections).isEqualTo(1);
assertThat(manager.getTotalStats().getLeased()).isZero();
assertThat(manager.getTotalStats().getAvailable()).isEqualTo(1);
```

close 구간의 유휴 연결 0개도 별도로 검사한다. 단, 두 구간은 호출 API와 body 구성이 완전히 같지 않다. 첫 구간은 utility의 JSON body·timeout 설정을 지나고, 두 번째는 body 없는 `postForObject`다. 연결 재사용 비교에는 도움이 되지만 엄밀하게 한 변수만 바꾼 latency 벤치마크로 소개하면 안 된다.

## pool 고갈은 연결 실패와 어떻게 다른가

연결을 새로 맺지 못해서 생기는 실패와, 이미 사용 중인 연결이 반환되기를 기다리다 생기는 실패는 해결책이 다르다. 후자에서는 서버로 두 번째 요청을 보내기도 전에 대기 한도를 넘을 수 있다.

개선 테스트에서는 pool 한도를 1로 두고 첫 요청에 600ms 지연을 줬다. manager의 leased가 1이 된 것을 확인한 뒤 두 번째 요청을 보냈다. 두 번째는 50ms pool 대기 한도를 넘고 첫 번째는 1000ms read 한도 안에서 성공한다.

이때 connect timeout만 짧게 해도 pool 대기를 제한하지 못한다. 면접에서 timeout을 설명할 때 세 setter 이름을 외우는 데 그치지 않고, 요청이 어디에서 멈춰 있는지 연결하면 이해를 보여줄 수 있다.

## 직접 실행하고 프로파일을 읽는 순서

| 파일 | 확인 대상 |
|---|---|
| [ConnectionReuseTest.java](https://github.com/inchangson/inchangson.github.io/blob/master/lab/b2g-resttemplate-lab/src/test/java/com/example/b2glab/ConnectionReuseTest.java) | 20회 비교의 조건과 assertions |
| [PartnerStubServer.java](https://github.com/inchangson/inchangson.github.io/blob/master/lab/b2g-resttemplate-lab/src/main/java/com/example/b2glab/stub/PartnerStubServer.java) | `remotePorts` 집계와 지연 응답 |
| [ImprovedBehaviorTest.java](https://github.com/inchangson/inchangson.github.io/blob/master/lab/b2g-resttemplate-lab/src/test/java/com/example/b2glab/ImprovedBehaviorTest.java) | `exhaustedPoolHasDifferentTimeoutFromSocketRead` |
| [ProfileWorkload.java](https://github.com/inchangson/inchangson.github.io/blob/master/lab/b2g-resttemplate-lab/src/test/java/com/example/b2glab/ProfileWorkload.java) | 200회 실행의 legacy/fixed 호출 차이 |
| [05-wall-clock-profile.md](https://github.com/inchangson/inchangson.github.io/blob/master/lab/b2g-resttemplate-lab/lessons/05-wall-clock-profile.md) | 실행 명령·환경·HTML 해시 |

프로파일 원본은 `lab/b2g-resttemplate-lab/results/legacy-wall.html`과 `fixed-wall.html`이다. GitHub에서는 HTML 소스가 보이므로 저장소에서 파일을 열거나 내려받아 브라우저로 확인한다.

```bash
# 저장소 루트에서 시작; 첫 실행은 docker compose build 필요
cd lab/b2g-resttemplate-lab
docker run --rm --network none --entrypoint mvn b2g-resttemplate-lab-lab \
  -o -Dtest=ConnectionReuseTest test
```

flame graph는 아래에서 위로 호출 스택을 읽고, 가로 폭은 선택한 수집 방식의 표본 비중으로 읽는다. 이 기록에서는 `ProfileWorkload.runLegacy` 또는 `runFixed`를 먼저 찾는다. 전체 그래프에는 HTTP 서버 스레드와 Spring 초기화도 들어 있기 때문이다. CPU 표본이 아닌 wall 표본을 보고 “이 함수가 CPU를 많이 쓴다”고 답하면 측정 의미가 바뀐다.

## 면접에서 이어질 질문

### “pool을 얼마나 크게 설정해야 하나요?”

“현재 연결 점유 시간과 동시 요청, 파트너 허용 부하, 애플리케이션 스레드 여유를 함께 봅니다. route별 pending과 pool 대기 오류가 생기는 이유부터 확인합니다. 응답 지연 때문에 연결이 오래 점유되는 상황에서 크기만 늘리면 상대 부하와 내부 대기 자원이 같이 늘 수 있습니다. 이번 Lab은 운영 최적 크기를 산정하지 않았습니다.”

### “연결 수가 줄었는데 왜 더 느렸나요?”

“이번 프로파일 실행의 전체 JUnit 시간은 개선군이 더 길었습니다. 호출부 작업과 실행 시점이 동일하지 않고 TCP 동작도 분리하지 않아 원인을 확정할 수 없습니다. 관찰한 연결 수 감소만 말하고, 성능 원인 분석은 동일 workload·독립 실행·패킷 시점 측정을 추가해 판단하겠습니다.”

### “close를 넣은 당시 이유는 알 수 없나요?”

“헤더가 설정됐다는 구현 사실은 확인했지만 당시 네트워크 제약이나 장애 대응 의도까지 확인하지는 못했습니다. 레거시를 다시 볼 때 제거 가능성을 실험하는 것과, 원래 선택을 잘못됐다고 단정하는 것은 구분하겠습니다.”

## 운영 적용 전에 검토할 것

close를 제거하면 서버의 idle timeout, stale connection 검사, 응답 소비·연결 반환을 함께 봐야 한다. 풀을 크게 만드는 것은 상대 서버로 보내는 동시 부하를 늘리는 선택이기도 하다. 풀 대기 한도와 상위 요청 기한을 함께 설정해야 한다.

재사용 연결 실패에 무조건 POST 재시도를 넣으면 부작용이 중복될 수 있다. 상대 시스템의 멱등성 계약이나 결과 조회가 필요한 이유다. 이 데모 개선군은 자동 재시도를 끈다.

면접용 표현은 “기존 풀과 close 헤더를 함께 분석하고 로컬 재현으로 연결 재사용 여부를 확인했다”까지다. 풀 신규 도입이나 운영 응답시간 감소는 이번 근거로 주장하지 않는다.

[이전: 공유 factory](/blog/b2g-external-api-02-shared-factory) · [다음: 결과와 로그](/blog/b2g-external-api-04-outcome-log)

## 참고

- 20회 비교 실험 (`lab/b2g-resttemplate-lab/lessons/03-pool-and-connection-close.md`)
- [Apache HttpClient 4.5 connection management](https://hc.apache.org/httpcomponents-client-4.5.x/current/tutorial/html/connmgmt.html)
- [async-profiler 4.0](https://github.com/async-profiler/async-profiler/releases/tag/v4.0)
