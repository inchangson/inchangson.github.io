---
title: 쿠버네티스 교과서 - Chap 01 실습 환경 만들기
description: 쿠버네티스에 대한 기본적인 개념을 정리한 내용입니다.
pubDate: 2026-09-04
updatedDate: 2025-02-06
category: ops
subcategory: kubernetes
tags:
  - kubernetes
draft: true
---

# 쿠버네티스 이해하기

* 정의: 컨테이너를 실행하는 플랫폼
* 기능: 애플리케이션 시작, 롤링업데이트, 서비스수준 유지, 스케일링, 보안 접근 등
    * 컨테이너 관리
    * 분산 데이터 베이스(애플리케이션 구성 정보, API 키 등)
    * 스토리지 연결
    * 트래픽 관리
* 특징
    * 인프라스트럭처 수준의 관심사였던 로드밸런싱 , 네트워크 , 스토리지와 컴퓨팅을 애플리케이션 설정의 영역으로 데려왔다.
        * 선언적 파일 기반의 설정 정보 정의
        * 쿠버네티스 API를 통한 리소스 관리
    * 파생되는 장점
        * 버전관리 가능
        * 재현성 높임
        * 이식성 높임
            * 동일한 쿠버네티스 API 를 통해 배포 가능하기 때문에 환경에 대한 종속성이 줄어듦
* 용어
    * 매니페스트 파일: 설정정보 파일로 yaml, json 형식이며 json이 표준이나 yaml을 주로 사용
    * 클러스터: 여러 서버가 모여 하나의 논리적 단위를 구성하는 것
    * 리소스: 애플리케이션을 구성하는 컴포넌트
    * 서비스: 네트워크 접근을 관리하는 쿠버네티스 객체
* etc
    * [managed kubernetes](https://www.cloocus.com/insight-kubernetes_2/ "https://www.cloocus.com/insight-kubernetes_2/")
        * CSP에서 관리하는 kubernetes(ex. AKS, EKS)
            * CSP: 인프라 관리, k8s 설치 및 관리, 클러스터 백업 및 스케일링, 워커노드 프로비저닝
            * 사용자: 어플리케이션 스케일링 및 배포
        * 장점
            * 노드 관리를 웹이나 명령행으로 사용 가능
            * 클러스터 구성 편의성

## kubernetes architecture

* [https://devopscube.com/kubernetes-architecture-explained/](https://devopscube.com/kubernetes-architecture-explained/)
* [https://kubernetes.io/docs/concepts/architecture/](https://kubernetes.io/docs/concepts/architecture/)



* ![02-k8s-architecture.gif]()
    kubernetes architecture
    * Worker Node: 어플리케이션 워크로드가 구동되는 노드
    * Control Plane(Master Node): **클러스터 제어 및 관리 기능**을 담당하는 컴포넌트가 있는 노드
        * **클러스터 제어 및 관리 기능** = worker node 및 파드의 상태 관리, 스케줄링, 네트워킹, 인증, 권한 부여등
        * 상용환경에선, HA를 지키기 위해 여러 컴퓨터에서 구동되며 사용자 컨테이너는 해당 노드에서 실행되면 안 된다.
            * 직접 구축하려면 [https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/high-availability/](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/high-availability/) 가이드를 참고하여 구축하면 된다.
    * API Server(kube-apiserver): 클러스터 컴포넌트 상태를 추적하고 상호작용하는 Kubernetes API의 엔드포인트
    * Controller Manager: 대상 리소스 상태를 추적/ 관리하는 컨트롤러 프로세스를 실행하는 컴포넌트
        * 컨트롤러 예시
            * Node Controller: 노드 상태와 장애를 감지
            * Replication Controller: 특정 수 파드가 항상 실행되도록 보장
            * Job Controller: 완료된 작업을 추적하여 작업을 관리
    * Cloud Controller Manager: 클라우드 벤더사의 API와 연계하여 관련 리소스를 추적/ 관리
        * 예시: 노드 오토스케일링등을 요청하거나 DNS 엔트리, 로드밸런서 추가 및 삭제 요청 등
    * Scheduler(kube-scheduler): 신규 파드에 대해 해당 파드의 요구사항, 정책과 현재 노드들의 리소스 상태를 고려하여 실행될 노드를 할당하는 역할
    * etcd: 클러스터 상태정보를 저장하는 key-value 분산데이터베이스
    * CoreDNS: 클러스터 내에서 쓰이는 DNS 서버
    * kubelet: 컨테이너가 파드 스펙에 맞게 동작하게 관리
    * kube-proxy: 클러스터 내 네트워크 트래픽을 처리하는 프록시 컴포넌트
        * 만약 사용중인 네트워크 플러그인이 프록시를 지원하는 경우 대체될 수 있음
    * Container Runtime: 실제 컨테이너를 실행(docker, containerd)

# 실습환경 만들기

## 클러스터 생성

### 로컬

* 웹사이트를 통해 Docker Desktop 설치
* Docker Desktop > Settings > kubernetes 이동
* Enable kubernetes, Reset Kubernetes Cluster 클릭
* 명령행 도구(kubectl) 설치(생략, Docker Desktop 의 경우 자동 설치됨)

### 클라우드(Azure)

* 설치 스크립트
```bash
# login to azure
az login

# create resource group
## name: kiamol
## location: koreacentral
az group create --name kiamol --location koreacentral

# Spec
## name: kiamol-aks
## node vm size: Standaard DS2 v2(2 vcpu, 7 GiB)
## node count: 1(single node cluster)
az aks create --resource-group kiamol \
  --name kiamol-aks \
  --node-count 1 \
  --node-vm-size Standard_DS2_v2 \
  --kubernetes-version 1.29.10 \
  --generate-ssh-keys

## check available versions
az aks get-versions --location koreacentral --output table

# download credential to manage cluster by kubectl
az aks get-credentials --resource-group kiamol --name kiamol-aks
```
* 트러블 슈팅
    * [MissingSubscriptionRegistration](https://learn.microsoft.com/en-us/azure/azure-resource-manager/troubleshooting/error-register-resource-provider?tabs=azure-cli "https://learn.microsoft.com/en-us/azure/azure-resource-manager/troubleshooting/error-register-resource-provider?tabs=azure-cli")
        * aks 생성에 필요한 namespace 등록이 필요
        ```bash
        # register
        az provider register --namespace Microsoft.ContainerService

        ## check registering status
        az provider show --namespace Microsoft.ContainerService --query "registrationState" --output table

        ## total
        az provider list --output table
        ```
    * portal에서 생성하는 경우와 Azure CLI 생성 시 차이점
        * nodepool name
            * portal: agentpool
            * cli: nodepool1
            * `--nodepool-name` 플래그로 지정 가능
        * enableAutoScaling 옵션(portal - 크기조정방법)
            * portal: true
            * cli: false
            * `--enable-cluster-autoscaler --min-count 1 --max-count 3` 플래그로 지정 가능

## 생성한 클러스터 확인

* 기존 다른 config context 를 쓰고 있다면 명령어 또는 docker-desktop 등으로 변경
```bash
# 현재 context 확인
kubectl config current-context
kubectl config get-contexts

# context 변경
kubectl config use-context docker-desktop
```
* 클러스터 확인 `kubectl get nodes`
* 아래와 같이 나타나야 한다.
```text
NAME             STATUS   ROLES           AGE   VERSION
docker-desktop   Ready    control-plane   37m   v1.30.2
```
    * 책의 경우 ROLES가 master로 나와있는데 이는 버젼 차이이다.(1.20 이후 변경됨)
    * 버전 확인 → `kubectl version`
