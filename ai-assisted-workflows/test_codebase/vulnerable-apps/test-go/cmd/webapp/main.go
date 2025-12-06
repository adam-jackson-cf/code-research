package main

import (
    "log"
    "net/http"
    "vulnerable-webapp/internal/handlers"
    
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()
    
    r.HandleFunc("/login", handlers.LoginHandler).Methods("POST")
    r.HandleFunc("/users/{id}", handlers.GetUserHandler).Methods("GET")
    r.HandleFunc("/search", handlers.SearchHandler).Methods("GET")
    r.HandleFunc("/files", handlers.FileHandler).Methods("GET")
    
    log.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", r))
}