package com.example.b2glab.legacy;

import java.util.Collections; import java.util.HashMap; import java.util.Map;
import org.springframework.http.HttpEntity; import org.springframework.http.HttpHeaders; import org.springframework.http.HttpMethod; import org.springframework.http.ResponseEntity;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory; import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException; import org.springframework.web.client.RestTemplate;

/** Structural copy of SA01 9a55c9c HttpConnectionUtils.sendRequest. Sensitive fields are removed. */
@Component
public class LegacyHttpConnectionUtils {
    public static final int DEFAULT_TIMEOUT = 30_000; private final RestTemplate restTemplate; private final LoopbackOnlyDestination destinationPolicy;
    public LegacyHttpConnectionUtils(RestTemplate legacyRestTemplate, LoopbackOnlyDestination destinationPolicy) { this.restTemplate = legacyRestTemplate; this.destinationPolicy = destinationPolicy; }
    public Map<String, String> sendPost(String url, int timeoutMillis) {
        destinationPolicy.requireLoopback(url);
        HttpHeaders headers = new HttpHeaders(); headers.setConnection("close");
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(Collections.singletonMap("subject", "anonymous-senior"), headers);
        ResponseEntity<String> response; int status; String body; Map<String, String> result = new HashMap<>();
        try {
            if (timeoutMillis == DEFAULT_TIMEOUT) response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            else { response = dynamicTemplateForExperiment(timeoutMillis).exchange(url, HttpMethod.POST, entity, String.class); restoreDefaultTimeout(); }
            status = response.getStatusCodeValue(); body = response.getBody();
        } catch (HttpStatusCodeException exception) {
            status = exception.getStatusCode().value(); body = exception.getResponseBodyAsString(); result.put("exceptionMessage", exception.getMessage());
        }
        result.put("statusCode", Integer.toString(status)); result.put("result", body); return result;
    }
    public RestTemplate dynamicTemplateForExperiment(int timeoutMillis) {
        HttpComponentsClientHttpRequestFactory factory = sharedFactory(); factory.setConnectTimeout(timeoutMillis); factory.setReadTimeout(timeoutMillis); return new RestTemplate(factory);
    }
    private void restoreDefaultTimeout() { HttpComponentsClientHttpRequestFactory factory = sharedFactory(); factory.setConnectTimeout(DEFAULT_TIMEOUT); factory.setReadTimeout(DEFAULT_TIMEOUT); }
    public HttpComponentsClientHttpRequestFactory sharedFactory() { return (HttpComponentsClientHttpRequestFactory) restTemplate.getRequestFactory(); }
}
