// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const analysisController = require('../controllers/analysisController');
const authMiddleware = require('../middlewares/authMiddleware');


// 로그인
router.post('/login', userController.login);

// 내 학적정보 조회
router.get('/me', authMiddleware, userController.getMe);

// 기존 프로필 API 유지
router.get(
    '/profile',
    authMiddleware,
    analysisController.getGraduationAnalysis,
    (req, res) => {
        res.json({
            message: `안녕하세요! 학번 ${req.user.student_id}님!`
        });
    }
);

// 졸업요건 분석
router.get(
    '/analysis',
    authMiddleware,
    analysisController.getGraduationAnalysis
);

// 이수 과목 및 성적 조회
router.get(
    '/grades',
    authMiddleware,
    userController.getGrades
);

module.exports = router;