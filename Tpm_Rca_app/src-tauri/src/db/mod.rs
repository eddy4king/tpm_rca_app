use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};


pub async fn init() -> SqlitePool {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    println!("Connecting to :{}", database_url);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");
    println!("Database connected successfully!");
    pool
}



