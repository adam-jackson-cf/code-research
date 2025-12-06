package com.example.clean;

import com.example.clean.service.UserService;
import com.example.clean.service.DataService;
import com.example.clean.config.AppConfig;

public class Application {
    public static void main(String[] args) {
        System.out.println("Starting clean Java application...");
        
        AppConfig config = new AppConfig();
        UserService userService = new UserService(config);
        DataService dataService = new DataService();
        
        // Example usage with secure practices
        boolean userCreated = userService.createUser("admin", "securePassword123!", "admin@example.com");
        System.out.println("User creation: " + (userCreated ? "success" : "failed"));
        
        String[] sampleData = {"item1", "item2", "item3"};
        String[] results = dataService.processData(sampleData);
        System.out.println("Processed " + results.length + " items");
        
        System.out.println("Application completed successfully");
    }
}