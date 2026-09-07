package com.example.b2glab.config;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.apache.http.impl.client.HttpClientBuilder;
import org.apache.http.impl.conn.PoolingHttpClientConnectionManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.http.converter.FormHttpMessageConverter;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestTemplate;

@Configuration
public class LegacyClientConfiguration {
    @Bean
    public PoolingHttpClientConnectionManager legacyConnectionManager(@Value("${lab.legacy.max-total}") int maxTotal, @Value("${lab.legacy.max-per-route}") int maxPerRoute) {
        PoolingHttpClientConnectionManager manager = new PoolingHttpClientConnectionManager();
        manager.setMaxTotal(maxTotal); manager.setDefaultMaxPerRoute(maxPerRoute); return manager;
    }
    @Bean
    public RestTemplate legacyRestTemplate(PoolingHttpClientConnectionManager manager) {
        HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory(HttpClientBuilder.create().setConnectionManager(manager).build());
        RestTemplate template = new RestTemplate(factory);
        template.setMessageConverters(Arrays.asList(new StringHttpMessageConverter(StandardCharsets.UTF_8), new MappingJackson2HttpMessageConverter(), new FormHttpMessageConverter()));
        return template;
    }
}
