const pool = require('../config/db');

// 학기별 또는 학년별 전공 과목 조회
exports.getDepartmentCourses = async (req, res) => {
    const { semester, year } = req.query; // 예: /api/department-courses?semester=2024-1학기&year=2

    try {
        let query = 'SELECT * FROM Department_Courses WHERE 1=1';
        const params = [];

        if (semester) {
            query += ' AND semester = ?';
            params.push(semester);
        }
        if (year) {
            query += ' AND year = ?';
            params.push(year);
        }

        query += ' ORDER BY year ASC, course_name ASC';

        const [courses] = await pool.query(query, params);
        res.json({
            success: true,
            data: courses
        });
    } catch (error) {
        console.error('소프트웨어공학과 과목 조회 에러:', error);
        res.status(500).json({ success: false, message: '서버 에러가 발생했습니다.' });
    }
};