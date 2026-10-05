PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profile_catalog (
    id TEXT NOT NULL PRIMARY KEY,
    nominal TEXT NOT NULL,
    variant TEXT NOT NULL,
    name TEXT NOT NULL,
    series TEXT,
    system TEXT NOT NULL DEFAULT '自定义',
    section_size_json TEXT NOT NULL,
    slot_width_mm REAL NOT NULL,
    slot_definitions_json TEXT,
    wall_thickness_options_json TEXT,
    default_wall_thickness_mm REAL NOT NULL,
    alloy TEXT,
    cross_section_style TEXT,
    source_family TEXT,
    note TEXT,
    section_json TEXT,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    sort_order INTEGER NOT NULL DEFAULT 1000,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_catalog_nominal
    ON profile_catalog (nominal);
CREATE INDEX IF NOT EXISTS idx_profile_catalog_enabled
    ON profile_catalog (enabled, sort_order);

CREATE TABLE IF NOT EXISTS accessory_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    model TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    geometry_json TEXT NOT NULL,
    mount_rule_json TEXT NOT NULL,
    bom_rule_json TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accessory_catalog_category
    ON accessory_catalog (category, enabled);
