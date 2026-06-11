
use tauri::Manager;
use commands::{
    create_equipment,
    get_all_equipment,
    get_equipment,
    update_equipment,
    delete_equipment,
    create_downtime,
    get_equipment_downtime,
    close_downtime,
    create_investigation,
    get_investigation_nodes,
    get_investigations,
    add_rca_node,
    update_downtime,
    delete_downtime,
    update_investigation,
    delete_investigation,
    delete_rca_node,
    update_node_position,
    get_all_downtime,
    update_rca_node,
    create_capa,
    get_investigation_capas,
    update_capa,
    delete_capa,
    get_all_capas,
    create_pm_schedule,
    get_equipment_pm_schedules,
    get_all_pm_schedules,
    update_pm_schedule,
    delete_pm_schedule,
    complete_pm_schedule,
    get_sync_config_cmd,
    update_sync_config,
    push_to_postgres,
    pull_from_postgres,
    test_postgres_connection,
    get_sync_logs,
    register_user,
    login_user,
    logout_user,
    validate_session,
    get_all_users,
    update_user,
    delete_user,
    setup_admin,
    has_users,
    get_users_debug,
    reset_users,
    clear_all_sessions
};



mod commands;
mod models;
mod db;
mod services;
mod policy;
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
            tauri::async_runtime::block_on(
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
            delete_equipment,
            create_downtime,
            get_equipment_downtime,
            close_downtime,
            create_investigation,
            get_investigation_nodes,
            get_investigations,
            add_rca_node,
            update_downtime,
            delete_downtime,
            update_investigation,
            delete_investigation,
            delete_rca_node,
            update_node_position,
            get_all_downtime,
            update_rca_node,
            create_capa,
            get_investigation_capas,
            update_capa,
            delete_capa,
            get_all_capas,
            create_pm_schedule,
            get_equipment_pm_schedules,
            get_all_pm_schedules,
            update_pm_schedule,
            delete_pm_schedule,
            complete_pm_schedule,
            get_sync_config_cmd,
            update_sync_config,
            push_to_postgres,
            pull_from_postgres,
            test_postgres_connection,
            get_sync_logs,
            register_user,
            login_user,
            logout_user,
            validate_session,
            get_all_users,
            update_user,
            delete_user,
            setup_admin,
            has_users,
            get_users_debug,
            reset_users,
            clear_all_sessions])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
