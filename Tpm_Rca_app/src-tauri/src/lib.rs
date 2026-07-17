
use tauri::Manager;
use commands::{
    create_equipment,
    get_all_equipment,
    get_equipment,
    update_equipment,
    delete_equipment,
    import_equipment_csv,
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
    clear_all_sessions,
    check_permission,
    admin_reset_password,
    change_own_password,
    set_recovery_question,
    get_recovery_question,
    verify_recovery_answer,
    get_oee_metrics,
    create_fmea,
    get_fmea,
    update_fmea,
    delete_fmea,


};
use commands::role::get_role_permissions;
use commands::{export_peer_snapshot, merge_peer_database, discover_peers};
use commands::knowledge::{
    create_knowledge_note, get_knowledge_notes, get_knowledge_note, update_knowledge_note,
    delete_knowledge_note, search_knowledge_notes,
};
use crate::services::integrations::*;
use crate::services::ai::rca_coach_report;
use crate::services::reliability::reliability_report;
use crate::services::cbm::{get_cbm_rules, upsert_cbm_rule, delete_cbm_rule, cbm_triggers};
use commands::hierarchy::{
    create_plant, get_all_plants, update_plant, delete_plant,
    create_area, get_areas_by_plant, get_all_areas, update_area, delete_area,
};
use commands::audit::{create_audit_log, get_audit_logs};
use commands::inventory::{
    create_item, get_items, get_item, get_low_stock_items, update_item, delete_item,
    record_inventory_txn, get_item_transactions,
};
use commands::workorders::{
    create_wo, get_wos, get_wo, update_wo, complete_wo, delete_wo,
    add_wo_labor, remove_wo_labor, add_wo_part, remove_wo_part,
    get_wo_labor, get_wo_parts, get_timesheet_entries,
};
use commands::notifications::{
    get_notifications, get_unread_count, mark_notification_read, mark_all_read,
    get_notification_prefs, update_notification_prefs, generate_alerts,
};
use commands::reports::{
    create_report_schedule, get_report_schedules, delete_report_schedule, run_report_schedule,
};
use commands::timeline::get_maintenance_timeline;
use commands::backup::{backup_database, list_backups, restore_database};


mod commands;
mod models;
mod db;
mod services;
mod policy;
mod sync;
mod errors;
mod session;


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
            let pool =  tauri::async_runtime::block_on(
                async {db::init().await});
                  handle.manage(pool);
                  handle.manage(crate::session::SessionState::default());
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
            import_equipment_csv,
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
            export_peer_snapshot,
            merge_peer_database,
            discover_peers,
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
            clear_all_sessions,
            check_permission,
            admin_reset_password,
            change_own_password,
            set_recovery_question,
            get_recovery_question,
            verify_recovery_answer,
            get_role_permissions,
            get_oee_metrics,
            reliability_report,
            create_fmea,
            get_fmea,
            update_fmea,
            delete_fmea,
            create_issue,
            rca_coach_report,
            create_plant,
            get_all_plants,
            update_plant,
            delete_plant,
            create_area,
            get_areas_by_plant,
            get_all_areas,
            update_area,
            delete_area,
            create_audit_log,
            get_audit_logs,
            create_item,
            get_items,
            get_item,
            get_low_stock_items,
            update_item,
            delete_item,
            record_inventory_txn,
            get_item_transactions,
            create_wo,
            get_wos,
            get_wo,
            update_wo,
            complete_wo,
            delete_wo,
            add_wo_labor,
            remove_wo_labor,
            add_wo_part,
            remove_wo_part,
            get_wo_labor,
            get_wo_parts,
            get_timesheet_entries,
            get_notifications,
            get_unread_count,
            mark_notification_read,
            mark_all_read,
            get_notification_prefs,
            update_notification_prefs,
            generate_alerts,
            create_report_schedule,
            get_report_schedules,
            delete_report_schedule,
            run_report_schedule,
            get_maintenance_timeline,
            backup_database,
            list_backups,
            restore_database,
            get_cbm_rules,
            upsert_cbm_rule,
            delete_cbm_rule,
            cbm_triggers,
            create_knowledge_note,
            get_knowledge_notes,
            get_knowledge_note,
            update_knowledge_note,
            delete_knowledge_note,
            search_knowledge_notes])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
