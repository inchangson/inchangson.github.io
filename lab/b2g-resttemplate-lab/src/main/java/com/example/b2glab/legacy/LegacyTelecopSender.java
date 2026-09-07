package com.example.b2glab.legacy;
import java.util.Map; import org.springframework.stereotype.Component;
@Component
public class LegacyTelecopSender {
    private final LegacyHttpConnectionUtils http; private final LegacyLogRecorder logs;
    public LegacyTelecopSender(LegacyHttpConnectionUtils http, LegacyLogRecorder logs) { this.http = http; this.logs = logs; }
    public boolean send(String url, int timeoutMillis) { logs.record("TELECOP", "REQUEST"); Map<String,String> result = http.sendPost(url, timeoutMillis); logs.record("TELECOP", "RESPONSE"); return "200".equals(result.get("statusCode")); }
}
