package com.gestionplanning.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class CorsConfig {
    private final List<HandlerInterceptor> interceptors;
    private final String frontendUrl;

    public CorsConfig(List<HandlerInterceptor> interceptors,
                      @Value("${app.frontend.url:http://192.168.1.117:3000}") String frontendUrl) {
        this.interceptors = interceptors;
        this.frontendUrl = frontendUrl;
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins(frontendUrl)
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*");
            }

            @Override
            public void addInterceptors(InterceptorRegistry registry) {
                interceptors.forEach(interceptor -> registry.addInterceptor(interceptor).addPathPatterns("/api/**"));
            }
        };
    }
}
