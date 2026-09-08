# 실험 5. 외부 호출 중 스레드는 어디서 기다리는가

실제로 실행한 Java 8 프로세스에서 async-profiler 4.0의 wall-clock 표본을 수집했다. CPU 사용 시간만 보는 대신 HTTP 응답 대기도 표본에 포함시키려는 선택이다.

## 재현 환경과 조건

- 2026-09-07, Linux ARM64, Temurin 8u452, Boot 1.5.12, Spring 4.3.16, HttpClient 4.5.5.
- async-profiler 4.0, `event=wall`, `interval=10ms`, JVM 시작부터 종료까지 수집.
- 각 JVM에서 POST 200회 순차 호출. 스텁은 응답 전에 20ms 대기한다.
- `docker run --network none`으로 컨테이너 내부 loopback만 사용했다.
- 레거시: 매번 factory timeout setter와 `Connection: close`. 개선군: 고정 factory와 keep-alive, 결과 파싱·호출별 로그.
- 두 수집 실행은 일부 시간이 겹쳤다. 독립된 성능 벤치마크가 아니며, 서버·클라이언트·Spring 초기화 스택이 함께 포함된다.

## 원시 결과

```text
PROFILE mode=legacy calls=200 delayMs=20 distinctPorts=200
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 6.074 sec

PROFILE mode=fixed calls=200 delayMs=20 distinctPorts=1
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 15.604 sec
```

이 시간은 JUnit이 기록한 테스트 클래스 전체 시간이다. 요청 latency p50/p95가 아니다. 개선군이 더 오래 걸렸다는 관찰을 숨기지 않는다. 두 군의 파싱·로그 작업도 동일하지 않고, 로컬 HTTP 서버·TCP 동작의 영향도 분리하지 않았다. 원인을 delayed ACK 등으로 단정하려면 패킷 캡처와 한 변수씩 바꾸는 추가 실험이 필요하다.

## 산출물과 검증 상태

- [레거시 wall-clock flame graph](../results/legacy-wall.html)
- [고정 client wall-clock flame graph](../results/fixed-wall.html)

HTML 내부 심볼에서 `ProfileWorkload.runLegacy` / `ProfileWorkload.runFixed`, `LegacyHttpConnectionUtils` / `FixedPartnerClient.post`, `RestTemplate`, `SocketInputStream_socketRead0`가 확인됐다. 이것은 수집 파일의 정적 검사이며 **브라우저 화면 검증은 미완료**다. 실행 환경에서 연결 가능한 브라우저 목록이 비어 있었다. 그래프의 폭·비율을 눈으로 확인했다고 주장하지 않는다.

| 파일 | SHA-256 |
|---|---|
| legacy-wall.html | `d01242986c95174a6079746e8ffdba46b0c59834b02e867d519993c3a9177249` |
| fixed-wall.html | `bb32de85248d3fa25ca286062c58c3078fee39710bd499edd192e7911eb2046d` |

## 다시 수집하기

이 명령은 Linux ARM64 이미지 기준이다. 컨테이너 이름이 이미 존재하면 다른 이름을 사용한다. 의존성과 profiler 다운로드는 빌드 시에만 수행한다.

```bash
docker compose build
docker build -f Dockerfile.profile -t b2g-resttemplate-profile .
docker run --name b2g-profile-new --network none b2g-resttemplate-profile \
  '-DargLine=-agentpath:/opt/async-profiler/lib/libasyncProfiler.so=start,event=wall,interval=10ms,file=/tmp/profile.html' \
  -Dtest=ProfileWorkload -Dlab.profile.mode=legacy test
docker cp b2g-profile-new:/tmp/profile.html ./legacy-new-wall.html
```

`lab.profile.mode=fixed`로 바꾸면 개선군이다. 그래프를 열고 먼저 `ProfileWorkload.runLegacy` 또는 `runFixed`를 검색해 업무 호출 하위 스택을 확인한다. 초기화·서버 대기 스택을 요청 처리 비용으로 합치지 않는다. wall-clock 비율을 CPU 점유율로 읽지 않는다.

## Lesson Learned

연결 수 감소와 처리 시간 단축은 별도 주장이다. 이번 결과는 연결 재사용을 보여주지만 속도 향상을 보여주지 않았다. 운영 성과에는 코드에서 확인한 책임 분리·공통화만 사용하고, 이 프로파일은 회고 학습의 근거로 남긴다.

## 공식 자료

- [async-profiler 4.0 release](https://github.com/async-profiler/async-profiler/releases/tag/v4.0)
- [async-profiler profiling modes](https://github.com/async-profiler/async-profiler/blob/v4.0/docs/ProfilingModes.md)
