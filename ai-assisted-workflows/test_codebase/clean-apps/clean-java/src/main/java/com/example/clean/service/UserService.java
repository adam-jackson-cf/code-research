package com.example.clean.service;

import com.example.clean.config.AppConfig;
import com.example.clean.model.User;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;

public class UserService {
    private final AppConfig config;
    private final Map<String, User> users;
    private final SecureRandom random;

    public UserService(AppConfig config) {
        this.config = config;
        this.users = new HashMap<>();
        this.random = new SecureRandom();
    }

    public boolean createUser(String username, String password, String email) {
        if (users.containsKey(username)) {
            return false;
        }

        try {
            String hashedPassword = hashPassword(password);
            User user = new User(username, hashedPassword, email);
            users.put(username, user);
            return true;
        } catch (NoSuchAlgorithmException e) {
            System.err.println("Password hashing failed: " + e.getMessage());
            return false;
        }
    }

    public User authenticateUser(String username, String password) {
        User user = users.get(username);
        if (user == null) {
            return null;
        }

        try {
            String hashedInput = hashPassword(password);
            if (user.getPasswordHash().equals(hashedInput)) {
                return user;
            }
        } catch (NoSuchAlgorithmException e) {
            System.err.println("Authentication failed: " + e.getMessage());
        }
        
        return null;
    }

    private String hashPassword(String password) throws NoSuchAlgorithmException {
        byte[] salt = new byte[16];
        random.nextBytes(salt);
        
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        md.update(salt);
        byte[] hashedPassword = md.digest(password.getBytes());
        
        StringBuilder sb = new StringBuilder();
        for (byte b : salt) {
            sb.append(String.format("%02x", b));
        }
        for (byte b : hashedPassword) {
            sb.append(String.format("%02x", b));
        }
        
        return sb.toString();
    }

    public int getUserCount() {
        return users.size();
    }
}