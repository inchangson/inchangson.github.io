package com.example.b2glab;

import com.example.b2glab.improved.*;
import com.example.b2glab.legacy.LegacyHttpConnectionUtils;
import com.example.b2glab.stub.PartnerStubServer;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;

/** Explicitly selected via -Dtest=ProfileWorkload; excluded from default *Test discovery. */
@RunWith(SpringRunner.class)
@SpringBootTest
public class ProfileWorkload {
    @Autowired private LegacyHttpConnectionUtils legacy;
    @Autowired private PartnerStubServer stub;

    @Test public void sampleWaitingStacks() throws Exception {
        String mode = System.getProperty("lab.profile.mode", "legacy");
        stub.resetConnections();
        if ("legacy".equals(mode)) runLegacy();
        else if ("fixed".equals(mode)) runFixed();
        else throw new IllegalArgumentException("Unknown profile mode");
        System.out.printf("PROFILE mode=%s calls=200 delayMs=20 distinctPorts=%d%n", mode, stub.distinctConnectionCount());
    }

    private void runLegacy() {
        for (int i = 0; i < 200; i++) legacy.sendPost(stub.url("delay-20"), 1000);
    }

    private void runFixed() throws Exception {
        try (FixedPartnerClient client = new FixedPartnerClient(2, 100, 100, 1000)) {
            ObservedPartnerSender sender = new ObservedPartnerSender(client);
            for (int i = 0; i < 200; i++) {
                if (sender.send(stub.url("delay-20")).business != CallResult.Business.SUCCESS) {
                    throw new AssertionError("Unexpected local result");
                }
            }
        }
    }
}
