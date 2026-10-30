const mysql = require('mysql2/promise');

async function migrateAttachments() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'registration_db'
  });

  try {
    const [columns] = await connection.query(
      'SHOW COLUMNS FROM attachments LIKE "customer_id"'
    );

    if (columns.length === 0) {
      await connection.query(
        'ALTER TABLE attachments ADD COLUMN customer_id INT NULL AFTER record_id'
      );
      console.log('Added customer_id column');

      await connection.query(
        'ALTER TABLE attachments ADD INDEX idx_customer_id (customer_id)'
      );
      console.log('Added customer_id index');

      try {
        await connection.query(
          'ALTER TABLE attachments ADD FOREIGN KEY (customer_id) REFERENCES customer(ID) ON DELETE CASCADE'
        );
        console.log('Added customer_id foreign key');
      } catch (e) {
        console.log('Note: Foreign key not added (may need manual setup if customer table exists)');
      }
    } else {
      console.log('customer_id column already exists');
    }

    console.log('Migration completed');
  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await connection.end();
  }
}

migrateAttachments().catch(console.error);