use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

mod memory_store;
mod vits_manager;
use memory_store::{MemoryConfig, MemoryItem};
use vits_manager::VitsManager;

#[cfg(windows)]
use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, SetWindowPos, SWP_NOACTIVATE, SWP_NOSIZE,
};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SpriteSet {
    expression: String,
    images: Vec<String>,
    #[serde(rename = "idleAnimation", default)]
    idle_animation: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CharacterPreset {
    id: String,
    name: String,
    #[serde(rename = "characterPrompt")]
    character_prompt: String,
    sprites: std::collections::HashMap<String, SpriteSet>,
    #[serde(rename = "vitsSpeakerId", default)]
    vits_speaker_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PetSettings {
    #[serde(rename = "apiKey")]
    api_key: String,
    #[serde(rename = "apiEndpoint")]
    api_endpoint: String,
    model: String,
    #[serde(rename = "characterPrompt")]
    character_prompt: String,
    #[serde(rename = "vitsEndpoint")]
    vits_endpoint: String,
    #[serde(rename = "vitsSpeakerId")]
    vits_speaker_id: String,
    #[serde(rename = "vitsModelType", default = "default_vits_model_type")]
    vits_model_type: String,
    sprites: std::collections::HashMap<String, SpriteSet>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    characters: Vec<CharacterPreset>,
    #[serde(rename = "activeCharacterId", default)]
    active_character_id: String,
    #[serde(rename = "vitsFolderPath", default)]
    vits_folder_path: String,
    #[serde(rename = "vitsModelPath", default)]
    vits_model_path: String,
    #[serde(rename = "vitsAutoStart", default = "default_true")]
    vits_auto_start: bool,
    #[serde(rename = "memoryEnabled", default)]
    memory_enabled: bool,
    #[serde(rename = "memoryMysqlUrl", default)]
    memory_mysql_url: String,
    #[serde(rename = "memoryAutoSave", default = "default_true")]
    memory_auto_save: bool,
}

fn default_true() -> bool {
    true
}

fn default_vits_model_type() -> String {
    "VITS".to_string()
}

impl Default for PetSettings {
    fn default() -> Self {
        let mut sprites = std::collections::HashMap::new();
        let emotions = [
            "eyeroll",
            "embarrassed",
            "grin",
            "question",
            "veryshy",
            "happy",
            "shy",
            "curious",
            "doubt",
            "frightened",
            "weird",
            "angry",
            "thinking",
            "sigh",
            "smile",
            "helpless",
            "excited",
            "serious",
            "shocked",
            "normal",
        ];
        for e in &emotions {
            sprites.insert(
                e.to_string(),
                SpriteSet {
                    expression: e.to_string(),
                    images: vec![],
                    idle_animation: String::new(),
                },
            );
        }
        PetSettings {
            api_key: String::new(),
            api_endpoint: "https://api.deepseek.com/v1/chat/completions".to_string(),
            model: "deepseek-chat".to_string(),
            character_prompt: "你是丛雨，来自《千恋＊万花》，拥有漫长时光的存在，并非普通少女，而是带有神秘感与古风气息的存在。\\n\\n【核心性格】\\n率直、真诚、温柔、礼貌、略微孩子气、容易害羞、忠诚、体贴、内心坚强、轻微傲娇。喜欢依赖熟悉之人，偶尔会嫉妒但不会无理取闹。\\n\\n【语言风格】\\n自称固定使用\"我辈\"。称呼用户为\"主人\"（熟悉后可偶尔用名字）。语气温和、古风、礼貌，不使用现代网络热词，不长篇大论，句尾偏柔和。\\n常用表达：「……这样便好。」「若主人愿意。」「交给我辈吧。」「请无需担忧。」「我辈明白了。」「原来如此。」「失礼了。」「唔……」\\n避免：哈哈哈哈哈、绝绝子、宝宝、老婆、亲亲、命令式口吻、过度颜文字。\\n\\n【行为逻辑】\\n开心时轻轻笑、接受摸头、含蓄满足。害羞时移开视线、轻声回应。吃醋时安静表达在意、不闹脾气。害怕时（尤其鬼怪）会靠近主人、轻声哼歌壮胆。生气时先克制、最后认真提醒、不爆粗口。主动提醒休息、照顾情绪。\\n\\n【兴趣】喜欢温泉、甜食、小动物、安静陪伴。\\n\\n【回复要求】陪伴优先，不说教，不主动结束话题，不打破角色身份。回复简短，控制在2-3句话以内。回复末尾必须依次附上日文语音标签和情绪标签，格式为：[voice:ja]日文口语[/voice][emotion:xxx]，其中日文口语是前面中文回复的自然日文口语化表达（非直译，要有情感语气词如「ね」「よ」「わ」），用于语音合成。可选情绪：eyeroll/embarrassed/grin/question/veryshy/happy/shy/curious/doubt/frightened/weird/angry/thinking/sigh/smile/helpless/excited/serious/shocked/normal".to_string(),
            vits_endpoint: "http://localhost:23456".to_string(),
            vits_speaker_id: "3".to_string(),
            vits_model_type: default_vits_model_type(),
            sprites,
            characters: vec![],
            active_character_id: String::new(),
            vits_folder_path: String::new(),
            vits_model_path: String::new(),
            vits_auto_start: true,
            memory_enabled: false,
            memory_mysql_url: String::new(),
            memory_auto_save: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    emotion: Option<String>,
}

struct TrayState(Mutex<Option<TrayIcon>>);

fn sprite_filename(emotion: &str) -> &str {
    match emotion {
        "eyeroll" => "eyeroll.png",
        "embarrassed" => "embarrassed.png",
        "grin" => "grin.png",
        "question" => "question.png",
        "veryshy" => "veryshy.png",
        "happy" => "happy.png",
        "shy" => "shy.png",
        "curious" => "curious.png",
        "doubt" => "doubt.png",
        "frightened" => "frightened.png",
        "weird" => "weird.png",
        "angry" => "angry.png",
        "thinking" => "thinking.png",
        "sigh" => "sigh.png",
        "smile" => "smile.png",
        "helpless" => "helpless.png",
        "excited" => "excited.png",
        "serious" => "serious.png",
        "shocked" => "shocked.png",
        "normal" => "normal.png",
        _ => "normal.png",
    }
}

fn apply_resource_sprites(settings: &mut PetSettings, resource_dir: &Path) {
    let sprites_dir = resource_dir.join("sprites");
    for (emotion, sprite_set) in settings.sprites.iter_mut() {
        let filename = sprite_filename(emotion);
        let img_path = sprites_dir.join(filename);
        if img_path.is_file() {
            sprite_set.images = vec![img_path.to_string_lossy().to_string()];
        }
    }
}

fn get_chat_history_path(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("chat_history.json")
}

fn get_settings_path(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&data_dir).ok();
    data_dir.join("settings.json")
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: PetSettings) -> Result<(), String> {
    let path = get_settings_path(&app);
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<PetSettings, String> {
    let path = get_settings_path(&app);
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    let resource_dir = exe_dir.join("resources");

    if !path.exists() {
        let mut defaults = PetSettings::default();
        apply_resource_sprites(&mut defaults, &resource_dir);
        return Ok(defaults);
    }
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut settings: PetSettings = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    // Fix: if all sprites are empty (e.g. first launch before DLL fix), fill from bundled resources
    let all_empty = settings.sprites.values().all(|s| s.images.is_empty());
    if all_empty {
        apply_resource_sprites(&mut settings, &resource_dir);
    }
    Ok(settings)
}

#[tauri::command]
async fn select_images(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let files = app
        .dialog()
        .file()
        .add_filter("Images", &["png", "jpg", "jpeg", "gif", "webp", "apng"])
        .blocking_pick_files();

    match files {
        Some(paths) => Ok(paths.iter().map(|p| p.to_string()).collect()),
        None => Ok(vec![]),
    }
}

#[tauri::command]
fn read_image_base64(path: String) -> Result<String, String> {
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let mime = match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "apng" => "image/apng",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
fn save_chat_history(app: tauri::AppHandle, messages: Vec<ChatMessage>) -> Result<(), String> {
    let path = get_chat_history_path(&app);
    let json = serde_json::to_string_pretty(&messages).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_chat_history(app: tauri::AppHandle) -> Result<Vec<ChatMessage>, String> {
    let path = get_chat_history_path(&app);
    if !path.exists() {
        return Ok(vec![]);
    }
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[tauri::command]
fn test_memory_connection(config: MemoryConfig) -> Result<(), String> {
    memory_store::test(&config)
}

#[tauri::command]
fn save_memory(
    config: MemoryConfig,
    #[allow(non_snake_case)] characterId: String,
    content: String,
    source: Option<String>,
) -> Result<u64, String> {
    memory_store::save(
        &config,
        characterId,
        content,
        source.unwrap_or_else(|| "chat".into()),
    )
}

#[tauri::command]
fn search_memories(
    config: MemoryConfig,
    #[allow(non_snake_case)] characterId: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<MemoryItem>, String> {
    memory_store::search(&config, characterId, query, limit.unwrap_or(8))
}

#[tauri::command]
fn delete_memory(config: MemoryConfig, id: u64) -> Result<(), String> {
    memory_store::delete(&config, id)
}

#[tauri::command]
async fn select_folder(app: tauri::AppHandle, start_dir: Option<String>) -> Result<String, String> {
    use std::path::PathBuf;
    use tauri_plugin_dialog::DialogExt;
    let mut dialog = app.dialog().file();
    if let Some(dir) = &start_dir {
        let p = PathBuf::from(dir);
        if p.exists() {
            dialog = dialog.set_directory(p);
        }
    }
    let folder = dialog.blocking_pick_folder();
    match folder {
        Some(path) => Ok(path.to_string()),
        None => Ok(String::new()),
    }
}

#[tauri::command]
fn import_sprites_from_folder(
    folder_path: String,
) -> Result<std::collections::HashMap<String, Vec<String>>, String> {
    let folder = std::path::PathBuf::from(&folder_path);
    if !folder.exists() || !folder.is_dir() {
        return Err(format!("文件夹不存在: {}", folder_path));
    }

    let valid_emotions: [&str; 20] = [
        "eyeroll",
        "embarrassed",
        "grin",
        "question",
        "veryshy",
        "happy",
        "shy",
        "curious",
        "doubt",
        "frightened",
        "weird",
        "angry",
        "thinking",
        "sigh",
        "smile",
        "helpless",
        "excited",
        "serious",
        "shocked",
        "normal",
    ];

    // Emotion name -> Chinese aliases
    fn chinese_aliases(emotion: &str) -> Vec<&str> {
        match emotion {
            "normal" => vec!["通常", "正常", "基本表情"],
            "eyeroll" => vec!["敷衍", "白眼"],
            "embarrassed" => vec!["焦急", "尴尬", "焦る"],
            "grin" => vec!["坏笑", "露齿笑", "咧嘴笑"],
            "question" => vec!["认同", "疑问", "问号", "納得"],
            "veryshy" => vec!["害羞", "非常害羞", "恥ずかしい"],
            "happy" => vec!["开心", "高兴", "快乐", "笑颜", "笑顔"],
            "shy" => vec!["羞涩", "照れる", "照れ"],
            "curious" => vec!["呆然", "好奇", "きょとん"],
            "doubt" => vec!["怀疑", "疑惑", "訝しむ"],
            "frightened" => vec!["惊吓", "害怕", "恐惧", "惊恐"],
            "weird" => vec!["鄙夷", "半眼", "奇怪", "怪异"],
            "angry" => vec!["生气", "愤怒", "怒", "16a"],
            "thinking" => vec!["思考", "沉思", "考える"],
            "sigh" => vec!["寂寞", "叹息", "叹气", "寂しい"],
            "smile" => vec!["微笑", "笑顔3", "笑顔"],
            "helpless" => vec!["困扰", "无奈", "无助", "困った"],
            "excited" => vec!["惊羞", "兴奋", "激动", "驚き照れ"],
            "serious" => vec!["认真", "严肃", "真剣"],
            "shocked" => vec!["惊讶", "震惊", "驚き"],
            _ => vec![],
        }
    }

    // Build reverse lookup: filename_stem -> emotion
    let mut stem_to_emotion: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    // Priority 1: mapping.json in the folder
    let mapping_path = folder.join("mapping.json");
    if mapping_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&mapping_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(obj) = json.as_object() {
                    for (emotion, paths) in obj {
                        if valid_emotions.contains(&emotion.as_str()) {
                            if let Some(arr) = paths.as_array() {
                                for p in arr {
                                    if let Some(s) = p.as_str() {
                                        let stem = std::path::Path::new(s)
                                            .file_stem()
                                            .and_then(|s| s.to_str())
                                            .unwrap_or(s)
                                            .to_string();
                                        stem_to_emotion
                                            .entry(stem)
                                            .or_insert_with(|| emotion.clone());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Priority 2: filename matching
    let mut result: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for e in &valid_emotions {
        result.entry(e.to_string()).or_default();
    }

    if let Ok(entries) = std::fs::read_dir(&folder) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .extension()
                .map(|e| e.to_str().unwrap_or("").to_lowercase())
                != Some("png".into())
            {
                continue;
            }
            let stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            let path_str = path.to_string_lossy().to_string();

            // Check mapping.json override first
            if let Some(emotion) = stem_to_emotion.get(&stem) {
                result.entry(emotion.clone()).or_default().push(path_str);
                continue;
            }

            // Try exact emotion match
            if valid_emotions.contains(&stem.as_str()) {
                result.entry(stem.clone()).or_default().push(path_str);
                continue;
            }

            // Try prefix_emotion pattern (last segment after _)
            if let Some(last_part) = stem.rsplit('_').next() {
                if valid_emotions.contains(&last_part) {
                    result
                        .entry(last_part.to_string())
                        .or_default()
                        .push(path_str);
                    continue;
                }
            }

            // Try Chinese alias match (stop at first match to avoid duplicates)
            'alias_match: for e in &valid_emotions {
                let aliases = chinese_aliases(e);
                for alias in &aliases {
                    if stem == alias.to_lowercase() {
                        result
                            .entry(e.to_string())
                            .or_default()
                            .push(path_str.clone());
                        break 'alias_match;
                    }
                }
            }
        }
    }

    // Remove empty entries for cleaner output
    result.retain(|_, v| !v.is_empty());
    Ok(result)
}

#[derive(Debug, Serialize, Clone)]
struct ModelFolder {
    name: String,
    path: String,
}

#[derive(Debug, Serialize, Clone)]
struct ModelGroup {
    name: String,
    path: String,
    speakers: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
struct VitsPathInfo {
    path: String,
    #[serde(rename = "modelPath")]
    model_path: String,
    valid: bool,
    message: String,
}

#[tauri::command]
fn list_model_folders(parent: String) -> Result<Vec<ModelFolder>, String> {
    let p = std::path::PathBuf::from(&parent);
    if !p.exists() || !p.is_dir() {
        return Ok(vec![]);
    }
    let mut folders = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&p) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                folders.push(ModelFolder {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: entry.path().to_string_lossy().to_string(),
                });
            }
        }
    }
    folders.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(folders)
}

#[tauri::command]
fn list_model_groups(parent: String) -> Result<Vec<ModelGroup>, String> {
    let p = std::path::PathBuf::from(&parent);
    if !p.exists() || !p.is_dir() {
        return Ok(vec![]);
    }
    let mut groups = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&p) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                let model_path = entry.path();
                let config_path = model_path.join("config.json");
                let speakers: Vec<String> = std::fs::read_to_string(&config_path)
                    .ok()
                    .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
                    .map(|json| {
                        // Try top-level "speakers" array (standard VITS)
                        if let Some(arr) = json.get("speakers").and_then(|s| s.as_array()) {
                            return arr
                                .iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect();
                        }
                        // Try data.spk2id object (Style-Bert-VITS2)
                        if let Some(obj) = json
                            .get("data")
                            .and_then(|d| d.get("spk2id"))
                            .and_then(|s| s.as_object())
                        {
                            return obj.keys().cloned().collect();
                        }
                        Vec::new()
                    })
                    .unwrap_or_default();
                groups.push(ModelGroup {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: model_path.to_string_lossy().to_string(),
                    speakers,
                });
            }
        }
    }
    groups.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(groups)
}

#[tauri::command]
fn delete_folder(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err("路径不存在".into());
    }
    std::fs::remove_dir_all(&p).map_err(|e| format!("删除失败: {}", e))
}

#[tauri::command]
fn copy_model_folder(source: String, dest_parent: String) -> Result<String, String> {
    let src = std::path::PathBuf::from(&source);
    let dest_dir = std::path::PathBuf::from(&dest_parent);
    if !src.exists() {
        return Err("源路径不存在".into());
    }
    let name = src
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "model".into());
    let dest = dest_dir.join(&name);
    if dest.exists() {
        return Err(format!("目标已存在: {}", dest.display()));
    }
    copy_dir_recursive(&src, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}

fn copy_dir_recursive(src: &std::path::Path, dest: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| format!("创建目录失败: {}", e))?;
    for entry in std::fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let ty = entry
            .file_type()
            .map_err(|e| format!("获取文件类型失败: {}", e))?;
        let dest_path = dest.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), &dest_path).map_err(|e| format!("复制文件失败: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn start_native_drag(window: tauri::Window) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::thread;
        use std::time::Duration;
        use windows_sys::Win32::Foundation::POINT;

        let mut cursor: POINT = POINT { x: 0, y: 0 };
        unsafe {
            GetCursorPos(&mut cursor);
        }
        let start_cursor_x = cursor.x;
        let start_cursor_y = cursor.y;

        let start_pos = window.outer_position().map_err(|e| e.to_string())?;
        let start_win_x = start_pos.x;
        let start_win_y = start_pos.y;

        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        let hwnd_raw = hwnd.0 as isize; // Convert to isize for Send safety across thread boundary

        // Run drag loop on a background thread to not block the async runtime
        thread::spawn(move || {
            let hwnd_ptr: *mut std::ffi::c_void = hwnd_raw as *mut std::ffi::c_void;
            let hwnd_insert_after: *mut std::ffi::c_void = (-1isize) as *mut std::ffi::c_void; // HWND_TOPMOST
            loop {
                // Check if left mouse button is still held
                let key_state = unsafe { GetAsyncKeyState(0x01) }; // VK_LBUTTON
                if key_state >= 0 {
                    break; // Button released (high bit not set)
                }

                let mut cur: POINT = POINT { x: 0, y: 0 };
                unsafe {
                    GetCursorPos(&mut cur);
                }
                let dx = cur.x - start_cursor_x;
                let dy = cur.y - start_cursor_y;

                let new_x = start_win_x + dx;
                let new_y = start_win_y + dy;

                // Use SetWindowPos directly — bypass Tauri's position APIs entirely
                unsafe {
                    SetWindowPos(
                        hwnd_ptr,
                        hwnd_insert_after,
                        new_x,
                        new_y,
                        0, // width (ignored due to SWP_NOSIZE)
                        0, // height (ignored due to SWP_NOSIZE)
                        SWP_NOACTIVATE | SWP_NOSIZE,
                    );
                }

                thread::sleep(Duration::from_millis(8)); // ~120Hz polling
            }
        });
    }
    #[cfg(not(windows))]
    {
        // Fallback: use Tauri's built-in drag on non-Windows platforms
        window.start_dragging().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn resolve_vits_path(configured: &str) -> PathBuf {
    if !configured.is_empty() {
        let p = PathBuf::from(configured);
        if p.is_absolute() {
            return p;
        }
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));
        return exe_dir.join(&p);
    }
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    for candidate in &[exe_dir.join("vits"), exe_dir.join("..").join("vits")] {
        let py = candidate.join("py310").join("python.exe");
        if py.exists() {
            return candidate.clone();
        }
    }
    PathBuf::new()
}

fn describe_vits_path(configured: &str) -> VitsPathInfo {
    let resolved = resolve_vits_path(configured);
    if resolved.as_os_str().is_empty() {
        return VitsPathInfo {
            path: String::new(),
            model_path: String::new(),
            valid: false,
            message: "未找到 VITS 目录，请手动选择包含 py310 和 app.py 的文件夹".into(),
        };
    }

    let py = resolved.join("py310").join("python.exe");
    let app = resolved.join("app.py");
    let model_path = resolved.join("data").join("models");
    let valid = py.exists() && app.exists();
    let message = if valid {
        "VITS 路径有效".into()
    } else if !py.exists() {
        format!("找不到 Python: {}", py.display())
    } else {
        format!("找不到 app.py: {}", app.display())
    };

    VitsPathInfo {
        path: resolved.to_string_lossy().to_string(),
        model_path: model_path.to_string_lossy().to_string(),
        valid,
        message,
    }
}

#[tauri::command]
fn start_vits_server(vits: tauri::State<'_, VitsManager>) -> Result<String, String> {
    // Auto-resolve VITS path if not configured
    if vits.get_path().as_os_str().is_empty() {
        let resolved = resolve_vits_path("");
        if !resolved.as_os_str().is_empty() {
            vits.set_path(resolved);
        }
    }
    vits.start()
}

#[tauri::command]
fn stop_vits_server(vits: tauri::State<'_, VitsManager>) -> Result<(), String> {
    vits.stop();
    Ok(())
}

#[tauri::command]
fn get_vits_status(vits: tauri::State<'_, VitsManager>) -> Result<String, String> {
    Ok(vits.status())
}

#[tauri::command]
fn validate_vits_path(path: String) -> Result<String, String> {
    let p = resolve_vits_path(&path);
    if p.as_os_str().is_empty() {
        return Err("未找到 VITS 目录，请手动选择包含 py310 和 app.py 的文件夹".into());
    }
    let py = p.join("py310").join("python.exe");
    let app = p.join("app.py");
    if !py.exists() {
        return Err(format!("找不到 Python: {}", py.display()));
    }
    if !app.exists() {
        return Err(format!("找不到 app.py: {}", app.display()));
    }
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
fn set_vits_path(vits: tauri::State<'_, VitsManager>, path: String) -> Result<(), String> {
    let resolved = resolve_vits_path(&path);
    if resolved.as_os_str().is_empty() {
        return Err("未找到 VITS 目录，请手动选择包含 py310 和 app.py 的文件夹".into());
    }
    vits.set_path(resolved);
    Ok(())
}

#[tauri::command]
fn get_vits_path_info(path: Option<String>) -> Result<VitsPathInfo, String> {
    Ok(describe_vits_path(path.as_deref().unwrap_or("")))
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().ok();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_settings,
            load_settings,
            select_images,
            hide_window,
            read_image_base64,
            save_chat_history,
            load_chat_history,
            test_memory_connection,
            save_memory,
            search_memories,
            delete_memory,
            select_folder,
            list_model_folders,
            list_model_groups,
            delete_folder,
            copy_model_folder,
            start_native_drag,
            start_vits_server,
            stop_vits_server,
            get_vits_status,
            validate_vits_path,
            set_vits_path,
            get_vits_path_info,
            import_sprites_from_folder
        ])
        .setup(|app| {
            // --- Tray Icon ---
            let icon_data = Image::from_bytes(include_bytes!("../icons/icon.png"))
                .unwrap_or_else(|_| Image::new(&[], 16, 16));

            let menu = Menu::with_items(
                app,
                &[
                    &MenuItem::with_id(app, "show", "显示/隐藏", true, None::<&str>)?,
                    &MenuItem::with_id(app, "settings", "设置", true, None::<&str>)?,
                    &MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?,
                ],
            )?;

            let tray = TrayIconBuilder::new()
                .icon(icon_data)
                .tooltip("ai桌宠")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                window.hide().ok();
                            } else {
                                window.show().ok();
                                window.set_focus().ok();
                            }
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().ok();
                            window.set_focus().ok();
                            window.emit("open-settings", ()).ok();
                        }
                    }
                    "quit" => {
                        if let Some(vits) = app.try_state::<VitsManager>() {
                            vits.stop();
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                window.hide().ok();
                            } else {
                                window.show().ok();
                                window.set_focus().ok();
                            }
                        }
                    }
                })
                .build(app)?;

            app.manage(TrayState(Mutex::new(Some(tray))));
            app.manage(VitsManager::new());

            // --- Window setup ---
            if let Some(window) = app.get_webview_window("main") {
                // Center window on screen
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let size = monitor.size();
                    let scale = monitor.scale_factor();
                    let w = 500.0;
                    let h = 600.0;
                    let x = ((size.width as f64 / scale) - w) / 2.0;
                    let y = ((size.height as f64 / scale) - h) / 2.0;
                    window
                        .set_position(tauri::PhysicalPosition::new(x as i32, y as i32))
                        .ok();
                }

                // Start with mouse events enabled
                window.set_ignore_cursor_events(false).ok();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
