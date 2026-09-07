package com.example.b2glab;

import static org.assertj.core.api.Assertions.assertThat;
import com.example.b2glab.legacy.LegacyHttpConnectionUtils;
import com.example.b2glab.stub.PartnerStubServer;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.RestTemplate;
import org.springframework.test.context.junit4.SpringRunner;

@RunWith(SpringRunner.class)
@SpringBootTest
public class SharedFactoryTimeoutTest {
    @Autowired private LegacyHttpConnectionUtils http;
    @Autowired private PartnerStubServer stub;

    @Test
    public void laterClientCreationOverwritesEarlierClientTimeout() {
        RestTemplate intended50ms = http.dynamicTemplateForExperiment(50);
        RestTemplate intended1000ms = http.dynamicTemplateForExperiment(1_000);

        assertThat(intended50ms.getRequestFactory()).isSameAs(intended1000ms.getRequestFactory());
        assertThat(intended50ms.getRequestFactory()).isSameAs(http.sharedFactory());

        long started = System.nanoTime();
        intended50ms.exchange(stub.url("delay-300"), HttpMethod.GET, null, String.class);
        long elapsedMillis = (System.nanoTime() - started) / 1_000_000;

        assertThat(elapsedMillis).isGreaterThanOrEqualTo(250L);
    }
}
