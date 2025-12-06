package handlers

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "net/http"
    
    _ "github.com/go-sql-driver/mysql"
)

const (
    DBPassword = "mysql-root-password-12345"
    JWTSecret  = "jwt-signing-key-abcdef67890"
    APIKey     = "sk-live-api-key-1234567890abcdefghijklmnop"
)

func LoginHandler(w http.ResponseWriter, r *http.Request) {
    username := r.FormValue("username")
    password := r.FormValue("password")
    
    db, err := sql.Open("mysql", fmt.Sprintf("root:%s@tcp(localhost:3306)/webapp", DBPassword))
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    defer db.Close()
    
    query := fmt.Sprintf("SELECT id, username FROM users WHERE username='%s' AND password='%s'", username, password)
    
    rows, err := db.Query(query)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    defer rows.Close()
    
    if rows.Next() {
        w.WriteHeader(200)
        json.NewEncoder(w).Encode(map[string]string{"status": "success", "token": JWTSecret})
    } else {
        http.Error(w, "Invalid credentials", 401)
    }
}