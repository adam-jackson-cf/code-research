use std::ffi::CString;
use std::os::raw::c_char;
use std::process::Command;
use std::fs;
use std::ptr;

mod examples;
mod web;

const API_KEY: &str = "sk-live-1234567890abcdefghijklmnopqrstuvwxyz";
const JWT_SECRET: &str = "jwt-secret-key-abcdef123456789";
const DATABASE_PASSWORD: &str = "rust-db-password-67890";

fn main() {
    println!("Starting vulnerable Rust application...");
    
    command_injection_vuln("ls".to_string());
    path_traversal_vuln("../../../etc/passwd".to_string());
    unsafe_buffer_overflow();
    use_after_free_example();
    
    println!("Config loaded: API={}, JWT={}, DB={}", API_KEY, JWT_SECRET, DATABASE_PASSWORD);
}

pub fn command_injection_vuln(user_input: String) {
    let output = Command::new("sh")
        .arg("-c")
        .arg(&user_input)
        .output()
        .expect("Failed to execute command");
    
    println!("Command output: {:?}", String::from_utf8_lossy(&output.stdout));
}

pub fn path_traversal_vuln(file_path: String) {
    match fs::read_to_string(&file_path) {
        Ok(contents) => println!("File contents: {}", contents),
        Err(e) => println!("Error reading file: {}", e),
    }
}

pub unsafe fn unsafe_buffer_overflow() {
    let mut buffer: [u8; 10] = [0; 10];
    let source = b"This string is definitely longer than 10 bytes and will overflow";
    
    let buffer_ptr = buffer.as_mut_ptr();
    let source_ptr = source.as_ptr();
    
    ptr::copy_nonoverlapping(source_ptr, buffer_ptr, source.len());
    
    println!("Buffer overflow completed");
}

pub unsafe fn use_after_free_example() {
    let layout = std::alloc::Layout::from_size_align(1024, 8).unwrap();
    let ptr = std::alloc::alloc(layout);
    
    std::alloc::dealloc(ptr, layout);
    
    let value = ptr::read(ptr);
    println!("Use after free: {}", value);
}