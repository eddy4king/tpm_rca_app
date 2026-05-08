
use tauri::Manager;
use commands::{create_equipment, get_all_equipment, get_equipment, update_equipment, delete_equipment};



mod commands;
mod models;
mod db;
mod services;
mod sync;
mod errors;


// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .setup(|app|  {
            dotenvy::dotenv().ok();
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(
                async move {
                    let pool = db::init().await;
                    handle.manage(pool);
                }
            );
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            create_equipment,
            get_all_equipment,
            get_equipment,
            update_equipment,
            delete_equipment])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
