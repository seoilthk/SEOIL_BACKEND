const pool = require('./src/config/db');
const bcrypt = require('bcrypt');

async function setupUser() {
    try {
        // 1. Users 테이블이 없으면 생성 (필수 컬럼 모두 포함)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                name VARCHAR(50) DEFAULT '학생',
                entry_year VARCHAR(50) DEFAULT '2021'
            )
        `);

        // 2. 기존 테이블에 누락된 컬럼이 있을 경우 안전하게 추가
        try { await pool.query(`ALTER TABLE Users ADD COLUMN name VARCHAR(50) DEFAULT '학생'`); } catch (e) {}
        try { await pool.query(`ALTER TABLE Users ADD COLUMN entry_year VARCHAR(50) DEFAULT '2021'`); } catch (e) {}

        const hash = await bcrypt.hash('1234', 10);
        const students = ['202103755', '202103706'];

        for (const student_id of students) {
            const [rows] = await pool.query('SELECT * FROM Users WHERE student_id = ?', [student_id]);
            if (rows.length === 0) {
                await pool.query(
                    'INSERT INTO Users (student_id, password_hash, name, entry_year) VALUES (?, ?, ?, ?)',
                    [student_id, hash, '학생', '2021']
                );
                console.log(`✅ 학번 ${student_id} 계정 생성 완료! (비밀번호: 1234)`);
            } else {
                await pool.query('UPDATE Users SET password_hash = ? WHERE student_id = ?', [hash, student_id]);
                console.log(`🔄 학번 ${student_id} 비밀번호 갱신 완료! (비밀번호: 1234)`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error('에러 발생:', err.message);
        process.exit(1);
    }
}
setupUser();
