// src/controllers/recommendationController.js
const pool = require('../config/db'); // 프로젝트의 실제 DB 설정 파일 경로 확인 (예: '../config/database')

// 추천 교양 과목 목록 조회 API
exports.getRecommendedGeneralCourses = async (req, res) => {
    try {
        const [courses] = await pool.query('SELECT * FROM Recommended_General_Courses ORDER BY course_name ASC');
        res.json({
            success: true,
            data: courses
        });
    } catch (error) {
        console.error('추천 교양 과목 조회 에러:', error);
        res.status(500).json({ 
            success: false, 
            message: '추천 교양 과목을 불러오는 중 서버 에러가 발생했습니다.', 
            errorDetail: error.message 
        });
    }
};