// src/controllers/analysisController.js
const pool = require('../config/database'); // 프로젝트의 실제 DB 설정 파일 경로 확인 필요

exports.getGraduationAnalysis = async (req, res) => {
    const { student_id } = req.user;

    try {
        // 1. 해당 학생의 입학연도, 학과, 그리고 학과별 졸업 기준 학점 조회 (JOIN 활용)
        const userQuery = `
            SELECT u.entry_year, u.dept_id, u.name,
                   r.total_target, r.major_target, r.general_target,
                   d.dept_name, d.course_length
            FROM Users u
            JOIN Grad_Requirements r ON u.dept_id = r.dept_id AND u.entry_year = r.entry_year
            JOIN Departments d ON u.dept_id = d.dept_id
            WHERE u.student_id = ?
        `;
        const [userRows] = await pool.query(userQuery, [student_id]);
        
        if (userRows.length === 0) {
            return res.status(404).json({ error: '해당 학생의 졸업 요건 정의를 찾을 수 없습니다.' });
        }
        const reqs = userRows[0]; // 졸업 기준 데이터

        // 2. 학생의 전체 성적 및 이수 과목 정보 조회 (JOIN 활용)
       const gradesQuery = `
            SELECT ug.grade AS score, ug.status AS is_pass, c.credit, c.type
            FROM User_Grades ug
            JOIN Department_Courses c ON ug.course_id = c.course_id
            WHERE ug.student_id = ?
        `;
        const [gradeRows] = await pool.query(gradesQuery, [student_id]);

        // 3. 학점 및 평점 계산 알고리즘 시작
        let totalEarnedCredits = 0;
        let majorEarnedCredits = 0;
        let generalEarnedCredits = 0;

        let totalGradePoints = 0; // (학점 * 평점)의 총합
        let totalAppliedCreditsForGPA = 0; // P/F 과목을 제외한 평점 계산용 총 학점

        // 성적별 평점 변환 매핑 테이블
        const scoreValues = {
            'A+': 4.5, 'A0': 4.0,
            'B+': 3.5, 'B0': 3.0,
            'C+': 2.5, 'C0': 2.0,
            'D+': 1.5, 'D0': 1.0,
            'F': 0.0
        };

        gradeRows.forEach(row => {
            if (row.score === 'F' || !row.is_pass) return;

            const credit = parseInt(row.credit);
            totalEarnedCredits += credit;

            // 전공 / 교양 분류 ('전필', '전공필수', '전선', '전공선택' 모두 호환되도록 처리)
            if (row.type && (row.type.includes('전필') || row.type.includes('전공'))) {
                majorEarnedCredits += credit;
            } else {
                generalEarnedCredits += credit; 
            }

            if (row.score !== 'P') {
                const gradePoint = scoreValues[row.score] || 0.0;
                totalGradePoints += (credit * gradePoint);
                totalAppliedCreditsForGPA += credit;
            }
        });

        // 평점 평균(GPA) 산출
        const gpa = totalAppliedCreditsForGPA > 0 
            ? (totalGradePoints / totalAppliedCreditsForGPA).toFixed(2) 
            : "0.00";

        // 4. 졸업 요건 대비 부족한 학점 계산
        const remainingTotal = Math.max(0, reqs.total_target - totalEarnedCredits);
        const remainingMajor = Math.max(0, reqs.major_target - majorEarnedCredits);
        const remainingGeneral = Math.max(0, reqs.general_target - generalEarnedCredits);

        // 5. 프론트엔드 응답 데이터 구조
        res.json({
            student_id,
            name: reqs.name,
            dept_name: reqs.dept_name,
            entry_year: reqs.entry_year,
            course_length: reqs.course_length,
            gpa,
            summary: {
                total_earned: totalEarnedCredits,
                total_target: reqs.total_target,
                remaining_total: remainingTotal
            },
            details: {
                major_earned: majorEarnedCredits,
                major_target: reqs.major_target,
                remaining_major: remainingMajor,
                general_earned: generalEarnedCredits,
                general_target: reqs.general_target,
                remaining_general: remainingGeneral
            }
        });

    } catch (error) {
        console.error('졸업 요건 분석 중 서버 오류 발생:', error);
        res.status(500).json({ error: '학점 분석에 실패했습니다.' });
    }
};