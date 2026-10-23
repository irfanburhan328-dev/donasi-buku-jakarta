const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Konfigurasi Database Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Penanganan Error Global untuk Database Pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Tes Koneksi Database
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Gagal terhubung ke Database Supabase:', err.message);
  } else {
    console.log('✅ Berhasil terhubung ke Database Supabase!');
    release();
  }
});

// ==========================================
// 1. ENDPOINT PUBLIK (FORM DONASI & STATS)
// ==========================================

// Endpoint Formulir Donasi Baru
app.post('/api/donations', async (req, res) => {
  const { nama, email, nomor_hp, judul_buku, jumlah_buku, kategori_buku, alamat_penjemputan } = req.body;

  if (!nama || !email || !nomor_hp || !judul_buku || !jumlah_buku || !alamat_penjemputan) {
    return res.status(400).json({
      success: false,
      message: 'Harap isi semua kolom wajib!'
    });
  }

  try {
    const query = `
      INSERT INTO donasi (nama, email, nomor_hp, judul_buku, jumlah_buku, kategori_buku, alamat_penjemputan, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
      RETURNING *
    `;
    const values = [nama, email, nomor_hp, judul_buku, parseInt(jumlah_buku), kategori_buku || 'Umum', alamat_penjemputan];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Donasi berhasil dikirim!',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving donation:', error.message);
    res.status(500).json({
      success: false,
      message: 'Gagal menyimpan data donasi.'
    });
  }
});

// Endpoint Statistik Real-Time
app.get('/api/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COALESCE(SUM(jumlah_buku), 0) AS total_buku,
        COUNT(DISTINCT id) AS total_donasi,
        COUNT(DISTINCT email) AS total_donatur
      FROM donasi
    `;
    const result = await pool.query(query);
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        totalBuku: parseInt(stats.total_buku || 0),
        totalDonasi: parseInt(stats.total_donasi || 0),
        totalDonatur: parseInt(stats.total_donatur || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error.message);
    res.json({
      success: true,
      data: { totalBuku: 0, totalDonasi: 0, totalDonatur: 0 }
    });
  }
});

// ==========================================
// 2. ENDPOINT ADMIN
// ==========================================

// Ambil seluruh daftar donasi
app.get('/api/admin/donations', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM donasi ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin donations:', error.message);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data admin.'
    });
  }
});

// Ubah Status Donasi
app.patch('/api/admin/donations/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE donasi SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
    }

    res.json({ success: true, message: 'Status berhasil diperbarui!', data: result.rows[0] });
  } catch (error) {
    console.error('Error updating status:', error.message);
    res.status(500).json({ success: false, message: 'Gagal memperbarui status.' });
  }
});

// Hapus Satu Donasi
app.delete('/api/admin/donations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM donasi WHERE id = $1', [id]);
    res.json({ success: true, message: 'Data donasi berhasil dihapus.' });
  } catch (error) {
    console.error('Error deleting donation:', error.message);
    res.status(500).json({ success: false, message: 'Gagal menghapus data.' });
  }
});

// Kosongkan Seluruh Data
app.delete('/api/admin/donations-clear', async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE donasi RESTART IDENTITY');
    res.json({ success: true, message: 'Semua data donasi berhasil dikosongkan.' });
  } catch (error) {
    console.error('Error clearing donations:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengosongkan data.' });
  }
});

// ==========================================
// 3. ROUTING LANDING PAGE
// ==========================================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});