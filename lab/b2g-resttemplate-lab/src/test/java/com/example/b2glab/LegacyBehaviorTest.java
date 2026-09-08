package com.example.b2glab;

import static org.assertj.core.api.Assertions.assertThat; import static org.assertj.core.api.Assertions.catchThrowable;
import com.example.b2glab.legacy.*; import com.example.b2glab.stub.PartnerStubServer; import java.util.List;
import org.junit.Before; import org.junit.Test; import org.junit.runner.RunWith; import org.springframework.beans.factory.annotation.Autowired; import org.springframework.boot.test.context.SpringBootTest; import org.springframework.test.context.junit4.SpringRunner; import org.springframework.web.client.ResourceAccessException;

@RunWith(SpringRunner.class) @SpringBootTest
public class LegacyBehaviorTest {
    @Autowired private LegacyPartnerASender partnera; @Autowired private LegacyPartnerBSender partnerb; @Autowired private LegacyLogRecorder logs; @Autowired private PartnerStubServer stub;
    @Before public void clearLogs() { logs.clear(); }
    @Test public void http200BusinessFailureHasDifferentPartnerMeaning() throws Exception { assertThat(partnera.send(stub.url("business-failure"), 1_000)).isTrue(); assertThat(partnerb.send(stub.url("business-failure"), 1_000)).isFalse(); }
    @Test public void httpErrorIsConvertedAndResponseLogRemains() { assertThat(partnera.send(stub.url("http-500"), 1_000)).isFalse(); assertThat(logPhases()).containsExactly("REQUEST", "RESPONSE"); }
    @Test public void readTimeoutEscapesMapAndSkipsResponseLog() { Throwable thrown = catchThrowable(() -> partnera.send(stub.url("delay-300"), 50)); assertThat(thrown).isInstanceOf(ResourceAccessException.class); assertThat(logPhases()).containsExactly("REQUEST"); }
    @Test public void refusesEveryNonLoopbackDestinationBeforeHttpCall() { Throwable thrown = catchThrowable(() -> partnera.send("https://partner.example.invalid/api", 1_000)); assertThat(thrown).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("loopback"); }
    private List<String> logPhases() { java.util.ArrayList<String> phases = new java.util.ArrayList<>(); for (LegacyCallLog entry : logs.snapshot()) phases.add(entry.getPhase()); return phases; }
}
