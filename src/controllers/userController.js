// src/controllers/userController.js

const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// 테스트 로그인 허용 학번
const ALLOWED_STUDENT_IDS = [
    '202103755',
    '202103706'
];

// =============================================
// 로그인
// POST /api/users/login
// =============================================
exports.login = async (req, res) => {
    const { student_id, password } = req.body || {};

    // 1. 학번 및 비밀번호 입력 확인
    if (!student_id || !password) {
        return res.status(400).json({
            message: '학번과 비밀번호를 입력해주세요.'
        });
    }

    // 학번을 문자열로 통일
    const studentId = String(student_id);

    // 2. 허용된 테스트 학번 확인
    if (!ALLOWED_STUDENT_IDS.includes(studentId)) {
        return res.status(403).json({
            message: '시스템 접근이 허용되지 않은 학번입니다.'
        });
    }

    try {
        // 3. MySQL에서 사용자 조회
        const [rows] = await pool.query(
            'SELECT * FROM Users WHERE student_id = ?',
            [studentId]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: '등록되지 않은 학번입니다.'
            });
        }

        const user = rows[0];

        // 4. bcrypt 비밀번호 검증
        const isMatch = await bcrypt.compare(
            String(password),
            user.password_hash
        );

        if (!isMatch) {
            return res.status(401).json({
                message: '비밀번호가 일치하지 않습니다.'
            });
        }

        // 5. JWT 토큰 생성
        const secretKey = process.env.JWT_SECRET;

        if (!secretKey) {
            console.error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
            return res.status(500).json({
                message: '로그인 서버 설정 오류가 발생했습니다.'
            });
        }

        const token = jwt.sign(
            { student_id: String(user.student_id) },
            secretKey,
            { expiresIn: '1h' }
        );

        // 6. 로그인 성공
        return res.status(200).json({
            message: '로그인 성공!',
            token
        });

    } catch (error) {
        console.error('로그인 처리 중 에러:', error);

        return res.status(500).json({
            message: '로그인 서버 내부 오류가 발생했습니다.'
        });
    }
};

// =============================================
// 학적정보 조회
// GET /api/users/me
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
                u.transfer,
                d.dept_name,
                d.course_length
            FROM Users u
            LEFT JOIN Departments d
                ON u.dept_id = d.dept_id
            WHERE u.student_id = ?`,
            [student_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: '사용자 정보를 찾을 수 없습니다.'
            });
        }

        const user = rows[0];

        return res.status(200).json({
            student_id: user.student_id,
            name: user.name,
            entry_year: user.entry_year,
            academic_status: user.academic_status || '재학',
            dept_name: user.dept_name,
            course_length: user.course_length
        });

    } catch (error) {
        console.error('사용자 정보 조회 에러:', error);

        return res.status(500).json({
            message: '사용자 정보 조회 중 오류가 발생했습니다.'
        });
    }
};

// =============================================
// 성적 및 이수 과목 조회
// GET /api/users/grades
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
            JOIN Courses c
                ON ug.course_id = c.course_id
            WHERE ug.student_id = ?
            ORDER BY ug.semester DESC`,
            [student_id]
        );

        return res.status(200).json({
            grades: rows
        });

    } catch (error) {
        console.error('성적 조회 에러:', error);

        return res.status(500).json({
            message: '성적 조회 중 오류가 발생했습니다.'
        });
    }
};
