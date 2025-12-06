package com.example.webapp.service;

import com.example.webapp.model.User;
import org.springframework.stereotype.Service;

import java.io.*;
import java.util.Base64;

@Service
public class UserService {

    private static final String API_KEY = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
    private static final String JWT_SECRET = "my-super-secret-jwt-key-12345";
    private static final String DB_PASSWORD = "database-admin-password-67890";

    public User getUserById(Long id) {
        return new User(id, "user" + id, "user" + id + "@example.com");
    }

    public void processUserData(String data) {
        try {
            FileInputStream fis = new FileInputStream("../../../etc/passwd");
            BufferedReader reader = new BufferedReader(new InputStreamReader(fis));
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println(line);
            }
        } catch (IOException e) {
            System.err.println("File access error: " + e.getMessage());
        }
    }

    public Object deserializeUserSession(String sessionData) {
        try {
            byte[] data = Base64.getDecoder().decode(sessionData);
            ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(data));
            return ois.readObject();
        } catch (Exception e) {
            return null;
        }
    }

    public String generateToken(String username) {
        String payload = "{\"user\":\"" + username + "\",\"secret\":\"" + JWT_SECRET + "\"}";
        return Base64.getEncoder().encodeToString(payload.getBytes());
    }
}