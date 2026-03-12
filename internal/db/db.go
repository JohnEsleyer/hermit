package db

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	db *sql.DB
}

type Agent struct {
	ID           int64
	Name         string
	Role         string
	Model        string
	SystemPrompt string
	TelegramID   string
	Active       bool
	CreatedAt    string
	UpdatedAt    string
}

type AuditLog struct {
	ID        int64
	AgentID   int64
	UserID    string
	Action    string
	Details   string
	CreatedAt string
}

func NewDB(path string) (*DB, error) {
	db, err := sql.Open("sqlite3", path+"?_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open db: %w", err)
	}

	d := &DB{db: db}
	if err := d.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to migrate: %w", err)
	}

	return d, nil
}

func (d *DB) Close() error {
	return d.db.Close()
}

func (d *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS agents (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		role TEXT NOT NULL DEFAULT 'assistant',
		model TEXT NOT NULL DEFAULT 'openai/gpt-4',
		system_prompt TEXT NOT NULL DEFAULT '',
		telegram_id TEXT NOT NULL DEFAULT '',
		active INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL,
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		agent_id INTEGER NOT NULL,
		user_id TEXT NOT NULL,
		action TEXT NOT NULL,
		details TEXT,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY(agent_id) REFERENCES agents(id)
	);

	CREATE TABLE IF NOT EXISTS history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		agent_id INTEGER NOT NULL,
		user_id TEXT NOT NULL,
		role TEXT NOT NULL,
		content TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY(agent_id) REFERENCES agents(id)
	);
	`

	_, err := d.db.Exec(schema)
	return err
}

func (d *DB) CreateAgent(a *Agent) (int64, error) {
	res, err := d.db.Exec(`
		INSERT INTO agents (name, role, model, system_prompt, telegram_id, active)
		VALUES (?, ?, ?, ?, ?, ?)
	`, a.Name, a.Role, a.Model, a.SystemPrompt, a.TelegramID, a.Active)
	if err != nil {
		return 0, err
	}

	return res.LastInsertId()
}

func (d *DB) GetAgent(id int64) (*Agent, error) {
	a := &Agent{}
	err := d.db.QueryRow(`
		SELECT id, name, role, model, system_prompt, telegram_id, active, created_at, updated_at
		FROM agents WHERE id = ?
	`, id).Scan(&a.ID, &a.Name, &a.Role, &a.Model, &a.SystemPrompt, &a.TelegramID, &a.Active, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (d *DB) GetAgentByName(name string) (*Agent, error) {
	a := &Agent{}
	err := d.db.QueryRow(`
		SELECT id, name, role, model, system_prompt, telegram_id, active, created_at, updated_at
		FROM agents WHERE name = ?
	`, name).Scan(&a.ID, &a.Name, &a.Role, &a.Model, &a.SystemPrompt, &a.TelegramID, &a.Active, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (d *DB) ListAgents() ([]*Agent, error) {
	rows, err := d.db.Query(`
		SELECT id, name, role, model, system_prompt, telegram_id, active, created_at, updated_at
		FROM agents ORDER BY id DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []*Agent
	for rows.Next() {
		a := &Agent{}
		if err := rows.Scan(&a.ID, &a.Name, &a.Role, &a.Model, &a.SystemPrompt, &a.TelegramID, &a.Active, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		agents = append(agents, a)
	}
	return agents, nil
}

func (d *DB) UpdateAgent(a *Agent) error {
	_, err := d.db.Exec(`
		UPDATE agents SET name=?, role=?, model=?, system_prompt=?, telegram_id=?, active=?, updated_at=datetime('now')
		WHERE id=?
	`, a.Name, a.Role, a.Model, a.SystemPrompt, a.TelegramID, a.Active, a.ID)
	return err
}

func (d *DB) DeleteAgent(id int64) error {
	_, err := d.db.Exec("DELETE FROM agents WHERE id = ?", id)
	return err
}

func (d *DB) SetSetting(key, value string) error {
	_, err := d.db.Exec(`
		INSERT INTO settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
	`, key, value, value)
	return err
}

func (d *DB) GetSetting(key string) (string, error) {
	var value string
	err := d.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

func (d *DB) LogAction(agentID int64, userID, action, details string) error {
	_, err := d.db.Exec(`
		INSERT INTO audit_logs (agent_id, user_id, action, details)
		VALUES (?, ?, ?, ?)
	`, agentID, userID, action, details)
	return err
}

func (d *DB) GetAuditLogs(agentID int64, limit int) ([]*AuditLog, error) {
	rows, err := d.db.Query(`
		SELECT id, agent_id, user_id, action, details, created_at
		FROM audit_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?
	`, agentID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*AuditLog
	for rows.Next() {
		l := &AuditLog{}
		if err := rows.Scan(&l.ID, &l.AgentID, &l.UserID, &l.Action, &l.Details, &l.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

type HistoryEntry struct {
	ID        int64
	AgentID   int64
	UserID    string
	Role      string
	Content   string
	CreatedAt string
}

func (d *DB) AddHistory(agentID int64, userID, role, content string) error {
	_, err := d.db.Exec(`
		INSERT INTO history (agent_id, user_id, role, content)
		VALUES (?, ?, ?, ?)
	`, agentID, userID, role, content)
	return err
}

func (d *DB) GetHistory(agentID int64, limit int) ([]*HistoryEntry, error) {
	rows, err := d.db.Query(`
		SELECT id, agent_id, user_id, role, content, created_at
		FROM history WHERE agent_id = ? ORDER BY id ASC LIMIT ?
	`, agentID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*HistoryEntry
	for rows.Next() {
		e := &HistoryEntry{}
		if err := rows.Scan(&e.ID, &e.AgentID, &e.UserID, &e.Role, &e.Content, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func (d *DB) ClearHistory(agentID int64) error {
	_, err := d.db.Exec("DELETE FROM history WHERE agent_id = ?", agentID)
	return err
}
