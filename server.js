// Endpoint untuk menghapus satu donasi berdasarkan ID (Admin)
app.delete('/api/admin/donations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM donasi WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }
    res.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting donation:', error);
    res.status(500).json({ success: false, message: 'Gagal menghapus data' });
  }
});

// Endpoint untuk mengosongkan seluruh data donasi (Admin)
app.delete('/api/admin/donations-clear', async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE donasi RESTART IDENTITY');
    res.json({ success: true, message: 'Semua data donasi berhasil dikosongkan' });
  } catch (error) {
    console.error('Error clearing donations:', error);
    res.status(500).json({ success: false, message: 'Gagal mengosongkan data' });
  }
});