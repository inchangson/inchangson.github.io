FROM maven:3.9.9-eclipse-temurin-8@sha256:e20e4fc05fb5480c884a1f750c362ed0e91aca15cec5736e12796713710ec9b3
WORKDIR /workspace
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src src
RUN mvn -q package
EXPOSE 18080
ENTRYPOINT ["java", "-jar", "target/b2g-resttemplate-lab-1.0.0-SNAPSHOT.jar"]
