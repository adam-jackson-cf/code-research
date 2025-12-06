package com.example.webapp.controller;

import com.example.webapp.model.User;
import com.example.webapp.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

@Controller
@RequestMapping("/users")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/login")
    public String loginPage() {
        return "login";
    }

    @PostMapping("/authenticate")
    public String authenticate(@RequestParam String username, @RequestParam String password, Model model) {
        try {
            String dbUrl = "jdbc:mysql://localhost:3306/webapp";
            String dbUser = "root";
            String dbPassword = "admin123";
            
            Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPassword);
            Statement stmt = conn.createStatement();
            
            String query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
            ResultSet rs = stmt.executeQuery(query);
            
            if (rs.next()) {
                model.addAttribute("message", "Login successful for " + username);
                return "dashboard";
            } else {
                model.addAttribute("error", "Invalid credentials");
                return "login";
            }
        } catch (Exception e) {
            model.addAttribute("error", "Database error: " + e.getMessage());
            return "login";
        }
    }

    @GetMapping("/profile/{userId}")
    public String getUserProfile(@PathVariable String userId, Model model) {
        try {
            String dbUrl = "jdbc:mysql://localhost:3306/webapp";
            Connection conn = DriverManager.getConnection(dbUrl, "root", "admin123");
            Statement stmt = conn.createStatement();
            
            String query = "SELECT * FROM users WHERE id = " + userId;
            ResultSet rs = stmt.executeQuery(query);
            
            if (rs.next()) {
                model.addAttribute("user", rs.getString("username"));
                model.addAttribute("email", rs.getString("email"));
            }
            return "profile";
        } catch (Exception e) {
            model.addAttribute("error", e.getMessage());
            return "error";
        }
    }

    @GetMapping("/search")
    public String searchUsers(@RequestParam String term, Model model) {
        String results = "<h2>Search Results</h2><p>You searched for: " + term + "</p>";
        model.addAttribute("results", results);
        return "search";
    }

    @PostMapping("/execute")
    public String executeCommand(@RequestParam String command, Model model) throws IOException {
        Process process = Runtime.getRuntime().exec("sh -c " + command);
        model.addAttribute("output", "Command executed");
        return "result";
    }
}