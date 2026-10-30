const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  const dbName = process.env.DB_NAME || 'registration_db';

  await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
  await connection.query(`USE ${dbName}`);

  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('user', 'admin') DEFAULT 'user',
      is_active BOOLEAN DEFAULT TRUE,
      email_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP NULL,
      INDEX idx_email (email),
      INDEX idx_username (username)
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(20) UNIQUE NOT NULL,
      description VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INT NOT NULL,
      role_id INT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(64) PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(45),
      user_agent VARCHAR(255),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_expires (expires_at)
    );

    CREATE TABLE IF NOT EXISTS records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(200) NOT NULL,
      content TEXT,
      category VARCHAR(50),
      status ENUM('draft', 'submitted', 'approved', 'rejected') DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      submitted_at TIMESTAMP NULL,
      approved_at TIMESTAMP NULL,
      approved_by INT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status),
      INDEX idx_category (category),
      INDEX idx_created (created_at)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      record_id INT,
      customer_id INT,
      change_request_id INT,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100),
      file_size BIGINT,
      file_path VARCHAR(500) NOT NULL,
      storage_type ENUM('local', 's3') DEFAULT 'local',
      status ENUM('approved', 'pending') DEFAULT 'pending',
      uploaded_by INT NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customer(ID) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_record_id (record_id),
      INDEX idx_customer_id (customer_id),
      INDEX idx_change_request_id (change_request_id),
      INDEX idx_uploaded_by (uploaded_by),
      INDEX idx_status (status)
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_token (token_hash)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50),
      entity_id INT,
      details JSON,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_user_id (user_id),
      INDEX idx_action (action),
      INDEX idx_created (created_at)
    );

    CREATE TABLE IF NOT EXISTS change_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      registration_id INT NOT NULL,
      applicant_id INT NOT NULL,
      proposed_changes JSON NOT NULL,
      original_data JSON,
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      rejection_reason TEXT,
      reviewed_by INT,
      reviewed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (registration_id) REFERENCES customer(ID) ON DELETE CASCADE,
      FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_registration_id (registration_id),
      INDEX idx_status (status),
      INDEX idx_applicant_id (applicant_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      type VARCHAR(50),
      related_type VARCHAR(50),
      related_id INT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_is_read (is_read),
      INDEX idx_created (created_at)
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(500) NULL;

    CREATE TABLE IF NOT EXISTS user_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      font_size INT DEFAULT 90,
      theme VARCHAR(20) DEFAULT 'light',
      notifications_enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id)
    );

    -- Add 结算 column to customer table if not exists
    ALTER TABLE customer ADD COLUMN IF NOT EXISTS 结算 ENUM('未结算', '已结算') DEFAULT '未结算';

    -- Add settlement tracking fields to change_requests table if not exists
    ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS settlement_old_status ENUM('未结算', '已结算') NULL;
    ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS settlement_new_status ENUM('未结算', '已结算') NULL;
    ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS settlement_image_url VARCHAR(500) NULL;
    ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS settlement_change_type ENUM('normal', 'admin_direct') DEFAULT 'normal';

    -- Add 结算金额 column to customer table for shipping cost
    ALTER TABLE customer ADD COLUMN IF NOT EXISTS 结算金额 DECIMAL(10,2) DEFAULT NULL;

    -- Add change_request_id to attachments table (MySQL compatible)
    ALTER TABLE attachments ADD COLUMN change_request_id INT NULL;

    -- Create maintenance table if not exists
    CREATE TABLE IF NOT EXISTS maintenance (
      id VARCHAR(50) PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      province VARCHAR(50),
      province_adcode VARCHAR(20),
      city VARCHAR(50),
      city_adcode VARCHAR(20),
      district VARCHAR(50),
      district_adcode VARCHAR(20),
      street VARCHAR(100),
      street_adcode VARCHAR(20),
      address VARCHAR(255),
      contact VARCHAR(50),
      phone VARCHAR(20),
      brand VARCHAR(50),
      model VARCHAR(100),
      type VARCHAR(50),
      color VARCHAR(50),
      battery_require VARCHAR(20),
      device_sn VARCHAR(100),
      purchase_date DATE,
      purchase_platform VARCHAR(50),
      order_no VARCHAR(50),
      warranty_status VARCHAR(20),
      return_reason VARCHAR(100),
      fault_desc TEXT,
      return_courier VARCHAR(50),
      return_tracking_no VARCHAR(100),
      send_back_courier VARCHAR(50),
      send_back_tracking_no VARCHAR(100),
      registrant VARCHAR(50),
      status VARCHAR(20) DEFAULT '待处理',
      repair_platform VARCHAR(50),
      payment_status VARCHAR(20) DEFAULT '未支付',
      payment_image VARCHAR(500),
      completion_time DATETIME,
      operator VARCHAR(50),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at)
    );

    -- Create maintenance_change_requests table if not exists
    CREATE TABLE IF NOT EXISTS maintenance_change_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      maintenance_id VARCHAR(50) NOT NULL,
      changed_fields JSON NOT NULL,
      change_reason TEXT,
      requested_by INT,
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      processed_by INT,
      processed_at TIMESTAMP NULL,
      requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_id) REFERENCES maintenance(id) ON DELETE CASCADE,
      FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_maintenance_id (maintenance_id),
      INDEX idx_status (status),
      INDEX idx_requested_by (requested_by)
    );

    -- Create maintenance_attachments table if not exists
    CREATE TABLE IF NOT EXISTS maintenance_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      maintenance_id VARCHAR(50) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100),
      file_size BIGINT,
      file_path VARCHAR(500) NOT NULL,
      uploaded_by INT,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_id) REFERENCES maintenance(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_maintenance_id (maintenance_id)
    );
  `;

  await connection.query(schema);
  // Try to create fulltext index for search (idempotent on subsequent runs)
  try {
    await connection.query("ALTER TABLE records ADD FULLTEXT ft_records (title, content)");
  } catch (e) {
    // Ignore if index already exists or not supported on current storage engine
    // eslint-disable-next-line no-unused-expressions
    void e;
  }
  
  console.log('Creating phone_change_requests table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS phone_change_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      old_phone VARCHAR(11) NOT NULL,
      new_phone VARCHAR(11) NOT NULL,
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
      processed_by INT,
      processed_at TIMESTAMP NULL,
      requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_status (status)
    )
  `);

  console.log('Creating orders table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      客户信息 VARCHAR(255) NOT NULL,
      订单编号 VARCHAR(100) NOT NULL,
      品牌 VARCHAR(100),
      型号 VARCHAR(100),
      类型 VARCHAR(100),
      颜色 VARCHAR(100),
      规格 VARCHAR(100),
      价格 DECIMAL(10,2),
      购买件数 INT,
      备注 TEXT,
      创建时间 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      更新时间 TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_customer (客户信息),
      INDEX idx_order_no (订单编号),
      INDEX idx_brand (品牌),
      INDEX idx_created_at (创建时间)
    )
  `);
  
  console.log('Migration completed successfully');
  await connection.end();
}

migrate().catch(console.error);
