package com.example.b2glab.legacy;

import java.net.URI;
import org.springframework.stereotype.Component;

/** Prevents this retrospective lab from contacting any real partner or internal host. */
@Component
public class LoopbackOnlyDestination {
    public void requireLoopback(String url) {
        String host = URI.create(url).getHost();
        if (!("127.0.0.1".equals(host) || "localhost".equalsIgnoreCase(host) || "::1".equals(host))) {
            throw new IllegalArgumentException("The lab only permits loopback destinations");
        }
    }
}
