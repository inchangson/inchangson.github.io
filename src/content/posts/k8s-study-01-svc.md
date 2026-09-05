---
title: 쿠버네티스 교과서 - Chap 03 서비스에 파드 연결하기
description: 서비스에 대한 기본적인 개념을 정리한 내용입니다.
pubDate: 2026-09-04
updatedDate: 2025-02-03
category: ops
subcategory: kubernetes
tags:
  - kubernetes
  - network
draft: true
---

# 쿠버네티스 서비스

## 파드의 IP 주소

* pod는 생성 시마다 클러스터 내에서 유효한 사설주소를 할당 받기 때문에 pod가 교체될 때마다 IP주소가 변경된다.
* 따라서 직접 IP 주소를 참조하면 안정적인 접근이 어렵다.

## 쿠버네티스 서비스 필요성과 역할

* 필요성
    * 위와같이 IP 주소 변경 문제는 일반적인 인터넷에서도 발생하는 문제이며 이를 해결하기 위해 DNS를 사용
        → 쿠버네티스에서도 동일하게 자체 DNS 서버와 쿠버네티스 서비스를 통해 해결
* 기능
    * address discovery
    * 통신 트래픽 라우팅
    * 로드 밸런싱
* 정의: 워크로드의(파드 집합) 단일 외부 엔드포인트([https://kubernetes.io/docs/concepts/services-networking/service/](https://kubernetes.io/docs/concepts/services-networking/service/) )
    * 파드와의 연결은 deployment와 같이 레이블 셀럭터를 이용한 방식으로 느슨한 연결을 갖는다.
* 지원하는 프로토콜: TCP, UDP, SCTP
* 지원하는 타입
    * ClusterIP: 클러스터 내에서 접근 가능한 서비스
    * 외부 → 내부
        * NodePort: 외부에서 노드의 IP와 지정된 포트를 통해 접근 가능한 서비스(범위: 30000 \~ 32767)
        * LoadBalancer: 클라우드 벤더사의 로드벨런서와 연결되어 접근 가능(managed k8s 안 쓰는 경우는 nodeport와 동일하게 동작)
            * 매니페스트 일관성 유지를 위해 외부 → 내부 통신은 모두 LoadBalancer type으로 사용하는 것을 추천
    * 내부 → 외부
        * ExternalName: {service 이름, 대상 주소 CNAME(ex. [raw.githubusercontent.com](http://raw.githubusercontent.com/ "http://raw.githubusercontent.com"))} pair를 내부 DNS 서버에 등록하여 이를 통해 접근 가능한 서비스
        * Headless Service + Endpoint: 레이블 셀렉터가 없는 ClusterIP 서비스 하나와 동일한 이름의 Endpoint 하나 조합으로 사용
            * 외부와 연결 시 ExternalName 서비스 일관된 사용 권장

## address discovery 동작원리

1. 서비스가 생성되면 해당 서비스에 대한 고유한 DNS 엔트리가 쿠버네티스 내부 DNS 서버에 등록된다.
    * DNS 이름 형식: `<서비스 이름>.<네임스페이스>.svc.cluster.local`
2. 특정 파드 A가 특정 서비스 B에 요청을 보내기 위해 DNS 서버가 해당 서비스의 ClusterIP를 조회한다.
    * `[파드] ← 서비스 ClusterIP → [k8s DNS]`
3. 반환받은 ClusterIP로 요청을 보낸다.
    * `[파드] ← 쿠버네티스 네트워크 프록시 → [서비스]`
4. 서비스는 selector 를 통해서 타겟 pod들을 식별한다.
5. 서비스는 EndPoint를 통해 pod의 현재 ip 주소정보를 알아낸다.
    * `[서비스] ← 쿠버네티스 네트워크 프록시 → [엔드포인트]`
6. 내부 라우팅 규칙에 따라 해당 ip 주소로 트래픽 전달한다.


# 사용법

### 매니페스트 파일

* apiVersion, kind 는 고정
* metadata.name으로 서비스 식별됨
* metadata.labels 의 경우 서비스 관리나 필터링 용도 → 생략 가능
* spec.selector는 대상 워크로드(pod)를 매핑하는 기준이기 때문에 중요, app, version 등 다중 레이블 지정 가능
* port 내외부 포트번호와 프로토콜을 지정할 수 있으며 서비스 유형이나 사용하는 상황에 따라 적절한 값 지정
    * protocol 기본값은 TCP
* type 서비스 유형이며 기본값은 ClusterIP

```yaml
apiVersion: v1
kind: Service
metadata:
  name: <서비스 이름>
  labels:
    app: <애플리케이션 이름>
spec:
  selector:
    app: <애플리케이션 이름>
  ports:
    - protocol: <통신 프로토콜>
      port: <다른 파드가 서비스에 접근하기 위해 사용하는 포트>
      targetPort: <대상 파드에 트래픽 전달하는 포트>
      nodePort: <외부에서 접근할 노드의 포트 번호>
  type: <서비스 유형>
```

### 명령어

```bash
# 서비스 생성
kubectl apply -f <서비스매니페스트파일명>.yaml
# 서비스 조회
kubectl get svc
# 서비스 상세정보 조회
kubectl describe svc <서비스 이름>
# 서비스 삭제
kubectl delete svc <서비스 이름>
# 서비스 엔드포인트 목록 조회
kubectl get endpoints sleep-2
```

# 파드 간 통신

## 실습: ip 주소와 서비스를 통해 pod 접속해보기

* ip 주소를 통한 pod 간 직접 통신
```bash
# ch03 디렉토리로 이동
cd ch03
# pod 하나씩 실행하는 두 개의 deployment를 생성
kubectl apply -f sleep/sleep1.yaml -f sleep/sleep2.yaml
# sleep2 실행 시까지 대기
kubectl wait --for=condition=Ready pod -l app=sleep-2
# sleep2 ip addr 확인
## 이 때 출력 끝에 '%' 가 붙어서 출력될 경우, 이는 zsh 문자열 포매팅관련 문제
## unsetopt PROMPT_SP 를 통해 해결하거나 zsh 환경설정을 변경하기 싫다면 아래 명령어 끝에 | xargs echo 붙여서 사용
kubectl get pod -l app=sleep-2 --output jsonpath='{.items[0].status.podIP}'
# 첫 번째 pod에서 두 번째 pod로 ping
kubectl exec deploy/sleep-1 -- ping -c 2 $(kubectl get pod -l app=sleep-2 --output jsonpath='{.items[0].status.podIP}')
```
* 서비스를 통한 pod 통신
* sleep2-service.yaml
    ```yaml
    apiVersion: v1
    kind: Service
    metadata:
      name: sleep-2
    spec:
      selector:
        app: sleep-2
      # 80 포트를 주시하다가 파드의 80 포트로 트래픽 전달
      ports:
        - port: 80
    ```
```bash
# service 배포
kubectl apply -f sleep/sleep2-service.yaml
# 상세 정보 확인
kubectl get svc sleep-2
# pod와 통신 되는지 확인
## sleep-2의 주소는 잘 불러오나,
## ping은 실패함
kubectl exec deploy/sleep-1 -- ping -c 1 sleep-2
# port forwarding 후 localhost:8080 접근 시 정상 응답
kubectl port-forward deploy/sleep-1 8080:80
```
* 서비스 배포 시에 서비스 ClusterIP는 잘 불러오지만 ping이 동작하지 않은 이유
    * ping은 ICMP 프로토콜이므로 TCP, UDP만 지원하는 서비스를 통해서는 통신 불가
    * 쿠버네티스 클러스터에서 pod 간 통신은 CNI(Container Network Interface) 플러그인을 통해 관리되기 때문에 ICMP 프로토콜로도 통신 가능

# 외부 트래픽을 파드로 전달

## 실습: 로드밸런서를 통한 pod 접근

* web 서버, api 서버 배포 후 이를 외부에서 접근 가능하도록 하는 로드밸런서 서비스를 생성해라.
* [외부] → [LoadBalancer] → [web 서버] → [ClusterIp] → [api 서버] 이기 때문에 두 가지 서비스를 생성해야한다.
* api-service.yaml
    ```yaml
    apiVersion: v1
    kind: Service
    metadata:
      name: numbers-api
    spec:
      ports:
        - port: 80
      selector:
        app: numbers-api
      type: ClusterIP
    ```
* web-service.yaml
    ```yaml
    apiVersion: v1
    kind: Service
    metadata:
      name: numbers-web
    spec:
      ports:
        - port: 8080
          targetPort: 80
      selector:
        app: numbers-web
      type: LoadBalancer
    ```
* 각 서버 및 서비스 배포
    ```bash
    # 웹서버, api 서버 배포
    kubectl apply -f numbers/api.yaml -f numbers/web.yaml -f numbers/api-service.yaml -f numbers/web-service.yaml
    ```
* 브라우저 통해 localhost:8080 으로 이동
    * ![스크린샷 2025-02-03 오후 4.34.17.png](https://media-cdn.atlassian.com/file/209bbd1d-336a-4b4f-b3d3-f4f129416cdc/image/cdn?allowAnimated=true&client=342a3471-24da-4ea6-81b0-798033651777&collection=contentId-194484817&height=125&max-age=2592000&mode=full-fit&source=mediaCard&token=eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiIzNDJhMzQ3MS0yNGRhLTRlYTYtODFiMC03OTgwMzM2NTE3NzciLCJhY2Nlc3MiOnsidXJuOmZpbGVzdG9yZTpjb2xsZWN0aW9uOmNvbnRlbnRJZC0xOTQ0ODQ4MTciOlsicmVhZCJdfSwiZXhwIjoxNzg4NDg3NjY3LCJuYmYiOjE3ODg0ODQ3ODcsImFhSWQiOiI3MTIwMjA6NTE0ZWQ1MDYtYjE2ZC00Yzk4LWIwN2MtMDc4OTI4ZGY0NDdlIiwiaHR0cHM6Ly9pZC5hdGxhc3NpYW4uY29tL2FwcEFjY3JlZGl0ZWQiOmZhbHNlLCJhdXRoVHlwZSI6InNlc3Npb24ifQ.4oA4Uxi12K0aZ81jEb4194_aabS6MecIUO6lJuMKMeY&width=511#media-blob-url=true&id=209bbd1d-336a-4b4f-b3d3-f4f129416cdc&clientId=342a3471-24da-4ea6-81b0-798033651777&contextId=contentId-194484817&collection=contentId-194484817)
        정상 동작 확인

# 클러스터 외부로 트래픽 전달

## 실습: ExternalName을 통한 외부 서버 요청

* api 서버와 유사하게 숫자를 반환하도록 하는 [https://raw.githubusercontent.com/sixeyed/kiamol/master/ch03/numbers/rng](https://raw.githubusercontent.com/sixeyed/kiamol/master/ch03/numbers/rng "https://raw.githubusercontent.com/sixeyed/kiamol/master/ch03/numbers/rng") 를 통해서 동작하도록 ExternalName을 생성해라.


* 기존 numbers-api 서비스 삭제 후 재배포 후 테스트
* 매니페스트 정의
    ```yaml
    apiVersion: v1
    kind: Service
    metadata:
      name: numbers-api
    spec:
      type: ExternalName
      externalName: raw.githubusercontent.com
    ```
* 재배포 후 테스트
    ```bash
    # 기존 서비스 삭제
    kubectl delete svc numbers-api
    # ExternalName svc 배포
    kubectl apply -f numbers-services/api-service-externalName.yaml
    # 서비스 상세 정보 확인
    kubectl get svc numbers-api
    # 브라우저에서 동작 확인(port: 8088)
    ```
* 브라우저 통해 localhost:8080 으로 이동
    * ![스크린샷 2025-02-03 오후 5.06.08.png](https://media-cdn.atlassian.com/file/1cba0ff3-bab7-42e7-8146-f71667c4b40b/image/cdn?allowAnimated=true&client=342a3471-24da-4ea6-81b0-798033651777&collection=contentId-194484817&height=125&max-age=2592000&mode=full-fit&source=mediaCard&token=eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiIzNDJhMzQ3MS0yNGRhLTRlYTYtODFiMC03OTgwMzM2NTE3NzciLCJhY2Nlc3MiOnsidXJuOmZpbGVzdG9yZTpjb2xsZWN0aW9uOmNvbnRlbnRJZC0xOTQ0ODQ4MTciOlsicmVhZCJdfSwiZXhwIjoxNzg4NDg3NjY3LCJuYmYiOjE3ODg0ODQ3ODcsImFhSWQiOiI3MTIwMjA6NTE0ZWQ1MDYtYjE2ZC00Yzk4LWIwN2MtMDc4OTI4ZGY0NDdlIiwiaHR0cHM6Ly9pZC5hdGxhc3NpYW4uY29tL2FwcEFjY3JlZGl0ZWQiOmZhbHNlLCJhdXRoVHlwZSI6InNlc3Npb24ifQ.4oA4Uxi12K0aZ81jEb4194_aabS6MecIUO6lJuMKMeY&width=507#media-blob-url=true&id=1cba0ff3-bab7-42e7-8146-f71667c4b40b&clientId=342a3471-24da-4ea6-81b0-798033651777&contextId=contentId-194484817&collection=contentId-194484817)
        정상 동작 확인


관련 콘텐츠

<br>
