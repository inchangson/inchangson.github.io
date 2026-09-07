package com.example.b2glab.legacy;
import java.util.Map; import org.springframework.stereotype.Component;
@Component
public class LegacyPartnerASender {
    private final LegacyHttpConnectionUtils http; private final LegacyLogRecorder logs;
    public LegacyPartnerASender(LegacyHttpConnectionUtils http, LegacyLogRecorder logs) { this.http = http; this.logs = logs; }
    public boolean send(String url, int timeoutMillis) { logs.record("PARTNER_A", "REQUEST"); Map<String,String> result = http.sendPost(url, timeoutMillis); logs.record("PARTNER_A", "RESPONSE"); return "200".equals(result.get("statusCode")); }
}
