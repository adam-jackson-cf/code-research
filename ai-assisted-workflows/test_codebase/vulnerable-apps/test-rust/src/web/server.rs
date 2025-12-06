use warp::Filter;
use std::collections::HashMap;
use std::process::Command;

pub async fn start_server() {
    let routes = warp::path("api")
        .and(
            warp::path("execute")
                .and(warp::post())
                .and(warp::body::json())
                .and_then(execute_command)
                .or(warp::path("user")
                    .and(warp::path::param::<String>())
                    .and_then(get_user))
        );

    warp::serve(routes)
        .run(([127, 0, 0, 1], 3030))
        .await;
}

async fn execute_command(params: HashMap<String, String>) -> Result<impl warp::Reply, warp::Rejection> {
    if let Some(cmd) = params.get("command") {
        let output = Command::new("sh")
            .arg("-c")
            .arg(cmd)
            .output()
            .map_err(|_| warp::reject::not_found())?;
        
        Ok(warp::reply::json(&format!("Output: {}", String::from_utf8_lossy(&output.stdout))))
    } else {
        Err(warp::reject::not_found())
    }
}

async fn get_user(user_id: String) -> Result<impl warp::Reply, warp::Rejection> {
    let query = format!("SELECT * FROM users WHERE id = {}", user_id);
    
    let mut response = HashMap::new();
    response.insert("query", query);
    response.insert("user_id", user_id);
    
    Ok(warp::reply::json(&response))
}