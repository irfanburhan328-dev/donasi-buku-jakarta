const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Koneksi ke Supabase PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Otomatis Buat Tabel 'donasi' jika belum ada
const initDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS donasi (
        id SERIAL PRIMARY KEY,
        nama VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        nomor_hp VARCHAR(20) NOT NULL,
        judul_buku TEXT NOT NULL,
        jumlah_buku INT NOT NULL,
        kategori_buku VARCHAR(50),
        alamat_penjemputan TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database initialized: Table 'donasi' ready.");
  } catch (err) {
    console.error("Error initializing database:", err.message);
  }
};
initDb();

// API Check Health
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// API Submit Donasi Buku Baru
app.post('/api/donasi', async (req, res) => {
  const { nama, email, nomor_hp, judul_buku, jumlah_buku, kategori_buku, alamat_penjemputan } = req.body;

  if (!nama || !email || !nomor_hp || !judul_buku || !jumlah_buku || !alamat_penjemputan) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi!' });
  }

  try {
    const query = `
      INSERT INTO donasi (nama, email, nomor_hp, judul_buku, jumlah_buku, kategori_buku, alamat_penjemputan)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [nama, email, nomor_hp, judul_buku, jumlah_buku, kategori_buku || 'Umum', alamat_penjemputan];
    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Terima kasih! Donasi buku Anda berhasil terdaftar.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error("Error saving donation:", err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan data donasi ke server.' });
  }
});

// API Ambil Daftar Donasi Buku
app.get('/api/donasi', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM donasi ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server berjalan di port ${PORT}`);
});