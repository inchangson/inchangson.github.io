package com.example.b2glab;

import com.example.b2glab.improved.*;
import com.example.b2glab.stub.PartnerStubServer;
import java.net.ServerSocket;
import java.util.concurrent.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;
import static org.assertj.core.api.Assertions.assertThat;
import static com.example.b2glab.improved.CallResult.Business.*;
import static com.example.b2glab.improved.CallResult.Transport.*;

@RunWith(SpringRunner.class)
@SpringBootTest
public class ImprovedBehaviorTest {
    @Autowired private PartnerStubServer stub;

    @Test public void outcomeMatrixKeepsTransportAndBusinessSeparate() throws Exception {
        try (FixedPartnerClient client = new FixedPartnerClient(2, 100, 100, 50)) {
            ObservedPartnerSender sender = new ObservedPartnerSender(client);
            assertThat(sender.send(stub.url("success")).business).isEqualTo(SUCCESS);
            assertThat(sender.send(stub.url("business-failure")).business).isEqualTo(REJECTED);
            CallResult httpError = sender.send(stub.url("http-500"));
            assertThat(httpError.httpStatus).isEqualTo(500);
            assertThat(httpError.business).isEqualTo(UNKNOWN);
            assertThat(sender.send(stub.url("malformed")).reason).isEqualTo("INVALID_BODY");
            CallResult timeout = sender.send(stub.url("delay-300"));
            assertThat(timeout.transport).isEqualTo(READ_TIMEOUT);
            assertThat(timeout.business).isEqualTo(UNKNOWN);
            assertThat(sender.snapshot()).hasSize(10);
            assertThat(sender.snapshot().get(9)).startsWith(timeout.callId + " COMPLETE READ_TIMEOUT/UNKNOWN");
        }
    }

    @Test public void connectionFailureAlsoHasCompletionLog() throws Exception {
        int unusedPort;
        try (ServerSocket socket = new ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))) {
            unusedPort = socket.getLocalPort();
        }
        try (FixedPartnerClient client = new FixedPartnerClient(1, 50, 50, 50)) {
            ObservedPartnerSender sender = new ObservedPartnerSender(client);
            CallResult result = sender.send("http://127.0.0.1:" + unusedPort + "/stub");
            assertThat(result.transport).isEqualTo(CONNECTION_FAILURE);
            assertThat(sender.snapshot()).hasSize(2);
        }
    }

    @Test public void exhaustedPoolHasDifferentTimeoutFromSocketRead() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try (FixedPartnerClient client = new FixedPartnerClient(1, 50, 100, 1000)) {
            ObservedPartnerSender sender = new ObservedPartnerSender(client);
            Future<CallResult> first = executor.submit(() -> sender.send(stub.url("delay-600")));
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
            while (client.leasedConnections() != 1 && System.nanoTime() < deadline) Thread.sleep(1);
            assertThat(client.leasedConnections()).isEqualTo(1);
            assertThat(sender.send(stub.url("success")).transport).isEqualTo(POOL_TIMEOUT);
            assertThat(first.get(2, TimeUnit.SECONDS).business).isEqualTo(SUCCESS);
            assertThat(sender.snapshot()).hasSize(4);
        } finally { executor.shutdownNow(); }
    }

    @Test public void independentlyConfiguredClientsKeepTheirTimeouts() throws Exception {
        try (FixedPartnerClient shortClient = new FixedPartnerClient(1, 100, 100, 50);
             FixedPartnerClient longClient = new FixedPartnerClient(1, 100, 100, 1000)) {
            assertThat(new ObservedPartnerSender(shortClient).send(stub.url("delay-300")).transport).isEqualTo(READ_TIMEOUT);
            assertThat(new ObservedPartnerSender(longClient).send(stub.url("delay-300")).business).isEqualTo(SUCCESS);
        }
    }
}
