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

// 라우터들보다 맨 위에 배치해서 무조건 먼저 가로채도록 설정
app.post('/api/test-login', (req, res) => {
    console.log("🔥 드디어 도착한 데이터:", req.body);
    res.json({
        success: true,
        message: "백엔드 로그인 통신 성공!"
    });
});

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

app.get("/api/test", (req, res) => {
  console.log("프론트엔드 연결 테스트 요청 수신");

  res.json({
    success: true,
    message: "백엔드 연결 성공",
  });
});

// 3. 기본 루트
// 프론트엔드 통신 테스트용 주소 추가
app.post('/api/test-login', (req, res) => {
    console.log("프론트엔드에서 보낸 데이터:", req.body);
    res.json({ success: true, message: "백엔드 로그인 통신 성공!" });
});

app.get('/', (req, res) => {
    res.json({ message: 'Seoil Graduation Planner Backend is running securely.' });
});

// 4. 서버 포트 설정
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 서버 가동 중: http://localhost:${PORT}`);
    console.log(`로컬 주소: http://localhost:${PORT}`);
    console.log(`휴대폰 접속 주소: http://192.168.112.28:${PORT}`);
});