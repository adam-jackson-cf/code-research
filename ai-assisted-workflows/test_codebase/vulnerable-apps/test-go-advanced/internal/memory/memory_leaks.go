package memory

import (
    "fmt"
    "net/http"
    "time"
)

var leakyChannels []chan []byte

func LeakHandler(w http.ResponseWriter, r *http.Request) {
    size := 1024 * 1024
    
    ch := make(chan []byte, 1000)
    leakyChannels = append(leakyChannels, ch)
    
    go func() {
        for {
            data := make([]byte, size)
            select {
            case ch <- data:
            default:
            }
            time.Sleep(1 * time.Millisecond)
        }
    }()
    
    go func() {
        data := make([]byte, size*10)
        for {
            _ = data
            time.Sleep(10 * time.Millisecond)
        }
    }()
    
    fmt.Fprintf(w, "Memory leaks started. Active channels: %d", len(leakyChannels))
}

func StartLeakyGoroutines() {
    for i := 0; i < 10; i++ {
        go func(id int) {
            data := make([][]byte, 0)
            for {
                leak := make([]byte, 1024*1024)
                data = append(data, leak)
                if len(data) > 100 {
                    data = data[50:]
                }
                time.Sleep(100 * time.Millisecond)
            }
        }(i)
    }
}