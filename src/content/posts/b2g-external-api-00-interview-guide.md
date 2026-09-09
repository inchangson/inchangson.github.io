---
title: "외부 연동 개선 경험을 코드와 실험으로 설명하려면"
description: "응급 출동과 생활 이상 징후 분석 연동의 Sender 및 RestTemplate 회고 안내"
pubDate: 2026-09-08
updatedDate: 2026-09-10
draft: true
category: backend
subcategory: api-integration
series: external-api-integration
seriesOrder: 0
seriesLabel: "시작하기"
tags: [java, spring, resttemplate, retrospective, interview]
---

“외부 API 호출을 공통화했습니다”라는 말에는 여러 일이 들어갈 수 있다. 중복 전송 코드를 옮긴 것인지, timeout과 예외 정책까지 통일한 것인지 구분해야 한다. 이 연재는 기관형 돌봄 서비스의 응급 출동 연동과 생활 이상 징후 분석 연동을 실제 변경 이력과 Java 8 데모로 다시 읽은 기록이다.

확인된 직접 변경은 응급 출동 Sender 생성과 호출부 적용, 생활 이상 징후 분석 요청 및 응답 로그의 공통 호출 경로 이동이다. 연동처별 Sender, 공통 HTTP 유틸리티와 커넥션 풀 전체를 개인 구현으로 넓히지 않는다. 회고 실험도 과거 운영 효과가 아니라 당시 구조의 동작과 한계를 확인한 결과다.

## 읽는 순서

| 순서 | 글 | 핵심 질문 |
|---:|---|---|
| 1 | [Sender 책임을 옮긴 이유](/blog/b2g-external-api-01-sender-boundary) | 업무 정책과 공급자 계약을 어디서 나누는가 |
| 2 | [새 RestTemplate의 timeout 공유](/blog/b2g-external-api-02-shared-factory) | wrapper, factory, client와 pool 중 무엇을 공유하는가 |
| 3 | [pool과 연결 재사용](/blog/b2g-external-api-03-pool-reuse) | close 헤더와 leased, available, pending은 무엇을 뜻하는가 |
| 4 | [timeout과 업무 결과](/blog/b2g-external-api-04-outcome-log) | 결과 불명, 업무 거절, 로그와 트랜잭션은 어떻게 다른가 |

외부 호출 이후의 업무 상태까지 공부하려면 [엑셀 입력을 작업 상태로 바꾸는 가입 흐름](/blog/care-b2b-registration-01-excel-state-pipeline)과 [일일안부 재전송의 상태 경계](/blog/care-b2c-daily-regard-workflow)를 이어서 볼 수 있다. 이벤트 조회와 상품 권한의 경계는 [TV 이상 징후 API의 책임](/blog/care-b2c-tv-anomaly-policy)에서 다룬다.

## 공개 근거와 재현 범위

아래 링크는 글 보강 전 기준 커밋으로 고정했다. 데모는 실제 주소, 인증 정보와 업무 데이터를 제거하고 전송과 판정 흐름만 줄여 옮겼다. 운영 시스템의 전체 통합 테스트는 아니다.

| 자료 | 사용할 때 |
|---|---|
| [실제 변경 이력](https://github.com/inchangson/inchangson.github.io/blob/3a4919b7d5f361dfe71d1a8358ba80b8252d9b3a/docs/b2g-resttemplate-retrospective/history.md) | 직접 구현, 팀 변경과 중간 철회를 구분 |
| [원본과 데모의 대응](https://github.com/inchangson/inchangson.github.io/blob/3a4919b7d5f361dfe71d1a8358ba80b8252d9b3a/docs/b2g-resttemplate-retrospective/source-map.md) | 복제한 흐름과 생략한 경계 확인 |
| [실행 안내](https://github.com/inchangson/inchangson.github.io/blob/3a4919b7d5f361dfe71d1a8358ba80b8252d9b3a/lab/b2g-resttemplate-lab/README.md) | Java 8 Docker 테스트 실행 |

```bash
cd lab/b2g-resttemplate-lab
docker compose build
docker run --rm --network none --entrypoint mvn b2g-resttemplate-lab-lab -o test
```

기본 테스트는 네 클래스, 총 10개다. 로컬 loopback 스텁만 호출하며 실제 외부 시스템에는 요청하지 않는다.

| 테스트 | 확인하는 주장 |
|---|---|
| `LegacyBehaviorTest` 4개 | HTTP와 업무 판정 차이, 500, read timeout, 목적지 제한 |
| `SharedFactoryTimeoutTest` 1개 | 같은 factory의 timeout 설정 간섭 |
| `ConnectionReuseTest` 1개 | close 유무에 따른 연결 수와 유휴 연결 |
| `ImprovedBehaviorTest` 4개 | 명시적 결과와 로그, 연결 거절, pool 대기, 설정 격리 |

## 1분 답변 예시

> 기관형 돌봄 서비스에서 응급 출동사와 생활 이상 징후 분석 시스템의 외부 호출 경계를 정리했습니다. 응급 출동 Sender를 만들고 업무 호출부에 적용했으며, 이상 징후 분석 요청과 응답 로그를 공통 호출 경로로 옮겼습니다. 회고에서는 당시 Java 8 환경의 데모를 만들어 공유 request factory의 timeout 간섭, close 헤더의 연결 재사용 영향과 HTTP 성공 및 업무 성공의 차이를 확인했습니다. 모든 예외의 표준화나 외부 호출의 원자성까지 달성한 것으로 넓히지 않습니다.

20회 로컬 순차 호출에서 close 헤더 구간은 원격 포트 20개, 미사용 구간은 1개였다. 이는 연결 재사용 관찰값이며 운영 처리량이나 지연 개선 수치가 아니다. 200회 프로파일은 고정 client 구간의 전체 JUnit 시간이 더 길었고 조건도 완전히 같지 않아 성능 원인을 확정하지 않았다.

다시 설계한다면 전송 실패, 결과 불명과 업무 거절을 먼저 구분하고 호출자가 재시도, 결과 조회 또는 보상을 선택할 수 있게 하겠다. 그다음 요청 중 공유 설정 변경을 없애고 로그 저장 실패를 별도로 주입해 원래 호출 결과와 관찰 기록의 실패를 분리하겠다.
