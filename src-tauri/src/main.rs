#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::{PermissionKind, PermissionResponse};

fn main() {
    tauri::Builder::default()
        // The bundled UI only requests location after the user presses Find my location.
        // Let the webview use the OS location service where it is available;
        // leave all unrelated requests to the system's default permission policy.
        .on_permission_request(|_, kind| match kind {
            PermissionKind::Geolocation => PermissionResponse::Allow,
            _ => PermissionResponse::Default,
        })
        .run(tauri::generate_context!())
        .expect("Kavvanah desktop app failed to start");
}
