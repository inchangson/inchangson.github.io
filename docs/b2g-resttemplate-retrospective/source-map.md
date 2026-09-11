# 프로덕션 코드 근거 지도

> 공개 글과 데모에는 원본 클래스 전체를 복제하지 않는다. 주장에 필요한 제어 흐름만 남기고 사내 URL, 인증 값, 개인정보, 실제 payload와 운영 식별자는 제거한다.

## 근거 구성

업무 저장소의 경로와 커밋 식별자는 공개하지 않는다. 대신 어떤 코드 경계와 변경을 함께 읽어 주장을 확인했는지 기록한다.

| 영역 | 확인한 비공개 근거 | 공개 검증 자료 | 확인할 사실 |
|---|---|---|---|
| 파트너 A Sender | 전용 Sender와 업무 호출부의 변경 전후 | `LegacyPartnerASender`, `LegacyBehaviorTest` | 검증, HTTP 상태 판정, 전송·로그 순서 |
| 파트너 B Sender | 전용 Sender와 응답 해석 경로의 변경 전후 | `LegacyPartnerBSender`, `LegacyBehaviorTest` | 업무 결과 코드 판정과 로그 경계 |
| HTTP 공통 코드 | 공통 utility와 request factory 설정 | `LegacyHttpConnectionUtils`, timeout 테스트 | Map 결과 계약, timeout 변경, 상태 예외 처리 |
| RestTemplate Bean | C1 이전 설정과 이후 호출부 | pool·connection-close 실험 | 기존 pool의 범위와 연결 재사용 여부 |
| 업무 호출부 | Sender 도입 전후 Service 변경 | 문서의 축약 의사 코드 | 적용 정책, 호출 시점, 부분 성공 가능성 |

## 데모에 보존할 Legacy 구조

- singleton `RestTemplate`과 하위 request factory 공유
- 사용자 지정 timeout에서 factory의 connect/read 값을 런타임 변경
- 같은 factory를 받는 새 `RestTemplate` 생성
- 정상 반환 뒤에만 기본 timeout 복구
- 모든 요청에 `Connection: close` 추가
- `HttpStatusCodeException`만 결과 Map으로 변환
- `statusCode`, `result`, `exceptionMessage` 문자열 키 계약
- 파트너 A와 B가 HTTP·업무 성공을 서로 다르게 판정

## 의도적으로 복제하지 않을 것

데모 Sender는 원본 public 메서드 전체가 아니라 핵심 판정·전송 흐름을 축소한다. 파트너 A의 바깥 catch(false 반환), 파트너 B의 void public 메서드·내부 오류 코드와 DB 로그 예외 처리는 생략되어 있다. 따라서 데모 예외의 최종 도착 지점과 메서드 반환형을 운영 코드의 동작으로 소급하지 않는다.

- 암호화 대상 개인정보와 암호화 키
- 사내 API 설정 조회와 실제 endpoint
- DB 함수·Mapper 전체 및 운영 로그 스키마
- 실제 기관 코드, 사용자·단말 식별자, 요청·응답 전문
- 동작 주장에 필요하지 않은 Controller·Service 코드

## 기여 경계

- 본인 작성 이력: 파트너 A Sender 생성과 반복 보완, HTTP utility 적용, 대상 검사, 파트너 B 전송·로그 공통화 참여
- 팀 변경: 파트너 B Sender 초기 생성·연결과 후속 로그 보완, timeout 상수 변경, 이전 코드 삭제
- 커넥션 풀: C1 이전 배경 설정. 이번 성과나 개인 구현으로 계산하지 않음
- 로컬 개선군: 현재 회고를 위한 새 구현. 2023년 프로덕션 성과로 계산하지 않음

## 직후 보완을 남기는 이유

분석 종료 이후에는 merge 두 건을 거쳐 관련 수정 세 건이 이어졌다. 파트너 A 응급 이벤트 타입과 호출 위치, 파트너 B 삭제 타입이 다시 수정됐다. 이는 공통화가 끝난 직후에도 연동별 계약과 호출 시점 회귀가 남을 수 있음을 보여준다.

이 후기는 “리팩터링이 실패했다”는 단정이 아니다. 당시 자동화된 계약·회귀 테스트 근거가 보이지 않는 상황에서, 삭제와 정리만으로 동작 보존을 증명할 수 없다는 사례로 사용한다.
