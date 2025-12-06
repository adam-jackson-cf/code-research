package com.example.clean.model;

public class User {
    private final String username;
    private final String passwordHash;
    private final String email;
    private final long createdTimestamp;

    public User(String username, String passwordHash, String email) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.email = email;
        this.createdTimestamp = System.currentTimeMillis();
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getEmail() {
        return email;
    }

    public long getCreatedTimestamp() {
        return createdTimestamp;
    }

    @Override
    public String toString() {
        return "User{" +
                "username='" + username + '\'' +
                ", email='" + email + '\'' +
                ", created=" + createdTimestamp +
                '}';
    }
}