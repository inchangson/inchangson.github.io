package com.example.b2glab.stub;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PartnerStubServer {
    private final int port;
    private final Set<Integer> remotePorts = ConcurrentHashMap.newKeySet();
    private HttpServer server;
    public PartnerStubServer(@Value("${lab.stub.port}") int port) { this.port = port; }
    @PostConstruct public void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/stub", new StubHandler()); server.setExecutor(Executors.newCachedThreadPool()); server.start();
    }
    @PreDestroy public void stop() { if (server != null) server.stop(0); }
    public String url(String behavior) { return "http://127.0.0.1:" + port + "/stub/" + behavior; }
    public int distinctConnectionCount() { return remotePorts.size(); }
    public void resetConnections() { remotePorts.clear(); }
    private final class StubHandler implements HttpHandler {
        @Override public void handle(HttpExchange exchange) throws IOException {
            remotePorts.add(exchange.getRemoteAddress().getPort());
            String behavior = exchange.getRequestURI().getPath().substring("/stub/".length());
            int status = 200; String body = "{\"resultCode\":\"SUCCESS\",\"message\":\"accepted\"}";
            if ("business-failure".equals(behavior)) body = "{\"resultCode\":\"REJECTED\",\"message\":\"contract not found\"}";
            else if ("http-400".equals(behavior)) { status = 400; body = "{\"resultCode\":\"INVALID\"}"; }
            else if ("http-500".equals(behavior)) { status = 500; body = "{\"resultCode\":\"ERROR\"}"; }
            else if (behavior.startsWith("delay-")) sleep(Long.parseLong(behavior.substring("delay-".length())));
            else if ("malformed".equals(behavior)) body = "{not-json";
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json;charset=UTF-8");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream output = exchange.getResponseBody()) { output.write(bytes); }
        }
        private void sleep(long millis) { try { Thread.sleep(millis); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } }
    }
}
