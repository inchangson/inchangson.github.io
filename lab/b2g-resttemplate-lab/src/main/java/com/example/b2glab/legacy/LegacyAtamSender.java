package com.example.b2glab.legacy;
import com.fasterxml.jackson.databind.JsonNode; import com.fasterxml.jackson.databind.ObjectMapper; import java.io.IOException; import java.util.Map; import org.springframework.stereotype.Component;
@Component
public class LegacyAtamSender {
    private final LegacyHttpConnectionUtils http; private final LegacyLogRecorder logs; private final ObjectMapper mapper;
    public LegacyAtamSender(LegacyHttpConnectionUtils http, LegacyLogRecorder logs, ObjectMapper mapper) { this.http = http; this.logs = logs; this.mapper = mapper; }
    public boolean send(String url, int timeoutMillis) throws IOException { logs.record("ATAM", "REQUEST"); Map<String,String> result = http.sendPost(url, timeoutMillis); JsonNode body = mapper.readTree(result.get("result")); logs.record("ATAM", "RESPONSE"); return "200".equals(result.get("statusCode")) && "SUCCESS".equals(body.path("resultCode").asText()); }
}
