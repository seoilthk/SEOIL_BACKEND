const db = require("../config/db.js");

exports.getGraduationAnalysis = async (req, res) => {
  try {
    const studentId = req.user?.student_id;

    if (!studentId) {
      return res.status(401).json({
        success: false,
        message: "인증 정보가 유효하지 않습니다.",
      });
    }

    // 1. 사용자 정보 및 졸업요건 조회
    const studentQuery = `
      SELECT
        u.student_id,
        u.entry_year,
        d.dept_name,
        gr.total_target,
        gr.major_target,
        gr.general_target,
        gr.general_max,
        gr.general_required_count
      FROM Users u
      JOIN Departments d ON u.dept_id = d.dept_id
      JOIN Grad_Requirements gr
        ON u.dept_id = gr.dept_id
        AND u.entry_year = gr.entry_year
      WHERE u.student_id = ?
    `;

    const [studentRows] = await db.query(studentQuery, [studentId]);

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "학생 정보 또는 졸업요건을 찾을 수 없습니다.",
      });
    }

    if (studentRows.length > 1) {
      return res.status(409).json({
        success: false,
        message: "중복된 졸업요건이 존재합니다.",
      });
    }

    const student = studentRows[0];

    const criteria = {
      minTotalCredits: Number(student.total_target),
      minMajorCredits: Number(student.major_target),
      minGeneralCredits: Number(student.general_target),
      maxGeneralCredits: Number(student.general_max),
      minGeneralRequiredCount: Number(
        student.general_required_count
      ),
    };

    // 2. 성적 데이터 조회
    const gradeQuery = `
      SELECT
        ug.grade_id,
        ug.grade,
        ug.status,
        -- 기존 로직 호환을 위해 전공 테이블의 PK(course_id)가 없으면 교양 테이블의 PK(rec_id)를 대체 사용
        COALESCE(c.course_id, rgc.rec_id) AS course_id,
        ug.course_id AS course_code,
        
        -- 전공 테이블에 없으면 교양 테이블에서 데이터 가져오기
        COALESCE(c.course_name, rgc.course_name) AS course_name,
        COALESCE(c.credit, rgc.credit) AS credit,
        
        -- DB에 어떤 형태로 들어있든 무조건 프론트가 원하는 2글자로 변환
        // userController.js의 CASE 문 수정
        CASE 
          WHEN COALESCE(c.type, rgc.type) IN ('전필', '전공필수') THEN '전필'
          WHEN COALESCE(c.type, rgc.type) IN ('전선', '전공선택') THEN '전선'
          WHEN COALESCE(c.type, rgc.type) IN ('교필', '교양필수') THEN '교필'
        ELSE '교선' 
      END AS type,
        
      FROM User_Grades ug
      
      -- 핵심: INNER JOIN 대신 두 테이블 모두 LEFT JOIN 처리
      LEFT JOIN Department_Courses c 
        ON ug.course_id = c.course_code
      LEFT JOIN Recommended_General_Courses rgc 
        ON ug.course_id = rgc.course_code
        
      WHERE ug.student_id = ?
      ORDER BY ug.grade_id ASC
    `;

    const [gradeRows] = await db.query(gradeQuery, [studentId]);

    // 3. 이수 완료 + F학점 제외
    const completedRows = gradeRows.filter((row) => {
      const status = String(row.status ?? "").trim();
      const grade = String(row.grade ?? "").trim().toUpperCase();

      return (
        ["이수완료", "1", "true"].includes(status) &&
        grade !== "F"
      );
    });

    // 4. 테스트 데이터 중복 처리
    // 현재는 과목명을 기준으로 1회만 인정하는 임시 방식
    const courseMap = new Map();

    completedRows.forEach((row) => {
      const key = String(row.course_name ?? "").trim();
      if (key) {
        courseMap.set(key, row);
      }
    });

    const completedCourses = Array.from(courseMap.values());

    // 5. 학점 계산
    let totalCredits = 0;
    let majorCredits = 0;
    let generalCredits = 0;
    let generalRequiredCredits = 0;
    let generalRequiredCount = 0;

    completedCourses.forEach((row) => {
      const credit = Number(row.credit) || 0;
      const type = String(row.type ?? "").trim();

      totalCredits += credit;

      if (
        ["전필", "전선", "전공필수", "전공선택"].includes(type)
      ) {
        majorCredits += credit;
      } else if (
        ["교필", "교선", "교양필수", "교양선택"].includes(type)
      ) {
        generalCredits += credit;

        if (["교필", "교양필수"].includes(type)) {
          generalRequiredCredits += credit;
          generalRequiredCount++;
        }
      }
    });

    // 6. 교양 최대 인정학점 적용
    const excessGeneralCredits = Math.max(
      0,
      generalCredits - criteria.maxGeneralCredits
    );

    const recognizedTotalCredits = Math.max(
      0,
      totalCredits - excessGeneralCredits
    );

    // 7. 부족 학점 계산
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
        criteria.minGeneralRequiredCount - generalRequiredCount
      ),
    };

    // 8. 졸업요건 충족 여부
    const results = {
      isTotalSatisfied:
        recognizedTotalCredits >= criteria.minTotalCredits,

      isMajorSatisfied:
        majorCredits >= criteria.minMajorCredits,

      isGeneralSatisfied:
        generalCredits >= criteria.minGeneralCredits,

      isGeneralRequiredSatisfied:
        generalRequiredCount >= criteria.minGeneralRequiredCount,
    };

    results.isGraduated =
      results.isTotalSatisfied &&
      results.isMajorSatisfied &&
      results.isGeneralSatisfied &&
      results.isGeneralRequiredSatisfied;

    // 9. 졸업 진행률
    const progress = Math.min(
      100,
      Math.round(
        (recognizedTotalCredits / criteria.minTotalCredits) * 100
      )
    );

    // 10. 결과 반환
    return res.status(200).json({
      success: true,
      studentId,

      student: {
        departmentName: student.dept_name,
        admissionYear: student.entry_year,
      },

      summary: {
        totalCredits,
        recognizedTotalCredits,
        majorCredits,
        generalCredits,
        generalRequiredCredits,
        generalRequiredCount,
        excessGeneralCredits,
      },

      deficits,
      criteria,
      results,
      progress,
      grades: completedCourses,
    });
  } catch (error) {
    console.error("졸업요건 분석 에러:", error);

    return res.status(500).json({
      success: false,
      message: "졸업요건 분석 중 서버 오류가 발생했습니다.",
    });
  }
};