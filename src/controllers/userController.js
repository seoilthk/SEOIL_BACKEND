// src/controllers/userController.js
const pool = require('../config/db'); // DB 연결
const bcrypt = require('bcrypt');     // 비밀번호 암호화
const jwt = require('jsonwebtoken');  // 인증 토큰

const ALLOWED_STUDENT_IDS = [
    '202103755',
    '202103706'
];

// 1. 로그인
exports.login = async (req, res) => {
    const { student_id, password } = req.body;

    // 허용된 학번인지 먼저 검사
    if (!ALLOWED_STUDENT_IDS.includes(student_id)) {
        return res.status(403).json({ error: '시스템 접근이 허용되지 않은 학번입니다.' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM Users WHERE student_id = ?', [student_id]);
        if (rows.length === 0) return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });

        const user = rows[0];
        // 비밀번호 비교
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: '아이디 또는 비밀번호가 틀렸습니다.' });

        // JWT 토큰 발급 (보안 키는 .env에서 가져옴)
        const token = jwt.sign({ student_id: user.student_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        res.json({ message: '로그인 성공!', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '로그인 서버 오류' });
    }
};