/**
 * ui.js
 * DOM 조작, 컴포넌트 렌더링, 필터링 및 테이블 상호작용 모듈
 */

const BudgetUI = {
  state: {
    data: null,
    metrics: null,
    filterCategory: 'all',
    searchKeyword: '',
    onlyNew: false,
    sortField: 'id',
    sortOrder: 'asc' // 'asc' | 'desc'
  },

  /**
   * UI 전체 갱신
   */
  render(budgetData) {
    this.state.data = budgetData;
    this.state.metrics = BudgetParser.calculateMetrics(budgetData.items);

    this.renderHeaderMeta();
    this.renderKPICards();
    this.renderCategoryCards();
    this.renderNewProjectsGallery();
    this.populateCategoryFilter();
    this.renderTable();

    // Lucide 아이콘 초기화
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /**
   * 상단 헤더 메타정보 갱신
   */
  renderHeaderMeta() {
    const fileLabel = document.getElementById('currentFileName');
    const badgeLabel = document.getElementById('yearComparisonBadge');

    if (fileLabel) {
      fileLabel.textContent = this.state.data.fileName || "업로드된 파일";
    }

    if (badgeLabel) {
      const prev = this.state.data.prevYearLabel || "기준연도";
      const curr = this.state.data.currYearLabel || "정부안";
      badgeLabel.textContent = `${prev} ➔ ${curr}`;
    }
  },

  /**
   * 상단 핵심 KPI 요약 카드 렌더링
   */
  renderKPICards() {
    const m = this.state.metrics;
    const unit = this.state.data.unit || "억원";

    // 1. 총 예산
    const totalCurrElem = document.getElementById('kpiTotalCurr');
    const totalDiffElem = document.getElementById('kpiTotalDiff');
    if (totalCurrElem) {
      totalCurrElem.textContent = `${m.totalCurrYear.toLocaleString()} ${unit}`;
    }
    if (totalDiffElem) {
      const diffSign = m.totalDiff >= 0 ? "+" : "";
      const isPositive = m.totalDiff >= 0;
      totalDiffElem.innerHTML = `전년 대비 <span class="${isPositive ? 'text-emerald-600' : 'text-rose-600'} font-semibold">${diffSign}${m.totalDiff.toLocaleString()} ${unit}</span>`;
    }

    // 2. 전체 증감률
    const totalRateElem = document.getElementById('kpiTotalRate');
    const totalRateBadge = document.getElementById('kpiTotalRateBadge');
    if (totalRateElem) {
      const sign = m.totalRate >= 0 ? "+" : "";
      totalRateElem.textContent = `${sign}${m.totalRate.toFixed(1)}%`;
      if (totalRateBadge) {
        totalRateBadge.className = `kpi-badge ${m.totalRate >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`;
        totalRateBadge.innerHTML = m.totalRate >= 0 ? '▲ 증액 편성' : '▼ 감액 편성';
      }
    }

    // 3. 중점 분야 수 및 사업 수
    const catCountElem = document.getElementById('kpiCategoryCount');
    const itemCountElem = document.getElementById('kpiItemCount');
    if (catCountElem) catCountElem.textContent = `${m.categories.length}개 분야`;
    if (itemCountElem) itemCountElem.textContent = `총 ${m.totalCount}개 세부사업 지표`;

    // 4. 신규 사업 규모 & 비중
    const newBudgetElem = document.getElementById('kpiNewBudget');
    const newCountElem = document.getElementById('kpiNewCount');
    if (newBudgetElem) {
      newBudgetElem.textContent = `${m.newTotalBudget.toLocaleString()} ${unit}`;
    }
    if (newCountElem) {
      newCountElem.innerHTML = `총 <strong class="text-indigo-600 font-bold">${m.newCount}개 사업</strong> (전체 예산의 ${m.newRatioBudget}%)`;
    }
  },

  /**
   * 분야별 인포그래픽 미니 카드 그리드
   */
  renderCategoryCards() {
    const container = document.getElementById('categoryCardsGrid');
    if (!container) return;

    const categories = this.state.metrics.categories;
    const unit = this.state.data.unit || "억원";

    container.innerHTML = categories.map((cat, index) => {
      const isSelected = this.state.filterCategory === cat.category;
      const rateSign = cat.rate >= 0 ? '+' : '';
      const rateClass = cat.rate >= 0 ? 'badge-green' : 'badge-red';

      return `
        <div class="category-card ${isSelected ? 'active' : ''}" data-category="${this.escapeHtml(cat.category)}">
          <div class="category-card-header">
            <span class="category-title" title="${this.escapeHtml(cat.category)}">${this.escapeHtml(cat.category)}</span>
            <span class="rate-badge ${rateClass}">${rateSign}${cat.rate.toFixed(1)}%</span>
          </div>
          <div class="category-budget">
            <div class="budget-value">${cat.currYearTotal.toLocaleString()} <span class="unit">${unit}</span></div>
            <div class="budget-diff">전년 대비 ${cat.diffTotal >= 0 ? '+' : ''}${cat.diffTotal.toLocaleString()} ${unit}</div>
          </div>
          <div class="category-progress-container">
            <div class="category-progress-bar" style="width: ${Math.min(cat.budgetShare, 100)}%;"></div>
          </div>
          <div class="category-footer">
            <span>점유율 <strong>${cat.budgetShare}%</strong></span>
            <span>사업 <strong>${cat.count}건</strong> ${cat.newCount > 0 ? `(신규 <b class="text-purple-600">${cat.newCount}</b>)` : ''}</span>
          </div>
        </div>
      `;
    }).join('');

    // 카드 클릭 시 테이블 해당 분야로 필터링
    container.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('click', () => {
        const cat = card.getAttribute('data-category');
        if (this.state.filterCategory === cat) {
          this.state.filterCategory = 'all'; // 토글 해제
        } else {
          this.state.filterCategory = cat;
        }

        // 셀렉트 박스 동기화
        const filterSelect = document.getElementById('tableCategoryFilter');
        if (filterSelect) {
          filterSelect.value = this.state.filterCategory;
        }

        this.renderCategoryCards();
        this.renderTable();

        // 테이블 영역으로 스무스 스크롤
        const tableSection = document.getElementById('detailTableSection');
        if (tableSection && this.state.filterCategory !== 'all') {
          tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  },

  /**
   * 신규 사업 집중 조명 갤러리 카드 렌더링
   */
  renderNewProjectsGallery() {
    const container = document.getElementById('newProjectsGallery');
    const badgeCount = document.getElementById('newProjectsBadgeCount');
    if (!container) return;

    const newProjects = this.state.metrics.newProjects;
    const unit = this.state.data.unit || "억원";

    if (badgeCount) {
      badgeCount.textContent = `${newProjects.length}개 사업`;
    }

    if (newProjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="info" class="empty-icon"></i>
          <p>감지된 신규 사업이 없습니다.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = newProjects.map(proj => {
      return `
        <div class="new-project-card">
          <div class="new-project-top">
            <span class="badge-new-pill">NEW 신규</span>
            <span class="new-project-category">${this.escapeHtml(proj.category)}</span>
          </div>
          <h4 class="new-project-name" title="${this.escapeHtml(proj.name)}">${this.escapeHtml(proj.name)}</h4>
          <div class="new-project-budget">
            <span class="label">신규 편성액</span>
            <span class="amount">${proj.currYear.toLocaleString()} <span class="unit">${unit}</span></span>
          </div>
          <div class="new-project-detail">
            ${this.escapeHtml(proj.detail)}
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * 분야 필터 셀렉트박스 옵션 채우기
   */
  populateCategoryFilter() {
    const select = document.getElementById('tableCategoryFilter');
    if (!select) return;

    const currentVal = this.state.filterCategory;
    const categories = this.state.metrics.categories.map(c => c.category);

    let html = `<option value="all">전체 분야 보기 (${this.state.metrics.totalCount}건)</option>`;
    categories.forEach(cat => {
      html += `<option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>`;
    });

    select.innerHTML = html;
    select.value = currentVal;
  },

  /**
   * 테이블 필터링 및 정렬 데이터 계산
   */
  getFilteredItems() {
    let items = [...this.state.data.items];

    // 분야 필터
    if (this.state.filterCategory !== 'all') {
      items = items.filter(i => i.category === this.state.filterCategory);
    }

    // 신규사업 토글 필터
    if (this.state.onlyNew) {
      items = items.filter(i => i.isNew);
    }

    // 검색어 필터
    if (this.state.searchKeyword) {
      const kw = this.state.searchKeyword.toLowerCase();
      items = items.filter(i => 
        i.name.toLowerCase().includes(kw) ||
        i.category.toLowerCase().includes(kw) ||
        i.detail.toLowerCase().includes(kw)
      );
    }

    // 정렬
    const { sortField, sortOrder } = this.state;
    items.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'rate') {
        // '신규'는 최상위나 특정 기준 처리
        valA = a.isNew ? 999999 : (a.rate || 0);
        valB = b.isNew ? 999999 : (b.rate || 0);
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' 
          ? valA.localeCompare(valB, 'ko') 
          : valB.localeCompare(valA, 'ko');
      }

      return sortOrder === 'asc' ? (valA - valB) : (valB - valA);
    });

    return items;
  },

  /**
   * 데이터 테이블 렌더링
   */
  renderTable() {
    const tbody = document.getElementById('budgetTableBody');
    const tableCountElem = document.getElementById('tableFilteredCount');
    const thPrevYear = document.getElementById('thPrevYear');
    const thCurrYear = document.getElementById('thCurrYear');

    if (!tbody) return;

    if (thPrevYear) thPrevYear.textContent = this.state.data.prevYearLabel;
    if (thCurrYear) thCurrYear.textContent = this.state.data.currYearLabel;

    const filtered = this.getFilteredItems();

    if (tableCountElem) {
      tableCountElem.textContent = `조회 결과: 총 ${filtered.length}건`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="table-empty">
            <div class="empty-state">
              <p>조건에 일치하는 사업 내역이 없습니다.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const isNewBadge = item.isNew 
        ? `<span class="badge-new">신규</span>` 
        : '';
      
      const diffClass = item.diff > 0 ? 'text-emerald-600 font-semibold' : (item.diff < 0 ? 'text-rose-600 font-semibold' : 'text-slate-500');
      const diffSign = item.diff > 0 ? '+' : '';

      let rateBadgeHtml = '';
      if (item.isNew) {
        rateBadgeHtml = `<span class="badge-new-soft">신규</span>`;
      } else {
        const isUp = item.rate >= 0;
        rateBadgeHtml = `<span class="badge-rate ${isUp ? 'rate-up' : 'rate-down'}">${item.rateStr}</span>`;
      }

      return `
        <tr class="${item.isNew ? 'row-new-highlight' : ''}">
          <td class="text-center font-mono text-slate-500 text-sm">${item.id}</td>
          <td class="font-medium text-slate-800 category-cell">${this.escapeHtml(item.category)}</td>
          <td class="font-semibold text-slate-900 name-cell">
            ${this.escapeHtml(item.name)}
            ${isNewBadge}
          </td>
          <td class="text-center text-xs text-slate-500">${this.escapeHtml(item.unit)}</td>
          <td class="text-right font-mono">${item.prevYear.toLocaleString()}</td>
          <td class="text-right font-mono font-bold text-blue-700">${item.currYear.toLocaleString()}</td>
          <td class="text-right font-mono ${diffClass}">${diffSign}${item.diff.toLocaleString()}</td>
          <td class="text-center">${rateBadgeHtml}</td>
          <td class="detail-cell text-sm text-slate-600" title="${this.escapeHtml(item.detail)}">
            ${this.escapeHtml(item.detail)}
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * 토스트 알림창 띄우기
   */
  showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <span>${this.escapeHtml(message)}</span>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  /**
   * XSS 방어용 HTML 엔티티 이스케이프
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

if (typeof window !== 'undefined') {
  window.BudgetUI = BudgetUI;
}
