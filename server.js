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

// Konfigurasi Koneksi Database PostgreSQL Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Tes Koneksi Database saat Server Berjalan
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Gagal terhubung ke Database Supabase:', err.stack);
  } else {
    console.log('✅ Berhasil terhubung ke Database Supabase!');
    release();
  }
});

// ==========================================
// 1. ENDPOINT PUBLIK (FORM DONASI & STATS)
// ==========================================

// Endpoint untuk mengirim formulir donasi baru
app.post('/api/donations', async (req, res) => {
  const { nama, email, nomor_hp, judul_buku, jumlah_buku, kategori_buku, alamat_penjemputan } = req.body;

  if (!nama || !email || !nomor_hp || !judul_buku || !jumlah_buku || !alamat_penjemputan) {
    return res.status(400).json({
      success: false,
      message: 'Harap isi semua kolom wajib dalam formulir!'
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
      message: 'Donasi berhasil dikirim! Terima kasih atas kebaikan Anda.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving donation:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menyimpan data donasi ke server.'
    });
  }
});

// Endpoint untuk statistik dampak real-time di halaman depan
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
        totalBuku: parseInt(stats.total_buku),
        totalDonasi: parseInt(stats.total_donasi),
        totalDonatur: parseInt(stats.total_donatur)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil statistik donasi.'
    });
  }
});

// ==========================================
// 2. ENDPOINT ADMIN (MANAJEMEN DONASI)
// ==========================================

// Endpoint mengambil seluruh daftar donasi untuk Admin Dashboard
app.get('/api/admin/donations', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM donasi ORDER BY created_at DESC'
    );
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching admin donations:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data donasi admin.'
    });
  }
});

// Endpoint memperbarui status donasi (Pending, Diproses, Selesai, Dibatalkan)
app.patch('/api/admin/donations/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status baru wajib diisi.' });
  }

  try {
    const result = await pool.query(
      'UPDATE donasi SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data donasi tidak ditemukan.'
      });
    }

    res.json({
      success: true,
      message: 'Status donasi berhasil diperbarui!',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui status donasi.'
    });
  }
});

// ==========================================
// 3. ROUTING LANDING PAGE & ADMIN
// ==========================================

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Jalankan Server
app.listen(PORT, () => {
  console.log(`🚀 Server Donasi Buku Jakarta berjalan di port ${PORT}`);
});