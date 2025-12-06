package com.example.clean.service;

import java.util.ArrayList;
import java.util.List;

public class DataService {
    
    public String[] processData(String[] inputData) {
        if (inputData == null) {
            return new String[0];
        }
        
        List<String> results = new ArrayList<>();
        
        for (String item : inputData) {
            if (item != null && !item.trim().isEmpty()) {
                String processed = processItem(item.trim());
                results.add(processed);
            }
        }
        
        return results.toArray(new String[0]);
    }
    
    private String processItem(String item) {
        // Simple processing - convert to uppercase and add processed flag
        return item.toUpperCase() + "_PROCESSED";
    }
    
    public boolean validateData(String data) {
        return data != null && 
               !data.trim().isEmpty() && 
               data.length() <= 1000 &&
               !containsUnsafeCharacters(data);
    }
    
    private boolean containsUnsafeCharacters(String data) {
        // Check for potentially unsafe characters
        String unsafe = "<>\"'&";
        for (char c : unsafe.toCharArray()) {
            if (data.indexOf(c) != -1) {
                return true;
            }
        }
        return false;
    }
    
    public String sanitizeInput(String input) {
        if (input == null) {
            return "";
        }
        
        return input.trim()
                   .replaceAll("[<>\"'&]", "")
                   .substring(0, Math.min(input.length(), 1000));
    }
}