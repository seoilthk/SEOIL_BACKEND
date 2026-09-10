// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const analysisController = require('../controllers/analysisController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/login', userController.login);
router.get('/profile', authMiddleware, analysisController.getGraduationAnalysis, (req, res) => {
    res.json({ message: `안녕하세요! 학번 ${req.user.student_id}님!` });
});

module.exports = router;