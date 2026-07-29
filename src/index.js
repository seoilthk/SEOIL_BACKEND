// src/index.js
require('dotenv').config(); // 가장 상단에 위치해야 함!
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./config/db'); // 아까 만든 DB 설정 불러오기
const userRoutes = require('./routes/userRoutes');
const app = express();

// 1. 보안 미들웨어 및 기본 설정
app.use(helmet()); 
app.use(cors());
app.use(express.json());
app.use('/api/users', userRoutes);

// 2. DB 연결 테스트 라우트
app.get('/api/db-check', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1');
        res.json({ message: 'DB 연결 성공!', data: rows });
    } catch (error) {
        console.error('DB 연결 실패:', error);
        res.status(500).json({ error: 'DB 연결 실패' });
    }
});

// 3. 기본 루트
app.get('/', (req, res) => {
    res.json({ message: 'Seoil Graduation Planner Backend is running securely.' });
});

// 4. 서버 포트 설정
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 서버 가동 중: http://localhost:${PORT}`);
});