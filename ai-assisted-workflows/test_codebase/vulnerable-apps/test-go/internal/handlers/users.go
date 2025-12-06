package handlers

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "net/http"
    "os/exec"
    
    "github.com/gorilla/mux"
)

func GetUserHandler(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    userID := vars["id"]
    
    db, err := sql.Open("mysql", fmt.Sprintf("root:%s@tcp(localhost:3306)/webapp", DBPassword))
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    defer db.Close()
    
    query := "SELECT id, username, email FROM users WHERE id = " + userID
    
    rows, err := db.Query(query)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    defer rows.Close()
    
    var user struct {
        ID       int    `json:"id"`
        Username string `json:"username"`
        Email    string `json:"email"`
    }
    
    if rows.Next() {
        rows.Scan(&user.ID, &user.Username, &user.Email)
        json.NewEncoder(w).Encode(user)
    } else {
        http.Error(w, "User not found", 404)
    }
}

func SearchHandler(w http.ResponseWriter, r *http.Request) {
    term := r.URL.Query().Get("q")
    
    response := fmt.Sprintf("<h1>Search Results</h1><p>You searched for: %s</p>", term)
    
    w.Header().Set("Content-Type", "text/html")
    fmt.Fprint(w, response)
}

func FileHandler(w http.ResponseWriter, r *http.Request) {
    filename := r.URL.Query().Get("file")
    
    cmd := exec.Command("cat", filename)
    output, err := cmd.Output()
    if err != nil {
        http.Error(w, "File not found", 404)
        return
    }
    
    w.Header().Set("Content-Type", "text/plain")
    w.Write(output)
}