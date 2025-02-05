use actix_cors::Cors;
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use dotenv::dotenv;
use mongodb::{
    bson::doc,
    options::ClientOptions,
    Client, Database,
};
use serde::{Deserialize, Serialize};
use futures_util::StreamExt;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
struct Account {
    id: String,
    username: String,
}

#[derive(Debug, Deserialize)]
struct CreateAccountRequest {
    username: String,
}

struct AppState {
    db: Database,
}

// Get all accounts
async fn get_accounts(data: web::Data<AppState>) -> impl Responder {
    let collection = data.db.collection::<Account>("accounts");
    match collection.find(None, None).await {
        Ok(mut cursor) => {
            let mut accounts: Vec<Account> = Vec::new();
            while let Some(result) = cursor.next().await {
                match result {
                    Ok(account) => accounts.push(account),
                    Err(e) => {
                        eprintln!("Error iterating account: {:?}", e);
                        return HttpResponse::InternalServerError().finish();
                    }
                }
            }
            HttpResponse::Ok().json(accounts)
        }
        Err(e) => {
            eprintln!("Error fetching accounts: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// Create a new account
async fn create_account(
    data: web::Data<AppState>,
    account: web::Json<CreateAccountRequest>,
) -> impl Responder {
    let collection = data.db.collection::<Account>("accounts");
    let new_account = Account {
        id: Uuid::new_v4().to_string(),
        username: account.username.clone(),
    };
    
    match collection.insert_one(&new_account, None).await {
        Ok(_) => HttpResponse::Ok().json(new_account),
        Err(e) => {
            eprintln!("Error inserting account: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

// Delete an account by id (expecting the id in hex string format)
async fn delete_account(
    data: web::Data<AppState>,
    id: web::Path<String>,
) -> impl Responder {
    let collection = data.db.collection::<Account>("accounts");
    match collection.delete_one(doc! { "id": &*id }, None).await {
        Ok(delete_result) => {
            if delete_result.deleted_count == 1 {
                HttpResponse::NoContent().finish()
            } else {
                HttpResponse::NotFound().finish()
            }
        }
        Err(e) => {
            eprintln!("Error deleting account: {:?}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    // Get MongoDB URI from environment or use a default
    let mongo_uri =
        std::env::var("MONGO_URI").unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let mut client_options = ClientOptions::parse(&mongo_uri)
        .await
        .expect("Failed to parse MongoDB connection string");
    client_options.app_name = Some("RustWebBackend".to_string());
    let client = Client::with_options(client_options).expect("Failed to initialize MongoDB client");
    let db = client.database("accounts"); // Database name

    println!("Starting server at http://localhost:8080");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        App::new()
            .wrap(cors)
            .app_data(web::Data::new(AppState { db: db.clone() }))
            .route("/api/accounts", web::get().to(get_accounts))
            .route("/api/accounts", web::post().to(create_account))
            .route("/api/accounts/{id}", web::delete().to(delete_account))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
