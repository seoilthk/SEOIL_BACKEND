// src/controllers/userController.js
const User = require('../config/db'); // DB 연결
const bcrypt = require('bcrypt');     // 비밀번호 암호화
const jwt = require('jsonwebtoken');  // 인증 토큰

// 1. 회원가입
exports.register = async (req, res) => {
    const { student_id, password, name, entry_year, dept_id } = req.body;
    try {
        // 비밀번호 암호화 (Salt Rounds: 10)
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sql = 'INSERT INTO Users (student_id, password_hash, name, entry_year, dept_id) VALUES (?, ?, ?, ?, ?)';
        await pool.query(sql, [student_id, hashedPassword, name, entry_year, dept_id]);
        
        res.status(201).json({ message: '회원가입 성공!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '회원가입 실패' });
    }
};

// 2. 로그인
exports.login = async (req, res) => {
    const { student_id, password } = req.body;
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