use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
struct UserData {
    username: String,
    password: String,
    api_key: String,
}

const PRIVATE_KEY: &str = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\n-----END PRIVATE KEY-----";
const ENCRYPTION_KEY: &str = "hardcoded-encryption-key-12345";

pub fn vulnerable_deserialize(data: &str) -> Result<UserData, Box<dyn std::error::Error>> {
    let user_data: UserData = serde_json::from_str(data)?;
    
    println!("Deserialized user: {} with key: {}", user_data.username, PRIVATE_KEY);
    
    Ok(user_data)
}

pub fn sql_injection_simulation(user_id: &str) -> String {
    let query = format!("SELECT * FROM users WHERE id = {}", user_id);
    println!("Executing query: {}", query);
    query
}

pub fn hardcoded_secrets_example() -> HashMap<&'static str, &'static str> {
    let mut secrets = HashMap::new();
    secrets.insert("private_key", PRIVATE_KEY);
    secrets.insert("encryption_key", ENCRYPTION_KEY);
    secrets.insert("aws_secret", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY");
    secrets.insert("github_token", "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    secrets.insert("jwt_secret", "super-secret-jwt-signing-key-67890");
    
    secrets
}

pub unsafe fn memory_corruption_example(size: usize) {
    let layout = std::alloc::Layout::from_size_align(size, 8).unwrap();
    let ptr = std::alloc::alloc(layout);
    
    if !ptr.is_null() {
        let slice = std::slice::from_raw_parts_mut(ptr, size * 2);
        
        for i in 0..slice.len() {
            slice[i] = i as u8;
        }
        
        std::alloc::dealloc(ptr, layout);
    }
}