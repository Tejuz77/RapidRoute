const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ database: 'rapidroute' });

async function seed() {
  const existing = await pool.query("SELECT * FROM users WHERE role = 'admin'");
  if (existing.rows.length > 0) {
    console.log('Admin user already exists:');
    console.log('  Email:', existing.rows[0].email);
    console.log('  ID:', existing.rows[0].id);
    await pool.end();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('admin123', salt);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, phone, role)
     VALUES ('Super Admin', 'admin@rapidroute.com', $1, '+91-9999999999', 'admin')
     RETURNING id, name, email, role`,
    [passwordHash]
  );

  console.log('Admin user created:');
  console.log('  Email: admin@rapidroute.com');
  console.log('  Password: admin123');
  console.log('  ID:', result.rows[0].id);

  await pool.end();
}

seed().catch(console.error);
