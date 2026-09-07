package com.example.b2glab;

import com.example.b2glab.legacy.LegacyHttpConnectionUtils;
import com.example.b2glab.stub.PartnerStubServer;
import org.apache.http.impl.conn.PoolingHttpClientConnectionManager;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.web.client.RestTemplate;
import static org.assertj.core.api.Assertions.assertThat;

@RunWith(SpringRunner.class)
@SpringBootTest
public class ConnectionReuseTest {
    @Autowired private LegacyHttpConnectionUtils http;
    @Autowired private RestTemplate legacyRestTemplate;
    @Autowired private PoolingHttpClientConnectionManager manager;
    @Autowired private PartnerStubServer stub;

    @Test
    public void poolExistsButCloseHeaderPreventsReuse() {
        manager.closeIdleConnections(0, java.util.concurrent.TimeUnit.MILLISECONDS);
        stub.resetConnections();
        for (int i = 0; i < 20; i++) {
            http.sendPost(stub.url("success"), 1_000);
        }
        int closedConnections = stub.distinctConnectionCount();
        assertThat(manager.getTotalStats().getAvailable()).isZero();

        stub.resetConnections();
        for (int i = 0; i < 20; i++) {
            legacyRestTemplate.postForObject(stub.url("success"), null, String.class);
        }
        int reusedConnections = stub.distinctConnectionCount();
        System.out.printf("CONNECTION_REUSE calls=20 close=%d keepAlive=%d available=%d%n",
                closedConnections, reusedConnections, manager.getTotalStats().getAvailable());
        assertThat(closedConnections).isEqualTo(20);
        assertThat(reusedConnections).isEqualTo(1);
        assertThat(manager.getTotalStats().getLeased()).isZero();
        assertThat(manager.getTotalStats().getAvailable()).isEqualTo(1);
    }
}
