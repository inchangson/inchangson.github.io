---
title: "외부 연동 개선 경험을 코드와 실험으로 설명하려면"
description: "B2G Sender·RestTemplate 회고를 읽고 Java 8 Demo를 실행하며 면접 답변을 준비하는 안내"
pubDate: 2026-09-08
draft: true
category: backend
subcategory: api-integration
series: external-api-integration
seriesOrder: 0
seriesLabel: "시작하기"
tags: [java, spring, resttemplate, retrospective, interview]
---

“외부 API 호출을 공통화했습니다”라는 말에는 여러 일이 들어갈 수 있다. 중복 코드를 옮겼다는 뜻일 수도 있고, timeout과 예외를 같은 정책으로 다룬다는 뜻일 수도 있다. 면접에서는 어떤 문제를 어떤 코드로 해결했으며 어디까지 검증했는지 이어서 설명해야 한다.

이 연재는 기관형 돌봄 서비스의 ATAM·Telecop 발신 로직을 다시 읽은 기록이다. 실제 B2G 구현에서는 연동처별 Sender와 공통 HTTP utility, 요청·응답 로그 경로를 정리했다. 회고에서는 당시 버전의 Java 8 Demo로 공유 factory와 연결 재사용, 실패 결과를 확인했다. 과거 구현과 현재의 개선 제안을 구분해 읽는 것이 출발점이다.

## 이 저장소 하나로 공부하는 순서

| 순서 | 글 | 읽고 설명할 수 있어야 하는 것 |
|---:|---|---|
| 1 | [Sender 책임을 옮긴 이유](/blog/b2g-external-api-01-sender-boundary) | Service의 업무 정책과 공급자 계약을 왜 나누는가 |
| 2 | [새 RestTemplate의 timeout 공유](/blog/b2g-external-api-02-shared-factory) | wrapper·factory·client·pool 중 무엇을 공유하는가 |
| 3 | [pool과 연결 재사용](/blog/b2g-external-api-03-pool-reuse) | close 헤더, leased·available·pending, pool 대기의 의미 |
| 4 | [timeout과 업무 결과](/blog/b2g-external-api-04-outcome-log) | 응답 불명, 업무 거절, 로그·재시도·트랜잭션의 차이 |

각 글은 서비스 맥락과 원리, 실제 Demo 코드, 결과와 한계, 면접 후속 질문으로 이어진다. 마지막 답변 문장을 외우기보다 연결된 테스트의 입력을 바꾸면 무엇이 달라질지 설명해 보는 편이 좋다.

## 원본 저장소가 없어도 확인할 수 있는 근거

모든 경로는 `inchangson.github.io` 저장소 루트 기준이다. 아래 링크는 근거 파일이 있는 커밋으로 고정했다. 현재 checkout이 이후 버전이라면 경로로 파일을 찾고, 원래 실험을 확인할 때는 링크의 커밋을 기준으로 읽는다.

| 자료 | 현재 저장소 경로 | 사용할 때 |
|---|---|---|
| 실제 변경 이력 | [docs/b2g-resttemplate-retrospective/history.md](https://github.com/inchangson/inchangson.github.io/blob/6fe3c578d608df417f3f2f4eb144323e8edc079c/docs/b2g-resttemplate-retrospective/history.md) | 직접 구현과 팀 변경, 중간 시도·철회를 구분 |
| 원본과 Demo의 대응 | [docs/b2g-resttemplate-retrospective/source-map.md](https://github.com/inchangson/inchangson.github.io/blob/6fe3c578d608df417f3f2f4eb144323e8edc079c/docs/b2g-resttemplate-retrospective/source-map.md) | 복제한 제어 흐름과 생략한 경계 확인 |
| 실행 안내 | [lab/b2g-resttemplate-lab/README.md](https://github.com/inchangson/inchangson.github.io/blob/6fe3c578d608df417f3f2f4eb144323e8edc079c/lab/b2g-resttemplate-lab/README.md) | Java 8 Docker 실행 |
| 가설·결과·Lesson Learned | `lab/b2g-resttemplate-lab/lessons/` | 관찰값과 미검증 항목을 확인 |
| 실제 프로파일 | `lab/b2g-resttemplate-lab/results/` | 수집된 wall-clock HTML을 직접 열기 |
| 커밋별 복습 | [docs/current-work/docs-b2g-resttemplate-retrospective/cognitive/README.md](https://github.com/inchangson/inchangson.github.io/blob/6fe3c578d608df417f3f2f4eb144323e8edc079c/docs/current-work/docs-b2g-resttemplate-retrospective/cognitive/README.md) | 변경 이유와 파일별 검토 지점 복습 |

원본 SA01의 사내 의존성과 데이터베이스를 준비할 필요는 없다. Demo는 전송·판정 흐름만 줄여 옮겼다. 원본의 모든 업무 동작을 보존한 통합 테스트는 아니며, 실제 Telecop의 바깥 catch와 ATAM의 void·DB 처리 경계를 생략한 부분도 각 글에 표시했다.

## 먼저 한 번 실행하기

첫 실행은 Docker가 필요하다. 아래 명령은 저장소 루트에서 시작한다. 빌드에서는 Maven 의존성을 내려받고 Java 8로 컴파일·테스트한다. 이어지는 명시적 테스트 실행에는 외부 네트워크를 붙이지 않는다.

```bash
cd lab/b2g-resttemplate-lab
docker compose build
docker run --rm --network none --entrypoint mvn b2g-resttemplate-lab-lab -o test
```

현재 기본 테스트는 네 클래스, 총 10개다. 프로파일 전용 `ProfileWorkload`는 이름과 실행 선택을 분리했기 때문에 이 기본 실행에 포함되지 않는다. 여기서 다루는 프로파일과 테스트 결과는 2026-09-07 실행 기록이다.

| 테스트 클래스 | 개수 | 확인하는 주장 |
|---|---:|---|
| `LegacyBehaviorTest` | 4 | HTTP·업무 판정 차이, 500, read timeout, 목적지 제한 |
| `SharedFactoryTimeoutTest` | 1 | 같은 factory의 설정 간섭 |
| `ConnectionReuseTest` | 1 | close 유무의 연결 수와 유휴 연결 |
| `ImprovedBehaviorTest` | 4 | 명시적 결과·로그, 연결 거절, pool 대기, 설정 격리 |

실제 ATAM·Telecop 서버에는 요청하지 않는다. 스텁은 컨테이너 내부 `127.0.0.1`에 있고 애플리케이션도 loopback 목적지만 허용한다. 운영 URL이나 인증 정보를 넣어 실행할 필요가 없다.

## 1분 답변을 만드는 순서

답변은 맥락 → 문제 → 직접 변경 → 검증 → 한계로 연결한다. 다음 문장은 확인된 근거에 맞춘 초안이다. 당시 본인의 맥락에 맞춰 표현을 조정하되, 수집하지 않은 운영 지표를 추가하지 않는다.

> 기관형 돌봄 서비스에서 시니어 정보와 응급 이벤트를 외부 시스템에 전달했습니다. 공급자별 파라미터와 전송·로그 코드가 여러 위치에 있어 변경 경계를 정리할 필요가 있었습니다. 저는 Telecop Sender 생성과 공통 호출 적용, ATAM 요청·응답 로그 공통화에 참여했습니다. 회고 과정에서는 당시 Java 8 환경의 데모를 만들어 공유 request factory의 timeout 간섭과 close 헤더의 연결 재사용 영향을 확인했습니다. 다만 당시 구현이 모든 예외를 표준화하거나 원격 호출의 원자성을 보장했다고 말할 수는 없습니다. 운영 성능 개선율도 측정 근거가 없어 제시하지 않습니다.

이 답변에서 면접관이 구현을 묻는다면 1편의 변경 이력으로, Spring 동작을 묻는다면 2편의 참조·요청 생성 시점으로, 성능을 묻는다면 3편의 측정 조건으로, 실패 복구를 묻는다면 4편의 결과 불명과 멱등성으로 이어갈 수 있다.

## 수치를 설명할 때 함께 말할 조건

20회 비교에서 close 헤더 구간은 원격 포트 20개, 미사용 구간은 1개였다. 이는 로컬 순차 호출에서 연결 재사용을 관찰한 값이다. 운영 동시 처리량이나 TLS 비용을 측정한 값은 아니다.

200회 프로파일에서는 고정 client의 전체 JUnit 시간이 오히려 길었다. 실행이 일부 겹치고 호출부 작업도 달라 원인을 확정하지 못했다. 결과가 기대와 다를 때 조건과 한계를 밝히는 것까지 실험의 일부다. 현재 flame graph의 브라우저 화면 검증은 미완료이며, 원시 파일 생성과 화면 검증을 구분한다.

## 다음 개선안을 질문받는다면

먼저 성공·실패 계약을 고정하고 호출자별 결과 처리 차이를 테스트하겠다. 이후 요청 중 공유 설정 변경을 없애고, 전송 결과·업무 결과·로그 저장 결과를 구분하겠다. 재전송은 상대 시스템의 결과 조회와 멱등성 지원 여부를 확인한 뒤 설계하겠다.

이 순서는 코드 정리만으로 끝나지 않고, 업무 의미를 보존하면서 실패를 관찰하고 복구할 수 있게 하려는 판단이다. 현재 Demo에서 확인한 부분과 실제 서비스에 적용하려면 더 필요한 부분을 이어서 설명하는 것이 이 연재의 목표다.
