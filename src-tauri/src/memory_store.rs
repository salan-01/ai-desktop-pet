use mysql::prelude::*;
use mysql::{params, Opts, Pool};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct MemoryConfig {
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct MemoryItem {
    pub id: u64,
    #[serde(rename = "characterId")]
    pub character_id: String,
    pub content: String,
    pub source: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

fn pool(config: &MemoryConfig) -> Result<Pool, String> {
    let opts = Opts::from_url(&config.url).map_err(|e| e.to_string())?;
    Pool::new(opts).map_err(|e| e.to_string())
}

pub fn init(config: &MemoryConfig) -> Result<(), String> {
    let pool = pool(config)?;
    let mut conn = pool.get_conn().map_err(|e| e.to_string())?;
    conn.query_drop(
        r#"
        CREATE TABLE IF NOT EXISTS desktop_pet_memories (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            character_id VARCHAR(128) NOT NULL,
            content TEXT NOT NULL,
            source VARCHAR(32) NOT NULL DEFAULT 'chat',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_character_created (character_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        "#,
    )
    .map_err(|e| e.to_string())
}

pub fn test(config: &MemoryConfig) -> Result<(), String> {
    init(config)
}

pub fn save(
    config: &MemoryConfig,
    character_id: String,
    content: String,
    source: String,
) -> Result<u64, String> {
    let content = content.trim();
    if content.is_empty() {
        return Err("记忆内容不能为空".into());
    }
    init(config)?;
    let pool = pool(config)?;
    let mut conn = pool.get_conn().map_err(|e| e.to_string())?;
    conn.exec_drop(
        r#"
        INSERT INTO desktop_pet_memories (character_id, content, source)
        VALUES (:character_id, :content, :source)
        "#,
        params! {
            "character_id" => character_id,
            "content" => content,
            "source" => source,
        },
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_id())
}

pub fn search(
    config: &MemoryConfig,
    character_id: String,
    query: String,
    limit: u32,
) -> Result<Vec<MemoryItem>, String> {
    init(config)?;
    let pool = pool(config)?;
    let mut conn = pool.get_conn().map_err(|e| e.to_string())?;
    let limit = limit.clamp(1, 20);
    let query = query.trim();
    let rows = if query.is_empty() {
        conn.exec_map(
            r#"
            SELECT id, character_id, content, source, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
            FROM desktop_pet_memories
            WHERE character_id = :character_id
            ORDER BY created_at DESC
            LIMIT :limit
            "#,
            params! {
                "character_id" => character_id,
                "limit" => limit,
            },
            row_to_memory,
        )
    } else {
        let like_query = format!("%{}%", query);
        conn.exec_map(
            r#"
            SELECT id, character_id, content, source, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
            FROM desktop_pet_memories
            WHERE character_id = :character_id AND content LIKE :query
            ORDER BY created_at DESC
            LIMIT :limit
            "#,
            params! {
                "character_id" => character_id,
                "query" => like_query,
                "limit" => limit,
            },
            row_to_memory,
        )
    };
    rows.map_err(|e| e.to_string())
}

pub fn delete(config: &MemoryConfig, id: u64) -> Result<(), String> {
    init(config)?;
    let pool = pool(config)?;
    let mut conn = pool.get_conn().map_err(|e| e.to_string())?;
    conn.exec_drop(
        "DELETE FROM desktop_pet_memories WHERE id = :id",
        params! { "id" => id },
    )
    .map_err(|e| e.to_string())
}

fn row_to_memory(
    (id, character_id, content, source, created_at): (u64, String, String, String, String),
) -> MemoryItem {
    MemoryItem {
        id,
        character_id,
        content,
        source,
        created_at,
    }
}
