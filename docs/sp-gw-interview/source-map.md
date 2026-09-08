# sp-gw 면접 준비용 소스 맵

분석 기준: 비공개 이력. 원본 로컬 루트: `private-workspace`.

이 문서와 세 편의 글은 원본 코드를 정적으로 읽고 작성했다. 실행 가능한 Demo는 만들지 않았다. 학습용 입력·출력과 후속 실험 계획을 운영 검증 결과로 해석하지 않는다. 내부 주소·접속 자격증명은 복제하지 않았다.

## 이 저장소만으로 공부하는 순서

1. [요청 변환](../../src/content/posts/sp-gw-01-request-contract.md): 입력·출력 표를 보고 기존 body, 복수 값, 제외 항목을 설명한다.
2. [설정 갱신](../../src/content/posts/sp-gw-02-config-refresh.md): 외부 설정 조회, 자기 갱신, Bus 연결, 실제 라우트 적용을 구분한다.
3. [배포](../../src/content/posts/sp-gw-03-delivery-boundary.md): 이미지 생성·CD 호출과 서비스 준비 상태의 차이를 설명한다.

각 글의 면접 답변을 읽고 “구현한 것 / 코드에서 기대하는 것 / 추가 검증할 것”을 자기 말로 구분해 답해 본다. 모든 글은 기존 회고 글 관례에 맞춰 `draft: true`이며 개발 서버에서 볼 수 있다. 공개 빌드의 목록에는 포함되지 않는다.

```sh
cd .
npm run dev
```

개발 서버의 `/blog/sp-gw-01-request-contract`, `/blog/sp-gw-02-config-refresh`, `/blog/sp-gw-03-delivery-boundary`에서 읽는다.

## 주장과 원본 파일 대응

아래 경로는 모두 위 원본 루트 기준이다. 외부 비공개 소스에 대한 웹 링크를 추정해 만들지 않고, 파일 경로와 커밋으로 추적한다.

| 설명 | 상대 경로 | 근거 커밋 |
|---|---|---|
| query→JSON·복수 값 | `src/main/java/com/example/apigateway/filter/QueryParameterToRequestBodyGatewayFilterFactory.java` | 비공개 이력 |
| excludes·원본 통과 분기 | 같은 파일 | 비공개 이력 |
| 과거 필터 테스트 | `src/test/java/com/example/apigateway/filter/QueryParameterToRequestBodyGatewayFilterFactoryTest.java` — 현재 HEAD에는 없음 | 비공개 이력 |
| 현재 context test | `src/test/java/com/example/apigateway/ApigatewayApplicationTests.java` | 기준 HEAD |
| Config import·내장 route 제거 | `src/main/resources/application.yaml` | 비공개 이력, 비공개 이력 |
| 자기 refresh·1시간 주기·base path | `src/main/java/com/example/apigateway/route/SelfRefreshScheduler.java` | 비공개 이력, 비공개 이력, 비공개 이력 |
| Bus 의존성 | `build.gradle` | 비공개 이력 |
| WebClient 생성 | `src/main/java/com/example/apigateway/support/WebClientConfig.java` | 비공개 이력 |
| 로컬 실행 구성 | `skaffold.yaml`, `Dockerfile.local` | 비공개 이력 |
| 환경 입력과 주입 | `charts/local-values.yaml`, `charts/development-values.yaml`, `charts/gateway-example/templates/deployment.yaml` | 비공개 이력, 비공개 이력 |
| JAR·이미지·CD 호출 | `cicd/Jenkinsfile_development`, `Dockerfile.development` | 비공개 이력 |

## 원본에서 확인하는 명령

다음은 조회 명령이며 설정 변경이나 배포를 실행하지 않는다.

```sh
# 독립 실험용 checkout 디렉터리에서 실행
# 원본 이력 조회 명령은 비공개로 관리한다.
# 원본 이력 조회 명령은 비공개로 관리한다.
# 원본 이력 조회 명령은 비공개로 관리한다.
# 원본 이력 조회 명령은 비공개로 관리한다.
```

## 개인 기여와 프로젝트 기능의 구분

커밋 이력에서 요청 변환, Config 연동, self-refresh, Bus 의존성 추가, 배포 구성은 `son-inchang` 작성 이력으로 확인했다. 인증·Rewrite 전략·응답 정규화에는 공동 작업자의 구현이 있으므로 해당 기능 전체를 개인 기여로 나열하지 않았다.

인증 검증의 세부 구현과 환경별 검증 상태는 비공개로 관리한다.

## 확인하지 않은 범위

Config Server의 저장 방식과 파일 캐시, 실제 Bus 발행 주체, 운영 라우트 목록, 다중 인스턴스 전파 지연, 개발계 CD Job 구현, 성능·가용성 개선 수치는 이 분석의 근거에 포함되지 않는다. 현재 Java 테스트 실행 결과도 제시하지 않았다. 추후 Demo를 추가한다면 학습용 축약 구현인지 원본 Spring 필터를 실행하는 재현인지 명시하고, 실행 명령·기대 결과·실측 결과를 함께 남긴다.
