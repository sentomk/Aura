#[tauri::command]
fn get_backend_url() -> String {
    std::env::var("AURA_BACKEND_URL").unwrap_or_else(|_| String::from("http://localhost:8000"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_backend_url])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_, _| {});
}
