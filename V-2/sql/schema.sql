CREATE DATABASE IF NOT EXISTS bot_404 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bot_404;

CREATE TABLE IF NOT EXISTS bot_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  message_id VARCHAR(255) NOT NULL,
  chat_jid VARCHAR(255) NOT NULL,
  sender_jid VARCHAR(255) NOT NULL,
  participant_jid VARCHAR(255) NULL,
  message_type VARCHAR(64) NOT NULL,
  text_body TEXT NULL,
  caption TEXT NULL,
  quoted_message_id VARCHAR(255) NULL,
  raw_message JSON NOT NULL,
  media_path VARCHAR(1024) NULL,
  media_mimetype VARCHAR(255) NULL,
  media_filename VARCHAR(255) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at TIMESTAMP(3) NULL,
  UNIQUE KEY uq_message_id (message_id),
  KEY idx_chat_created (chat_jid, created_at),
  KEY idx_quoted_message (quoted_message_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bot_users (
  jid VARCHAR(255) NOT NULL PRIMARY KEY,
  display_name VARCHAR(255) NULL,
  opted_in TINYINT(1) NOT NULL DEFAULT 0,
  is_blocked TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bot_settings (
  setting_key VARCHAR(128) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO bot_settings (setting_key, setting_value) VALUES
  ('anti_delete_enabled', '1'),
  ('prefix', '.'),
  ('message_retention_days', '30')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

CREATE TABLE IF NOT EXISTS bot_groups (
  jid VARCHAR(255) NOT NULL PRIMARY KEY,
  subject VARCHAR(255) NULL,
  protection_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trusted_entities (
  jid VARCHAR(255) NOT NULL PRIMARY KEY,
  entity_type ENUM('user','group') NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS api_usage (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  jid VARCHAR(255) NOT NULL,
  command_name VARCHAR(64) NOT NULL,
  request_key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_usage_window (request_key, created_at),
  KEY idx_usage_jid (jid, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bot_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_name VARCHAR(128) NOT NULL,
  jid VARCHAR(255) NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_audit_created (created_at),
  KEY idx_audit_event (event_name)
) ENGINE=InnoDB;
