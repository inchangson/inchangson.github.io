---
title: "커넥션 풀이 있는데 왜 매번 새 연결을 만들었을까"
description: "Connection close 비교와 실제 Java 8 프로파일에서 연결 수와 처리 시간을 구분한다"
pubDate: 2026-09-07
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

SA01의 풀은 C1 이전부터 있던 설정이다. 이를 Java 8, Boot 1.5.12, HttpClient 4.5.5 데모에 축소 복제하고 로컬 JDK HttpServer를 사용했다. 실제 ATAM·Telecop 주소와 인증 정보는 없다.

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

## 운영 적용 전에 검토할 것

close를 제거하면 서버의 idle timeout, stale connection 검사, 응답 소비·연결 반환을 함께 봐야 한다. 풀을 크게 만드는 것은 상대 서버로 보내는 동시 부하를 늘리는 선택이기도 하다. 풀 대기 한도와 상위 요청 기한을 함께 설정해야 한다.

재사용 연결 실패에 무조건 POST 재시도를 넣으면 부작용이 중복될 수 있다. 상대 시스템의 멱등성 계약이나 결과 조회가 필요한 이유다. 이 데모 개선군은 자동 재시도를 끈다.

면접용 표현은 “기존 풀과 close 헤더를 함께 분석하고 로컬 재현으로 연결 재사용 여부를 확인했다”까지다. 풀 신규 도입이나 운영 응답시간 감소는 이번 근거로 주장하지 않는다.

[이전: 공유 factory](/blog/b2g-external-api-02-shared-factory) · [다음: 결과와 로그](/blog/b2g-external-api-04-outcome-log)

## 참고

- 20회 비교 실험 (`lab/b2g-resttemplate-lab/lessons/03-pool-and-connection-close.md`)
- [Apache HttpClient 4.5 connection management](https://hc.apache.org/httpcomponents-client-4.5.x/current/tutorial/html/connmgmt.html)
- [async-profiler 4.0](https://github.com/async-profiler/async-profiler/releases/tag/v4.0)
