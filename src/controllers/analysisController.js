const db = require('../config/db.js');

exports.getGraduationAnalysis = async (req, res) => {
    try {
        // 1. JWT 인증 정보에서 학번 가져오기
        const studentId = req.user?.student_id;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: '인증 정보가 유효하지 않습니다.'
            });
        }

        // 2. 학생 정보 및 학과별 졸업 기준 조회
        const studentQuery = `
            SELECT
                s.student_id,
                s.department_id,
                s.admission_year,
                d.department_name,
                d.min_total_credits,
                d.min_major_credits,
                d.min_general_credits,
                d.max_general_credits,
                d.min_general_required
            FROM Students s
            JOIN Departments d
                ON s.department_id = d.department_id
            WHERE s.student_id = ?
        `;

        const [studentRows] = await db.query(studentQuery, [studentId]);

        if (studentRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: '학생 정보 또는 졸업요건을 찾을 수 없습니다.'
            });
        }

        const student = studentRows[0];

        // 3. 졸업 기준
        const defaultCriteria = {
            minTotalCredits: 110,
            minMajorCredits: 60,
            minGeneralCredits: 8,
            maxGeneralCredits: 14,
            minGeneralRequired: 2
        };

        const criteria = {
            minTotalCredits:
                student.min_total_credits ?? defaultCriteria.minTotalCredits,

            minMajorCredits:
                student.min_major_credits ?? defaultCriteria.minMajorCredits,

            minGeneralCredits:
                student.min_general_credits ?? defaultCriteria.minGeneralCredits,

            maxGeneralCredits:
                student.max_general_credits ?? defaultCriteria.maxGeneralCredits,

            minGeneralRequired:
                student.min_general_required ?? defaultCriteria.minGeneralRequired
        };

        // 4. 학생의 이수 성적 및 과목 정보 조회
        const gradeQuery = `
            SELECT
                ug.grade_id,
                ug.grade,
                ug.status,
                c.course_id,
                c.course_code,
                c.course_name,
                c.credit,
                c.type,
                c.semester,
                c.year
            FROM User_Grades ug
            JOIN Department_Courses c
                ON ug.course_id = c.course_id
            WHERE ug.student_id = ?
        `;

        const [rows] = await db.query(gradeQuery, [studentId]);

        // 5. 미이수 및 F 과목 제외
        // 중복 과목은 제거하지 않음
        const completedCourses = rows.filter(row => {
            const isCompleted =
                row.status === '이수완료' ||
                row.status === '1' ||
                row.status === 1 ||
                row.status === true;

            const isFail =
                String(row.grade ?? '').trim().toUpperCase() === 'F';

            return isCompleted && !isFail;
        });

        // 6. 학점 계산
        let totalCredits = 0;
        let majorCredits = 0;
        let generalCredits = 0;
        let generalRequiredCredits = 0;
        let generalRequiredCount = 0;

        completedCourses.forEach(row => {
            const credit = Number(row.credit) || 0;
            const type = String(row.type ?? '').trim();

            // 총 이수학점
            totalCredits += credit;

            // 전공 학점
            if (
                type === '전필' ||
                type === '전선' ||
                type === '전공필수' ||
                type === '전공선택'
            ) {
                majorCredits += credit;
            }

            // 교양 학점
            else if (
                type === '교필' ||
                type === '교선' ||
                type === '교양필수' ||
                type === '교양선택'
            ) {
                generalCredits += credit;

                // 교양필수 학점
                if (
                    type === '교필' ||
                    type === '교양필수'
                ) {
                    generalRequiredCredits += credit;
                    generalRequiredCount += 1;
                }
            }
        });

        // 7. 부족 학점 계산
        const deficits = {
            deficitTotal: Math.max(
                0,
                criteria.minTotalCredits - totalCredits
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
                criteria.minGeneralRequired - generalRequiredCredits
            )
        };

        // 8. 졸업요건 충족 여부
        const results = {
            isTotalSatisfied:
                totalCredits >= criteria.minTotalCredits,

            isMajorSatisfied:
                majorCredits >= criteria.minMajorCredits,

            isGeneralSatisfied:
                generalCredits >= criteria.minGeneralCredits &&
                generalCredits <= criteria.maxGeneralCredits,

            isGeneralRequiredSatisfied:
                generalRequiredCredits >= criteria.minGeneralRequired
        };

        results.isGraduated =
            results.isTotalSatisfied &&
            results.isMajorSatisfied &&
            results.isGeneralSatisfied &&
            results.isGeneralRequiredSatisfied;

        // 9. 프론트엔드에 결과 전달
        return res.status(200).json({
            success: true,

            studentId,

            student: {
                departmentName: student.department_name,
                admissionYear: student.admission_year
            },

            summary: {
                totalCredits,
                majorCredits,
                generalCredits,
                generalRequiredCredits,
                generalRequiredCount
            },

            deficits,

            criteria,

            results,

            // 중복 제거 없이 이수완료 과목 반환
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
