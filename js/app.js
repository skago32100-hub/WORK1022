/**
 * app.js
 * 메인 어플리케이션 컨트롤러, 파일 드래그앤드롭 및 이벤트 바인딩
 */

document.addEventListener('DOMContentLoaded', () => {
  BudgetApp.init();
});

const BudgetApp = {
  currentData: null,

  init() {
    this.bindUploadEvents();
    this.bindTableEvents();
    this.bindToolbarEvents();

    // 초기 데이터: 내장된 2027년 국방예산 기본 샘플 로드
    if (typeof DEFAULT_SAMPLE_DATA !== 'undefined') {
      this.loadData(DEFAULT_SAMPLE_DATA);
    }
  },

  /**
   * 데이터 로드 및 뷰 전체 갱신
   */
  loadData(data) {
    this.currentData = data;
    const metrics = BudgetParser.calculateMetrics(data.items);
    const meta = {
      prevYearLabel: data.prevYearLabel,
      currYearLabel: data.currYearLabel,
      unit: data.unit
    };

    // UI 및 차트 갱신
    BudgetUI.render(data);
    BudgetCharts.updateAll(metrics, meta);
  },

  /**
   * 파일 업로드 (드래그 앤 드롭 & 파일 선택) 이벤트 바인딩
   */
  bindUploadEvents() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (!dropZone || !fileInput) return;

    // 클릭 시 파일 선택창 열기
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        await this.handleFile(file);
      }
      fileInput.value = ''; // 재업로드 가능하도록 초기화
    });

    // 드래그 앤 드롭 효과
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-active');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-active');
      }, false);
    });

    dropZone.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      const file = dt.files && dt.files[0];
      if (file) {
        await this.handleFile(file);
      }
    });
  },

  /**
   * 선택된 파일 파싱 처리
   */
  async handleFile(file) {
    try {
      BudgetUI.showToast(`'${file.name}' 파일을 분석하는 중입니다...`, 'info');
      const parsedData = await BudgetParser.parseFile(file);
      this.loadData(parsedData);
      BudgetUI.showToast(`성공적으로 대시보드가 갱신되었습니다! (총 ${parsedData.items.length}건)`, 'success');
    } catch (err) {
      console.error(err);
      BudgetUI.showToast(`파일 처리 중 오류가 발생했습니다: ${err.message}`, 'error');
    }
  },

  /**
   * 테이블 필터, 검색, 정렬 이벤트 바인딩
   */
  bindTableEvents() {
    // 1. 실시간 검색어
    const searchInput = document.getElementById('tableSearchInput');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          BudgetUI.state.searchKeyword = e.target.value.trim();
          BudgetUI.renderTable();
        }, 150);
      });
    }

    // 2. 분야 셀렉트박스
    const categorySelect = document.getElementById('tableCategoryFilter');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        BudgetUI.state.filterCategory = e.target.value;
        BudgetUI.renderCategoryCards();
        BudgetUI.renderTable();
      });
    }

    // 3. 신규사업 전용 토글
    const onlyNewCheckbox = document.getElementById('toggleOnlyNew');
    if (onlyNewCheckbox) {
      onlyNewCheckbox.addEventListener('change', (e) => {
        BudgetUI.state.onlyNew = e.target.checked;
        BudgetUI.renderTable();
      });
    }

    // 4. 테이블 헤더 클릭 정렬
    const sortHeaders = document.querySelectorAll('th[data-sort]');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (BudgetUI.state.sortField === field) {
          // 정렬 방향 토글
          BudgetUI.state.sortOrder = BudgetUI.state.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          BudgetUI.state.sortField = field;
          BudgetUI.state.sortOrder = (field === 'currYear' || field === 'diff' || field === 'rate') ? 'desc' : 'asc';
        }

        // 헤더 인디케이터 업데이트
        sortHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(BudgetUI.state.sortOrder === 'asc' ? 'sort-asc' : 'sort-desc');

        BudgetUI.renderTable();
      });
    });
  },

  /**
   * 툴바 (샘플 로드, 내보내기, 인쇄) 이벤트 바인딩
   */
  bindToolbarEvents() {
    // 샘플 데이터 재로드
    const btnReloadSample = document.getElementById('btnReloadSample');
    if (btnReloadSample) {
      btnReloadSample.addEventListener('click', () => {
        if (typeof DEFAULT_SAMPLE_DATA !== 'undefined') {
          this.loadData(DEFAULT_SAMPLE_DATA);
          BudgetUI.showToast("기본 국방예산 샘플 데이터로 복원되었습니다.", 'success');
        }
      });
    }

    // 엑셀 다운로드
    const btnExportExcel = document.getElementById('btnExportExcel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', () => this.exportToExcel());
    }

    // CSV 다운로드
    const btnExportCsv = document.getElementById('btnExportCsv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => this.exportToCsv());
    }

    // 인쇄 / PDF 저장
    const btnPrint = document.getElementById('btnPrintDashboard');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        window.print();
      });
    }
  },

  /**
   * 현재 데이터를 Excel 파일(.xlsx)로 내보내기
   */
  exportToExcel() {
    if (!this.currentData || !this.currentData.items) return;
    if (typeof XLSX === 'undefined') {
      BudgetUI.showToast("SheetJS 라이브러리를 찾을 수 없습니다.", 'error');
      return;
    }

    const items = BudgetUI.getFilteredItems();
    const dataRows = [
      [
        "연번", 
        "분야 (중점영역)", 
        "세부 사업 / 주요 지표", 
        "구분/단위", 
        this.currentData.prevYearLabel, 
        this.currentData.currYearLabel, 
        "증감 (B-A)", 
        "증가율 (%)", 
        "핵심 내용 및 보도자료 박스 원문 근거"
      ]
    ];

    items.forEach(item => {
      dataRows.push([
        item.id,
        item.category,
        item.name,
        item.unit,
        item.prevYear,
        item.currYear,
        item.diff,
        item.rateStr,
        item.detail
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "예산_인포그래픽_추출");

    const exportFileName = `예산데이터_추출_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, exportFileName);
    BudgetUI.showToast(`'${exportFileName}' 엑셀 파일이 다운로드되었습니다.`, 'success');
  },

  /**
   * 현재 데이터를 CSV 파일로 내보내기 (UTF-8 with BOM)
   */
  exportToCsv() {
    if (!this.currentData || !this.currentData.items) return;
    const items = BudgetUI.getFilteredItems();

    const headers = [
      "연번", 
      "분야 (중점영역)", 
      "세부 사업 / 주요 지표", 
      "구분/단위", 
      this.currentData.prevYearLabel, 
      this.currentData.currYearLabel, 
      "증감 (B-A)", 
      "증가율 (%)", 
      "핵심 내용 및 보도자료 박스 원문 근거"
    ];

    let csvContent = "\uFEFF"; // Excel UTF-8 인식용 BOM
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\r\n";

    items.forEach(item => {
      const row = [
        item.id,
        item.category,
        item.name,
        item.unit,
        item.prevYear,
        item.currYear,
        item.diff,
        item.rateStr,
        item.detail
      ];
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\r\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `예산데이터_추출_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    BudgetUI.showToast("CSV 파일이 다운로드되었습니다.", 'success');
  }
};
