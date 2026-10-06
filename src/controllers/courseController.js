const pool = require('../config/db');

// 모든 과목 조회 API
const getAllCourses = async (req, res) => {
    try {
        const [courses] = await pool.query('SELECT * FROM Courses ORDER BY course_id ASC');
        res.json({
            success: true,
            data: courses
        });
    } catch (error) {
        console.error('과목 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.', errorDetail: error.message });
    }
};

module.exports = {
    getAllCourses
};
