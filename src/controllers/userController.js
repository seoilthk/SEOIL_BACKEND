// src/controllers/userController.js
const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const isMatch = await bcrypt.compare(password, user.password_hash);
const ALLOWED_STUDENT_IDS = [
    '202103755',
    '202103706'
];

// =============================================
// 로그인
// =============================================
exports.login = async (req, res) => {
    const { student_id, password } = req.body;

    if (!ALLOWED_STUDENT_IDS.includes(student_id)) {
        return res.status(403).json({ message: '시스템 접근이 허용되지 않은 학번입니다.' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM Users WHERE student_id = ?', [student_id]);
        if (rows.length === 0) {
            return res.status(401).json({ message: '등록되지 않은 학번입니다.' });
        }

        const user = rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
        }

        const secretKey = process.env.JWT_SECRET || 'seoil_default_secret_key';
        const token = jwt.sign({ student_id: user.student_id }, secretKey, { expiresIn: '1h' });

        return res.json({ message: '로그인 성공!', token });
    } catch (error) {
        console.error('로그인 처리 중 에러:', error);
        return res.status(500).json({ message: '로그인 서버 내부 오류가 발생했습니다.' });
    }
};

// =============================================
// GET /api/users/me
// 로그인한 학생의 기본 프로필 정보 반환
// =============================================
exports.getMe = async (req, res) => {
    const { student_id } = req.user;

    try {
        const [rows] = await pool.query(
            `SELECT 
                u.student_id,
                u.name,
                u.entry_year,
                u.academic_status,
                d.dept_name,
                d.course_length
            FROM Users u
            LEFT JOIN Departments d ON u.dept_id = d.dept_id
            WHERE u.student_id = ?`,
            [student_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: '사용자 정보를 찾을 수 없습니다.' });
        }

        const user = rows[0];

        return res.json({
            student_id: user.student_id,
            name: user.name,
            entry_year: user.entry_year,
            academic_status: user.academic_status || '재학',
            dept_name: user.dept_name,
            course_length: user.course_length,
        });
    } catch (error) {
        console.error('사용자 정보 조회 에러:', error);
        return res.status(500).json({ message: '사용자 정보 조회 중 오류가 발생했습니다.' });
    }
};

// =============================================
// GET /api/users/grades
// 로그인한 학생의 이수 과목 목록 + 성적 반환
// =============================================
exports.getGrades = async (req, res) => {
    const { student_id } = req.user;

    try {
        const [rows] = await pool.query(
            `SELECT 
                ug.grade_id,
                c.course_name AS name,
                c.credit,
                c.type,
                ug.score,
                ug.is_pass,
                ug.semester
            FROM User_Grades ug
            JOIN Courses c ON ug.course_id = c.course_id
            WHERE ug.student_id = ?
            ORDER BY ug.semester DESC`,
            [student_id]
        );

        return res.json({ grades: rows });
    } catch (error) {
        console.error('성적 조회 에러:', error);
        return res.status(500).json({ message: '성적 조회 중 오류가 발생했습니다.' });
    }
};
