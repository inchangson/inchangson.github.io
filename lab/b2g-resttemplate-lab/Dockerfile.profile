FROM b2g-resttemplate-lab-lab
# Explicit version and architecture for this measured Linux ARM64 environment.
RUN curl -fSL https://github.com/async-profiler/async-profiler/releases/download/v4.0/async-profiler-4.0-linux-arm64.tar.gz -o /tmp/profiler.tar.gz \
    && mkdir -p /opt/async-profiler \
    && tar -xzf /tmp/profiler.tar.gz --strip-components=1 -C /opt/async-profiler
ENTRYPOINT ["mvn", "-o"]
