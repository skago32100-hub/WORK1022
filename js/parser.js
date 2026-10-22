/**
 * parser.js
 * 엑셀(XLSX/XLS) 및 CSV 파일 파싱, 컬럼 매핑, 수치 정제, 신규사업 판별 모듈
 */

const BudgetParser = {
  /**
   * File 객체를 읽어 구조화된 데이터 객체로 변환
   * @param {File} file 
   * @returns {Promise<Object>}
   */
  async parseFile(file) {
    const fileName = file.name;
    const isCsv = fileName.toLowerCase().endsWith('.csv');
    const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');

    if (!isCsv && !isExcel) {
      throw new Error("지원하지 않는 파일 형식입니다. (.xlsx, .xls, .csv 지원)");
    }

    const arrayBuffer = await file.arrayBuffer();

    let rawRows = [];
    if (typeof XLSX !== 'undefined') {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      // header: 1 -> 2차원 배열 형태로 추출
      rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    } else if (isCsv) {
      const textDecoder = new TextDecoder('utf-8');
      const text = textDecoder.decode(arrayBuffer);
      rawRows = this.parseCsvText(text);
    } else {
      throw new Error("엑셀 파싱 라이브러리(SheetJS)를 불러오지 못했습니다.");
    }

    if (!rawRows || rawRows.length === 0) {
      throw new Error("파일에 읽을 수 있는 데이터가 없습니다.");
    }

    return this.processRawRows(rawRows, fileName);
  },

  /**
   * RFC 4180 호환 순수 바닐라 JS CSV 파서
   * @param {string} text 
   * @returns {Array<Array<string>>}
   */
  parseCsvText(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    // BOM 제거
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
    }

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // 다음 따옴표 건너뜀
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some(cell => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  },

  /**
   * 원시 2차원 배열 데이터에서 헤더를 탐지하고 정규화된 아이템 목록으로 가공
   */
  processRawRows(rawRows, fileName) {
    // 1. 헤더 행 찾기 (연번, 분야, 세부 사업, 지표 등의 키워드가 포함된 행)
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const row = rawRows[r].map(c => String(c).trim());
      const hasCategory = row.some(c => /분야|중점영역|영역|부문/i.test(c));
      const hasProject = row.some(c => /사업|지표|세부/i.test(c));
      const hasId = row.some(c => /연번|번호|no|id/i.test(c));

      if ((hasCategory && hasProject) || (hasCategory && hasId) || (hasProject && hasId)) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      // 0번째 행을 헤더로 기본 가정
      headerRowIdx = 0;
    }

    const headerRow = rawRows[headerRowIdx].map(c => String(c).trim());

    // 2. 컬럼 매핑 인덱스 도출
    const mapping = {
      id: -1,
      category: -1,
      name: -1,
      unit: -1,
      prevYear: -1,
      currYear: -1,
      diff: -1,
      rate: -1,
      detail: -1
    };

    let prevYearLabel = "전년도 예산";
    let currYearLabel = "당해연도 정부안";

    headerRow.forEach((colName, idx) => {
      const col = colName.toLowerCase().replace(/\s+/g, '');

      if (/^(연번|번호|no|순번|#)$/i.test(col) && mapping.id === -1) {
        mapping.id = idx;
      } else if (/분야|중점영역|중점분야|영역|부문|category/i.test(col) && mapping.category === -1) {
        mapping.category = idx;
      } else if (/세부사업|사업명|주요지표|프로젝트|사업내용|project|name/i.test(col) && mapping.name === -1) {
        mapping.name = idx;
      } else if (/구분\/단위|구분|단위|unit/i.test(col) && mapping.unit === -1) {
        mapping.unit = idx;
      } else if (/증감률|증가율|변동률|증감비율|rate|%/i.test(col) && mapping.rate === -1) {
        mapping.rate = idx;
      } else if (/증감\(b-a\)|증감액|변동액|차이|증감|diff/i.test(col) && mapping.diff === -1) {
        mapping.diff = idx;
      } else if (/핵심내용|원문근거|근거|보도자료|비고|요약|description|detail/i.test(col) && mapping.detail === -1) {
        mapping.detail = idx;
      } else if (/20\d{2}.*\(a\)|전년|이전|기준/i.test(col) && mapping.prevYear === -1) {
        mapping.prevYear = idx;
        prevYearLabel = colName;
      } else if (/20\d{2}.*\(b\)|정부안|당해|금년|계획/i.test(col) && mapping.currYear === -1) {
        mapping.currYear = idx;
        currYearLabel = colName;
      }
    });

    // 만약 전년도/당해연도 컬럼을 찾지 못했다면 숫자 컬럼 순서로 추론
    if (mapping.prevYear === -1 || mapping.currYear === -1) {
      headerRow.forEach((colName, idx) => {
        if (/20\d{2}/.test(colName)) {
          if (mapping.prevYear === -1) {
            mapping.prevYear = idx;
            prevYearLabel = colName;
          } else if (mapping.currYear === -1) {
            mapping.currYear = idx;
            currYearLabel = colName;
          }
        }
      });
    }

    // 기본 위치 폴백 (사용자 이미지 포맷: 0:연번, 1:분야, 2:세부사업, 3:단위, 4:전년도, 5:정부안, 6:증감, 7:증가율, 8:핵심내용)
    if (mapping.category === -1 && headerRow.length > 1) mapping.category = 1;
    if (mapping.name === -1 && headerRow.length > 2) mapping.name = 2;
    if (mapping.unit === -1 && headerRow.length > 3) mapping.unit = 3;
    if (mapping.prevYear === -1 && headerRow.length > 4) mapping.prevYear = 4;
    if (mapping.currYear === -1 && headerRow.length > 5) mapping.currYear = 5;
    if (mapping.diff === -1 && headerRow.length > 6) mapping.diff = 6;
    if (mapping.rate === -1 && headerRow.length > 7) mapping.rate = 7;
    if (mapping.detail === -1 && headerRow.length > 8) mapping.detail = 8;

    // 3. 데이터 행 변환
    const items = [];
    let autoId = 1;

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const category = mapping.category !== -1 ? String(row[mapping.category] || "").trim() : "일반 분야";
      const name = mapping.name !== -1 ? String(row[mapping.name] || "").trim() : "";

      // 유효 행 필터링: 분야나 사업명이 둘 다 비어있으면 스킵
      if (!category && !name) continue;
      // 합계/소계 행인 경우 스킵
      if (/^(합계|총계|소계|전체합계)$/i.test(name) || /^(합계|총계|소계|전체합계)$/i.test(category)) continue;

      const idVal = mapping.id !== -1 ? parseInt(row[mapping.id], 10) : NaN;
      const id = !isNaN(idVal) ? idVal : autoId;
      autoId++;

      const unit = mapping.unit !== -1 ? String(row[mapping.unit] || "억원").trim() : "억원";
      const prevYearVal = mapping.prevYear !== -1 ? this.parseNumber(row[mapping.prevYear]) : 0;
      const currYearVal = mapping.currYear !== -1 ? this.parseNumber(row[mapping.currYear]) : 0;
      
      let diffVal = mapping.diff !== -1 ? this.parseNumber(row[mapping.diff]) : (currYearVal - prevYearVal);
      // diff가 0인데 계산값이 다르면 계산값 사용
      if (diffVal === 0 && (currYearVal !== prevYearVal)) {
        diffVal = parseFloat((currYearVal - prevYearVal).toFixed(2));
      }

      const rawRate = mapping.rate !== -1 ? String(row[mapping.rate] || "").trim() : "";
      const detail = mapping.detail !== -1 ? String(row[mapping.detail] || "").trim() : "";

      // 증가율 파싱 및 신규 여부 판별
      const rateInfo = this.parseRate(rawRate, prevYearVal, currYearVal, unit, detail);

      items.push({
        id,
        category: category || "기타 분야",
        name: name || `사업 #${id}`,
        unit: unit || "억원",
        prevYear: prevYearVal,
        currYear: currYearVal,
        diff: diffVal,
        rateStr: rateInfo.rateStr,
        rate: rateInfo.rate,
        isNew: rateInfo.isNew,
        detail: detail || "세부 내용 없음"
      });
    }

    if (items.length === 0) {
      throw new Error("파싱 가능한 데이터 행이 존재하지 않습니다.");
    }

    return {
      fileName,
      prevYearLabel,
      currYearLabel,
      unit: items[0].unit || "억원",
      items
    };
  },

  /**
   * 문자열이나 숫자를 정제된 부동소수점으로 변환
   */
  parseNumber(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;

    let str = String(val).trim();
    if (str === "" || str === "-" || str === "–" || str === "—") return 0;

    // 음수 기호 처리: '△500', '▲-500', '(500)' 등
    let isNegative = false;
    if (str.startsWith("△") || str.startsWith("▲") || str.startsWith("▼")) {
      isNegative = true;
      str = str.replace(/[△▲▼]/g, "");
    } else if (str.startsWith("(") && str.endsWith(")")) {
      isNegative = true;
      str = str.slice(1, -1);
    }

    // 쉼표 및 공백 제거
    str = str.replace(/,/g, "").replace(/\s+/g, "");

    const num = parseFloat(str);
    if (isNaN(num)) return 0;

    return isNegative ? -Math.abs(num) : num;
  },

  /**
   * 증가율 문자열 파싱 및 신규사업 여부 복합 판별
   */
  parseRate(rawRate, prevYear, currYear, unit, detail) {
    const isNewByRate = /신규|new/i.test(rawRate);
    const isNewByUnit = /신규/i.test(unit);
    const isNewByDetail = /\[신규|신규\s*(착수|반영|지원|사업|r&d)/i.test(detail);
    const isNewByZeroPrev = (prevYear === 0 || prevYear === null) && currYear > 0;

    const isNew = isNewByRate || isNewByUnit || isNewByDetail || isNewByZeroPrev;

    if (isNew) {
      return {
        isNew: true,
        rate: null,
        rateStr: "신규"
      };
    }

    let cleanRateStr = rawRate.replace(/%/g, "").replace(/,/g, "").trim();
    let isNeg = false;
    if (cleanRateStr.startsWith("△") || cleanRateStr.startsWith("▲") || cleanRateStr.startsWith("▼")) {
      isNeg = true;
      cleanRateStr = cleanRateStr.replace(/[△▲▼]/g, "");
    }

    let rateVal = parseFloat(cleanRateStr);

    if (isNaN(rateVal)) {
      if (prevYear > 0) {
        rateVal = parseFloat((((currYear - prevYear) / prevYear) * 100).toFixed(1));
      } else {
        rateVal = 0;
      }
    } else if (isNeg) {
      rateVal = -Math.abs(rateVal);
    }

    return {
      isNew: false,
      rate: rateVal,
      rateStr: `${rateVal >= 0 ? "+" : ""}${rateVal.toFixed(1)}%`
    };
  },

  /**
   * 전체 및 분야별 통계 지표 계산
   * @param {Array} items 
   * @returns {Object}
   */
  calculateMetrics(items) {
    const totalCount = items.length;
    let totalPrevYear = 0;
    let totalCurrYear = 0;
    let totalDiff = 0;

    let newCount = 0;
    let newTotalBudget = 0;

    const categoryMap = {};

    items.forEach(item => {
      totalPrevYear += item.prevYear;
      totalCurrYear += item.currYear;
      totalDiff += item.diff;

      if (item.isNew) {
        newCount++;
        newTotalBudget += item.currYear;
      }

      // 분야별 집계
      if (!categoryMap[item.category]) {
        categoryMap[item.category] = {
          category: item.category,
          items: [],
          count: 0,
          prevYearTotal: 0,
          currYearTotal: 0,
          diffTotal: 0,
          newCount: 0,
          newBudget: 0
        };
      }

      const cat = categoryMap[item.category];
      cat.items.push(item);
      cat.count++;
      cat.prevYearTotal += item.prevYear;
      cat.currYearTotal += item.currYear;
      cat.diffTotal += item.diff;
      if (item.isNew) {
        cat.newCount++;
        cat.newBudget += item.currYear;
      }
    });

    // 전체 증감률 계산
    const totalRate = totalPrevYear > 0 
      ? parseFloat((((totalCurrYear - totalPrevYear) / totalPrevYear) * 100).toFixed(1))
      : 0;

    // 신규 사업 비중 (%)
    const newRatioCount = totalCount > 0 ? parseFloat(((newCount / totalCount) * 100).toFixed(1)) : 0;
    const newRatioBudget = totalCurrYear > 0 ? parseFloat(((newTotalBudget / totalCurrYear) * 100).toFixed(1)) : 0;

    // 분야 배열로 가공 및 분야별 증감률 계산
    const categories = Object.values(categoryMap).map(cat => {
      const catRate = cat.prevYearTotal > 0
        ? parseFloat((((cat.currYearTotal - cat.prevYearTotal) / cat.prevYearTotal) * 100).toFixed(1))
        : (cat.currYearTotal > 0 ? 100.0 : 0);
      
      const budgetShare = totalCurrYear > 0
        ? parseFloat(((cat.currYearTotal / totalCurrYear) * 100).toFixed(1))
        : 0;

      return {
        ...cat,
        rate: catRate,
        budgetShare
      };
    });

    // 예산 규모 순으로 분야 정렬
    categories.sort((a, b) => b.currYearTotal - a.currYearTotal);

    // 신규 사업 리스트
    const newProjects = items.filter(i => i.isNew).sort((a, b) => b.currYear - a.currYear);

    return {
      totalCount,
      totalPrevYear: Math.round(totalPrevYear * 100) / 100,
      totalCurrYear: Math.round(totalCurrYear * 100) / 100,
      totalDiff: Math.round(totalDiff * 100) / 100,
      totalRate,
      newCount,
      newTotalBudget: Math.round(newTotalBudget * 100) / 100,
      newRatioCount,
      newRatioBudget,
      categories,
      newProjects
    };
  }
};

if (typeof window !== 'undefined') {
  window.BudgetParser = BudgetParser;
}
