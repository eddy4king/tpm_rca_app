use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

pub async fn init() -> SqlitePool {
    dotenvy::dotenv().ok();
    
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:C:/Users/edosa/project/tpm_rca.db".to_string());

    println!("Connecting to :{}", database_url);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");
    println!("Database connected successfully!");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");
    println!("Migrations applied successfully!");

    pool
}