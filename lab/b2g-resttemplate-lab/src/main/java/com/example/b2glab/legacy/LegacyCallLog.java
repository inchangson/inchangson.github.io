package com.example.b2glab.legacy;
public final class LegacyCallLog {
    private final String partner; private final String phase;
    public LegacyCallLog(String partner, String phase) { this.partner = partner; this.phase = phase; }
    public String getPartner() { return partner; } public String getPhase() { return phase; }
}
