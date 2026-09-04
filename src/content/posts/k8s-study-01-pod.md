---
title: 쿠버네티스 교과서 - Chap 02 파드와 디플로이먼트로 컨테이너 실행하기
description: pod에 대한 기본적인 개념을 정리한 내용입니다.
pubDate: 2025-02-25
category: backend
tags:
  - kubernetes
draft: true
---

## Pod

• 파드는 컨테이너(애플리케이션 실행 단위)를 감싸는 최소 실행 단위
• 하나의 파드 내에 하나 이상의 컨테이너가 포함되며, 동일한 네트워크, 스토리지, 환경변수를 공유
• 파드의 생명주기는 파드 자체에 종속되어, 파드 삭제 시 내부 컨테이너와 데이터도 함께 소멸
• 컨테이너가 비정상 종료되거나 재시작되어도, 쿠버네티스 복구 메커니즘에 의해 새로운 컨테이너가 생성되어 파드 상태 유지


## cf) 컨테이너와 파드의 관계

* 기본적으로 하나의 컨테이너는 한 가지 책임을 갖도록 설계되어 각 컨테이너는 자체 파일시스템, 네트워크 네임 스페이스, 프로세스 공간을 독립적으로 갖추어 실행
* 파드는 컨테이너 런타임(docker, containerd, ..)에 요청하여 pod sandbox를 생성하여 파드 내부 컨테이너간에 네트워크, pid 네임스페이스(설정 시), 등을 공유

## 컨트롤러 객체와 디플로이먼트

• 단일 파드는 노드 장애 등으로 소멸 위험이 있으므로 디플로이먼트 같은 컨트롤러 객체를 사용하여 파드 복제 및 원하는 상태 유지
• 디플로이먼트는 파드 템플릿과 레이블 셀렉터(matchLabels)를 통해 관리 대상 파드를 식별
• 관리 대상 파드의 레이블이 임의로 변경되면 디플로이먼트는 새로운 파드를 생성해 원래 상태 복원

## 디플로이먼트 적용과 파드 생성 과정

* 새로운 디플로이먼트가 생성되거나, 디플로이먼트에 대한 restart가 있을 경우 스케줄러가 해당 디플로이먼트의 파드를 적절한 노드에 할당
* 해당 노드의 kubelet은 API서버에서 새 파드 정보를 받아, 컨테이너 런타임과 통신하여 파드 내 컨테이너를 생성, 실행
* 이후 디플로이먼트는 파드를 관리, kubelet은 파드 내의 container를 지켜보며 컨테이너 런타임과 통신


**예시 매니페스트**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-kiamol2
spec:
  selector:
    matchLabels:
      app: hello-kiamol2
  template:
    metadata:
      labels:
        app: hello-kiamol2
    spec:
      containers:
        - name: hello-kiamol2
          image: kiamol/ch02-hello-kiamol
```

## 파드에서 실행중인 애플리케이션 접근

* 파드와 디플로이먼트가 애플리케이션의 가용성을 확보하여도 실제 애플리케이션은 컨테이너 속에서 동작
* 컨테이너 런타임에 따라 직접 컨테이너 접근을 허용하지 않을 수 있음

### 파드 내부와 연결할 대화형 셸 실행

```bash
kubectl get pod hello-kiamol -o custom-columns=NAME:metadata.name,POD_IP:status.podIP
kubectl exec -it hello-kiamol -- sh
```

### 애플리케이션 로그 확인

`kubectl logs --tail=2 hello-kiamol`

### 컨테이너 내부의 파일 복사

```bash
mkdir -p /tmp/kiamol/ch02
kubectl cp hello-kiamol:/usr/share/nginx/html/index.html /tmp/kiamol/ch02/index.html
```

## 실습

```bash
kubectl run hello-kiamol --image=kiamol/ch02-hello-kiamol
kubectl wait --for=condition=Ready pod hello-kiamol
kubectl get pods
kubectl describe pod hello-kiamol
kubectl get pod hello-kiamol --output custom-columns=NAME:metadata.name,NODE_IP:status.hostIP,POD_IP:status.podIP
```
`kubectl port-forward pod/hello-kiamol 8080:80`
로컬 브라우저 또는 curl을 통해 [http://localhost:8080](http://localhost:8080/)에 접속하여 응답 확인

```bash
docker container rm -f $(docker container ls -q --filter label=io.kubernetes.container.name=hello-kiamol)
kubectl get pod hello-kiamol
```
쿠버네티스가 파드를 통해 컨테이너 복원 확인

```bash
kubectl create deployment hello-kiamol2 --image=kiamol/ch02-hello-kiamol
kubectl get pods -l app=hello-kiamol2
kubectl label pods -l app=hello-kiamol2 --overwrite app=hello-kiamol-x
kubectl label pods -l app=hello-kiamol-x --overwrite app=hello-kiamol2
kubectl port-forward deploy/hello-kiamol2 8080:80
```
로컬 브라우저 또는 curl을 통해 [http://localhost:8080](http://localhost:8080/)에 접속하여 응답 확인

### 연습 문제

deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whoami
  labels:
    app: whoami
    version: ch02
spec:
  selector:
    matchLabels:
      app: whoami
      version: ch02
  template:
    metadata:
      labels:
        app: whoami
        version: ch02
    spec:
      containers:
        - name: web
          image: kiamol/ch02-whoami
```

```bash
kubectl apply -f solution/deployment.yaml
kubectl port-forward deploy/whoami 8080:80
curl http://localhost:8080
kubectl get pods -o custom-columns=NAME:metadata.name
kubectl exec deploy/whoami -- sh -c 'hostname'
```
