# B2G Sender 공통화는 어떤 순서로 진행됐는가

기관 단위 시니어 정보와 응급 이벤트를 관리하는 서비스에서, 기관의 연동 대상 여부와 외부 규약에 맞는 발신 코드가 여러 Service와 PushSender에 섞여 있었다. C1은 이 발신 책임을 PartnerA·PARTNER_B Sender로 모으는 과정이다. Excel·배치·B2C 모델 개선은 이 글의 범위가 아니다.

## 근거 범위

legacy-service 비공개 분석 구간를 사용한다. 시작은 종료의 조상이 아니며, 공통 조상은 비공개 이력다. 날짜 범위나 단일 브랜치의 선형 이력으로 치환하지 않는다. 현재 dirty checkout은 근거에서 제외한다.

아래는 핵심 네 파일(Sender 두 개, HTTP utility, 이전 utility)을 변경한 **비병합 커밋 25개**다. C1 전체 커밋 수가 아니다. author 원문에서 `son-inchang`과 정확히 일치하는 경우만 “직접”으로 표기하고, 나머지는 “팀”으로 익명화했다. 병합 커밋의 작성자를 유입 구현 전체의 작성자로 세지 않는다. 표의 날짜는 author date다.

| 날짜 | SHA | 귀속 | 변경과 읽을 지점 |
|---|---|---|---|
| 07-26 | 비공개 이력 | 직접 | PartnerA Sender 생성. 초기에는 동기·스레드 기반 경로가 함께 남음 |
| 07-26 | 비공개 이력 | 팀 | HTTP utility 생성, PARTNER_B 발신 코드 리팩터링 시작 |
| 07-27 | 비공개 이력 | 직접 | PartnerA 등록·수정·삭제, 필수값 검사와 early return, 중복 경로 정리 |
| 07-28 | 비공개 이력 | 직접 | PartnerA 유효성 검사·파라미터와 호출 시점 보완. finally에서 호출하던 경로 변경 |
| 07-28 | 비공개 이력 | 직접 | PartnerA 응급 알림 발신 추가 |
| 07-31 | 비공개 이력 | 직접 | PartnerA 공통 호출 함수 개발 |
| 08-03 | 비공개 이력 | 팀 | PARTNER_B Sender 1차 개발과 HTTP utility 보완 |
| 08-04 | 비공개 이력 | 직접 | 공통 함수 적용과 중복 코드 제거 |
| 08-07 | 비공개 이력 | 직접 | PartnerA HTTP utility 적용 과정의 중간 변경 |
| 08-10 | 비공개 이력 | 팀 | PARTNER_B 연동 확대, PartnerC Sender 분리 시도 |
| 08-15 | 비공개 이력 | 팀 | PARTNER_B 호출부 대상 판정·공통 로직 이동, PartnerC 호출을 Service로 복귀 |
| 08-16 | 비공개 이력 | 직접 | PartnerA HTTP utility 적용 보완 |
| 08-17 | 비공개 이력 | 직접 | PartnerA 대상 검사 공통화, API 로그 공통 함수의 예외 처리 변경 |
| 08-17 | 비공개 이력 | 팀 | PARTNER_B 대상 판정 분리, import·의존성 정리 |
| 08-18 | 비공개 이력 | 직접 | 기관 가입 상태·기존 등록 확인. 중복 판정 자체는 별도 C2 주제 |
| 08-23 | 비공개 이력 | 팀 | 단말 수정의 PartnerC 성공 판정 조건 수정, HTTP 로깅 의존성 정리 |
| 08-23 | 비공개 이력 | 팀 | PARTNER_B Logger가 실제 Sender 클래스를 가리키도록 수정 |
| 08-24 | 비공개 이력 | 직접 | PARTNER_B 공통 함수에 요청·응답 DB/램프 로그 이동, 조기 반환 로그·부가정보 검사 보완 |
| 08-24 | 비공개 이력 | 직접 | PartnerA 공통 호출 반환 타입과 HTTP 예외 메시지 처리 보완 |
| 08-29 | 비공개 이력 | 팀 | timeout 상수 8,000 → 30,000ms. 모든 요청의 기한 보장은 아님 |
| 08-31 | 비공개 이력 | 팀 | PARTNER_B 전송 로그와 처리 로그 구분, 호출 순번 전달 |
| 09-01 | 비공개 이력 | 팀 | PARTNER_B 로그 관련 주석 보완 |
| 09-04 | 비공개 이력 | 팀 | PARTNER_B 처리 로그에 시작 시각·API 구분 보완 |
| 09-04 | 비공개 이력 | 팀 | 이전 PartnerA 발신 소스 삭제 |
| 09-04 | 비공개 이력 | 팀 | 이전 PARTNER_B 발신 소스 삭제, 선택한 종료점 |

표의 변경 해석은 부모 대비 diff와 종료 blob을 함께 읽은 분석이다. 제목만으로 배포·장애·처리량 개선을 추론하지 않는다. 원시 이메일·내부 이슈 번호·remote URL은 공개 문서에서 제외한다.

## As-Is에서 무엇이 어려웠는가

기존 `PartnerAService`, `PartnerBService`, `GMPSPushSender`, `RestTemplateUtils`에 공급자별 요청 구성과 발신이 나뉘어 있었다. 외부 규약을 바꿀 때 업무의 호출 시점과 HTTP 전송 세부 사항을 함께 따라가야 하는 구조였다.

다음은 책임 배치만 보여주는 의사 코드다. 실제 이름·payload·DB 처리를 생략했다.

```java
// Before: 업무 흐름이 외부 파라미터와 발신 세부 사항도 조립한다.
void changeSenior() {
    updateLocalState();
    Map<String, Object> payload = createPartnerPayload();
    pushSender.sendPartner(payload);
}

// After: 기관 정책과 업무 순서는 Service, 규약과 발신은 Sender로 이동한다.
void changeSenior() {
    updateLocalState();
    if (isPartnerEnabled()) partnerSender.sendSeniorChange();
}
```

이 코드는 원자성을 보여주지 않는다. 원격 요청과 로컬 변경의 실제 순서·반환값 검사는 호출자별로 확인해야 한다.

## 중간 시도와 최종 구조

PartnerC Sender는 생성 뒤 호출이 기존 Service로 복귀했고 비공개 이력에서 삭제됐다. 따라서 모든 외부 호출을 단일 계층으로 완성했다고 쓰지 않는다. 철회 이유는 사용자 확인이 필요한 맥락이다.

종료점의 PARTNER_B Sender는 부가정보 DB 갱신까지 맡는다. 엄격한 HTTP adapter만 남긴 구조는 아니다. Business Service도 호출자마다 실패를 다르게 취급한다. 단말 수정은 PartnerC·PartnerA 성공 여부를 확인하는 반면, `setSilver`는 PartnerA boolean을 검사하지 않고 성공 응답으로 진행하는 경로가 있다.

## 종료점의 실패 경로

| 경계 | 확인한 구현 | 남는 질문 |
|---|---|---|
| 공통 HTTP utility | HTTP 상태 예외를 문자열 Map으로 변환 | 상태 없는 ResourceAccessException은 다른 경로 |
| PartnerA 내부 전송·로그 함수 | 요청 로그 → 전송 → 응답 로그 | timeout이면 응답 DB 로그를 건너뛸 수 있음 |
| PartnerA public Sender | 전송 예외를 catch하여 서버 로그 후 false | 호출자가 false를 확인하는가 |
| PARTNER_B 내부 공통 함수 | 전송·파싱 예외를 코드로 바꾼 뒤 응답 로그 진행 | try 밖의 요청 로그 실패는 별도 경로 |
| 공유 factory | 요청별 setter, 정상 응답 후 기본값 복구 | 동시 덮어쓰기와 예외 뒤 설정 잔존 |
| 기존 pool | C1 이전부터 Bean 존재, utility는 close 헤더 사용 | 설정 존재와 연결 재사용은 별도 확인 |

외부 성공 후 DB 실패, 원격 처리 후 read timeout, 로그 저장 실패를 DB transaction 하나로 해소할 수 없다. B2G 종료점에 `REQUIRES_NEW`나 self proxy 구조는 없다. B2C의 구조·팀 변경을 이 구간이나 개인 구현으로 소급하지 않는다.

## 직후 보완

비공개 이력, 비공개 이력, 비공개 이력에는 PartnerA 응급 파라미터, 호출 위치, PARTNER_B 삭제 타입과 이벤트 타입 보완이 나타난다. 주 범위 밖의 관련 후속 diff로 읽는다. 호출부 삭제와 클래스 추출이 끝나도 파라미터·시점 회귀 검증은 필요하다는 사례다. 실제 장애 발생 여부와 당시 리뷰·운영 역할은 사용자 확인 대상으로 남긴다.

## 면접에서 설명할 수 있는 범위

“PartnerA Sender 생성과 공통 호출 함수 적용, PARTNER_B 요청·응답 로그 공통화에 참여했습니다. 업무 호출 시점과 공급자 규약을 분리하는 데 초점을 맞췄습니다. 다만 HTTP 공통화만으로 timeout 격리나 모든 실패의 로그 보존이 해결되지는 않았습니다. 회고에서는 당시 버전의 Java 8 데모로 공유 factory와 close 헤더의 영향을 재현했습니다.”

운영 장애율·속도 개선 수치는 확인하지 못했다. [실험 기록](../../lab/b2g-resttemplate-lab/README.md)의 수치는 로컬 측정값이며 당시 성과의 계량 지표가 아니다.
