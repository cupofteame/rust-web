use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder, Error, HttpRequest};
use dotenv::dotenv;
use mongodb::{
    bson::doc,
    options::ClientOptions,
    Client, Database,
};
use serde::{Deserialize, Serialize};
use futures_util::StreamExt;
use uuid::Uuid;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, decode, Header, EncodingKey, DecodingKey, Validation, errors::Error as JwtError};
use time::{Duration, OffsetDateTime};
use std::env;
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
use std::sync::Mutex;
use std::collections::HashSet;

const TOKEN_DURATION_HOURS: i64 = 24;

#[derive(Debug, Serialize, Deserialize)]
struct Account {
    id: String,
    username: String,
    email: String,
    password: String, // This will be stored hashed
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    username: String,
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Serialize)]
struct LoginResponse {
    id: String,
    username: String,
    email: String,
    token: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String, // subject (user id)
    exp: i64,    // expiration time
}

struct AppState {
    db: Database,
    jwt_secret: String,
    token_blacklist: Mutex<HashSet<String>>,
}

// Register a new account
async fn register(
    data: web::Data<AppState>,
    register_req: web::Json<RegisterRequest>,
) -> impl Responder {
    let collection = data.db.collection::<Account>("accounts");
    
    // Check if email already exists
    if let Ok(existing_account) = collection
        .find_one(doc! { "email": &register_req.email }, None)
        .await
    {
        if existing_account.is_some() {
            return HttpResponse::BadRequest()
                .json(doc! { "error": "Email already registered" });
        }
    }

    // Hash the password
    let hashed_password = match hash(register_req.password.as_bytes(), DEFAULT_COST) {
        Ok(hashed) => hashed,
        Err(_) => return HttpResponse::InternalServerError().finish(),
    };

    let new_account = Account {
        id: Uuid::new_v4().to_string(),
        username: register_req.username.clone(),
        email: register_req.email.clone(),
        password: hashed_password,
    };
    
    match collection.insert_one(&new_account, None).await {
        Ok(_) => {
            // Create a response without the password
            let mut response = new_account;
            response.password = String::new();
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            eprintln!("Error registering account: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// Login
async fn login(
    data: web::Data<AppState>,
    login_req: web::Json<LoginRequest>,
) -> impl Responder {
    let collection = data.db.collection::<Account>("accounts");
    
    // Find account by email
    match collection
        .find_one(doc! { "email": &login_req.email }, None)
        .await
    {
        Ok(Some(account)) => {
            // Verify password
            match verify(login_req.password.as_bytes(), &account.password) {
                Ok(true) => {
                    // Generate JWT token
                    match generate_token(&account.id, &data.jwt_secret) {
                        Ok(token) => {
                            let response = LoginResponse {
                                id: account.id,
                                username: account.username,
                                email: account.email,
                                token,
                            };
                            HttpResponse::Ok().json(response)
                        }
                        Err(_) => HttpResponse::InternalServerError().finish(),
                    }
                }
                Ok(false) => HttpResponse::Unauthorized()
                    .json(doc! { "error": "Invalid credentials" }),
                Err(_) => HttpResponse::InternalServerError().finish(),
            }
        }
        Ok(None) => HttpResponse::Unauthorized()
            .json(doc! { "error": "Invalid credentials" }),
        Err(e) => {
            eprintln!("Error during login: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// Generate JWT token
fn generate_token(user_id: &str, jwt_secret: &str) -> Result<String, JwtError> {
    let expiration = OffsetDateTime::now_utc() + Duration::hours(TOKEN_DURATION_HOURS);
    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiration.unix_timestamp(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
}

// Middleware to verify JWT token
async fn verify_token(req: &HttpRequest, data: &web::Data<AppState>) -> Result<Claims, Error> {
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = &auth_str[7..];
                
                // Check if token is blacklisted
                let blacklist = data.token_blacklist.lock().unwrap();
                if blacklist.contains(token) {
                    return Err(actix_web::error::ErrorUnauthorized("Token is invalid"));
                }
                
                // Continue with existing token verification
                if let Ok(token_data) = decode::<Claims>(
                    token,
                    &DecodingKey::from_secret(data.jwt_secret.as_bytes()),
                    &Validation::default(),
                ) {
                    return Ok(token_data.claims);
                }
            }
        }
    }
    Err(actix_web::error::ErrorUnauthorized("Invalid token"))
}

// Get all accounts (without exposing passwords)
async fn get_accounts(req: HttpRequest, data: web::Data<AppState>) -> Result<HttpResponse, Error> {
    // Verify token
    verify_token(&req, &data).await?;

    let collection = data.db.collection::<Account>("accounts");
    match collection.find(None, None).await {
        Ok(mut cursor) => {
            let mut accounts: Vec<Account> = Vec::new();
            while let Some(result) = cursor.next().await {
                match result {
                    Ok(mut account) => {
                        account.password = String::new();
                        accounts.push(account);
                    }
                    Err(e) => {
                        eprintln!("Error iterating account: {:?}", e);
                        return Ok(HttpResponse::InternalServerError().finish());
                    }
                }
            }
            
            // Generate ETag based on a simpler hash of account IDs and usernames
            let mut hasher = DefaultHasher::new();
            for account in &accounts {
                account.id.hash(&mut hasher);
                account.username.hash(&mut hasher);
                account.email.hash(&mut hasher);
            }
            let etag = format!("\"{:x}\"", hasher.finish());
            
            // Check if client has matching ETag
            if let Some(if_none_match) = req.headers().get("if-none-match") {
                if if_none_match == etag.as_str() {
                    return Ok(HttpResponse::NotModified().finish());
                }
            }
            
            Ok(HttpResponse::Ok()
                .insert_header(("ETag", etag))
                .insert_header(("Cache-Control", "private, must-revalidate"))
                .json(accounts))
        }
        Err(e) => {
            eprintln!("Error fetching accounts: {:?}", e);
            Ok(HttpResponse::InternalServerError().finish())
        }
    }
}

// Delete an account by id
async fn delete_account(
    req: HttpRequest,
    data: web::Data<AppState>,
    id: web::Path<String>,
) -> Result<HttpResponse, Error> {
    // Verify token and get claims
    let claims = verify_token(&req, &data).await?;
    
    let collection = data.db.collection::<Account>("accounts");
    match collection.delete_one(doc! { "id": &*id }, None).await {
        Ok(delete_result) => {
            if delete_result.deleted_count == 1 {
                // Check if user deleted their own account
                if claims.sub == *id {
                    // Return special status code to indicate client should logout
                    Ok(HttpResponse::Ok().json(doc! { "should_logout": true }))
                } else {
                    Ok(HttpResponse::NoContent().finish())
                }
            } else {
                Ok(HttpResponse::NotFound().json(doc! { "error": "Account not found" }))
            }
        }
        Err(e) => {
            eprintln!("Error deleting account: {:?}", e);
            Ok(HttpResponse::InternalServerError().finish())
        }
    }
}

async fn logout(
    req: HttpRequest,
    data: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                let token = auth_str[7..].to_string();
                // Add token to blacklist
                let mut blacklist = data.token_blacklist.lock().unwrap();
                blacklist.insert(token);
            }
        }
    }
    Ok(HttpResponse::Ok().json(doc! { "message": "Logged out successfully" }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    // Get environment variables
    let mongo_uri = env::var("MONGO_URI")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let jwt_secret = env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set in environment");

    let mut client_options = ClientOptions::parse(&mongo_uri)
        .await
        .expect("Failed to parse MongoDB URI");
    
    // Add connection pool settings
    client_options.max_pool_size = Some(10);  // Adjust based on your needs
    client_options.min_pool_size = Some(2);
    client_options.max_idle_time = Some(std::time::Duration::from_secs(60));
    client_options.app_name = Some("RustWebBackend".to_string());
    let client = Client::with_options(client_options).expect("Failed to initialize MongoDB client");
    let db = client.database("accounts");

    println!("Starting server at http://localhost:8080");

    let app_state = web::Data::new(AppState {
        db,
        jwt_secret: jwt_secret.clone(),
        token_blacklist: Mutex::new(HashSet::new()),
    });

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        App::new()
            .wrap(cors)
            .app_data(app_state.clone())
            .service(
                web::scope("/api")
                    .route("/auth/register", web::post().to(register))
                    .route("/auth/login", web::post().to(login))
                    .route("/auth/logout", web::post().to(logout))
                    .route("/accounts", web::get().to(get_accounts))
                    .route("/accounts/{id}", web::delete().to(delete_account))
            )
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
