import sqlite3

def run_migration():
    conn = sqlite3.connect('app.db')
    cur = conn.cursor()

    cur.execute('PRAGMA table_info(mfg_production_orders)')
    cols = [r[1] for r in cur.fetchall()]
    if 'is_printed' not in cols:
        cur.execute('ALTER TABLE mfg_production_orders ADD COLUMN is_printed BOOLEAN DEFAULT 0')
    if 'printed_at' not in cols:
        cur.execute('ALTER TABLE mfg_production_orders ADD COLUMN printed_at DATETIME')
    if 'printed_by' not in cols:
        cur.execute('ALTER TABLE mfg_production_orders ADD COLUMN printed_by VARCHAR(100)')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS inv_label_print_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        production_order_id INTEGER,
        barcode_string VARCHAR(100),
        label_type VARCHAR(30) NOT NULL,
        label_count INTEGER DEFAULT 1,
        printed_by VARCHAR(100) DEFAULT 'Operatör',
        printed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_reprint BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (production_order_id) REFERENCES mfg_production_orders(id) ON DELETE SET NULL
    )
    ''')

    cur.execute('''
    CREATE TABLE IF NOT EXISTS inv_barcode_sequences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sequence_type VARCHAR(50) UNIQUE NOT NULL,
        current_value INTEGER DEFAULT 100
    )
    ''')

    cur.execute("INSERT OR IGNORE INTO inv_barcode_sequences (sequence_type, current_value) VALUES ('SSCC_PALLET', 1001)")
    cur.execute("INSERT OR IGNORE INTO inv_barcode_sequences (sequence_type, current_value) VALUES ('BOX_GTIN', 5001)")

    conn.commit()
    conn.close()
    print("Packaging tables & columns migration successful!")

if __name__ == '__main__':
    run_migration()
