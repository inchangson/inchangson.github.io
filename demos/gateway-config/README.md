# Gateway Config 면접 준비와 Demo

블로그 저장소 루트 기준 안내다. 사내 Config Server checkout 없이도 1~4편의 결과 해설, 고정 측정 JSON과 아래 학습 모델을 이용할 수 있다.

## 읽는 순서

1. [Composition과 BeanPostProcessor](../../src/content/posts/gateway-config-01-composition-boundary.md): 직접 구현·상속과 비교하고 wrapper의 타입 및 반환 계약 한계를 설명한다.
2. [파일과 메모리 캐시](../../src/content/posts/gateway-config-02-filesystem-memory-cache.md): metadata와 내용 읽기·파싱을 구분하고 mtime·key 범위를 점검한다.
3. [Bus와 RabbitMQ](../../src/content/posts/gateway-config-03-bus-rabbitmq.md): 저장과 실행 반영을 구분하고 MQ 선택 제약과 미구현 자동화를 설명한다.
4. [부하 실험의 증거](../../src/content/posts/gateway-config-04-load-test-evidence.md): 수치, 방법론 한계, 개선 실험과 면접 답변을 연결한다.

각 글은 `draft: true`이며 개발 서버에서 볼 수 있다. 공개 build에는 포함되지 않는다. Demo와 측정 JSON도 `public` 밖에 있어 정적 사이트에 복사되지 않는다.

## 블로그만으로 실행하는 학습용 Demo

Python 3 표준 라이브러리만 사용한다.

```bash
python3 demos/gateway-config/cache_boundary_demo.py
```

기대 출력:

```text
same_mtime: 1
same_second: 1
next_second: 2
concurrent_miss_loads: 2
```

임시 파일에 version 2를 써도 동일 mtime/동일 초 key에서는 1을 돌려주는 것을 확인한다. 그 뒤 key의 초가 바뀌면 2를 돌려준다. 동시성 Demo는 개별 map 연산을 lock으로 보호하되 get/load/put을 묶지 않고, barrier로 두 요청이 동시에 miss하는 실행 순서를 만든다. 정상 완료 시 임시 디렉터리는 자동 정리된다.

이것은 원리 설명용 축소 모델이다. Spring Boot·YAML 병합·BeanPostProcessor·RabbitMQ·Gateway를 실행하지 않으며, 프로덕션 구현 복제본이나 성능 측정 도구가 아니다. 숫자 2는 이 모델에서 강제한 interleaving의 결과다.

## 실제 측정 근거

[고정 JSON](2026-09-08-results.json)은 원본 커밋 비공개 이력의 `load-test/results/latest.json`과 동일한 2026-09-08 00:02 KST 측정값이다. 원본에서 비공개 변경 이력으로도 확인한다. 실제 Spring HTTP 1,976건과 mock API 1,900건으로 총 3,876건이다. `success`는 HTTP 200 기준이다. raw 요청별 latency는 없고 percentile과 합계가 저장되어 있다. 4편에서 결과를 해설한다.

당시 원본 checkout:

```text
private-workspace
```

기준 커밋 비공개 이력. 원본이 있다면 루트에서 `./load-test/scripts/run.sh`로 재실행한다. Java 17, Python 3, curl과 Gradle 의존성이 필요하다. 8888/18080 포트를 사용하고 `load-test/fixtures`를 다시 만든다. 이 스크립트는 원본 프로젝트가 필요하므로 블로그에서 직접 실행하는 명령이 아니다.

| 근거 | 원본 루트 기준 경로 |
|---|---|
| wrapper 등록 | `src/main/java/com/example/configserver/StateAwareNativeConfigServerConfiguration.java` |
| mtime·cache·fallback | `src/main/java/com/example/configserver/StateAwareNativeEnvironmentRepository.java` |
| 실제 부하 발생기 | `load-test/scripts/load_test.py` |
| SQLite/YAML 생성 | `load-test/scripts/generate_fixtures.py` |
| mock API | `load-test/scripts/mock_server.py` |
| 최초 보고서 | `docs/load-test/2026-09-08-report.md` |

최초 보고서의 “38 Pod”, “delegate file read” 표현은 4편에서 측정 코드에 맞게 보완했다. 실제로는 최대 38 workers이고 native property-source 로그는 물리 I/O 계측이 아니다. readiness가 일부 설정을 미리 읽으므로 엄밀한 빈 cache 실험도 아니다. Bus는 꺼져 있었다.

## 5분 복습

- 요구: 설정 해석을 재작성하지 않고 state와 반복 구성 비용 절감.
- 선택: native Bean을 composition으로 장식, 작은 설정은 로컬 캐시, 가용 MQ인 RabbitMQ로 refresh 신호 전달.
- 근거: 원본 코드·커밋의 실측 JSON, 공식 버전 소스, 블로그의 축소 Demo.
- 한계: mtime 충돌, 불완전한 key, 동시 miss, 파일 저장과 Bus 발행 사이의 미구현 연결.
- 숫자: 초기 조회 p95 69.207 ms, warm p95 11.223 ms. 짧고 조건이 다른 구간이므로 운영 개선 배수로 주장하지 않는다.
- 다음 검증: 동일 조건 native baseline, 충분한 지속·반복 실험, 응답 내용 검증, 실제 client/Bus/route 적용 관측.
