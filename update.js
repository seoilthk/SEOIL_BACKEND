const pool = require('./src/config/db');
const bcrypt = require('bcrypt');

async function updatePassword() {
    try {
        const hash = await bcrypt.hash('1234', 10);
        await pool.query('UPDATE Users SET password_hash = ? WHERE student_id = ?', [hash, '202103755']);
        console.log('✨ 비밀번호 업데이트 성공! (비밀번호: 1234)');
        process.exit(0);
    } catch (err) {
        console.error('에러 발생:', err.message);
        process.exit(1);
    }
}
updatePassword();
