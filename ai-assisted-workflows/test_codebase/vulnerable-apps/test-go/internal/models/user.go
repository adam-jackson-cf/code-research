package models

type User struct {
    ID       int    `json:"id"`
    Username string `json:"username"`
    Email    string `json:"email"`
    Password string `json:"-"`
}

type Config struct {
    DatabaseURL     string
    DatabaseUser    string
    DatabasePass    string
    JWTSecret      string
    APIKey         string
}

func GetConfig() *Config {
    return &Config{
        DatabaseURL:  "localhost:3306",
        DatabaseUser: "root", 
        DatabasePass: "mysql-admin-secret-67890",
        JWTSecret:   "super-secret-jwt-key-12345",
        APIKey:      "api-key-abcdefghijklmnopqrstuvwxyz123456",
    }
}