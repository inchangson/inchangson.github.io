package com.example.b2glab.legacy;
import java.util.ArrayList; import java.util.Collections; import java.util.List; import org.springframework.stereotype.Component;
@Component
public class LegacyLogRecorder {
    private final List<LegacyCallLog> entries = Collections.synchronizedList(new ArrayList<LegacyCallLog>());
    public void record(String partner, String phase) { entries.add(new LegacyCallLog(partner, phase)); }
    public List<LegacyCallLog> snapshot() { synchronized (entries) { return new ArrayList<>(entries); } }
    public void clear() { entries.clear(); }
}
