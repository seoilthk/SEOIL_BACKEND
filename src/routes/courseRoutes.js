const express = require('express');
const router = express.Router();
const { getAllCourses } = require('../controllers/courseController');

// GET /api/courses 요청 처리
router.get('/', getAllCourses);

module.exports = router;
