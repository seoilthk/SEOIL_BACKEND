// src/index.js
require('dotenv').config(); // .env 파일 불러오기
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // 보안 헤더 설정용 미들웨어
const app = express();

// 1. 보안 미들웨어 설정
app.use(helmet()); 
app.use(cors({
    origin: '*', // 나중에 프론트엔드 도메인만 허용하도록 변경하세요
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json()); // JSON 데이터 파싱

// 2. 라우트 연결 (나중에 routes 폴더에 파일을 만들면 여기에 연결합니다)
// const userRoutes = require('./routes/userRoutes');
// app.use('/api/users', userRoutes);

// 3. 기본 루트
app.get('/', (req, res) => {
    res.json({ message: 'Seoil Graduation Planner Backend is running securely.' });
});

// 4. 에러 핸들링 미들웨어 (보안상 에러 메시지 상세 노출 방지)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});