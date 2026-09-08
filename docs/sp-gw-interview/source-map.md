# sp-gw 면접 준비용 소스 맵

분석 기준: `9c7dc077380a062a4a992f906c05009c15e6221d`. 원본 로컬 루트: `/Users/son-inchang/Work/mobility/backup/GatewayPoC/sp-gw`.

이 문서와 세 편의 글은 원본 코드를 정적으로 읽고 작성했다. 실행 가능한 Demo는 만들지 않았다. 학습용 입력·출력과 후속 실험 계획을 운영 검증 결과로 해석하지 않는다. 내부 주소·접속 자격증명은 복제하지 않았다.

## 이 저장소만으로 공부하는 순서

1. [요청 변환](../../src/content/posts/sp-gw-01-request-contract.md): 입력·출력 표를 보고 기존 body, 복수 값, 제외 항목을 설명한다.
2. [설정 갱신](../../src/content/posts/sp-gw-02-config-refresh.md): 외부 설정 조회, 자기 갱신, Bus 연결, 실제 라우트 적용을 구분한다.
3. [배포](../../src/content/posts/sp-gw-03-delivery-boundary.md): 이미지 생성·CD 호출과 서비스 준비 상태의 차이를 설명한다.

각 글의 면접 답변을 읽고 “구현한 것 / 코드에서 기대하는 것 / 추가 검증할 것”을 자기 말로 구분해 답해 본다. 모든 글은 기존 회고 글 관례에 맞춰 `draft: true`이며 개발 서버에서 볼 수 있다. 공개 빌드의 목록에는 포함되지 않는다.

```sh
cd /Users/son-inchang/Career/inchangson.github.io
npm run dev
```

개발 서버의 `/blog/sp-gw-01-request-contract`, `/blog/sp-gw-02-config-refresh`, `/blog/sp-gw-03-delivery-boundary`에서 읽는다.

## 주장과 원본 파일 대응

아래 경로는 모두 위 원본 루트 기준이다. 외부 비공개 소스에 대한 웹 링크를 추정해 만들지 않고, 파일 경로와 커밋으로 추적한다.

| 설명 | 상대 경로 | 근거 커밋 |
|---|---|---|
| query→JSON·복수 값 | `src/main/java/com/avis/apigateway/filter/QueryParameterToRequestBodyGatewayFilterFactory.java` | `8c1e8cb` |
| excludes·원본 통과 분기 | 같은 파일 | `48d48ea` |
| 과거 필터 테스트 | `src/test/java/com/avis/apigateway/filter/QueryParameterToRequestBodyGatewayFilterFactoryTest.java` — 현재 HEAD에는 없음 | `6f3b8cf` |
| 현재 context test | `src/test/java/com/avis/apigateway/ApigatewayApplicationTests.java` | 기준 HEAD |
| Config import·내장 route 제거 | `src/main/resources/application.yaml` | `7963f6d`, `9c7dc07` |
| 자기 refresh·1시간 주기·base path | `src/main/java/com/avis/apigateway/route/SelfRefreshScheduler.java` | `54f835d`, `8c5e611`, `3188dce` |
| Bus 의존성 | `build.gradle` | `26d6627` |
| WebClient 생성 | `src/main/java/com/avis/apigateway/support/WebClientConfig.java` | `54f835d` |
| 로컬 실행 구성 | `skaffold.yaml`, `Dockerfile.local` | `8011bf2` |
| 환경 입력과 주입 | `charts/local-values.yaml`, `charts/ipcdev-values.yaml`, `charts/sp-gw/templates/deployment.yaml` | `dbffd20`, `5df3484` |
| JAR·이미지·CD 호출 | `cicd/Jenkinsfile_ipcdev`, `Dockerfile.ipcdev` | `00aa077` |

## 원본에서 확인하는 명령

다음은 조회 명령이며 설정 변경이나 배포를 실행하지 않는다.

```sh
cd /Users/son-inchang/Work/mobility/backup/GatewayPoC/sp-gw
git show 9c7dc07 -- src/main/resources/application.yaml
git show 48d48ea -- src/main/java/com/avis/apigateway/filter/QueryParameterToRequestBodyGatewayFilterFactory.java
git show 6f3b8cf:src/test/java/com/avis/apigateway/filter/QueryParameterToRequestBodyGatewayFilterFactoryTest.java
git log --format='%h %an %ad %s' --date=short -- src/main/java/com/avis/apigateway/route/SelfRefreshScheduler.java
```

## 개인 기여와 프로젝트 기능의 구분

커밋 이력에서 요청 변환, Config 연동, self-refresh, Bus 의존성 추가, 배포 구성은 `son-inchang` 작성 이력으로 확인했다. 인증·Rewrite 전략·응답 정규화에는 공동 작업자의 구현이 있으므로 해당 기능 전체를 개인 기여로 나열하지 않았다.

현재 소스를 읽을 때 주의할 점도 있다. `JwtValidator`는 payload와 일부 claim을 확인하지만 서명 검증을 구현하지 않는다. `GlobalMetricsFilter`는 처리 시간을 DEBUG 로그로 남기며 직접 Micrometer 계측을 등록하지 않는다. 클래스 이름이나 Actuator exposure 설정만으로 완성된 인증·Prometheus 관측 체계를 주장하지 않는다. 프로젝트 README의 초기 필터 설명도 현재 패키지와 달라 이번 글은 구현 파일을 기준으로 삼았다.

## 확인하지 않은 범위

Config Server의 저장 방식과 파일 캐시, 실제 Bus 발행 주체, 운영 라우트 목록, 다중 인스턴스 전파 지연, 개발계 CD Job 구현, 성능·가용성 개선 수치는 이 분석의 근거에 포함되지 않는다. 현재 Java 테스트 실행 결과도 제시하지 않았다. 추후 Demo를 추가한다면 학습용 축약 구현인지 원본 Spring 필터를 실행하는 재현인지 명시하고, 실행 명령·기대 결과·실측 결과를 함께 남긴다.
