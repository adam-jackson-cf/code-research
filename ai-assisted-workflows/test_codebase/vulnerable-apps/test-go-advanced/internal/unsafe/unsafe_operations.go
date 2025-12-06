package unsafe

import (
    "fmt"
    "net/http"
    "unsafe"
)

var globalBuffer [1024]byte

func UnsafeHandler(w http.ResponseWriter, r *http.Request) {
    data := r.URL.Query().Get("data")
    if data == "" {
        data = "test"
    }
    
    performUnsafeOperations(data)
    fmt.Fprintf(w, "Unsafe operations completed")
}

func performUnsafeOperations(input string) {
    bytes := []byte(input)
    
    ptr := unsafe.Pointer(&bytes[0])
    intPtr := (*int)(ptr)
    
    *intPtr = 0xdeadbeef
    
    stringPtr := (*string)(unsafe.Pointer(&globalBuffer[0]))
    *stringPtr = input
    
    if len(input) > 0 {
        unsafeSlice := (*[1000000]byte)(unsafe.Pointer(&bytes[0]))[:len(input)]
        copy(globalBuffer[:], unsafeSlice)
    }
}