package race

import (
    "fmt"
    "net/http"
    "sync"
    "time"
)

var (
    counter int
    data    map[string]int
    mu      sync.Mutex
)

func init() {
    data = make(map[string]int)
}

func RaceHandler(w http.ResponseWriter, r *http.Request) {
    key := r.URL.Query().Get("key")
    if key == "" {
        key = "default"
    }
    
    go incrementCounter()
    go incrementCounter()
    go incrementCounter()
    
    go updateMap(key, 1)
    go updateMap(key, 2)
    go readMap(key)
    
    time.Sleep(100 * time.Millisecond)
    
    fmt.Fprintf(w, "Race conditions triggered. Counter: %d, Data: %v", counter, data)
}

func incrementCounter() {
    for i := 0; i < 1000; i++ {
        counter++
    }
}

func updateMap(key string, value int) {
    for i := 0; i < 100; i++ {
        data[key] = value + i
    }
}

func readMap(key string) {
    for i := 0; i < 100; i++ {
        _ = data[key]
    }
}