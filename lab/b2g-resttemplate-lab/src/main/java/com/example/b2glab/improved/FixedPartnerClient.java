package com.example.b2glab.improved;

import com.example.b2glab.legacy.LoopbackOnlyDestination;
import java.io.Closeable;
import java.io.IOException;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.impl.conn.PoolingHttpClientConnectionManager;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/** Configuration is completed before publication; no request-time setters are exposed. */
public final class FixedPartnerClient implements Closeable {
    private final PoolingHttpClientConnectionManager pool;
    private final CloseableHttpClient client;
    private final RestTemplate template;
    private final LoopbackOnlyDestination destinationPolicy = new LoopbackOnlyDestination();

    public FixedPartnerClient(int poolSize, int poolWaitMs, int connectMs, int readMs) {
        pool = new PoolingHttpClientConnectionManager();
        pool.setMaxTotal(poolSize);
        pool.setDefaultMaxPerRoute(poolSize);
        client = HttpClients.custom().setConnectionManager(pool)
                .disableAutomaticRetries().disableRedirectHandling().build();
        HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory(client);
        factory.setConnectionRequestTimeout(poolWaitMs);
        factory.setConnectTimeout(connectMs);
        factory.setReadTimeout(readMs);
        template = new RestTemplate(factory);
    }

    public ResponseEntity<String> post(String url) {
        destinationPolicy.requireLoopback(url);
        return template.postForEntity(url, null, String.class);
    }

    public int leasedConnections() { return pool.getTotalStats().getLeased(); }
    @Override public void close() throws IOException { client.close(); }
}
