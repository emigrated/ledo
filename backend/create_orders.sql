CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `客户信息` VARCHAR(255) NOT NULL,
  `订单编号` VARCHAR(100) NOT NULL,
  `品牌` VARCHAR(100),
  `型号` VARCHAR(100),
  `类型` VARCHAR(100),
  `颜色` VARCHAR(100),
  `规格` VARCHAR(100),
  `价格` DECIMAL(10,2),
  `购买件数` INT,
  `备注` TEXT,
  `创建时间` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `更新时间` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customer (`客户信息`),
  INDEX idx_order_no (`订单编号`),
  INDEX idx_brand (`品牌`),
  INDEX idx_created_at (`创建时间`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
