const bcrypt = require('bcryptjs');

const phone = '13828884538';
const name = '赖杰鸿';
const idCard = '440223198810094779';

// 生成默认密码的哈希，例如：Admin@123456
const defaultPassword = 'Admin@123456';
const passwordHash = bcrypt.hashSync(defaultPassword, 12);

console.log('INSERT INTO admins (name, id_card, phone, password_hash, role) VALUES');
console.log(`('${name}', '${idCard}', '${phone}', '${passwordHash}', 'admin');`);
console.log('');
console.log(`-- 默认密码：${defaultPassword}`);
