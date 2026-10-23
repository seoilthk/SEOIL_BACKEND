const db = require('../config/db.js');

exports.getGraduationAnalysis = async (req, res) => {
    try {
        // 1. JWT에서 학번 확인
        const studentId = req.user?.student_id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: '인증 정보가 유효하지 않습니다.'
            });
        }

        // 2. 학생 정보 및 졸업요건 조회
        const studentQuery = `
            SELECT
                u.student_id,
                u.entry_year,
                u.dept_id,
                d.dept_name,
                gr.req_id,
                gr.total_target,
                gr.major_target,
                gr.general_target
            FROM Users u
            JOIN Departments d
                ON u.dept_id = d.dept_id
            JOIN Grad_Requirements gr
                ON u.dept_id = gr.dept_id
                AND u.entry_year = gr.entry_year
            WHERE u.student_id = ?
        `;

        const [studentRows] = await db.query(
            studentQuery,
            [studentId]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '학생 정보 또는 졸업요건을 찾을 수 없습니다.'
            });
        }

        // 중복 졸업요건 방지
        if (studentRows.length > 1) {
            console.error(
                '중복된 졸업요건:',
                studentRows.map(row => row.req_id)
            );

            return res.status(409).json({
                success: false,
                message: '동일 학과 및 입학연도에 졸업요건이 중복 등록되어 있습니다.'
            });
        }

        const student = studentRows[0];

        // 3. 졸업 기준
        // 현재 확정된 소프트웨어공학과 기준
        // 추후 다른 학과 지원 시 DB 컬럼 확장 필요
        const criteria = {
            minTotalCredits: Number(student.total_target),
            minMajorCredits: Number(student.major_target),
            minGeneralCredits: Number(student.general_target),
            maxGeneralCredits: 14,
            minGeneralRequiredCount: 1
        };

        // 4. 이수 성적 조회
        const gradeQuery = `
            SELECT
                ug.grade_id,
                ug.grade AS score,
                ug.status AS is_pass,
                c.course_id,
                c.course_code,
                c.course_name AS name,
                c.credit,
                c.type,
                c.semester,
                c.year
            FROM User_Grades ug
            JOIN Department_Courses c
                ON ug.course_id = c.course_id
            WHERE ug.student_id = ?
            ORDER BY ug.grade_id ASC
        `;

        const [rows] = await db.query(
            gradeQuery,
            [studentId]
        );

        // 5. 재수강 중복 제거
        // 같은 course_code는 가장 최근 이수 기록 기준
        const courseMap = new Map();

        rows.forEach(row => {
            const code = String(
                row.course_code ?? row.course_id
            );

            courseMap.set(code, row);
        });

        // 6. 이수 완료 및 F 제외
        const completedCourses = Array.from(
            courseMap.values()
        ).filter(row => {
            const isCompleted =
                row.is_pass === '이수완료' ||
                row.is_pass === '1' ||
                row.is_pass === 1 ||
                row.is_pass === true;

            const isFail =
                String(row.score ?? '')
                    .trim()
                    .toUpperCase() === 'F';

            return isCompleted && !isFail;
        });

        // 7. 학점 계산
        let totalCredits = 0;
        let majorCredits = 0;
        let generalCredits = 0;
        let generalRequiredCredits = 0;
        let generalRequiredCount = 0;

        completedCourses.forEach(row => {
            const credit = Number(row.credit) || 0;
            const type = String(row.type ?? '').trim();

            totalCredits += credit;

            if (
                type === '전필' ||
                type === '전선' ||
                type === '전공필수' ||
                type === '전공선택'
            ) {
                majorCredits += credit;
            } else if (
                type === '교필' ||
                type === '교선' ||
                type === '교양필수' ||
                type === '교양선택'
            ) {
                generalCredits += credit;

                if (
                    type === '교필' ||
                    type === '교양필수'
                ) {
                    generalRequiredCredits += credit;
                    generalRequiredCount += 1;
                }
            }
        });

        // 8. 교양 최대 인정학점 적용
        const recognizedGeneralCredits = Math.min(
            generalCredits,
            criteria.maxGeneralCredits
        );

        const excessGeneralCredits = Math.max(
            0,
            generalCredits - criteria.maxGeneralCredits
        );

        const recognizedTotalCredits =
            totalCredits - excessGeneralCredits;

        // 9. 부족 학점 계산
        const deficits = {
            deficitTotal: Math.max(
                0,
                criteria.minTotalCredits - recognizedTotalCredits
            ),

            deficitMajor: Math.max(
                0,
                criteria.minMajorCredits - majorCredits
            ),

            deficitGeneral: Math.max(
                0,
                criteria.minGeneralCredits - generalCredits
            ),

            deficitGeneralRequired: Math.max(
                0,
                criteria.minGeneralRequiredCount -
                    generalRequiredCount
            )
        };

        // 10. 졸업요건 충족 여부
        const results = {
            isTotalSatisfied:
                recognizedTotalCredits >=
                criteria.minTotalCredits,

            isMajorSatisfied:
                majorCredits >= criteria.minMajorCredits,

            isGeneralSatisfied:
                generalCredits >= criteria.minGeneralCredits,

            isGeneralRequiredSatisfied:
                generalRequiredCount >=
                criteria.minGeneralRequiredCount
        };

        results.isGraduated =
            results.isTotalSatisfied &&
            results.isMajorSatisfied &&
            results.isGeneralSatisfied &&
            results.isGeneralRequiredSatisfied;

        // 11. 졸업 진행률
        const graduationProgress = Math.min(
            100,
            Math.round(
                (
                    recognizedTotalCredits /
                    criteria.minTotalCredits
                ) * 1000
            ) / 10
        );

        // 12. 프론트엔드 응답
        return res.status(200).json({
            success: true,

            studentId,

            student: {
                departmentName: student.dept_name,
                admissionYear: student.entry_year
            },

            summary: {
                totalCredits,
                majorCredits,
                generalCredits,
                generalRequiredCredits,
                generalRequiredCount,
                recognizedGeneralCredits,
                excessGeneralCredits,
                recognizedTotalCredits,
                graduationProgress
            },

            deficits,
            criteria,
            results,

            grades: completedCourses
        });

    } catch (error) {
        console.error('졸업요건 분석 에러:', error);

        return res.status(500).json({
            success: false,
            message: '졸업요건 분석 중 서버 오류가 발생했습니다.'
        });
    }
};