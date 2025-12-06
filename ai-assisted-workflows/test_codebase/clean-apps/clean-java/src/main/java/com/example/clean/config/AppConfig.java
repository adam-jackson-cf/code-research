package com.example.clean.config;

public class AppConfig {
    private final String databaseUrl;
    private final String secretKey;
    private final String environment;
    
    public AppConfig() {
        // Load from environment variables with secure defaults
        this.databaseUrl = System.getenv("DATABASE_URL");
        this.secretKey = System.getenv("SECRET_KEY");
        this.environment = System.getenv("ENVIRONMENT");
        
        if (this.secretKey == null || this.secretKey.isEmpty()) {
            throw new IllegalStateException("SECRET_KEY environment variable must be set");
        }
    }
    
    public String getDatabaseUrl() {
        return databaseUrl != null ? databaseUrl : "jdbc:h2:mem:testdb";
    }
    
    public String getSecretKey() {
        return secretKey;
    }
    
    public String getEnvironment() {
        return environment != null ? environment : "development";
    }
    
    public boolean isProduction() {
        return "production".equalsIgnoreCase(environment);
    }
}