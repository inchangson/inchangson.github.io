package com.example.b2glab.improved;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.apache.http.conn.ConnectTimeoutException;
import org.apache.http.conn.ConnectionPoolTimeoutException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import static com.example.b2glab.improved.CallResult.Business.*;
import static com.example.b2glab.improved.CallResult.Transport.*;

/** Synthetic partner contract: both demo partners return resultCode. */
public final class ObservedPartnerSender {
    private final FixedPartnerClient client;
    private final ObjectMapper mapper = new ObjectMapper();
    private final List<String> events = Collections.synchronizedList(new ArrayList<String>());

    public ObservedPartnerSender(FixedPartnerClient client) { this.client = client; }

    public CallResult send(String url) {
        String id = UUID.randomUUID().toString();
        long start = System.nanoTime();
        events.add(id + " REQUEST");
        CallResult result = null;
        try {
            ResponseEntity<String> response = client.post(url);
            Integer status = response.getStatusCodeValue();
            // RestTemplate can return 3xx when redirects are disabled.
            if (!response.getStatusCode().is2xxSuccessful()) {
                result = new CallResult(id, HTTP_RESPONSE, UNKNOWN, status, "NON_2XX");
            } else {
                try {
                    JsonNode body = mapper.readTree(response.getBody());
                    String code = body == null ? "" : body.path("resultCode").asText();
                    result = new CallResult(id, HTTP_RESPONSE,
                            "SUCCESS".equals(code) ? SUCCESS : "REJECTED".equals(code) ? REJECTED : UNKNOWN,
                            status, "SUCCESS".equals(code) || "REJECTED".equals(code) ? "PARTNER_RESULT" : "UNKNOWN_CODE");
                } catch (java.io.IOException | IllegalArgumentException exception) {
                    result = new CallResult(id, HTTP_RESPONSE, UNKNOWN, status, "INVALID_BODY");
                }
            }
        } catch (HttpStatusCodeException exception) {
            result = new CallResult(id, HTTP_RESPONSE, UNKNOWN, exception.getStatusCode().value(), "HTTP_ERROR");
        } catch (ResourceAccessException exception) {
            result = new CallResult(id, classify(exception), UNKNOWN, null, "NO_CONFIRMED_RESULT");
        } finally {
            events.add(id + " COMPLETE " + (result == null ? "UNEXPECTED_EXCEPTION" : result.transport + "/" + result.business)
                    + " elapsedNanos=" + (System.nanoTime() - start));
        }
        return result;
    }

    private CallResult.Transport classify(Throwable exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConnectionPoolTimeoutException) return POOL_TIMEOUT;
            if (cause instanceof ConnectTimeoutException) return CONNECT_TIMEOUT;
            if (cause instanceof SocketTimeoutException) return READ_TIMEOUT;
            if (cause instanceof ConnectException) return CONNECTION_FAILURE;
        }
        return IO_FAILURE;
    }

    public List<String> snapshot() { synchronized (events) { return new ArrayList<>(events); } }
}
