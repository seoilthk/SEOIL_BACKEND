// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // 1. 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
    }

    const token = authHeader.split(' ')[1]; // "Bearer <token>"에서 토큰만 추출

    try {
        // 2. 토큰 검증 (JWT_SECRET은 .env에 저장되어 있어야 함)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 3. 검증 성공 시 사용자 정보를 req 객체에 저장하여 다음 함수(Controller)로 전달
        req.user = decoded; 
        next(); // 다음 로직으로 이동
    } catch (error) {
        return res.status(403).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
    }
};