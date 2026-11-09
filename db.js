import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

export const db = new DatabaseSync('noliktava.db');

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    password  TEXT NOT NULL,
    role      TEXT NOT NULL CHECK (role IN ('admin', 'darbinieks', 'kartotajs')),
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sku          TEXT NOT NULL UNIQUE,
    name         TEXT NOT NULL,
    quantity     INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity INTEGER NOT NULL DEFAULT 0,
    price        REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS locations (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    zone TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS placements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id INTEGER NOT NULL REFERENCES locations(id),
    quantity    INTEGER NOT NULL CHECK (quantity >= 0),
    condition   TEXT NOT NULL CHECK (condition IN ('Labs', 'Bojāts', 'Jāpārbauda')),
    note        TEXT NOT NULL DEFAULT '',
    updated_by  TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE (product_id, location_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    customer   TEXT NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   INTEGER NOT NULL CHECK (quantity > 0),
    status     TEXT NOT NULL DEFAULT 'Jauns'
               CHECK (status IN ('Jauns', 'Apstrādē', 'Nosūtīts', 'Piegādāts', 'Atcelts')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  const addUser = db.prepare('INSERT INTO users (username, full_name, password, role) VALUES (?, ?, ?, ?)');
  addUser.run('admin', 'Anna Administratore', bcrypt.hashSync('Admin12345', 12), 'admin');
  addUser.run('darbinieks', 'Dāvis Darbinieks', bcrypt.hashSync('Darbs12345', 12), 'darbinieks');
  addUser.run('kartotajs', 'Kārlis Kārtotājs', bcrypt.hashSync('Plaukts12345', 12), 'kartotajs');

  const addProduct = db.prepare('INSERT INTO products (sku, name, quantity, min_quantity, price) VALUES (?, ?, ?, ?, ?)');
  addProduct.run('RIEP-205-55', 'Ziemas riepa 205/55 R16', 48, 16, 74.9);
  addProduct.run('ELJA-5W30', 'Motoreļļa 5W-30, 5 L', 30, 10, 39.5);
  addProduct.run('FILT-01', 'Eļļas filtrs', 6, 12, 8.2);
  addProduct.run('AKUM-70AH', 'Akumulators 70 Ah', 4, 5, 109);

  const addLocation = db.prepare('INSERT INTO locations (code, zone) VALUES (?, ?)');
  addLocation.run('A-01-01', 'Riepas');
  addLocation.run('B-01-01', 'Šķidrumi');
  addLocation.run('C-01-01', 'Rezerves daļas');

  const addPlacement = db.prepare(
    'INSERT INTO placements (product_id, location_id, quantity, condition, note, updated_by) VALUES (?, ?, ?, ?, ?, ?)');
  addPlacement.run(1, 1, 48, 'Labs', '', 'Kārlis Kārtotājs');
  addPlacement.run(2, 2, 30, 'Labs', '', 'Kārlis Kārtotājs');
  addPlacement.run(4, 3, 4, 'Bojāts', '1 gab. ar bojātu korpusu', 'Kārlis Kārtotājs');

  db.prepare('INSERT INTO orders (customer, product_id, quantity, created_by) VALUES (?, ?, ?, ?)')
    .run('SIA Auto Serviss', 1, 8, 'Dāvis Darbinieks');

  console.log('Izveidoti testa dati un lietotāji (admin, darbinieks, kartotajs).');
}
