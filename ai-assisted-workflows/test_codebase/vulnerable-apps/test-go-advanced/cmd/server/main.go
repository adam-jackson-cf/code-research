package main

import (
    "log"
    "net/http"
    
    "advanced-vulns/internal/unsafe"
    "advanced-vulns/internal/race"
    "advanced-vulns/internal/memory"
    
    "github.com/gorilla/mux"
)

func main() {
    r := mux.NewRouter()
    
    r.HandleFunc("/unsafe", unsafe.UnsafeHandler).Methods("GET")
    r.HandleFunc("/race", race.RaceHandler).Methods("GET")
    r.HandleFunc("/memory", memory.LeakHandler).Methods("GET")
    
    go memory.StartLeakyGoroutines()
    
    log.Println("Advanced vulnerable server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", r))
}