use sqlx::SqlitePool;
use tauri::State;
use crate::models::TimelineEvent;

#[tauri::command]
pub async fn get_maintenance_timeline(
    pool: State<'_, SqlitePool>,
    equipment_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<TimelineEvent>, String> {
    let mut sql = String::from(
        "SELECT * FROM ( \
            SELECT id, 'downtime_start' as event_type, COALESCE(title, 'Downtime') as title, \
                equipment_id, (SELECT name FROM equipment e WHERE e.id = downtime.equipment_id) as equipment_name, \
                start_time as timestamp, 'Open' as status, NULL as priority, loss_category as meta \
             FROM downtime WHERE start_time IS NOT NULL \
            UNION ALL \
            SELECT id, 'downtime_end' as event_type, COALESCE(title, 'Downtime') as title, \
                equipment_id, (SELECT name FROM equipment e WHERE e.id = downtime.equipment_id) as equipment_name, \
                end_time as timestamp, 'Closed' as status, NULL as priority, loss_category as meta \
             FROM downtime WHERE end_time IS NOT NULL \
            UNION ALL \
            SELECT id, 'pm_complete' as event_type, COALESCE(title, 'PM Task') as title, \
                equipment_id, (SELECT name FROM equipment e WHERE e.id = pm_schedule.equipment_id) as equipment_name, \
                last_completed_at as timestamp, 'Completed' as status, priority, frequency as meta \
             FROM pm_schedule WHERE last_completed_at IS NOT NULL \
            UNION ALL \
            SELECT id, 'capa_created' as event_type, COALESCE(title, 'CAPA') as title, \
                (SELECT equipment_id FROM rca_investigations ri WHERE ri.id = capa.investigation_id) as equipment_id, \
                (SELECT name FROM equipment e WHERE e.id = (SELECT equipment_id FROM rca_investigations ri WHERE ri.id = capa.investigation_id)) as equipment_name, \
                created_at as timestamp, status, priority, NULL as meta \
             FROM capa WHERE created_at IS NOT NULL \
         ) t"
    );

    if equipment_id.is_some() {
        sql.push_str(" WHERE t.equipment_id = ?");
    }
    sql.push_str(" ORDER BY t.timestamp DESC LIMIT ?");

    let mut q = sqlx::query_as::<_, TimelineEvent>(&sql);
    if let Some(v) = equipment_id {
        q = q.bind(v);
    }
    q = q.bind(limit.unwrap_or(500));

    q.fetch_all(&*pool)
        .await
        .map_err(|e: sqlx::Error| e.to_string())
}
