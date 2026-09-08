package com.example.b2glab.improved;

/** Retrospective proposal, not a copy of the 2023 implementation. */
public final class CallResult {
    public enum Transport { HTTP_RESPONSE, READ_TIMEOUT, CONNECT_TIMEOUT, POOL_TIMEOUT, CONNECTION_FAILURE, IO_FAILURE }
    public enum Business { SUCCESS, REJECTED, UNKNOWN }
    public final String callId;
    public final Transport transport;
    public final Business business;
    public final Integer httpStatus;
    public final String reason;

    public CallResult(String callId, Transport transport, Business business, Integer httpStatus, String reason) {
        this.callId = callId;
        this.transport = transport;
        this.business = business;
        this.httpStatus = httpStatus;
        this.reason = reason;
    }
}
